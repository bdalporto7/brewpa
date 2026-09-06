-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Backfill: every pre-existing AllowedUser/Bean/RoastSession/Friend/Drop/
-- RoastProfile/Recipe row predates the Team concept entirely, so there's
-- no real "which team" to derive — attribute all of it to one newly
-- created team. This INSERT is a no-op (via WHERE EXISTS) on a database
-- that has no AllowedUser rows yet — a genuinely fresh install (this file
-- also replays verbatim against every desktop install's own local file
-- and local dev.db) shouldn't get a stray "Cybar Coffee"-named team
-- created for nobody; that install's own guest team gets created
-- separately, after migrations run, by apps/desktop/src-ts/migrate.ts.
INSERT INTO "Team" ("id", "name", "createdAt")
SELECT lower(hex(randomblob(16))), 'Cybar Coffee', CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "AllowedUser");

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AllowedUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teamId" TEXT NOT NULL,
    CONSTRAINT "AllowedUser_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AllowedUser" ("createdAt", "email", "id", "isAdmin", "teamId") SELECT "createdAt", "email", "id", "isAdmin", (SELECT "id" FROM "Team" WHERE "name" = 'Cybar Coffee') FROM "AllowedUser";
DROP TABLE "AllowedUser";
ALTER TABLE "new_AllowedUser" RENAME TO "AllowedUser";
CREATE UNIQUE INDEX "AllowedUser_email_key" ON "AllowedUser"("email");
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
    "moisturePercent" REAL,
    "densityGramsPerLiter" REAL,
    "tastingNotes" TEXT,
    "qGrade" REAL,
    "tastingNotesFetchedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lowStockDismissed" BOOLEAN NOT NULL DEFAULT false,
    "goldenRoastId" TEXT,
    "teamId" TEXT NOT NULL,
    CONSTRAINT "Bean_goldenRoastId_fkey" FOREIGN KEY ("goldenRoastId") REFERENCES "RoastSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Bean_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Bean" ("createdAt", "densityGramsPerLiter", "goldenRoastId", "id", "lowStockDismissed", "moisturePercent", "name", "notes", "origin", "process", "producer", "purchaseDate", "purchasePrice", "qGrade", "remainingGrams", "supplier", "supplierUrl", "tastingNotes", "tastingNotesFetchedAt", "updatedAt", "variety", "weightGrams", "teamId") SELECT "createdAt", "densityGramsPerLiter", "goldenRoastId", "id", "lowStockDismissed", "moisturePercent", "name", "notes", "origin", "process", "producer", "purchaseDate", "purchasePrice", "qGrade", "remainingGrams", "supplier", "supplierUrl", "tastingNotes", "tastingNotesFetchedAt", "updatedAt", "variety", "weightGrams", (SELECT "id" FROM "Team" WHERE "name" = 'Cybar Coffee') FROM "Bean";
DROP TABLE "Bean";
ALTER TABLE "new_Bean" RENAME TO "Bean";
CREATE UNIQUE INDEX "Bean_goldenRoastId_key" ON "Bean"("goldenRoastId");
CREATE INDEX "Bean_origin_idx" ON "Bean"("origin");
CREATE INDEX "Bean_createdAt_idx" ON "Bean"("createdAt");
CREATE INDEX "Bean_teamId_idx" ON "Bean"("teamId");
CREATE TABLE "new_Drop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "notes" TEXT,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "teamId" TEXT NOT NULL,
    CONSTRAINT "Drop_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Drop" ("closedAt", "code", "createdAt", "id", "name", "notes", "updatedAt", "teamId") SELECT "closedAt", "code", "createdAt", "id", "name", "notes", "updatedAt", (SELECT "id" FROM "Team" WHERE "name" = 'Cybar Coffee') FROM "Drop";
DROP TABLE "Drop";
ALTER TABLE "new_Drop" RENAME TO "Drop";
CREATE UNIQUE INDEX "Drop_code_key" ON "Drop"("code");
CREATE INDEX "Drop_teamId_idx" ON "Drop"("teamId");
CREATE TABLE "new_Friend" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "teamId" TEXT NOT NULL,
    CONSTRAINT "Friend_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Friend" ("createdAt", "id", "name", "notes", "updatedAt", "teamId") SELECT "createdAt", "id", "name", "notes", "updatedAt", (SELECT "id" FROM "Team" WHERE "name" = 'Cybar Coffee') FROM "Friend";
