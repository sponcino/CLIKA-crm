import { Worker, Job } from 'bullmq';
import { bullmqConnection } from '../../redis';
import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';
import { sendTemplate } from '@/lib/meta/client';

export interface TemplateSendJobPayload {
  templateId: string;
  contactId: string;
  variables?: Record<string, string>;
}

export const templateSendWorker = new Worker<TemplateSendJobPayload>(
  'template-sends',
  async (job: Job<TemplateSendJobPayload>) => {
    const { templateId, contactId, variables } = job.data;
    console.log(`Processing bulk template send for contact ${contactId}, template ${templateId}`);

    try {
      const template = await prisma.whatsAppTemplate.findUnique({
        where: { id: templateId },
      });
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
      });

      if (!template || !contact) {
        throw new Error('Template or contact not found for queue worker job');
      }

      const config = await prisma.whatsAppConfig.findFirst({
        where: { workspaceId: template.workspaceId },
      });

      if (!config || !config.encryptedAccessToken || !config.phoneNumberId) {
        throw new Error('WhatsApp Config missing credentials or phoneNumberId');
      }

      const accessToken = decrypt(config.encryptedAccessToken);
      const phoneNumberId = config.phoneNumberId;

      // Build components parameter from variables
      const vars = variables || {};
      const parameters = Object.keys(vars)
        .sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b))
        .map((key) => ({
          type: 'text',
          text: String(vars[key]),
        }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const components: any[] = parameters.length > 0 ? [{
        type: 'body',
        parameters,
      }] : [];

      let sendLogStatus = 'SENT';
      let errorMessage = null;

      try {
        await sendTemplate(
          phoneNumberId,
          accessToken,
          contact.whatsappPhone,
          template.name,
          'es',
          components
        );
      } catch (err: unknown) {
        console.error('Meta template send failed in worker:', err);
        sendLogStatus = 'FAILED';
        errorMessage = err instanceof Error ? err.message : String(err);
      }

      // Save log
      await prisma.templateSendLog.create({
        data: {
          templateId,
          contactId,
          status: sendLogStatus,
          error: errorMessage ? errorMessage.substring(0, 500) : null,
        },
      });

      console.log(`Template send worker completed with status: ${sendLogStatus} for job ${job.id}`);
    } catch (error) {
      console.error(`Template send worker failed for job ${job.id}:`, error);
      // Log to audit, don't crash
      try {
        const template = await prisma.whatsAppTemplate.findUnique({ where: { id: templateId } });
        if (template) {
          await prisma.auditLog.create({
            data: {
              workspaceId: template.workspaceId,
              action: 'template_send_worker_error',
              details: String(error),
            },
          });
        }
      } catch (logErr) {
        console.error('Could not log template send failure to audit log:', logErr);
      }
    }
  },
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    connection: bullmqConnection as any,
    concurrency: 5,
  }
);

templateSendWorker.on('failed', (job, err) => {
  console.error(`Template send worker Job ${job?.id} failed:`, err);
});
