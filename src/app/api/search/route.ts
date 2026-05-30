import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId');
  const query = searchParams.get('q');

  if (!workspaceId) return new NextResponse('Missing workspaceId', { status: 400 });
  if (!query || query.length < 2) return NextResponse.json({ contacts: [], messages: [], conversations: [] });

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId } },
  });
  if (!membership) return new NextResponse('Forbidden', { status: 403 });

  try {
    const limit = 5;

    const contacts = await prisma.contact.findMany({
      where: {
        workspaceId,
        OR: [
          { whatsappName: { contains: query, mode: 'insensitive' } },
          { whatsappPhone: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { fullName: { contains: query, mode: 'insensitive' } },
        ]
      },
      take: limit,
      select: { id: true, whatsappName: true, whatsappPhone: true, email: true }
    });

    const messages = await prisma.message.findMany({
      where: {
        conversation: { workspaceId },
        content: { contains: query, mode: 'insensitive' }
      },
      take: limit,
      select: { 
        id: true, 
        content: true, 
        createdAt: true,
        conversationId: true,
        conversation: { select: { contact: { select: { whatsappName: true, whatsappPhone: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });

    const conversations = await prisma.conversation.findMany({
      where: {
        workspaceId,
        OR: [
          { contact: { whatsappName: { contains: query, mode: 'insensitive' } } },
          { contact: { whatsappPhone: { contains: query, mode: 'insensitive' } } }
        ]
      },
      take: limit,
      select: {
        id: true,
        status: true,
        updatedAt: true,
        contact: { select: { id: true, whatsappName: true, whatsappPhone: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });

    return NextResponse.json({ contacts, messages, conversations });

  } catch (error) {
    console.error('Search error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
