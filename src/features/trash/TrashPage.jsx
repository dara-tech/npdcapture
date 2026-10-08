import React, { useEffect, useState, useMemo } from 'react'
import i18n from '@dhis2/d2-i18n'
import { useDataEngine } from '@dhis2/app-runtime'
import { RefreshCcw, Trash2, Search, X } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Select } from '../../components/ui/select'
import { Spinner } from '../../components/ui/spinner'
import { PaginationNav } from '../../components/ui/PaginationNav'
import { MixedScriptText } from '../../components/ui/MixedScriptText'
import { cn } from '../../lib/utils'
import { PAGE_LAYOUT, TEI_LIST } from '../tei-search/teiListUi'
import { TeiListEmptyState } from '../tei-search/components/TeiListEmptyState'
import {
    TeiListLoadingOverlay,
    TeiTableSkeleton,
    TeiMobileSkeleton,
    TopLoadingBar,
} from '../tei-search/components/TeiListLoadingOverlay'
import { useI18nLanguage } from '../../hooks/useI18nLanguage'
import { TrackerContextSelector } from '../context/TrackerContextSelector'
import {
    searchDeletedPersonnel,
    searchDeletedEvents,
    restoreTrackedEntity,
    restoreEnrollment,
    restoreEvent,
    formatTrashUser,
} from '../../services/trashApi'
import { fetchProgramMetadata } from '../../services/trackerApi'
import { mapProgramAttributesFromMetadata } from '../tei-search/lib/importProfileAttributes'

