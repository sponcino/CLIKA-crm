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
    include: { labels: { include: { label: true } } },
  });

  if (!conversation) return new NextResponse('Not found', { status: 404 });

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId: conversation.workspaceId } },
  });
  if (!membership) return new NextResponse('Forbidden', { status: 403 });

  return NextResponse.json(conversation.labels.map(cl => cl.label));
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const { labelId } = await req.json();
    if (!labelId) return new NextResponse('Missing labelId', { status: 400 });

    const conversation = await prisma.conversation.findUnique({ where: { id: params.id } });
    if (!conversation) return new NextResponse('Conversation not found', { status: 404 });

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: session.user.id, workspaceId: conversation.workspaceId } },
    });
    if (!membership) return new NextResponse('Forbidden', { status: 403 });

    const convLabel = await prisma.conversationLabel.create({
      data: { conversationId: params.id, labelId },
      include: { label: true }
    });

    return NextResponse.json(convLabel.label);
  } catch (error: any) {
    if (error?.code === 'P2002') return new NextResponse('Label already attached', { status: 409 });
    console.error('Error adding label to conversation:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const labelId = searchParams.get('labelId');
    if (!labelId) return new NextResponse('Missing labelId', { status: 400 });

    const conversation = await prisma.conversation.findUnique({ where: { id: params.id } });
    if (!conversation) return new NextResponse('Conversation not found', { status: 404 });

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: session.user.id, workspaceId: conversation.workspaceId } },
    });
    if (!membership) return new NextResponse('Forbidden', { status: 403 });

    await prisma.conversationLabel.delete({
      where: {
        conversationId_labelId: {
          conversationId: params.id,
          labelId
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing label:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
