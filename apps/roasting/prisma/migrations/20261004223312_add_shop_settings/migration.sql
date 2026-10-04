-- CreateTable
CREATE TABLE "ShopSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "announcement" TEXT,
    "tagline" TEXT NOT NULL DEFAULT 'Small-batch coffee, roasted in San Francisco',
    "heroHeadline" TEXT NOT NULL DEFAULT 'Small-batch coffee from a tiny roaster in San Francisco.',
    "heroBody" TEXT NOT NULL DEFAULT 'We roast a few coffees at a time, in small batches, and sell them by the bag. Pick it up or get it delivered in San Francisco, or have it shipped.',
    "localSummary" TEXT NOT NULL DEFAULT 'Pickup or local delivery in San Francisco',
    "noticeDays" INTEGER NOT NULL DEFAULT 2,
    "shippingFlatCents" INTEGER NOT NULL DEFAULT 600,
    "freeShippingOverCents" INTEGER NOT NULL DEFAULT 5000,
    "instagramUrl" TEXT DEFAULT 'https://www.instagram.com/cybarcoffee',
    "aboutIntro" TEXT,
    "aboutBody" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShopSettings_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopSettings_teamId_key" ON "ShopSettings"("teamId");
