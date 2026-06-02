import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.workspaceId) return new NextResponse('Unauthorized', { status: 401 });

  const webhook = await prisma.webhookConfig.findUnique({
    where: { id: params.id, workspaceId: session.user.workspaceId },
  });

  if (!webhook) return new NextResponse('Not Found', { status: 404 });

  const payload = JSON.stringify({
    test: true,
    event: webhook.events[0] ?? webhook.event,
    timestamp: new Date().toISOString(),
    message: 'Test webhook from CLIKA CRM',
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-CLIKA-Event': webhook.events[0] ?? webhook.event,
    'X-CLIKA-Test': '1',
  };

  if (webhook.secret) {
    headers['X-CLIKA-Signature'] = `sha256=${crypto
      .createHmac('sha256', webhook.secret)
      .update(payload)
      .digest('hex')}`;
  }

  const start = Date.now();
  let status = 0;
  let ok = false;
  let error: string | undefined;

  try {
    const res = await fetch(webhook.url, { method: 'POST', headers, body: payload });
    status = res.status;
    ok = res.ok;
    if (!res.ok) error = `HTTP ${res.status}`;
  } catch (err) {
    error = err instanceof Error ? err.message : 'fetch failed';
  }

  const ms = Date.now() - start;

  // Persist result
  await prisma.webhookConfig.update({
    where: { id: webhook.id },
    data: { lastStatus: status || null, lastCalledAt: new Date(), lastError: error ?? null },
  }).catch(() => {});

  await prisma.webhookLog.create({
    data: { webhookId: webhook.id, payload, status, error: error ?? null },
  }).catch(() => {});

  return NextResponse.json({ ok, status, ms, error });
}
