-- AlterTable
ALTER TABLE "Bean" ADD COLUMN "densityGramsPerLiter" REAL;
ALTER TABLE "Bean" ADD COLUMN "moisturePercent" REAL;

-- AlterTable
ALTER TABLE "RoastSession" ADD COLUMN "aiSuggestionNotes" TEXT;
ALTER TABLE "RoastSession" ADD COLUMN "ambientTempF" REAL;
ALTER TABLE "RoastSession" ADD COLUMN "roastGoal" TEXT;
ALTER TABLE "RoastSession" ADD COLUMN "suggestedFanLevel" INTEGER;
ALTER TABLE "RoastSession" ADD COLUMN "suggestedHeatLevel" INTEGER;
