import { normalizeLocaleCode } from './appLocales'

export const LOCALE_STORAGE_KEY = 'capture-ui-locale'

export const getStoredLocale = () => {
    try {
        const stored = sessionStorage.getItem(LOCALE_STORAGE_KEY)
        return stored ? normalizeLocaleCode(stored) : null
    } catch {
        return null
    }
}

export const setStoredLocale = (code) => {
    try {
        sessionStorage.setItem(LOCALE_STORAGE_KEY, normalizeLocaleCode(code))
    } catch {
        /* ignore quota / private mode */
    }
}
