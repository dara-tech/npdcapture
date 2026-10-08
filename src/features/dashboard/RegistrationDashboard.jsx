import React, { useState } from 'react'
import i18n from '@dhis2/d2-i18n'
import { useDataEngine } from '@dhis2/app-runtime'
import {
    Activity,
    Calendar,
    CalendarDays,
    CalendarRange,
    Download,
    Flame,
    RefreshCw,
    TrendingUp,
    Users,
} from 'lucide-react'
import { useRegistrationAnalytics } from '../../hooks/useRegistrationAnalytics'
import { useI18nLanguage } from '../../hooks/useI18nLanguage'
import { TrackerContextSelector } from '../context/TrackerContextSelector'
import { DataElementAnalyticsPanel } from './DataElementAnalyticsPanel'
import { Spinner } from '../../components/ui/spinner'
import { PAGE_LAYOUT } from '../tei-search/teiListUi'
import { cn } from '../../lib/utils'

export function RegistrationDashboard({ context, setContext }) {
    useI18nLanguage()
    const engine = useDataEngine()

    const [viewMode, setViewMode] = useState('ENROLLMENTS') // 'ENROLLMENTS' | 'EVENTS'
    const [granularity, setGranularity] = useState('auto') // 'auto' | 'day' | 'week' | 'month'
    const [dashboardTab, setDashboardTab] = useState('clinical') // 'clinical' | 'activity' | 'all'
    const [hoveredItem, setHoveredItem] = useState(null)

    const {
        loading,
        error,
        refetch,
        todayCount,
        thisWeekCount,
        thisMonthCount,
        totalPeriodCount,
        dailyList = [],
        maxDailyCount,
        peakDay,
        weeklyList = [],
        maxWeeklyCount,
        peakWeek,
        monthlyList = [],
        maxMonthlyCount,
        peakMonth,
        totalDays,
        avgPerDay,
        activeDaysCount,
        startDate,
        endDate,
        rawRecords = [],
    } = useRegistrationAnalytics({
        engine,
        context,
        viewMode,
    })

    // Determine effective granularity based on period length if 'auto'
    const effectiveGranularity = (() => {
        if (granularity !== 'auto') return granularity
        if (totalDays <= 31) return 'day'
        if (totalDays <= 120) return 'week'
        return 'month'
    })()

    const isEventsMode = viewMode === 'EVENTS'
    const metricLabel = isEventsMode ? i18n.t('Events') : i18n.t('Registrations')
    const metricLabelSingular = isEventsMode ? i18n.t('event') : i18n.t('registration')

    // Current list according to effective granularity
    const activeList =
        effectiveGranularity === 'month'
            ? monthlyList
            : effectiveGranularity === 'week'
              ? weeklyList
              : dailyList

    const maxActiveCount =
        effectiveGranularity === 'month'
            ? maxMonthlyCount
            : effectiveGranularity === 'week'
              ? maxWeeklyCount
              : maxDailyCount

    const peakActiveItem =
        effectiveGranularity === 'month'
            ? peakMonth
            : effectiveGranularity === 'week'
              ? peakWeek
              : peakDay

    const isDenseDayMode = effectiveGranularity === 'day' && activeList.length > 35

    const handleExportCsv = () => {
        if (!activeList.length) return
        let headers = []
        let rows = []

        if (effectiveGranularity === 'month') {
            headers = ['Month', 'Year', isEventsMode ? 'Events' : 'New Registrations', 'Cumulative Count', 'Percentage']
            rows = activeList.map((m) => [m.label, m.year, m.count, m.cumulative, `${m.percentage}%`])
        } else if (effectiveGranularity === 'week') {
            headers = ['Week', 'Start Date', 'End Date', isEventsMode ? 'Events' : 'New Registrations', 'Cumulative Count', 'Percentage']
            rows = activeList.map((w) => [w.label, w.startDate, w.endDate, w.count, w.cumulative, `${w.percentage}%`])
        } else {
            headers = ['Date', 'Day of Week', isEventsMode ? 'Events' : 'New Registrations', 'Cumulative Count', 'Percentage']
            rows = activeList.map((d) => [d.date, d.dayName, d.count, d.cumulative, `${d.percentage}%`])
        }

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement('a')
        link.setAttribute('href', encodedUri)
        link.setAttribute('download', `${isEventsMode ? 'events' : 'registrations'}_${effectiveGranularity}_${startDate}_${endDate}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden gap-1.5">
            {/* Context Toolbar + View Switcher + Refresh Button */}
            <div className={cn(PAGE_LAYOUT.toolbarCard, 'shrink-0 flex flex-wrap items-center justify-between gap-1.5')}>
                <div className="flex-1 min-w-[280px]">
                    <TrackerContextSelector
                        context={context}
                        onChange={setContext}
                        layout="default"
                        showSearch={false}
                        showRecordActions={false}
                        showImportExport={false}
                        showViewModeToggle={false}
                        showColumnConfig={false}
                    />
                </div>

                {/* Dashboard Mode Switcher (Clinical vs Activity vs All) */}
                <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex h-8 items-center rounded-md border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800/90 p-[2px] shadow-2xs">
                        <button
                            type="button"
                            onClick={() => setDashboardTab('clinical')}
                            className={cn(
                                'flex h-full items-center justify-center rounded-[4px] px-2.5 text-[11px] font-semibold transition-all cursor-pointer select-none',
                                dashboardTab === 'clinical'
                                    ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
                                    : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                            )}
                        >
                            {i18n.t('Clinical DE Analytics')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setDashboardTab('activity')}
                            className={cn(
                                'flex h-full items-center justify-center rounded-[4px] px-2.5 text-[11px] font-semibold transition-all cursor-pointer select-none',
                                dashboardTab === 'activity'
                                    ? 'bg-white dark:bg-zinc-700 text-app-primary shadow-xs font-bold'
                                    : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                            )}
                        >
                            {i18n.t('Activity & Timeline')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setDashboardTab('all')}
                            className={cn(
                                'flex h-full items-center justify-center rounded-[4px] px-2.5 text-[11px] font-semibold transition-all cursor-pointer select-none',
                                dashboardTab === 'all'
                                    ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-zinc-100 shadow-xs font-bold'
                                    : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                            )}
                        >
                            {i18n.t('All')}
                        </button>
                    </div>

                    {/* View Mode Switcher (Enrollments vs Events) when in Activity/All view */}
                    {dashboardTab !== 'clinical' && (
                        <div className="flex h-8 items-center rounded-md border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800/90 p-[2px] shadow-2xs">
                            <button
                                type="button"
                                onClick={() => {
                                    setViewMode('ENROLLMENTS')
                                    setHoveredItem(null)
                                }}
                                className={cn(
                                    'flex h-full items-center justify-center rounded-[4px] px-2.5 text-[11px] font-semibold transition-all cursor-pointer select-none',
                                    !isEventsMode
                                        ? 'bg-white dark:bg-zinc-700 text-app-primary shadow-xs font-bold'
                                        : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                                )}
                            >
                                {i18n.t('Enrollments')}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setViewMode('EVENTS')
                                    setHoveredItem(null)
                                }}
                                className={cn(
                                    'flex h-full items-center justify-center rounded-[4px] px-2.5 text-[11px] font-semibold transition-all cursor-pointer select-none',
                                    isEventsMode
                                        ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold'
                                        : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                                )}
                            >
                                {i18n.t('Events')}
                            </button>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={refetch}
                        disabled={loading}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 shadow-2xs hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 cursor-pointer"
                        title={i18n.t('Refresh Data')}
                    >
                        <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                    </button>
                </div>
            </div>

            {/* Scrollable Dashboard Body */}
            <div className="min-h-0 flex-1 overflow-y-auto space-y-1.5 pb-6 pr-0.5">
                {/* Error Banner if any */}
                {error && (
                    <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300">
                        {error}
                    </div>
                )}

                {/* Creative Data Element Visual Analytics (Shown in Clinical & All mode) */}
                {(dashboardTab === 'clinical' || dashboardTab === 'all') && (
                    <DataElementAnalyticsPanel engine={engine} context={context} records={rawRecords} />
                )}

                {/* KPI Summary Cards & Activity Section (Shown in Activity & All mode) */}
                {(dashboardTab === 'activity' || dashboardTab === 'all') && (
                    <>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Card 1: Live Today */}
                    <div className="relative overflow-hidden rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 shadow-2xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                                {i18n.t('Today')}
                            </span>
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                                <Activity className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-2xl font-black tracking-tight text-slate-800 dark:text-zinc-100">
                                {loading ? '...' : todayCount}
                            </span>
                            <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-500">
                                {metricLabel.toLowerCase()}
                            </span>
                        </div>
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                            {i18n.t('Live today')}
                        </div>
                    </div>

                    {/* Card 2: This Week */}
                    <div className="relative overflow-hidden rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 shadow-2xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                                {i18n.t('This Week')}
                            </span>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                                <CalendarDays className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-2xl font-black tracking-tight text-slate-800 dark:text-zinc-100">
                                {loading ? '...' : thisWeekCount}
                            </span>
                            <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-500">
                                {metricLabel.toLowerCase()}
                            </span>
                        </div>
                        <div className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                            {i18n.t('Current 7-day period')}
                        </div>
                    </div>

                    {/* Card 3: This Month */}
                    <div className="relative overflow-hidden rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 shadow-2xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                                {i18n.t('This Month')}
                            </span>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
                                <CalendarRange className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-2xl font-black tracking-tight text-slate-800 dark:text-zinc-100">
                                {loading ? '...' : thisMonthCount}
                            </span>
                            <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-500">
                                {i18n.t('total month')}
                            </span>
                        </div>
                        <div className="mt-2 text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                            {activeDaysCount} {i18n.t('active days with data')}
                        </div>
                    </div>

                    {/* Card 4: Daily Average & Peak */}
                    <div className="relative overflow-hidden rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 shadow-2xs">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-zinc-400">
                                {i18n.t('Daily Average & Peak')}
                            </span>
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
                                <TrendingUp className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-2xl font-black tracking-tight text-slate-800 dark:text-zinc-100">
                                {loading ? '...' : avgPerDay}
                            </span>
                            <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-500">
                                {i18n.t('/ day')}
                            </span>
                        </div>
                        <div className="mt-2 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium truncate">
                            <Flame className="h-3.5 w-3.5 shrink-0" />
                            <span>
                                {peakDay ? `${i18n.t('Peak')}: ${peakDay.date} (${peakDay.count})` : i18n.t('No peak data')}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Timeline Bar Chart Container */}
                <div className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                                <span>
                                    {effectiveGranularity === 'month'
                                        ? isEventsMode
                                            ? i18n.t('Monthly Events Timeline')
                                            : i18n.t('Monthly Registrations Timeline')
                                        : effectiveGranularity === 'week'
                                          ? isEventsMode
                                              ? i18n.t('Weekly Events Timeline')
                                              : i18n.t('Weekly Registrations Timeline')
                                          : isEventsMode
                                            ? i18n.t('Daily Events Timeline')
                                            : i18n.t('Daily Registrations Timeline')}
                                </span>
                                <span className="text-xs font-normal text-slate-500 dark:text-zinc-400">
                                    ({startDate} → {endDate})
                                </span>
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-zinc-400">
                                {effectiveGranularity === 'month'
                                    ? i18n.t('Aggregated totals per calendar month')
                                    : effectiveGranularity === 'week'
                                      ? i18n.t('Aggregated totals per 7-day calendar week')
                                      : i18n.t('Hover over each day bar to view detailed metrics')}
                            </p>
                        </div>

                        {/* Granularity Switcher & Actions */}
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Granularity Switcher */}
                            <div className="flex h-7 items-center rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800/90 p-[2px] shadow-2xs text-xs">
                                {[
                                    { id: 'auto', label: i18n.t('Auto') },
                                    { id: 'day', label: i18n.t('Day') },
                                    { id: 'week', label: i18n.t('Week') },
                                    { id: 'month', label: i18n.t('Month') },
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => {
                                            setGranularity(tab.id)
                                            setHoveredItem(null)
                                        }}
                                        className={cn(
                                            'flex h-full items-center justify-center rounded-md px-2.5 text-[11px] font-medium transition-all cursor-pointer select-none',
                                            granularity === tab.id
                                                ? 'bg-white dark:bg-zinc-700 text-app-primary shadow-xs font-bold'
                                                : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                                        )}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Hover info badge */}
                            {hoveredItem && (
                                <div className="flex items-center gap-1.5 rounded-lg bg-app-tint-10 px-3 py-1 text-xs font-semibold text-app-primary border border-app-primary/20 animate-fade-in">
                                    {effectiveGranularity === 'month' ? (
                                        <CalendarRange className="h-3.5 w-3.5 shrink-0 opacity-80" />
                                    ) : effectiveGranularity === 'week' ? (
                                        <CalendarDays className="h-3.5 w-3.5 shrink-0 opacity-80" />
                                    ) : (
                                        <Calendar className="h-3.5 w-3.5 shrink-0 opacity-80" />
                                    )}
                                    <span>
                                        {hoveredItem.fullLabel || `${hoveredItem.date} (${hoveredItem.dayName})`}:{' '}
                                        <span className="font-bold">{hoveredItem.count}</span> {metricLabel.toLowerCase()} ({hoveredItem.percentage}%)
                                    </span>
                                </div>
                            )}

                            {/* Export CSV Button */}
                            <button
                                type="button"
                                onClick={handleExportCsv}
                                disabled={!activeList.length || loading}
                                className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-zinc-200 shadow-xs hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 cursor-pointer"
                            >
                                <Download className="h-3.5 w-3.5" />
                                <span>{i18n.t('Export CSV')}</span>
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex h-60 items-center justify-center">
                            <Spinner />
                            <span className="ml-2 text-xs text-slate-500">{i18n.t('Loading analytics data...')}</span>
                        </div>
                    ) : activeList.length === 0 ? (
                        <div className="flex h-60 items-center justify-center text-xs text-slate-400">
                            {i18n.t('No data available for this period.')}
                        </div>
                    ) : (
                        <div className="relative pt-6">
                            {/* Grid Y-lines behind bars */}
                            <div className="absolute inset-x-0 top-6 bottom-8 pointer-events-none flex flex-col justify-between opacity-20 dark:opacity-10">
                                <div className="border-b border-dashed border-slate-400 w-full" />
                                <div className="border-b border-dashed border-slate-400 w-full" />
                                <div className="border-b border-dashed border-slate-400 w-full" />
                                <div className="border-b border-slate-300 w-full" />
                            </div>

                            {/* Bar Chart Columns Container */}
                            <div className={cn('relative w-full', isDenseDayMode && 'overflow-x-auto pb-2')}>
                                <div
                                    style={{
                                        minWidth: isDenseDayMode ? `${Math.max(activeList.length * 20, 750)}px` : '100%',
                                    }}
                                    className="relative flex items-end gap-1 sm:gap-2 h-52 border-b border-slate-200 dark:border-zinc-800 pb-1 z-10"
                                >
                                    {activeList.map((item, idx) => {
                                        const maxVal = maxActiveCount > 0 ? maxActiveCount : 1
                                        const calculatedHeightPx =
                                            item.count > 0 ? Math.max(Math.round((item.count / maxVal) * 160), 16) : 4
                                        const isPeak = maxActiveCount > 0 && item.count === maxActiveCount
                                        const isCurrentHovered =
                                            hoveredItem?.key === item.key ||
                                            (hoveredItem?.date && hoveredItem.date === item.date)

                                        // In dense day mode, avoid crowding numbers on top of small bars
                                        const showNumberOnTop =
                                            activeList.length <= 35
                                                ? item.count > 0
                                                : isCurrentHovered || (isPeak && item.count > 0)

                                        // Label formatting for bottom axis
                                        let bottomLabel = item.label || item.dayNumber
                                        if (isDenseDayMode) {
                                            // In dense mode, only show label for day 1, multiples of 5, or hovered
                                            const showDayLabel =
                                                item.dayNumber === 1 || item.dayNumber % 5 === 0 || isCurrentHovered
                                            bottomLabel = showDayLabel ? item.dayNumber : ''
                                        }

                                        return (
                                            <div
                                                key={item.key || item.date || idx}
                                                className="group relative flex-1 flex flex-col items-center justify-end h-full cursor-pointer min-w-0"
                                                onMouseEnter={() => setHoveredItem(item)}
                                                onMouseLeave={() => setHoveredItem(null)}
                                            >
                                                {/* Value label on top of bar */}
                                                {showNumberOnTop && (
                                                    <span
                                                        className={cn(
                                                            'mb-1 text-[10px] font-extrabold transition-all select-none whitespace-nowrap',
                                                            isPeak
                                                                ? 'text-amber-600 dark:text-amber-400 scale-110'
                                                                : 'text-slate-700 dark:text-zinc-200',
                                                            isCurrentHovered && 'scale-125 text-app-primary'
                                                        )}
                                                    >
                                                        {item.count}
                                                    </span>
                                                )}

                                                {/* Dynamic Bar Element */}
                                                <div
                                                    style={{ height: `${calculatedHeightPx}px` }}
                                                    className={cn(
                                                        'w-full rounded-t-md transition-all duration-200',
                                                        item.count === 0
                                                            ? 'bg-slate-200/80 dark:bg-zinc-800'
                                                            : isPeak
                                                              ? 'bg-gradient-to-t from-amber-500 via-amber-400 to-yellow-300 shadow-sm'
                                                              : item.isToday || item.isCurrent || item.isCurrentWeek
                                                                ? 'bg-gradient-to-t from-blue-600 to-cyan-400 shadow-sm'
                                                                : isEventsMode
                                                                  ? 'bg-gradient-to-t from-indigo-600 to-violet-400 group-hover:from-indigo-500 group-hover:to-pink-400'
                                                                  : 'bg-gradient-to-t from-app-primary to-cyan-500 group-hover:from-app-primary group-hover:to-cyan-400',
                                                        isCurrentHovered &&
                                                            'ring-2 ring-app-primary ring-offset-1 dark:ring-offset-zinc-900'
                                                    )}
                                                />

                                                {/* Bottom axis label */}
                                                <div className="mt-1.5 flex flex-col items-center select-none min-h-[22px]">
                                                    <span
                                                        className={cn(
                                                            'text-[10px] font-semibold truncate',
                                                            item.isToday || item.isCurrent
                                                                ? 'font-bold text-blue-600 dark:text-blue-400 underline decoration-2'
                                                                : 'text-slate-500 dark:text-zinc-400'
                                                        )}
                                                    >
                                                        {bottomLabel}
                                                    </span>
                                                    {effectiveGranularity === 'week' && item.subLabel && (
                                                        <span className="text-[8px] text-slate-400 dark:text-zinc-500 hidden sm:inline">
                                                            {item.subLabel}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Chart Legend */}
                            <div className="mt-3 flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1.5">
                                        <span
                                            className={cn(
                                                'h-3 w-3 rounded-xs',
                                                isEventsMode ? 'bg-indigo-600' : 'bg-app-primary'
                                            )}
                                        />
                                        <span>{metricLabel}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="h-3 w-3 rounded-xs bg-amber-500" />
                                        <span>
                                            {effectiveGranularity === 'month'
                                                ? i18n.t('Peak Month')
                                                : effectiveGranularity === 'week'
                                                  ? i18n.t('Peak Week')
                                                  : i18n.t('Peak Day')}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="h-3 w-3 rounded-xs bg-blue-600" />
                                        <span>{i18n.t('Current')}</span>
                                    </div>
                                </div>
                                <div>
                                    {i18n.t('Total in Period')}:{' '}
                                    <strong className="text-slate-800 dark:text-zinc-100">{totalPeriodCount}</strong>{' '}
                                    {metricLabel.toLowerCase()}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Adaptive Breakdown Table */}
                <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                            {effectiveGranularity === 'month'
                                ? `${i18n.t('Monthly Summary Data Table')} (${metricLabel})`
                                : effectiveGranularity === 'week'
                                  ? `${i18n.t('Weekly Summary Data Table')} (${metricLabel})`
                                  : `${i18n.t('Daily Summary Data Table')} (${metricLabel})`}
                        </h2>
                        <span className="text-xs text-slate-500 dark:text-zinc-400">
                            {activeList.filter((d) => d.count > 0).length}{' '}
                            {effectiveGranularity === 'month'
                                ? i18n.t('months with data')
                                : effectiveGranularity === 'week'
                                  ? i18n.t('weeks with data')
                                  : i18n.t('days with data')}
                        </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-zinc-800">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 dark:bg-zinc-800/80 text-slate-600 dark:text-zinc-300 font-semibold border-b border-slate-200 dark:border-zinc-800">
                                <tr>
                                    {effectiveGranularity === 'month' ? (
                                        <>
                                            <th className="px-3 py-2.5">#</th>
                                            <th className="px-3 py-2.5">{i18n.t('Month')}</th>
                                            <th className="px-3 py-2.5">{i18n.t('Year')}</th>
                                        </>
                                    ) : effectiveGranularity === 'week' ? (
                                        <>
                                            <th className="px-3 py-2.5">#</th>
                                            <th className="px-3 py-2.5">{i18n.t('Week')}</th>
                                            <th className="px-3 py-2.5">{i18n.t('Date Range')}</th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="px-3 py-2.5">{i18n.t('Day')}</th>
                                            <th className="px-3 py-2.5">{i18n.t('Date')}</th>
                                            <th className="px-3 py-2.5">{i18n.t('Day of Week')}</th>
                                        </>
                                    )}
                                    <th className="px-3 py-2.5 text-right">{metricLabel}</th>
                                    <th className="px-3 py-2.5 text-right">{i18n.t('Cumulative')}</th>
                                    <th className="px-3 py-2.5 text-right">{i18n.t('% of Total')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                                {activeList.map((row, idx) => (
                                    <tr
                                        key={row.key || row.date || idx}
                                        className={cn(
                                            'hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors',
                                            (row.isToday || row.isCurrent) && 'bg-blue-50/50 dark:bg-blue-950/20 font-medium',
                                            row.count > 0 &&
                                                row.count === maxActiveCount &&
                                                'bg-amber-50/30 dark:bg-amber-950/10'
                                        )}
                                    >
                                        <td className="px-3 py-2 font-medium text-slate-700 dark:text-zinc-300">
                                            #{row.index || row.displayIndex || idx + 1}
                                        </td>

                                        {effectiveGranularity === 'month' ? (
                                            <>
                                                <td className="px-3 py-2 font-semibold text-slate-800 dark:text-zinc-200">
                                                    {row.label}
                                                </td>
                                                <td className="px-3 py-2 font-mono text-slate-600 dark:text-zinc-400">
                                                    {row.year}
                                                </td>
                                            </>
                                        ) : effectiveGranularity === 'week' ? (
                                            <>
                                                <td className="px-3 py-2 font-semibold text-slate-800 dark:text-zinc-200">
                                                    {row.label}
                                                </td>
                                                <td className="px-3 py-2 font-mono text-slate-600 dark:text-zinc-400">
                                                    {row.startDate} → {row.endDate}
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-3 py-2 font-mono text-slate-600 dark:text-zinc-400">
                                                    {row.date}
                                                </td>
                                                <td className="px-3 py-2 text-slate-600 dark:text-zinc-400">
                                                    {row.dayName}
                                                </td>
                                            </>
                                        )}

                                        <td className="px-3 py-2 text-right">
                                            <span
                                                className={cn(
                                                    'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold',
                                                    row.count > 0
                                                        ? isEventsMode
                                                          ? 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300'
                                                          : 'bg-app-tint-10 text-app-primary'
                                                        : 'text-slate-400 dark:text-zinc-600 font-normal'
                                                )}
                                            >
                                                {row.count}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium text-slate-700 dark:text-zinc-300">
                                            {row.cumulative}
                                        </td>
                                        <td className="px-3 py-2 text-right text-slate-500 dark:text-zinc-400">
                                            {row.percentage}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                </>
                )}
            </div>
        </div>
    )
}
