import React, { useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import i18n from '@dhis2/d2-i18n'
import { Cross2Icon } from '@radix-ui/react-icons'
import { Trash2 } from 'lucide-react'
import { useDataEngine } from '@dhis2/app-runtime'
import { Button } from '../../components/ui/button'
import { Spinner } from '../../components/ui/spinner'
import { deleteTrackedEntity, fetchProgramMetadata } from '../../services/trackerApi'
import { mapProgramAttributesFromMetadata } from './lib/importProfileAttributes'
import { useTeiSearch } from '../../hooks/useTeiSearch'
import {
    getColumnValue,
} from './helpers'
import { TeiResultsContent } from './components/TeiResultsContent'
import { cn } from '../../lib/utils'
import { resolvePeriodDateRange, isTeiOrEventInDateRange } from '../../utils/visualizePeriods'
import { PAGE_LAYOUT, TEI_LIST } from './teiListUi'

const ConfigColumnsModal = lazy(() =>
    import('./components/ConfigColumnsModal').then((m) => ({ default: m.ConfigColumnsModal }))
)
const DownloadModal = lazy(() =>
    import('./components/DownloadModal').then((m) => ({ default: m.DownloadModal }))
)
const ImportRecordsModal = lazy(() =>
    import('./components/ImportRecordsModal').then((m) => ({ default: m.ImportRecordsModal }))
)
const EventHistoryModal = lazy(() =>
    import('./components/EventHistoryModal').then((m) => ({ default: m.EventHistoryModal }))
)
const SearchPersonnelModal = lazy(() =>
    import('./components/SearchPersonnelModal').then((m) => ({ default: m.SearchPersonnelModal }))
)

export const TeiSearchPanel = ({ 
    context, 
    selectedTei, 
    lastUpdatedTeiId, 
    onSelectTei, 
    onOpenDetail, 
    isSearchModalOpen,
    onCloseSearchModal,
    showDownloadModal,
    setShowDownloadModal,
    showImportModal,
    setShowImportModal,
    onImportSuccess,
    showColumnsModal,
    setShowColumnsModal,
    viewMode,
    isSuperuser = false,
}) => {
    const engine = useDataEngine()
    const [eventsModalTei, setEventsModalTei] = useState(null)
    const [programAttributes, setProgramAttributes] = useState([])
    const [programStages, setProgramStages] = useState([])
    const [dataElementsMap, setDataElementsMap] = useState({})
    const [dataElementMetaMap, setDataElementMetaMap] = useState({})
    const [stagesMap, setStagesMap] = useState({})
    const [visibleAttributeIds, setVisibleAttributeIds] = useState([])
    const [draftAttributeIds, setDraftAttributeIds] = useState([])
    const [draggedIndex, setDraggedIndex] = useState(null)
    const [originalAttributes, setOriginalAttributes] = useState([])
    const [configColumns, setConfigColumns] = useState([])
    const [originalConfigColumns, setOriginalConfigColumns] = useState([])
    const [downloadAttributeIds, setDownloadAttributeIds] = useState([])
    const [bulkSelectedIds, setBulkSelectedIds] = useState(() => new Set())
    const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false)
    const [bulkDeleting, setBulkDeleting] = useState(false)
    const [bulkNotice, setBulkNotice] = useState(null)

    const {
        filters,
        setFilters,
        addFilter,
        removeFilter,
        updateFilter,
        clearFilters,
        clearSearch,
        searchValue,
        setSearchValue,
        results,
        events,
        pager,
        sortConfig,
        handleSort,
        loading,
        loadingMore,
        hasMore,
        loadMore,
        runSearch,
    } = useTeiSearch(engine, context, viewMode)

    // Automatically refresh results when a TEI is updated externally (e.g. from ProfileDetail)
    useEffect(() => {
        if (lastUpdatedTeiId) {
            runSearch(1)
        }
    }, [lastUpdatedTeiId])

    const closeColumnsModal = () => {
        setShowColumnsModal(false)
    }

    useEffect(() => {
        if (!showColumnsModal) {
            return undefined
        }
        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                closeColumnsModal()
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [showColumnsModal])

    useEffect(() => {
        const loadProgramAttributes = async () => {
            if (!context.program) {
                setProgramAttributes([])
                setProgramStages([])
                setVisibleAttributeIds([])
                setConfigColumns([])
                return
            }
            try {
                const metadata = await fetchProgramMetadata({
                    engine,
                    programId: context.program,
                })
                const attributes = mapProgramAttributesFromMetadata(metadata)
                
                // Map all data elements from all stages
                const deMap = {}
                const deMetaMap = {}
                const stMap = {}
                const registerDeMeta = (core) => {
                    if (!core?.id || deMetaMap[core.id]) return
                    deMetaMap[core.id] = {
                        id: core.id,
                        name: core.name,
                        displayName: core.displayName || core.name,
                        valueType: core.valueType,
                        optionSet: core.optionSet,
                    }
                }
                metadata?.programStages?.forEach(stage => {
                    stMap[stage.id] = stage.displayName || stage.name
                    stage.programStageDataElements?.forEach(psde => {
                        if (psde.dataElement) registerDeMeta(psde.dataElement)
                    })
                    stage.programStageSections?.forEach((section) => {
                        section.dataElements?.forEach((de) => registerDeMeta(de))
                    })
                })
                const deList = []
                for (const meta of Object.values(deMetaMap)) {
                    deMap[meta.id] = meta.displayName || meta.name
                    deList.push({
                        id: meta.id,
                        name: meta.displayName || meta.name,
                        type: 'de',
                    })
                }
                setDataElementsMap(deMap)
                setDataElementMetaMap(deMetaMap)
                setStagesMap(stMap)

                const sortedAttributes = [...attributes].sort((a, b) => {
                    const nameA = String(a.displayName || a.name || a.shortName || a.systemName || '').toUpperCase()
                    const nameB = String(b.displayName || b.name || b.shortName || b.systemName || '').toUpperCase()
                    const isPmrsA = nameA.includes('PMRS')
                    const isPmrsB = nameB.includes('PMRS')
                    if (isPmrsA && !isPmrsB) return -1
                    if (!isPmrsA && isPmrsB) return 1
                    return 0
                })

                const attrCols = sortedAttributes.map((a) => ({
                    id: a.id,
                    name: a.displayName || a.name || a.id,
                    type: 'attr',
                }))
                const allCols = [...attrCols, ...deList]
                setConfigColumns(allCols)
                setOriginalConfigColumns(allCols)
                
                setProgramAttributes(sortedAttributes)
                setProgramStages(metadata?.programStages || [])
                setOriginalAttributes([...sortedAttributes])
                const defaultVisible = sortedAttributes.slice(0, 6).map((item) => item.id)
                setVisibleAttributeIds(defaultVisible)
                setDraftAttributeIds(defaultVisible)
                setDownloadAttributeIds(defaultVisible)
            } catch (e) {
                setProgramAttributes([])
                setProgramStages([])
                setVisibleAttributeIds([])
                setConfigColumns([])
            }
        }
        loadProgramAttributes()
    }, [context.program, engine])

    const visibleColumns = useMemo(
        () => configColumns.filter(col => draftAttributeIds.includes(col.id)),
        [configColumns, draftAttributeIds]
    )

    const toggleDraftAttribute = (id) => {
        setDraftAttributeIds((prev) => {
            if (prev.includes(id)) {
                return prev.filter((item) => item !== id)
            }
            return [...prev, id]
        })
    }

    const handleDragStart = (index) => {
        setDraggedIndex(index)
    }

    const handleDragOver = (e, index) => {
        e.preventDefault()
        if (draggedIndex === null || draggedIndex === index) return
        const newCols = [...configColumns]
        const item = newCols[draggedIndex]
        newCols.splice(draggedIndex, 1)
        newCols.splice(index, 0, item)
        setConfigColumns(newCols)
        setDraggedIndex(index)
    }

    const handleDragEnd = () => {
        setDraggedIndex(null)
    }

    const handleResetColumns = () => {
        const defaultVisible = originalAttributes.slice(0, 6).map(attr => attr.id)
        setConfigColumns([...originalConfigColumns])
        setDraftAttributeIds(defaultVisible)
    }

    const sortedResults = useMemo(() => {
        if (!lastUpdatedTeiId || results.length === 0) return results
        const updatedIndex = results.findIndex(tei => tei.trackedEntity === lastUpdatedTeiId)
        if (updatedIndex === -1) return results
        
        const updatedTei = results[updatedIndex]
        const remaining = results.filter((_, i) => i !== updatedIndex)
        return [updatedTei, ...remaining]
    }, [results, lastUpdatedTeiId])

    const bulkSelectEnabled = viewMode === 'ENROLLMENTS' && isSuperuser

    const visibleTrackedEntityIds = useMemo(
        () => sortedResults.map((t) => t.trackedEntity),
        [sortedResults]
    )

    const bulkAllVisibleSelected =
        bulkSelectEnabled &&
        visibleTrackedEntityIds.length > 0 &&
        visibleTrackedEntityIds.every((id) => bulkSelectedIds.has(id))

    const bulkSomeVisibleSelected =
        bulkSelectEnabled && visibleTrackedEntityIds.some((id) => bulkSelectedIds.has(id))

    useEffect(() => {
        setBulkSelectedIds(new Set())
    }, [context.orgUnit, context.program, context.trackedEntityType, viewMode])

    useEffect(() => {
        if (!bulkNotice) {
            return undefined
        }
        const t = window.setTimeout(() => setBulkNotice(null), 7000)
        return () => window.clearTimeout(t)
    }, [bulkNotice])

    const toggleBulkRow = (trackedEntityId) => {
        setBulkSelectedIds((prev) => {
            const n = new Set(prev)
            if (n.has(trackedEntityId)) {
                n.delete(trackedEntityId)
            } else {
                n.add(trackedEntityId)
            }
            return n
        })
    }

    const toggleBulkAllVisible = () => {
        setBulkSelectedIds((prev) => {
            const n = new Set(prev)
            const allSelected = visibleTrackedEntityIds.length > 0 && visibleTrackedEntityIds.every((id) => n.has(id))
            if (allSelected) {
                visibleTrackedEntityIds.forEach((id) => n.delete(id))
            } else {
                visibleTrackedEntityIds.forEach((id) => n.add(id))
            }
            return n
        })
    }

    const confirmBulkDelete = async () => {
        if (bulkSelectedIds.size === 0) {
            return
        }
        setBulkDeleting(true)
        const ids = [...bulkSelectedIds]
        const failures = []
        for (const trackedEntityId of ids) {
            try {
                await deleteTrackedEntity({
                    engine,
                    trackedEntityId,
                    programId: context.program,
                    orgUnitId: context.orgUnit,
                    trackedEntityType: context.trackedEntityType,
                })
            } catch (e) {
                failures.push({ trackedEntityId, message: e?.message || String(e) })
            }
        }
        setBulkDeleting(false)
        setBulkDeleteModalOpen(false)
        const failedIds = new Set(failures.map((f) => f.trackedEntityId))
        const deletedOk = ids.filter((id) => !failedIds.has(id))
        if (deletedOk.length > 0 && selectedTei && deletedOk.includes(selectedTei.trackedEntity)) {
            onSelectTei(null)
        }
        setBulkSelectedIds(new Set(failures.map((f) => f.trackedEntityId)))
        if (failures.length === 0) {
            setBulkNotice({
                type: 'success',
                text: i18n.t('{{count}} personnel deleted', { count: deletedOk.length }),
            })
        } else {
            setBulkNotice({
                type: 'error',
                text: i18n.t('Deleted {{ok}} of {{total}}. {{failed}} failed.', {
                    ok: deletedOk.length,
                    total: ids.length,
                    failed: failures.length,
                }),
            })
        }
        await runSearch(1)
    }

    const dateRange = useMemo(() => resolvePeriodDateRange(context), [
        context.periodKeys,
        context.period,
        context.customPeriodRange,
    ])

    const allEvents = useMemo(() => {
        if (viewMode === 'EVENTS') {
            return events || []
        }
        const teiEvents = sortedResults.flatMap(tei => {
            const enrollments = tei.enrollments || []
            const list = []
            for (const enr of enrollments) {
                const enrEvents = enr.events || []
                if (enrEvents.length === 0) {
                    list.push({
                        event: `enr_${enr.enrollment || tei.trackedEntity}`,
                        enrollment: enr.enrollment,
                        program: enr.program || context.program,
                        programStage: null,
                        orgUnit: enr.orgUnit || tei.orgUnit,
                        orgUnitName: enr.orgUnitName || tei.orgUnitName,
                        trackedEntity: tei.trackedEntity || tei.trackedEntityInstance,
                        eventDate: enr.enrolledAt || enr.enrollmentDate || enr.createdAt || tei.createdAt,
                        occurredAt: enr.enrolledAt || enr.enrollmentDate || enr.createdAt,
                        createdAt: enr.createdAt || tei.createdAt,
                        status: enr.status || 'ACTIVE',
                        dataValues: [],
                        isEnrollmentOnly: true,
                        tei,
                    })
                } else {
                    for (const event of enrEvents) {
                        list.push({
                            ...event,
                            tei,
                        })
                    }
                }
            }
            return list
        })
        const filtered = (dateRange?.startDate && dateRange?.endDate)
            ? teiEvents.filter(e => isTeiOrEventInDateRange(e, dateRange.startDate, dateRange.endDate))
            : teiEvents

        return filtered.sort((a, b) => new Date(b.eventDate || b.occurredAt || b.createdAt || 0) - new Date(a.eventDate || a.occurredAt || a.createdAt || 0))
    }, [viewMode, events, sortedResults, dateRange, context.program])

    const activeFilters = useMemo(() => {
        const list = []
        if (searchValue) {
            list.push({ type: 'query', label: `Search: ${searchValue}`, value: searchValue })
        }
        filters.filter(f => f.attributeId && f.value).forEach(f => {
            const attr = programAttributes.find(a => a.id === f.attributeId)
            list.push({ type: 'attr', label: `${attr?.name || f.attributeId}: ${f.value}`, id: f.id })
        })
        return list
    }, [searchValue, filters, programAttributes])

    const bulkDeleteModal =
        bulkDeleteModalOpen && typeof document !== 'undefined'
            ? createPortal(
                  <div
                      className="modal-backdrop fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[4px]"
                      onClick={() => !bulkDeleting && setBulkDeleteModalOpen(false)}
                      role="presentation"
                  >
                      <div
                          className="modal-panel w-full max-w-md rounded-3xl border border-white/20 bg-white shadow-2xl overflow-hidden"
                          onClick={(e) => e.stopPropagation()}
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="bulk-delete-tei-title"
                          aria-describedby="bulk-delete-tei-desc"
                      >
                          <div className="relative border-b border-slate-100 bg-slate-50/50 px-6 pb-4 pt-6">
                              <div className="mb-1 flex items-center gap-3">
                                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-white shadow-md shadow-red-900/20">
                                      <Trash2 className="h-5 w-5" strokeWidth={2} aria-hidden />
                                  </div>
                                  <h2 id="bulk-delete-tei-title" className="text-lg font-bold tracking-tight text-slate-900">
                                      {i18n.t('Bulk delete personnel')}
                                  </h2>
                              </div>
                              <p id="bulk-delete-tei-desc" className="pl-[52px] text-[13px] font-medium leading-relaxed text-slate-600">
                                  {i18n.t(
                                      'You are about to permanently delete {{count}} personnel. Enrollments and events will be removed if your account is allowed to do so. This cannot be undone.',
                                      { count: bulkSelectedIds.size }
                                  )}
                              </p>
                          </div>
                          <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-6 py-4">
                              <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-9 border-slate-200 px-4"
                                  disabled={bulkDeleting}
                                  onClick={() => setBulkDeleteModalOpen(false)}
                              >
                                  {i18n.t('Cancel')}
                              </Button>
                              <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  className="h-9 gap-2 border-0 bg-red-600 px-4 font-semibold text-white shadow-sm hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:opacity-60"
                                  disabled={bulkDeleting}
                                  onClick={confirmBulkDelete}
                              >
                                  {bulkDeleting ? (
                                      <>
                                          <Spinner className="h-3.5 w-3.5 border-white/30 border-t-white" />
                                          {i18n.t('Deleting...')}
                                      </>
                                  ) : (
                                      i18n.t('Delete')
                                  )}
                              </Button>
                          </div>
                      </div>
                  </div>,
                  document.body
              )
            : null

    return (
        <div className={PAGE_LAYOUT.contentCard}>
            {bulkDeleteModal}
            <Suspense fallback={null}>
                {showColumnsModal && (
                    <ConfigColumnsModal
                        open={showColumnsModal}
                        onClose={closeColumnsModal}
                        configColumns={configColumns}
                        draftAttributeIds={draftAttributeIds}
                        draggedIndex={draggedIndex}
                        toggleDraftAttribute={toggleDraftAttribute}
                        handleDragStart={handleDragStart}
                        handleDragOver={handleDragOver}
                        handleDragEnd={handleDragEnd}
                        handleResetColumns={handleResetColumns}
                        setVisibleAttributeIds={setVisibleAttributeIds}
                    />
                )}

                {showDownloadModal && (
                    <DownloadModal
                        open={showDownloadModal}
                        onClose={() => setShowDownloadModal(false)}
                        programAttributes={programAttributes}
                        downloadAttributeIds={downloadAttributeIds}
                        setDownloadAttributeIds={setDownloadAttributeIds}
                        engine={engine}
                        context={context}
                        filters={filters}
                        searchValue={searchValue}
                        sortConfig={sortConfig}
                        pager={pager}
                    />
                )}

                {showImportModal && (
                    <ImportRecordsModal
                        open={showImportModal}
                        onClose={() => setShowImportModal(false)}
                        engine={engine}
                        context={context}
                        programAttributes={programAttributes}
                        programStages={programStages}
                        isSuperuser={isSuperuser}
                        onImported={() => {
                            runSearch(1)
                            onImportSuccess?.()
                        }}
                    />
                )}

                {eventsModalTei && (
                    <EventHistoryModal
                        tei={eventsModalTei}
                        onClose={() => setEventsModalTei(null)}
                        onOpenDetail={onOpenDetail}
                        stagesMap={stagesMap}
                        dataElementsMap={dataElementsMap}
                        dataElementMetaMap={dataElementMetaMap}
                        visibleAttributes={programAttributes.filter((item) => visibleAttributeIds.includes(item.id))}
                    />
                )}

                {isSearchModalOpen && (
                    <SearchPersonnelModal
                        open={isSearchModalOpen}
                        onClose={onCloseSearchModal}
                        filters={filters}
                        setFilters={setFilters}
                        clearFilters={clearFilters}
                        searchValue={searchValue}
                        setSearchValue={setSearchValue}
                        runSearch={runSearch}
                        programAttributes={programAttributes}
                    />
                )}
            </Suspense>

            {/* Active Filter Chips */}
            {activeFilters.length > 0 && (
                <div
                    className={cn(
                        'flex flex-wrap items-center gap-2 bg-slate-50/80 dark:bg-zinc-800/40 border-b border-slate-200/80 dark:border-zinc-800',
                        PAGE_LAYOUT.insetBar
                    )}
                >
                    {activeFilters.map((f, i) => (
                        <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-full shadow-sm animate-in fade-in zoom-in duration-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{f.label.split(':')[0]}</span>
                            <span className="text-[11px] font-black text-slate-800">{f.label.split(':')[1]}</span>
                            <button
                                onClick={() => f.type === 'query' ? setSearchValue('') : removeFilter(f.id)}
                                className="ml-1 text-slate-400 hover:text-red-500 transition-colors"
                            >
                                <Cross2Icon className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                    <button
                        onClick={clearSearch}
                        type="button"
                        className={TEI_LIST.filterClearAll}
                    >
                        {i18n.t('Clear All')}
                    </button>
                </div>
            )}

            {bulkNotice && (
                <div
                    className={`mx-4 mb-0 mt-3 flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-[13px] font-medium md:mx-5 ${
                        bulkNotice.type === 'success'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                            : 'border-amber-200 bg-amber-50 text-amber-950'
                    }`}
                >
                    <span className="min-w-0 flex-1 leading-snug">{bulkNotice.text}</span>
                    <button
                        type="button"
                        onClick={() => setBulkNotice(null)}
                        className="shrink-0 text-[11px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-800"
                    >
                        {i18n.t('Dismiss')}
                    </button>
                </div>
            )}

            {bulkSelectEnabled && bulkSelectedIds.size > 0 && (
                <div className={TEI_LIST.bulkSelectionBar}>
                    <span className={TEI_LIST.bulkSelectionCount}>
                        {i18n.t('{{count}} selected', { count: bulkSelectedIds.size })}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            className="h-9 rounded-md px-3 text-sm text-slate-700"
                            onClick={() => setBulkSelectedIds(new Set())}
                        >
                            {i18n.t('Clear selection')}
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            className="h-9 gap-1.5 rounded-md border-0 bg-red-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 [&_svg]:size-3.5 [&_svg]:text-white"
                            onClick={() => setBulkDeleteModalOpen(true)}
                        >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                            {i18n.t('Delete selected')}
                        </Button>
                    </div>
                </div>
            )}

            <div className="flex min-h-0 flex-1 flex-col">
            <TeiResultsContent
                viewMode={viewMode}
                visibleColumns={visibleColumns}
                sortConfig={sortConfig}
                handleSort={handleSort}
                results={sortedResults}
                allEvents={allEvents}
                onOpenDetail={onOpenDetail}
                setEventsModalTei={setEventsModalTei}
                getColumnValue={getColumnValue}
                lastUpdatedTeiId={lastUpdatedTeiId}
                programAttributes={programAttributes}
                visibleAttributeIds={visibleAttributeIds}
                stagesMap={stagesMap}
                programId={context.program}
                loading={loading}
                loadingMore={loadingMore}
                hasMore={hasMore}
                onLoadMore={loadMore}
                pager={pager}
                runSearch={runSearch}
                bulkSelectEnabled={bulkSelectEnabled}
                bulkSelectedIds={bulkSelectedIds}
                onBulkToggleRow={toggleBulkRow}
                onBulkToggleAllVisible={toggleBulkAllVisible}
                bulkAllVisibleSelected={bulkAllVisibleSelected}
                bulkSomeVisibleSelected={bulkSomeVisibleSelected}
            />
            </div>
        </div>
    )
}
