-- CreateTable
CREATE TABLE "Bean" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "producer" TEXT,
    "process" TEXT NOT NULL,
    "variety" TEXT,
    "supplier" TEXT,
    "purchaseDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purchasePrice" REAL,
    "weightGrams" REAL NOT NULL,
    "remainingGrams" REAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RoastSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "beanId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "greenWeightGrams" REAL NOT NULL,
    "roastedWeightGrams" REAL,
    "roastLevel" TEXT,
    "rating" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoastSession_beanId_fkey" FOREIGN KEY ("beanId") REFERENCES "Bean" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoastEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roastSessionId" TEXT NOT NULL,
    "atSeconds" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "fanLevel" INTEGER,
    "heatLevel" INTEGER,
    "tempFahrenheit" REAL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoastEvent_roastSessionId_fkey" FOREIGN KEY ("roastSessionId") REFERENCES "RoastSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Bean_origin_idx" ON "Bean"("origin");

-- CreateIndex
CREATE INDEX "Bean_createdAt_idx" ON "Bean"("createdAt");

-- CreateIndex
CREATE INDEX "RoastSession_beanId_idx" ON "RoastSession"("beanId");

-- CreateIndex
CREATE INDEX "RoastSession_startedAt_idx" ON "RoastSession"("startedAt");

-- CreateIndex
CREATE INDEX "RoastEvent_roastSessionId_atSeconds_idx" ON "RoastEvent"("roastSessionId", "atSeconds");
