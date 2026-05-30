import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { metaMessagesQueue } from '@/lib/queue';

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
        headers: { 
          'Content-Type': 'text/plain',
          'ngrok-skip-browser-warning': '1'
        }
      });
    }
    const config = await prisma.whatsAppConfig.findFirst({
      where: { webhookVerifyToken: token },
    });
    if (config) {
      return new NextResponse(challenge, { 
        status: 200,
        headers: { 
          'Content-Type': 'text/plain',
          'ngrok-skip-browser-warning': '1'
        }
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
      const expectedSignature = `sha256=${crypto
        .createHmac('sha256', process.env.META_APP_SECRET)
        .update(rawBody)
        .digest('hex')}`;
      if (signature !== expectedSignature) {
        console.warn('Invalid Meta webhook signature');
        return new NextResponse('OK', { status: 200 });
      }
    }

    const payload = JSON.parse(rawBody);
    console.log('WEBHOOK POST received:', JSON.stringify(payload).substring(0, 200));

    if (payload.object === 'whatsapp_business_account') {
      for (const entry of payload.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'messages') {
            await metaMessagesQueue.add('process-message', {
              payload: change.value,
              entryId: entry.id,
            });
          }
        }
      }
    }

    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook POST error:', error);
    return new NextResponse('OK', { status: 200 });
  }
}
