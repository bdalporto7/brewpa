-- AlterTable
ALTER TABLE "CoffeeEntry" ADD COLUMN "beanVariety" TEXT;
ALTER TABLE "CoffeeEntry" ADD COLUMN "elevation" INTEGER;
ALTER TABLE "CoffeeEntry" ADD COLUMN "farmer" TEXT;
ALTER TABLE "CoffeeEntry" ADD COLUMN "processingMethod" TEXT;
ALTER TABLE "CoffeeEntry" ADD COLUMN "roastDate" DATETIME;

-- CreateIndex
CREATE INDEX "CoffeeEntry_processingMethod_idx" ON "CoffeeEntry"("processingMethod");

-- CreateIndex
CREATE INDEX "CoffeeEntry_beanVariety_idx" ON "CoffeeEntry"("beanVariety");
