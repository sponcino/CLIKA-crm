import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const { name, color } = await req.json();

    const label = await prisma.label.findUnique({ where: { id: params.id } });
    if (!label) return new NextResponse('Not found', { status: 404 });

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: session.user.id, workspaceId: label.workspaceId } },
    });
    if (!membership) return new NextResponse('Forbidden', { status: 403 });

    const updated = await prisma.label.update({
      where: { id: params.id },
      data: { name, color },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating label:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

  const label = await prisma.label.findUnique({ where: { id: params.id } });
  if (!label) return new NextResponse('Not found', { status: 404 });

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id, workspaceId: label.workspaceId } },
  });
  if (!membership) return new NextResponse('Forbidden', { status: 403 });

  await prisma.label.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
