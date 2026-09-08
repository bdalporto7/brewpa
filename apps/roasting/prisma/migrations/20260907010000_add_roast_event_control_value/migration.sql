-- AlterTable
ALTER TABLE "RoastEvent" ADD COLUMN "controlValue" REAL;

-- Backfill: every historical FAN/HEAT event's dedicated column becomes the
-- generic one, so every reader can use controlValue unconditionally from
-- here on, historical rows included.
UPDATE "RoastEvent" SET "controlValue" = COALESCE("fanLevel", "heatLevel") WHERE "type" IN ('FAN', 'HEAT');
