import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const patchSchema = z.object({
  name: z.string().optional(),
  url: z.string().url().optional(),
  event: z.string().optional(),
  enabled: z.boolean().optional(),
  secret: z.string().nullable().optional(),
  customHeaders: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.workspaceId) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const body = await req.json();
    const data = patchSchema.parse(body);

    const webhook = await prisma.webhookConfig.update({
      where: { id: params.id, workspaceId: session.user.workspaceId },
      data
    });

    return NextResponse.json(webhook);
  } catch {
    return new NextResponse('Bad Request', { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.workspaceId) return new NextResponse('Unauthorized', { status: 401 });

  try {
    await prisma.webhookConfig.delete({
      where: { id: params.id, workspaceId: session.user.workspaceId }
    });

    return NextResponse.json({ success: true });
  } catch {
    return new NextResponse('Bad Request', { status: 400 });
  }
}
