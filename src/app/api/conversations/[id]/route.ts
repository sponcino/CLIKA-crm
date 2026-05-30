import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { ConversationStatus } from '@prisma/client';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId');

  if (!workspaceId) return new NextResponse('Missing workspaceId', { status: 400 });

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id || '', workspaceId } },
  });

  if (!membership) return new NextResponse('Forbidden', { status: 403 });

  const conversation = await prisma.conversation.findUnique({
    where: { id: params.id, workspaceId },
    include: {
      contact: true,
      messages: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!conversation) return new NextResponse('Not found', { status: 404 });

  return NextResponse.json(conversation);
}

const patchSchema = z.object({
  status: z.nativeEnum(ConversationStatus).optional(),
  assignedUser: z.string().nullable().optional(),
  aiActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId');

  if (!workspaceId) return new NextResponse('Missing workspaceId', { status: 400 });

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id || '', workspaceId } },
  });

  if (!membership) return new NextResponse('Forbidden', { status: 403 });

  try {
    const body = await req.json();
    const data = patchSchema.parse(body);

    const conversation = await prisma.conversation.update({
      where: { id: params.id, workspaceId },
      data,
    });

    return NextResponse.json(conversation);
  } catch {
    return new NextResponse('Bad Request', { status: 400 });
  }
}
