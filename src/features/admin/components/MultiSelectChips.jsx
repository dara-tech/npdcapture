import React, { useEffect, useMemo, useState } from 'react'
import i18n from '@dhis2/d2-i18n'
import { X } from 'lucide-react'
import { Input } from '../../../components/ui/input'
import { cn } from '../../../lib/utils'

/** Searchable multi-select as removable chips + option list. */
export const MultiSelectChips = ({
    options = [],
    value = [],
    onChange,
    onSearchChange,
    placeholder,
    className,
    disabled = false,
    invalid = false,
    /** When true, the option list only opens after the user types (avoids looking like a fixed selected list). */
    requireSearch = false,
    id,
    'aria-describedby': ariaDescribedBy,
}) => {
    const [search, setSearch] = useState('')

    useEffect(() => {
        onSearchChange?.(search)
    }, [search, onSearchChange])
    const selected = useMemo(() => new Set((value || []).map(String)), [value])

    const selectedOptions = useMemo(() => {
        const byValue = new Map(options.map((o) => [String(o.value), o]))
        return (value || []).map((id) => {
            const key = String(id)
            return byValue.get(key) || { value: key, label: key }
        })
    }, [options, value])

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (requireSearch && !q) return []
        return options.filter((o) => {
            if (selected.has(String(o.value))) return false
            if (!q) return !requireSearch
            const label = String(o.label || o.value).toLowerCase()
            return label.includes(q)
        })
    }, [options, search, selected, requireSearch])

    const toggle = (id) => {
        const key = String(id)
        if (disabled) return
        const current = value || []
        if (selected.has(key)) {
            onChange(current.filter((v) => String(v) !== key))
        } else {
            onChange([...current, id])
        }
    }

    return (
        <div className={cn('space-y-2', className)}>
            {selectedOptions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                    {selectedOptions.map((o) => (
                        <span
                            key={o.value}
                            className="inline-flex max-w-full items-center gap-1 rounded-md border border-app-tint-35 bg-app-tint-8 px-2 py-1 text-xs font-medium text-app-primary"
                        >
                            <span className="truncate">{o.label}</span>
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    toggle(o.value)
                                }}
                                className="shrink-0 rounded p-0.5 hover:bg-app-tint-15 disabled:opacity-40"
                                aria-label={i18n.t('Remove')}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    ))}
                </div>
            ) : null}
            <Input
                id={id}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder || i18n.t('Search to add…')}
                className={cn(
                    'capture-font h-9 text-sm',
                    invalid && 'border-red-400 bg-red-50/50 focus:border-red-500 focus:ring-red-200/80'
                )}
                disabled={disabled}
                aria-invalid={invalid || undefined}
                aria-describedby={ariaDescribedBy}
            />
            {filtered.length > 0 ? (
                <ul className="max-h-36 overflow-auto rounded-lg border border-slate-200/90 divide-y divide-slate-100 bg-white custom-scrollbar dark:border-[color:var(--app-border)] dark:divide-[color:var(--app-border)] dark:bg-zinc-950">
                    {filtered.slice(0, 40).map((o) => (
                        <li key={o.value}>
                            <button
                                type="button"
                                onClick={() => {
                                    toggle(o.value)
                                    setSearch('')
                                }}
                                className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-zinc-900"
                            >
                                {o.label}
                            </button>
                        </li>
                    ))}
                </ul>
            ) : search.trim() ? (
                <p className="text-xs text-slate-400">{i18n.t('No matches.')}</p>
            ) : null}
        </div>
    )
}
