import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10);

  // Create test user
  const user = await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: {},
    create: {
      email: 'admin@test.com',
      name: 'Admin Test',
      passwordHash,
    },
  });

  // Create workspace
  const workspace = await prisma.workspace.create({
    data: {
      name: 'CLIKA Demo',
    },
  });

  // Assign user as owner of the workspace
  await prisma.workspaceMember.create({
    data: {
      userId: user.id,
      workspaceId: workspace.id,
      role: 'OWNER',
    },
  });

  // Create default AIAgentConfig for that workspace
  await prisma.aIAgentConfig.create({
    data: {
      workspaceId: workspace.id,
      agentName: 'CLIKA AI Agent',
      businessContext: 'We are a leading CRM solution for WhatsApp.',
      tone: 'professional',
    },
  });

  console.log('Seed executed successfully.');
  console.log({ user, workspace });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
