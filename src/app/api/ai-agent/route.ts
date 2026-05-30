import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) return new NextResponse('Unauthorized', { status: 401 });

  const workspaceId = session.user.workspaceId;

  let config = await prisma.aIAgentConfig.findUnique({
    where: { workspaceId }
  });

  if (!config) {
    config = await prisma.aIAgentConfig.create({
      data: {
        workspaceId,
        agentName: "Asistente AI",
        modelProvider: "anthropic",
        modelName: "claude-3-5-sonnet-20241022"
      }
    });
  }

  return NextResponse.json(config);
}

const configSchema = z.object({
  agentName: z.string().optional(),
  businessContext: z.string().nullable().optional(),
  tone: z.string().optional(),
  language: z.string().optional(),
  welcomeMessage: z.string().nullable().optional(),
  fallbackMessage: z.string().nullable().optional(),
  humanEscalationMessage: z.string().nullable().optional(),
  systemPrompt: z.string().nullable().optional(),
  modelProvider: z.string().optional(),
  modelName: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.workspaceId) return new NextResponse('Unauthorized', { status: 401 });

  const workspaceId = session.user.workspaceId;

  try {
    const body = await req.json();
    const data = configSchema.parse(body);

    const config = await prisma.aIAgentConfig.update({
      where: { workspaceId },
      data
    });

    return NextResponse.json(config);
  } catch {
    return new NextResponse('Bad Request', { status: 400 });
  }
}
