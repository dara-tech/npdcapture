import { normalizeLocaleCode } from './appLocales'
import { getStoredLocale, setStoredLocale } from './localeStorage'

/** User's explicit locale choice — wins over DHIS2 userSettings until reload. */
let preferredLocale = getStoredLocale()

export const getPreferredLocale = () => preferredLocale ?? getStoredLocale()

export const setPreferredLocale = (code) => {
    preferredLocale = normalizeLocaleCode(code)
    setStoredLocale(preferredLocale)
    return preferredLocale
}
