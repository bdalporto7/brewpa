-- CreateTable
CREATE TABLE "RoasterDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "supportsAiSuggestions" BOOLEAN NOT NULL DEFAULT false,
    "controlsJson" TEXT NOT NULL,
    "probesJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "teamId" TEXT NOT NULL,
    CONSTRAINT "RoasterDefinition_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RoasterDefinition_teamId_idx" ON "RoasterDefinition"("teamId");

-- Seed one default "Fresh Roast SR800" row per existing team — mirrors
-- add_teams's per-team backfill. A fresh install's own team gets its own
-- default row seeded separately by apps/desktop's migrate.ts, same split
-- add_teams used for its guest team. Literal JSON here matches
-- src/lib/roasters.ts's SR800_CONTROLS/SR800_PROBES exactly.
INSERT INTO "RoasterDefinition" ("id", "name", "isDefault", "supportsAiSuggestions", "controlsJson", "probesJson", "createdAt", "updatedAt", "teamId")
SELECT lower(hex(randomblob(16))), 'Fresh Roast SR800', true, true,
       '[{"key":"FAN","label":"Fan","min":1,"max":9,"defaultValue":5,"icon":"fan","widget":"stepper"},{"key":"HEAT","label":"Heat","min":1,"max":9,"defaultValue":5,"icon":"flame","widget":"stepper"}]',
       '[{"key":"bean","label":"Bean"}]',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, "id"
FROM "Team";

-- RedefineTables: add roasterDefinitionId NOT NULL to RoastSession,
-- backfilled to each session's own team's default row (works because the
-- seed INSERT above already ran, earlier in this same migration file).
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
    "teamId" TEXT NOT NULL,
    "roasterDefinitionId" TEXT NOT NULL,
    CONSTRAINT "RoastSession_beanId_fkey" FOREIGN KEY ("beanId") REFERENCES "Bean" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RoastSession_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "RoastProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RoastSession_compareToId_fkey" FOREIGN KEY ("compareToId") REFERENCES "RoastSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RoastSession_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoastSession_roasterDefinitionId_fkey" FOREIGN KEY ("roasterDefinitionId") REFERENCES "RoasterDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RoastSession" ("id", "beanId", "startedAt", "endedAt", "greenWeightGrams", "roastedWeightGrams", "roastedRemainingGrams", "roastLevel", "rating", "notes", "ambientTempF", "roastGoal", "brewTarget", "suggestedFanLevel", "suggestedHeatLevel", "aiSuggestionSummary", "aiSuggestionNotes", "aiSuggestionPlan", "aiSuggestionAcceptedAt", "aiSuggestionFeedback", "profileId", "createdAt", "updatedAt", "compareToId", "teamId", "roasterDefinitionId")
SELECT "id", "beanId", "startedAt", "endedAt", "greenWeightGrams", "roastedWeightGrams", "roastedRemainingGrams", "roastLevel", "rating", "notes", "ambientTempF", "roastGoal", "brewTarget", "suggestedFanLevel", "suggestedHeatLevel", "aiSuggestionSummary", "aiSuggestionNotes", "aiSuggestionPlan", "aiSuggestionAcceptedAt", "aiSuggestionFeedback", "profileId", "createdAt", "updatedAt", "compareToId", "teamId",
       (SELECT "id" FROM "RoasterDefinition" WHERE "teamId" = "RoastSession"."teamId" AND "isDefault" = 1)
FROM "RoastSession";
DROP TABLE "RoastSession";
ALTER TABLE "new_RoastSession" RENAME TO "RoastSession";
CREATE INDEX "RoastSession_beanId_idx" ON "RoastSession"("beanId");
CREATE INDEX "RoastSession_startedAt_idx" ON "RoastSession"("startedAt");
CREATE INDEX "RoastSession_profileId_idx" ON "RoastSession"("profileId");
CREATE INDEX "RoastSession_teamId_idx" ON "RoastSession"("teamId");
CREATE INDEX "RoastSession_roasterDefinitionId_idx" ON "RoastSession"("roasterDefinitionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
