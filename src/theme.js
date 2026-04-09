export const THEME_MODE_KEY = "themeMode"

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

export const persistThemeMode = (themeMode) => {
  if (typeof window === "undefined") return
  window.localStorage.setItem(THEME_MODE_KEY, themeMode)
}

export const initializeTheme = () => {
  const storedThemeMode = getStoredThemeMode()
  return applyThemeMode(storedThemeMode)
}
