import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { searchTrackedEntities, searchEvents } from '../services/trackerApi'
import { resolvePeriodDateRange, isTeiOrEventInDateRange } from '../utils/visualizePeriods'

function computeHasMore(pager, loadedCount) {
    const pageCount =
        pager.pageCount ??
        (pager.total != null && pager.pageSize
            ? Math.ceil(pager.total / pager.pageSize)
            : null)
    if (pageCount != null) {
        return pager.page < pageCount
    }
    if (pager.total != null) {
        return loadedCount < pager.total
    }
    return loadedCount >= (pager.pageSize || 15)
}

export const useTeiSearch = (engine, context, viewMode = 'ENROLLMENTS') => {
    const [filters, setFilters] = useState([])
    const [searchValue, setSearchValue] = useState('')
    const [results, setResults] = useState([])
    const [events, setEvents] = useState([])
    const [pager, setPager] = useState({ page: 1, pageSize: 15, total: 0 })
    const [sortConfig, setSortConfig] = useState({ columnId: 'createdAt', direction: 'desc' })
    const [loading, setLoading] = useState(false)
    const [loadingMore, setLoadingMore] = useState(false)
    const [error, setError] = useState('')
    const fetchingMoreRef = useRef(false)

    const dateRange = useMemo(() => resolvePeriodDateRange(context), [
        context.periodKeys,
        context.period,
        context.customPeriodRange,
    ])

    const runSearch = useCallback(
        async (
            targetPage = 1,
            targetPageSize = pager.pageSize,
            overrideSort = null,
            overrideFilters = null,
            { append = false, overrideValue = null } = {}
        ) => {
            if (!context.orgUnit || !context.program) {
                setError('Organisation unit and program are required for search.')
                return
            }

            const activeQuery = overrideValue !== null ? overrideValue : searchValue

            try {
                if (append) {
                    setLoadingMore(true)
                } else {
                    setLoading(true)
                }

                if (viewMode === 'EVENTS') {
                    const currentSort = overrideSort || sortConfig
                    const orderCol = currentSort.columnId
                    const orderDir = currentSort.direction || 'desc'
                    const orderParam = (orderCol === 'eventDate' || orderCol === 'createdAt' || orderCol === 'occurredAt')
                        ? `occurredAt:${orderDir}`
                        : 'occurredAt:desc'

                    const { instances, pager: fetchedPager } = await searchEvents({
                        engine,
                        orgUnit: context.orgUnit,
                        ouMode: 'DESCENDANTS',
                        program: context.program,
                        startDate: dateRange?.startDate,
                        endDate: dateRange?.endDate,
                        page: targetPage,
                        pageSize: targetPageSize,
                        order: orderParam,
                        value: activeQuery,
                    })

                    setEvents((prev) => (append ? [...prev, ...instances] : instances))
                    setPager(fetchedPager)
                } else {
                    const { instances, pager: fetchedPager } = await searchTrackedEntities({
                        engine,
                        orgUnit: context.orgUnit,
                        ouMode: 'DESCENDANTS',
                        program: context.program,
                        startDate: dateRange?.startDate,
                        endDate: dateRange?.endDate,
                        filters: overrideFilters !== null ? overrideFilters : filters,
                        value: activeQuery,
                        page: targetPage,
                        pageSize: targetPageSize,
                        order: `${(overrideSort || sortConfig).columnId}:${(overrideSort || sortConfig).direction}`,
                    })

                    // When searching for a specific query, prioritize and isolate exact matches
                    let finalInstances = instances || []
                    if (activeQuery && String(activeQuery).trim()) {
                        const q = String(activeQuery).trim().toLowerCase()
                        const digitsQ = q.replace(/\D/g, '')

                        const exact = finalInstances.filter((tei) => {
                            const id = String(tei.trackedEntity || tei.trackedEntityInstance || '').toLowerCase()
                            if (id === q) return true
                            return (tei.attributes || []).some((a) => {
                                const val = String(a.value || '').trim().toLowerCase()
                                if (val === q) return true
                                // Match if numeric parts are identical (e.g. '1190710' in 'សងបស1190710' vs '1190710' or 'SMH1190710')
                                const digitsVal = val.replace(/\D/g, '')
                                if (digitsQ && digitsVal && digitsQ === digitsVal && digitsQ.length >= 4) {
                                    return true
                                }
                                return false
                            })
                        })
                        if (exact.length > 0) {
                            finalInstances = exact
                        } else {
                            finalInstances = finalInstances.filter((tei) => {
                                const id = String(tei.trackedEntity || tei.trackedEntityInstance || '').toLowerCase()
                                if (id.includes(q) || (digitsQ && digitsQ.length >= 4 && id.includes(digitsQ))) return true
                                return (tei.attributes || []).some((a) => {
                                    const val = String(a.value || '').trim().toLowerCase()
                                    if (val.includes(q) || (val.length >= 3 && q.includes(val))) return true
                                    const digitsVal = val.replace(/\D/g, '')
                                    if (digitsQ && digitsVal && (digitsVal.includes(digitsQ) || digitsQ.includes(digitsVal)) && digitsQ.length >= 3) {
                                        return true
                                    }
                                    return false
                                })
                            })
                        }
                    }

                    setResults((prev) => (append ? [...prev, ...finalInstances] : finalInstances))
                    setPager(fetchedPager)
                }
            } catch (e) {
                setError(e.message || 'Search failed')
                if (!append) {
                    if (viewMode === 'EVENTS') {
                        setEvents([])
                    } else {
                        setResults([])
                    }
                }
            } finally {
                if (append) {
                    setLoadingMore(false)
                } else {
                    setLoading(false)
                }
            }
        },
        [
            engine,
            context.orgUnit,
            context.program,
            dateRange?.startDate,
            dateRange?.endDate,
            filters,
            searchValue,
            sortConfig,
            pager.pageSize,
            viewMode,
        ]
    )

    // Automatically re-run search when orgUnit, program, period date range, or viewMode changes
    useEffect(() => {
        if (context.orgUnit && context.program) {
            runSearch(1)
        }
    }, [context.orgUnit, context.program, dateRange?.startDate, dateRange?.endDate, viewMode])

    const activeList = viewMode === 'EVENTS' ? events : results
    const hasMore = useMemo(
        () => computeHasMore(pager, activeList.length),
        [pager, activeList.length]
    )

    const loadMore = useCallback(async () => {
        if (loading || loadingMore || fetchingMoreRef.current || !hasMore) {
            return
        }
        fetchingMoreRef.current = true
        try {
            await runSearch(pager.page + 1, pager.pageSize, null, null, { append: true })
        } finally {
            fetchingMoreRef.current = false
        }
    }, [loading, loadingMore, hasMore, pager.page, pager.pageSize, runSearch])

    const addFilter = () => {
        setFilters((prev) => [
            ...prev,
            { attributeId: '', value: '', id: Math.random().toString(36).substr(2, 9) },
        ])
    }

    const removeFilter = (id) => {
        setFilters((prev) => prev.filter((f) => f.id !== id))
    }

    const updateFilter = (id, updates) => {
        setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)))
    }

    const clearFilters = () => {
        setFilters([])
    }

    const clearSearch = () => {
        setSearchValue('')
        setFilters([])
        runSearch(1, pager.pageSize, null, [])
    }

    const setPageSize = (size) => {
        setPager((prev) => ({ ...prev, pageSize: size }))
        runSearch(1, size)
    }

    const handleSort = (columnId) => {
        setSortConfig((prev) => {
            const direction =
                prev.columnId === columnId && prev.direction === 'desc' ? 'asc' : 'desc'
            const next = { columnId, direction }
            runSearch(1, pager.pageSize, next)
            return next
        })
    }

    return {
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
        setPageSize,
        sortConfig,
        handleSort,
        loading,
        loadingMore,
        hasMore,
        loadMore,
        error,
        runSearch,
    }
}
