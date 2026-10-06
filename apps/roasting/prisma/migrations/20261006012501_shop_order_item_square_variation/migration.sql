-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ShopOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "beanId" TEXT,
    "squareVariationId" TEXT,
    "variantLabel" TEXT NOT NULL,
    "grams" REAL NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "gramsFromRoasted" REAL NOT NULL DEFAULT 0,
    "gramsToRoast" REAL NOT NULL DEFAULT 0,
    "gramsBackordered" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "ShopOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ShopOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShopOrderItem_beanId_fkey" FOREIGN KEY ("beanId") REFERENCES "Bean" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ShopOrderItem" ("beanId", "grams", "gramsBackordered", "gramsFromRoasted", "gramsToRoast", "id", "orderId", "quantity", "unitPriceCents", "variantLabel") SELECT "beanId", "grams", "gramsBackordered", "gramsFromRoasted", "gramsToRoast", "id", "orderId", "quantity", "unitPriceCents", "variantLabel" FROM "ShopOrderItem";
DROP TABLE "ShopOrderItem";
ALTER TABLE "new_ShopOrderItem" RENAME TO "ShopOrderItem";
CREATE INDEX "ShopOrderItem_orderId_idx" ON "ShopOrderItem"("orderId");
CREATE INDEX "ShopOrderItem_beanId_idx" ON "ShopOrderItem"("beanId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
