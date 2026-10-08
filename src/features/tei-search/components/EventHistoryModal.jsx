import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import i18n from '@dhis2/d2-i18n'
import { ClockIcon, Cross2Icon, ChevronDownIcon, ExternalLinkIcon } from '@radix-ui/react-icons'
import { ShadowIcon } from '@radix-ui/react-icons'
import { Button } from '../../../components/ui/button'
import { cn } from '../../../lib/utils'
import { getAttributeValue, eventStatusLabel } from '../helpers'
import { formatEventDataValueForDisplay } from '../../../lib/eventDataValues'

/** Single scale: labels vs values differ by weight/color only (both text-sm). */
const MODAL = {
    title: 'text-base font-semibold leading-snug tracking-tight app-text-title md:text-lg',
    tab: (active) =>
        cn(
            'shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium leading-none transition-all',
            active
                ? 'border-[var(--app-header-bar-bg)] bg-[var(--app-header-bar-bg)] text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-[color:var(--app-border)] dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
        ),
    rowLabel:
        'text-sm font-medium leading-snug text-slate-600 dark:text-zinc-400',
    rowValue:
        'text-sm font-normal leading-snug text-slate-900 dark:text-zinc-100',
    rowValueMuted:
        'text-sm font-normal leading-snug text-slate-400 dark:text-zinc-500',
    eventTitle:
        'text-sm font-semibold leading-snug text-slate-900 dark:text-zinc-100',
    eventMeta:
        'text-sm font-normal leading-snug text-slate-500 dark:text-zinc-400',
    statusValue: (completed) =>
        cn(
            'text-sm font-normal leading-snug',
            completed
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-[var(--app-header-bar-bg)]'
        ),
    footerLink: 'text-sm font-medium leading-none text-slate-600 dark:text-zinc-300',
    footerBtn: 'text-sm font-semibold leading-none',
}

