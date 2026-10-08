import React, { useState } from 'react'
import i18n from '@dhis2/d2-i18n'
import { useConfig } from '@dhis2/app-runtime'
import { Check, Copy, Link2 } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { ADMIN } from '../adminUi'

export const buildApiUrl = (baseUrl, resource, id) => {
    if (!baseUrl || !resource) return ''
    const base = String(baseUrl).replace(/\/$/, '')
    const path = id ? `${resource.replace(/^\//, '')}/${id}` : resource.replace(/^\//, '')
    return `${base}/api/${path}`
}

/** Small control — IDs and full API URL hidden until opened. */
export const ApiRevealButton = ({ resource, id, className }) => {
    const { baseUrl } = useConfig()
    const [open, setOpen] = useState(false)
    const [copied, setCopied] = useState(false)

    const url = buildApiUrl(baseUrl, resource, id)
    if (!id) return null

    const copyUrl = async () => {
        try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            /* ignore */
        }
    }

    return (
        <div className={cn('relative inline-flex shrink-0', className)}>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation()
                    setOpen((v) => !v)
                }}
                className={cn(
                    ADMIN.chip,
                    'inline-flex h-6 items-center gap-1 rounded-md border border-slate-200/90 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 hover:border-app-tint-35 hover:text-app-primary dark:border-[color:var(--app-border)]'
                )}
                aria-expanded={open}
                title={i18n.t('Show API link')}
            >
                <Link2 className="h-3 w-3" aria-hidden />
                API
            </button>
            {open && (
                <>
                    <button
                        type="button"
                        className="fixed inset-0 z-40 cursor-default"
                        aria-label={i18n.t('Close')}
                        onClick={() => setOpen(false)}
                    />
                    <div className="absolute right-0 top-full z-50 mt-1 w-[min(100vw-2rem,18rem)] rounded-lg border border-slate-200/90 bg-white p-2.5 shadow-lg dark:border-[color:var(--app-border)] dark:bg-zinc-950 dark:shadow-xl">
                        <p className="mb-1.5 font-mono text-[10px] leading-snug text-slate-600 break-all dark:text-zinc-300">
                            {id}
                        </p>
                        {url ? (
                            <div className="flex items-start gap-1">
                                <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="min-w-0 flex-1 break-all font-mono text-[10px] leading-snug text-app-primary hover:underline"
                                >
                                    {url}
                                </a>
                                <button
                                    type="button"
                                    onClick={copyUrl}
                                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
                                    title={i18n.t('Copy API link')}
                                >
                                    {copied ? (
                                        <Check className="h-3 w-3 text-emerald-600" />
                                    ) : (
                                        <Copy className="h-3 w-3" />
                                    )}
                                </button>
                            </div>
                        ) : null}
                    </div>
                </>
            )}
        </div>
    )
}
