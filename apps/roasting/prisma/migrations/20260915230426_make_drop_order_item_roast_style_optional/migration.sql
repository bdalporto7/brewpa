-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DropOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dropOrderId" TEXT NOT NULL,
    "beanId" TEXT NOT NULL,
    "roastStyle" TEXT,
    "price" REAL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "saleId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DropOrderItem_dropOrderId_fkey" FOREIGN KEY ("dropOrderId") REFERENCES "DropOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DropOrderItem_beanId_fkey" FOREIGN KEY ("beanId") REFERENCES "Bean" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DropOrderItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DropOrderItem" ("beanId", "createdAt", "dropOrderId", "id", "notes", "paid", "price", "roastStyle", "saleId") SELECT "beanId", "createdAt", "dropOrderId", "id", "notes", "paid", "price", "roastStyle", "saleId" FROM "DropOrderItem";
DROP TABLE "DropOrderItem";
ALTER TABLE "new_DropOrderItem" RENAME TO "DropOrderItem";
CREATE UNIQUE INDEX "DropOrderItem_saleId_key" ON "DropOrderItem"("saleId");
CREATE INDEX "DropOrderItem_dropOrderId_idx" ON "DropOrderItem"("dropOrderId");
CREATE INDEX "DropOrderItem_beanId_idx" ON "DropOrderItem"("beanId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
