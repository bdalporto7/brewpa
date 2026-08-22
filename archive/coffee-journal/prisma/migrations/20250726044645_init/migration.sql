-- CreateTable
CREATE TABLE "CoffeeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "roastLevel" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "grindSize" TEXT NOT NULL,
    "brewMethod" TEXT NOT NULL,
    "waterTemperature" REAL NOT NULL,
    "coffeeWeight" REAL NOT NULL,
    "waterWeight" REAL NOT NULL,
    "brewTime" REAL NOT NULL,
    "rating" REAL NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CoffeeBean" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "roastLevel" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BrewingRecipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "brewMethod" TEXT NOT NULL,
    "grindSize" TEXT NOT NULL,
    "waterTemperature" REAL NOT NULL,
    "coffeeWeight" REAL NOT NULL,
    "waterWeight" REAL NOT NULL,
    "brewTime" REAL NOT NULL,
    "instructions" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "CoffeeEntry_createdAt_idx" ON "CoffeeEntry"("createdAt");

-- CreateIndex
CREATE INDEX "CoffeeEntry_brewMethod_idx" ON "CoffeeEntry"("brewMethod");

-- CreateIndex
CREATE INDEX "CoffeeEntry_roastLevel_idx" ON "CoffeeEntry"("roastLevel");

-- CreateIndex
CREATE INDEX "CoffeeEntry_rating_idx" ON "CoffeeEntry"("rating");

-- CreateIndex
CREATE INDEX "CoffeeEntry_origin_idx" ON "CoffeeEntry"("origin");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
