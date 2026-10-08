import React, { useMemo, useState } from 'react'
import i18n from '@dhis2/d2-i18n'
import { Spinner } from '../../components/ui/spinner'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { loginWithCredentials, persistBaseUrl, resolveBaseUrl } from '../../lib/captureAuth'
import { cn } from '../../lib/utils'

export function CaptureLoginGate({ appName, initialBaseUrl = '' }) {
    const staticServer = useMemo(() => resolveBaseUrl(), [])
    const showServerField = !staticServer

    const [server, setServer] = useState(staticServer || initialBaseUrl || '')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const onSubmit = async (e) => {
        e.preventDefault()
        setError('')
        const baseUrl = (staticServer || server).trim()
        if (!baseUrl) {
            setError(i18n.t('Enter the DHIS2 server URL'))
            return
        }
        if (!username.trim() || !password) {
            setError(i18n.t('Enter username and password'))
            return
        }
        setSubmitting(true)
        try {
            await persistBaseUrl(appName, baseUrl)
            await loginWithCredentials({
                baseUrl,
                username: username.trim(),
                password,
            })
            window.location.reload()
        } catch (err) {
            setError(err?.message || i18n.t('Could not sign in'))
            setSubmitting(false)
        }
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#f4f6f8] px-4 py-8">
            <div className="w-full max-w-md overflow-hidden rounded-md border border-slate-200/90 bg-white shadow-sm">
                <div className="border-b border-slate-100 bg-slate-50/90 px-5 py-4">
                    <h1 className="text-lg font-bold tracking-tight text-slate-900">
                        {i18n.t('NPD Capture')}
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        {i18n.t('Sign in with your DHIS2 account')}
                    </p>
                </div>

                <form onSubmit={onSubmit} className="space-y-4 px-5 py-5">
                    {error ? (
                        <p
                            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                            role="alert"
                        >
                            {error}
                        </p>
                    ) : null}

                    {showServerField ? (
                        <label className="block space-y-1.5">
                            <span className="text-sm font-medium text-slate-600">
                                {i18n.t('Server')}
                            </span>
                            <Input
                                value={server}
                                onChange={(e) => setServer(e.target.value)}
                                placeholder="https://your-dhis2.org"
                                autoComplete="url"
                                className="h-10 text-sm"
                            />
                        </label>
                    ) : null}

                    <label className="block space-y-1.5">
                        <span className="text-sm font-medium text-slate-600">
                            {i18n.t('Username')}
                        </span>
                        <Input
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            autoComplete="username"
                            className="h-10 text-sm"
                        />
                    </label>

                    <label className="block space-y-1.5">
                        <span className="text-sm font-medium text-slate-600">
                            {i18n.t('Password')}
                        </span>
                        <Input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            className="h-10 text-sm"
                        />
                    </label>

                    <Button
                        type="submit"
                        disabled={submitting}
                        className={cn(
                            'h-10 w-full rounded-md text-sm font-semibold text-white',
                            'bg-[var(--app-header-bar-bg)] hover:bg-[var(--app-header-bar-bg-hover)]'
                        )}
                    >
                        {submitting ? (
                            <span className="inline-flex items-center gap-2">
                                <Spinner className="h-4 w-4 border-white/30 border-t-white" />
                                {i18n.t('Signing in...')}
                            </span>
                        ) : (
                            i18n.t('Sign in')
                        )}
                    </Button>
                </form>
            </div>
        </div>
    )
}
