import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const { hours } = await req.json();
    if (!hours || typeof hours !== 'number') return new NextResponse('Invalid hours', { status: 400 });

    const conversation = await prisma.conversation.findUnique({ where: { id: params.id } });
    if (!conversation) return new NextResponse('Conversation not found', { status: 404 });

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: session.user.id, workspaceId: conversation.workspaceId } },
    });
    if (!membership) return new NextResponse('Forbidden', { status: 403 });

    const snoozedUntil = new Date(Date.now() + hours * 60 * 60 * 1000);

    const updated = await prisma.conversation.update({
      where: { id: params.id },
      data: { snoozedUntil },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error snoozing conversation:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

  const conversation = await prisma.conversation.findUnique({ where: { id: params.id } });
  if (!conversation) return new NextResponse('Conversation not found', { status: 404 });

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId: conversation.workspaceId } },
  });
  if (!membership) return new NextResponse('Forbidden', { status: 403 });

  const updated = await prisma.conversation.update({
    where: { id: params.id },
    data: { snoozedUntil: null },
  });

  return NextResponse.json(updated);
}
