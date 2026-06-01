import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

// PATCH: update a step
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; stepId: string } }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workspaceId = (session.user as any)?.workspaceId as string;
  if (!workspaceId) return new NextResponse('Missing workspaceId', { status: 400 });

  try {
    // Verify funnel belongs to workspace
    const funnel = await prisma.funnel.findFirst({ where: { id: params.id, workspaceId } });
    if (!funnel) return new NextResponse('Not Found', { status: 404 });

    const body = await req.json();
    const { name, nextStepId, order, description, actions } = body;

    const step = await prisma.funnelStep.updateMany({
      where: { id: params.stepId, funnelId: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(nextStepId !== undefined && { nextStepId }),
        ...(order !== undefined && { order }),
        ...(description !== undefined && { description }),
        ...(actions !== undefined && { actions }),
      },
    });

    if (!step.count) return new NextResponse('Not Found', { status: 404 });

    const updated = await prisma.funnelStep.findFirst({
      where: { id: params.stepId, funnelId: params.id },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating step:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// DELETE: delete a step
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; stepId: string } }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workspaceId = (session.user as any)?.workspaceId as string;
  if (!workspaceId) return new NextResponse('Missing workspaceId', { status: 400 });

  try {
    const funnel = await prisma.funnel.findFirst({ where: { id: params.id, workspaceId } });
    if (!funnel) return new NextResponse('Not Found', { status: 404 });

    await prisma.funnelStep.deleteMany({
      where: { id: params.stepId, funnelId: params.id },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting step:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
