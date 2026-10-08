import React, { useEffect } from 'react'
import { useConfig, useDataQuery } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { applyAppLocale, ensurePreferredLocale } from '../lib/applyAppLocale'
import { getPreferredLocale } from '../lib/localePreference'

const USER_SETTINGS_QUERY = {
    userSettings: {
        resource: 'userSettings',
    },
}

/**
 * Restores the user's locale choice on load and after DHIS2 userSettings refresh.
 */
export const I18nLocaleSync = ({ children }) => {
    const { direction: configDirection } = useConfig()
    const { data } = useDataQuery(USER_SETTINGS_QUERY)

    useEffect(() => {
        const preferred = getPreferredLocale()
        if (preferred) {
            applyAppLocale(preferred, { configDirection })
        }

        const onLanguageChanged = () => {
            ensurePreferredLocale(configDirection)
        }

        i18n.on('languageChanged', onLanguageChanged)

        return () => {
            i18n.off('languageChanged', onLanguageChanged)
        }
    }, [configDirection])

    useEffect(() => {
        if (!data?.userSettings) return
        ensurePreferredLocale(configDirection)
    }, [data?.userSettings, configDirection])

    return children
}
