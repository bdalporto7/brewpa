import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Always goes through the libsql driver adapter — never bare
 * `new PrismaClient()` — even for a plain local file with no Turso
 * account at all. `@libsql/client` opens a local file directly
 * (`createClient({ url: "file:..." })`) with no sync/auth needed, so this
 * costs nothing for the plain-local-dev case, and it means the only
 * native binary this app ever needs is libsql's own per-platform addon —
 * never Prisma's separate query-engine binary. That matters most for the
 * Electron build (apps/desktop): Prisma's engine has real, currently-
 * reported packaging failures there, and this sidesteps the whole class
 * of bug by never loading it in the first place, in every environment.
 *
 * Turso (hosted libSQL) when TURSO_DATABASE_URL/TURSO_AUTH_TOKEN are set,
 * otherwise the plain local SQLite file via DATABASE_URL — so cloning this
 * repo without a Turso database configured still works against a local
 * dev.db, same as before Turso existed. The datasource provider in
 * schema.prisma stays "sqlite" either way; libSQL is wire-compatible.
 *
 * The desktop app (APP_MODE=desktop) is its own case, checked first and
 * explicitly: it never has TURSO_* vars at all (main.ts no longer passes
 * them through — the desktop app doesn't talk to the remote DB directly
 * for anything anymore, see src/auth.ts's desktopAuth), so this is really
 * just "always the local file" for desktop, made explicit rather than
 * relying on the fallthrough `url ?? url` below happening to do the right
 * thing by omission.
 *
 * Within desktop mode, the local file is always plain SQLite now,
 * DESKTOP_SYNC_ENABLED or not — "sync" is an application-level operation
 * (src/lib/sync-client.ts, over the /api/sync/pull|push HTTP endpoints)
 * rather than a different *kind* of local database. Earlier versions of
 * this app used a libsql *embedded replica* here instead (reads local,
 * writes straight to the same remote primary the web app writes to) —
 * replaced because a replica mirrors the entire remote database with no
 * concept of team boundaries, which stopped being safe the moment a
 * second team could exist.
 */
function createPrismaClient(): PrismaClient {
  if (process.env.APP_MODE === "desktop") {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("desktop mode requires DATABASE_URL.");

    const adapter = new PrismaLibSQL({ url });
    return new PrismaClient({ adapter });
  }

  const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error("DATABASE_URL (or TURSO_DATABASE_URL) must be set.");
  }

  const adapter = new PrismaLibSQL(authToken ? { url, authToken } : { url });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
