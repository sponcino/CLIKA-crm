import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: session.user.id },
    include: { workspace: true },
  });

  if (!membership?.workspace) return new NextResponse('No workspace found', { status: 404 });

  return NextResponse.json({
    id: membership.workspace.id,
    name: membership.workspace.name,
    createdAt: membership.workspace.createdAt,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const { name } = await req.json();
    if (!name || typeof name !== 'string') {
      return new NextResponse('Invalid name', { status: 400 });
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: session.user.id },
    });

    if (!membership) return new NextResponse('No workspace found', { status: 404 });
    
    // Check if user has permission (OWNER or ADMIN usually, but we'll just check membership here as requested)
    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
        return new NextResponse('Forbidden: Must be OWNER or ADMIN', { status: 403 });
    }

    const workspace = await prisma.workspace.update({
      where: { id: membership.workspaceId },
      data: { name },
    });

    return NextResponse.json({
      id: workspace.id,
      name: workspace.name,
    });
  } catch (error) {
    console.error('Error updating workspace:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
