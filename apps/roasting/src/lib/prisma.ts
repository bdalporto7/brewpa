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
 * explicitly, never falling into the plain `url ?? url` branch below even
 * though it also sets TURSO_* vars: those vars are present there from the
 * very first launch (src/auth.ts's real-sign-in allowlist check needs to
 * reach the remote DB before sync is ever turned on), which would
 * otherwise make this branch connect straight to the remote database
 * instead of the local file the desktop app is supposed to read/write —
 * "both vars happen to be set" can't be trusted to mean "connect to Turso"
 * the way it can for the hosted deployment.
 *
 * Within desktop mode, DESKTOP_SYNC_ENABLED (a separate flag main.ts flips
 * once a real, allowlisted sign-in has happened — see auth.ts) decides
 * between two very different local files: plain (general users, never
 * signed in) vs. a libsql *embedded replica* of the hosted Turso database
 * (reads local/instant, writes go straight to the same remote primary the
 * web app writes to — no second database to reconcile).
 */
function createPrismaClient(): PrismaClient {
  if (process.env.APP_MODE === "desktop") {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("desktop mode requires DATABASE_URL.");

    if (process.env.DESKTOP_SYNC_ENABLED === "true") {
      const syncUrl = process.env.TURSO_DATABASE_URL;
      const authToken = process.env.TURSO_AUTH_TOKEN;
      if (!syncUrl || !authToken) {
        throw new Error("DESKTOP_SYNC_ENABLED requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.");
      }
      // A floor for hands-off background sync — independent of, and in
      // addition to, src/lib/sync-actions.ts's on-demand `.sync()` calls
      // (that adapter is a plain factory with no handle back to the client
      // it creates internally, so on-demand sync needs its own separate
      // createClient() instance pointed at the same config — see that file).
      const syncIntervalSeconds = Number(process.env.TURSO_SYNC_INTERVAL_SECONDS ?? "60");
      const adapter = new PrismaLibSQL({ url, syncUrl, authToken, syncInterval: syncIntervalSeconds });
      return new PrismaClient({ adapter });
    }

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
