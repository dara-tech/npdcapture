import { useSyncExternalStore } from 'react'
import i18n from '@dhis2/d2-i18n'
import { normalizeLocaleCode } from '../lib/appLocales'
import { LOCALE_CHANGED_EVENT } from '../lib/notifyLocaleChanged'

const subscribe = (onChange) => {
    const handler = () => onChange()

    i18n.on('languageChanged', handler)
    if (typeof window !== 'undefined') {
        window.addEventListener(LOCALE_CHANGED_EVENT, handler)
    }

    return () => {
        i18n.off('languageChanged', handler)
        if (typeof window !== 'undefined') {
            window.removeEventListener(LOCALE_CHANGED_EVENT, handler)
        }
    }
}

const getSnapshot = () => normalizeLocaleCode(i18n.language)

/**
 * Subscribe to locale changes so the calling component re-renders when
 * i18n.t() strings should update. Call in App, AppSidebar, and other shells.
 */
export const useI18nLanguage = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
