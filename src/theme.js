export const THEME_MODE_KEY = "themeMode"
export const ACCENT_COLOR_KEY = "accentColor"

export const ACCENT_COLOR_OPTIONS = [
  { key: "green", label: "Green", color: "#32d74b" },
  { key: "blue", label: "Blue", color: "#0a84ff" },
  { key: "purple", label: "Purple", color: "#bf5af2" },
  { key: "pink", label: "Pink", color: "#ff2d92" },
  { key: "orange", label: "Orange", color: "#ff9f0a" },
  { key: "red", label: "Red", color: "#ff453a" },
  { key: "white", label: "White", color: "#ffffff" },
]

export const getAccentOption = (key) =>
  ACCENT_COLOR_OPTIONS.find((option) => option.key === key) || ACCENT_COLOR_OPTIONS[0]

export const getStoredThemeMode = () => {
  if (typeof window === "undefined") return "device"

  const storedThemeMode = window.localStorage.getItem(THEME_MODE_KEY)
  return storedThemeMode === "light" || storedThemeMode === "dark" || storedThemeMode === "device"
    ? storedThemeMode
    : "device"
}

export const getSystemTheme = () => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light"
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export const resolveThemeMode = (themeMode) =>
  themeMode === "device" ? getSystemTheme() : themeMode === "dark" ? "dark" : "light"

export const applyThemeMode = (themeMode) => {
  const resolvedTheme = resolveThemeMode(themeMode)

  if (typeof document === "undefined") return resolvedTheme

  document.body.classList.remove("theme-light", "theme-dark")
  document.body.classList.add(`theme-${resolvedTheme}`)
  document.documentElement.style.colorScheme = resolvedTheme

  return resolvedTheme
}

export const getStoredAccentColor = () => {
  if (typeof window === "undefined") return "green"
  return getAccentOption(window.localStorage.getItem(ACCENT_COLOR_KEY)).key
}

export const applyAccentColor = (accentColor) => {
  const option = getAccentOption(accentColor)
  if (typeof document !== "undefined") {
    document.documentElement.style.setProperty("--accent", option.color)
  }
  return option.key
}

export const persistAccentColor = (accentColor) => {
  if (typeof window === "undefined") return
  window.localStorage.setItem(ACCENT_COLOR_KEY, getAccentOption(accentColor).key)
}

export const persistThemeMode = (themeMode) => {
  if (typeof window === "undefined") return
  window.localStorage.setItem(THEME_MODE_KEY, themeMode)
}

export const initializeTheme = () => {
  const storedThemeMode = getStoredThemeMode()
  applyAccentColor(getStoredAccentColor())
  return applyThemeMode(storedThemeMode)
}
