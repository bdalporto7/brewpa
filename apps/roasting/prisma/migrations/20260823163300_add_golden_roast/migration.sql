-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Bean" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "producer" TEXT,
    "process" TEXT NOT NULL,
    "variety" TEXT,
    "supplier" TEXT,
    "supplierUrl" TEXT,
    "purchaseDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purchasePrice" REAL,
    "weightGrams" REAL NOT NULL,
    "remainingGrams" REAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "goldenRoastId" TEXT,
    CONSTRAINT "Bean_goldenRoastId_fkey" FOREIGN KEY ("goldenRoastId") REFERENCES "RoastSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Bean" ("createdAt", "id", "name", "notes", "origin", "process", "producer", "purchaseDate", "purchasePrice", "remainingGrams", "supplier", "supplierUrl", "updatedAt", "variety", "weightGrams") SELECT "createdAt", "id", "name", "notes", "origin", "process", "producer", "purchaseDate", "purchasePrice", "remainingGrams", "supplier", "supplierUrl", "updatedAt", "variety", "weightGrams" FROM "Bean";
DROP TABLE "Bean";
ALTER TABLE "new_Bean" RENAME TO "Bean";
CREATE UNIQUE INDEX "Bean_goldenRoastId_key" ON "Bean"("goldenRoastId");
CREATE INDEX "Bean_origin_idx" ON "Bean"("origin");
CREATE INDEX "Bean_createdAt_idx" ON "Bean"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
