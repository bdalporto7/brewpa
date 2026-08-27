-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Recipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "doseGrams" REAL NOT NULL,
    "waterGrams" REAL NOT NULL,
    "grindSetting" TEXT,
    "waterTempF" REAL,
    "brewTimeSeconds" INTEGER,
    "notes" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Recipe" ("brewTimeSeconds", "createdAt", "doseGrams", "grindSetting", "id", "method", "name", "notes", "updatedAt", "waterGrams", "waterTempF") SELECT "brewTimeSeconds", "createdAt", "doseGrams", "grindSetting", "id", "method", "name", "notes", "updatedAt", "waterGrams", "waterTempF" FROM "Recipe";
DROP TABLE "Recipe";
ALTER TABLE "new_Recipe" RENAME TO "Recipe";
CREATE INDEX "Recipe_method_idx" ON "Recipe"("method");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
