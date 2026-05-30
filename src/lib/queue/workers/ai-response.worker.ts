import { Worker, Job } from 'bullmq';
import { bullmqConnection } from '../../redis';
import prisma from '@/lib/prisma';
import { runAgent } from '@/lib/ai/agent';
import { sendTextMessage } from '@/lib/meta/client';
import { decrypt } from '@/lib/crypto';
import { dispatchWebhook } from '@/lib/webhooks/dispatcher';

export interface AIResponseJobPayload {
  workspaceId: string;
  contactId: string;
  conversationId: string;
  messageText: string;
}

export const aiResponseWorker = new Worker<AIResponseJobPayload>(
  'ai-responses',
  async (job: Job<AIResponseJobPayload>) => {
    const { workspaceId, contactId, conversationId, messageText } = job.data;
    
    console.log(`Processing AI response for conversation ${conversationId}`);

    try {
      // Execute the stateless agent
      const aiResult = await runAgent({
        workspaceId,
        contactId,
        conversationId,
        messageText,
        messageHistory: [] // Always empty as requested
      });

      // Send the response via WhatsApp Meta API
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        include: { workspace: { include: { whatsappConfig: true } } }
      });

      if (!contact || !contact.workspace.whatsappConfig?.encryptedAccessToken) {
        throw new Error('Contact or WhatsApp Config not found for sending AI response');
      }

      const waConfig = contact.workspace.whatsappConfig;
      const accessToken = decrypt(waConfig.encryptedAccessToken!);
      if (!waConfig.phoneNumberId) {
        throw new Error('WhatsApp phoneNumberId is not configured');
      }

      // Meta Send
      const metaResponse = await sendTextMessage(
        waConfig.phoneNumberId,
        contact.whatsappPhone,
        aiResult.response,
        accessToken
      );

      // Save the sent message to DB
      const dbMessage = await prisma.message.create({
        data: {
          conversationId,
          whatsappMsgId: metaResponse.messages?.[0]?.id || `ai-${Date.now()}`,
          direction: 'OUTBOUND',
          content: aiResult.response,
        }
      });

      // Update Conversation timestamp
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() }
      });

      // Emit Webhook
      await dispatchWebhook(workspaceId, "message.sent", { contact, message: dbMessage });

      // Publish to Redis for SSE Inbox stream
      await bullmqConnection.publish(
        'inbox_updates',
        JSON.stringify({
          type: 'new_message',
          payload: {
            conversationId,
            contactId,
            message: dbMessage,
          }
        })
      );

      console.log(`AI response sent for conversation ${conversationId}`);

    } catch (error) {
      console.error(`AI Worker failed for job ${job.id}:`, error);
      // Log to audit, don't crash
      await prisma.auditLog.create({
        data: {
          workspaceId,
          action: 'ai_response_error',
          details: String(error)
        }
      });
    }
  },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connection: bullmqConnection as any,
    concurrency: 5,
  }
);

aiResponseWorker.on('failed', (job, err) => {
  console.error(`AI Job ${job?.id} failed:`, err);
});
