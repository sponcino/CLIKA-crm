import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { LeadStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId');
  const search = searchParams.get('search');
  const status = searchParams.get('status');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

  if (!workspaceId) return new NextResponse('Missing workspaceId', { status: 400 });

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id || '', workspaceId } },
  });

  if (!membership) return new NextResponse('Forbidden', { status: 403 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { workspaceId };
  if (status) where.status = status as LeadStatus;
  if (search) {
    where.OR = [
      { whatsappName: { contains: search, mode: 'insensitive' } },
      { fullName: { contains: search, mode: 'insensitive' } },
      { whatsappPhone: { contains: search } },
    ];
  }

  const contacts = await prisma.contact.findMany({
    where,
    orderBy: { lastMessageAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });

  const total = await prisma.contact.count({ where });

  return NextResponse.json({
    data: contacts,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}

const postSchema = z.object({
  workspaceId: z.string(),
  whatsappPhone: z.string(),
  fullName: z.string().optional(),
  email: z.string().email().optional(),
  status: z.nativeEnum(LeadStatus).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const body = await req.json();
    const data = postSchema.parse(body);

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: session.user.id || '', workspaceId: data.workspaceId } },
    });

    if (!membership) return new NextResponse('Forbidden', { status: 403 });

    const contact = await prisma.contact.create({
      data: {
        workspaceId: data.workspaceId,
        whatsappPhone: data.whatsappPhone,
        fullName: data.fullName,
        email: data.email,
        status: data.status || 'NEW',
      },
    });

    return NextResponse.json(contact);
  } catch {
    return new NextResponse('Bad Request', { status: 400 });
  }
}
