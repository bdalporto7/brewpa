-- CreateTable
CREATE TABLE "AiSuggestionCall" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "calledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "AiSuggestionCall_calledAt_idx" ON "AiSuggestionCall"("calledAt");
