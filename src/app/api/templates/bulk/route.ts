import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { templateSendsQueue } from '@/lib/queue';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const body = await req.json();
    const { templateId, contactIds, variables } = body;

    if (!templateId || !Array.isArray(contactIds) || contactIds.length === 0) {
      return new NextResponse('Missing templateId or contactIds array', { status: 400 });
    }

    const template = await prisma.whatsAppTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) return new NextResponse('Template not found', { status: 404 });

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: session.user.id || '', workspaceId: template.workspaceId } },
    });
    if (!membership) return new NextResponse('Forbidden', { status: 403 });

    let count = 0;
    for (const contactId of contactIds) {
      // Enqueue job in BullMQ
      await templateSendsQueue.add('send-single-template', {
        templateId,
        contactId,
        variables,
      });
      count++;
    }

    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error('Error queuing bulk template send:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
