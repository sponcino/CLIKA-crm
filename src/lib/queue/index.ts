import { Queue } from 'bullmq';
import { bullmqConnection } from '../redis';

// Connection config for BullMQ
const connection = bullmqConnection;

// Export Queues (connection cast needed due to ioredis types)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const conn = connection as any;
export const metaMessagesQueue = new Queue('meta-messages', { connection: conn });
export const aiResponsesQueue = new Queue('ai-responses', { connection: conn });
export const templateSendsQueue = new Queue('template-sends', { connection: conn });
// More queues can be added here (e.g., ai-response, webhook-outbound)

// Note: Workers are typically instantiated separately to avoid running them in edge runtimes or where unsupported.
// We will instantiate them in instrumentation.ts or a separate file.
