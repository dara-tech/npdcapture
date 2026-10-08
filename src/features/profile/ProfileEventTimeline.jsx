import React from 'react'
import { ChevronDownIcon } from '@radix-ui/react-icons'
import { Inbox, Calendar, Edit3, CheckCircle2, Clock } from 'lucide-react'
import i18n from '@dhis2/d2-i18n'
import { Button } from '../../components/ui/button'
import { FORM } from '../../lib/formUi'
import { formatEventDataValueForDisplay } from '../../lib/eventDataValues'
import { cn } from '../../lib/utils'

export function ProfileEventTimeline({
    events = [],
    lastUpdatedEventId,
    expandedEventIds,
    onToggleExpand,
    onEditEvent,
    stagesMap = {},
    metadata,
    onAddRecord,
    hiddenDeIds = [],
}) {
    const hiddenDe = new Set(hiddenDeIds)

    if (!events.length) {
        return (
            <div className="flex flex-1 min-h-[360px] h-full w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200/90 bg-slate-50/60 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900/40 sm:p-12">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-slate-200/90 bg-white text-slate-400 shadow-2xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-500">
                    <Inbox className="h-6 w-6" strokeWidth={1.75} aria-hidden />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100">
                    {i18n.t('No records found for this stage')}
                </p>
                <p className={cn(FORM.pageSubtitle, 'mt-1 max-w-sm text-xs text-slate-500')}>
                    {i18n.t('Add an entry to start capturing data for this stage.')}
                </p>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-5 w-full max-w-xs text-xs font-semibold text-white bg-[var(--app-header-bar-bg)] hover:bg-[var(--app-header-bar-bg-hover)] border-none shadow-xs sm:w-auto cursor-pointer"
                    onClick={onAddRecord}
                >
                    {i18n.t('Add New Entry')}
                </Button>
            </div>
        )
    }

    const sorted = [...events].sort((a, b) => {
        if (a.event === lastUpdatedEventId) return -1
        if (b.event === lastUpdatedEventId) return 1
        const dateA = new Date(a.eventDate || a.occurredAt || 0)
        const dateB = new Date(b.eventDate || b.occurredAt || 0)
        return dateB - dateA
    })

    return (
        <div className="relative flex flex-col gap-3 pb-6 pt-2">
            {sorted.map((event, idx) => {
                const isFirst = idx === 0
                const isLast = idx === sorted.length - 1
                const isExpanded = expandedEventIds.has(event.event)
                const isNew = event.event === lastUpdatedEventId
                const isCompleted = String(event.status || '').toUpperCase() === 'COMPLETED'
                const dateStr = (event.eventDate || event.occurredAt || '').split('T')[0]
                const stageName = stagesMap[event.programStage] || i18n.t('Clinical Record')
                const validDataValues = event.dataValues?.filter((dv) => !hiddenDe.has(dv.dataElement)) || []

                return (
                    <article key={event.event} className="relative flex items-stretch gap-2.5 sm:gap-3">
                        {/* Unified Timeline Node & Line Column (100% Perfectly Centered) */}
                        <div className="relative hidden w-5 shrink-0 flex-col items-center sm:flex">
                            {/* Vertical Line */}
                            {sorted.length > 1 && (
                                <div
                                    className={cn(
                                        'absolute left-1/2 -translate-x-1/2 w-[2px] bg-slate-200/90 dark:bg-zinc-700/90',
                                        isFirst
                                            ? 'top-4 bottom-0'
                                            : isLast
                                              ? 'top-0 h-4'
                                              : 'top-0 bottom-0'
                                    )}
                                />
                            )}

                            {/* Node Dot */}
                            <div className="relative z-10 mt-3.5 flex h-3 w-3 items-center justify-center shrink-0">
                                {isNew ? (
                                    <>
                                        <div className="h-3 w-3 rounded-full bg-[var(--app-header-bar-bg)] ring-4 ring-white dark:ring-zinc-900" />
                                        <div className="absolute h-3 w-3 animate-ping rounded-full bg-[var(--app-header-bar-bg)] opacity-50" />
                                    </>
                                ) : (
                                    <div className="h-3 w-3 rounded-full bg-slate-300 ring-4 ring-white dark:bg-zinc-600 dark:ring-zinc-900" />
                                )}
                            </div>
                        </div>

                        {/* Event Card */}
                        <div className="flex min-w-0 flex-1 flex-col">
                            <div
                                onClick={() => onEditEvent(event.event)}
                                className="w-full cursor-pointer rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs transition-all duration-200 hover:border-[var(--app-header-bar-bg)] hover:bg-slate-50/50 hover:shadow-xs active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900/90 dark:hover:border-zinc-700"
                            >
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    {/* Left: Stage Name & Date Badge */}
                                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                                        <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 px-2.5 py-1 text-slate-800 dark:text-zinc-100 font-mono text-xs font-bold border border-slate-200/70 dark:border-zinc-700 shadow-2xs">
                                            <Calendar className="h-3.5 w-3.5 text-slate-500" />
                                            <span>{dateStr || i18n.t('No Date')}</span>
                                        </div>
                                        <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                                            {stageName}
                                        </span>
                                    </div>

                                    {/* Right: Status Badge & Actions */}
                                    <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                                        {/* Status Badge */}
                                        <span
                                            className={cn(
                                                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide border shadow-2xs',
                                                isCompleted
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                                    : 'bg-blue-50 text-[var(--app-header-bar-bg)] border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    'h-1.5 w-1.5 rounded-full',
                                                    isCompleted ? 'bg-emerald-500' : 'bg-[var(--app-header-bar-bg)] animate-pulse'
                                                )}
                                            />
                                            {isCompleted ? i18n.t('COMPLETED') : i18n.t('ACTIVE')}
                                        </span>

                                        {/* Collapse / Expand Toggle Button */}
                                        <button
                                            type="button"
                                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200/90 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 cursor-pointer"
                                            aria-expanded={isExpanded}
                                            aria-label={isExpanded ? i18n.t('Collapse') : i18n.t('Expand')}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onToggleExpand(event.event)
                                            }}
                                        >
                                            <ChevronDownIcon
                                                className={cn(
                                                    'h-3.5 w-3.5 transition-transform duration-200',
                                                    isExpanded && 'rotate-180'
                                                )}
                                            />
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded Key-Value Data List */}
                                {isExpanded ? (
                                    <div className="mt-3 overflow-hidden rounded-lg border border-slate-200/80 bg-slate-50/50 shadow-2xs dark:border-zinc-800 dark:bg-zinc-950/40">
                                        <dl className="divide-y divide-slate-200/60 dark:divide-zinc-800/80">
                                            {validDataValues.map((dv) => {
                                                const deMeta = metadata?.dataElements?.[dv.dataElement]
                                                const displayValue = formatEventDataValueForDisplay(
                                                    dv.value,
                                                    deMeta
                                                )
                                                return (
                                                    <div
                                                        key={dv.dataElement}
                                                        className="flex flex-col gap-1 px-3.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4 hover:bg-white/80 dark:hover:bg-zinc-900/60 transition-colors"
                                                    >
                                                        <dt className="min-w-0 text-xs font-medium text-slate-600 dark:text-zinc-400">
                                                            {deMeta?.displayName || deMeta?.name || dv.dataElement}
                                                        </dt>
                                                        <dd className="min-w-0 sm:text-right text-xs font-bold text-slate-900 dark:text-zinc-100">
                                                            {displayValue || (
                                                                <span className="font-normal text-slate-400 select-none">—</span>
                                                            )}
                                                        </dd>
                                                    </div>
                                                )
                                            })}
                                            {!validDataValues.length ? (
                                                <p className="px-4 py-6 text-center text-xs italic text-slate-400">
                                                    {i18n.t('No data values recorded')}
                                                </p>
                                            ) : null}
                                        </dl>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </article>
                )
            })}
        </div>
    )
}
