const DEFAULT_MAX_DIMENSION = 1800
const DEFAULT_IMAGE_QUALITY = 0.78
const DEFAULT_THUMBNAIL_DIMENSION = 720
const DEFAULT_THUMBNAIL_QUALITY = 0.7

const supportsWebPCache = (() => {
  let cached = null
  return () => {
    if (cached !== null) return cached
    try {
      const canvas = document.createElement("canvas")
      canvas.width = 1
      canvas.height = 1
      cached = canvas.toDataURL("image/webp").startsWith("data:image/webp")
    } catch {
      cached = false
    }
    return cached
  }
})()

const readImageFromFile = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = (error) => {
      URL.revokeObjectURL(url)
      reject(error instanceof Error ? error : new Error("Could not read image."))
    }
    image.decoding = "async"
    image.src = url
  })

const canvasToBlob = (canvas, mimeType, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas encode failed."))),
      mimeType,
      quality
    )
  })

const fitWithinBox = (width, height, maxDimension) => {
  if (width <= maxDimension && height <= maxDimension) return { width, height }
  const ratio = Math.min(maxDimension / width, maxDimension / height)
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  }
}

export const compressImageFile = async (
  file,
  {
    maxDimension = DEFAULT_MAX_DIMENSION,
    quality = DEFAULT_IMAGE_QUALITY,
    preferWebP = true,
  } = {}
) => {
  if (!file || !file.type?.startsWith("image/")) return file
  // Never recompress GIFs (would lose animation) or images below the threshold.
  if (file.type === "image/gif") return file

  try {
    const image = await readImageFromFile(file)
    const { width, height } = fitWithinBox(
      image.naturalWidth,
      image.naturalHeight,
      maxDimension
    )

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.drawImage(image, 0, 0, width, height)

    const targetMime = preferWebP && supportsWebPCache() ? "image/webp" : "image/jpeg"
    const blob = await canvasToBlob(canvas, targetMime, quality)

    if (!blob || blob.size >= file.size) {
      // Recompression didn't help — ship the original.
      return file
    }

    const extension = targetMime === "image/webp" ? "webp" : "jpg"
    const baseName = (file.name || "upload").replace(/\.[^.]+$/, "")
    return new File([blob], `${baseName}.${extension}`, {
      type: targetMime,
      lastModified: Date.now(),
    })
  } catch (error) {
    console.warn("[mediaCompression] image compression failed, using original:", error)
    return file
  }
}

const captureVideoFrame = (videoElement, width, height) => {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas context unavailable.")
  ctx.drawImage(videoElement, 0, 0, width, height)
  return canvas
}

const loadVideoElement = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement("video")
    video.preload = "metadata"
    video.muted = true
    video.playsInline = true
    video.crossOrigin = "anonymous"
    video.src = url

    const cleanup = () => URL.revokeObjectURL(url)

    video.onloadedmetadata = () => {
      try {
        video.currentTime = Math.min(0.3, (video.duration || 0) * 0.05 || 0)
      } catch {
        // some browsers need a seeked event; fall through to onseeked
      }
    }
    video.onseeked = () => resolve({ video, cleanup })
    video.onerror = () => {
      cleanup()
      reject(new Error("Could not read video."))
    }
  })

/**
 * Extracts a poster image and basic metadata (width, height, duration) from a
 * video file. Does NOT transcode the video itself — browser-side video
 * compression would require ffmpeg.wasm which is too heavy for this use case.
 * Instead, the upload layer relies on upload size caps and the thumbnail so
 * the feed can render a cheap poster first.
 */
export const extractVideoPoster = async (
  file,
  {
    maxDimension = DEFAULT_THUMBNAIL_DIMENSION,
    quality = DEFAULT_THUMBNAIL_QUALITY,
    preferWebP = true,
  } = {}
) => {
  if (!file || !file.type?.startsWith("video/")) return null

  let videoRef = null
  try {
    const { video, cleanup } = await loadVideoElement(file)
    videoRef = { video, cleanup }

    const { videoWidth, videoHeight, duration } = video
    if (!videoWidth || !videoHeight) return null

    const { width, height } = fitWithinBox(videoWidth, videoHeight, maxDimension)
    const canvas = captureVideoFrame(video, width, height)
    const mimeType = preferWebP && supportsWebPCache() ? "image/webp" : "image/jpeg"
    const blob = await canvasToBlob(canvas, mimeType, quality)

    const extension = mimeType === "image/webp" ? "webp" : "jpg"
    const baseName = (file.name || "poster").replace(/\.[^.]+$/, "")
    const posterFile = new File([blob], `${baseName}-poster.${extension}`, {
      type: mimeType,
      lastModified: Date.now(),
    })

    return {
      file: posterFile,
      width: videoWidth,
      height: videoHeight,
      durationSeconds: Number.isFinite(duration) ? Math.round(duration * 1000) / 1000 : null,
    }
  } catch (error) {
    console.warn("[mediaCompression] video poster extraction failed:", error)
    return null
  } finally {
    if (videoRef) {
      videoRef.cleanup()
      videoRef.video.src = ""
    }
  }
}

export const readImageDimensions = async (file) => {
  if (!file || !file.type?.startsWith("image/")) return null
  try {
    const image = await readImageFromFile(file)
    return { width: image.naturalWidth, height: image.naturalHeight }
  } catch {
    return null
  }
}
