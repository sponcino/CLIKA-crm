import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { sendTextMessage } from '@/lib/meta/client';
import { decrypt } from '@/lib/crypto';
import redis from '@/lib/redis';

const sendSchema = z.object({
  conversationId: z.string(),
  text: z.string().min(1),
  workspaceId: z.string(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const body = await req.json();
    const { conversationId, text, workspaceId } = sendSchema.parse(body);

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: session.user.id || '', workspaceId } },
    });

    if (!membership) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId, workspaceId },
      include: { contact: true },
    });

    if (!conversation) {
      return new NextResponse('Conversation not found', { status: 404 });
    }

    const config = await prisma.whatsAppConfig.findUnique({
      where: { workspaceId },
    });

    if (!config || !config.encryptedAccessToken || !config.phoneNumberId) {
      return new NextResponse('WhatsApp Config not found or incomplete', { status: 400 });
    }

    // Send via Meta
    const accessToken = decrypt(config.encryptedAccessToken);
    const result = await sendTextMessage(config.phoneNumberId, accessToken, conversation.contact.whatsappPhone, text);

    // Save to DB
    const message = await prisma.message.create({
      data: {
        conversationId,
        whatsappMsgId: result.messages?.[0]?.id,
        direction: 'OUTBOUND',
        content: text,
      },
    });

    // Emit SSE
    const channel = `workspace:${workspaceId}:inbox`;
    await redis.publish(channel, JSON.stringify({
      type: 'new_message',
      payload: {
        message,
        conversationId,
        contactId: conversation.contactId,
      }
    }));

    return NextResponse.json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
