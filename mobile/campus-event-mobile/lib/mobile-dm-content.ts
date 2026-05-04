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

export type DmPostAttachmentMediaType = 'image' | 'video';

export type DmPostAttachmentPayload = {
  kind: 'post_attachment';
  text?: string;
  post: {
    id: string;
    mediaType: DmPostAttachmentMediaType;
    mediaUrl?: string;
    thumbnailUrl?: string;
    caption?: string;
    durationSeconds?: number | null;
    mediaWidth?: number | null;
    mediaHeight?: number | null;
    authorId?: string;
    authorName?: string;
    authorUsername?: string;
    authorAvatar?: string;
  };
};

export type DmRecapAttachmentPayload = {
  kind: 'recap_attachment';
  text?: string;
  recap: {
    id: string;
    caption?: string;
    mediaUrl?: string;
    thumbnailUrl?: string;
    mediaType?: DmPostAttachmentMediaType;
    authorId?: string;
    authorName?: string;
    authorUsername?: string;
    authorAvatar?: string;
    eventId?: string;
    eventTitle?: string;
    eventImage?: string;
  };
};

export type DmPostShareParse = {
  kind: 'post';
  postId: string;
  trimmedBody: string;
};

const DM_EVENT_ATTACHMENT_VERSION = 1;
const DM_POST_ATTACHMENT_VERSION = 1;
const DM_RECAP_ATTACHMENT_VERSION = 1;

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

const toOptionalString = (value: unknown) =>
  typeof value === 'string' ? value : undefined;

const toOptionalNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

export const createDmPostAttachmentPayload = ({
  text,
  post,
}: {
  text?: string;
  post: DmPostAttachmentPayload['post'];
}) =>
  JSON.stringify({
    type: 'dm_post_attachment',
    version: DM_POST_ATTACHMENT_VERSION,
    text: text?.trim() || '',
    post: {
      id: String(post.id),
      mediaType: post.mediaType === 'video' ? 'video' : 'image',
      mediaUrl: post.mediaUrl || '',
      thumbnailUrl: post.thumbnailUrl || '',
      caption: post.caption || '',
      durationSeconds: post.durationSeconds ?? null,
      mediaWidth: post.mediaWidth ?? null,
      mediaHeight: post.mediaHeight ?? null,
      authorId: post.authorId || '',
      authorName: post.authorName || '',
      authorUsername: post.authorUsername || '',
      authorAvatar: post.authorAvatar || '',
    },
  });

export const parseDmPostAttachmentPayload = (
  body: string | null | undefined
): DmPostAttachmentPayload | null => {
  if (!body || typeof body !== 'string') return null;

  try {
    const parsed = JSON.parse(body) as {
      type?: string;
      text?: unknown;
      post?: Partial<DmPostAttachmentPayload['post']>;
    };

    if (parsed.type !== 'dm_post_attachment' || !parsed.post?.id) return null;

    const mediaType: DmPostAttachmentMediaType =
      parsed.post.mediaType === 'video' ? 'video' : 'image';

    return {
      kind: 'post_attachment',
      text: typeof parsed.text === 'string' ? parsed.text : '',
      post: {
        id: String(parsed.post.id),
        mediaType,
        mediaUrl: toOptionalString(parsed.post.mediaUrl) || '',
        thumbnailUrl: toOptionalString(parsed.post.thumbnailUrl) || '',
        caption: toOptionalString(parsed.post.caption) || '',
        durationSeconds: toOptionalNumber(parsed.post.durationSeconds),
        mediaWidth: toOptionalNumber(parsed.post.mediaWidth),
        mediaHeight: toOptionalNumber(parsed.post.mediaHeight),
        authorId: toOptionalString(parsed.post.authorId) || '',
        authorName: toOptionalString(parsed.post.authorName) || '',
        authorUsername: toOptionalString(parsed.post.authorUsername) || '',
        authorAvatar: toOptionalString(parsed.post.authorAvatar) || '',
      },
    };
  } catch {
    return null;
  }
};

