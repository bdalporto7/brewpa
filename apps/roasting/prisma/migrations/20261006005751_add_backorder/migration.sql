-- AlterTable
ALTER TABLE "BeanListing" ADD COLUMN "allowBackorder" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ShopOrderItem" ADD COLUMN "gramsBackordered" REAL NOT NULL DEFAULT 0;
