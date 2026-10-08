import React, { useState, useEffect } from 'react'
import { AlertCircle, AlertTriangle, X } from 'lucide-react'
import i18n from '@dhis2/d2-i18n'
import { FORM } from '../../lib/formUi'

export function ProfileRuleAlerts({ errors = [], warnings = [] }) {
    const [dismissed, setDismissed] = useState(() => new Set())

    // Generate stable keys for tracking alerts
    const getAlertKey = (item, type, index) => `${type}-${item.fieldId || ''}-${item.text || ''}-${index}`

    const activeErrors = errors.map((r, i) => ({ ...r, _key: getAlertKey(r, 'e', i), _type: 'error' }))
    const activeWarnings = warnings.map((r, i) => ({ ...r, _key: getAlertKey(r, 'w', i), _type: 'warning' }))

    const visibleErrors = activeErrors.filter((e) => !dismissed.has(e._key))
    const visibleWarnings = activeWarnings.filter((w) => !dismissed.has(w._key))

    // Clear dismissed keys when rule alerts change/clear
    useEffect(() => {
        const currentKeys = new Set([
            ...activeErrors.map((e) => e._key),
            ...activeWarnings.map((w) => w._key),
        ])
        setDismissed((prev) => {
            if (!prev.size) return prev
            const next = new Set()
            for (const k of prev) {
                if (currentKeys.has(k)) {
                    next.add(k)
                }
            }
            return next.size === prev.size ? prev : next
        })
    }, [errors, warnings])

    if (!visibleErrors.length && !visibleWarnings.length) return null

    const handleDismiss = (key) => {
        setDismissed((prev) => new Set([...prev, key]))
    }

    return (
        <aside
            aria-label="Rule alerts"
            className="fixed top-12 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2.5 max-w-xl w-[calc(100vw-2rem)] pointer-events-none"
        >
            {visibleErrors.map((r) => (
                <div
                    key={r._key}
                    role="alert"
                    className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl shadow-slate-900/10 animate-in slide-in-from-top-4 fade-in duration-300 border bg-red-50/95 border-red-100 text-red-700 dark:bg-red-950/95 dark:border-red-900 dark:text-red-200 backdrop-blur-md w-full"
                >
                    <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 bg-red-100 text-red-600 dark:bg-red-900/60 dark:text-red-300">
                        <AlertCircle className="w-5 h-5" strokeWidth={2} aria-hidden />
                    </div>
                    <div className="flex flex-col justify-center flex-1 min-w-0 pr-2">
                        <span className={FORM.toastTitle}>{i18n.t('Error')}</span>
                        <span className={FORM.toastBody}>{r.text}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleDismiss(r._key)}
                        className="shrink-0 p-1 text-red-400 hover:text-red-700 dark:hover:text-red-200 rounded-lg transition-colors"
                        aria-label="Dismiss"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
            {visibleWarnings.map((r) => (
                <div
                    key={r._key}
                    role="status"
                    className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl shadow-slate-900/10 animate-in slide-in-from-top-4 fade-in duration-300 border bg-amber-50/95 border-amber-100 text-amber-900 dark:bg-amber-950/95 dark:border-amber-900 dark:text-amber-200 backdrop-blur-md w-full"
                >
                    <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0 bg-amber-100 text-amber-600 dark:bg-amber-900/60 dark:text-amber-300">
                        <AlertTriangle className="w-5 h-5" strokeWidth={2} aria-hidden />
                    </div>
                    <div className="flex flex-col justify-center flex-1 min-w-0 pr-2">
                        <span className={FORM.toastTitle}>{i18n.t('Warning')}</span>
                        <span className={FORM.toastBody}>{r.text}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleDismiss(r._key)}
                        className="shrink-0 p-1 text-amber-400 hover:text-amber-700 dark:hover:text-amber-200 rounded-lg transition-colors"
                        aria-label="Dismiss"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </aside>
    )
}