export const TrashPage = ({ context, setContext, onBack }) => {
    useI18nLanguage()
    const engine = useDataEngine()

    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(null)
    const [results, setResults] = useState([])
    const [eventTeiMap, setEventTeiMap] = useState({})
    const [pager, setPager] = useState({ page: 1, pageSize: 20, total: 0, pageCount: 0 })
    const [viewMode, setViewMode] = useState('PERSONNEL') // 'PERSONNEL' or 'EVENTS'
    const [defaultOrgUnit, setDefaultOrgUnit] = useState(null)
    const [programAttributes, setProgramAttributes] = useState([])
    const [programStages, setProgramStages] = useState([])
    const [notice, setNotice] = useState(null)

    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [selectedIds, setSelectedIds] = useState(new Set())
    const [bulkActionLoading, setBulkActionLoading] = useState(false)

    const [defaultTrackedEntityType, setDefaultTrackedEntityType] = useState(null)

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery)
        }, 350)
        return () => clearTimeout(timer)
    }, [searchQuery])

    // Map stages by ID for fast lookup of display names
    const stagesMap = useMemo(() => {
        const map = new Map()
        for (const s of programStages) {
            map.set(s.id, s)
        }
        return map
    }, [programStages])

    // Fetch default root org unit and program metadata
    useEffect(() => {
        let mounted = true
        const init = async () => {
            try {
                let ou = context?.orgUnit
                if (!ou) {
                    const meRes = await engine.query({
                        me: { resource: 'me', params: { fields: 'organisationUnits[id]' } },
                    })
                    const orgUnits = meRes.me?.organisationUnits || []
                    if (orgUnits.length > 0) {
                        ou = orgUnits[0].id
                    }
                }
                if (mounted) setDefaultOrgUnit(ou)

                if (!context?.program && !context?.trackedEntityType) {
                    const tetRes = await engine.query({
                        tet: { resource: 'trackedEntityTypes', params: { fields: 'id', paging: false } },
                    })
                    const tets = tetRes.tet?.trackedEntityTypes || []
                    if (tets.length > 0 && mounted) {
                        setDefaultTrackedEntityType(tets[0].id)
                    }
                }

                if (context?.program) {
                    const metadata = await fetchProgramMetadata({ engine, programId: context.program })
                    const attributes = mapProgramAttributesFromMetadata(metadata)
                    if (mounted) {
                        setProgramAttributes(attributes)
                        setProgramStages(metadata.programStages || [])
                    }
                } else {
                    if (mounted) {
                        setProgramAttributes([])
                        setProgramStages([])
                    }
                }
            } catch (err) {
                console.error('Failed to init TrashPage', err)
            }
        }
        init()
        return () => {
            mounted = false
        }
    }, [context?.orgUnit, context?.program, context?.trackedEntityType, engine])

    const fetchTrash = async (
        page = pager.page,
        pageSize = pager.pageSize,
        mode = viewMode,
        search = debouncedSearch
    ) => {
        const orgUnit = context?.orgUnit || defaultOrgUnit
        if (!orgUnit) return

        setLoading(true)
        setNotice(null)
        try {
            if (mode === 'PERSONNEL') {
                const res = await searchDeletedPersonnel({
                    engine,
                    orgUnit,
                    program: context?.program || undefined,
                    trackedEntityType: context?.program
                        ? undefined
                        : context?.trackedEntityType || defaultTrackedEntityType,
                    value: search || undefined,
                    page,
                    pageSize,
                })
                setResults(res.rows || [])
                setPager(res.pager || { page, pageSize, total: 0, pageCount: 0 })
            } else {
                const res = await searchDeletedEvents({
                    engine,
                    orgUnit,
                    program: context?.program || undefined,
                    value: search || undefined,
                    page,
                    pageSize,
                })
                setResults(res.instances || [])
                setEventTeiMap(res.teiById || {})
                setPager(res.pager || { page, pageSize, total: 0, pageCount: 0 })
            }
        } catch (err) {
            console.error('Failed to fetch trash', err)
            setNotice({ type: 'error', text: err.message || i18n.t('Failed to fetch deleted items') })
        } finally {
            setLoading(false)
        }
    }

    // Refresh when context, mode, or search query changes
    useEffect(() => {
        if (context?.orgUnit || defaultOrgUnit) {
            setSelectedIds(new Set())
            fetchTrash(1, pager.pageSize, viewMode, debouncedSearch)
        }
    }, [
        context?.orgUnit,
        context?.program,
        context?.trackedEntityType,
        defaultOrgUnit,
        viewMode,
        debouncedSearch,
    ])

    const allIds = useMemo(() => {
        return results
            .map((item) => (viewMode === 'PERSONNEL' ? item.id : item.event))
            .filter(Boolean)
    }, [results, viewMode])

    const desktopColCount = useMemo(() => {
        if (viewMode === 'PERSONNEL') {
            return programAttributes.length > 0
                ? Math.min(programAttributes.length, 5) + 4
                : 4
        }
        return 8
    }, [viewMode, programAttributes.length])

    const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id))
    const someSelected = allIds.some((id) => selectedIds.has(id)) && !allSelected

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(allIds))
        }
    }

    const toggleSelectRow = (id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    const doRestore = async (item) => {
        const actionId = item.id || item.event || item.tei?.trackedEntity
        setActionLoading(actionId)
        try {
            if (viewMode === 'PERSONNEL') {
                if (item.kind === 'enrollment') {
                    await restoreEnrollment({
                        engine,
                        enrollmentId: item.enrollment?.enrollment,
                        programId: context?.program || item.enrollment?.program,
                        orgUnitId: context?.orgUnit || defaultOrgUnit || item.enrollment?.orgUnit,
                        trackedEntityId: item.tei?.trackedEntity || item.enrollment?.trackedEntity,
                        attributes: item.tei?.attributes,
                        enrolledAt: item.enrollment?.enrolledAt,
                        occurredAt: item.enrollment?.occurredAt,
                    })
                } else {
                    await restoreTrackedEntity({
                        engine,
                        trackedEntityId: item.tei?.trackedEntity,
                        programId: context?.program,
                        orgUnitId: context?.orgUnit || defaultOrgUnit,
                        trackedEntityType: context?.trackedEntityType || item.tei?.trackedEntityType,
                    })
                }
            } else {
                await restoreEvent({
                    engine,
                    eventId: item.event,
                    programId: context?.program || item.program,
                    orgUnitId: item.orgUnit,
                })
            }
            setNotice({ type: 'success', text: i18n.t('Item restored successfully') })
            setSelectedIds((prev) => {
                const next = new Set(prev)
                next.delete(actionId)
                return next
            })
            fetchTrash(pager.page)
        } catch (err) {
            console.error('Failed to restore', err)
            setNotice({ type: 'error', text: err.message || i18n.t('Restore failed') })
        } finally {
            setActionLoading(null)
        }
    }

    const doBulkRestore = async () => {
        if (!selectedIds.size) return
        setBulkActionLoading(true)
        let restoredCount = 0
        let failedCount = 0

        const itemsToRestore = results.filter((item) => {
            const id = viewMode === 'PERSONNEL' ? item.id : item.event
            return selectedIds.has(id)
        })

        for (const item of itemsToRestore) {
            try {
                if (viewMode === 'PERSONNEL') {
                    if (item.kind === 'enrollment') {
                        await restoreEnrollment({
                            engine,
                            enrollmentId: item.enrollment?.enrollment,
                            programId: context?.program || item.enrollment?.program,
                            orgUnitId: context?.orgUnit || defaultOrgUnit || item.enrollment?.orgUnit,
                            trackedEntityId: item.tei?.trackedEntity || item.enrollment?.trackedEntity,
                            attributes: item.tei?.attributes,
                            enrolledAt: item.enrollment?.enrolledAt,
                            occurredAt: item.enrollment?.occurredAt,
                        })
                    } else {
                        await restoreTrackedEntity({
                            engine,
                            trackedEntityId: item.tei?.trackedEntity,
                            programId: context?.program,
                            orgUnitId: context?.orgUnit || defaultOrgUnit,
                            trackedEntityType: context?.trackedEntityType || item.tei?.trackedEntityType,
                        })
                    }
                } else {
                    await restoreEvent({
                        engine,
                        eventId: item.event,
                        programId: context?.program || item.program,
                        orgUnitId: item.orgUnit,
                    })
                }
                restoredCount++
            } catch {
                failedCount++
            }
        }

        setBulkActionLoading(false)
        setSelectedIds(new Set())
        if (failedCount === 0) {
            setNotice({
                type: 'success',
                text: i18n.t('{{count}} items restored successfully', { count: restoredCount }),
            })
        } else {
            setNotice({
                type: 'warning',
                text: i18n.t('Restored {{ok}} items. {{fail}} failed.', {
                    ok: restoredCount,
                    fail: failedCount,
                }),
            })
        }
        fetchTrash(pager.page)
    }

    const getPrimaryLabel = (item) => {
        if (viewMode === 'PERSONNEL') {
            const attrs = item.tei?.attributes || []
            const getVal = (id) => {
                const a = attrs.find((x) => (x.attribute || x.trackedEntityAttribute?.id || x.id) === id)
                return a?.value && a.value !== '-' ? a.value : null
            }

            // Priority 1: Full name (first + last)
            const nameCols = programAttributes.filter((col) =>
                /first|last|name/i.test(col.name || col.displayName || '')
            )
            const names = nameCols.map((c) => getVal(c.id)).filter(Boolean)
            if (names.length > 0) return names.join(' ')

            // Priority 2: PMRS, UUIC, UIC
            const codeCols = programAttributes.filter((col) =>
                /pmrs|uuic|uic/i.test(col.name || col.displayName || '')
            )
            const code = codeCols.map((c) => getVal(c.id)).find(Boolean)
            if (code) return code

            // Priority 3: any non-empty attribute value
            const anyAttr = attrs.find((a) => a.value && a.value !== '-')
            if (anyAttr) return anyAttr.value

            return item.tei?.trackedEntity || i18n.t('Unknown')
        }
        return item.event || i18n.t('Unknown Event')
    }

    const getEventClientLabel = (event) => {
        const tei = eventTeiMap[event.trackedEntity]
        if (!tei) return event.trackedEntity || '-'
        const attrs = tei.attributes || []
        const getVal = (pattern) => {
            const col = programAttributes.find((c) => pattern.test(c.name || c.displayName || ''))
            if (!col) return null
            const a = attrs.find((x) => (x.attribute || x.trackedEntityAttribute?.id || x.id) === col.id)
            return a?.value && a.value !== '-' ? a.value : null
        }
        const lastName = getVal(/last/i)
        const firstName = getVal(/first/i)
        if (lastName || firstName) {
            return [lastName, firstName].filter(Boolean).join(' ')
        }
        const pmrs = getVal(/pmrs|uuic|uic/i)
        if (pmrs) return pmrs
        const anyVal = attrs.find((a) => a.value && a.value !== '-')?.value
        return anyVal || event.trackedEntity || '-'
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden gap-1.5">
            {/* Top Toolbar Card matching RecordsToolbar */}
            <div className="shrink-0">
                <div className={PAGE_LAYOUT.stack}>
                    <div className={cn(PAGE_LAYOUT.toolbarCard, 'custom-scrollbar overflow-x-auto')}>
                        <div className="flex w-full items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <TrackerContextSelector
                                    context={context}
                                    onChange={setContext}
                                    layout="default"
                                    showRecordActions={false}
                                    showSearch={false}
                                    showAppointments={false}
                                    showMonthlyReport={false}
                                    showImportExport={false}
                                    showViewModeToggle={false}
                                    showColumnConfig={false}
                                    showRegister={false}
                                />
                            </div>
                            <div className="flex shrink-0 items-center gap-2 pl-1.5">
                                {/* Search input */}
                                <div className="relative w-44 md:w-56">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder={i18n.t('Search deleted...')}
                                        className="h-8 w-full rounded-md border border-slate-200/90 bg-white dark:bg-zinc-900 pl-8 pr-7 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-app-primary"
                                    />
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                                            aria-label={i18n.t('Clear search')}
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>

                                {/* Bulk Restore Button */}
                                {selectedIds.size > 0 && (
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={doBulkRestore}
                                        disabled={bulkActionLoading}
                                        className="h-8 gap-1.5 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                                    >
                                        {bulkActionLoading ? (
                                            <Spinner className="h-3 w-3 border-white/30 border-t-white" />
                                        ) : (
                                            <RefreshCcw className="h-3.5 w-3.5" />
                                        )}
                                        {i18n.t('Restore Selected ({{count}})', { count: selectedIds.size })}
                                    </Button>
                                )}

                                <Select
                                    value={viewMode}
                                    onValueChange={(v) => {
                                        setViewMode(v)
                                        setSelectedIds(new Set())
                                        setPager({ ...pager, page: 1 })
                                    }}
                                    options={[
                                        { value: 'PERSONNEL', label: i18n.t('Deleted Personnel') },
                                        { value: 'EVENTS', label: i18n.t('Deleted Events') },
                                    ]}
                                    className="h-8 w-40 rounded-md text-[13px]"
                                />
                                {onBack && (
                                    <Button variant="outline" size="sm" onClick={onBack} className="h-8">
                                        {i18n.t('Back')}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Notification Banner */}
            {notice && (
                <div
                    className={cn(
                        'mx-3 flex items-center justify-between px-3.5 py-2 text-xs font-medium rounded-lg border shrink-0',
                        notice.type === 'success' &&
                            'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
                        notice.type === 'error' &&
                            'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/60',
                        notice.type === 'warning' &&
                            'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60'
                    )}
                >
                    <span>{notice.text}</span>
                    <button
                        type="button"
                        onClick={() => setNotice(null)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            {/* Table Content Card */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className={PAGE_LAYOUT.contentCard}>
                    <div className={cn(TEI_LIST.shell, 'relative')}>
                        {loading && <TopLoadingBar />}
                        <div className={TEI_LIST.scrollBody}>
                            <div className="hidden md:block min-w-full">
                                <table className="w-full min-w-[800px] border-collapse text-left md:min-w-0">
                                    <thead className={TEI_LIST.tableThead}>
                                        <tr className={TEI_LIST.tableHeaderRow}>
                                            <th className="w-10 border-none px-3 py-3.5 align-middle">
                                                <input
                                                    type="checkbox"
                                                    className={TEI_LIST.checkbox}
                                                    checked={allSelected}
                                                    ref={(el) => {
                                                        if (el) el.indeterminate = someSelected
                                                    }}
                                                    onChange={toggleSelectAll}
                                                    aria-label={i18n.t('Select all on this page')}
                                                />
                                            </th>

                                            {viewMode === 'PERSONNEL' ? (
                                                programAttributes.length > 0 ? (
                                                    programAttributes.slice(0, 5).map((col) => (
                                                        <th key={col.id} className={TEI_LIST.tableHeaderCell}>
                                                            <div className="flex items-center gap-1.5">
                                                                {col.displayName || col.name}
                                                            </div>
                                                        </th>
                                                    ))
                                                ) : (
                                                    <th className={TEI_LIST.tableHeaderCell}>
                                                        <div className="flex items-center gap-1.5">
                                                            {i18n.t('Client')}
                                                        </div>
                                                    </th>
                                                )
                                            ) : (
                                                <>
                                                    <th className={TEI_LIST.tableHeaderCell}>
                                                        <div className="flex items-center gap-1.5">
                                                            {i18n.t('Client')}
                                                        </div>
                                                    </th>
                                                    <th className={TEI_LIST.tableHeaderCell}>
                                                        <div className="flex items-center gap-1.5">
                                                            {i18n.t('Stage')}
                                                        </div>
                                                    </th>
                                                    <th className={TEI_LIST.tableHeaderCell}>
                                                        <div className="flex items-center gap-1.5">
                                                            {i18n.t('Event Date')}
                                                        </div>
                                                    </th>
                                                    <th className={TEI_LIST.tableHeaderCell}>
                                                        <div className="flex items-center gap-1.5">
                                                            {i18n.t('Status')}
                                                        </div>
                                                    </th>
                                                </>
                                            )}

                                            <th className={TEI_LIST.tableHeaderCell}>
                                                <div className="flex items-center gap-1.5">
                                                    {i18n.t('Deleted At')}
                                                </div>
                                            </th>
                                            <th className={TEI_LIST.tableHeaderCell}>
                                                <div className="flex items-center gap-1.5">
                                                    {i18n.t('Deleted By')}
                                                </div>
                                            </th>
                                            <th className={cn(TEI_LIST.tableHeaderCell, 'text-right')}>
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {i18n.t('Actions')}
                                                </div>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className={cn(loading && results.length > 0 && 'opacity-60 transition-opacity')}>
                                        {loading && results.length === 0 ? (
                                            <TeiTableSkeleton rows={7} cols={desktopColCount} />
                                        ) : (
                                            results.map((item) => {
                                            const id = viewMode === 'PERSONNEL' ? item.id : item.event
                                            const isSelected = selectedIds.has(id)
                                            const updatedAt =
                                                (viewMode === 'PERSONNEL'
                                                    ? item.tei?.updatedAt
                                                    : item.updatedAt) || '-'
                                            const updatedBy = formatTrashUser(
                                                viewMode === 'PERSONNEL' ? item.tei?.updatedBy : item.updatedBy,
                                                viewMode === 'PERSONNEL' ? item.tei?.storedBy : item.storedBy
                                            )
                                            const label = getPrimaryLabel(item)

                                            return (
                                                <tr
                                                    key={id}
                                                    className={cn(
                                                        TEI_LIST.tableRow,
                                                        isSelected && 'bg-emerald-50/50 dark:bg-emerald-950/20'
                                                    )}
                                                >
                                                    <td className="w-10 px-3 py-2.5 align-middle">
                                                        <input
                                                            type="checkbox"
                                                            className={TEI_LIST.checkbox}
                                                            checked={isSelected}
                                                            onChange={() => toggleSelectRow(id)}
                                                            aria-label={i18n.t('Select row')}
                                                        />
                                                    </td>

                                                    {viewMode === 'PERSONNEL' ? (
                                                        programAttributes.length > 0 ? (
                                                            programAttributes.slice(0, 5).map((col, idx) => {
                                                                const attr = item.tei?.attributes?.find(
                                                                    (a) =>
                                                                        (a.attribute ||
                                                                            a.trackedEntityAttribute?.id ||
                                                                            a.id) === col.id
                                                                )
                                                                let displayVal = attr?.value || '-'
                                                                if (
                                                                    displayVal !== '-' &&
                                                                    col.optionSet?.options?.length
                                                                ) {
                                                                    const opt = col.optionSet.options.find(
                                                                        (o) =>
                                                                            String(o.code) === String(displayVal) ||
                                                                            String(o.id) === String(displayVal)
                                                                    )
                                                                    if (opt) {
                                                                        displayVal =
                                                                            opt.displayName || opt.name || displayVal
                                                                    }
                                                                }
                                                                return (
                                                                    <td key={col.id} className={TEI_LIST.tableCell}>
                                                                        <MixedScriptText
                                                                            value={displayVal}
                                                                            className={
                                                                                idx === 0
                                                                                    ? 'font-semibold text-slate-800 dark:text-zinc-100'
                                                                                    : ''
                                                                            }
                                                                        />
                                                                    </td>
                                                                )
                                                            })
                                                        ) : (
                                                            <td className={TEI_LIST.tableCell}>
                                                                <MixedScriptText
                                                                    value={label}
                                                                    className="font-semibold text-slate-800 dark:text-zinc-100"
                                                                />
                                                            </td>
                                                        )
                                                    ) : (
                                                        <>
                                                            {/* Client name / ID */}
                                                            <td className={TEI_LIST.tableCell}>
                                                                <MixedScriptText
                                                                    value={getEventClientLabel(item)}
                                                                    className="font-semibold text-slate-800 dark:text-zinc-100"
                                                                />
                                                            </td>

                                                            {/* Program Stage Name */}
                                                            <td className={TEI_LIST.tableCell}>
                                                                <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-zinc-300">
                                                                    {stagesMap.get(item.programStage)?.displayName ||
                                                                        item.programStage ||
                                                                        '-'}
                                                                </span>
                                                            </td>

                                                            {/* Event Date */}
                                                            <td className={TEI_LIST.tableCellMeta}>
                                                                {(item.occurredAt || item.eventDate || '-').split('T')[0]}
                                                            </td>

                                                            {/* Status badge */}
                                                            <td className={TEI_LIST.tableCell}>
                                                                {item.status === 'COMPLETED' ? (
                                                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60">
                                                                        {i18n.t('Completed')}
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200/80 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60">
                                                                        {i18n.t('Active')}
                                                                    </span>
                                                                )}
                                                            </td>
                                                        </>
                                                    )}

                                                    <td className={TEI_LIST.tableCellMeta}>
                                                        {updatedAt.split('T')[0]}
                                                    </td>
                                                    <td className={TEI_LIST.tableCellMeta}>
                                                        {updatedBy}
                                                    </td>
                                                    <td className="px-2.5 py-1.5 text-right md:px-3">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-7 px-2.5 text-xs font-medium gap-1.5 text-app-primary hover:bg-app-tint-10 shadow-2xs"
                                                            disabled={!!actionLoading || bulkActionLoading}
                                                            onClick={() => doRestore(item)}
                                                        >
                                                            {actionLoading === id ? (
                                                                <Spinner className="h-3 w-3 border-app-primary/30 border-t-app-primary" />
                                                            ) : (
                                                                <RefreshCcw className="h-3 w-3" />
                                                            )}
                                                            {i18n.t('Restore')}
                                                        </Button>
                                                    </td>
                                                </tr>
                                            )
                                        }))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile list view */}
                            <div className={cn(TEI_LIST.mobileList, loading && results.length > 0 && 'opacity-60 transition-opacity')}>
                                {loading && results.length === 0 ? (
                                    <TeiMobileSkeleton count={6} />
                                ) : (
                                    results.map((item) => {
                                    const id = viewMode === 'PERSONNEL' ? item.id : item.event
                                    const isSelected = selectedIds.has(id)
                                    const updatedAt =
                                        (viewMode === 'PERSONNEL' ? item.tei?.updatedAt : item.updatedAt) || '-'
                                    const updatedBy = formatTrashUser(
                                        viewMode === 'PERSONNEL' ? item.tei?.updatedBy : item.updatedBy,
                                        viewMode === 'PERSONNEL' ? item.tei?.storedBy : item.storedBy
                                    )
                                    const label =
                                        viewMode === 'PERSONNEL'
                                            ? getPrimaryLabel(item)
                                            : getEventClientLabel(item)
                                    const stageName =
                                        viewMode === 'EVENTS'
                                            ? stagesMap.get(item.programStage)?.displayName || item.programStage
                                            : null

                                    return (
                                        <div
                                            key={id}
                                            className={cn(
                                                'flex items-center justify-between gap-2.5 px-3.5 py-3 hover:bg-slate-50/90 dark:hover:bg-zinc-800/50 transition-colors',
                                                isSelected && 'bg-emerald-50/50 dark:bg-emerald-950/20'
                                            )}
                                        >
                                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                <input
                                                    type="checkbox"
                                                    className={TEI_LIST.checkbox}
                                                    checked={isSelected}
                                                    onChange={() => toggleSelectRow(id)}
                                                    aria-label={i18n.t('Select row')}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <MixedScriptText
                                                        value={label}
                                                        className="truncate text-[13.5px] font-bold text-slate-900 dark:text-zinc-100 tracking-tight"
                                                    />
                                                    {stageName && (
                                                        <div className="text-[11px] font-medium text-slate-600 dark:text-zinc-300">
                                                            {stageName}
                                                        </div>
                                                    )}
                                                    <div className="mt-1 flex items-center gap-2 text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                                                        <span>{updatedAt.split('T')[0]}</span>
                                                        <span className="text-slate-300" aria-hidden>
                                                            ·
                                                        </span>
                                                        <span>{updatedBy}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 items-center">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 px-2.5 text-xs font-medium gap-1.5 text-app-primary hover:bg-app-tint-10"
                                                    disabled={!!actionLoading || bulkActionLoading}
                                                    onClick={() => doRestore(item)}
                                                >
                                                    {actionLoading === id ? (
                                                        <Spinner className="h-3 w-3 border-app-primary/30 border-t-app-primary" />
                                                    ) : (
                                                        <RefreshCcw className="h-3 w-3" />
                                                    )}
                                                    {i18n.t('Restore')}
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                }))}
                            </div>

                            {!loading && results.length === 0 && (
                                <TeiListEmptyState
                                    title={
                                        notice && notice.type === 'success'
                                            ? notice.text
                                            : i18n.t('No deleted items found.')
                                    }
                                    icon={Trash2}
                                >
                                    {notice && notice.type === 'error' ? (
                                        <p className="text-red-500 font-medium">
                                            {notice.text.includes(
                                                'Program or Tracked entity type should be specified'
                                            ) || notice.text.includes('កម្មវិធី')
                                                ? 'សូមជ្រើសរើស កម្មវិធី (Program) ដើម្បីស្វែងរកទិន្នន័យដែលបានលុប'
                                                : notice.text}
                                        </p>
                                    ) : (
                                        <p>{i18n.t('There are no deleted records for the selected filters.')}</p>
                                    )}
                                </TeiListEmptyState>
                            )}
                        </div>

                        {/* Footer matching TeiResultsContent footer */}
                        <div className={TEI_LIST.footer}>
                            {/* Left: Summary Count */}
                            <div className={cn(TEI_LIST.footerMeta, 'shrink-0')}>
                                <span className="hidden text-[11px] md:text-xs font-medium text-slate-500 md:inline">
                                    {i18n.t('Showing')}{' '}
                                </span>
                                <span>
                                    <span className={TEI_LIST.footerMetaStrong}>
                                        {results.length > 0 ? (pager.page - 1) * pager.pageSize + 1 : 0}
                                    </span>
                                    <span className="mx-0.5 text-slate-400">-</span>
                                    <span className={TEI_LIST.footerMetaStrong}>
                                        {(pager.page - 1) * pager.pageSize + results.length}
                                    </span>
                                    {pager.total > 0 && (
                                        <>
                                            <span className="mx-1 text-slate-400">/</span>
                                            <span className={TEI_LIST.footerMetaStrong}>
                                                {pager.total || 0}
                                            </span>
                                        </>
                                    )}
                                </span>
                            </div>

                            {/* Center: Pagination Nav */}
                            <div className="flex flex-1 items-center justify-center px-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                <PaginationNav
                                    page={pager.page}
                                    pageSize={pager.pageSize}
                                    total={pager.total || 0}
                                    onPageChange={(p) => fetchTrash(p)}
                                    disabled={loading}
                                />
                            </div>

                            {/* Right: Page Size Selector */}
                            <div className="flex shrink-0 items-center justify-end gap-1.5">
                                <span className="hidden whitespace-nowrap text-[11px] font-medium text-slate-500 md:inline sm:text-xs">
                                    {i18n.t('Per Page')}
                                </span>
                                <Select
                                    value={String(pager.pageSize)}
                                    onValueChange={(val) => fetchTrash(1, Number(val))}
                                    options={[5, 10, 15, 20, 50].map((size) => ({
                                        value: String(size),
                                        label: String(size),
                                    }))}
                                    className="h-7 w-[4.25rem] rounded-lg border-slate-200/90 bg-slate-50 px-2 text-xs font-semibold text-slate-700 shadow-none md:h-8 md:w-[4.75rem]"
                                />
                            </div>
                        </div>

                        {loading && (
                            <TeiListLoadingOverlay
                                label={i18n.t('Loading Trash...')}
                                compact={results.length > 0}
                                showTopBar={false}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
