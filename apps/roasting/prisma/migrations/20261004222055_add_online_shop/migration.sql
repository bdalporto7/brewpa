-- CreateTable
CREATE TABLE "BeanListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "beanId" TEXT NOT NULL,
    "isListed" BOOLEAN NOT NULL DEFAULT false,
    "slug" TEXT NOT NULL,
    "headline" TEXT,
    "description" TEXT,
    "roastStyle" TEXT,
    "brewNotes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "squareItemId" TEXT,
    "teamId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BeanListing_beanId_fkey" FOREIGN KEY ("beanId") REFERENCES "Bean" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BeanListing_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ListingVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listingId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "grams" REAL NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "squareVariationId" TEXT,
    CONSTRAINT "ListingVariant_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "BeanListing" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShopOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "publicRef" TEXT NOT NULL,
    "squareOrderId" TEXT,
    "paymentLinkId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "fulfillment" TEXT NOT NULL,
    "pickupAt" DATETIME,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "subtotalCents" INTEGER NOT NULL,
    "shippingCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER,
    "paidAt" DATETIME,
    "attentionNote" TEXT,
    "teamId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShopOrder_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShopOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "beanId" TEXT NOT NULL,
    "variantLabel" TEXT NOT NULL,
    "grams" REAL NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "gramsFromRoasted" REAL NOT NULL DEFAULT 0,
    "gramsToRoast" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "ShopOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShopOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShopOrderItem_beanId_fkey" FOREIGN KEY ("beanId") REFERENCES "Bean" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcessedSquareEvent" (
    "eventId" TEXT NOT NULL PRIMARY KEY,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roastSessionId" TEXT NOT NULL,
    "friendId" TEXT,
    "weightGrams" REAL NOT NULL,
    "price" REAL,
    "soldAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shopOrderItemId" TEXT,
    CONSTRAINT "Sale_roastSessionId_fkey" FOREIGN KEY ("roastSessionId") REFERENCES "RoastSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Sale_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "Friend" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Sale_shopOrderItemId_fkey" FOREIGN KEY ("shopOrderItemId") REFERENCES "ShopOrderItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Sale" ("createdAt", "friendId", "id", "notes", "price", "roastSessionId", "soldAt", "weightGrams") SELECT "createdAt", "friendId", "id", "notes", "price", "roastSessionId", "soldAt", "weightGrams" FROM "Sale";
DROP TABLE "Sale";
ALTER TABLE "new_Sale" RENAME TO "Sale";
CREATE INDEX "Sale_roastSessionId_idx" ON "Sale"("roastSessionId");
CREATE INDEX "Sale_friendId_idx" ON "Sale"("friendId");
CREATE INDEX "Sale_shopOrderItemId_idx" ON "Sale"("shopOrderItemId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "BeanListing_beanId_key" ON "BeanListing"("beanId");

-- CreateIndex
CREATE UNIQUE INDEX "BeanListing_slug_key" ON "BeanListing"("slug");

-- CreateIndex
CREATE INDEX "BeanListing_teamId_isListed_idx" ON "BeanListing"("teamId", "isListed");

-- CreateIndex
CREATE INDEX "ListingVariant_listingId_idx" ON "ListingVariant"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopOrder_publicRef_key" ON "ShopOrder"("publicRef");

-- CreateIndex
CREATE UNIQUE INDEX "ShopOrder_squareOrderId_key" ON "ShopOrder"("squareOrderId");

-- CreateIndex
CREATE INDEX "ShopOrder_teamId_status_idx" ON "ShopOrder"("teamId", "status");

-- CreateIndex
CREATE INDEX "ShopOrderItem_orderId_idx" ON "ShopOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "ShopOrderItem_beanId_idx" ON "ShopOrderItem"("beanId");
