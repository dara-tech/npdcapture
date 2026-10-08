import i18n from '@dhis2/d2-i18n'

/**
 * Adds DHIS2 `locale` and `translate` query params so metadata returns
 * translated display* fields (organisation units, data elements, options, etc.).
 */
export function mergeLocaleParams(params = {}, options = {}) {
    const translate = options.translate !== undefined ? options.translate : true
    let locale = options.locale
    if (!locale) {
        const raw = (i18n.resolvedLanguage || i18n.language || 'en').trim()
        locale =
            !raw || raw === 'en' || raw.toLowerCase().startsWith('en')
                ? 'en'
                : raw.replace(/-/g, '_')
    }
    return { ...params, locale, translate }
}
