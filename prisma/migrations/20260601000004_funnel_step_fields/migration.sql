-- AlterTable FunnelStep: add AI instructions and transition criteria
ALTER TABLE "FunnelStep"
  ADD COLUMN IF NOT EXISTS "instructions"       TEXT,
  ADD COLUMN IF NOT EXISTS "transitionCriteria" TEXT;

-- AlterTable Funnel: add ad attribution toggle
ALTER TABLE "Funnel"
  ADD COLUMN IF NOT EXISTS "adAttributionEnabled" BOOLEAN NOT NULL DEFAULT false;
