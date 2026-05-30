import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

export async function GET() {
  const session = await auth();
  if (!session?.user?.workspaceId) return new NextResponse('Unauthorized', { status: 401 });

  const webhooks = await prisma.webhookConfig.findMany({
    where: { workspaceId: session.user.workspaceId },
    orderBy: { createdAt: 'desc' }
  });

  return NextResponse.json(webhooks);
}

const postSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  event: z.string().min(1),
  secret: z.string().optional(),
  customHeaders: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.workspaceId) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const body = await req.json();
    const data = postSchema.parse(body);

    const webhook = await prisma.webhookConfig.create({
      data: {
        ...data,
        workspaceId: session.user.workspaceId,
      }
    });

    return NextResponse.json(webhook);
  } catch {
    return new NextResponse('Bad Request', { status: 400 });
  }
}
