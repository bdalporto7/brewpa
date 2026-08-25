/*
  Warnings:

  - You are about to drop the column `fulfilled` on the `DropClaim` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DropClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dropId" TEXT NOT NULL,
    "friendId" TEXT,
    "gramsClaimed" REAL NOT NULL,
    "price" REAL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "saleId" TEXT,
    "notes" TEXT,
    "claimedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DropClaim_dropId_fkey" FOREIGN KEY ("dropId") REFERENCES "Drop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DropClaim_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "Friend" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DropClaim_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DropClaim" ("claimedAt", "dropId", "friendId", "gramsClaimed", "id", "notes", "paid", "price") SELECT "claimedAt", "dropId", "friendId", "gramsClaimed", "id", "notes", "paid", "price" FROM "DropClaim";
DROP TABLE "DropClaim";
ALTER TABLE "new_DropClaim" RENAME TO "DropClaim";
CREATE UNIQUE INDEX "DropClaim_saleId_key" ON "DropClaim"("saleId");
CREATE INDEX "DropClaim_dropId_idx" ON "DropClaim"("dropId");
CREATE INDEX "DropClaim_friendId_idx" ON "DropClaim"("friendId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
