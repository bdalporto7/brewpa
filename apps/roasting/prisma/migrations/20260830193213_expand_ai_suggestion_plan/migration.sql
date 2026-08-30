-- AlterTable
ALTER TABLE "RoastSession" ADD COLUMN "aiSuggestionAcceptedAt" DATETIME;
ALTER TABLE "RoastSession" ADD COLUMN "aiSuggestionPlan" TEXT;
ALTER TABLE "RoastSession" ADD COLUMN "aiSuggestionSummary" TEXT;
ALTER TABLE "RoastSession" ADD COLUMN "brewTarget" TEXT;
