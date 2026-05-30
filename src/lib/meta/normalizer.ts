export interface NormalizedMessage {
  waMessageId: string;
  phoneNumberId: string;
  from: string;
  fromName: string;
  type: "text" | "image" | "audio" | "video" | "document" | "location" | "sticker" | "reaction" | "unsupported";
  text?: string;
  mediaId?: string;
  timestamp: Date;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawPayload: any;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeMetaPayload(payload: any): NormalizedMessage[] {
  const messages: NormalizedMessage[] = [];

  if (!payload) return messages;

  // Support direct inner change.value objects
  if (payload.messages && Array.isArray(payload.messages)) {
    const phoneNumberId = payload.metadata?.phone_number_id;
    const contacts = payload.contacts || [];

    for (const msg of payload.messages) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contact = contacts.find((c: any) => c.wa_id === msg.from);
      const fromName = contact?.profile?.name || 'Unknown';

      let type = msg.type as NormalizedMessage['type'];
      let text = undefined;
      let mediaId = undefined;

      switch (type) {
        case 'text':
          text = msg.text?.body;
          break;
        case 'image':
        case 'audio':
        case 'video':
        case 'document':
        case 'sticker':
          mediaId = msg[type]?.id;
          break;
        case 'reaction':
          text = msg.reaction?.emoji;
          break;
        case 'location':
          // just to handle it somehow
          text = `Location: ${msg.location?.latitude}, ${msg.location?.longitude}`;
          break;
        default:
          type = 'unsupported';
          break;
      }

      messages.push({
        waMessageId: msg.id,
        phoneNumberId,
        from: msg.from,
        fromName,
        type,
        text,
        mediaId,
        timestamp: new Date(parseInt(msg.timestamp) * 1000),
        rawPayload: msg,
      });
    }
    return messages;
  }

  // Support full webhook payloads
  if (payload.object !== 'whatsapp_business_account') {
    return messages;
  }

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value || !value.messages) continue;
      
      messages.push(...normalizeMetaPayload(value));
    }
  }

  return messages;
}
