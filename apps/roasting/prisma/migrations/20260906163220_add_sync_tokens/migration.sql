-- CreateTable
CREATE TABLE "SyncToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT,
    "userId" TEXT NOT NULL,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    CONSTRAINT "SyncToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AllowedUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SyncToken_tokenHash_key" ON "SyncToken"("tokenHash");

-- CreateIndex
CREATE INDEX "SyncToken_userId_idx" ON "SyncToken"("userId");
