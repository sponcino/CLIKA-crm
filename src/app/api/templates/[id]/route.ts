import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;

  const template = await prisma.whatsAppTemplate.findUnique({
    where: { id },
  });

  if (!template) return new NextResponse('Template not found', { status: 404 });

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id || '', workspaceId: template.workspaceId } },
  });
  if (!membership) return new NextResponse('Forbidden', { status: 403 });

  return NextResponse.json(template);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  const { id } = await params;

  try {
    const template = await prisma.whatsAppTemplate.findUnique({
      where: { id },
    });

    if (!template) return new NextResponse('Template not found', { status: 404 });

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: session.user.id || '', workspaceId: template.workspaceId } },
    });
    if (!membership) return new NextResponse('Forbidden', { status: 403 });

    await prisma.whatsAppTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
