import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const body = await req.json();
    const { aiEnabled, assignedUserId } = body;

    const conversation = await prisma.conversation.findUnique({
      where: { id: params.id },
      include: { contact: true },
    });

    if (!conversation) return new NextResponse('Not Found', { status: 404 });

    // Verify user belongs to workspace
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

    const [updatedConversation] = await prisma.$transaction([
      prisma.conversation.update({
        where: { id: params.id },
        data: updateData,
        include: { assignedTo: { select: { id: true, name: true, email: true } } }
      }),
      ...(aiEnabled !== undefined 
        ? [prisma.contact.update({
            where: { id: conversation.contactId },
            data: { aiEnabled }
          })]
        : [])
    ]);

    return NextResponse.json(updatedConversation);
  } catch (error) {
    console.error('Error updating conversation:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
