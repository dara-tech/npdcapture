import React, { useState, useMemo } from 'react'
import i18n from '@dhis2/d2-i18n'
import {
    X,
    Search,
    ChevronRight,
    User,
    Check,
    Calendar,
} from 'lucide-react'
import { cn } from '../../../lib/utils'
import { FORM } from '../../../lib/formUi'
import { parseStageDisplay, groupStagesForWorkflow } from '../lib/stageWorkflowGroups'

export function StageNavigationSidebar({
    isOpen = true,
    onClose,
    programStages = [],
    events = [],
    activeTab,
    onSelectStage,
    isDataEntryExperience = false,
}) {
    const [searchQuery, setSearchQuery] = useState('')

    const stageStatusMap = useMemo(() => {
        const map = new Map()
        for (const stage of programStages) {
            const stEvents = (events || []).filter((e) => (e.programStage || e.stage) === stage.id)
            const hasCompleted = stEvents.some(
                (e) => String(e.status || '').toUpperCase() === 'COMPLETED'
            )
            const hasActive = stEvents.some(
                (e) => String(e.status || '').toUpperCase() === 'ACTIVE'
            )
            const latestEvent = [...stEvents].sort((a, b) => {
                const ta = new Date(a.occurredAt || a.eventDate || 0).getTime()
                const tb = new Date(b.occurredAt || b.eventDate || 0).getTime()
                return tb - ta
            })[0]

            map.set(stage.id, {
                count: stEvents.length,
                status: hasCompleted ? 'COMPLETED' : hasActive ? 'ACTIVE' : 'EMPTY',
                lastDate: latestEvent?.occurredAt || latestEvent?.eventDate || null,
            })
        }
        return map
    }, [programStages, events])

    const completedCount = useMemo(() => {
        let c = 0
        for (const s of programStages) {
            if (stageStatusMap.get(s.id)?.status === 'COMPLETED') c += 1
        }
        return c
    }, [programStages, stageStatusMap])

    const filteredStages = useMemo(() => {
        if (!searchQuery.trim()) return programStages
        const q = searchQuery.toLowerCase()
        return programStages.filter(
            (s) =>
                (s.displayName || s.name || '').toLowerCase().includes(q) ||
                (s.id || '').toLowerCase().includes(q)
        )
    }, [programStages, searchQuery])

    const groupedStages = useMemo(() => {
        return groupStagesForWorkflow(filteredStages)
    }, [filteredStages])

    if (!isOpen) return null

    return (
        <>
            {/* Backdrop on laptop and tablet screens (< 2xl) so it acts as an overlay drawer without squishing the form */}
            <div
                className="fixed inset-0 bg-slate-900/25 backdrop-blur-[1px] z-40 2xl:hidden animate-in fade-in duration-200"
                onClick={onClose}
                aria-hidden="true"
            />

            <aside
                className={cn(
                    'flex flex-col h-full w-80 shrink-0 bg-white dark:bg-zinc-900 border-l border-slate-200/90 dark:border-zinc-800 select-none transition-all duration-200',
                    'fixed inset-y-0 right-0 z-50 shadow-2xl 2xl:shadow-none 2xl:relative 2xl:z-20 2xl:inset-auto'
                )}
            >
                {/* Standard DHIS2 Header */}
                <div className="flex items-center justify-between border-b border-slate-200/90 bg-slate-50/90 px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/90">
                <div className="flex items-center gap-2 min-w-0">
                    <h3 className={cn(FORM.sectionBarTitle, 'text-[13px] font-bold text-slate-800 dark:text-zinc-100')}>
                        {i18n.t('Clinical Stages')}
                    </h3>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 tabular-nums">
                        {completedCount}/{programStages.length}
                    </span>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    title={i18n.t('Close sidebar')}
                    aria-label={i18n.t('Close sidebar')}
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* Filter Input */}
            {programStages.length > 5 && (
                <div className="p-2.5 border-b border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={i18n.t('Filter stages...')}
                            className="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-md text-slate-900 dark:text-zinc-100 placeholder-slate-400 outline-none focus:border-[var(--app-header-bar-bg)] focus:ring-1 focus:ring-[var(--app-header-bar-bg)] transition-all"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Stage List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
                {/* Client Profile Option */}
                <button
                    type="button"
                    onClick={() => onSelectStage('PROGRAM')}
                    className={cn(
                        'w-full flex items-center justify-between px-3 py-2 rounded-md text-left transition-colors cursor-pointer',
                        activeTab === 'PROGRAM'
                            ? 'bg-[var(--app-header-bar-bg)] text-white font-semibold shadow-xs'
                            : 'bg-slate-50/60 dark:bg-zinc-800/60 border border-slate-200/70 dark:border-zinc-800 hover:bg-slate-100 text-slate-800 dark:text-zinc-200'
                    )}
                >
                    <div className="flex items-center gap-2.5 min-w-0">
                        <User className="h-4 w-4 shrink-0" />
                        <span className="text-[13px] font-medium truncate">{i18n.t('Client Profile')}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />
                </button>

                {/* Grouped Stages */}
                {groupedStages && groupedStages.length > 0 ? (
                    groupedStages.map((group) => (
                        <div key={group.id} className="pt-2">
                            <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 bg-slate-100/60 dark:bg-zinc-800/40 rounded-sm mb-1">
                                {group.nameKh || group.name}
                            </div>

                            <div className="space-y-1">
                                {group.stages.map((stage, sIdx) => {
                                    const stInfo = stageStatusMap.get(stage.id)
                                    const isActive = activeTab === stage.id
                                    const rawName = stage.displayName || stage.name
                                    const parsed = parseStageDisplay(rawName, sIdx + 1)
                                    const isCompleted = stInfo?.status === 'COMPLETED'
                                    const isProgress = stInfo?.status === 'ACTIVE'

                                    return (
                                        <button
                                            type="button"
                                            key={stage.id}
                                            onClick={() => onSelectStage(stage.id)}
                                            title={rawName}
                                            className={cn(
                                                'w-full flex items-start justify-between gap-2 px-2.5 py-2 rounded-md text-left transition-colors cursor-pointer border',
                                                isActive
                                                    ? 'border-[var(--app-header-bar-bg)] bg-[var(--app-header-bar-bg)] text-white shadow-xs'
                                                    : 'border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800/70 text-slate-800 dark:text-zinc-200'
                                            )}
                                        >
                                            <div className="flex items-start gap-2 min-w-0">
                                                {/* Number Badge */}
                                                <span
                                                    className={cn(
                                                        'h-5 min-w-[1.4rem] px-1 flex items-center justify-center rounded text-[11px] font-bold tabular-nums shrink-0 mt-0.5',
                                                        isActive
                                                            ? 'bg-white/20 text-white'
                                                            : isCompleted
                                                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300'
                                                              : isProgress
                                                                ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-300'
                                                                : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'
                                                    )}
                                                >
                                                    {parsed.number}
                                                </span>

                                                {/* Title & Meta */}
                                                <div className="min-w-0 flex-1">
                                                    <div
                                                        className={cn(
                                                            'text-[13px] font-medium leading-snug [overflow-wrap:anywhere]',
                                                            isActive
                                                                ? 'text-white'
                                                                : 'text-slate-800 dark:text-zinc-100'
                                                        )}
                                                    >
                                                        {parsed.title}
                                                    </div>

                                                    {parsed.meta && (
                                                        <div
                                                            className={cn(
                                                                'text-[11px] leading-none mt-1 font-normal',
                                                                isActive
                                                                    ? 'text-white/80'
                                                                    : 'text-slate-400 dark:text-zinc-500'
                                                            )}
                                                        >
                                                            {parsed.meta}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right Status Badge */}
                                            <div className="shrink-0 pt-0.5">
                                                {isCompleted ? (
                                                    <span
                                                        className={cn(
                                                            'inline-flex items-center gap-0.5 text-xs font-bold tabular-nums',
                                                            isActive ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'
                                                        )}
                                                    >
                                                        <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                                                        <span>{stInfo.count}</span>
                                                    </span>
                                                ) : isProgress ? (
                                                    <span
                                                        className={cn(
                                                            'inline-flex items-center text-xs font-bold tabular-nums',
                                                            isActive ? 'text-white' : 'text-amber-600 dark:text-amber-400'
                                                        )}
                                                    >
                                                        {stInfo.count}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="space-y-1">
                        {filteredStages.map((stage, sIdx) => {
                            const stInfo = stageStatusMap.get(stage.id)
                            const isActive = activeTab === stage.id
                            const rawName = stage.displayName || stage.name
                            const parsed = parseStageDisplay(rawName, sIdx + 1)
                            const isCompleted = stInfo?.status === 'COMPLETED'
                            const isProgress = stInfo?.status === 'ACTIVE'

                            return (
                                <button
                                    type="button"
                                    key={stage.id}
                                    onClick={() => onSelectStage(stage.id)}
                                    title={rawName}
                                    className={cn(
                                        'w-full flex items-start justify-between gap-2 px-2.5 py-2 rounded-md text-left transition-colors cursor-pointer border',
                                        isActive
                                            ? 'border-[var(--app-header-bar-bg)] bg-[var(--app-header-bar-bg)] text-white shadow-xs'
                                            : 'border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800/70 text-slate-800 dark:text-zinc-200'
                                    )}
                                >
                                    <div className="flex items-start gap-2 min-w-0">
                                        <span
                                            className={cn(
                                                'h-5 min-w-[1.4rem] px-1 flex items-center justify-center rounded text-[11px] font-bold tabular-nums shrink-0 mt-0.5',
                                                isActive
                                                    ? 'bg-white/20 text-white'
                                                    : isCompleted
                                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300'
                                                      : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'
                                            )}
                                        >
                                            {parsed.number}
                                        </span>

                                        <div className="min-w-0 flex-1">
                                            <div
                                                className={cn(
                                                    'text-[13px] font-medium leading-snug [overflow-wrap:anywhere]',
                                                    isActive
                                                        ? 'text-white'
                                                        : 'text-slate-800 dark:text-zinc-100'
                                                )}
                                            >
                                                {parsed.title}
                                            </div>
                                            {parsed.meta && (
                                                <div
                                                    className={cn(
                                                        'text-[11px] leading-none mt-1 font-normal',
                                                        isActive
                                                            ? 'text-white/80'
                                                            : 'text-slate-400 dark:text-zinc-500'
                                                    )}
                                                >
                                                    {parsed.meta}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {isCompleted && (
                                        <span
                                            className={cn(
                                                'inline-flex items-center gap-0.5 text-xs font-bold tabular-nums shrink-0 pt-0.5',
                                                isActive ? 'text-white' : 'text-emerald-600'
                                            )}
                                        >
                                            <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                                            <span>{stInfo.count}</span>
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>
        </aside>
        </>
    )
}
