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
 * dev.db, same as before Turso existed, and apps/desktop's standalone
 * build works the same way pointed at its own userData path. The
 * datasource provider in schema.prisma stays "sqlite" either way; libSQL
 * is wire-compatible.
 */
function createPrismaClient(): PrismaClient {
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
