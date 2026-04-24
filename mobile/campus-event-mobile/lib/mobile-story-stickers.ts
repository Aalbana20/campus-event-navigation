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
// 0.95 = roughly the feed event card's visible width after page padding, so the
// default sticker size matches the real EventStackCard the user already knows.
export const EVENT_CARD_WIDTH_FRACTION = 0.95;
export const EVENT_CARD_ASPECT = 1.35; // height / width, portrait-ish card (matches EventCardSticker)
export const MEDIA_STICKER_WIDTH_FRACTION = 0.9;
export const DEFAULT_MEDIA_STICKER_ASPECT = 1.25;

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
        aspectRatio: toFiniteNumber(record.aspectRatio, DEFAULT_MEDIA_STICKER_ASPECT),
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

export const findMediaStickerInStory = (
  stickers: StoryStickerRecord[]
): Extract<StoryStickerRecord, { type: 'post_card' | 'video_card' }> | null => {
  for (const sticker of stickers) {
    if (sticker.type === 'post_card' || sticker.type === 'video_card') return sticker;
  }
  return null;
};
