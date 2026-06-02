import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiKey } from '@/lib/api-key-auth';
import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';
import { sendTextMessage } from '@/lib/meta/client';

const bodySchema = z.object({
  to: z.string().min(1),
  message: z.union([z.string().min(1), z.array(z.string().min(1))]),
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

  const messages = Array.isArray(body.message) ? body.message : [body.message];

  const contact = await prisma.contact.findUnique({
    where: { workspaceId_whatsappPhone: { workspaceId, whatsappPhone: body.to } },
  });
  if (!contact) return new NextResponse('Contact not found', { status: 404 });

  const conversation = await prisma.conversation.findFirst({
    where: { contactId: contact.id, workspaceId, status: { not: 'CLOSED' } },
  });
  if (!conversation) return new NextResponse('No open conversation', { status: 404 });

  const config = await prisma.whatsAppConfig.findUnique({ where: { workspaceId } });
  if (!config?.encryptedAccessToken || !config?.phoneNumberId)
    return new NextResponse('WhatsApp not configured', { status: 500 });

  const accessToken = decrypt(config.encryptedAccessToken);
  const messageIds: string[] = [];

  for (const text of messages) {
    const result = await sendTextMessage(config.phoneNumberId, accessToken, body.to, text);
    const waMessageId = result?.messages?.[0]?.id;
    const saved = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        content: text,
        whatsappMsgId: waMessageId,
      },
    });
    messageIds.push(saved.id);
    await new Promise(r => setTimeout(r, 500));
  }

  return NextResponse.json({ success: true, messageIds }, { status: 200 });
}
