import { createClient } from "@libsql/client";
import * as fs from "node:fs";

type Client = ReturnType<typeof createClient>;

/**
 * Must stay in sync with apps/roasting/src/auth.ts's DESKTOP_GUEST_EMAIL —
 * duplicated for the same reason migrate.ts duplicates it (no module
 * boundary between apps/desktop and apps/roasting to import across).
 */
const DESKTOP_GUEST_EMAIL = "local@cybar.app";

interface MigrateTableOptions {
  /** Column used to decide "does this row already exist on remote?" — "id" unless overridden. */
  dedupeKey?: string;
  /**
   * Runs on each row that's genuinely local-only, right before it's
   * inserted remotely. Return a modified row to change what gets written
   * (e.g. null out a not-yet-resolvable FK, remap an owner), or null to
   * skip the row entirely.
   */
  transform?: (row: Record<string, unknown>) => Record<string, unknown> | null;
}

interface MigrateTableResult {
  localCount: number;
  insertedCount: number;
  /** The ORIGINAL local rows that got inserted (pre-transform) — kept around so a later pass can go back and fix up deferred FKs. */
  insertedRows: Record<string, unknown>[];
}

async function fetchRows(client: Client, table: string): Promise<{ columns: string[]; rows: Record<string, unknown>[] }> {
  const result = await client.execute(`SELECT * FROM "${table}"`);
  const columns = result.columns as string[];
  const rows = result.rows.map((r) => {
    const obj: Record<string, unknown> = {};
    for (const col of columns) obj[col] = (r as unknown as Record<string, unknown>)[col];
    return obj;
  });
  return { columns, rows };
}

async function fetchKeySet(client: Client, table: string, keyColumn: string): Promise<Set<string>> {
  const result = await client.execute(`SELECT "${keyColumn}" FROM "${table}"`);
  return new Set(result.rows.map((r) => (r as unknown as Record<string, unknown>)[keyColumn] as string));
}

/**
 * cuid primary keys (every model in schema.prisma uses one) are
 * time+random based, so an id match reliably means "this is the same row,
 * already synced" — there's no realistic case of two independently-created
 * rows colliding on id. That means plain PK-equality dedup is sufficient
 * here; no fuzzy content-based matching needed on top of it. AllowedUser is
 * the one exception (dedupes on its own unique `email` instead — see below).
 */
async function migrateTable(local: Client, remote: Client, table: string, opts: MigrateTableOptions = {}): Promise<MigrateTableResult> {
  const dedupeKey = opts.dedupeKey ?? "id";
  const { columns, rows: localRows } = await fetchRows(local, table);
  const remoteKeys = await fetchKeySet(remote, table, dedupeKey);

  const insertedRows: Record<string, unknown>[] = [];
  for (const row of localRows) {
    const key = row[dedupeKey] as string;
    if (remoteKeys.has(key)) continue;

    const toInsert = opts.transform ? opts.transform(row) : row;
    if (toInsert === null) continue;

    const sql = `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`;
    await remote.execute({ sql, args: columns.map((c) => toInsert[c] as never) });

    insertedRows.push(row);
    remoteKeys.add(key);
  }

  return { localCount: localRows.length, insertedCount: insertedRows.length, insertedRows };
}

/**
 * Bean.goldenRoastId and RoastSession.compareToId both point at a
 * RoastSession row — one that, at insert time, may not exist on the remote
 * yet (Bean is migrated before RoastSession; a RoastSession being compared
 * against might itself be migrated later in the same batch). Both columns
 * get forced to NULL on insert (see the transforms below) and patched in
 * here afterward, once every RoastSession that's ever going to exist on the
 * remote this run actually does.
 */
async function relinkDeferredSelfRef(
  remote: Client,
  table: string,
  fkColumn: string,
  insertedRows: Record<string, unknown>[],
  validTargetIds: Set<string>,
): Promise<number> {
  let updated = 0;
  for (const row of insertedRows) {
    const fkValue = row[fkColumn];
    if (fkValue == null) continue;
    if (!validTargetIds.has(fkValue as string)) {
      console.warn(`[migrate-to-remote] ${table}.${fkColumn} on ${row.id} points at ${fkValue}, which never made it to the remote — leaving it unset`);
      continue;
    }
    await remote.execute({
      sql: `UPDATE "${table}" SET "${fkColumn}" = ? WHERE "id" = ?`,
      args: [fkValue as string, row.id as string],
    });
    updated++;
  }
  return updated;
}

/**
 * Runs once, right before main.ts wipes a plain local db file to turn it
 * into a libsql embedded replica (see that file's comment on why the wipe
 * happens at all). Walks every local-only row not already present on the
 * remote and pushes it over via a direct one-off libsql client — same
 * one-off-client pattern as migrate.ts and sync-actions.ts — in dependency
 * order, so a roast never lands on the remote before the bean it belongs
 * to, etc.
 *
 * Deliberately conservative: this only ever INSERTs rows the remote is
 * missing. It never updates or deletes an existing remote row, so there's
 * no attempt at reconciling a row that's been edited differently in both
 * places — with a single-writer-per-file model (either you're on the
 * local file or the replica, never both at once) that situation can't
 * actually arise for the same id anyway.
 */
