export type DmEventShareParse = {
  kind: 'event';
  eventId: string;
  // Message text with the event deep-link line removed (so the preview card
  // replaces it rather than duplicating it below the card).
  trimmedBody: string;
};

export type DmEventAttachmentPayload = {
  kind: 'event_attachment';
  text?: string;
  event: {
    id: string;
    title?: string;
    image?: string;
    date?: string;
    time?: string;
    location?: string;
  };
};

const DM_EVENT_ATTACHMENT_VERSION = 1;

export const createDmEventAttachmentPayload = ({
  text,
  event,
}: {
  text?: string;
  event: DmEventAttachmentPayload['event'];
}) =>
  JSON.stringify({
    type: 'dm_event_attachment',
    version: DM_EVENT_ATTACHMENT_VERSION,
    text: text?.trim() || '',
    event,
  });

export const parseDmEventAttachmentPayload = (
  body: string | null | undefined
): DmEventAttachmentPayload | null => {
  if (!body || typeof body !== 'string') return null;

  try {
    const parsed = JSON.parse(body) as {
      type?: string;
      text?: unknown;
      event?: Partial<DmEventAttachmentPayload['event']>;
    };

    if (parsed.type !== 'dm_event_attachment' || !parsed.event?.id) return null;

    return {
      kind: 'event_attachment',
      text: typeof parsed.text === 'string' ? parsed.text : '',
      event: {
        id: String(parsed.event.id),
        title: typeof parsed.event.title === 'string' ? parsed.event.title : '',
        image: typeof parsed.event.image === 'string' ? parsed.event.image : '',
        date: typeof parsed.event.date === 'string' ? parsed.event.date : '',
        time: typeof parsed.event.time === 'string' ? parsed.event.time : '',
        location: typeof parsed.event.location === 'string' ? parsed.event.location : '',
      },
    };
  } catch {
    return null;
  }
};

// Extract the first /event/<id> segment from a DM body. Handles ExpoLinking URLs
// across schemes (dev exp://, standalone com.app://, campus-event://) since we
// only match on the path segment.
const EVENT_LINK_REGEX = /\/event\/([A-Za-z0-9_-]{6,})/;

// Match a whole line (or inline URL) that contains an event link so we can
// strip it when rendering the rich preview.
const EVENT_LINK_LINE_REGEX =
  /(^|\n)\s*\S*\/event\/[A-Za-z0-9_-]{6,}\S*\s*/g;

export const parseDmMessageForEventShare = (
  body: string | null | undefined
): DmEventShareParse | null => {
  if (!body || typeof body !== 'string') return null;

  const match = body.match(EVENT_LINK_REGEX);
  if (!match || !match[1]) return null;

  const eventId = match[1];
  const trimmedBody = body.replace(EVENT_LINK_LINE_REGEX, '\n').trim();

  return {
    kind: 'event',
    eventId,
    trimmedBody,
  };
};

export const formatDmMessagePreview = (body: string | null | undefined) => {
  const eventAttachment = parseDmEventAttachmentPayload(body);
  if (eventAttachment) {
    return eventAttachment.text?.trim() || eventAttachment.event.title || 'Shared an event';
  }

  const eventShare = parseDmMessageForEventShare(body);
  if (eventShare) return eventShare.trimmedBody || 'Shared an event';

  return body || '';
};
