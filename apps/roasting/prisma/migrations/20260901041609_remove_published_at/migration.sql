/*
  Warnings:

  - You are about to drop the column `publishedAt` on the `RoastSession` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RoastSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "beanId" TEXT NOT NULL,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "greenWeightGrams" REAL NOT NULL,
    "roastedWeightGrams" REAL,
    "roastedRemainingGrams" REAL,
    "roastLevel" TEXT,
    "rating" INTEGER,
    "notes" TEXT,
    "ambientTempF" REAL,
    "roastGoal" TEXT,
    "brewTarget" TEXT,
    "suggestedFanLevel" INTEGER,
    "suggestedHeatLevel" INTEGER,
    "aiSuggestionSummary" TEXT,
    "aiSuggestionNotes" TEXT,
    "aiSuggestionPlan" TEXT,
    "aiSuggestionAcceptedAt" DATETIME,
    "aiSuggestionFeedback" TEXT,
    "profileId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "compareToId" TEXT,
    CONSTRAINT "RoastSession_beanId_fkey" FOREIGN KEY ("beanId") REFERENCES "Bean" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RoastSession_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "RoastProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RoastSession_compareToId_fkey" FOREIGN KEY ("compareToId") REFERENCES "RoastSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RoastSession" ("aiSuggestionAcceptedAt", "aiSuggestionFeedback", "aiSuggestionNotes", "aiSuggestionPlan", "aiSuggestionSummary", "ambientTempF", "beanId", "brewTarget", "compareToId", "createdAt", "endedAt", "greenWeightGrams", "id", "notes", "profileId", "rating", "roastGoal", "roastLevel", "roastedRemainingGrams", "roastedWeightGrams", "startedAt", "suggestedFanLevel", "suggestedHeatLevel", "updatedAt") SELECT "aiSuggestionAcceptedAt", "aiSuggestionFeedback", "aiSuggestionNotes", "aiSuggestionPlan", "aiSuggestionSummary", "ambientTempF", "beanId", "brewTarget", "compareToId", "createdAt", "endedAt", "greenWeightGrams", "id", "notes", "profileId", "rating", "roastGoal", "roastLevel", "roastedRemainingGrams", "roastedWeightGrams", "startedAt", "suggestedFanLevel", "suggestedHeatLevel", "updatedAt" FROM "RoastSession";
DROP TABLE "RoastSession";
ALTER TABLE "new_RoastSession" RENAME TO "RoastSession";
CREATE INDEX "RoastSession_beanId_idx" ON "RoastSession"("beanId");
CREATE INDEX "RoastSession_startedAt_idx" ON "RoastSession"("startedAt");
CREATE INDEX "RoastSession_profileId_idx" ON "RoastSession"("profileId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
