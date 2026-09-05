/*
  Warnings:

  - You are about to drop the `DropClaim` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `beanId` on the `Drop` table. All the data in the column will be lost.
  - You are about to drop the column `portionGrams` on the `Drop` table. All the data in the column will be lost.
  - You are about to drop the column `pricePerGram` on the `Drop` table. All the data in the column will be lost.
  - You are about to drop the column `totalGrams` on the `Drop` table. All the data in the column will be lost.
  - Added the required column `accessToken` to the `Drop` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Drop` table without a default value. This is not possible if the table is not empty.

*/

-- This migration replaces the old green-coffee-reservation "Drop" feature
-- with a public pre-order flow (see prisma/schema.prisma's Drop/DropOrder/
-- DropOrderItem doc comments) — a deliberate, confirmed decision to
-- retire the old claims data, not an oversight. Explicit deletes first so
-- the table-rebuild below (which can't carry old rows forward into the
-- new required name/accessToken columns) never fails on a database that
-- actually has old rows in it, rather than only happening to work because
-- this project's databases were empty at migration time.
DELETE FROM "DropClaim";
DELETE FROM "Drop";

-- DropIndex
DROP INDEX "DropClaim_friendId_idx";

-- DropIndex
DROP INDEX "DropClaim_dropId_idx";

-- DropIndex
DROP INDEX "DropClaim_saleId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "DropClaim";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "DropOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dropId" TEXT NOT NULL,
    "friendId" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DropOrder_dropId_fkey" FOREIGN KEY ("dropId") REFERENCES "Drop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DropOrder_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "Friend" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DropOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dropOrderId" TEXT NOT NULL,
    "beanId" TEXT NOT NULL,
    "roastStyle" TEXT NOT NULL,
    "price" REAL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "saleId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DropOrderItem_dropOrderId_fkey" FOREIGN KEY ("dropOrderId") REFERENCES "DropOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DropOrderItem_beanId_fkey" FOREIGN KEY ("beanId") REFERENCES "Bean" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DropOrderItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_BeanToDrop" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_BeanToDrop_A_fkey" FOREIGN KEY ("A") REFERENCES "Bean" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_BeanToDrop_B_fkey" FOREIGN KEY ("B") REFERENCES "Drop" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Drop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "notes" TEXT,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Drop" ("closedAt", "createdAt", "id", "notes", "updatedAt") SELECT "closedAt", "createdAt", "id", "notes", "updatedAt" FROM "Drop";
DROP TABLE "Drop";
ALTER TABLE "new_Drop" RENAME TO "Drop";
CREATE UNIQUE INDEX "Drop_accessToken_key" ON "Drop"("accessToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "DropOrder_dropId_idx" ON "DropOrder"("dropId");

-- CreateIndex
CREATE INDEX "DropOrder_friendId_idx" ON "DropOrder"("friendId");

-- CreateIndex
CREATE UNIQUE INDEX "DropOrderItem_saleId_key" ON "DropOrderItem"("saleId");

-- CreateIndex
CREATE INDEX "DropOrderItem_dropOrderId_idx" ON "DropOrderItem"("dropOrderId");

-- CreateIndex
CREATE INDEX "DropOrderItem_beanId_idx" ON "DropOrderItem"("beanId");

-- CreateIndex
CREATE UNIQUE INDEX "_BeanToDrop_AB_unique" ON "_BeanToDrop"("A", "B");

-- CreateIndex
CREATE INDEX "_BeanToDrop_B_index" ON "_BeanToDrop"("B");
