export type DmEventShareParse = {
  kind: 'event';
  eventId: string;
  // Message text with the event deep-link line removed (so the preview card
  // replaces it rather than duplicating it below the card).
  trimmedBody: string;
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
