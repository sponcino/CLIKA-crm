-- AlterTable AIAgentConfig: add new agent configuration fields
ALTER TABLE "AIAgentConfig"
  ADD COLUMN IF NOT EXISTS "agentRole"              TEXT,
  ADD COLUMN IF NOT EXISTS "agentPersonality"       TEXT,
  ADD COLUMN IF NOT EXISTS "companyName"            TEXT,
  ADD COLUMN IF NOT EXISTS "companyType"            TEXT,
  ADD COLUMN IF NOT EXISTS "productsServices"       TEXT,
  ADD COLUMN IF NOT EXISTS "transferKeywords"       TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "captureFields"          JSONB   NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "useGlobalApiKey"        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "customApiKey"           TEXT,
  ADD COLUMN IF NOT EXISTS "maxTokens"              INTEGER NOT NULL DEFAULT 1000;
