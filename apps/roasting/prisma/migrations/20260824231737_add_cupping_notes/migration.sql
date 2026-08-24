-- CreateTable
CREATE TABLE "CuppingNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roastSessionId" TEXT NOT NULL,
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
    CONSTRAINT "CuppingNote_roastSessionId_fkey" FOREIGN KEY ("roastSessionId") REFERENCES "RoastSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CuppingNote_roastSessionId_idx" ON "CuppingNote"("roastSessionId");
