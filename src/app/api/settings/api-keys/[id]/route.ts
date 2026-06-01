import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;

  const record = await prisma.apiKey.findUnique({
    where: { id },
    select: { workspaceId: true },
  });

  if (!record) return new NextResponse('Not found', { status: 404 });

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId: record.workspaceId } },
  });
  if (!membership) return new NextResponse('Forbidden', { status: 403 });

  await prisma.apiKey.update({ where: { id }, data: { isActive: false } });

  return new NextResponse(null, { status: 204 });
}
