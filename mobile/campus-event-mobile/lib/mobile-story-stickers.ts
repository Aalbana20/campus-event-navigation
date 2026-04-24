import type {
  StoryStickerRecord,
  StoryStickerTransform,
  StoryType,
} from '@/types/models';

// Story canvas reference geometry. Positions inside StoryStickerTransform are
// normalized 0..1 relative to this aspect so they render the same on any
// device. Width units are arbitrary; only the ratio matters.
export const STORY_CANVAS_ASPECT = 9 / 16;

// Reference event-card sticker size in normalized canvas width units. The
// editor uses the live canvas width * CARD_WIDTH_FRACTION to compute actual
// pixels.
export const EVENT_CARD_WIDTH_FRACTION = 0.78;
export const EVENT_CARD_ASPECT = 1.2; // height / width, portrait-ish card

export const createEventStickerTransform = (): StoryStickerTransform => ({
  x: 0.5,
  y: 0.46,
  scale: 1,
  rotation: 0,
});

const toFiniteNumber = (value: unknown, fallback: number) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizeStoryStickerTransform = (
  value: unknown
): StoryStickerTransform => {
  if (!value || typeof value !== 'object') {
    return createEventStickerTransform();
  }
  const source = value as Record<string, unknown>;
  return {
    x: toFiniteNumber(source.x, 0.5),
    y: toFiniteNumber(source.y, 0.46),
    scale: toFiniteNumber(source.scale, 1),
    rotation: toFiniteNumber(source.rotation, 0),
  };
};

export const normalizeStoryStickers = (value: unknown): StoryStickerRecord[] => {
  if (!Array.isArray(value)) return [];
  const stickers: StoryStickerRecord[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const type = typeof record.type === 'string' ? record.type : '';
    const transform = normalizeStoryStickerTransform(record.transform);

    if (type === 'event_card' && typeof record.eventId === 'string') {
      stickers.push({
        type: 'event_card',
        eventId: String(record.eventId),
        transform,
      });
      continue;
    }

    if (
      (type === 'post_card' || type === 'video_card') &&
      typeof record.postId === 'string'
    ) {
      stickers.push({
        type,
        postId: String(record.postId),
        transform,
      });
    }
  }

  return stickers;
};

export const normalizeStoryType = (value: unknown): StoryType => {
  if (
    value === 'event_share' ||
    value === 'post_share' ||
    value === 'video_share'
  ) {
    return value;
  }
  return 'standard';
};

export const findEventStickerInStory = (
  stickers: StoryStickerRecord[]
): Extract<StoryStickerRecord, { type: 'event_card' }> | null => {
  for (const sticker of stickers) {
    if (sticker.type === 'event_card') return sticker;
  }
  return null;
};
