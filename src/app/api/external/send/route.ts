import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { validateApiKey } from '@/lib/api-key-auth';
import { sendTextMessage } from '@/lib/meta/client';
import { decrypt } from '@/lib/crypto';

const bodySchema = z.object({
  to: z.string().min(1),
  message: z.string().min(1),
  type: z.literal('text').optional().default('text'),
});

export async function POST(req: NextRequest) {
  const auth = await validateApiKey(req);
  if (!auth) return new NextResponse('Unauthorized', { status: 401 });

  const { workspaceId } = auth;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return new NextResponse('Invalid body', { status: 400 });
  }

  const contact = await prisma.contact.findUnique({
    where: { workspaceId_whatsappPhone: { workspaceId, whatsappPhone: body.to } },
  });
  if (!contact) return new NextResponse('Contact not found', { status: 404 });

  const conversation = await prisma.conversation.findFirst({
    where: { workspaceId, contactId: contact.id, status: { not: 'CLOSED' } },
    orderBy: { updatedAt: 'desc' },
  });
  if (!conversation) return new NextResponse('No open conversation', { status: 404 });

  const config = await prisma.whatsAppConfig.findUnique({ where: { workspaceId } });
  if (!config?.encryptedAccessToken || !config.phoneNumberId) {
    return new NextResponse('WhatsApp not configured', { status: 503 });
  }

  const accessToken = decrypt(config.encryptedAccessToken);

  let waMessageId: string | undefined;
  try {
    const result = await sendTextMessage(
      config.phoneNumberId,
      accessToken,
      body.to,
      body.message
    );
    waMessageId = result?.messages?.[0]?.id;
  } catch (err) {
    console.error('[external/send] Meta API error:', err);
    return new NextResponse('Failed to send via WhatsApp', { status: 502 });
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      whatsappMsgId: waMessageId,
      direction: 'OUTBOUND',
      content: body.message,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ success: true, messageId: message.id }, { status: 200 });
}
