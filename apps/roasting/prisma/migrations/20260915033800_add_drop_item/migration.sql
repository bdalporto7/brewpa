-- CreateTable
CREATE TABLE "DropItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dropId" TEXT NOT NULL,
    "beanId" TEXT NOT NULL,
    "price" REAL,
    "stockQuantity" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DropItem_dropId_fkey" FOREIGN KEY ("dropId") REFERENCES "Drop" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DropItem_beanId_fkey" FOREIGN KEY ("beanId") REFERENCES "Bean" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DropItem_dropId_beanId_key" ON "DropItem"("dropId", "beanId");
CREATE INDEX "DropItem_dropId_idx" ON "DropItem"("dropId");
CREATE INDEX "DropItem_beanId_idx" ON "DropItem"("beanId");

-- Backfill one DropItem per existing Bean<->Drop pair, price/stockQuantity
-- left NULL (unlimited/not tracked) — pre-redesign drops had no concept of
-- either, so inventing a number would misrepresent data that was never
-- captured. Column names "A"/"B" match this schema's own existing implicit
-- m2m table (confirmed against 20260905165455_rework_drops_to_preorders's
-- own "_BeanToDrop" table): A = Bean.id, B = Drop.id (alphabetical by
-- model name, Prisma's own convention).
INSERT INTO "DropItem" ("id", "dropId", "beanId", "price", "stockQuantity", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), "B", "A", NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "_BeanToDrop";
