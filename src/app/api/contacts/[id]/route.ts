import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { LeadStatus } from '@prisma/client';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId');

  if (!workspaceId) return new NextResponse('Missing workspaceId', { status: 400 });

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id || '', workspaceId } },
  });

  if (!membership) return new NextResponse('Forbidden', { status: 403 });

  const contact = await prisma.contact.findUnique({
    where: { id: params.id, workspaceId },
  });

  if (!contact) return new NextResponse('Not found', { status: 404 });

  return NextResponse.json(contact);
}

const patchSchema = z.object({
  whatsappName: z.string().optional(),
  fullName: z.string().optional(),
  email: z.string().email().optional(),
  company: z.string().optional(),
  businessType: z.string().optional(),
  needSummary: z.string().optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  leadScore: z.number().optional(),
  aiEnabled: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspaceId');

  if (!workspaceId) return new NextResponse('Missing workspaceId', { status: 400 });

  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId: session.user.id || '', workspaceId } },
  });

  if (!membership) return new NextResponse('Forbidden', { status: 403 });

  try {
    const body = await req.json();
    const data = patchSchema.parse(body);

    const contact = await prisma.contact.update({
      where: { id: params.id, workspaceId },
      data,
    });

    return NextResponse.json(contact);
  } catch {
    return new NextResponse('Bad Request', { status: 400 });
  }
}
