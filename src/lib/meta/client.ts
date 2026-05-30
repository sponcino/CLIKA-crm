export class MetaAPIError extends Error {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(public code: number, public message: string, public details?: any) {
    super(`MetaAPIError [${code}]: ${message}`);
    this.name = 'MetaAPIError';
  }
}

const API_VERSION = 'v19.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function request(path: string, method: string, accessToken: string, body?: any) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new MetaAPIError(
      data.error?.code || response.status,
      data.error?.message || 'Unknown Meta API error',
      data.error
    );
  }

  return data;
}

export async function sendTextMessage(phoneNumberId: string, accessToken: string, to: string, text: string) {
  return request(`/${phoneNumberId}/messages`, 'POST', accessToken, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: text },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendTemplate(phoneNumberId: string, accessToken: string, to: string, templateName: string, languageCode: string, components: any[] = []) {
  return request(`/${phoneNumberId}/messages`, 'POST', accessToken, {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  });
}

export async function markAsRead(phoneNumberId: string, accessToken: string, messageId: string) {
  return request(`/${phoneNumberId}/messages`, 'POST', accessToken, {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  });
}

export async function getMediaUrl(mediaId: string, accessToken: string): Promise<string> {
  const data = await request(`/${mediaId}`, 'GET', accessToken);
  return data.url;
}
