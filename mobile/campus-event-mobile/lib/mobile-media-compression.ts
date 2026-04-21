import type { SelectedStoryMedia } from '@/lib/mobile-story-composer';

const DEFAULT_MAX_DIMENSION = 1800;
const DEFAULT_IMAGE_QUALITY = 0.78;
const DEFAULT_THUMBNAIL_TIME_MS = 300;

// Optional peer deps: expo-image-manipulator (image resize/compress) and
// expo-video-thumbnails (video poster). When present, media is compressed
// before upload; when missing, the upload path falls through to the original
// media and the feature becomes a no-op. Install with:
//   npx expo install expo-image-manipulator expo-video-thumbnails
type ImageManipulatorModule = {
  manipulateAsync: (
    uri: string,
    actions: unknown[],
    options?: { compress?: number; format?: unknown }
  ) => Promise<{ uri: string; width: number; height: number }>;
  SaveFormat?: { JPEG: unknown; PNG: unknown };
};

type VideoThumbnailsModule = {
  getThumbnailAsync: (
    uri: string,
    options?: { time?: number; quality?: number }
  ) => Promise<{ uri: string; width: number; height: number }>;
};

let cachedImageManipulator: ImageManipulatorModule | null | undefined;
let cachedVideoThumbnails: VideoThumbnailsModule | null | undefined;

const loadImageManipulator = async (): Promise<ImageManipulatorModule | null> => {
  if (cachedImageManipulator !== undefined) return cachedImageManipulator;
  try {
    cachedImageManipulator = (await import(
      'expo-image-manipulator'
    )) as ImageManipulatorModule;
  } catch {
    cachedImageManipulator = null;
  }
  return cachedImageManipulator;
};

const loadVideoThumbnails = async (): Promise<VideoThumbnailsModule | null> => {
  if (cachedVideoThumbnails !== undefined) return cachedVideoThumbnails;
  try {
    cachedVideoThumbnails = (await import(
      'expo-video-thumbnails'
    )) as VideoThumbnailsModule;
  } catch {
    cachedVideoThumbnails = null;
  }
  return cachedVideoThumbnails;
};

export type CompressedImageResult = {
  uri: string;
  width?: number;
  height?: number;
  mimeType: string;
  fileName: string;
};

export type VideoPosterResult = {
  uri: string;
  width?: number;
  height?: number;
  mimeType: string;
  fileName: string;
};

/**
 * Compress/resize an image via expo-image-manipulator before upload.
 * Falls through to the original media if the module is not installed or if
 * compression fails.
 */
export const compressImageMedia = async (
  media: SelectedStoryMedia,
  {
    maxDimension = DEFAULT_MAX_DIMENSION,
    quality = DEFAULT_IMAGE_QUALITY,
  }: { maxDimension?: number; quality?: number } = {}
): Promise<CompressedImageResult | null> => {
  if (media.mediaType !== 'image') return null;

  const manipulator = await loadImageManipulator();
  if (!manipulator) return null;

  try {
    const actions = [{ resize: { width: maxDimension } }];

    const saveFormat = manipulator.SaveFormat?.JPEG ?? 'jpeg';

    const result = await manipulator.manipulateAsync(media.uri, actions, {
      compress: quality,
      format: saveFormat,
    });

    const fileName = (media.fileName || 'upload').replace(/\.[^.]+$/, '') + '.jpg';
    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
      mimeType: 'image/jpeg',
      fileName,
    };
  } catch (error) {
    console.warn('[mobile-media-compression] image compression failed:', error);
    return null;
  }
};

/**
 * Generate a poster/thumbnail image for a video using expo-video-thumbnails.
 * Returns `null` if the module is not installed or thumbnail generation fails.
 */
export const extractVideoPoster = async (
  media: SelectedStoryMedia,
  { timeMs = DEFAULT_THUMBNAIL_TIME_MS }: { timeMs?: number } = {}
): Promise<VideoPosterResult | null> => {
  if (media.mediaType !== 'video') return null;

  const thumbnails = await loadVideoThumbnails();
  if (!thumbnails) return null;

  try {
    const { uri, width, height } = await thumbnails.getThumbnailAsync(media.uri, {
      time: timeMs,
      quality: 0.8,
    });

    const baseName = (media.fileName || 'poster').replace(/\.[^.]+$/, '');
    return {
      uri,
      width,
      height,
      mimeType: 'image/jpeg',
      fileName: `${baseName}-poster.jpg`,
    };
  } catch (error) {
    console.warn('[mobile-media-compression] video thumbnail failed:', error);
    return null;
  }
};
