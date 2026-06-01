-- CreateTable
CREATE TABLE IF NOT EXISTS "Funnel" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Funnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FunnelStep" (
    "id" TEXT NOT NULL,
    "funnelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "nextStepId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "actions" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunnelStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ContactFunnelState" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "funnelId" TEXT NOT NULL,
    "currentStepId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ContactFunnelState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Funnel_workspaceId_idx" ON "Funnel"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FunnelStep_funnelId_stepId_key" ON "FunnelStep"("funnelId", "stepId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FunnelStep_funnelId_idx" ON "FunnelStep"("funnelId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ContactFunnelState_contactId_funnelId_key" ON "ContactFunnelState"("contactId", "funnelId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContactFunnelState_contactId_idx" ON "ContactFunnelState"("contactId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContactFunnelState_funnelId_idx" ON "ContactFunnelState"("funnelId");

-- AddForeignKey
ALTER TABLE "Funnel" ADD CONSTRAINT "Funnel_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FunnelStep" ADD CONSTRAINT "FunnelStep_funnelId_fkey"
    FOREIGN KEY ("funnelId") REFERENCES "Funnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactFunnelState" ADD CONSTRAINT "ContactFunnelState_funnelId_fkey"
    FOREIGN KEY ("funnelId") REFERENCES "Funnel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
