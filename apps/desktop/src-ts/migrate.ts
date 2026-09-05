import { createClient } from "@libsql/client";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { randomUUID } from "node:crypto";

/**
 * A fixed constant, not a real account — must stay in sync with
 * apps/roasting/src/auth.ts's DESKTOP_GUEST_EMAIL. Duplicated here rather
 * than imported since apps/desktop doesn't depend on apps/roasting as a
 * package (it copies its build output at package time, see
 * scripts/prepare-app.js) — there's no module boundary to import across.
 */
const DESKTOP_GUEST_EMAIL = "local@cybar.app";

function sha256(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Applies any of apps/roasting/prisma/migrations/**\/migration.sql not yet
 * recorded as applied, directly over a libsql connection — no Prisma CLI,
 * no schema-engine binary (see the plan's decision 5 for why: that binary
 * has real, currently-reported packaging failures in Electron). Tracks
 * applied migrations in a `_prisma_migrations` table with the exact same
 * shape the real Prisma CLI uses (columns and checksum algorithm both
 * confirmed against a live Prisma-migrated database, not assumed) — so
 * the resulting file stays inspectable/repairable with the real `prisma
 * migrate` CLI if that's ever needed, even though it's never invoked here.
 */
export async function runMigrations(dbPath: string, appBundleDir: string): Promise<void> {
  const client = createClient({ url: `file:${dbPath}` });

  await client.execute(`
    CREATE TABLE IF NOT EXISTS _prisma_migrations (
      id                  TEXT PRIMARY KEY NOT NULL,
      checksum            TEXT NOT NULL,
      finished_at         DATETIME,
      migration_name      TEXT NOT NULL,
      logs                TEXT,
      rolled_back_at      DATETIME,
      started_at          DATETIME NOT NULL DEFAULT current_timestamp,
      applied_steps_count INTEGER UNSIGNED NOT NULL DEFAULT 0
    )
  `);

  const appliedRows = await client.execute("SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL");
  const applied = new Set(appliedRows.rows.map((r) => r.migration_name as string));

  const migrationsDir = path.join(appBundleDir, "prisma", "migrations");
  const migrationFolders = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort(); // timestamp-prefixed — lexical sort is chronological

  const isFreshDb = applied.size === 0 && migrationFolders.length > 0;

  for (const name of migrationFolders) {
    if (applied.has(name)) continue;

    const sqlPath = path.join(migrationsDir, name, "migration.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");
    const checksum = sha256(sql);
    const startedAt = new Date().toISOString();

    console.log(`[migrate] applying ${name}`);
    await client.executeMultiple(sql);

    await client.execute({
      sql: `INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, started_at, applied_steps_count)
            VALUES (?, ?, ?, ?, ?, 1)`,
      args: [randomUUID(), checksum, new Date().toISOString(), name, startedAt],
    });
  }

  // A brand-new DB (no migrations were already applied, i.e. this is a
  // true first launch) needs one seeded AllowedUser row so
  // requireAdmin()/getCurrentAllowedUser() (src/lib/admin.ts) work at all
  // — the standalone auth bypass provides a fake *session*, but
  // admin-gated code still does a real lookup against this table.
  if (isFreshDb) {
    const existing = await client.execute({
      sql: "SELECT id FROM AllowedUser WHERE email = ?",
      args: [DESKTOP_GUEST_EMAIL],
    });
    if (existing.rows.length === 0) {
      console.log(`[migrate] seeding local admin user (${DESKTOP_GUEST_EMAIL})`);
      await client.execute({
        sql: "INSERT INTO AllowedUser (id, email, isAdmin, createdAt) VALUES (?, ?, 1, ?)",
        args: [randomUUID(), DESKTOP_GUEST_EMAIL, new Date().toISOString()],
      });
    }
  }

  client.close();
}
