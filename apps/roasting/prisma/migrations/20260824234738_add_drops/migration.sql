-- CreateTable
CREATE TABLE "Drop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "beanId" TEXT NOT NULL,
    "totalGrams" REAL NOT NULL,
    "portionGrams" REAL,
    "pricePerGram" REAL,
    "notes" TEXT,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Drop_beanId_fkey" FOREIGN KEY ("beanId") REFERENCES "Bean" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DropClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dropId" TEXT NOT NULL,
    "friendId" TEXT,
    "gramsClaimed" REAL NOT NULL,
    "price" REAL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "fulfilled" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "claimedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DropClaim_dropId_fkey" FOREIGN KEY ("dropId") REFERENCES "Drop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DropClaim_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "Friend" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Drop_beanId_idx" ON "Drop"("beanId");

-- CreateIndex
CREATE INDEX "DropClaim_dropId_idx" ON "DropClaim"("dropId");

-- CreateIndex
CREATE INDEX "DropClaim_friendId_idx" ON "DropClaim"("friendId");
