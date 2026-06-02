import crypto from 'crypto';
import prisma from '@/lib/prisma';

export async function dispatchWebhook(workspaceId: string, event: string, payload: Record<string, unknown>) {
  try {
    const webhooks = await prisma.webhookConfig.findMany({
      where: {
        workspaceId,
        enabled: true,
        OR: [
          { event },                      // legacy single-event records
          { events: { has: event } },     // new multi-event records
        ],
      },
    });

    for (const webhook of webhooks) {
      const payloadString = JSON.stringify(payload);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-CLIKA-Event': event,
      };

      if (webhook.secret) {
        const signature = crypto.createHmac('sha256', webhook.secret).update(payloadString).digest('hex');
        headers['X-CLIKA-Signature'] = `sha256=${signature}`;
      }

      // Add custom headers if configured
      if (webhook.customHeaders) {
        try {
          const custom = JSON.parse(webhook.customHeaders);
          Object.assign(headers, custom);
        } catch {
          console.warn('Invalid customHeaders JSON for webhook', webhook.id);
        }
      }

      // Execute with exponential backoff retry (up to 3 times)
      let attempt = 0;
      let success = false;
      let lastStatus = 0;
      let lastError = null;

      while (attempt < 3 && !success) {
        try {
          const response = await fetch(webhook.url, {
            method: 'POST',
            headers,
            body: payloadString,
          });

          lastStatus = response.status;
          if (response.ok) {
            success = true;
          } else {
            lastError = `HTTP ${response.status}: ${await response.text()}`;
            attempt++;
            if (attempt < 3) await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
          }
        } catch (error: unknown) {
          lastStatus = 0;
          lastError = error instanceof Error ? error.message : String(error);
          attempt++;
          if (attempt < 3) await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }

      // Log result
      await prisma.webhookLog.create({
        data: {
          webhookId: webhook.id,
          payload: payloadString,
          status: lastStatus,
          error: lastError ? String(lastError).substring(0, 500) : null,
        }
      });

      // Update last status on config
      await prisma.webhookConfig.update({
        where: { id: webhook.id },
        data: {
          lastStatus,
          lastCalledAt: new Date(),
          lastError: lastError ? String(lastError).substring(0, 500) : null,
        },
      });
    }
  } catch (error) {
    console.error('Error dispatching webhooks:', error);
    // Never throw
  }
}
