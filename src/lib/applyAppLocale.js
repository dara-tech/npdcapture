import i18n from '@dhis2/d2-i18n'
import moment from 'moment'
import { normalizeLocaleCode } from './appLocales'
import { getPreferredLocale } from './localePreference'
import { notifyLocaleChanged } from './notifyLocaleChanged'

const changeI18nLanguage = (code) =>
    new Promise((resolve, reject) => {
        i18n.changeLanguage(code, (err) => {
            if (err) reject(err)
            else resolve()
        })
    })

const loadMomentLocale = async (code) => {
    const locale = new Intl.Locale(code)
    const { language, region, script } = locale

    if (language === 'en') {
        moment.locale('en')
        return
    }

    const candidates = []
    if (script) candidates.push(`${language}-${script}`.toLowerCase())
    if (region) candidates.push(`${language}-${region}`.toLowerCase())
    candidates.push(language)

    for (const localeName of candidates) {
        try {
            await import(`moment/dist/locale/${localeName}`)
            moment.locale(localeName)
            return
        } catch {
            continue
        }
    }
}

/**
 * Switch UI language immediately (i18n, document, moment, text direction).
 * @param {string} code - App locale code (`en`, `km`, …)
 */
export const applyAppLocale = async (code, { configDirection = 'auto' } = {}) => {
    const next = normalizeLocaleCode(code)
    await changeI18nLanguage(next)
    document.documentElement.setAttribute('lang', next)

    await loadMomentLocale(next)

    const localeDirection = i18n.dir(next)
    const globalDirection =
        configDirection === 'auto' ? localeDirection : configDirection
    if (['ltr', 'rtl'].includes(globalDirection)) {
        document.documentElement.setAttribute('dir', globalDirection)
    }

    notifyLocaleChanged()
    return next
}

/**
 * Re-apply the user's preferred locale when DHIS2 resets i18n silently.
 */
export const ensurePreferredLocale = async (configDirection = 'auto') => {
    const target = getPreferredLocale()
    if (!target) return null

    const active = normalizeLocaleCode(i18n.language)
    if (active === target) return target

    await applyAppLocale(target, { configDirection })
    return target
}
