import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

  // workspaceId comes from session only
  const qWorkspaceId = null;

  // Resolve workspaceId
  let workspaceId = qWorkspaceId;
  if (!workspaceId) {
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: session.user.id },
      select: { workspaceId: true },
    });
    workspaceId = membership?.workspaceId ?? null;
  }
  if (!workspaceId) return new NextResponse('No workspace', { status: 400 });

  // Auth check
  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId } },
  });
  if (!membership) return new NextResponse('Forbidden', { status: 403 });

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: {
      user: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json(
    members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      createdAt: m.createdAt,
      user: m.user,
    }))
  );
}
