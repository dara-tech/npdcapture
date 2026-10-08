import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import {
    applyTheme,
    getStoredTheme,
    resolveTheme,
    setStoredTheme,
} from '../lib/theme'

const ThemeContext = createContext(null)

export const ThemeProvider = ({ children }) => {
    const [preference, setPreference] = useState(() => getStoredTheme())
    const resolved = useMemo(() => resolveTheme(preference), [preference])

    useLayoutEffect(() => {
        applyTheme(resolved)
    }, [resolved])

    useEffect(() => {
        if (preference !== 'system') return undefined
        const media = window.matchMedia('(prefers-color-scheme: dark)')
        const onChange = () => applyTheme(resolveTheme('system'))
        media.addEventListener('change', onChange)
        return () => media.removeEventListener('change', onChange)
    }, [preference])

    const setTheme = useCallback((next) => {
        setStoredTheme(next)
        setPreference(next)
    }, [])

    const toggleTheme = useCallback(() => {
        setTheme(resolved === 'dark' ? 'light' : 'dark')
    }, [resolved, setTheme])

    const value = useMemo(
        () => ({ preference, resolved, setTheme, toggleTheme }),
        [preference, resolved, setTheme, toggleTheme]
    )

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
    const ctx = useContext(ThemeContext)
    if (!ctx) {
        throw new Error('useTheme must be used within ThemeProvider')
    }
    return ctx
}
