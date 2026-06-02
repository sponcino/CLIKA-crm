import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const captureFieldSchema = z.object({
  id: z.string(),
  campo: z.string(),
  descripcion: z.string(),
  requerido: z.boolean(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) return new NextResponse('Unauthorized', { status: 401 });

  const workspaceId = session.user.workspaceId;

  let config = await prisma.aIAgentConfig.findUnique({ where: { workspaceId } });

  if (!config) {
    config = await prisma.aIAgentConfig.create({
      data: {
        workspaceId,
        agentName: 'Asistente AI',
        modelProvider: 'anthropic',
        modelName: 'claude-sonnet-4-6',
      },
    });
  }

  return NextResponse.json(config);
}

const configSchema = z.object({
  // Tab 1 — General
  agentName: z.string().optional(),
  agentRole: z.string().nullable().optional(),
  agentPersonality: z.string().nullable().optional(),
  language: z.string().optional(),
  tone: z.string().optional(),
  companyName: z.string().nullable().optional(),
  companyType: z.string().nullable().optional(),
  businessContext: z.string().nullable().optional(),
  productsServices: z.string().nullable().optional(),
  // Tab 2 — Messages
  welcomeMessage: z.string().nullable().optional(),
  fallbackMessage: z.string().nullable().optional(),
  humanEscalationMessage: z.string().nullable().optional(),
  transferKeywords: z.array(z.string()).optional(),
  // Tab 3 — Capture
  captureFields: z.array(captureFieldSchema).optional(),
  // Tab 4 — AI Config
  modelProvider: z.string().optional(),
  modelName: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  maxTokens: z.number().int().min(100).max(8000).optional(),
  useGlobalApiKey: z.boolean().optional(),
  customApiKey: z.string().nullable().optional(),
  systemPrompt: z.string().nullable().optional(),
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: data as any,
    });

    return NextResponse.json(config);
  } catch {
    return new NextResponse('Bad Request', { status: 400 });
  }
}
