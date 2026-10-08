import React from 'react'
import i18n from '@dhis2/d2-i18n'
import { cn } from '../../../lib/utils'

const KHMER_DIGITS = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩']
function toKhmerNum(num) {
    return String(num).replace(/\d/g, (d) => KHMER_DIGITS[d] || d)
}

export function NchadsReportSection({ programReport, openDrilldown, periodLabel = '', className = '' }) {
    if (!programReport) return null

    const {
        programName = 'Program',
        clientProfile = [],
        sections = [],
    } = programReport

    // Compute Grand Totals for Client Profile
    const clientProfileTotals = clientProfile.reduce(
        (acc, row) => {
            acc.firstVisit += row.firstVisit?.count || 0
            acc.followUp += row.followUp?.count || 0
            acc.maleUnder15 += row.demographics?.male?.under15 || 0
            acc.male15to49 += row.demographics?.male?.age15to49 || 0
            acc.male50plus += row.demographics?.male?.age50plus || 0
            acc.maleTotal += row.demographics?.male?.total || 0
            acc.femaleUnder15 += row.demographics?.female?.under15 || 0
            acc.female15to49 += row.demographics?.female?.age15to49 || 0
            acc.female50plus += row.demographics?.female?.age50plus || 0
            acc.femaleTotal += row.demographics?.female?.total || 0
            acc.grandTotal += row.total || 0
            return acc
        },
        {
            firstVisit: 0,
            followUp: 0,
            maleUnder15: 0,
            male15to49: 0,
            male50plus: 0,
            maleTotal: 0,
            femaleUnder15: 0,
            female15to49: 0,
            female50plus: 0,
            femaleTotal: 0,
            grandTotal: 0,
        }
    )

    return (
        <div className={cn("flex flex-col gap-3 sm:gap-3.5 font-sans", className)}>
            {/* SECTION 1: Client & Demographic Profile (Based on Program Attributes) */}
            <div className="border border-stone-300 dark:border-zinc-700 rounded-none overflow-hidden bg-white dark:bg-zinc-900 shadow-2xs">
                <div className="border-b border-stone-300 dark:border-zinc-700 bg-stone-50/70 dark:bg-zinc-850/60 px-2.5 py-1 sm:py-1.5 flex items-center justify-between gap-2">
                    <h3 className="text-[12.5px] sm:text-[13px] font-bold text-slate-900 dark:text-zinc-100 tracking-normal leading-tight m-0">
                        ១- ចំនួនករណីមកទទួលសេវា (តាមប្រភេទអតិថិជន និងប្រជាសាស្ត្រ)
                    </h3>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full min-w-[720px] table-fixed text-[11px] sm:text-[11.5px] border-collapse font-sans">
                        <colgroup>
                            <col className="w-[30%]" />
                            <col className="w-[8%]" />
                            <col className="w-[8%]" />
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
                            <tr className="border-b border-stone-300 dark:border-zinc-700">
                                <th rowSpan={2} className="px-2.5 py-1 text-left border-r border-stone-300 dark:border-zinc-700 font-bold">
                                    ប្រភេទអតិថិជន / CLIENT TYPE
                                </th>
                                <th rowSpan={2} className="px-1.5 py-1 text-center border-r border-stone-300 dark:border-zinc-700 font-bold">
                                    លើកដំបូង
                                </th>
                                <th rowSpan={2} className="px-1.5 py-1 text-center border-r border-stone-300 dark:border-zinc-700 font-bold">
                                    តាមដាន
                                </th>
                                <th colSpan={4} className="px-1.5 py-1 text-center bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 border-r border-stone-300 dark:border-zinc-700 font-bold">
                                    បុរស (MALE)
                                </th>
                                <th colSpan={4} className="px-1.5 py-1 text-center bg-pink-50/80 dark:bg-pink-950/40 text-pink-900 dark:text-pink-200 border-r border-stone-300 dark:border-zinc-700 font-bold">
                                    ស្រ្តី (FEMALE)
                                </th>
                                <th rowSpan={2} className="px-2 py-1 text-right bg-slate-100 dark:bg-zinc-800 font-bold">
                                    សរុប
                                </th>
                            </tr>
                            <tr className="border-b border-stone-300 dark:border-zinc-700 text-[10px]">
                                <th className="px-1 py-0.5 text-center border-r border-stone-300 dark:border-zinc-700 font-semibold">&lt;15</th>
                                <th className="px-1 py-0.5 text-center border-r border-stone-300 dark:border-zinc-700 font-semibold">15-49</th>
                                <th className="px-1 py-0.5 text-center border-r border-stone-300 dark:border-zinc-700 font-semibold">&ge;50</th>
                                <th className="px-1 py-0.5 text-center font-bold bg-blue-100/50 dark:bg-blue-900/40 border-r border-stone-300 dark:border-zinc-700">សរុប</th>

                                <th className="px-1 py-0.5 text-center border-r border-stone-300 dark:border-zinc-700 font-semibold">&lt;15</th>
                                <th className="px-1 py-0.5 text-center border-r border-stone-300 dark:border-zinc-700 font-semibold">15-49</th>
                                <th className="px-1 py-0.5 text-center border-r border-stone-300 dark:border-zinc-700 font-semibold">&ge;50</th>
                                <th className="px-1 py-0.5 text-center font-bold bg-pink-100/50 dark:bg-pink-900/40 border-r border-stone-300 dark:border-zinc-700">សរុប</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200 dark:divide-zinc-800">
                            {clientProfile.map((row, idx) => {
                                const m = row.demographics?.male || {}
                                const f = row.demographics?.female || {}
                                return (
                                    <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                                        <td className="px-2.5 py-1 text-slate-800 dark:text-zinc-200 font-medium border-r border-stone-200 dark:border-zinc-800">
                                            {row.name}
                                        </td>
                                        <td
                                            onClick={() => row.firstVisit.count > 0 && openDrilldown(`${row.name} (មកលើកដំបូង)`, row.firstVisit.teis, periodLabel)}
                                            className={cn('px-1 py-1 text-center font-mono text-[11px] border-r border-stone-200 dark:border-zinc-800', row.firstVisit.count > 0 ? 'cursor-pointer font-bold text-sky-600 hover:underline' : 'text-slate-500')}
                                        >
                                            {row.firstVisit.count}
                                        </td>
                                        <td
                                            onClick={() => row.followUp.count > 0 && openDrilldown(`${row.name} (មកតាមដាន)`, row.followUp.teis, periodLabel)}
                                            className={cn('px-1 py-1 text-center font-mono text-[11px] border-r border-stone-200 dark:border-zinc-800', row.followUp.count > 0 ? 'cursor-pointer font-bold text-sky-600 hover:underline' : 'text-slate-500')}
                                        >
                                            {row.followUp.count}
                                        </td>

                                        {/* Male */}
                                        <td onClick={() => m.under15 > 0 && openDrilldown(`${row.name} (បុរស <១៥ឆ្នាំ)`, m.teis?.under15, periodLabel)} className={cn('px-1 py-1 text-center font-mono text-[11px] border-r border-stone-200 dark:border-zinc-800', m.under15 > 0 ? 'cursor-pointer font-bold text-sky-600 hover:underline' : 'text-slate-500')}>
                                            {m.under15 || 0}
                                        </td>
                                        <td onClick={() => m.age15to49 > 0 && openDrilldown(`${row.name} (បុរស ១៥-៤៩ឆ្នាំ)`, m.teis?.age15to49, periodLabel)} className={cn('px-1 py-1 text-center font-mono text-[11px] border-r border-stone-200 dark:border-zinc-800', m.age15to49 > 0 ? 'cursor-pointer font-bold text-sky-600 hover:underline' : 'text-slate-500')}>
                                            {m.age15to49 || 0}
                                        </td>
                                        <td onClick={() => m.age50plus > 0 && openDrilldown(`${row.name} (បុរស ≥៥០ឆ្នាំ)`, m.teis?.age50plus, periodLabel)} className={cn('px-1 py-1 text-center font-mono text-[11px] border-r border-stone-200 dark:border-zinc-800', m.age50plus > 0 ? 'cursor-pointer font-bold text-sky-600 hover:underline' : 'text-slate-500')}>
                                            {m.age50plus || 0}
                                        </td>
                                        <td onClick={() => m.total > 0 && openDrilldown(`${row.name} (បុរស សរុប)`, m.teis?.total || m.teis?.all, periodLabel)} className={cn('px-1 py-1 text-center font-mono text-[11px] font-bold bg-blue-50/40 dark:bg-blue-950/20 border-r border-stone-200 dark:border-zinc-800', m.total > 0 ? 'cursor-pointer text-blue-700 dark:text-blue-300 hover:underline' : 'text-slate-500')}>
                                            {m.total || 0}
                                        </td>

                                        {/* Female */}
                                        <td onClick={() => f.under15 > 0 && openDrilldown(`${row.name} (ស្រ្តី <១៥ឆ្នាំ)`, f.teis?.under15, periodLabel)} className={cn('px-1 py-1 text-center font-mono text-[11px] border-r border-stone-200 dark:border-zinc-800', f.under15 > 0 ? 'cursor-pointer font-bold text-pink-600 hover:underline' : 'text-slate-500')}>
                                            {f.under15 || 0}
                                        </td>
                                        <td onClick={() => f.age15to49 > 0 && openDrilldown(`${row.name} (ស្រ្តី ១៥-៤៩ឆ្នាំ)`, f.teis?.age15to49, periodLabel)} className={cn('px-1 py-1 text-center font-mono text-[11px] border-r border-stone-200 dark:border-zinc-800', f.age15to49 > 0 ? 'cursor-pointer font-bold text-pink-600 hover:underline' : 'text-slate-500')}>
                                            {f.age15to49 || 0}
                                        </td>
                                        <td onClick={() => f.age50plus > 0 && openDrilldown(`${row.name} (ស្រ្តី ≥៥០ឆ្នាំ)`, f.teis?.age50plus, periodLabel)} className={cn('px-1 py-1 text-center font-mono text-[11px] border-r border-stone-200 dark:border-zinc-800', f.age50plus > 0 ? 'cursor-pointer font-bold text-pink-600 hover:underline' : 'text-slate-500')}>
                                            {f.age50plus || 0}
                                        </td>
                                        <td onClick={() => f.total > 0 && openDrilldown(`${row.name} (ស្រ្តី សរុប)`, f.teis?.total || f.teis?.all, periodLabel)} className={cn('px-1 py-1 text-center font-mono text-[11px] font-bold bg-pink-50/40 dark:bg-pink-950/20 border-r border-stone-200 dark:border-zinc-800', f.total > 0 ? 'cursor-pointer text-pink-700 dark:text-pink-300 hover:underline' : 'text-slate-500')}>
                                            {f.total || 0}
                                        </td>

                                        {/* Grand Total */}
                                        <td onClick={() => row.total > 0 && openDrilldown(`${row.name} (សរុបជារួម)`, row.teis, periodLabel)} className={cn('px-2.5 py-1 text-right font-mono text-[11.5px] font-bold bg-slate-50 dark:bg-zinc-850', row.total > 0 ? 'cursor-pointer text-slate-900 dark:text-zinc-100 hover:text-sky-600' : 'text-slate-400')}>
                                            {row.total || 0}
                                        </td>
                                    </tr>
                                )
                            })}
                            {/* Total Summary Row */}
                            <tr className="bg-slate-100 dark:bg-zinc-800/80 font-bold border-t-2 border-stone-300 dark:border-zinc-600 text-[11px]">
                                <td className="px-2.5 py-1.25 text-slate-900 dark:text-zinc-100 border-r border-stone-300 dark:border-zinc-700">
                                    សរុប (Grand Total)
                                </td>
                                <td className="px-1 py-1.25 text-center font-mono border-r border-stone-300 dark:border-zinc-700">
                                    {clientProfileTotals.firstVisit}
                                </td>
                                <td className="px-1 py-1.25 text-center font-mono border-r border-stone-300 dark:border-zinc-700">
                                    {clientProfileTotals.followUp}
                                </td>
                                <td className="px-1 py-1.25 text-center font-mono border-r border-stone-300 dark:border-zinc-700">
                                    {clientProfileTotals.maleUnder15}
                                </td>
                                <td className="px-1 py-1.25 text-center font-mono border-r border-stone-300 dark:border-zinc-700">
                                    {clientProfileTotals.male15to49}
                                </td>
                                <td className="px-1 py-1.25 text-center font-mono border-r border-stone-300 dark:border-zinc-700">
                                    {clientProfileTotals.male50plus}
                                </td>
                                <td className="px-1 py-1.25 text-center font-mono bg-blue-100/50 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100 border-r border-stone-300 dark:border-zinc-700">
                                    {clientProfileTotals.maleTotal}
                                </td>
                                <td className="px-1 py-1.25 text-center font-mono border-r border-stone-300 dark:border-zinc-700">
                                    {clientProfileTotals.femaleUnder15}
                                </td>
                                <td className="px-1 py-1.25 text-center font-mono border-r border-stone-300 dark:border-zinc-700">
                                    {clientProfileTotals.female15to49}
                                </td>
                                <td className="px-1 py-1.25 text-center font-mono border-r border-stone-300 dark:border-zinc-700">
                                    {clientProfileTotals.female50plus}
                                </td>
                                <td className="px-1 py-1.25 text-center font-mono bg-pink-100/50 dark:bg-pink-900/40 text-pink-900 dark:text-pink-100 border-r border-stone-300 dark:border-zinc-700">
                                    {clientProfileTotals.femaleTotal}
                                </td>
                                <td className="px-2.5 py-1.25 text-right font-mono text-[11.5px] font-bold text-slate-900 dark:text-zinc-100 bg-slate-200/80 dark:bg-zinc-750">
                                    {clientProfileTotals.grandTotal}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* SECTIONS 2 ... N: Program Stage & Section Indicator Tables (100% Real Program Metadata) */}
            {sections.map((sec, secIndex) => (
                <div
                    key={sec.key}
                    className="border border-stone-300 dark:border-zinc-700 rounded-none overflow-hidden bg-white dark:bg-zinc-900 shadow-2xs"
                >
                    {/* Section Head in Krasar */}
                    <div className="border-b border-stone-300 dark:border-zinc-700 bg-stone-50/70 dark:bg-zinc-850/60 px-2.5 py-1 sm:py-1.5 flex items-center justify-between gap-2">
                        <h3 className="text-[12.5px] sm:text-[13px] font-bold text-slate-900 dark:text-zinc-100 tracking-normal leading-tight m-0">
                            {toKhmerNum(secIndex + 2)}- {sec.stageName} <span className="font-normal text-slate-400 dark:text-zinc-500">/</span> {sec.sectionName}
                        </h3>
                    </div>

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
                                <tr className="border-b border-stone-300 dark:border-zinc-700">
                                    <th rowSpan={2} className="px-2.5 py-1 text-left border-r border-stone-300 dark:border-zinc-700 font-bold">
                                        ទិន្នន័យ / សូចនាករ (DATA ELEMENT)
                                    </th>
                                    <th colSpan={4} className="px-1.5 py-1 text-center bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 border-r border-stone-300 dark:border-zinc-700 font-bold">
                                        បុរស (MALE)
                                    </th>
                                    <th colSpan={4} className="px-1.5 py-1 text-center bg-pink-50/80 dark:bg-pink-950/40 text-pink-900 dark:text-pink-200 border-r border-stone-300 dark:border-zinc-700 font-bold">
                                        ស្រ្តី (FEMALE)
                                    </th>
                                    <th rowSpan={2} className="px-2 py-1 text-right bg-slate-100 dark:bg-zinc-800 font-bold">
                                        សរុប
                                    </th>
                                </tr>
                                <tr className="border-b border-stone-300 dark:border-zinc-700 text-[10px]">
                                    <th className="px-1 py-0.5 text-center border-r border-stone-300 dark:border-zinc-700 font-semibold">&lt;15</th>
                                    <th className="px-1 py-0.5 text-center border-r border-stone-300 dark:border-zinc-700 font-semibold">15-49</th>
                                    <th className="px-1 py-0.5 text-center border-r border-stone-300 dark:border-zinc-700 font-semibold">&ge;50</th>
                                    <th className="px-1 py-0.5 text-center font-bold bg-blue-100/50 dark:bg-blue-900/40 border-r border-stone-300 dark:border-zinc-700">សរុប</th>

                                    <th className="px-1 py-0.5 text-center border-r border-stone-300 dark:border-zinc-700 font-semibold">&lt;15</th>
                                    <th className="px-1 py-0.5 text-center border-r border-stone-300 dark:border-zinc-700 font-semibold">15-49</th>
                                    <th className="px-1 py-0.5 text-center border-r border-stone-300 dark:border-zinc-700 font-semibold">&ge;50</th>
                                    <th className="px-1 py-0.5 text-center font-bold bg-pink-100/50 dark:bg-pink-900/40 border-r border-stone-300 dark:border-zinc-700">សរុប</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-200 dark:divide-zinc-800">
                                {sec.indicators.map((ind) => {
                                    const m = ind.demographics?.male || {}
                                    const f = ind.demographics?.female || {}
                                    return (
                                        <React.Fragment key={ind.deId}>
                                            {/* Main Indicator Row */}
                                            <tr className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                                                <td className="px-2.5 py-1 text-slate-800 dark:text-zinc-200 font-medium border-r border-stone-200 dark:border-zinc-800">
                                                    {ind.name}
                                                </td>

                                                {/* Male */}
                                                <td onClick={() => m.under15 > 0 && openDrilldown(`${ind.name} (បុរស <១៥ឆ្នាំ)`, m.teis?.under15, periodLabel)} className={cn('px-1 py-1 text-center font-mono text-[11px] border-r border-stone-200 dark:border-zinc-800', m.under15 > 0 ? 'cursor-pointer font-bold text-sky-600 hover:underline' : 'text-slate-500')}>
                                                    {m.under15 || 0}
                                                </td>
                                                <td onClick={() => m.age15to49 > 0 && openDrilldown(`${ind.name} (បុរស ១៥-៤៩ឆ្នាំ)`, m.teis?.age15to49, periodLabel)} className={cn('px-1 py-1 text-center font-mono text-[11px] border-r border-stone-200 dark:border-zinc-800', m.age15to49 > 0 ? 'cursor-pointer font-bold text-sky-600 hover:underline' : 'text-slate-500')}>
                                                    {m.age15to49 || 0}
                                                </td>
                                                <td onClick={() => m.age50plus > 0 && openDrilldown(`${ind.name} (បុរស ≥៥០ឆ្នាំ)`, m.teis?.age50plus, periodLabel)} className={cn('px-1 py-1 text-center font-mono text-[11px] border-r border-stone-200 dark:border-zinc-800', m.age50plus > 0 ? 'cursor-pointer font-bold text-sky-600 hover:underline' : 'text-slate-500')}>
                                                    {m.age50plus || 0}
                                                </td>
                                                <td onClick={() => m.total > 0 && openDrilldown(`${ind.name} (បុរស សរុប)`, m.teis?.total || m.teis?.all, periodLabel)} className={cn('px-1 py-1 text-center font-mono text-[11px] font-bold bg-blue-50/40 dark:bg-blue-950/20 border-r border-stone-200 dark:border-zinc-800', m.total > 0 ? 'cursor-pointer text-blue-700 dark:text-blue-300 hover:underline' : 'text-slate-500')}>
                                                    {m.total || 0}
                                                </td>

                                                {/* Female */}
                                                <td onClick={() => f.under15 > 0 && openDrilldown(`${ind.name} (ស្រ្តី <១៥ឆ្នាំ)`, f.teis?.under15, periodLabel)} className={cn('px-1 py-1 text-center font-mono text-[11px] border-r border-stone-200 dark:border-zinc-800', f.under15 > 0 ? 'cursor-pointer font-bold text-pink-600 hover:underline' : 'text-slate-500')}>
                                                    {f.under15 || 0}
                                                </td>
                                                <td onClick={() => f.age15to49 > 0 && openDrilldown(`${ind.name} (ស្រ្តី ១៥-៤៩ឆ្នាំ)`, f.teis?.age15to49, periodLabel)} className={cn('px-1 py-1 text-center font-mono text-[11px] border-r border-stone-200 dark:border-zinc-800', f.age15to49 > 0 ? 'cursor-pointer font-bold text-pink-600 hover:underline' : 'text-slate-500')}>
                                                    {f.age15to49 || 0}
                                                </td>
                                                <td onClick={() => f.age50plus > 0 && openDrilldown(`${ind.name} (ស្រ្តី ≥៥០ឆ្នាំ)`, f.teis?.age50plus, periodLabel)} className={cn('px-1 py-1 text-center font-mono text-[11px] border-r border-stone-200 dark:border-zinc-800', f.age50plus > 0 ? 'cursor-pointer font-bold text-pink-600 hover:underline' : 'text-slate-500')}>
                                                    {f.age50plus || 0}
                                                </td>
                                                <td onClick={() => f.total > 0 && openDrilldown(`${ind.name} (ស្រ្តី សរុប)`, f.teis?.total || f.teis?.all, periodLabel)} className={cn('px-1 py-1 text-center font-mono text-[11px] font-bold bg-pink-50/40 dark:bg-pink-950/20 border-r border-stone-200 dark:border-zinc-800', f.total > 0 ? 'cursor-pointer text-pink-700 dark:text-pink-300 hover:underline' : 'text-slate-500')}>
                                                    {f.total || 0}
                                                </td>

                                                {/* Grand Total */}
                                                <td onClick={() => ind.total > 0 && openDrilldown(`${ind.name} (សរុបជារួម)`, ind.teis, periodLabel)} className={cn('px-2.5 py-1 text-right font-mono text-[11.5px] font-bold bg-slate-50 dark:bg-zinc-850', ind.total > 0 ? 'cursor-pointer text-slate-900 dark:text-zinc-100 hover:text-sky-600' : 'text-slate-400')}>
                                                    {ind.total || 0}
                                                </td>
                                            </tr>

                                            {/* Sub-rows for Option Set Options if present */}
                                            {ind.hasOptions &&
                                                ind.options.map((opt) => {
                                                    const optM = opt.demographics?.male || {}
                                                    const optF = opt.demographics?.female || {}
                                                    return (
                                                        <tr key={opt.code} className="hover:bg-slate-50/40 dark:hover:bg-zinc-800/30 transition-colors bg-stone-50/30 dark:bg-zinc-900/40">
                                                            <td className="px-2.5 py-0.75 pl-6 text-[10.5px] text-slate-600 dark:text-zinc-400 border-r border-stone-200 dark:border-zinc-800 flex items-center gap-1.5">
                                                                <span className="text-slate-400">•</span>
                                                                <span>{opt.name}</span>
                                                            </td>

                                                            {/* Male */}
                                                            <td onClick={() => optM.under15 > 0 && openDrilldown(`${ind.name} - ${opt.name} (បុរស <១៥ឆ្នាំ)`, optM.teis?.under15, periodLabel)} className={cn('px-1 py-0.75 text-center font-mono text-[10.5px] border-r border-stone-200 dark:border-zinc-800', optM.under15 > 0 ? 'cursor-pointer font-bold text-sky-600 hover:underline' : 'text-slate-400')}>
                                                                {optM.under15 || 0}
                                                            </td>
                                                            <td onClick={() => optM.age15to49 > 0 && openDrilldown(`${ind.name} - ${opt.name} (បុរស ១៥-៤៩ឆ្នាំ)`, optM.teis?.age15to49, periodLabel)} className={cn('px-1 py-0.75 text-center font-mono text-[10.5px] border-r border-stone-200 dark:border-zinc-800', optM.age15to49 > 0 ? 'cursor-pointer font-bold text-sky-600 hover:underline' : 'text-slate-400')}>
                                                                {optM.age15to49 || 0}
                                                            </td>
                                                            <td onClick={() => optM.age50plus > 0 && openDrilldown(`${ind.name} - ${opt.name} (បុរស ≥៥០ឆ្នាំ)`, optM.teis?.age50plus, periodLabel)} className={cn('px-1 py-0.75 text-center font-mono text-[10.5px] border-r border-stone-200 dark:border-zinc-800', optM.age50plus > 0 ? 'cursor-pointer font-bold text-sky-600 hover:underline' : 'text-slate-400')}>
                                                                {optM.age50plus || 0}
                                                            </td>
                                                            <td onClick={() => optM.total > 0 && openDrilldown(`${ind.name} - ${opt.name} (បុរស សរុប)`, optM.teis?.total || optM.teis?.all, periodLabel)} className={cn('px-1 py-0.75 text-center font-mono text-[10.5px] font-semibold bg-blue-50/20 dark:bg-blue-950/10 border-r border-stone-200 dark:border-zinc-800', optM.total > 0 ? 'cursor-pointer text-blue-700 dark:text-blue-300 hover:underline' : 'text-slate-400')}>
                                                                {optM.total || 0}
                                                            </td>

                                                            {/* Female */}
                                                            <td onClick={() => optF.under15 > 0 && openDrilldown(`${ind.name} - ${opt.name} (ស្រ្តី <១៥ឆ្នាំ)`, optF.teis?.under15, periodLabel)} className={cn('px-1 py-0.75 text-center font-mono text-[10.5px] border-r border-stone-200 dark:border-zinc-800', optF.under15 > 0 ? 'cursor-pointer font-bold text-pink-600 hover:underline' : 'text-slate-400')}>
                                                                {optF.under15 || 0}
                                                            </td>
                                                            <td onClick={() => optF.age15to49 > 0 && openDrilldown(`${ind.name} - ${opt.name} (ស្រ្តី ១៥-៤៩ឆ្នាំ)`, optF.teis?.age15to49, periodLabel)} className={cn('px-1 py-0.75 text-center font-mono text-[10.5px] border-r border-stone-200 dark:border-zinc-800', optF.age15to49 > 0 ? 'cursor-pointer font-bold text-pink-600 hover:underline' : 'text-slate-400')}>
                                                                {optF.age15to49 || 0}
                                                            </td>
                                                            <td onClick={() => optF.age50plus > 0 && openDrilldown(`${ind.name} - ${opt.name} (ស្រ្តី ≥៥០ឆ្នាំ)`, optF.teis?.age50plus, periodLabel)} className={cn('px-1 py-0.75 text-center font-mono text-[10.5px] border-r border-stone-200 dark:border-zinc-800', optF.age50plus > 0 ? 'cursor-pointer font-bold text-pink-600 hover:underline' : 'text-slate-400')}>
                                                                {optF.age50plus || 0}
                                                            </td>
                                                            <td onClick={() => optF.total > 0 && openDrilldown(`${ind.name} - ${opt.name} (ស្រ្តី សរុប)`, optF.teis?.total || optF.teis?.all, periodLabel)} className={cn('px-1 py-0.75 text-center font-mono text-[10.5px] font-semibold bg-pink-50/20 dark:bg-pink-950/10 border-r border-stone-200 dark:border-zinc-800', optF.total > 0 ? 'cursor-pointer text-pink-700 dark:text-pink-300 hover:underline' : 'text-slate-400')}>
                                                                {optF.total || 0}
                                                            </td>

                                                            {/* Grand Total for Option */}
                                                            <td onClick={() => opt.total > 0 && openDrilldown(`${ind.name} - ${opt.name} (សរុប)`, opt.teis, periodLabel)} className={cn('px-2.5 py-0.75 text-right font-mono text-[11px] font-bold', opt.total > 0 ? 'cursor-pointer text-slate-800 dark:text-zinc-200 hover:text-sky-600' : 'text-slate-400')}>
                                                                {opt.total || 0}
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
                </div>
            ))}
        </div>
    )
}