export async function migrateLocalDataToRemote(dbPath: string, remoteUrl: string, remoteAuthToken: string, syncedEmail: string | undefined): Promise<void> {
  if (!fs.existsSync(dbPath)) {
    console.log("[migrate-to-remote] no local database file yet — nothing to migrate");
    return;
  }

  const local = createClient({ url: `file:${dbPath}` });
  const remote = createClient({ url: remoteUrl, authToken: remoteAuthToken });

  try {
    // Guards against a zero-byte or otherwise not-yet-migrated local file
    // (e.g. this launch is the very first one ever, and syncEnabled just
    // happened to already be true) rather than assuming every table below
    // exists.
    const schemaCheck = await local.execute(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'RoastSession'`);
    if (schemaCheck.rows.length === 0) {
      console.log("[migrate-to-remote] local database has no schema yet — nothing to migrate");
      return;
    }

    const localGuestRow = await local.execute({ sql: "SELECT id FROM AllowedUser WHERE email = ?", args: [DESKTOP_GUEST_EMAIL] });
    const localGuestUserId = localGuestRow.rows[0]?.id as string | undefined;

    let remoteRealUserId: string | undefined;
    if (syncedEmail) {
      const remoteUserRow = await remote.execute({ sql: "SELECT id FROM AllowedUser WHERE email = ?", args: [syncedEmail] });
      remoteRealUserId = remoteUserRow.rows[0]?.id as string | undefined;
    }

    const summaryLines: string[] = [];
    let totalInserted = 0;

    async function run(table: string, opts?: MigrateTableOptions): Promise<MigrateTableResult> {
      const result = await migrateTable(local, remote, table, opts);
      totalInserted += result.insertedCount;
      const alreadyOnRemote = result.localCount - result.insertedCount;
      summaryLines.push(`${table}: ${result.insertedCount} migrated, ${alreadyOnRemote} already on remote (${result.localCount} local total)`);
      return result;
    }

    // Independent tables first.
    await run("Friend");
    await run("Recipe");
    await run("RoastProfile");

    // Bean before RoastSession (required FK); goldenRoastId deferred (see
    // relinkDeferredSelfRef above).
    const beanResult = await run("Bean", { transform: (row) => ({ ...row, goldenRoastId: null }) });

    // RoastSession's beanId/profileId are already resolvable (Bean and
    // RoastProfile above); compareToId is self-referential and deferred.
    const sessionResult = await run("RoastSession", { transform: (row) => ({ ...row, compareToId: null }) });

    const remoteSessionIds = await fetchKeySet(remote, "RoastSession", "id");
    const goldenRelinked = await relinkDeferredSelfRef(remote, "Bean", "goldenRoastId", beanResult.insertedRows, remoteSessionIds);
    const compareRelinked = await relinkDeferredSelfRef(remote, "RoastSession", "compareToId", sessionResult.insertedRows, remoteSessionIds);
    if (goldenRelinked > 0) summaryLines.push(`Bean.goldenRoastId: ${goldenRelinked} relinked to their roast on remote`);
    if (compareRelinked > 0) summaryLines.push(`RoastSession.compareToId: ${compareRelinked} relinked`);

    // Everything else that hangs off a RoastSession and/or Bean.
    await run("RoastEvent");
    await run("TemperatureReading");
    await run("Sale");
    await run("CuppingNote");
    await run("Drop");
    await run("DropClaim");

    // AllowedUser dedupes on email (its own unique constraint), not id —
    // and the local guest row is a placeholder seeded fresh into every
    // unsynced install (migrate.ts), never a real account, so it's
    // deliberately never pushed to the remote.
    await run("AllowedUser", {
      dedupeKey: "email",
      transform: (row) => (row.email === DESKTOP_GUEST_EMAIL ? null : row),
    });

    // Brew rows logged locally, before sign-in, were attributed to that
    // same guest placeholder — reassign them to the real signed-in user's
    // remote row so they show up as that person's own brew log instead of
    // vanishing into an account nobody can see. A Brew owned by some other,
    // real local AllowedUser (rare — only possible if the local admin
    // portal was used to add one before ever syncing) is left as-is; that
    // row's own AllowedUser was migrated above under the same id.
    await run("Brew", {
      transform: (row) => {
        if (row.userId !== localGuestUserId) return row;
        if (!remoteRealUserId) {
          console.warn(`[migrate-to-remote] skipping Brew ${row.id}: it belongs to the local guest account, and the signed-in user's remote id couldn't be resolved`);
          return null;
        }
        return { ...row, userId: remoteRealUserId };
      },
    });

    // AiSuggestionCall/SupplierExtractionCall are pure rate-limit
    // bookkeeping (see schema.prisma) — timestamps of past calls against a
    // *daily* limit that's meaningless once carried over from a different
    // day, and meaningless to push into a *global* limit that's about the
    // remote's own call history, not this machine's. Intentionally never
    // migrated.

    if (totalInserted === 0) {
      console.log("[migrate-to-remote] local database had nothing the remote doesn't already have — nothing to migrate");
    } else {
      console.log(`[migrate-to-remote] migrated ${totalInserted} row(s) from the local database to the remote before switching this install over to sync:`);
      for (const line of summaryLines) console.log(`[migrate-to-remote]   ${line}`);
    }
  } finally {
    local.close();
    remote.close();
  }
}