export const EventHistoryModal = ({
    tei,
    onClose,
    onOpenDetail,
    stagesMap,
    dataElementsMap,
    dataElementMetaMap = {},
    visibleAttributes,
}) => {
    const [activeStageId, setActiveStageId] = useState('ALL')
    const [expandedEventIds, setExpandedEventIds] = useState(new Set())

    // Initialize expanded state on first render
    React.useEffect(() => {
        if (tei && tei.enrollments) {
            const allEvents = tei.enrollments.flatMap(e => e.events || [])
            if (allEvents.length > 0) {
                const sorted = [...allEvents].sort((a, b) => {
                    const dateA = new Date(a.eventDate || a.occurredAt || a.createdAt || 0)
                    const dateB = new Date(b.eventDate || b.occurredAt || b.createdAt || 0)
                    return dateB - dateA
                })
                setExpandedEventIds(new Set([sorted[0].event]))
            }
        }
    }, [tei])

    if (typeof document === 'undefined' || !tei) return null

    const toggleEventExpansion = (eventId) => {
        setExpandedEventIds(prev => {
            const next = new Set(prev)
            if (next.has(eventId)) next.delete(eventId)
            else next.add(eventId)
            return next
        })
    }

    const allEvents = tei.enrollments?.flatMap(enrollment => enrollment.events) || []
    const uniqueStages = Object.entries(stagesMap).map(([id, name]) => ({ id, name }))
    const filteredEvents = activeStageId === 'ALL'
        ? allEvents
        : allEvents.filter(e => e.programStage === activeStageId)

    return createPortal(
        <div
            className="modal-backdrop fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="modal-panel w-full max-w-3xl rounded-3xl border border-white/20 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                <div className="relative border-b border-slate-100 bg-slate-50/50 px-6 pt-6 pb-4 dark:border-[color:var(--app-border)] dark:bg-zinc-900/50">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[var(--app-header-bar-bg)] text-white shadow-lg shadow-[0_4px_12px_rgba(44,102,147,0.3)]">
                                <ClockIcon className="w-3.5 h-3.5" />
                            </div>
                            <h3 className={MODAL.title}>
                                {i18n.t('Event History')}
                            </h3>
                        </div>

                        <button
                            onClick={onClose}
                            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all font-bold"
                        >
                            <Cross2Icon className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Stage Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-3 pl-10 custom-scrollbar-hide">
                        <button
                            type="button"
                            onClick={() => setActiveStageId('PROFILE')}
                            className={MODAL.tab(activeStageId === 'PROFILE')}
                        >
                            {i18n.t('Profile')}
                        </button>
                        {uniqueStages.map((stage) => (
                            <button
                                key={stage.id}
                                type="button"
                                onClick={() => setActiveStageId(stage.id)}
                                className={MODAL.tab(activeStageId === stage.id)}
                            >
                                {stage.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="px-6 pb-6 flex-1 overflow-hidden flex flex-col">
                    <div className="overflow-y-auto pr-2 custom-scrollbar flex-1">

                        {/* Profile Tab */}
                        {activeStageId === 'PROFILE' && (
                            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm dark:border-[color:var(--app-border)] dark:bg-zinc-950">
                                <div className="flex-1 overflow-auto">
                                    <div className="min-w-full inline-block align-middle">
                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[800px] border-collapse text-left text-sm md:min-w-0">
                                                <tbody>
                                                    {visibleAttributes.map((attr) => (
                                                        <tr key={attr.id} className="border-b border-slate-50 last:border-0 transition-colors hover:bg-slate-50/60 dark:border-[color:var(--app-border)] dark:hover:bg-zinc-900/60">
                                                            <td className={cn('w-1/3 px-4 py-2.5 align-top', MODAL.rowLabel)}>
                                                                {attr.name || attr.id}
                                                            </td>
                                                            <td className={cn('w-2/3 px-4 py-2.5 text-right align-top', MODAL.rowValue)}>
                                                                {getAttributeValue(tei, attr.id) || (
                                                                    <span className={MODAL.rowValueMuted}>—</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Events Timeline */}
                        {activeStageId !== 'PROFILE' && (
                            <div className="relative flex flex-col gap-1 pt-2 pb-6 pl-2">
                                <div className="absolute top-8 bottom-8 left-[18.5px] w-[2px] bg-slate-100 rounded-full" />
                                {filteredEvents.sort((a, b) => {
                                    const dateA = new Date(a.eventDate || a.occurredAt || a.createdAt || 0)
                                    const dateB = new Date(b.eventDate || b.occurredAt || b.createdAt || 0)
                                    return dateB - dateA
                                }).map((event) => {
                                    const isExpanded = expandedEventIds.has(event.event)
                                    const isCompleted = event.status === 'COMPLETED'
                                    return (
                                        <div key={event.event} className="relative flex items-start gap-8 py-3 group">
                                            {/* Timeline Dot */}
                                            <div className="relative z-10 flex items-center justify-center shrink-0 w-[11px] h-[11px] rounded-full mt-3.5 ml-[5px]">
                                                <div className="w-[11px] h-[11px] bg-slate-200 group-hover:bg-[rgba(44,102,147,0.55)] rounded-full ring-4 ring-white shadow-[0_0_0_8px_rgba(255,255,255,1)] transition-colors" />
                                            </div>

                                            {/* Row Content */}
                                            <div className="flex-1 flex flex-col group/card min-w-0 pr-2">
                                                <div className="flex-1 cursor-pointer flex items-center justify-between border border-transparent hover:border-slate-200 hover:bg-slate-50 hover:shadow-sm px-4 py-3 rounded-2xl transition-all duration-200 min-w-0" onClick={() => toggleEventExpansion(event.event)}>
                                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center w-full min-w-0">
                                                        {/* Stage and Date Column */}
                                                        <div className="md:col-span-6 lg:col-span-7 flex min-w-0 flex-col gap-0.5 pr-6">
                                                            <span className={cn(MODAL.eventTitle, 'truncate')}>
                                                                {stagesMap[event.programStage] || i18n.t('Screening')}
                                                            </span>
                                                            <span className={cn(MODAL.eventMeta, 'truncate')}>
                                                                {(event.eventDate || event.occurredAt || event.createdAt || event.updatedAt || i18n.t('No date')).split('T')[0]}
                                                            </span>
                                                        </div>

                                                        {/* Status Column */}
                                                        <div className="md:col-span-6 lg:col-span-5 flex h-10 items-center justify-between pl-2">
                                                            <div className="flex min-w-0 flex-col gap-0.5">
                                                                <span className={MODAL.rowLabel}>
                                                                    {i18n.t('ស្ថានភាព')}
                                                                </span>
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-[var(--app-header-bar-bg)]'}`} />
                                                                    <span className={MODAL.statusValue(isCompleted)}>
                                                                        {eventStatusLabel(event.status)}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center justify-end gap-3 flex-1 border-none">
                                                                <button
                                                                    className="flex items-center justify-center w-8 h-8 rounded-full bg-white border border-slate-100 text-[var(--app-header-bar-bg)] hover:bg-[rgba(44,102,147,0.08)] hover:border-[rgba(44,102,147,0.35)] hover:text-[var(--app-header-bar-bg-hover)] transition-all focus:outline-none shadow-sm hover:scale-105"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        toggleEventExpansion(event.event)
                                                                    }}
                                                                >
                                                                    <ChevronDownIcon className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Expanded Content */}
                                                {isExpanded && (
                                                    <div className="mb-3 mt-1 w-full overflow-hidden rounded-xl border border-slate-100 bg-white dark:border-[color:var(--app-border)] dark:bg-zinc-950" onClick={e => e.stopPropagation()}>
                                                        <table className="min-w-full text-sm">
                                                            <tbody>
                                                                {event.dataValues?.map((dv) => {
                                                                    const deMeta =
                                                                        dataElementMetaMap[dv.dataElement]
                                                                    const displayValue = formatEventDataValueForDisplay(
                                                                        dv.value,
                                                                        deMeta
                                                                    )
                                                                    return (
                                                                    <tr key={dv.dataElement} className="border-b border-slate-50 last:border-0 transition-colors hover:bg-slate-50/60 dark:border-[color:var(--app-border)] dark:hover:bg-zinc-900/60">
                                                                        <td className={cn('w-1/2 px-4 py-2.5 align-top', MODAL.rowLabel)}>
                                                                            {dataElementsMap[dv.dataElement] || dv.dataElement}
                                                                        </td>
                                                                        <td className={cn('w-1/2 px-4 py-2.5 text-right align-top', MODAL.rowValue)}>
                                                                            {displayValue ? (
                                                                                displayValue
                                                                            ) : (
                                                                                <span className={MODAL.rowValueMuted}>—</span>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                    )
                                                                })}
                                                                {!event.dataValues?.length && (
                                                                    <tr>
                                                                        <td colSpan={2} className={cn('px-4 py-6 text-center italic', MODAL.rowValueMuted)}>
                                                                            {i18n.t('No data values recorded')}
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                                {(!tei.enrollments?.some(e => e.events?.length)) && (
                                    <div className="py-12 flex flex-col items-center opacity-40">
                                        <ShadowIcon className="w-10 h-10 mb-3" />
                                        <p className={cn(MODAL.rowValueMuted, 'italic')}>{i18n.t('No events found.')}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-[color:var(--app-border)] dark:bg-zinc-900/50">
                    <Button
                        type="button"
                        variant="ghost"
                        className={cn('flex h-9 items-center gap-2 px-3 hover:text-[var(--app-header-bar-bg)]', MODAL.footerLink)}
                        onClick={() => {
                            onOpenDetail(tei)
                            onClose()
                        }}
                    >
                        <ExternalLinkIcon className="h-4 w-4" />
                        {i18n.t('View Full Profile')}
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        className={cn('h-9 rounded-lg bg-[var(--app-header-bar-bg)] px-5 text-white shadow-sm hover:bg-[var(--app-header-bar-bg-hover)]', MODAL.footerBtn)}
                        onClick={onClose}
                    >
                        {i18n.t('Close History')}
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    )
}
