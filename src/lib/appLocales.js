/** Locales shipped with this app (see d2.config.js `locales`). */
export const APP_LOCALES = [
    { code: 'en', label: 'English', nativeLabel: 'English' },
    { code: 'km', label: 'Khmer', nativeLabel: 'ភាសាខ្មែរ' },
]

export const getLocaleByCode = (code) =>
    APP_LOCALES.find((locale) => locale.code === code) ?? APP_LOCALES[0]

/** Map i18n / DHIS2 locale strings to an app locale code. */
export const normalizeLocaleCode = (locale) => {
    const base = String(locale || 'en').split('-')[0].split('_')[0].toLowerCase()
    return APP_LOCALES.some((item) => item.code === base) ? base : 'en'
}
