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
          mediaId = msg.image?.id;
          text = msg.image?.caption || undefined;
          break;
        case 'audio':
          mediaId = msg.audio?.id;
          type = 'audio';
          break;
        case 'video':
          mediaId = msg.video?.id;
          text = msg.video?.caption || undefined;
          break;
        case 'document':
          mediaId = msg.document?.id;
          text = msg.document?.filename || undefined;
          break;
        case 'sticker':
          mediaId = msg.sticker?.id;
          break;
        case 'reaction':
          text = msg.reaction?.emoji;
          break;
        case 'location':
          text = `Location: ${msg.location?.latitude}, ${msg.location?.longitude}`;
          break;
        case 'contacts':
          text = msg.contacts?.map((c: any) => `${c.name?.formatted_name || 'Contact'} (${c.phones?.[0]?.phone || 'No phone'})`).join(', ') || 'Contact card';
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
