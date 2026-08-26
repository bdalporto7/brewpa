-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "doseGrams" REAL NOT NULL,
    "waterGrams" REAL NOT NULL,
    "grindSetting" TEXT,
    "waterTempF" REAL,
    "brewTimeSeconds" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Brew" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roastSessionId" TEXT,
    "beanName" TEXT,
    "recipeId" TEXT,
    "userId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "doseGrams" REAL NOT NULL,
    "waterGrams" REAL NOT NULL,
    "grindSetting" TEXT,
    "waterTempF" REAL,
    "brewTimeSeconds" INTEGER,
    "rating" INTEGER,
    "notes" TEXT,
    "brewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Brew_roastSessionId_fkey" FOREIGN KEY ("roastSessionId") REFERENCES "RoastSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Brew_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Brew_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AllowedUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Recipe_method_idx" ON "Recipe"("method");

-- CreateIndex
CREATE INDEX "Brew_roastSessionId_idx" ON "Brew"("roastSessionId");

-- CreateIndex
CREATE INDEX "Brew_recipeId_idx" ON "Brew"("recipeId");

-- CreateIndex
CREATE INDEX "Brew_userId_idx" ON "Brew"("userId");
