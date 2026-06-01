import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

// GET: list funnels for workspace (with step counts)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workspaceId = (session.user as any).workspaceId;
  if (!workspaceId) return new NextResponse('Missing workspaceId', { status: 400 });

  try {
    const funnels = await prisma.funnel.findMany({
      where: { workspaceId },
      include: {
        steps: { orderBy: { order: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(funnels);
  } catch (error) {
    console.error('Error fetching funnels:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// POST: create funnel
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workspaceId = (session.user as any).workspaceId;
  if (!workspaceId) return new NextResponse('Missing workspaceId', { status: 400 });

  try {
    const body = await req.json();
    const { name, description } = body;
    if (!name?.trim()) return new NextResponse('Name required', { status: 400 });

    const funnel = await prisma.funnel.create({
      data: { workspaceId, name: name.trim(), description: description ?? null },
      include: { steps: true },
    });
    return NextResponse.json(funnel, { status: 201 });
  } catch (error) {
    console.error('Error creating funnel:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
