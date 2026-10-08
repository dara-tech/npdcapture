export const THEME_STORAGE_KEY = 'capture-theme'

/** @typedef {'light' | 'dark' | 'system'} ThemePreference */

/** @returns {ThemePreference} */
export function getStoredTheme() {
    if (typeof window === 'undefined') return 'system'
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored
    }
    return 'system'
}

/** @param {ThemePreference} preference */
export function setStoredTheme(preference) {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(THEME_STORAGE_KEY, preference)
}

/** @param {ThemePreference} preference @returns {'light' | 'dark'} */
export function resolveTheme(preference) {
    if (preference === 'light' || preference === 'dark') return preference
    if (typeof window === 'undefined') return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** @param {'light' | 'dark'} resolved */
export function applyTheme(resolved) {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.classList.toggle('dark', resolved === 'dark')
    root.style.colorScheme = resolved
}

/** Apply saved preference before first paint (call from App module scope). */
export function initTheme() {
    applyTheme(resolveTheme(getStoredTheme()))
}
