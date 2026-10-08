import React, { useMemo, useState, useEffect } from 'react'
import i18n from '@dhis2/d2-i18n'
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
} from 'recharts'
import {
    Activity,
    BarChart3,
    CheckCircle2,
    ChevronDown,
    Filter,
    Layers,
    PieChart as PieIcon,
    Search,
    Sparkles,
    TrendingUp,
    Zap,
} from 'lucide-react'
import { fetchProgramMetadata } from '../../services/trackerApi'
import { normalizeProgramMetadata } from '../../services/metadataService'
import { cn } from '../../lib/utils'

const VIBRANT_PALETTE = [
    '#38bdf8', // sky-400
    '#818cf8', // indigo-400
    '#34d399', // emerald-400
    '#f472b6', // pink-400
    '#fbbf24', // amber-400
    '#a78bfa', // violet-400
    '#2dd4bf', // teal-400
    '#fb923c', // orange-400
    '#94a3b8', // slate-400
]

export function DataElementAnalyticsPanel({ engine, context, records = [] }) {
    const [metadata, setMetadata] = useState(null)
    const [selectedStageId, setSelectedStageId] = useState('all')
    const [selectedDeId, setSelectedDeId] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'explorer' | 'cascade'

    // Load Program Metadata for Stage & Data Element definitions
    useEffect(() => {
        if (!context?.program) {
            setMetadata(null)
            return
        }
        let cancelled = false
        const load = async () => {
            try {
                const raw = await fetchProgramMetadata({ engine, programId: context.program })
                if (cancelled) return
                const normalized = normalizeProgramMetadata(raw)
                setMetadata(normalized)
            } catch (e) {
                console.error('Failed to load program metadata for DE dashboard', e)
            }
        }
        load()
        return () => {
            cancelled = true
        }
    }, [engine, context?.program])

    // Stages from metadata
    const stages = useMemo(() => metadata?.stages || [], [metadata])

    // Collect all Data Elements across stages
    const allDataElements = useMemo(() => {
        if (!stages.length) return []
        const list = []
        const seen = new Set()

        for (const st of stages) {
            for (const de of st.dataElements || []) {
                if (!seen.has(de.id)) {
                    seen.add(de.id)
                    list.push({
                        ...de,
                        stageId: st.id,
                        stageName: st.name,
                    })
                }
            }
        }
        return list
    }, [stages])

    // Filtered DE list for the stage & search
    const filteredDeList = useMemo(() => {
        return allDataElements.filter((de) => {
            if (selectedStageId !== 'all' && de.stageId !== selectedStageId) return false
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase()
                const name = (de.displayName || de.name || '').toLowerCase()
                return name.includes(q)
            }
            return true
        })
    }, [allDataElements, selectedStageId, searchQuery])

    // Set default selected DE when list changes
    useEffect(() => {
        if (filteredDeList.length > 0) {
            const hasOptionSet = filteredDeList.find((de) => de.optionSet?.options?.length > 0)
            if (hasOptionSet && !filteredDeList.some((d) => d.id === selectedDeId)) {
                setSelectedDeId(hasOptionSet.id)
            } else if (!filteredDeList.some((d) => d.id === selectedDeId)) {
                setSelectedDeId(filteredDeList[0].id)
            }
        } else {
            setSelectedDeId('')
        }
    }, [filteredDeList, selectedDeId])

    // Extract all event data values from loaded records
    const eventValuesByDe = useMemo(() => {
        const map = {} // deId -> array of values

        for (const rec of records) {
            const enrollments = rec.enrollments || []
            for (const enr of enrollments) {
                const events = enr.events || []
                for (const ev of events) {
                    if (selectedStageId !== 'all' && ev.programStage !== selectedStageId) {
                        continue
                    }
                    for (const dv of ev.dataValues || []) {
                        if (!map[dv.dataElement]) {
                            map[dv.dataElement] = []
                        }
                        if (dv.value !== undefined && dv.value !== null && String(dv.value).trim() !== '') {
                            map[dv.dataElement].push({
                                value: String(dv.value).trim(),
                                eventDate: ev.eventDate || ev.occurredAt || ev.createdAt,
                                teiId: rec.trackedEntity || rec.trackedEntityInstance,
                            })
                        }
                    }
                }
            }
        }
        return map
    }, [records, selectedStageId])

    // Top Categorical Data Elements (with option sets or booleans)
    const topCategoricalDes = useMemo(() => {
        const candidates = allDataElements.filter(
            (de) =>
                (selectedStageId === 'all' || de.stageId === selectedStageId) &&
                (de.optionSet?.options?.length > 0 || de.valueType === 'BOOLEAN' || de.valueType === 'TRUE_ONLY')
        )

        // Rank by number of recorded values
        return candidates
            .map((de) => {
                const values = eventValuesByDe[de.id] || []
                return { de, count: values.length }
            })
            .sort((a, b) => b.count - a.count)
            .map((c) => c.de)
            .slice(0, 6)
    }, [allDataElements, eventValuesByDe, selectedStageId])

    // Aggregated stats for the currently selected DE
    const selectedDeStats = useMemo(() => {
        if (!selectedDeId) return null
        const de = allDataElements.find((d) => d.id === selectedDeId)
        if (!de) return null

        const rawValues = eventValuesByDe[selectedDeId] || []
        const totalRecorded = rawValues.length

        // Option Set name mapping
        const optionNameMap = new Map()
        if (de.optionSet?.options) {
            for (const opt of de.optionSet.options) {
                optionNameMap.set(String(opt.code), opt.displayName || opt.name || opt.code)
                optionNameMap.set(String(opt.name), opt.displayName || opt.name || opt.code)
            }
        }

        // Frequency distribution
        const freqMap = {}
        for (const item of rawValues) {
            const label = optionNameMap.get(item.value) || item.value
            freqMap[label] = (freqMap[label] || 0) + 1
        }

        const distribution = Object.entries(freqMap)
            .map(([name, count], index) => ({
                name,
                count,
                percentage: totalRecorded > 0 ? ((count / totalRecorded) * 100).toFixed(1) : 0,
                color: VIBRANT_PALETTE[index % VIBRANT_PALETTE.length],
            }))
            .sort((a, b) => b.count - a.count)

        // Numeric calculations if valueType is numeric
        const isNumeric = de.valueType === 'NUMBER' || de.valueType === 'INTEGER' || de.valueType === 'INTEGER_ZERO_OR_POSITIVE'
        let numStats = null
        if (isNumeric && totalRecorded > 0) {
            const numbers = rawValues.map((v) => Number(v.value)).filter((n) => !Number.isNaN(n))
            if (numbers.length > 0) {
                const sum = numbers.reduce((a, b) => a + b, 0)
                const avg = (sum / numbers.length).toFixed(1)
                const min = Math.min(...numbers)
                const max = Math.max(...numbers)
                numStats = { sum, avg, min, max, count: numbers.length }
            }
        }

        return {
            de,
            totalRecorded,
            distribution,
            numStats,
            isNumeric,
        }
    }, [selectedDeId, allDataElements, eventValuesByDe])

    // Care Cascade / Funnel steps (Auto-derived from stages & top categorical outcomes)
    const cascadeSteps = useMemo(() => {
        const totalPatients = records.length
        let totalEvents = 0
        const stageCounts = {}

        for (const rec of records) {
            for (const enr of rec.enrollments || []) {
                for (const ev of enr.events || []) {
                    totalEvents++
                    stageCounts[ev.programStage] = (stageCounts[ev.programStage] || 0) + 1
                }
            }
        }

        const steps = [
            {
                label: i18n.t('Registered Patients'),
                count: totalPatients,
                subLabel: i18n.t('Total Cohort'),
                color: 'from-blue-500 to-cyan-400',
                glow: 'shadow-blue-500/20',
                percent: 100,
            },
        ]

        for (const st of stages.slice(0, 3)) {
            const cnt = stageCounts[st.id] || 0
            const pct = totalPatients > 0 ? Math.min(100, Math.round((cnt / totalPatients) * 100)) : 0
            steps.push({
                label: st.name,
                count: cnt,
                subLabel: `${pct}% of cohort`,
                color: steps.length === 1 ? 'from-indigo-500 to-purple-400' : 'from-emerald-500 to-teal-400',
                glow: steps.length === 1 ? 'shadow-indigo-500/20' : 'shadow-emerald-500/20',
                percent: pct,
            })
        }

        return steps
    }, [records, stages])

    if (!context?.program) {
        return null
    }

    return (
        <div className="space-y-3 pt-1">
            {/* Overview Top Categorical Metrics */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {topCategoricalDes.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white/50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
                            <PieIcon className="h-8 w-8 text-slate-300 dark:text-zinc-600 mb-2" />
                            <p className="text-xs font-semibold text-slate-600 dark:text-zinc-400">
                                {i18n.t('No categorical data element values recorded yet for this period.')}
                            </p>
                            <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">
                                {i18n.t('Use the "DE Explorer" tab to search any Data Element.')}
                            </p>
                        </div>
                    ) : (
                        topCategoricalDes.map((de) => {
                            const raw = eventValuesByDe[de.id] || []
                            const freq = {}
                            const optMap = new Map()
                            de.optionSet?.options?.forEach((o) => optMap.set(o.code, o.displayName || o.name || o.code))

                            raw.forEach((r) => {
                                const label = optMap.get(r.value) || r.value
                                freq[label] = (freq[label] || 0) + 1
                            })

                            const chartData = Object.entries(freq)
                                .map(([name, count], i) => ({
                                    name,
                                    count,
                                    color: VIBRANT_PALETTE[i % VIBRANT_PALETTE.length],
                                }))
                                .sort((a, b) => b.count - a.count)

                            return (
                                <div
                                    key={de.id}
                                    className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                                                {de.stageName || i18n.t('Data Element')}
                                            </span>
                                            <h4 className="truncate text-[13px] font-bold text-slate-800 dark:text-zinc-100" title={de.displayName || de.name}>
                                                {de.displayName || de.name}
                                            </h4>
                                        </div>
                                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                                            {raw.length} {i18n.t('entries')}
                                        </span>
                                    </div>

                                    {/* Donut Chart / Proportion Visualization */}
                                    <div className="my-2 flex items-center justify-between gap-3">
                                        <div className="h-28 w-28 shrink-0">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={chartData}
                                                        innerRadius={28}
                                                        outerRadius={46}
                                                        paddingAngle={3}
                                                        dataKey="count"
                                                    >
                                                        {chartData.map((entry, idx) => (
                                                            <Cell key={`cell-${idx}`} fill={entry.color} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip
                                                        content={({ active, payload }) => {
                                                            if (active && payload && payload.length) {
                                                                const d = payload[0].payload
                                                                return (
                                                                    <div className="rounded-lg border border-slate-200 bg-white/95 p-2 shadow-md backdrop-blur-xs text-[11px] dark:border-zinc-700 dark:bg-zinc-800/95">
                                                                        <div className="font-bold text-slate-800 dark:text-zinc-100">{d.name}</div>
                                                                        <div className="text-indigo-600 dark:text-indigo-400 font-extrabold">
                                                                            {d.count} ({raw.length ? ((d.count / raw.length) * 100).toFixed(1) : 0}%)
                                                                        </div>
                                                                    </div>
                                                                )
                                                            }
                                                            return null
                                                        }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>

                                        {/* Progress Legend Breakdown */}
                                        <div className="min-w-0 flex-1 space-y-1.5">
                                            {chartData.slice(0, 3).map((item) => {
                                                const pct = raw.length ? ((item.count / raw.length) * 100).toFixed(0) : 0
                                                return (
                                                    <div key={item.name} className="text-[11px]">
                                                        <div className="flex items-center justify-between gap-1 mb-0.5">
                                                            <span className="truncate text-slate-600 dark:text-zinc-300 font-medium" title={item.name}>
                                                                {item.name}
                                                            </span>
                                                            <span className="shrink-0 font-bold text-slate-800 dark:text-zinc-100">
                                                                {item.count} <span className="text-[10px] text-slate-400">({pct}%)</span>
                                                            </span>
                                                        </div>
                                                        <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                                                            <div
                                                                className="h-full rounded-full transition-all duration-500"
                                                                style={{ width: `${pct}%`, backgroundColor: item.color }}
                                                            />
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                            {chartData.length > 3 && (
                                                <div className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 pt-0.5">
                                                    +{chartData.length - 3} {i18n.t('other options')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            )}

            {/* TAB 2: CARE CASCADE / PATHWAY FLOW */}
            {activeTab === 'cascade' && (
                <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="mb-4">
                        <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-1.5">
                            <Layers className="h-4 w-4 text-indigo-500" />
                            {i18n.t('Care & Clinical Stage Pathway')}
                        </h4>
                        <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                            {i18n.t('Cohort progression and retention across clinical stages')}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {cascadeSteps.map((step, idx) => (
                            <div
                                key={step.label}
                                className={cn(
                                    'relative overflow-hidden rounded-xl border border-slate-200/60 p-3.5 bg-slate-50/50 dark:border-zinc-800/80 dark:bg-zinc-800/40 shadow-xs flex flex-col justify-between'
                                )}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-zinc-700 text-[10px] font-extrabold text-slate-700 dark:text-zinc-200 shadow-2xs">
                                        {idx + 1}
                                    </span>
                                    <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                                        {step.percent}%
                                    </span>
                                </div>
                                <div>
                                    <div className="text-2xl font-black tracking-tight text-slate-800 dark:text-zinc-100">
                                        {step.count}
                                    </div>
                                    <div className="text-xs font-bold text-slate-700 dark:text-zinc-200 truncate mt-0.5" title={step.label}>
                                        {step.label}
                                    </div>
                                    <div className="text-[11px] text-slate-400 dark:text-zinc-500">
                                        {step.subLabel}
                                    </div>
                                </div>

                                <div className="mt-3 h-2 w-full rounded-full bg-slate-200/60 dark:bg-zinc-700/60 overflow-hidden">
                                    <div
                                        className={cn('h-full rounded-full bg-linear-to-r transition-all duration-700', step.color)}
                                        style={{ width: `${step.percent}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 3: DE EXPLORER & TREEMAP PROPORTION GRID */}
            {activeTab === 'explorer' && (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                    {/* Left: Searchable DE Selector List */}
                    <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-4 flex flex-col h-[340px]">
                        <div className="relative mb-2">
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder={i18n.t('Search Data Elements...')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 focus:outline-hidden"
                            />
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto space-y-1 pr-1">
                            {filteredDeList.map((de) => {
                                const valCount = (eventValuesByDe[de.id] || []).length
                                const isSelected = de.id === selectedDeId
                                return (
                                    <button
                                        key={de.id}
                                        type="button"
                                        onClick={() => setSelectedDeId(de.id)}
                                        className={cn(
                                            'w-full text-left rounded-lg px-2.5 py-2 text-xs transition-all flex items-center justify-between gap-2 cursor-pointer',
                                            isSelected
                                                ? 'bg-indigo-50 border border-indigo-200 text-indigo-900 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-200 font-bold'
                                                : 'hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                                        )}
                                    >
                                        <div className="min-w-0 flex-1 truncate">
                                            <div className="truncate font-semibold">{de.displayName || de.name}</div>
                                            <div className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">{de.stageName}</div>
                                        </div>
                                        <span className={cn(
                                            'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-extrabold',
                                            valCount > 0 ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500'
                                        )}>
                                            {valCount}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Right: Detailed Visualization Card */}
                    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-8 flex flex-col justify-between">
                        {selectedDeStats ? (
                            <>
                                <div className="flex items-start justify-between gap-2 mb-3">
                                    <div>
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                            {selectedDeStats.de.stageName}
                                        </span>
                                        <h3 className="text-base font-bold text-slate-800 dark:text-zinc-100">
                                            {selectedDeStats.de.displayName || selectedDeStats.de.name}
                                        </h3>
                                        <span className="text-xs text-slate-400 dark:text-zinc-500">
                                            {selectedDeStats.totalRecorded} {i18n.t('total values recorded in this period')}
                                        </span>
                                    </div>
                                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-mono font-bold text-slate-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                        {selectedDeStats.de.valueType}
                                    </span>
                                </div>

                                {/* Numeric Summary if applicable */}
                                {selectedDeStats.isNumeric && selectedDeStats.numStats && (
                                    <div className="grid grid-cols-4 gap-2 mb-3 rounded-lg bg-slate-50 p-2.5 dark:bg-zinc-800/60">
                                        <div className="text-center">
                                            <div className="text-[10px] text-slate-400 uppercase font-bold">{i18n.t('Average')}</div>
                                            <div className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">{selectedDeStats.numStats.avg}</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-[10px] text-slate-400 uppercase font-bold">{i18n.t('Min')}</div>
                                            <div className="text-base font-extrabold text-slate-700 dark:text-zinc-200">{selectedDeStats.numStats.min}</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-[10px] text-slate-400 uppercase font-bold">{i18n.t('Max')}</div>
                                            <div className="text-base font-extrabold text-slate-700 dark:text-zinc-200">{selectedDeStats.numStats.max}</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-[10px] text-slate-400 uppercase font-bold">{i18n.t('Sum')}</div>
                                            <div className="text-base font-extrabold text-slate-700 dark:text-zinc-200">{selectedDeStats.numStats.sum}</div>
                                        </div>
                                    </div>
                                )}

                                {/* Treemap Proportion Grid */}
                                {selectedDeStats.distribution.length > 0 ? (
                                    <div className="space-y-2">
                                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                            {i18n.t('Proportion Distribution')}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                            {selectedDeStats.distribution.map((item) => (
                                                <div
                                                    key={item.name}
                                                    className="relative overflow-hidden rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-800/50 shadow-2xs"
                                                >
                                                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-zinc-100">
                                                        <span className="truncate pr-1" title={item.name}>{item.name}</span>
                                                        <span className="text-indigo-600 dark:text-indigo-400">{item.percentage}%</span>
                                                    </div>
                                                    <div className="text-lg font-black text-slate-800 dark:text-zinc-100 mt-1">
                                                        {item.count}
                                                    </div>
                                                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 dark:bg-zinc-700 overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full transition-all duration-500"
                                                            style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-1 items-center justify-center p-8 text-center text-xs text-slate-400">
                                        {i18n.t('No values recorded for this Data Element in the selected period.')}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex flex-1 items-center justify-center text-xs text-slate-400">
                                {i18n.t('Select a Data Element from the list to view its distribution.')}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
