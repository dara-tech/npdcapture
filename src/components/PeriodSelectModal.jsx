import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import i18n from '@dhis2/d2-i18n'
import {
    ChevronLeftIcon,
    ChevronRightIcon,
    CalendarIcon,
    Cross2Icon,
    ChevronDownIcon,
    CheckIcon,
} from '@radix-ui/react-icons'
import { cn } from '../lib/utils'
import {
    PERIOD_KIND,
    currentYear,
    getPeriodByKey,
    isPeriodDisabled,
    listAllYearPeriods,
    listBrowseYears,
    periodsForYear,
    resolvePeriodKeys,
} from '../utils/visualizePeriods'

const CUSTOM_KIND = 'custom'

function formatPeriodSummary(periodKeys) {
    if (!periodKeys?.length) return i18n.t('កាលបរិច្ឆេទ')
    const labels = resolvePeriodKeys(periodKeys).map((p) => p.label)
    if (!labels.length) return i18n.t('កាលបរិច្ឆេទ')
    if (labels.length === 1) return labels[0]
    if (labels.length === 2) return labels.join(', ')
    return `${labels[0]}, ${labels[1]} +${labels.length - 2}`
}

function formatCustomSummary(customValue) {
    if (!customValue?.startDate || !customValue?.endDate) return null
    return `${customValue.startDate} → ${customValue.endDate}`
}

