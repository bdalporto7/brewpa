-- CreateTable
CREATE TABLE "TemperatureReading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roastSessionId" TEXT NOT NULL,
    "atSeconds" INTEGER,
    "tempFahrenheit" REAL NOT NULL,
    "probeType" TEXT NOT NULL DEFAULT 'bean',
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TemperatureReading_roastSessionId_fkey" FOREIGN KEY ("roastSessionId") REFERENCES "RoastSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TemperatureReading_roastSessionId_atSeconds_idx" ON "TemperatureReading"("roastSessionId", "atSeconds");
