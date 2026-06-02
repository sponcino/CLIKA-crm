import { NextRequest, NextResponse } from 'next/server';
import { Prisma, ConversationStatus } from '@prisma/client';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

// ─── GET: fetch single conversation with messages ─────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: params.id },
      include: {
        contact: true,
        messages: { orderBy: { createdAt: 'asc' } },
        labels: { include: { label: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    if (!conversation) return new NextResponse('Not Found', { status: 404 });

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: session.user.id, workspaceId: conversation.workspaceId } },
    });
    if (!membership) return new NextResponse('Forbidden', { status: 403 });

    return NextResponse.json(conversation);
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// ─── PATCH: update conversation (status, AI toggle, assignedUser) ─────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const body = await req.json();
    const { aiEnabled, assignedUserId, status } = body;

    const conversation = await prisma.conversation.findUnique({
      where: { id: params.id },
      include: { contact: true },
    });

    if (!conversation) return new NextResponse('Not Found', { status: 404 });

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: session.user.id, workspaceId: conversation.workspaceId } },
    });
    if (!membership) return new NextResponse('Forbidden', { status: 403 });

    const updateData: Prisma.ConversationUpdateInput = {};
    if (assignedUserId !== undefined) {
      updateData.assignedTo = assignedUserId ? { connect: { id: assignedUserId } } : { disconnect: true };
    }
    if (aiEnabled !== undefined) {
      updateData.aiActive = aiEnabled;
    }
    if (status !== undefined) {
      updateData.status = status as ConversationStatus;
    }

    const [updatedConversation] = await prisma.$transaction([
      prisma.conversation.update({
        where: { id: params.id },
        data: updateData,
        include: {
          contact: true,
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      }),
      ...(aiEnabled !== undefined
        ? [prisma.contact.update({
            where: { id: conversation.contactId },
            data: { aiEnabled },
          })]
        : []),
    ]);

    return NextResponse.json(updatedConversation);
  } catch (error) {
    console.error('Error updating conversation:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// ─── DELETE: hard-delete conversation and all messages ───────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: params.id },
    });

    if (!conversation) return new NextResponse('Not Found', { status: 404 });

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: session.user.id, workspaceId: conversation.workspaceId } },
    });
    if (!membership) return new NextResponse('Forbidden', { status: 403 });

    await prisma.conversation.delete({ where: { id: params.id } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
