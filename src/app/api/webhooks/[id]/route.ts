import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const patchSchema = z.object({
  name: z.string().optional(),
  url: z.string().url().optional(),
  events: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
  secret: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.workspaceId) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const body = await req.json();
    const data = patchSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.url !== undefined) updateData.url = data.url;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    if (data.secret !== undefined) updateData.secret = data.secret;
    if (data.events !== undefined) {
      updateData.events = data.events;
      updateData.event = data.events[0] ?? '';
    }

    const webhook = await prisma.webhookConfig.update({
      where: { id: params.id, workspaceId: session.user.workspaceId },
      data: updateData,
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
      where: { id: params.id, workspaceId: session.user.workspaceId },
    });
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse('Bad Request', { status: 400 });
  }
}