function todayIso() {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

export function PeriodSelectModal({
    value = [],
    onChange,
    disabled = false,
    className = '',
    showLabel = false,
    singleSelect = true,
    customTrigger = null,
    allowCustomRange = true,
    onCustomRange,
    customValue = null,
    buttonClassName = '',
    allowedPeriodKinds = null,
    isEventView = false,
    onToggleEventView = null,
}) {
    const browseYears = useMemo(() => listBrowseYears(12), [])
    const minYear = browseYears[browseYears.length - 1] ?? currentYear() - 11
    const maxYear = browseYears[0] ?? currentYear()

    const defaultKind = useMemo(() => {
        if (allowedPeriodKinds && allowedPeriodKinds.length > 0) {
            return allowedPeriodKinds.includes(PERIOD_KIND.month)
                ? PERIOD_KIND.month
                : allowedPeriodKinds[0]
        }
        return PERIOD_KIND.quarter
    }, [allowedPeriodKinds])

    const [open, setOpen] = useState(false)
    const [draftKeys, setDraftKeys] = useState(value)
    const [draftEventView, setDraftEventView] = useState(Boolean(isEventView))
    const [browseYear, setBrowseYear] = useState(currentYear())
    const [periodKind, setPeriodKind] = useState(defaultKind)
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')

    const customSummary = useMemo(() => formatCustomSummary(customValue), [customValue])
    const summary = useMemo(
        () => customSummary || formatPeriodSummary(value),
        [customSummary, value]
    )
    const draftCustomSummary = useMemo(
        () => (customStart && customEnd ? `${customStart} → ${customEnd}` : i18n.t('ជ្រើសរើសកាលបរិច្ឆេទ')),
        [customStart, customEnd]
    )
    const draftSummary = useMemo(
        () => (periodKind === CUSTOM_KIND ? draftCustomSummary : formatPeriodSummary(draftKeys)),
        [periodKind, draftCustomSummary, draftKeys]
    )

    const customValid = Boolean(customStart && customEnd && customStart <= customEnd)

    const allYearPeriods = useMemo(() => listAllYearPeriods(12), [])
    const viewPeriods = useMemo(() => {
        if (periodKind === PERIOD_KIND.year) return allYearPeriods
        if (periodKind === CUSTOM_KIND) return []
        return periodsForYear(browseYear, periodKind)
    }, [periodKind, browseYear, allYearPeriods])

    const valueKey = useMemo(() => {
        if (Array.isArray(value)) return value.join(',')
        return String(value || '')
    }, [value])

    useEffect(() => {
        if (!open) {
            setDraftKeys((prev) => {
                const prevKey = Array.isArray(prev) ? prev.join(',') : String(prev || '')
                if (prevKey === valueKey) return prev
                return Array.isArray(value) ? value : []
            })
        }
    }, [valueKey, open, value])

    useEffect(() => {
        if (!open) return undefined
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = prev
        }
    }, [open])

    const openModal = (e) => {
        e?.preventDefault()
        if (disabled) return
        setDraftKeys(value)
        setDraftEventView(Boolean(isEventView))
        if (customValue?.startDate && customValue?.endDate) {
            setCustomStart(customValue.startDate)
            setCustomEnd(customValue.endDate)
            setPeriodKind(CUSTOM_KIND)
            setBrowseYear(Number(String(customValue.startDate).slice(0, 4)) || currentYear())
        } else {
            const first = value[0] ? getPeriodByKey(value[0]) : null
            setBrowseYear(first?.year ?? currentYear())
            const targetKind =
                first?.kind && (!allowedPeriodKinds || allowedPeriodKinds.includes(first.kind))
                    ? first.kind
                    : defaultKind
            setPeriodKind(targetKind)
            const today = todayIso()
            setCustomStart(first?.startDate || today)
            setCustomEnd(first?.endDate || today)
        }
        setOpen(true)
    }

    const toggleKey = (key) => {
        if (singleSelect) {
            setDraftKeys([key])
        } else {
            setDraftKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
        }
    }

    const selectAllInView = () => {
        const keys = viewPeriods.filter((p) => !isPeriodDisabled(p)).map((p) => p.key)
        setDraftKeys((prev) => [...new Set([...prev, ...keys])])
    }

    const clearInView = () => {
        const viewKeySet = new Set(viewPeriods.map((p) => p.key))
        setDraftKeys((prev) => prev.filter((k) => !viewKeySet.has(k)))
    }

    const applySelection = () => {
        if (onToggleEventView && draftEventView !== isEventView) {
            onToggleEventView(draftEventView)
        }
        if (periodKind === CUSTOM_KIND) {
            if (!customValid) return
            onCustomRange?.({ startDate: customStart, endDate: customEnd })
            setOpen(false)
            return
        }
        if (!draftKeys.length) return
        onChange?.(draftKeys)
        setOpen(false)
    }

    const canApply = periodKind === CUSTOM_KIND ? customValid : draftKeys.length > 0

    const prevYear = () => setBrowseYear((y) => Math.max(minYear, y - 1))
    const nextYear = () => setBrowseYear((y) => Math.min(maxYear, y + 1))

    const allKindTabs = [
        { id: PERIOD_KIND.quarter, label: i18n.t('ត្រីមាស') },
        { id: PERIOD_KIND.month, label: i18n.t('ខែ') },
        { id: PERIOD_KIND.year, label: i18n.t('ឆ្នាំ') },
        ...(allowCustomRange || (allowedPeriodKinds && allowedPeriodKinds.includes(CUSTOM_KIND))
            ? [{ id: CUSTOM_KIND, label: i18n.t('កំណត់កាលបរិច្ឆេទ') }]
            : []),
    ]

    const kindTabs = useMemo(() => {
        if (!allowedPeriodKinds || !allowedPeriodKinds.length) return allKindTabs
        return allKindTabs.filter((tab) => allowedPeriodKinds.includes(tab.id))
    }, [allKindTabs, allowedPeriodKinds])

    const showYearNav = periodKind !== PERIOD_KIND.year && periodKind !== CUSTOM_KIND

    const isIconOnly = Boolean(
        buttonClassName &&
            buttonClassName.includes('w-8') &&
            buttonClassName.includes('px-0')
    )

    return (
        <>
            {customTrigger ? (
                <div onClick={openModal} className={className} role="button" tabIndex={0}>
                    {customTrigger}
                </div>
            ) : (
                <div className={cn('grid', showLabel ? 'gap-1.5' : 'gap-0', className)}>
                    {showLabel ? (
                        <span className="text-[11px] font-medium leading-none text-slate-500 dark:text-zinc-400">
                            {i18n.t('ជ្រើសរើសកាលបរិច្ឆេទ')}
                        </span>
                    ) : null}
                    <button
                        type="button"
                        onClick={openModal}
                        disabled={disabled}
                        title={summary}
                        className={cn(
                            'app-filter-control flex h-8 min-h-8 items-center justify-between rounded-md border border-[color:var(--app-border)] bg-white px-2.5 py-1 text-[13px] font-normal app-text-title transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-black',
                            buttonClassName,
                            disabled && 'cursor-not-allowed opacity-30 grayscale'
                        )}
                    >
                        <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate pr-0 md:pr-2 text-[13px] font-normal app-text-title">
                            <CalendarIcon className="h-4 w-4 shrink-0 text-slate-400 dark:text-zinc-500" aria-hidden />
                            <span className={cn('truncate', isIconOnly ? 'hidden md:inline' : 'inline')}>
                                {summary}
                            </span>
                        </span>
                        <ChevronDownIcon
                            className={cn(
                                'h-4 w-4 shrink-0 text-slate-400 dark:text-zinc-500',
                                isIconOnly ? 'hidden md:inline' : 'inline'
                            )}
                            aria-hidden
                        />
                    </button>
                </div>
            )}

            {open &&
                typeof document !== 'undefined' &&
                createPortal(
                    <div
                        className="modal-backdrop fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[4px]"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="period-select-modal-title"
                        onClick={() => setOpen(false)}
                    >
                        <div
                            className="modal-panel flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-3.5 dark:border-zinc-800 dark:bg-zinc-900/80">
                                <div className="flex items-center gap-2.5">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--app-header-bar-bg)] text-white shadow-sm">
                                        <CalendarIcon className="h-5 w-5" aria-hidden />
                                    </div>
                                    <div>
                                        <div id="period-select-modal-title" className="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-100">
                                            {i18n.t('ជ្រើសរើសកាលបរិច្ឆេទ (Period)')}
                                        </div>
                                        <div className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                                            {allowedPeriodKinds &&
                                            !allowedPeriodKinds.includes(PERIOD_KIND.quarter) &&
                                            !allowedPeriodKinds.includes(PERIOD_KIND.year)
                                                ? i18n.t('ជ្រើសរើសខែ ឬកំណត់ចន្លោះកាលបរិច្ឆេទ')
                                                : i18n.t('ជ្រើសរើសត្រីមាស ខែ ឆ្នាំ ឬកំណត់ចន្លោះថ្ងៃកាលបរិច្ឆេទ')}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                                    aria-label={i18n.t('Close')}
                                >
                                    <Cross2Icon className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
                                {/* Kind Tabs — separate standalone pills */}
                                <div className="mb-4 flex flex-wrap items-center gap-2">
                                    {kindTabs.map((tab) => {
                                        const active = periodKind === tab.id
                                        return (
                                            <button
                                                key={tab.id}
                                                type="button"
                                                onClick={() => setPeriodKind(tab.id)}
                                                className={cn(
                                                    'inline-flex h-8 items-center justify-center rounded-lg border px-3 py-1 text-[13px] font-medium transition-all',
                                                    active
                                                        ? 'border-[var(--app-header-bar-bg)] bg-[var(--app-header-bar-bg)] text-white shadow-sm'
                                                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-900'
                                                )}
                                            >
                                                {tab.label}
                                            </button>
                                        )
                                    })}
                                </div>

                                {/* Year Navigation */}
                                {showYearNav ? (
                                    <div className="mb-4 flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/60 p-2 dark:border-zinc-800 dark:bg-zinc-950/40">
                                        <button
                                            type="button"
                                            onClick={prevYear}
                                            disabled={browseYear <= minYear}
                                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-none hover:bg-slate-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                            aria-label={i18n.t('Previous Year')}
                                        >
                                            <ChevronLeftIcon className="h-4 w-4" />
                                        </button>
                                        <div className="text-center">
                                            <div className="text-base font-bold tabular-nums text-slate-900 dark:text-zinc-100">
                                                {browseYear}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={nextYear}
                                            disabled={browseYear >= maxYear}
                                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-none hover:bg-slate-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                            aria-label={i18n.t('Next Year')}
                                        >
                                            <ChevronRightIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                ) : null}

                                {/* Select All / Clear (if multi-select) */}
                                {!singleSelect && periodKind !== CUSTOM_KIND ? (
                                    <div className="mb-3 flex justify-end gap-2 text-xs">
                                        <button
                                            type="button"
                                            onClick={selectAllInView}
                                            className="text-[var(--app-header-bar-bg)] font-medium hover:underline"
                                        >
                                            {i18n.t('ជ្រើសរើសទាំងអស់')}
                                        </button>
                                        <span className="text-slate-300">|</span>
                                        <button
                                            type="button"
                                            onClick={clearInView}
                                            className="text-slate-500 hover:underline dark:text-zinc-400"
                                        >
                                            {i18n.t('សម្អាត')}
                                        </button>
                                    </div>
                                ) : null}

                                {/* Custom Date Range */}
                                {periodKind === CUSTOM_KIND ? (
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <label className="grid gap-1.5">
                                            <span className="text-[12px] font-medium text-slate-600 dark:text-zinc-400">
                                                {i18n.t('ថ្ងៃចាប់ផ្តើម (Start Date)')}
                                            </span>
                                            <input
                                                type="date"
                                                value={customStart}
                                                max={customEnd || undefined}
                                                onChange={(e) => setCustomStart(e.target.value)}
                                                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-[var(--app-header-bar-bg)] focus:ring-1 focus:ring-[var(--app-header-bar-bg)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                                            />
                                        </label>
                                        <label className="grid gap-1.5">
                                            <span className="text-[12px] font-medium text-slate-600 dark:text-zinc-400">
                                                {i18n.t('ថ្ងៃបញ្ចប់ (End Date)')}
                                            </span>
                                            <input
                                                type="date"
                                                value={customEnd}
                                                min={customStart || undefined}
                                                onChange={(e) => setCustomEnd(e.target.value)}
                                                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-[var(--app-header-bar-bg)] focus:ring-1 focus:ring-[var(--app-header-bar-bg)] dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                                            />
                                        </label>
                                        {customStart && customEnd && !customValid ? (
                                            <p className="sm:col-span-2 text-xs text-rose-500">
                                                {i18n.t('ថ្ងៃចាប់ផ្តើមត្រូវតូចជាង ឬស្មើថ្ងៃបញ្ចប់')}
                                            </p>
                                        ) : null}
                                    </div>
                                ) : null}

                                {/* Quarters grid */}
                                {periodKind === PERIOD_KIND.quarter ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        {viewPeriods.map((p) => {
                                            const active = draftKeys.includes(p.key)
                                            const off = isPeriodDisabled(p)
                                            return (
                                                <PeriodChip
                                                    key={p.key}
                                                    period={p}
                                                    active={active}
                                                    disabled={off}
                                                    onToggle={() => !off && toggleKey(p.key)}
                                                    large
                                                />
                                            )
                                        })}
                                    </div>
                                ) : null}

                                {/* Months grid */}
                                {periodKind === PERIOD_KIND.month ? (
                                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                        {viewPeriods.map((p) => {
                                            const active = draftKeys.includes(p.key)
                                            const off = isPeriodDisabled(p)
                                            return (
                                                <PeriodChip
                                                    key={p.key}
                                                    period={p}
                                                    active={active}
                                                    disabled={off}
                                                    onToggle={() => !off && toggleKey(p.key)}
                                                />
                                            )
                                        })}
                                    </div>
                                ) : null}

                                {/* Years grid */}
                                {periodKind === PERIOD_KIND.year ? (
                                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                                        {viewPeriods.map((p) => {
                                            const active = draftKeys.includes(p.key)
                                            const off = isPeriodDisabled(p)
                                            return (
                                                <PeriodChip
                                                    key={p.key}
                                                    period={p}
                                                    active={active}
                                                    disabled={off}
                                                    onToggle={() => !off && toggleKey(p.key)}
                                                />
                                            )
                                        })}
                                    </div>
                                ) : null}
                            </div>

                            {/* Modal Footer */}
                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-3.5 dark:border-zinc-800 dark:bg-zinc-900">
                                <div className="flex items-center">
                                    {onToggleEventView ? (
                                        <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-slate-700 dark:text-zinc-300">
                                            <input
                                                type="checkbox"
                                                checked={draftEventView}
                                                onChange={(e) => setDraftEventView(e.target.checked)}
                                                className="sr-only"
                                            />
                                            <span
                                                className={cn(
                                                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all',
                                                    draftEventView
                                                        ? 'border-blue-600 bg-blue-600 text-white'
                                                        : 'border-slate-300 bg-white hover:border-slate-400 dark:border-zinc-700 dark:bg-zinc-800'
                                                )}
                                            >
                                                {draftEventView ? <CheckIcon className="h-3 w-3" /> : null}
                                            </span>
                                            <span>{i18n.t('បង្ហាញតាមព្រឹត្តិការណ៍ (Event view)')}</span>
                                        </label>
                                    ) : null}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        className="h-8 rounded-md border border-slate-200 bg-white px-4 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 transition-colors"
                                        onClick={() => setOpen(false)}
                                    >
                                        {i18n.t('បោះបង់')}
                                    </button>
                                    <button
                                        type="button"
                                        className="h-8 rounded-md bg-[var(--app-header-bar-bg)] px-5 text-xs font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-40 transition-colors"
                                        onClick={applySelection}
                                        disabled={!canApply}
                                    >
                                        {i18n.t('យល់ព្រម')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </>
    )
}

function PeriodChip({ period, active, disabled, onToggle, large = false }) {
    return (
        <button
            type="button"
            className={cn(
                'flex items-center gap-2 rounded-lg border px-3 text-left transition-all',
                large ? 'min-h-10 py-1' : 'min-h-9 py-1',
                active && !disabled && 'border-[var(--app-header-bar-bg)] bg-[rgba(44,102,147,0.08)] text-[var(--app-header-bar-bg)] font-semibold',
                !active && !disabled && 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800',
                disabled && 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400 opacity-40 dark:border-zinc-900 dark:bg-zinc-900'
            )}
            onClick={onToggle}
            disabled={disabled}
            title={disabled ? undefined : `${period.startDate} – ${period.endDate}`}
        >
            <span
                className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                    active ? 'border-[var(--app-header-bar-bg)] bg-[var(--app-header-bar-bg)] text-white' : 'border-slate-300 dark:border-zinc-700'
                )}
            >
                {active ? <CheckIcon className="h-3 w-3" strokeWidth={3} /> : null}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12px]">
                {period.label}
            </span>
        </button>
    )
}

export default PeriodSelectModal