DROP TABLE "Friend";
ALTER TABLE "new_Friend" RENAME TO "Friend";
CREATE INDEX "Friend_name_idx" ON "Friend"("name");
CREATE INDEX "Friend_teamId_idx" ON "Friend"("teamId");
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
    "updatedAt" DATETIME NOT NULL,
    "teamId" TEXT NOT NULL,
    CONSTRAINT "Recipe_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Recipe" ("brewTimeSeconds", "createdAt", "doseGrams", "grindSetting", "id", "isFavorite", "method", "name", "notes", "updatedAt", "waterGrams", "waterTempF", "teamId") SELECT "brewTimeSeconds", "createdAt", "doseGrams", "grindSetting", "id", "isFavorite", "method", "name", "notes", "updatedAt", "waterGrams", "waterTempF", (SELECT "id" FROM "Team" WHERE "name" = 'Cybar Coffee') FROM "Recipe";
DROP TABLE "Recipe";
ALTER TABLE "new_Recipe" RENAME TO "Recipe";
CREATE INDEX "Recipe_method_idx" ON "Recipe"("method");
CREATE INDEX "Recipe_teamId_idx" ON "Recipe"("teamId");
CREATE TABLE "new_RoastProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "process" TEXT,
    "brewTarget" TEXT,
    "planJson" TEXT NOT NULL,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "teamId" TEXT NOT NULL,
    CONSTRAINT "RoastProfile_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RoastProfile" ("brewTarget", "createdAt", "description", "id", "isFavorite", "name", "planJson", "process", "updatedAt", "teamId") SELECT "brewTarget", "createdAt", "description", "id", "isFavorite", "name", "planJson", "process", "updatedAt", (SELECT "id" FROM "Team" WHERE "name" = 'Cybar Coffee') FROM "RoastProfile";
DROP TABLE "RoastProfile";
ALTER TABLE "new_RoastProfile" RENAME TO "RoastProfile";
CREATE INDEX "RoastProfile_process_idx" ON "RoastProfile"("process");
CREATE INDEX "RoastProfile_teamId_idx" ON "RoastProfile"("teamId");
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
    CONSTRAINT "RoastSession_beanId_fkey" FOREIGN KEY ("beanId") REFERENCES "Bean" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RoastSession_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "RoastProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RoastSession_compareToId_fkey" FOREIGN KEY ("compareToId") REFERENCES "RoastSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RoastSession_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RoastSession" ("aiSuggestionAcceptedAt", "aiSuggestionFeedback", "aiSuggestionNotes", "aiSuggestionPlan", "aiSuggestionSummary", "ambientTempF", "beanId", "brewTarget", "compareToId", "createdAt", "endedAt", "greenWeightGrams", "id", "notes", "profileId", "rating", "roastGoal", "roastLevel", "roastedRemainingGrams", "roastedWeightGrams", "startedAt", "suggestedFanLevel", "suggestedHeatLevel", "updatedAt", "teamId") SELECT "aiSuggestionAcceptedAt", "aiSuggestionFeedback", "aiSuggestionNotes", "aiSuggestionPlan", "aiSuggestionSummary", "ambientTempF", "beanId", "brewTarget", "compareToId", "createdAt", "endedAt", "greenWeightGrams", "id", "notes", "profileId", "rating", "roastGoal", "roastLevel", "roastedRemainingGrams", "roastedWeightGrams", "startedAt", "suggestedFanLevel", "suggestedHeatLevel", "updatedAt", (SELECT "id" FROM "Team" WHERE "name" = 'Cybar Coffee') FROM "RoastSession";
DROP TABLE "RoastSession";
ALTER TABLE "new_RoastSession" RENAME TO "RoastSession";
CREATE INDEX "RoastSession_beanId_idx" ON "RoastSession"("beanId");
CREATE INDEX "RoastSession_startedAt_idx" ON "RoastSession"("startedAt");
CREATE INDEX "RoastSession_profileId_idx" ON "RoastSession"("profileId");
CREATE INDEX "RoastSession_teamId_idx" ON "RoastSession"("teamId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
