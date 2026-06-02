import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

async function getWorkspaceId(session: Awaited<ReturnType<typeof auth>>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (session?.user as any)?.workspaceId as string | undefined;
}

// GET: funnel with all steps
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });
  const workspaceId = await getWorkspaceId(session);
  if (!workspaceId) return new NextResponse('Missing workspaceId', { status: 400 });

  try {
    const funnel = await prisma.funnel.findFirst({
      where: { id: params.id, workspaceId },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    if (!funnel) return new NextResponse('Not Found', { status: 404 });
    return NextResponse.json(funnel);
  } catch (error) {
    console.error('Error fetching funnel:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// PATCH: update funnel
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });
  const workspaceId = await getWorkspaceId(session);
  if (!workspaceId) return new NextResponse('Missing workspaceId', { status: 400 });

  try {
    const body = await req.json();
    const { name, description, isActive, adAttributionEnabled } = body;
    const funnel = await prisma.funnel.updateMany({
      where: { id: params.id, workspaceId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
        ...(adAttributionEnabled !== undefined && { adAttributionEnabled }),
      },
    });
    if (!funnel.count) return new NextResponse('Not Found', { status: 404 });
    const updated = await prisma.funnel.findFirst({
      where: { id: params.id, workspaceId },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating funnel:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// DELETE: delete funnel
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });
  const workspaceId = await getWorkspaceId(session);
  if (!workspaceId) return new NextResponse('Missing workspaceId', { status: 400 });

  try {
    await prisma.funnel.deleteMany({ where: { id: params.id, workspaceId } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting funnel:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
