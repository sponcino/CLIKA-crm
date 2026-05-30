import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { dispatchWebhook } from '@/lib/webhooks/dispatcher';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.workspaceId) return new NextResponse('Unauthorized', { status: 401 });

  const webhook = await prisma.webhookConfig.findUnique({
    where: { id: params.id, workspaceId: session.user.workspaceId }
  });

  if (!webhook) {
    return new NextResponse('Not Found', { status: 404 });
  }

  // Dispatch a test payload
  await dispatchWebhook(session.user.workspaceId, webhook.event, {
    test: true,
    timestamp: new Date().toISOString(),
    message: "This is a test webhook from CLIKA CRM"
  });

  return NextResponse.json({ success: true, message: "Webhook disparado. Revisa los logs." });
}
