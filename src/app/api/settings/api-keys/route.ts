import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

async function resolveWorkspaceId(userId: string, req: NextRequest): Promise<string | null> {
  const qId = new URL(req.url).searchParams.get('workspaceId');
  if (qId) {
    const m = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: qId } },
    });
    return m ? qId : null;
  }
  const m = await prisma.workspaceMember.findFirst({
    where: { userId },
    select: { workspaceId: true },
  });
  return m?.workspaceId ?? null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

  const workspaceId = await resolveWorkspaceId(session.user.id, req);
  if (!workspaceId) return new NextResponse('No workspace', { status: 400 });

  const keys = await prisma.apiKey.findMany({
    where: { workspaceId },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      lastUsedAt: true,
      createdAt: true,
      isActive: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(keys);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse('Unauthorized', { status: 401 });

  const workspaceId = await resolveWorkspaceId(session.user.id, req);
  if (!workspaceId) return new NextResponse('No workspace', { status: 400 });

  const body = await req.json();
  const name = (body.name as string)?.trim();
  if (!name) return new NextResponse('Name required', { status: 400 });

  const rawKey = `clika_${crypto.randomBytes(32).toString('hex')}`;
  const hashed = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.slice(0, 8);

  const record = await prisma.apiKey.create({
    data: { workspaceId, name, key: hashed, keyPrefix },
    select: { id: true, name: true, keyPrefix: true, createdAt: true, isActive: true },
  });

  return NextResponse.json({ ...record, fullKey: rawKey }, { status: 201 });
}
