import React, { useEffect, useState } from 'react'
import '../../index.css'
import { Spinner } from '../../components/ui/spinner'
import { fetchSession, resolveBaseUrl } from '../../lib/captureAuth'
import { CaptureLoginGate } from './CaptureLoginGate'

/**
 * Checks DHIS2 session before mounting AppAdapter so we can show a branded
 * login screen instead of the default @dhis2/app-adapter modal.
 */
export function CaptureSessionGate({ config, children }) {
    const [phase, setPhase] = useState('checking')
    const [baseUrl, setBaseUrl] = useState(() => resolveBaseUrl())

    useEffect(() => {
        let cancelled = false

        const verify = async () => {
            let url = resolveBaseUrl()
            if (!url && config?.url) {
                url = String(config.url).replace(/\/$/, '')
            }
            if (!url) {
                const stored = window.localStorage.DHIS2_BASE_URL
                if (stored) {
                    url = String(stored).replace(/\/$/, '')
                }
            }

            if (!url) {
                if (!cancelled) {
                    setBaseUrl('')
                    setPhase('login')
                }
                return
            }

            if (!cancelled) {
                setBaseUrl(url)
            }

            try {
                await fetchSession(url)
                if (!cancelled) {
                    setPhase('ready')
                }
            } catch {
                if (!cancelled) {
                    setPhase('login')
                }
            }
        }

        verify()
        return () => {
            cancelled = true
        }
    }, [config?.url])

    if (phase === 'checking') {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#f4f6f8]">
                <Spinner className="h-10 w-10 border-slate-200 border-t-[var(--app-header-bar-bg)]" />
            </div>
        )
    }

    if (phase === 'login') {
        return (
            <CaptureLoginGate
                appName={config?.appName}
                initialBaseUrl={baseUrl}
            />
        )
    }

    return children
}
