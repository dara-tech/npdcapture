import React, { useState } from 'react'
import i18n from '@dhis2/d2-i18n'
import { ChevronDown, ChevronRight, PlusCircle, MinusCircle } from 'lucide-react'
import { cn } from '../../../lib/utils'

export function DemographicMatrixSection({
    filteredSections = [],
    availableStages = [],
    selectedStageFilter = 'ALL',
    setSelectedStageFilter,
    searchFilter = '',
    setSearchFilter,
    collapsedSections = {},
    toggleSectionCollapse,
    expandAllSections,
    collapseAllSections,
    openDrilldown,
    periodLabel = '',
    className = '',
}) {
    const [expandedDeOptions, setExpandedDeOptions] = useState({})

    const toggleDeOptions = (deKey) => {
        setExpandedDeOptions((prev) => ({
            ...prev,
            [deKey]: !prev[deKey],
        }))
    }

    return (
        <div className={cn("flex flex-col gap-4", className)}>

            {/* Stage Filter Tabs */}
            {availableStages.length > 1 && (
                <div className="flex flex-wrap items-center gap-1.5 print:hidden">
                    <button
                        type="button"
                        onClick={() => setSelectedStageFilter('ALL')}
                        className={cn(
                            'px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer shadow-2xs',
                            selectedStageFilter === 'ALL'
                                ? 'bg-[var(--app-header-bar-bg)] text-white shadow-xs'
                                : 'bg-white text-slate-600 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700'
                        )}
                    >
                        {i18n.t('All Stages')}
                    </button>
                    {availableStages.map((stage) => (
                        <button
                            key={stage}
                            type="button"
                            onClick={() => setSelectedStageFilter(stage)}
                            className={cn(
                                'px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer shadow-2xs',
                                selectedStageFilter === stage
                                    ? 'bg-[var(--app-header-bar-bg)] text-white shadow-xs'
                                    : 'bg-white text-slate-600 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700'
                            )}
                        >
                            {stage}
                        </button>
                    ))}
                </div>
            )}

            {/* Sections List */}
            {filteredSections?.length ? (
                <div className="space-y-5 max-h-[750px] overflow-y-auto custom-scrollbar pr-0.5">
                    {filteredSections.map((sec) => {
                        const isCollapsed = Boolean(collapsedSections[sec.key])

                        return (
                            <div
                                key={sec.key}
                                className="border border-slate-200/90 dark:border-zinc-800 rounded-none overflow-hidden bg-white dark:bg-zinc-900 shadow-xs"
                            >
                                {/* Stage Form Style Section Head Banner */}
                                <div
                                    onClick={() => toggleSectionCollapse(sec.key)}
                                    className="bg-slate-100/80 dark:bg-zinc-800/80 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-zinc-700/80 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-zinc-750 transition-colors select-none"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-none border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-300 shadow-2xs">
                                            {isCollapsed ? (
                                                <ChevronRight className="h-3.5 w-3.5" />
                                            ) : (
                                                <ChevronDown className="h-3.5 w-3.5" />
                                            )}
                                        </span>
                                        <h4 className="text-[12.5px] sm:text-[13px] font-bold text-slate-900 dark:text-zinc-100 tracking-normal leading-tight">
                                            {sec.stageName} <span className="text-slate-400 dark:text-zinc-500 font-normal">/</span> {sec.sectionName}
                                        </h4>
                                    </div>
                                </div>

                                {/* Table with Male & Female and Group Age Header */}
                                {!isCollapsed && (
                                    <div className="overflow-x-auto custom-scrollbar">
                                        <table className="w-full min-w-[720px] table-fixed text-[11px] sm:text-[11.5px] border-collapse font-sans">
                                            <colgroup>
                                                <col className="w-[38%]" />
                                                <col className="w-[6.5%]" />
                                                <col className="w-[6.5%]" />
                                                <col className="w-[6.5%]" />
                                                <col className="w-[7%]" />
                                                <col className="w-[6.5%]" />
                                                <col className="w-[6.5%]" />
                                                <col className="w-[6.5%]" />
                                                <col className="w-[7%]" />
                                                <col className="w-[9%]" />
                                            </colgroup>
                                            <thead className="bg-slate-50/90 dark:bg-zinc-850 text-[10.5px] font-bold text-slate-700 dark:text-zinc-300">
                                                {/* Tier 1 Header */}
                                                <tr className="border-b border-stone-300 dark:border-zinc-700">
                                                    <th rowSpan={2} className="px-2.5 py-1 text-left border-r border-stone-300 dark:border-zinc-700 font-bold">
                                                        {i18n.t('Data Element / Indicator')}
                                                    </th>
                                                    <th colSpan={4} className="px-1.5 py-1 text-center bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 border-r border-stone-300 dark:border-zinc-700 font-bold">
                                                        បុរស (Male)
                                                    </th>
                                                    <th colSpan={4} className="px-1.5 py-1 text-center bg-pink-50/80 dark:bg-pink-950/40 text-pink-900 dark:text-pink-200 border-r border-stone-300 dark:border-zinc-700 font-bold">
                                                        ស្រ្តី (Female)
                                                    </th>
                                                    <th rowSpan={2} className="px-2 py-1 text-right bg-slate-100 dark:bg-zinc-800 font-bold">
                                                        {i18n.t('Total')}
                                                    </th>
                                                </tr>
                                                {/* Tier 2 Header */}
                                                <tr className="border-b border-stone-300 dark:border-zinc-700 text-[10px]">
                                                    <th className="px-1 py-0.5 text-center border-r border-stone-300 dark:border-zinc-700 font-semibold">&lt;15</th>
                                                    <th className="px-1 py-0.5 text-center border-r border-slate-200 dark:border-zinc-800 font-semibold">15-49</th>
                                                    <th className="px-1 py-0.5 text-center border-r border-slate-200 dark:border-zinc-800 font-semibold">&ge;50</th>
                                                    <th className="px-1 py-0.5 text-center font-bold bg-blue-100/50 dark:bg-blue-900/40 border-r border-slate-200 dark:border-zinc-800">សរុប</th>

                                                    <th className="px-1 py-0.5 text-center border-r border-slate-200 dark:border-zinc-800 font-semibold">&lt;15</th>
                                                    <th className="px-1 py-0.5 text-center border-r border-slate-200 dark:border-zinc-800 font-semibold">15-49</th>
                                                    <th className="px-1 py-0.5 text-center border-r border-slate-200 dark:border-zinc-800 font-semibold">&ge;50</th>
                                                    <th className="px-1 py-0.5 text-center font-bold bg-pink-100/50 dark:bg-pink-900/40 border-r border-slate-200 dark:border-zinc-800">សរុប</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                                                {sec.indicators.map((de) => {
                                                    const dm = de.demographics || {
                                                        male: { under15: 0, age15to49: 0, age50plus: 0, total: 0, teis: {} },
                                                        female: { under15: 0, age15to49: 0, age50plus: 0, total: 0, teis: {} },
                                                        total: de.total || 0,
                                                        teis: de.teis || [],
                                                    }

                                                    const freqEntries = Object.entries(de.frequencies || {})
                                                    const hasOptions = freqEntries.length > 1
                                                    const isExpanded = Boolean(expandedDeOptions[de.id])

                                                    return (
                                                        <React.Fragment key={de.id}>
                                                            <tr className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                                                                <td className="px-2.5 py-1 text-slate-800 dark:text-zinc-200 font-semibold border-r border-slate-200 dark:border-zinc-800">
                                                                    <div className="flex items-center justify-between gap-2">
                                                                        <span
                                                                            onClick={() => openDrilldown(de.name, dm.teis, periodLabel)}
                                                                            className="cursor-pointer hover:text-sky-600 transition-colors"
                                                                            title={i18n.t('Click to view all respondents')}
                                                                        >
                                                                            {de.name}
                                                                        </span>
                                                                        {hasOptions && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => toggleDeOptions(de.id)}
                                                                                className="text-slate-400 hover:text-sky-600 transition-colors p-0.5 shrink-0 cursor-pointer"
                                                                                title={isExpanded ? i18n.t('Hide response breakdown') : i18n.t('Show response breakdown')}
                                                                            >
                                                                                {isExpanded ? (
                                                                                    <MinusCircle className="h-3.5 w-3.5 text-sky-600" />
                                                                                ) : (
                                                                                    <PlusCircle className="h-3.5 w-3.5 text-slate-400 hover:text-sky-600" />
                                                                                )}
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </td>

                                                                {/* Male columns */}
                                                                <td onClick={() => dm.male.under15 > 0 && openDrilldown(`${de.name} (បុរស <១៥ឆ្នាំ)`, dm.male.teis?.under15, periodLabel)} className={cn('px-1 py-1 text-center font-mono text-[11px] border-r border-slate-200 dark:border-zinc-800', dm.male.under15 > 0 ? 'cursor-pointer font-bold text-sky-600 hover:underline' : 'text-slate-400')}>
                                                                    {dm.male.under15}
                                                                </td>
                                                                <td onClick={() => dm.male.age15to49 > 0 && openDrilldown(`${de.name} (បុរស ១៥-៤៩ឆ្នាំ)`, dm.male.teis?.age15to49, periodLabel)} className={cn('px-1 py-1 text-center font-mono text-[11px] border-r border-slate-200 dark:border-zinc-800', dm.male.age15to49 > 0 ? 'cursor-pointer font-bold text-sky-600 hover:underline' : 'text-slate-400')}>
                                                                    {dm.male.age15to49}
                                                                </td>
                                                                <td onClick={() => dm.male.age50plus > 0 && openDrilldown(`${de.name} (បុរស ≥៥០ឆ្នាំ)`, dm.male.teis?.age50plus, periodLabel)} className={cn('px-1 py-1 text-center font-mono text-[11px] border-r border-slate-200 dark:border-zinc-800', dm.male.age50plus > 0 ? 'cursor-pointer font-bold text-sky-600 hover:underline' : 'text-slate-400')}>
                                                                    {dm.male.age50plus}
                                                                </td>
                                                                <td onClick={() => dm.male.total > 0 && openDrilldown(`${de.name} (បុរស សរុប)`, dm.male.teis?.all, periodLabel)} className={cn('px-1 py-1 text-center font-mono text-[11px] font-bold bg-blue-50/40 dark:bg-blue-950/20 border-r border-slate-200 dark:border-zinc-800', dm.male.total > 0 ? 'cursor-pointer text-blue-700 dark:text-blue-300 hover:underline' : 'text-slate-400')}>
                                                                    {dm.male.total}
                                                                </td>

                                                                {/* Female columns */}
                                                                <td onClick={() => dm.female.under15 > 0 && openDrilldown(`${de.name} (ស្រ្តី <១៥ឆ្នាំ)`, dm.female.teis?.under15, periodLabel)} className={cn('px-1 py-1 text-center font-mono text-[11px] border-r border-slate-200 dark:border-zinc-800', dm.female.under15 > 0 ? 'cursor-pointer font-bold text-pink-600 hover:underline' : 'text-slate-400')}>
                                                                    {dm.female.under15}
                                                                </td>
                                                                <td onClick={() => dm.female.age15to49 > 0 && openDrilldown(`${de.name} (ស្រ្តី ១៥-៤៩ឆ្នាំ)`, dm.female.teis?.age15to49, periodLabel)} className={cn('px-1 py-1 text-center font-mono text-[11px] border-r border-slate-200 dark:border-zinc-800', dm.female.age15to49 > 0 ? 'cursor-pointer font-bold text-pink-600 hover:underline' : 'text-slate-400')}>
                                                                    {dm.female.age15to49}
                                                                </td>
                                                                <td onClick={() => dm.female.age50plus > 0 && openDrilldown(`${de.name} (ស្រ្តី ≥៥០ឆ្នាំ)`, dm.female.teis?.age50plus, periodLabel)} className={cn('px-1 py-1 text-center font-mono text-[11px] border-r border-slate-200 dark:border-zinc-800', dm.female.age50plus > 0 ? 'cursor-pointer font-bold text-pink-600 hover:underline' : 'text-slate-400')}>
                                                                    {dm.female.age50plus}
                                                                </td>
                                                                <td onClick={() => dm.female.total > 0 && openDrilldown(`${de.name} (ស្រ្តី សរុប)`, dm.female.teis?.all, periodLabel)} className={cn('px-1 py-1 text-center font-mono text-[11px] font-bold bg-pink-50/40 dark:bg-pink-950/20 border-r border-slate-200 dark:border-zinc-800', dm.female.total > 0 ? 'cursor-pointer text-pink-700 dark:text-pink-300 hover:underline' : 'text-slate-400')}>
                                                                    {dm.female.total}
                                                                </td>

                                                                {/* Grand Total */}
                                                                <td onClick={() => de.total > 0 && openDrilldown(`${de.name} (សរុបជារួម)`, dm.teis, periodLabel)} className={cn('px-2.5 py-1 text-right font-mono text-[11.5px] font-bold bg-slate-50 dark:bg-zinc-850', de.total > 0 ? 'cursor-pointer text-slate-900 dark:text-zinc-100 hover:text-sky-600' : 'text-slate-400')}>
                                                                    {de.total}
                                                                </td>
                                                            </tr>

                                                            {/* Sub-options Breakdown if expanded */}
                                                            {isExpanded && freqEntries.map(([optVal, optCount]) => {
                                                                const optDm = de.optionDemographics?.[optVal] || {
                                                                    male: { under15: 0, age15to49: 0, age50plus: 0, total: 0, teis: {} },
                                                                    female: { under15: 0, age15to49: 0, age50plus: 0, total: 0, teis: {} },
                                                                    total: optCount,
                                                                    teis: de.valueTeis?.[optVal] || [],
                                                                }

                                                                return (
                                                                    <tr key={optVal} className="bg-slate-50/50 dark:bg-zinc-850/40 text-[10.5px]">
                                                                        <td className="px-2.5 py-0.75 pl-6 text-slate-700 dark:text-zinc-300 font-medium border-r border-slate-200 dark:border-zinc-800">
                                                                            • {optVal}
                                                                        </td>
                                                                        <td className="px-1 py-0.75 text-center font-mono text-slate-600 dark:text-zinc-400 border-r border-slate-200 dark:border-zinc-800">
                                                                            {optDm.male.under15}
                                                                        </td>
                                                                        <td className="px-1 py-0.75 text-center font-mono text-slate-600 dark:text-zinc-400 border-r border-slate-200 dark:border-zinc-800">
                                                                            {optDm.male.age15to49}
                                                                        </td>
                                                                        <td className="px-1 py-0.75 text-center font-mono text-slate-600 dark:text-zinc-400 border-r border-slate-200 dark:border-zinc-800">
                                                                            {optDm.male.age50plus}
                                                                        </td>
                                                                        <td className="px-1 py-0.75 text-center font-mono font-semibold bg-blue-50/20 text-blue-700 dark:text-blue-300 border-r border-slate-200 dark:border-zinc-800">
                                                                            {optDm.male.total}
                                                                        </td>

                                                                        <td className="px-1 py-0.75 text-center font-mono text-slate-600 dark:text-zinc-400 border-r border-slate-200 dark:border-zinc-800">
                                                                            {optDm.female.under15}
                                                                        </td>
                                                                        <td className="px-1 py-0.75 text-center font-mono text-slate-600 dark:text-zinc-400 border-r border-slate-200 dark:border-zinc-800">
                                                                            {optDm.female.age15to49}
                                                                        </td>
                                                                        <td className="px-1 py-0.75 text-center font-mono text-slate-600 dark:text-zinc-400 border-r border-slate-200 dark:border-zinc-800">
                                                                            {optDm.female.age50plus}
                                                                        </td>
                                                                        <td className="px-1 py-0.75 text-center font-mono font-semibold bg-pink-50/20 text-pink-700 dark:text-pink-300 border-r border-slate-200 dark:border-zinc-800">
                                                                            {optDm.female.total}
                                                                        </td>

                                                                        <td className="px-2.5 py-0.75 text-right font-mono font-bold text-slate-800 dark:text-zinc-200 bg-slate-50/80">
                                                                            {optDm.total}
                                                                        </td>
                                                                    </tr>
                                                                )
                                                            })}
                                                        </React.Fragment>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            ) : (
                <p className="text-xs text-slate-400 py-4 text-center font-medium">
                    {i18n.t('No matching indicators found.')}
                </p>
            )}
        </div>
    )
}
