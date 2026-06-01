import { Worker, Job } from 'bullmq';
import { bullmqConnection } from '../../redis';
import { processIncomingPayload } from '../../meta/processor';
import { aiResponsesQueue } from '../index';

// This worker is kept for retry/backpressure scenarios but the webhook now
// processes messages directly — so this worker only runs if jobs are explicitly
// enqueued elsewhere (e.g., manual reprocessing).
export const metaMessagesWorker = new Worker(
  'meta-messages',
  async (job: Job<{ payload: unknown }>) => {
    const { payload } = job.data;
    console.log('[MetaMessageWorker] Processing job:', job.id);

    const processed = await processIncomingPayload(payload);

    for (const msg of processed) {
      if (msg.aiEnabled && msg.conversationStatus !== 'HUMAN_REQUIRED') {
        await aiResponsesQueue.add('ai-response', {
          workspaceId: msg.workspaceId,
          contactId: msg.contactId,
          conversationId: msg.conversationId,
          messageText: msg.messageContent,
        });
      }
    }

    console.log(`[MetaMessageWorker] Done. Processed: ${processed.length}`);
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { connection: bullmqConnection as any }
);

metaMessagesWorker.on('error', (err) => {
  console.error('[MetaMessageWorker] Error:', err);
});
