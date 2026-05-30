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

  const labels = await prisma.label.findMany({
    where: { workspaceId },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(labels);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const { workspaceId, name, color } = await req.json();
    if (!workspaceId || !name || !color) return new NextResponse('Missing fields', { status: 400 });

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: session.user.id, workspaceId } },
    });
    if (!membership) return new NextResponse('Forbidden', { status: 403 });

    const label = await prisma.label.create({
      data: { workspaceId, name, color },
    });

    return NextResponse.json(label);
  } catch (error) {
    console.error('Error creating label:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
