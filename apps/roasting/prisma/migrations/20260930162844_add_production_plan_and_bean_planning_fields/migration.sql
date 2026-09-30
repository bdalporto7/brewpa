-- AlterTable
ALTER TABLE "Bean" ADD COLUMN "agingThresholdDays" INTEGER;
ALTER TABLE "Bean" ADD COLUMN "leadTimeDays" INTEGER;
ALTER TABLE "Bean" ADD COLUMN "reorderLevelGrams" REAL;

-- CreateTable
CREATE TABLE "ProductionPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "month" TEXT NOT NULL,
    "targetGrams" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "notes" TEXT,
    "beanId" TEXT,
    "roasterDefinitionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "teamId" TEXT NOT NULL,
    CONSTRAINT "ProductionPlan_beanId_fkey" FOREIGN KEY ("beanId") REFERENCES "Bean" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProductionPlan_roasterDefinitionId_fkey" FOREIGN KEY ("roasterDefinitionId") REFERENCES "RoasterDefinition" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProductionPlan_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProductionPlan_teamId_idx" ON "ProductionPlan"("teamId");

-- CreateIndex
CREATE INDEX "ProductionPlan_month_idx" ON "ProductionPlan"("month");
