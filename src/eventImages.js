const EVENT_IMAGE_FALLBACK_SVG = encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 720" fill="none">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#111827" />
        <stop offset="55%" stop-color="#2563eb" />
        <stop offset="100%" stop-color="#ec4899" />
      </linearGradient>
      <linearGradient id="card" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="rgba(255,255,255,0.32)" />
        <stop offset="100%" stop-color="rgba(255,255,255,0.08)" />
      </linearGradient>
    </defs>
    <rect width="960" height="720" rx="48" fill="url(#bg)" />
    <circle cx="784" cy="160" r="120" fill="rgba(255,255,255,0.12)" />
    <circle cx="168" cy="612" r="144" fill="rgba(255,255,255,0.1)" />
    <rect x="96" y="112" width="768" height="496" rx="40" fill="rgba(10,14,22,0.22)" stroke="rgba(255,255,255,0.16)" />
    <rect x="160" y="184" width="220" height="36" rx="18" fill="rgba(255,255,255,0.2)" />
    <rect x="160" y="252" width="420" height="136" rx="28" fill="url(#card)" stroke="rgba(255,255,255,0.14)" />
    <rect x="608" y="252" width="192" height="136" rx="28" fill="rgba(255,255,255,0.18)" />
    <rect x="160" y="432" width="256" height="24" rx="12" fill="rgba(255,255,255,0.2)" />
    <rect x="160" y="478" width="184" height="24" rx="12" fill="rgba(255,255,255,0.16)" />
    <rect x="160" y="542" width="156" height="44" rx="22" fill="rgba(255,255,255,0.2)" />
  </svg>
`)

export const EVENT_IMAGE_FALLBACK_SRC = `data:image/svg+xml;utf8,${EVENT_IMAGE_FALLBACK_SVG}`

export const EVENT_IMAGE_FALLBACK_BACKGROUND =
  "linear-gradient(135deg, rgba(17, 24, 39, 0.96), rgba(37, 99, 235, 0.82), rgba(236, 72, 153, 0.64))"

export const hasEventImage = (image) => typeof image === "string" && image.trim().length > 0

export const getEventImageSrc = (image) =>
  hasEventImage(image) ? image.trim() : EVENT_IMAGE_FALLBACK_SRC

const VIDEO_EXTENSIONS = [".mp4", ".mov", ".m4v", ".webm", ".mkv"]

export const isVideoMediaSrc = (value) => {
  if (typeof value !== "string") return false
  const normalized = value.trim().toLowerCase().split("?")[0].split("#")[0]
  if (!normalized) return false
  return VIDEO_EXTENSIONS.some((extension) => normalized.endsWith(extension))
}

export const applyEventImageFallback = (event) => {
  event.currentTarget.onerror = null
  event.currentTarget.src = EVENT_IMAGE_FALLBACK_SRC
}

export const buildEventImageStyle = (
  image,
  overlay = "linear-gradient(180deg, rgba(15, 23, 42, 0.08), rgba(15, 23, 42, 0.72))"
) => {
  if (hasEventImage(image)) {
    return {
      backgroundImage: `${overlay}, url("${image.trim()}"), ${EVENT_IMAGE_FALLBACK_BACKGROUND}`,
    }
  }

  return {
    backgroundImage: `${overlay}, ${EVENT_IMAGE_FALLBACK_BACKGROUND}`,
  }
}
