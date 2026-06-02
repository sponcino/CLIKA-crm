import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

// GET: list steps for a funnel
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workspaceId = (session.user as any)?.workspaceId as string;
  if (!workspaceId) return new NextResponse('Missing workspaceId', { status: 400 });

  try {
    const funnel = await prisma.funnel.findFirst({ where: { id: params.id, workspaceId } });
    if (!funnel) return new NextResponse('Not Found', { status: 404 });

    const steps = await prisma.funnelStep.findMany({
      where: { funnelId: params.id },
      orderBy: { order: 'asc' },
    });
    return NextResponse.json(steps);
  } catch (error) {
    console.error('Error fetching steps:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// POST: create a step
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workspaceId = (session.user as any)?.workspaceId as string;
  if (!workspaceId) return new NextResponse('Missing workspaceId', { status: 400 });

  try {
    const funnel = await prisma.funnel.findFirst({ where: { id: params.id, workspaceId } });
    if (!funnel) return new NextResponse('Not Found', { status: 404 });

    const body = await req.json();
    const { name, stepId, nextStepId, order, description, instructions, transitionCriteria, actions } = body;
    if (!name || !stepId) return new NextResponse('name and stepId required', { status: 400 });

    const step = await prisma.funnelStep.create({
      data: {
        funnelId: params.id,
        name,
        stepId,
        nextStepId: nextStepId ?? null,
        order: order ?? 0,
        description: description ?? null,
        instructions: instructions ?? null,
        transitionCriteria: transitionCriteria ?? null,
        actions: actions ?? {},
      },
    });
    return NextResponse.json(step, { status: 201 });
  } catch (error) {
    console.error('Error creating step:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
