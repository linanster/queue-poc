-- Add per-store queue timing rules.
ALTER TABLE "Store" ADD COLUMN "readyTimeoutMinutes" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "Store" ADD COLUMN "recallWindowMinutes" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "Store" ADD COLUMN "servingAlertMinutes" INTEGER NOT NULL DEFAULT 20;
