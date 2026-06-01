import prisma from '../prisma';
import { decrypt } from '../crypto';
import { markAsRead, getMediaUrl } from './client';
import { normalizeMetaPayload } from './normalizer';
import { dispatchWebhook } from '../webhooks/dispatcher';
import type { NormalizedMessage } from './normalizer';

export interface ProcessResult {
  processed: number;
  skipped: number;
  errors: string[];
}

// Returns { workspaceId, contactId, conversationId, messageId } for AI queuing
export interface ProcessedMessage {
  workspaceId: string;
  contactId: string;
  conversationId: string;
  messageId: string;
  messageContent: string;
  aiEnabled: boolean;
  conversationStatus: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function processIncomingPayload(payload: any): Promise<ProcessedMessage[]> {
  const normalized = normalizeMetaPayload(payload);
  if (!normalized || normalized.length === 0) return [];

  const results: ProcessedMessage[] = [];

  for (const data of normalized) {
    const result = await processNormalizedMessage(data);
    if (result) results.push(result);
  }

  return results;
}

async function processNormalizedMessage(data: NormalizedMessage): Promise<ProcessedMessage | null> {
  const config = await prisma.whatsAppConfig.findFirst({
    where: { phoneNumberId: data.phoneNumberId },
  });

  if (!config) {
    console.error(`[processor] No WhatsAppConfig for phoneNumberId: ${data.phoneNumberId}`);
    return null;
  }

  const workspaceId = config.workspaceId;
  const accessToken = config.encryptedAccessToken ? decrypt(config.encryptedAccessToken) : null;

  let mediaUrl: string | undefined;
  if (data.mediaId && accessToken) {
    try {
      mediaUrl = await getMediaUrl(data.mediaId, accessToken);
    } catch (err) {
      console.error(`[processor] Failed to get media url for ${data.mediaId}:`, err);
    }
  }

  const now = new Date();

  let contact = await prisma.contact.findUnique({
    where: { workspaceId_whatsappPhone: { workspaceId, whatsappPhone: data.from } },
  });

  const previousLastMessageAt = contact?.lastMessageAt;

  if (contact) {
    contact = await prisma.contact.update({
      where: { id: contact.id },
      data: {
        lastMessageAt: now,
        whatsappName: contact.whatsappName || data.fromName,
      },
    });
  } else {
    contact = await prisma.contact.create({
      data: {
        workspaceId,
        whatsappPhone: data.from,
        whatsappName: data.fromName,
        lastMessageAt: now,
        status: 'NEW',
      },
    });
  }

  let requiresTemplate = false;
  if (previousLastMessageAt) {
    const hours = (now.getTime() - previousLastMessageAt.getTime()) / (1000 * 60 * 60);
    if (hours > 23) requiresTemplate = true;
  }

  let conversation = await prisma.conversation.findFirst({
    where: { workspaceId, contactId: contact.id, status: { not: 'CLOSED' } },
    orderBy: { createdAt: 'desc' },
  });

  if (conversation) {
    conversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: now, requiresTemplate },
    });
  } else {
    conversation = await prisma.conversation.create({
      data: { workspaceId, contactId: contact.id, status: 'OPEN', requiresTemplate },
    });
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      whatsappMsgId: data.waMessageId,
      direction: 'INBOUND',
      content: data.text || `[Media: ${data.type}]`,
      mediaUrl,
      createdAt: data.timestamp,
    },
  });

  if (accessToken) {
    try {
      await markAsRead(data.phoneNumberId, accessToken, data.waMessageId);
    } catch (err) {
      console.error(`[processor] Failed to mark as read ${data.waMessageId}:`, err);
    }
  }

  await dispatchWebhook(workspaceId, 'message.received', {
    contact: { ...contact },
    message: {
      id: message.id,
      content: message.content,
      type: data.type,
      mediaUrl: message.mediaUrl,
      mediaId: data.mediaId,
      direction: message.direction,
      createdAt: message.createdAt,
    },
  }).catch((err) => console.error('[processor] dispatchWebhook error:', err));

  // Publish SSE via Redis (best-effort — don't fail if Redis is down)
  try {
    const { default: redis } = await import('../redis');
    await redis.publish(
      `workspace:${workspaceId}:inbox`,
      JSON.stringify({
        type: 'new_message',
        payload: { message, conversationId: conversation.id, contactId: contact.id },
      })
    );
  } catch (err) {
    console.warn('[processor] Redis publish failed (SSE disabled):', err);
  }

  return {
    workspaceId,
    contactId: contact.id,
    conversationId: conversation.id,
    messageId: message.id,
    messageContent: message.content,
    aiEnabled: contact.aiEnabled,
    conversationStatus: conversation.status,
  };
}
