import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { processIncomingPayload } from '@/lib/meta/processor';
import { aiResponsesQueue } from '@/lib/queue';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode') || searchParams.get('hub_mode');
  const token = searchParams.get('hub.verify_token') || searchParams.get('hub_verify_token');
  const challenge = searchParams.get('hub.challenge') || searchParams.get('hub_challenge');

  if (mode === 'subscribe' && token) {
    const globalVerifyToken = process.env.META_VERIFY_TOKEN;
    if (token === globalVerifyToken) {
      return new NextResponse(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain', 'ngrok-skip-browser-warning': '1' },
      });
    }
    const config = await prisma.whatsAppConfig.findFirst({
      where: { webhookVerifyToken: token },
    });
    if (config) {
      return new NextResponse(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain', 'ngrok-skip-browser-warning': '1' },
      });
    }
  }
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-hub-signature-256');

    if (signature && process.env.META_APP_SECRET) {
      const expected = `sha256=${crypto
        .createHmac('sha256', process.env.META_APP_SECRET)
        .update(rawBody)
        .digest('hex')}`;
      if (signature !== expected) {
        console.warn('[webhook] Invalid Meta signature — request rejected');
        return new NextResponse('OK', { status: 200 });
      }
    }

    const payload = JSON.parse(rawBody);
    console.log('[webhook] POST received:', JSON.stringify(payload).substring(0, 300));

    if (payload.object !== 'whatsapp_business_account') {
      return new NextResponse('OK', { status: 200 });
    }

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue;

        // Process directly — no queue dependency for DB writes
        const processed = await processIncomingPayload(change.value);

        // Queue AI responses (best-effort — don't block or fail if Redis is down)
        for (const msg of processed) {
          if (msg.aiEnabled && msg.conversationStatus !== 'HUMAN_REQUIRED') {
            aiResponsesQueue
              .add('ai-response', {
                workspaceId: msg.workspaceId,
                contactId: msg.contactId,
                conversationId: msg.conversationId,
                messageText: msg.messageContent,
              })
              .catch((err) =>
                console.error('[webhook] Failed to queue AI response:', err)
              );
          }
        }
      }
    }

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('[webhook] POST error:', error);
    return new NextResponse('OK', { status: 200 });
  }
}
