import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

  const conversation = await prisma.conversation.findUnique({
    where: { id: params.id },
  });

  if (!conversation) return new NextResponse('Not found', { status: 404 });

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId: conversation.workspaceId } },
  });
  if (!membership) return new NextResponse('Forbidden', { status: 403 });

  const notes = await prisma.note.findMany({
    where: { conversationId: params.id },
    include: {
      user: {
        select: { id: true, name: true, email: true, image: true }
      }
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(notes);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const { content } = await req.json();
    if (!content) return new NextResponse('Missing content', { status: 400 });

    const conversation = await prisma.conversation.findUnique({ where: { id: params.id } });
    if (!conversation) return new NextResponse('Conversation not found', { status: 404 });

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: session.user.id, workspaceId: conversation.workspaceId } },
    });
    if (!membership) return new NextResponse('Forbidden', { status: 403 });

    const note = await prisma.note.create({
      data: {
        conversationId: params.id,
        workspaceId: conversation.workspaceId,
        userId: session.user.id,
        content
      },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } }
      }
    });

    return NextResponse.json(note);
  } catch (error) {
    console.error('Error creating note:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
