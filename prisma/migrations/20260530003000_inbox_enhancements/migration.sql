-- CreateTable Label
CREATE TABLE IF NOT EXISTS "Label" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'blue',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Label_pkey" PRIMARY KEY ("id")
);

-- CreateTable ConversationLabel
CREATE TABLE IF NOT EXISTS "ConversationLabel" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    CONSTRAINT "ConversationLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable Note
CREATE TABLE IF NOT EXISTS "Note" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable QuickReply
CREATE TABLE IF NOT EXISTS "QuickReply" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuickReply_pkey" PRIMARY KEY ("id")
);

-- Add snoozedUntil to Conversation
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "snoozedUntil" TIMESTAMP(3);

-- Add aiActive to Conversation if not exists
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "aiActive" BOOLEAN NOT NULL DEFAULT true;

-- Indexes
CREATE INDEX IF NOT EXISTS "Label_workspaceId_idx" ON "Label"("workspaceId");
CREATE INDEX IF NOT EXISTS "ConversationLabel_conversationId_idx" ON "ConversationLabel"("conversationId");
CREATE INDEX IF NOT EXISTS "Note_conversationId_idx" ON "Note"("conversationId");
CREATE INDEX IF NOT EXISTS "Note_workspaceId_idx" ON "Note"("workspaceId");
CREATE INDEX IF NOT EXISTS "QuickReply_workspaceId_idx" ON "QuickReply"("workspaceId");

-- Foreign Keys
ALTER TABLE "Label" ADD CONSTRAINT "Label_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationLabel" ADD CONSTRAINT "ConversationLabel_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationLabel" ADD CONSTRAINT "ConversationLabel_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "Label"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Note" ADD CONSTRAINT "Note_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Note" ADD CONSTRAINT "Note_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuickReply" ADD CONSTRAINT "QuickReply_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
