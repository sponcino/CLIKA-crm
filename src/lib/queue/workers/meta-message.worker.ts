import { Worker, Job } from 'bullmq';
import prisma from '../../prisma';
import redis, { bullmqConnection } from '../../redis';
import { decrypt } from '../../crypto';
import { markAsRead, getMediaUrl } from '../../meta/client';
import { normalizeMetaPayload } from '../../meta/normalizer';
import { dispatchWebhook } from '../../webhooks/dispatcher';
import { aiResponsesQueue } from '../index';

export const metaMessagesWorker = new Worker(
  'meta-messages',
  async (job: Job<{ payload: unknown }>) => {
    const { payload } = job.data;
    const messages = normalizeMetaPayload(payload);
    if (!messages || messages.length === 0) return;
    console.log("NORMALIZED:", JSON.stringify(messages[0]?.from), messages.length);

    for (const data of messages) {
      // a. Find WhatsAppConfig by phoneNumberId
      const config = await prisma.whatsAppConfig.findFirst({
        where: { phoneNumberId: data.phoneNumberId },
      });

      if (!config) {
        console.error(`No WhatsAppConfig found for phoneNumberId: ${data.phoneNumberId}`);
        continue; // Can't process if we don't know the workspace, skip to next message
      }

      const workspaceId = config.workspaceId;

      // Fetch media URL if applicable
      let mediaUrl: string | undefined = undefined;
      const accessToken = config.encryptedAccessToken ? decrypt(config.encryptedAccessToken) : null;
      if (data.mediaId && accessToken) {
        try {
          mediaUrl = await getMediaUrl(data.mediaId, accessToken);
        } catch (err) {
          console.error(`Failed to get media url for ${data.mediaId}:`, err);
        }
      }

      // b & c. Get or create Contact & update lastMessageAt
      const now = new Date();
      let contact = await prisma.contact.findUnique({
        where: {
          workspaceId_whatsappPhone: {
            workspaceId,
            whatsappPhone: data.from,
          },
        },
      });

      const previousLastMessageAt = contact?.lastMessageAt;

      if (contact) {
        contact = await prisma.contact.update({
          where: { id: contact.id },
          data: {
            lastMessageAt: now,
            whatsappName: contact.whatsappName || data.fromName, // Update name if missing
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

      // d. Get or create Conversation
      // requiresTemplate = true if previousLastMessageAt exists AND now - previousLastMessageAt > 23 hours
      let requiresTemplate = false;
      if (previousLastMessageAt) {
        const hoursSinceLastMessage = (now.getTime() - previousLastMessageAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastMessage > 23) {
          requiresTemplate = true;
        }
      }

      let conversation = await prisma.conversation.findFirst({
        where: {
          workspaceId,
          contactId: contact.id,
          status: { not: 'CLOSED' },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (conversation) {
        conversation = await prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            updatedAt: now,
            requiresTemplate,
          },
        });
      } else {
        conversation = await prisma.conversation.create({
          data: {
            workspaceId,
            contactId: contact.id,
            status: 'OPEN',
            requiresTemplate,
          },
        });
      }

      // e. Create Message record
      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          whatsappMsgId: data.waMessageId,
          direction: 'INBOUND',
          content: data.text || `[Media: ${data.type}]`,
          mediaUrl: mediaUrl,
          createdAt: data.timestamp,
        },
      });

      // f. Mark message as read via Meta API
      if (accessToken) {
        try {
          await markAsRead(data.phoneNumberId, accessToken, data.waMessageId);
        } catch (err) {
          console.error(`Failed to mark message ${data.waMessageId} as read`, err);
          // Do not crash worker
        }
      }

      // g. Enqueue AI if enabled
      if (contact.aiEnabled && conversation.status !== 'HUMAN_REQUIRED') {
        await aiResponsesQueue.add('ai-response', {
          workspaceId,
          contactId: contact.id,
          conversationId: conversation.id,
          messageText: message.content
        });
        console.log(`[Worker] AI processing queued for message: ${message.id}`);
      }

      // g2. Emit webhook
      const webhookPayload = {
        contact: { ...contact },
        message: {
          id: message.id,
          content: message.content,
          type: data.type,
          mediaUrl: message.mediaUrl,
          mediaId: data.mediaId,
          direction: message.direction,
          createdAt: message.createdAt
        }
      };
      await dispatchWebhook(workspaceId, "message.received", webhookPayload);

      // h. Emit SSE event via Redis Pub/Sub
      const channel = `workspace:${workspaceId}:inbox`;
      await redis.publish(channel, JSON.stringify({
        type: 'new_message',
        payload: {
          message,
          conversationId: conversation.id,
          contactId: contact.id,
        }
      }));
    }
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { connection: bullmqConnection as any }
);

// Worker error handling
metaMessagesWorker.on('error', (err) => {
  console.error('[MetaMessageWorker] Error:', err);
});