export const createDmRecapAttachmentPayload = ({
  text,
  recap,
}: {
  text?: string;
  recap: DmRecapAttachmentPayload['recap'];
}) =>
  JSON.stringify({
    type: 'dm_recap_attachment',
    version: DM_RECAP_ATTACHMENT_VERSION,
    text: text?.trim() || '',
    recap: {
      id: String(recap.id),
      caption: recap.caption || '',
      mediaUrl: recap.mediaUrl || '',
      thumbnailUrl: recap.thumbnailUrl || '',
      mediaType: recap.mediaType === 'video' ? 'video' : 'image',
      authorId: recap.authorId || '',
      authorName: recap.authorName || '',
      authorUsername: recap.authorUsername || '',
      authorAvatar: recap.authorAvatar || '',
      eventId: recap.eventId || '',
      eventTitle: recap.eventTitle || '',
      eventImage: recap.eventImage || '',
    },
  });

export const parseDmRecapAttachmentPayload = (
  body: string | null | undefined
): DmRecapAttachmentPayload | null => {
  if (!body || typeof body !== 'string') return null;

  try {
    const parsed = JSON.parse(body) as {
      type?: string;
      text?: unknown;
      recap?: Partial<DmRecapAttachmentPayload['recap']>;
    };

    if (parsed.type !== 'dm_recap_attachment' || !parsed.recap?.id) return null;

    return {
      kind: 'recap_attachment',
      text: typeof parsed.text === 'string' ? parsed.text : '',
      recap: {
        id: String(parsed.recap.id),
        caption: toOptionalString(parsed.recap.caption) || '',
        mediaUrl: toOptionalString(parsed.recap.mediaUrl) || '',
        thumbnailUrl: toOptionalString(parsed.recap.thumbnailUrl) || '',
        mediaType: parsed.recap.mediaType === 'video' ? 'video' : 'image',
        authorId: toOptionalString(parsed.recap.authorId) || '',
        authorName: toOptionalString(parsed.recap.authorName) || '',
        authorUsername: toOptionalString(parsed.recap.authorUsername) || '',
        authorAvatar: toOptionalString(parsed.recap.authorAvatar) || '',
        eventId: toOptionalString(parsed.recap.eventId) || '',
        eventTitle: toOptionalString(parsed.recap.eventTitle) || '',
        eventImage: toOptionalString(parsed.recap.eventImage) || '',
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

const POST_LINK_REGEX = /\/post\/([A-Za-z0-9_-]{6,})/;
const POST_LINK_LINE_REGEX =
  /(^|\n)\s*\S*\/post\/[A-Za-z0-9_-]{6,}\S*\s*/g;

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

export const parseDmMessageForPostShare = (
  body: string | null | undefined
): DmPostShareParse | null => {
  if (!body || typeof body !== 'string') return null;

  const match = body.match(POST_LINK_REGEX);
  if (!match || !match[1]) return null;

  const postId = match[1];
  const trimmedBody = body.replace(POST_LINK_LINE_REGEX, '\n').trim();

  return {
    kind: 'post',
    postId,
    trimmedBody,
  };
};

export const formatDmMessagePreview = (body: string | null | undefined) => {
  const eventAttachment = parseDmEventAttachmentPayload(body);
  if (eventAttachment) {
    return eventAttachment.text?.trim() || eventAttachment.event.title || 'Shared an event';
  }

  const postAttachment = parseDmPostAttachmentPayload(body);
  if (postAttachment) {
    if (postAttachment.text?.trim()) return postAttachment.text.trim();
    if (postAttachment.post.caption?.trim()) return postAttachment.post.caption.trim();
    return postAttachment.post.mediaType === 'video' ? 'Shared a video' : 'Shared a post';
  }

  const recapAttachment = parseDmRecapAttachmentPayload(body);
  if (recapAttachment) {
    if (recapAttachment.text?.trim()) return recapAttachment.text.trim();
    if (recapAttachment.recap.caption?.trim()) return recapAttachment.recap.caption.trim();
    return 'Shared a recap';
  }

  const eventShare = parseDmMessageForEventShare(body);
  if (eventShare) return eventShare.trimmedBody || 'Shared an event';

  const postShare = parseDmMessageForPostShare(body);
  if (postShare) return postShare.trimmedBody || 'Shared a post';

  return body || '';
};
