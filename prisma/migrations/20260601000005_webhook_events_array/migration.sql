-- AlterTable WebhookConfig: multi-event support + last-called timestamp
ALTER TABLE "WebhookConfig"
  ADD COLUMN IF NOT EXISTS "events"       TEXT[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "lastCalledAt" TIMESTAMP(3);
