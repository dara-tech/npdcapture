export const LOCALE_CHANGED_EVENT = 'capture-locale-changed'

/** Tell React trees to re-render after i18n.changeLanguage (incl. silent adapter resets). */
export const notifyLocaleChanged = () => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(LOCALE_CHANGED_EVENT))
    }
}
