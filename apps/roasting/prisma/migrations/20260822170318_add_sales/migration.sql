-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roastSessionId" TEXT NOT NULL,
    "weightGrams" REAL NOT NULL,
    "buyerName" TEXT,
    "price" REAL,
    "soldAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sale_roastSessionId_fkey" FOREIGN KEY ("roastSessionId") REFERENCES "RoastSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Sale_roastSessionId_idx" ON "Sale"("roastSessionId");
