/*
  Warnings:

  - You are about to drop the column `accessToken` on the `Drop` table. All the data in the column will be lost.
  - Added the required column `code` to the `Drop` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "DropCodeAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ip" TEXT NOT NULL,
    "attemptedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Drop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "notes" TEXT,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Drop" ("closedAt", "createdAt", "id", "name", "notes", "updatedAt") SELECT "closedAt", "createdAt", "id", "name", "notes", "updatedAt" FROM "Drop";
DROP TABLE "Drop";
ALTER TABLE "new_Drop" RENAME TO "Drop";
CREATE UNIQUE INDEX "Drop_code_key" ON "Drop"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DropCodeAttempt_ip_attemptedAt_idx" ON "DropCodeAttempt"("ip", "attemptedAt");
