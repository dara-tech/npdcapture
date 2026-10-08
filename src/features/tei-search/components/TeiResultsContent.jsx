import React, { useEffect, useRef, useState } from 'react'
import i18n from '@dhis2/d2-i18n'
import {
    CaretDownIcon,
    CaretUpIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ClockIcon,
    ShadowIcon,
    PersonIcon,
} from '@radix-ui/react-icons'
import { PaginationNav } from '../../../components/ui/PaginationNav'
import { Select } from '../../../components/ui/select'
import { TeiListEmptyState } from './TeiListEmptyState'
import { TeiListLoadingOverlay } from './TeiListLoadingOverlay'
import { MixedScriptText } from '../../../components/ui/MixedScriptText'
import { cn } from '../../../lib/utils'
import {
    getColumnHeaderLabel,
    getEventClientLabel,
    getLatestEventDate,
    getRecentlyUpdatedDate,
    getMobileCardLines,
} from '../helpers'
import { TEI_LIST } from '../teiListUi'
import { useI18nLanguage } from '../../../hooks/useI18nLanguage'

const EMPTY_BULK_IDS = new Set()

export function TeiResultsContent({
    viewMode,
    visibleColumns,
    sortConfig,
    handleSort,
    results,
    allEvents,
    onOpenDetail,
    setEventsModalTei,
    getColumnValue,
    lastUpdatedTeiId,
    programAttributes,
    visibleAttributeIds,
    stagesMap,
    loading,
    loadingMore = false,
    hasMore = false,
    onLoadMore,
    pager,
    runSearch,
    bulkSelectEnabled = false,
    bulkSelectedIds = EMPTY_BULK_IDS,
    onBulkToggleRow = () => {},
    onBulkToggleAllVisible = () => {},
    bulkAllVisibleSelected = false,
    bulkSomeVisibleSelected = false,
    bulkEventSelectEnabled = false,
    bulkSelectedEventIds = EMPTY_BULK_IDS,
    onBulkToggleEventRow = () => {},
    onBulkToggleAllVisibleEvents = () => {},
    bulkAllVisibleEventsSelected = false,
    bulkSomeVisibleEventsSelected = false,
    programId,
}) {
    useI18nLanguage()
    const scrollRef = useRef(null)
    const sentinelRef = useRef(null)

    useEffect(() => {
        if (!hasMore || loading || loadingMore || !onLoadMore) {
            return undefined
        }
        const root = scrollRef.current
        const target = sentinelRef.current
        if (!root || !target) {
            return undefined
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    onLoadMore()
                }
            },
            { root, rootMargin: '200px', threshold: 0 }
        )
        observer.observe(target)
        return () => observer.disconnect()
    }, [hasMore, loading, loadingMore, onLoadMore, results.length])

    const loadedEnd =
        pager.total != null
            ? Math.min(results.length, pager.total)
            : results.length

    const [isStageCollapsed, setIsStageCollapsed] = useState(true)

    return (
    <div className={TEI_LIST.shell}>
        <div ref={scrollRef} className={TEI_LIST.scrollBody}>
        <div className="hidden md:block min-w-full">
            {viewMode === 'ENROLLMENTS' ? (
                <table className="w-full min-w-[1020px] border-collapse text-left">
                    <thead className={TEI_LIST.tableThead}>
                        <tr className={TEI_LIST.tableHeaderRow}>
                            {bulkSelectEnabled && (
                                <th className="w-12 border-none px-3 py-1.5 align-middle">
                                    <input
                                        type="checkbox"
                                        className={TEI_LIST.checkbox}
                                        checked={bulkAllVisibleSelected}
                                        ref={(el) => {
                                            if (el) {
                                                el.indeterminate =
                                                    bulkSomeVisibleSelected && !bulkAllVisibleSelected
                                            }
                                        }}
                                        onChange={onBulkToggleAllVisible}
                                        onClick={(e) => e.stopPropagation()}
                                        aria-label={i18n.t('Select all on this page')}
                                    />
                                </th>
                            )}
                            {visibleColumns.map((col) => (
                                <th
                                    key={col.id}
                                    className={cn(
                                        TEI_LIST.tableHeaderCell,
                                        'group/th cursor-pointer transition-colors duration-200 hover:bg-slate-100/80'
                                    )}
                                    onClick={() => col.type === 'attr' && handleSort(col.id)}
                                >
                                    <div className="flex items-center gap-1.5">
                                        {getColumnHeaderLabel(col)}
                                        {col.type === 'de' && (
                                            <span className="rounded bg-slate-200/80 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                                DE
                                            </span>
                                        )}
                                        {col.type === 'attr' && (
                                            <div
                                                className={cn(
                                                    'transition-all duration-200',
                                                    sortConfig.columnId === col.id
                                                        ? 'scale-100 opacity-100'
                                                        : 'scale-75 opacity-0 group-hover/th:opacity-30'
                                                )}
                                            >
                                                {sortConfig.columnId === col.id &&
                                                sortConfig.direction === 'DESC' ? (
                                                    <CaretDownIcon className="h-4 w-4 text-slate-600" />
                                                ) : (
                                                    <CaretUpIcon className="h-4 w-4 text-slate-600" />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </th>
                            ))}

                            <th className={TEI_LIST.tableHeaderCell}>{i18n.t('កាលបរិច្ឆេទចុះឈ្មោះ')}</th>
                            <th className={TEI_LIST.tableHeaderCell}>{i18n.t('ធ្វើបច្ចុប្បន្នភាពថ្មីៗ')}</th>
                            <th className={cn(TEI_LIST.tableHeaderCell, 'w-auto min-w-[220px] text-center')}>
                                {i18n.t('ការមកពិនិត្យ')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map((tei) => {
                            const highlighted = tei.trackedEntity === lastUpdatedTeiId
                            const allTeiEvents = tei.enrollments?.flatMap((enr) => enr.events || []) || []
                            const completedCount = allTeiEvents.filter(
                                (ev) => String(ev.status || '').toUpperCase() === 'COMPLETED'
                            ).length
                            const activeCount = allTeiEvents.filter(
                                (ev) => String(ev.status || '').toUpperCase() !== 'COMPLETED'
                            ).length

                            return (
                                <tr
                                    key={tei.trackedEntity}
                                    className={cn(
                                        TEI_LIST.tableRow,
                                        highlighted && TEI_LIST.tableRowHighlight
                                    )}
                                    onClick={() => onOpenDetail(tei)}
                                >
                                    {bulkSelectEnabled && (
                                        <td
                                            className="w-12 px-3 py-1 align-middle"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <input
                                                type="checkbox"
                                                className={TEI_LIST.checkbox}
                                                checked={bulkSelectedIds.has(tei.trackedEntity)}
                                                onChange={() => onBulkToggleRow(tei.trackedEntity)}
                                                onClick={(e) => e.stopPropagation()}
                                                aria-label={i18n.t('Select row')}
                                            />
                                        </td>
                                    )}
                                    {visibleColumns.map((col) => (
                                        <td key={col.id} className={TEI_LIST.tableCell}>
                                            <MixedScriptText value={getColumnValue(tei, col)} />
                                        </td>
                                    ))}

                                    <td className={TEI_LIST.tableCellMeta}>
                                        {(tei.enrollments?.[0]?.enrolledAt || tei.enrollments?.[0]?.enrollmentDate || '-').split('T')[0]}
                                    </td>
                                    <td className={TEI_LIST.tableCellMeta}>
                                        {getRecentlyUpdatedDate(tei)}
                                    </td>
                                    <td className="px-3 py-1 text-center whitespace-nowrap min-w-[220px]">
                                        <div
                                            className="inline-flex items-center justify-center gap-1.5 cursor-pointer select-none rounded-lg p-0.5 whitespace-nowrap transition-colors hover:bg-slate-200/60 dark:hover:bg-zinc-800"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setEventsModalTei(tei)
                                            }}
                                            title={i18n.t('{{completed}} Completed, {{active}} Active (Total: {{total}})', {
                                                completed: completedCount,
                                                active: activeCount,
                                                total: allTeiEvents.length,
                                            })}
                                        >
                                            {/* Completed Badge (Green) */}
                                            <span
                                                className="inline-flex h-6 shrink-0 whitespace-nowrap items-center justify-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200/90 px-2 text-[11px] font-semibold text-emerald-700 shadow-2xs dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60"
                                                title={i18n.t('Completed: {{count}}', { count: completedCount })}
                                            >
                                                <span className="text-[10px] whitespace-nowrap leading-none">បញ្ចប់</span>
                                                <span className="inline-flex h-4 min-w-[16px] shrink-0 items-center justify-center rounded-full bg-emerald-200/80 dark:bg-emerald-900 px-1 text-[10px] font-bold text-emerald-900 dark:text-emerald-100">
                                                    {completedCount}
                                                </span>
                                            </span>

                                            {/* Not Completed / Active Badge (Blue) */}
                                            <span
                                                className="inline-flex h-6 shrink-0 whitespace-nowrap items-center justify-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200/90 px-2 text-[11px] font-semibold text-blue-700 shadow-2xs dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60"
                                                title={i18n.t('Active / Incomplete: {{count}}', { count: activeCount })}
                                            >
                                                <span className="text-[10px] whitespace-nowrap leading-none">មិនទាន់បញ្ចប់</span>
                                                <span className="inline-flex h-4 min-w-[16px] shrink-0 items-center justify-center rounded-full bg-blue-200/80 dark:bg-blue-900 px-1 text-[10px] font-bold text-blue-900 dark:text-blue-100">
                                                    {activeCount}
                                                </span>
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            ) : (
                <table className="w-full min-w-[960px] border-collapse text-left">
                    <thead className={TEI_LIST.tableThead}>
                        <tr className={TEI_LIST.tableHeaderRow}>
                            {bulkEventSelectEnabled && (
                                <th className="w-12 border-none px-3 py-3.5 align-middle">
                                    <input
                                        type="checkbox"
                                        className={TEI_LIST.checkbox}
                                        checked={bulkAllVisibleEventsSelected}
                                        ref={(el) => {
                                            if (el) {
                                                el.indeterminate =
                                                    bulkSomeVisibleEventsSelected &&
                                                    !bulkAllVisibleEventsSelected
                                            }
                                        }}
                                        onChange={onBulkToggleAllVisibleEvents}
                                        onClick={(e) => e.stopPropagation()}
                                        aria-label={i18n.t('Select all pending visits on this page')}
                                    />
                                </th>
                            )}

                            {/* Collapsible Stage Column Header on the left */}
                            {isStageCollapsed ? (
                                <th className="w-10 min-w-[40px] max-w-[40px] border-none px-1 py-3 text-center align-middle bg-slate-50/80 dark:bg-zinc-800/60 transition-all duration-200">
                                    <button
                                        type="button"
                                        onClick={() => setIsStageCollapsed(false)}
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 shadow-2xs hover:bg-slate-100 hover:text-slate-900 transition-colors"
                                        title={i18n.t('Expand Stage column')}
                                        aria-label={i18n.t('Expand Stage column')}
                                    >
                                        <ChevronRightIcon className="h-4 w-4" />
                                    </button>
                                </th>
                            ) : (
                                <th className={cn(TEI_LIST.tableHeaderCell, 'min-w-[170px] transition-all duration-200')}>
                                    <div className="flex items-center justify-between gap-1.5">
                                        <span>{i18n.t('Stage')}</span>
                                        <button
                                            type="button"
                                            onClick={() => setIsStageCollapsed(true)}
                                            className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-200/80 hover:text-slate-700 dark:hover:bg-zinc-700 transition-colors"
                                            title={i18n.t('Collapse Stage column')}
                                            aria-label={i18n.t('Collapse Stage column')}
                                        >
                                            <ChevronLeftIcon className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </th>
                            )}

                            {visibleColumns.map((col) => (
                                <th
                                    key={col.id}
                                    className={cn(
                                        TEI_LIST.tableHeaderCell,
                                        'group/th cursor-pointer transition-colors duration-200 hover:bg-slate-100/80'
                                    )}
                                    onClick={() => col.type === 'attr' && handleSort(col.id)}
                                >
                                    <div className="flex items-center gap-1.5">
                                        {getColumnHeaderLabel(col)}
                                        {col.type === 'de' && (
                                            <span className="rounded bg-slate-200/80 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                                                DE
                                            </span>
                                        )}
                                        {col.type === 'attr' && (
                                            <div
                                                className={cn(
                                                    'transition-all duration-200',
                                                    sortConfig.columnId === col.id
                                                        ? 'scale-100 opacity-100'
                                                        : 'scale-75 opacity-0 group-hover/th:opacity-30'
                                                )}
                                            >
                                                {sortConfig.columnId === col.id &&
                                                sortConfig.direction === 'DESC' ? (
                                                    <CaretDownIcon className="h-4 w-4 text-slate-600" />
                                                ) : (
                                                    <CaretUpIcon className="h-4 w-4 text-slate-600" />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </th>
                            ))}
                            <th className={TEI_LIST.tableHeaderCell}>{i18n.t('កាលបរិច្ឆេទ')}</th>
                            <th className={TEI_LIST.tableHeaderCell}>{i18n.t('ស្ថានភាព')}</th>
                            <th className={cn(TEI_LIST.tableHeaderCell, 'text-right')}>
                                {i18n.t('សកម្មភាព')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {allEvents.map((event) => {
                            const tei = event.tei
                            const isCompleted = event.status === 'COMPLETED'
                            const statusLabel = isCompleted
                                ? i18n.t('បានបញ្ចប់')
                                : event.status === 'ACTIVE'
                                  ? i18n.t('សកម្ម')
                                  : event.status === 'SCHEDULE' || event.status === 'SCHEDULED'
                                    ? i18n.t('បានកំណត់ពេល')
                                    : event.status === 'SKIPPED'
                                      ? i18n.t('បានរំលង')
                                      : event.status === 'OVERDUE'
                                        ? i18n.t('ហួសកាលកំណត់')
                                        : event.status || '-'

                            const targetTei = {
                                ...tei,
                                initialStageId: event.programStage,
                                selectedEventId: event.event,
                            }
                            return (
                                <tr
                                    key={event.event}
                                    className={TEI_LIST.tableRow}
                                    onClick={() => (onOpenDetail ? onOpenDetail(targetTei) : setEventsModalTei(targetTei))}
                                >
                                    {bulkEventSelectEnabled && (
                                        <td
                                            className="w-12 px-3 py-1 align-middle"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <input
                                                type="checkbox"
                                                className={TEI_LIST.checkbox}
                                                checked={bulkSelectedEventIds.has(event.event)}
                                                disabled={!canBulkSelect}
                                                onChange={() => onBulkToggleEventRow(event.event)}
                                                onClick={(e) => e.stopPropagation()}
                                                aria-label={i18n.t('Select visit for bulk approval')}
                                            />
                                        </td>
                                    )}

                                    {/* Collapsible Stage Cell on the left */}
                                    {isStageCollapsed ? (
                                        <td
                                            className="w-10 min-w-[40px] max-w-[40px] px-1 py-1 text-center align-middle bg-slate-50/40 dark:bg-zinc-900/30 border-r border-slate-100 dark:border-zinc-800 transition-all duration-200"
                                            title={stagesMap[event.programStage] || i18n.t('Events')}
                                        >
                                            <span
                                                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400"
                                                title={stagesMap[event.programStage] || i18n.t('Events')}
                                            >
                                                <ClockIcon className="h-3 w-3" />
                                            </span>
                                        </td>
                                    ) : (
                                        <td className={TEI_LIST.tableCell}>
                                            <MixedScriptText
                                                value={
                                                    stagesMap[event.programStage] ||
                                                    (event.isEnrollmentOnly || !event.programStage
                                                        ? i18n.t('ការចុះឈ្មោះ (Enrollment)')
                                                        : i18n.t('Events'))
                                                }
                                                className={TEI_LIST.tableCellStage}
                                            />
                                        </td>
                                    )}

                                    {visibleColumns.map((col) => {
                                        if (col.type === 'de') {
                                            const dv = event.dataValues?.find(
                                                (d) => d.dataElement === col.id
                                            )
                                            const val =
                                                dv?.value !== undefined &&
                                                dv.value !== null &&
                                                dv.value !== ''
                                                    ? String(dv.value)
                                                    : '-'
                                            return (
                                                <td key={col.id} className={TEI_LIST.tableCell}>
                                                    <MixedScriptText
                                                        value={val}
                                                        className={
                                                            val === '-'
                                                                ? 'text-slate-300'
                                                                : undefined
                                                        }
                                                    />
                                                </td>
                                            )
                                        }
                                        const val = getColumnValue(tei, col)
                                        return (
                                            <td key={col.id} className={TEI_LIST.tableCell}>
                                                <MixedScriptText value={val} />
                                            </td>
                                        )
                                    })}

                                    <td className={TEI_LIST.tableCellMeta}>
                                        {(event.eventDate ||
                                            event.occurredAt ||
                                            event.createdAt ||
                                            '-'
                                        ).split('T')[0]}
                                    </td>
                                    <td className="px-3 py-1">
                                        <div className="flex items-center gap-1.5">
                                            <div
                                                className={
                                                    isCompleted
                                                        ? TEI_LIST.statusCompleteDot
                                                        : TEI_LIST.statusActiveDot
                                                }
                                            />
                                            <span
                                                className={
                                                    isCompleted
                                                        ? TEI_LIST.statusCompleteText
                                                        : TEI_LIST.statusActiveText
                                                }
                                            >
                                                {statusLabel}
                                            </span>
                                        </div>
                                    </td>

                                    <td className="px-3 py-1 text-right">
                                        <div
                                            className={cn(
                                                TEI_LIST.iconButton,
                                                'ml-auto h-8 w-8'
                                            )}
                                        >
                                            <ChevronRightIcon className="h-5 w-5" />
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                        {allEvents.length === 0 && (
                            <tr>
                                <td
                                    colSpan={
                                        (bulkEventSelectEnabled ? 1 : 0) +
                                        1 +
                                        visibleColumns.length +
                                        3
                                    }
                                    className="py-12 text-center"
                                >
                                    <div className="flex flex-col items-center text-slate-400">
                                        <ShadowIcon className="mb-3 h-10 w-10" />
                                        <p className={TEI_LIST.emptyTitle}>
                                            {i18n.t('No events found.')}
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            )}
        </div>

        {/* Native-style section header — only on mobile, above the list */}
        {pager?.total != null && results.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100/80 dark:border-zinc-800/60 md:hidden">
                <span className="text-[11.5px] font-semibold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                    {viewMode === 'EVENTS' ? i18n.t('ព្រឹត្តិការណ៍') : i18n.t('ទំនាក់ទំនងទាំងអស់')}
                </span>
                <span className="text-[11.5px] font-bold text-slate-400 dark:text-zinc-500">{pager.total}</span>
            </div>
        )}

        <div className={TEI_LIST.mobileList}>
            {viewMode === 'ENROLLMENTS' ? (
                        results.map((tei) => {
                    const { title, subtitle } = getMobileCardLines(
                        tei,
                        visibleColumns,
                        getColumnValue
                    )
                    const highlighted = tei.trackedEntity === lastUpdatedTeiId

                    // Initials: skip numbers-only strings (PMRS codes) — scan all attrs for first alphabetic value
                    const rawInitials = (title && title !== '-')
                        ? String(title).trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase()
                        : ''
                    const initialsAreNumeric = /^\d+$/.test(rawInitials) || rawInitials === '' || rawInitials === '•'

                    // Try subtitle next
                    const subtitleInitials = (subtitle && subtitle !== '-')
                        ? String(subtitle).trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase()
                        : ''
                    const subtitleNumeric = /^\d+$/.test(subtitleInitials)

                    // Then scan raw tei.attributes for first non-numeric value (e.g. Khmer name)
                    let attrInitials = ''
                    if (initialsAreNumeric || (subtitleNumeric && !subtitleInitials)) {
                        for (const attr of (tei.attributes || [])) {
                            const val = attr?.value ? String(attr.value).trim() : ''
                            if (val && !/^\d+$/.test(val) && val !== '-') {
                                attrInitials = val.split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase()
                                break
                            }
                        }
                    }

                    const initials = initialsAreNumeric
                        ? (subtitleInitials && !subtitleNumeric
                            ? subtitleInitials
                            : attrInitials || '•')
                        : (rawInitials || '•')

                    // Compute total & completed events
                    const allTeiEvents = tei.enrollments?.flatMap((enr) => enr.events || []) || []
                    const completedCount = allTeiEvents.filter(ev => String(ev.status || '').toUpperCase() === 'COMPLETED').length
                    const activeCount = allTeiEvents.filter(ev => String(ev.status || '').toUpperCase() !== 'COMPLETED').length

                    // Get most recent activity date
                    const recentDate = getRecentlyUpdatedDate(tei)

                    return (
                        <div
                            key={tei.trackedEntity}
                            className={cn(
                                'group flex items-center gap-3.5 px-4 py-3 min-h-[68px] transition-all duration-100',
                                'hover:bg-slate-50/80 active:bg-slate-100/90 dark:hover:bg-zinc-800/40 dark:active:bg-zinc-800/70 cursor-pointer select-none',
                                highlighted && 'bg-teal-50/60 dark:bg-teal-950/20'
                            )}
                            onClick={() => onOpenDetail(tei)}
                        >
                            {bulkSelectEnabled && (
                                <div
                                    className="flex shrink-0 items-center self-center"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <input
                                        type="checkbox"
                                        className={TEI_LIST.checkbox}
                                        checked={bulkSelectedIds.has(tei.trackedEntity)}
                                        onChange={() => onBulkToggleRow(tei.trackedEntity)}
                                        onClick={(e) => e.stopPropagation()}
                                        aria-label={i18n.t('Select row')}
                                    />
                                </div>
                            )}

                            {/* Initials Avatar — like Telegram contact avatars */}
                            <div
                                className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full font-bold text-[16px] text-white shadow-sm select-none"
                                style={{ background: 'linear-gradient(135deg, var(--app-header-bar-bg) 0%, #1a4f74 100%)' }}
                                aria-hidden
                            >
                                {initials}
                            </div>

                            {/* Main content */}
                            <div className="min-w-0 flex-1">
                                {/* Row 1: Name + Date (right-aligned like Telegram) */}
                                <div className="flex items-baseline justify-between gap-2">
                                    <MixedScriptText
                                        value={title}
                                        className="truncate text-[14.5px] font-semibold text-slate-900 dark:text-zinc-100 tracking-tight"
                                    />
                                    <span className="shrink-0 text-[11px] font-medium text-slate-400 dark:text-zinc-500 whitespace-nowrap">
                                        {recentDate && recentDate !== '-' ? recentDate.split('T')[0] : ''}
                                    </span>
                                </div>

                                {/* Row 2: Subtitle code + event badges (right-aligned like Telegram) */}
                                <div className="mt-0.5 flex items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-1.5">
                                        {subtitle && (
                                            <span className="truncate text-[12px] font-normal text-slate-500 dark:text-zinc-400">
                                                <MixedScriptText value={subtitle} />
                                            </span>
                                        )}
                                    </div>
                                    {/* Event count badges — Telegram-style green/blue pill */}
                                    {allTeiEvents.length > 0 && (
                                        <div
                                            className="flex shrink-0 items-center gap-1"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setEventsModalTei(tei)
                                            }}
                                        >
                                            {completedCount > 0 && (
                                                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold text-white">
                                                    {completedCount}
                                                </span>
                                            )}
                                            {activeCount > 0 && (
                                                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--app-header-bar-bg)] px-1.5 text-[11px] font-bold text-white">
                                                    {activeCount}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })
            ) : (
                allEvents.map((event) => {
                    const tei = event.tei
                    const { title, subtitle } = getMobileCardLines(
                        tei,
                        visibleColumns,
                        getColumnValue
                    )
                    const clientLabel =
                        title ||
                        getEventClientLabel(
                            tei,
                            visibleColumns,
                            programAttributes,
                            getColumnValue
                        ) ||
                        i18n.t('Unnamed client')
                    const isCompleted = event.status === 'COMPLETED'

                    const targetTei = {
                        ...tei,
                        initialStageId: event.programStage,
                        selectedEventId: event.event,
                    }

                    return (
                        <div
                            key={event.event}
                            onClick={() => (onOpenDetail ? onOpenDetail(targetTei) : setEventsModalTei(targetTei))}
                            className="group flex items-center gap-3.5 px-4 py-3 min-h-[68px] hover:bg-slate-50/80 active:bg-slate-100/90 dark:hover:bg-zinc-800/40 dark:active:bg-zinc-800/70 cursor-pointer select-none transition-all duration-100"
                        >
                            {bulkEventSelectEnabled && (
                                <div
                                    className="flex shrink-0 items-center self-center"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <input
                                        type="checkbox"
                                        className={TEI_LIST.checkbox}
                                        checked={bulkSelectedEventIds.has(event.event)}
                                        disabled={!canBulkSelect}
                                        onChange={() => onBulkToggleEventRow(event.event)}
                                        onClick={(e) => e.stopPropagation()}
                                        aria-label={i18n.t('Select visit for bulk approval')}
                                    />
                                </div>
                            )}

                            {/* Initials avatar for event view */}
                            <div
                                className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full font-bold text-[16px] text-white shadow-sm select-none"
                                style={{
                                    background: isCompleted
                                        ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
                                        : 'linear-gradient(135deg, #64748b 0%, #475569 100%)'
                                }}
                                aria-hidden
                            >
                                {clientLabel && clientLabel !== '-'
                                    ? String(clientLabel).trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase()
                                    : '?'}
                            </div>

                            <div className="min-w-0 flex-1">
                                {/* Row 1: Name + Date */}
                                <div className="flex items-baseline justify-between gap-2">
                                    <MixedScriptText
                                        value={clientLabel}
                                        className="truncate text-[14.5px] font-semibold text-slate-900 dark:text-zinc-100 tracking-tight"
                                    />
                                    <span className="shrink-0 text-[11px] font-medium text-slate-400 dark:text-zinc-500 whitespace-nowrap">
                                        {(event.eventDate || event.occurredAt || event.createdAt || '').split('T')[0]}
                                    </span>
                                </div>

                                {/* Row 2: Stage tag + status badge */}
                                <div className="mt-0.5 flex items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-1.5">
                                        <MixedScriptText
                                            value={
                                                stagesMap[event.programStage] ||
                                                (event.isEnrollmentOnly || !event.programStage
                                                    ? i18n.t('ការចុះឈ្មោះ (Enrollment)')
                                                    : i18n.t('Events'))
                                            }
                                            className="truncate text-[12px] font-normal text-slate-500 dark:text-zinc-400"
                                        />
                                    </div>
                                    <span
                                        className={cn(
                                            'shrink-0 flex h-5 items-center justify-center rounded-full px-2 text-[10px] font-bold text-white',
                                            isCompleted ? 'bg-emerald-500' : 'bg-[var(--app-header-bar-bg)]'
                                        )}
                                    >
                                        {isCompleted ? i18n.t('បញ្ចប់') : i18n.t('សកម្ម')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )
                })
            )}

        </div>

        {viewMode === 'ENROLLMENTS' && results.length === 0 && !loading && (
            <TeiListEmptyState title={i18n.t('No personnel found')}>
                <p>{i18n.t('Refine your filters or search terms to see results.')}</p>
            </TeiListEmptyState>
        )}

        {viewMode === 'EVENTS' && allEvents.length === 0 && !loading && (
            <TeiListEmptyState title={i18n.t('No events found.')}>
                <p>{i18n.t('Refine your filters or search terms to see results.')}</p>
            </TeiListEmptyState>
        )}

        </div>

        <div className={TEI_LIST.footer}>
            {/* Left: Summary Count */}
            <div className={cn(TEI_LIST.footerMeta, 'shrink-0')}>
                <span className="hidden text-[11px] md:text-xs font-medium text-slate-500 md:inline">
                    {i18n.t('Showing')}{' '}
                </span>
                <span>
                    <span className={TEI_LIST.footerMetaStrong}>
                        {(pager.page - 1) * pager.pageSize + 1}
                    </span>
                    <span className="mx-0.5 text-slate-400">-</span>
                    <span className={TEI_LIST.footerMetaStrong}>
                        {Math.min(pager.page * pager.pageSize, pager.total ?? 0)}
                    </span>
                    <span className="mx-1 text-slate-400">/</span>
                    <span className={TEI_LIST.footerMetaStrong}>{pager.total}</span>
                </span>
            </div>

            {/* Center: Desktop Pagination Nav */}
            <div className="hidden md:flex flex-1 items-center justify-center px-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <PaginationNav
                    page={pager.page}
                    pageSize={pager.pageSize}
                    total={pager.total || 0}
                    onPageChange={(p) => runSearch(p)}
                    disabled={loading}
                />
            </div>

            {/* Center: Mobile Compact Stepper */}
            <div className="flex md:hidden flex-1 items-center justify-center gap-1.5 px-1">
                <button
                    type="button"
                    disabled={pager.page <= 1 || loading}
                    onClick={() => runSearch(pager.page - 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 disabled:opacity-30 disabled:pointer-events-none active:bg-slate-100"
                    aria-label="Previous page"
                >
                    <ChevronLeftIcon className="h-4 w-4" />
                </button>
                <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-200">
                    {pager.page} / {Math.ceil((pager.total || 0) / pager.pageSize) || 1}
                </span>
                <button
                    type="button"
                    disabled={pager.page >= Math.ceil((pager.total || 0) / pager.pageSize) || loading}
                    onClick={() => runSearch(pager.page + 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 disabled:opacity-30 disabled:pointer-events-none active:bg-slate-100"
                    aria-label="Next page"
                >
                    <ChevronRightIcon className="h-4 w-4" />
                </button>
            </div>

            {/* Right: Page Size Selector */}
            <div className="flex shrink-0 items-center justify-end gap-1.5">
                <span className="hidden whitespace-nowrap text-[11px] font-medium text-slate-500 md:inline sm:text-xs">
                    {i18n.t('ក្នុងមួយទំព័រ')}
                </span>
                <Select
                    value={String(pager.pageSize)}
                    onValueChange={(val) => runSearch(1, Number(val))}
                    options={[5, 10, 15, 20, 50].map((size) => ({
                        value: String(size),
                        label: String(size),
                    }))}
                    className="h-7 w-[4.25rem] rounded-lg border-slate-200/90 bg-slate-50 px-2 text-xs font-semibold text-slate-700 shadow-none md:h-8 md:w-[4.75rem]"
                />
            </div>
        </div>

        {loading && !loadingMore ? (
            <TeiListLoadingOverlay label={i18n.t('Loading Records')} />
        ) : null}
    </div>
    )
}
