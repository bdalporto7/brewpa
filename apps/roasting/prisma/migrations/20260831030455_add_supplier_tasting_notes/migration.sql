-- AlterTable
ALTER TABLE "Bean" ADD COLUMN "qGrade" REAL;
ALTER TABLE "Bean" ADD COLUMN "tastingNotes" TEXT;
ALTER TABLE "Bean" ADD COLUMN "tastingNotesFetchedAt" DATETIME;

-- CreateTable
CREATE TABLE "SupplierExtractionCall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "calledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "SupplierExtractionCall_calledAt_idx" ON "SupplierExtractionCall"("calledAt");
