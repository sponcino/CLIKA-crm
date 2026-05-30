import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId');
  if (!workspaceId) return new NextResponse('Missing workspaceId', { status: 400 });

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId } },
  });
  if (!membership) return new NextResponse('Forbidden', { status: 403 });

  const quickReplies = await prisma.quickReply.findMany({
    where: { workspaceId },
    orderBy: { title: 'asc' },
  });

  return NextResponse.json(quickReplies);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const { workspaceId, title, content } = await req.json();
    if (!workspaceId || !title || !content) return new NextResponse('Missing fields', { status: 400 });

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: session.user.id, workspaceId } },
    });
    if (!membership) return new NextResponse('Forbidden', { status: 403 });

    const quickReply = await prisma.quickReply.create({
      data: { workspaceId, title, content },
    });

    return NextResponse.json(quickReply);
  } catch (error) {
    console.error('Error creating quick reply:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
