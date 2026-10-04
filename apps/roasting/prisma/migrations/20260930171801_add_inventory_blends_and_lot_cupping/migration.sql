-- CreateTable
CREATE TABLE "BlendRecipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "teamId" TEXT NOT NULL,
    CONSTRAINT "BlendRecipe_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BlendComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blendRecipeId" TEXT NOT NULL,
    "beanId" TEXT NOT NULL,
    "ratioPercent" REAL NOT NULL,
    CONSTRAINT "BlendComponent_blendRecipeId_fkey" FOREIGN KEY ("blendRecipeId") REFERENCES "BlendRecipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BlendComponent_beanId_fkey" FOREIGN KEY ("beanId") REFERENCES "Bean" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CuppingNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roastSessionId" TEXT,
    "beanId" TEXT,
    "cuppedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fragranceAroma" REAL,
    "flavor" REAL,
    "aftertaste" REAL,
    "acidity" REAL,
    "body" REAL,
    "balance" REAL,
    "uniformity" REAL,
    "cleanCup" REAL,
    "sweetness" REAL,
    "overall" REAL,
    "defects" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CuppingNote_roastSessionId_fkey" FOREIGN KEY ("roastSessionId") REFERENCES "RoastSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CuppingNote_beanId_fkey" FOREIGN KEY ("beanId") REFERENCES "Bean" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CuppingNote" ("acidity", "aftertaste", "balance", "body", "cleanCup", "createdAt", "cuppedAt", "defects", "flavor", "fragranceAroma", "id", "notes", "overall", "roastSessionId", "sweetness", "uniformity", "updatedAt") SELECT "acidity", "aftertaste", "balance", "body", "cleanCup", "createdAt", "cuppedAt", "defects", "flavor", "fragranceAroma", "id", "notes", "overall", "roastSessionId", "sweetness", "uniformity", "updatedAt" FROM "CuppingNote";
DROP TABLE "CuppingNote";
ALTER TABLE "new_CuppingNote" RENAME TO "CuppingNote";
CREATE INDEX "CuppingNote_roastSessionId_idx" ON "CuppingNote"("roastSessionId");
CREATE INDEX "CuppingNote_beanId_idx" ON "CuppingNote"("beanId");
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
    "roasterDefinitionId" TEXT NOT NULL,
    "compareToId" TEXT,
    "teamId" TEXT NOT NULL,
    "blendRecipeId" TEXT,
    "blendBatchId" TEXT,
    CONSTRAINT "RoastSession_beanId_fkey" FOREIGN KEY ("beanId") REFERENCES "Bean" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RoastSession_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "RoastProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RoastSession_roasterDefinitionId_fkey" FOREIGN KEY ("roasterDefinitionId") REFERENCES "RoasterDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RoastSession_compareToId_fkey" FOREIGN KEY ("compareToId") REFERENCES "RoastSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RoastSession_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoastSession_blendRecipeId_fkey" FOREIGN KEY ("blendRecipeId") REFERENCES "BlendRecipe" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RoastSession" ("aiSuggestionAcceptedAt", "aiSuggestionFeedback", "aiSuggestionNotes", "aiSuggestionPlan", "aiSuggestionSummary", "ambientTempF", "beanId", "brewTarget", "compareToId", "createdAt", "endedAt", "greenWeightGrams", "id", "notes", "profileId", "rating", "roastGoal", "roastLevel", "roastedRemainingGrams", "roastedWeightGrams", "roasterDefinitionId", "startedAt", "suggestedFanLevel", "suggestedHeatLevel", "teamId", "updatedAt") SELECT "aiSuggestionAcceptedAt", "aiSuggestionFeedback", "aiSuggestionNotes", "aiSuggestionPlan", "aiSuggestionSummary", "ambientTempF", "beanId", "brewTarget", "compareToId", "createdAt", "endedAt", "greenWeightGrams", "id", "notes", "profileId", "rating", "roastGoal", "roastLevel", "roastedRemainingGrams", "roastedWeightGrams", "roasterDefinitionId", "startedAt", "suggestedFanLevel", "suggestedHeatLevel", "teamId", "updatedAt" FROM "RoastSession";
DROP TABLE "RoastSession";
ALTER TABLE "new_RoastSession" RENAME TO "RoastSession";
CREATE INDEX "RoastSession_beanId_idx" ON "RoastSession"("beanId");
CREATE INDEX "RoastSession_startedAt_idx" ON "RoastSession"("startedAt");
CREATE INDEX "RoastSession_profileId_idx" ON "RoastSession"("profileId");
CREATE INDEX "RoastSession_teamId_idx" ON "RoastSession"("teamId");
CREATE INDEX "RoastSession_roasterDefinitionId_idx" ON "RoastSession"("roasterDefinitionId");
CREATE INDEX "RoastSession_blendBatchId_idx" ON "RoastSession"("blendBatchId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "BlendRecipe_teamId_idx" ON "BlendRecipe"("teamId");

-- CreateIndex
CREATE INDEX "BlendComponent_blendRecipeId_idx" ON "BlendComponent"("blendRecipeId");
