/*
  Warnings:

  - You are about to drop the column `buyerName` on the `Sale` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "Friend" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roastSessionId" TEXT NOT NULL,
    "friendId" TEXT,
    "weightGrams" REAL NOT NULL,
    "price" REAL,
    "soldAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sale_roastSessionId_fkey" FOREIGN KEY ("roastSessionId") REFERENCES "RoastSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Sale_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "Friend" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Sale" ("createdAt", "id", "notes", "price", "roastSessionId", "soldAt", "weightGrams") SELECT "createdAt", "id", "notes", "price", "roastSessionId", "soldAt", "weightGrams" FROM "Sale";
DROP TABLE "Sale";
ALTER TABLE "new_Sale" RENAME TO "Sale";
CREATE INDEX "Sale_roastSessionId_idx" ON "Sale"("roastSessionId");
CREATE INDEX "Sale_friendId_idx" ON "Sale"("friendId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Friend_name_idx" ON "Friend"("name");
