import { useState, useEffect, useCallback, useMemo } from 'react'
import { searchTrackedEntities, searchEvents, fetchProgramMetadata } from '../../../services/trackerApi'
import { normalizeProgramMetadata } from '../../../services/metadataService'
import { resolvePeriodDateRange, getPeriodByKey, resolvePeriodKeys } from '../../../utils/visualizePeriods'
import { aggregateMonthlyReportData } from '../lib/monthlyReportAggregator'

export function useMonthlyReportData({ engine, context, viewMode: propViewMode }) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [teis, setTeis] = useState([])
    const [metadata, setMetadata] = useState(null)

    const effectiveViewMode = context?.viewMode || propViewMode || 'ENROLLMENTS'
    const isEventsMode = effectiveViewMode === 'EVENTS'

    const hasPeriod = Boolean(
        (context?.periodKeys && context.periodKeys.length > 0) ||
        (context?.period && context.period !== 'custom') ||
        (context?.customPeriodRange?.startDate && context?.customPeriodRange?.endDate)
    )

    // Calculate active period range & label
    const periodRange = useMemo(() => {
        if (!hasPeriod) return null
        const range = resolvePeriodDateRange(context)
        if (range?.startDate && range?.endDate) {
            let label = ''
            if (context?.periodKeys?.length) {
                const resolved = resolvePeriodKeys(context.periodKeys)
                label = resolved.map((p) => p.label).join(', ')
            } else if (context?.period) {
                const p = getPeriodByKey(context.period)
                label = p?.label || context.period
            } else if (context?.customPeriodRange?.startDate && context?.customPeriodRange?.endDate) {
                label = `${context.customPeriodRange.startDate} → ${context.customPeriodRange.endDate}`
            }
            return {
                startDate: range.startDate,
                endDate: range.endDate,
                label: label || `${range.startDate} → ${range.endDate}`,
            }
        }
        return null
    }, [hasPeriod, context?.periodKeys, context?.period, context?.customPeriodRange])

    const fetchData = useCallback(async () => {
        if (!context?.orgUnit || !context?.program || !hasPeriod || !periodRange?.startDate || !periodRange?.endDate) {
            setTeis([])
            setMetadata(null)
            return
        }

        setLoading(true)
        setError(null)

        try {
            // 1. Fetch Program Metadata
            const programRaw = await fetchProgramMetadata({ engine, programId: context.program })
            const normalizedMeta = normalizeProgramMetadata(programRaw)
            setMetadata(normalizedMeta)

            // 2. Fetch records according to effectiveViewMode (EVENTS vs ENROLLMENTS)
            if (isEventsMode) {
                // Fetch all events that occurred in the period
                const allEvents = []
                let page = 1
                let hasMore = true
                const pageSize = 200

                while (hasMore && page <= 8) {
                    const response = await searchEvents({
                        engine,
                        orgUnit: context.orgUnit,
                        ouMode: 'DESCENDANTS',
                        program: context.program,
                        startDate: periodRange.startDate,
                        endDate: periodRange.endDate,
                        page,
                        pageSize,
                        order: 'occurredAt:desc',
                    })

                    const instances = response?.instances || []
                    allEvents.push(...instances)

                    if (instances.length < pageSize || !response?.pager?.total || allEvents.length >= response.pager.total) {
                        hasMore = false
                    } else {
                        page += 1
                    }
                }

                setTeis(allEvents)
            } else {
                // Fetch Tracked Entities in date range
                const allInstances = []
                let page = 1
                let hasMore = true
                const pageSize = 200

                while (hasMore && page <= 8) {
                    const response = await searchTrackedEntities({
                        engine,
                        orgUnit: context.orgUnit,
                        ouMode: 'DESCENDANTS',
                        program: context.program,
                        startDate: periodRange.startDate,
                        endDate: periodRange.endDate,
                        page,
                        pageSize,
                        order: 'createdAt:desc',
                    })

                    const instances = response?.instances || []
                    allInstances.push(...instances)

                    if (instances.length < pageSize || !response?.pager?.total || allInstances.length >= response.pager.total) {
                        hasMore = false
                    } else {
                        page += 1
                    }
                }

                setTeis(allInstances)
            }
        } catch (err) {
            console.error('Monthly report fetch error:', err)
            setError(err.message || 'Failed to fetch monthly report data')
        } finally {
            setLoading(false)
        }
    }, [engine, context?.orgUnit, context?.program, hasPeriod, periodRange?.startDate, periodRange?.endDate, isEventsMode])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const reportData = useMemo(() => {
        if (!hasPeriod || !periodRange || !metadata) return null
        return aggregateMonthlyReportData({
            teis,
            metadata,
            periodRange,
        })
    }, [hasPeriod, teis, metadata, periodRange])

    return {
        loading,
        error,
        refetch: fetchData,
        reportData,
        periodRange,
        metadata,
        hasPeriod,
        viewMode: effectiveViewMode,
        isEventsMode,
    }
}
