import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Turso (hosted libSQL) when TURSO_DATABASE_URL/TURSO_AUTH_TOKEN are set,
 * otherwise the plain local SQLite file via DATABASE_URL — so cloning this
 * repo without a Turso database configured still works against a local
 * dev.db, same as before Turso existed. The datasource provider in
 * schema.prisma stays "sqlite" either way; libSQL is wire-compatible.
 */
function createPrismaClient(): PrismaClient {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (url && authToken) {
    const adapter = new PrismaLibSQL({ url, authToken });
    return new PrismaClient({ adapter });
  }

  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
