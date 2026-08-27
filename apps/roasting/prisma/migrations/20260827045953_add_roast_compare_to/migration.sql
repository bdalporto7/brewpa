-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RoastSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "beanId" TEXT NOT NULL,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "publishedAt" DATETIME,
    "greenWeightGrams" REAL NOT NULL,
    "roastedWeightGrams" REAL,
    "roastedRemainingGrams" REAL,
    "roastLevel" TEXT,
    "rating" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "compareToId" TEXT,
    CONSTRAINT "RoastSession_beanId_fkey" FOREIGN KEY ("beanId") REFERENCES "Bean" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RoastSession_compareToId_fkey" FOREIGN KEY ("compareToId") REFERENCES "RoastSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RoastSession" ("beanId", "createdAt", "endedAt", "greenWeightGrams", "id", "notes", "publishedAt", "rating", "roastLevel", "roastedRemainingGrams", "roastedWeightGrams", "startedAt", "updatedAt") SELECT "beanId", "createdAt", "endedAt", "greenWeightGrams", "id", "notes", "publishedAt", "rating", "roastLevel", "roastedRemainingGrams", "roastedWeightGrams", "startedAt", "updatedAt" FROM "RoastSession";
DROP TABLE "RoastSession";
ALTER TABLE "new_RoastSession" RENAME TO "RoastSession";
CREATE INDEX "RoastSession_beanId_idx" ON "RoastSession"("beanId");
CREATE INDEX "RoastSession_startedAt_idx" ON "RoastSession"("startedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
