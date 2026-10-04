import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

/**
 * Same database as apps/roasting, always through the libSQL driver adapter
 * (Turso when TURSO_* is set, otherwise the local SQLite file) — see
 * apps/roasting/src/lib/prisma.ts for the full reasoning.
 */
function createPrismaClient(): PrismaClient {
  const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error("DATABASE_URL (or TURSO_DATABASE_URL) must be set.");
  const adapter = new PrismaLibSQL(authToken ? { url, authToken } : { url });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
