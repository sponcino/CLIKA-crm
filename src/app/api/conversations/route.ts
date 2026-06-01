import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { ConversationStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId');
  const status = searchParams.get('status');
  const assignedUser = searchParams.get('assignedUser');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

  if (!workspaceId) return new NextResponse('Missing workspaceId', { status: 400 });

  if (session.user.workspaceId !== workspaceId) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { workspaceId };
  if (status) where.status = status as ConversationStatus;
  if (assignedUser) where.assignedUser = assignedUser;

  const conversations = await prisma.conversation.findMany({
    where,
    include: {
      contact: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      labels: {
        include: { label: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });

  const total = await prisma.conversation.count({ where });

  return NextResponse.json({
    data: conversations,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}
