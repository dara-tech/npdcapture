import { useState, useEffect, useCallback, useMemo } from 'react'
import { searchTrackedEntities } from '../services/trackerApi'
import { resolvePeriodDateRange } from '../utils/visualizePeriods'

function getDayString(d) {
    if (!d) return ''
    if (typeof d === 'string') {
        return d.includes('T') ? d.split('T')[0] : d.slice(0, 10)
    }
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

function getStartOfWeek(date) {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday as first day
    return new Date(d.setDate(diff))
}

function getWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
    return Math.ceil(((date - yearStart) / 86400000 + 1) / 7)
}

export function useRegistrationAnalytics({ engine, context, viewMode = 'ENROLLMENTS', selectedStageId = 'all' }) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [records, setRecords] = useState([])

    // Determine the date range from context period or default to current month
    const { startDate, endDate, totalDays } = useMemo(() => {
        const range = resolvePeriodDateRange(context)
        if (range?.startDate && range?.endDate) {
            const start = new Date(range.startDate)
            const end = new Date(range.endDate)
            const diffTime = Math.abs(end - start)
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
            return {
                startDate: range.startDate,
                endDate: range.endDate,
                totalDays: Math.min(diffDays, 365),
            }
        }

        const now = new Date()
        const year = now.getFullYear()
        const month = now.getMonth()
        const start = new Date(year, month, 1)
        const lastDay = new Date(year, month + 1, 0).getDate()
        const end = new Date(year, month, lastDay)
        return {
            startDate: getDayString(start),
            endDate: getDayString(end),
            totalDays: lastDay,
        }
    }, [context?.periodKeys, context?.period, context?.customPeriodRange])

    const fetchAnalytics = useCallback(async () => {
        if (!context?.orgUnit || !context?.program) {
            setRecords([])
            return
        }

        setLoading(true)
        setError(null)

        try {
            const allInstances = []
            let page = 1
            let hasMore = true
            const pageSize = 200

            while (hasMore && page <= 6) {
                const response = await searchTrackedEntities({
                    engine,
                    orgUnit: context.orgUnit,
                    ouMode: 'DESCENDANTS',
                    program: context.program,
                    startDate,
                    endDate,
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

            setRecords(allInstances)
        } catch (err) {
            console.error('Failed to load registration analytics', err)
            setError(err.message || 'Failed to fetch registration data')
            setRecords([])
        } finally {
            setLoading(false)
        }
    }, [engine, context?.orgUnit, context?.program, startDate, endDate])

    useEffect(() => {
        fetchAnalytics()
    }, [fetchAnalytics])

    // Aggregate data by day, week, month according to viewMode (ENROLLMENTS vs EVENTS)
    const analytics = useMemo(() => {
        const todayStr = getDayString(new Date())
        const startOfWeekStr = getDayString(getStartOfWeek(new Date()))

        // Build list of dates for the range
        const dailyMap = {}
        const start = new Date(startDate)
        const end = new Date(endDate)

        const current = new Date(start)
        let dayCounter = 1
        while (current <= end) {
            const dateStr = getDayString(current)
            const dayName = current.toLocaleDateString('en-US', { weekday: 'short' })
            dailyMap[dateStr] = {
                date: dateStr,
                dayNumber: current.getDate(),
                displayIndex: dayCounter++,
                dayName,
                count: 0,
                isToday: dateStr === todayStr,
            }
            current.setDate(current.getDate() + 1)
        }

        let todayCount = 0
        let thisWeekCount = 0
        let thisMonthCount = 0
        let totalPeriodCount = 0

        const now = new Date()
        const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

        // Stage counts map for filtering
        const stagesCountMap = {}

        if (viewMode === 'EVENTS') {
            // Aggregate all events (including enrollments without events)
            for (const rec of records) {
                const enrollments = rec.enrollments || []
                for (const enr of enrollments) {
                    const events = enr.events || []
                    if (events.length === 0) {
                        // Count enrollments without events into event data
                        if (selectedStageId === 'all') {
                            const enrDate = enr.enrolledAt || enr.enrollmentDate || enr.createdAt || rec.createdAt
                            const dateKey = getDayString(enrDate)

                            if (dateKey) {
                                totalPeriodCount++
                                if (dateKey === todayStr) todayCount++
                                if (dateKey >= startOfWeekStr && dateKey <= todayStr) thisWeekCount++
                                if (dateKey.startsWith(currentMonthPrefix)) thisMonthCount++

                                if (dailyMap[dateKey]) {
                                    dailyMap[dateKey].count++
                                }
                            }
                        }
                        continue
                    }
                    for (const ev of events) {
                        const stage = ev.programStage || 'unknown'
                        stagesCountMap[stage] = (stagesCountMap[stage] || 0) + 1

                        if (selectedStageId !== 'all' && ev.programStage !== selectedStageId) {
                            continue
                        }

                        const eventDate = ev.eventDate || ev.occurredAt || ev.createdAt
                        const dateKey = getDayString(eventDate)

                        if (dateKey) {
                            totalPeriodCount++
                            if (dateKey === todayStr) todayCount++
                            if (dateKey >= startOfWeekStr && dateKey <= todayStr) thisWeekCount++
                            if (dateKey.startsWith(currentMonthPrefix)) thisMonthCount++

                            if (dailyMap[dateKey]) {
                                dailyMap[dateKey].count++
                            }
                        }
                    }
                }
            }
        } else {
            // Aggregate enrollments / registrations
            for (const rec of records) {
                const created = rec.createdAt || rec.created || rec.enrollments?.[0]?.enrolledAt || rec.enrollments?.[0]?.enrollmentDate
                const dateKey = getDayString(created)

                if (dateKey) {
                    totalPeriodCount++
                    if (dateKey === todayStr) todayCount++
                    if (dateKey >= startOfWeekStr && dateKey <= todayStr) thisWeekCount++
                    if (dateKey.startsWith(currentMonthPrefix)) thisMonthCount++

                    if (dailyMap[dateKey]) {
                        dailyMap[dateKey].count++
                    }
                }
            }
        }

        // 1. Daily List
        let runningDailyTotal = 0
        let maxDailyCount = 0
        let peakDay = null

        const dailyList = Object.values(dailyMap).map((item) => {
            runningDailyTotal += item.count
            if (item.count > maxDailyCount) {
                maxDailyCount = item.count
                peakDay = item
            }
            return {
                ...item,
                cumulative: runningDailyTotal,
                percentage: totalPeriodCount > 0 ? ((item.count / totalPeriodCount) * 100).toFixed(1) : '0.0',
            }
        })

        // 2. Weekly Aggregation List
        const weeklyMap = {}
        let weekIndex = 1
        for (const day of dailyList) {
            const d = new Date(day.date)
            const wStart = getStartOfWeek(d)
            const wEnd = new Date(wStart)
            wEnd.setDate(wStart.getDate() + 6)
            const wKey = getDayString(wStart)
            const wNo = getWeekNumber(wStart)

            if (!weeklyMap[wKey]) {
                const startLabel = `${String(wStart.getMonth() + 1).padStart(2, '0')}/${String(wStart.getDate()).padStart(2, '0')}`
                const endLabel = `${String(wEnd.getMonth() + 1).padStart(2, '0')}/${String(wEnd.getDate()).padStart(2, '0')}`
                weeklyMap[wKey] = {
                    key: wKey,
                    index: weekIndex++,
                    weekNumber: wNo,
                    startDate: wKey,
                    endDate: getDayString(wEnd),
                    label: `W${wNo}`,
                    subLabel: `${startLabel}-${endLabel}`,
                    fullLabel: `Week ${wNo} (${startLabel} → ${endLabel})`,
                    count: 0,
                    isCurrent: false,
                }
            }
            weeklyMap[wKey].count += day.count
            if (day.isToday) {
                weeklyMap[wKey].isCurrent = true
            }
        }

        let runningWeeklyTotal = 0
        let maxWeeklyCount = 0
        let peakWeek = null
        const weeklyList = Object.values(weeklyMap).map((item) => {
            runningWeeklyTotal += item.count
            if (item.count > maxWeeklyCount) {
                maxWeeklyCount = item.count
                peakWeek = item
            }
            return {
                ...item,
                cumulative: runningWeeklyTotal,
                percentage: totalPeriodCount > 0 ? ((item.count / totalPeriodCount) * 100).toFixed(1) : '0.0',
            }
        })

        // 3. Monthly Aggregation List
        const monthlyMap = {}
        let monthIndex = 1
        for (const day of dailyList) {
            const mKey = day.date.slice(0, 7) // "2026-04"
            if (!monthlyMap[mKey]) {
                const [y, m] = mKey.split('-')
                const dateObj = new Date(Number(y), Number(m) - 1, 1)
                const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' })
                monthlyMap[mKey] = {
                    key: mKey,
                    index: monthIndex++,
                    year: y,
                    month: m,
                    label: monthName,
                    fullLabel: `${monthName} ${y}`,
                    count: 0,
                    isCurrent: mKey === currentMonthPrefix,
                }
            }
            monthlyMap[mKey].count += day.count
        }

        let runningMonthlyTotal = 0
        let maxMonthlyCount = 0
        let peakMonth = null
        const monthlyList = Object.values(monthlyMap).map((item) => {
            runningMonthlyTotal += item.count
            if (item.count > maxMonthlyCount) {
                maxMonthlyCount = item.count
                peakMonth = item
            }
            return {
                ...item,
                cumulative: runningMonthlyTotal,
                percentage: totalPeriodCount > 0 ? ((item.count / totalPeriodCount) * 100).toFixed(1) : '0.0',
            }
        })

        const activeDaysCount = dailyList.filter((d) => d.count > 0).length
        const avgPerActiveDay = activeDaysCount > 0 ? (totalPeriodCount / activeDaysCount).toFixed(1) : '0'
        const avgPerDay = (totalPeriodCount / (totalDays || 1)).toFixed(1)

        return {
            todayCount,
            thisWeekCount,
            thisMonthCount,
            totalPeriodCount,
            dailyList,
            maxDailyCount,
            peakDay,
            weeklyList,
            maxWeeklyCount,
            peakWeek,
            monthlyList,
            maxMonthlyCount,
            peakMonth,
            totalDays,
            avgPerDay,
            avgPerActiveDay,
            activeDaysCount,
            startDate,
            endDate,
            stagesCountMap,
        }
    }, [records, startDate, endDate, totalDays, viewMode, selectedStageId])

    return {
        loading,
        error,
        refetch: fetchAnalytics,
        recordsCount: records.length,
        rawRecords: records,
        ...analytics,
    }
}
