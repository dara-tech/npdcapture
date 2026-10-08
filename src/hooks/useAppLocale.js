import { useCallback } from 'react'
import { useConfig, useDataEngine } from '@dhis2/app-runtime'
import { APP_LOCALES, getLocaleByCode, normalizeLocaleCode } from '../lib/appLocales'
import { applyAppLocale, ensurePreferredLocale } from '../lib/applyAppLocale'
import { setPreferredLocale } from '../lib/localePreference'
import { useI18nLanguage } from './useI18nLanguage'

const GUARD_MS = 800
const GUARD_INTERVAL_MS = 40

const guardPreferredLocale = async (configDirection) => {
    const deadline = Date.now() + GUARD_MS
    while (Date.now() < deadline) {
        await ensurePreferredLocale(configDirection)
        await new Promise((resolve) => setTimeout(resolve, GUARD_INTERVAL_MS))
    }
}

export const useAppLocale = () => {
    const { direction: configDirection } = useConfig()
    const engine = useDataEngine()
    const currentCode = useI18nLanguage()
    const current = getLocaleByCode(currentCode)

    const setLocale = useCallback(
        async (code) => {
            const next = normalizeLocaleCode(code)
            setPreferredLocale(next)

            await applyAppLocale(next, { configDirection })

            try {
                await engine.mutate({
                    resource: 'userSettings/keyUiLocale',
                    type: 'create',
                    data: next,
                })
            } catch (err) {
                console.warn('Failed to save locale preference', err)
            }

            await guardPreferredLocale(configDirection)
        },
        [configDirection, engine]
    )

    return {
        locales: APP_LOCALES,
        currentCode,
        current,
        setLocale,
        saving: false,
    }
}
