import React, { useState, useMemo } from 'react'
import i18n from '@dhis2/d2-i18n'
import { useDataEngine } from '@dhis2/app-runtime'
import {
    Calendar,
    ClipboardList,
    Download,
    Eye,
    Printer,
    RefreshCw,
} from 'lucide-react'
import { useI18nLanguage } from '../../hooks/useI18nLanguage'
import { TrackerContextSelector } from '../context/TrackerContextSelector'
import { useMonthlyReportData } from './hooks/useMonthlyReportData'
import { Spinner } from '../../components/ui/spinner'
import { PAGE_LAYOUT } from '../tei-search/teiListUi'
import { cn } from '../../lib/utils'
import { ReportDrilldownModal } from './components/ReportDrilldownModal'
import { NchadsReportSection } from './components/NchadsReportSection'
import { DemographicMatrixSection } from './components/DemographicMatrixSection'
import { MonthlyReportModal } from './components/MonthlyReportModal'
import { EmptyWelcomeState } from '../../components/EmptyWelcomeState'

export function MonthlyReportPage({ context, setContext, onSelectTei, viewMode: propViewMode }) {
    useI18nLanguage()
    const engine = useDataEngine()
    const [reportViewMode, setReportViewMode] = useState('NCHADS') // 'NCHADS' | 'DEMO_MATRIX' | 'SUMMARY'
    const [searchFilter, setSearchFilter] = useState('')
    const [selectedStageFilter, setSelectedStageFilter] = useState('ALL')
    const [collapsedSections, setCollapsedSections] = useState({})
    const [isReportModalOpen, setIsReportModalOpen] = useState(false)

    const [drilldownState, setDrilldownState] = useState({
        isOpen: false,
        title: '',
        subtitle: '',
        clients: [],
    })

    const openDrilldown = (title, clients, subtitle = '') => {
        setDrilldownState({
            isOpen: true,
            title,
            subtitle,
            clients: clients || [],
        })
    }

    const closeDrilldown = () => {
        setDrilldownState((prev) => ({ ...prev, isOpen: false }))
    }

    const toggleSectionCollapse = (key) => {
        setCollapsedSections((prev) => ({
            ...prev,
            [key]: !prev[key],
        }))
    }

    const expandAllSections = () => {
        setCollapsedSections({})
    }

    const collapseAllSections = (sections) => {
        const next = {}
        for (const s of sections) {
            next[s.key] = true
        }
        setCollapsedSections(next)
    }

    const {
        loading,
        error,
        refetch,
        reportData,
        periodRange,
        metadata,
        hasPeriod,
        isEventsMode,
    } = useMonthlyReportData({ engine, context, viewMode: propViewMode })

    const hasOrgUnit = Boolean(context?.orgUnit)
    const hasProgram = Boolean(context?.program)

    const handleExportExcel = () => {
        if (!reportData || !periodRange) return
        const lines = []
        lines.push(`KINGDOM OF CAMBODIA,NATION RELIGION KING`)
        lines.push(`MINISTRY OF HEALTH / NCHADS,MONTHLY ROUTINE REPORT ON CLINICAL & STI SERVICES`)
        lines.push(`Organisation Unit,${context.orgUnitName || context.orgUnit}`)
        lines.push(`Program,${metadata?.displayName || metadata?.name || context.program}`)
        lines.push(`Period,${periodRange.label} (${periodRange.startDate} to ${periodRange.endDate})`)
        lines.push(``)

        // Summary KPIs
        lines.push(`SUMMARY KPIS,VALUE`)
        lines.push(`Total Unique Clients,${reportData.totalUniqueClients}`)
        lines.push(`New Enrollments,${reportData.newEnrollmentsCount}`)
        lines.push(`Consultations / Visits,${reportData.totalVisitsCount}`)
        lines.push(`Completed Visits,${reportData.completedVisitsCount}`)
        lines.push(`Completion Rate,${reportData.completionRate}%`)
        lines.push(``)

        // 1. Consultations
        lines.push(`1. ចំនួនករណីមកពិនិត្យព្យាបាលជំងឺ (ថ្មី និង ចាស់),សរុប`)
        for (const c of reportData.nchadsReport?.consultations || []) {
            lines.push(`"${c.label}",${c.count}`)
        }
        lines.push(``)

        // 2. Testing
        lines.push(`2. ការធ្វើតេស្តរកមេរោគអេដស៍-ស្វាយ,MSM/TG,Men,LRW,EW,PWID/PWUD,សរុប`)
        for (const t of reportData.nchadsReport?.testing || []) {
            lines.push(`"${t.label}",${t.msm_tg.count},${t.men.count},${t.lrw.count},${t.few.count},${t.pwid_pwud.count},${t.total.count}`)
        }
        lines.push(``)

        // 3. Referrals Out
        lines.push(`3. ការបញ្ជូនអតិថិជនទៅកាន់សេវាផ្សេងៗ,សរុប`)
        for (const r of reportData.nchadsReport?.referralsOut || []) {
            lines.push(`"${r.label}",${r.count}`)
        }
        lines.push(``)

        // 4. Referrals In
        lines.push(`4. ការបញ្ជូនអតិថិជនមកពីសេវាផ្សេងៗ,សរុប`)
        for (const r of reportData.nchadsReport?.referralsIn || []) {
            lines.push(`"${r.label}",${r.count}`)
        }
        lines.push(``)

        // 5. Male STI Cases
        lines.push(`5. ចំនួនករណីជំងឺកាមរោគ(ករណីថ្មី) ក្នុងចំណោមបុរស`)
        lines.push(`រោគវិនិច្ឆ័យ,បុរសទូទៅ <15,បុរសទូទៅ 15-49,បុរសទូទៅ >=50,បុរសទូទៅ សរុប,MSM/TG <15,MSM/TG 15-49,MSM/TG >=50,MSM/TG សរុប,សរុប`)
        for (const m of reportData.nchadsReport?.maleSti || []) {
            lines.push(`"${m.label}",${m.group1.under15},${m.group1.age15to49},${m.group1.age50plus},${m.group1.total},${m.group2.under15},${m.group2.age15to49},${m.group2.age50plus},${m.group2.total},${m.total}`)
        }
        lines.push(``)

        // 6. Female STI Cases
        lines.push(`6. ចំនួនករណីជំងឺកាមរោគ(ករណីថ្មី) ក្នុងចំណោមស្រ្តី`)
        lines.push(`រោគវិនិច្ឆ័យ,LRW <15,LRW 15-49,LRW >=50,LRW សរុប,FEW <15,FEW 15-49,FEW >=50,FEW សរុប,សរុប`)
        for (const f of reportData.nchadsReport?.femaleSti || []) {
            if (f.isHeader) {
                lines.push(`"${f.label}",,,,,,,,,`)
            } else {
                lines.push(`"${f.label}",${f.group1.under15},${f.group1.age15to49},${f.group1.age50plus},${f.group1.total},${f.group2.under15},${f.group2.age15to49},${f.group2.age50plus},${f.group2.total},${f.total}`)
            }
        }
        lines.push(``)

        // 7. Pregnant Women Syphilis
        lines.push(`7. ការព្យាបាលជំងឺស្វាយចំពោះស្រ្តីមានផ្ទៃពោះ,<15,15-49,>=50,សរុប`)
        for (const p of reportData.nchadsReport?.pregnantSyphilis || []) {
            lines.push(`"${p.label}",${p.under15},${p.age15to49},${p.age50plus},${p.total}`)
        }
        lines.push(``)

        // Universal DE Demographic Cross-Tabulation Matrix
        lines.push(`UNIVERSAL DATA ELEMENT DEMOGRAPHIC DISAGGREGATION MATRIX`)
        lines.push(`Stage,Section,Indicator,Male <15,Male 15-49,Male >=50,Male Total,Female <15,Female 15-49,Female >=50,Female Total,Grand Total`)
        for (const de of reportData.deMatrix || []) {
            const dm = de.demographics || {
                male: { under15: 0, age15to49: 0, age50plus: 0, total: 0 },
                female: { under15: 0, age15to49: 0, age50plus: 0, total: 0 },
                total: de.total,
            }
            lines.push(`"${de.stageName}","${de.sectionName}","${de.name}",${dm.male.under15},${dm.male.age15to49},${dm.male.age50plus},${dm.male.total},${dm.female.under15},${dm.female.age15to49},${dm.female.age50plus},${dm.female.total},${de.total}`)
        }

        const csvContent = lines.join('\n')
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `nchads_sti_report_${periodRange.startDate}_${periodRange.endDate}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    const availableStages = useMemo(() => {
        if (!reportData?.deMatrix) return []
        const set = new Set()
        for (const de of reportData.deMatrix) {
            if (de.stageName) set.add(de.stageName)
        }
        return Array.from(set)
    }, [reportData?.deMatrix])

    // Filtered Form Sections
    const filteredSections = useMemo(() => {
        if (!reportData?.formSections) return []
        const q = searchFilter.trim().toLowerCase()

        return reportData.formSections
            .filter((sec) => {
                if (selectedStageFilter !== 'ALL' && sec.stageName !== selectedStageFilter) {
                    return false
                }
                return true
            })
            .map((sec) => {
                if (!q) return sec
                const matchingIndicators = sec.indicators.filter(
                    (de) => de.name.toLowerCase().includes(q) || sec.sectionName.toLowerCase().includes(q)
                )
                return {
                    ...sec,
                    indicators: matchingIndicators,
                }
            })
            .filter((sec) => sec.indicators.length > 0)
    }, [reportData?.formSections, selectedStageFilter, searchFilter])

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden gap-1.5 bg-slate-50/50 dark:bg-black">
            {/* Top Toolbar Card matching Records and Dashboard toolbar */}
            <div className={cn(PAGE_LAYOUT.toolbarCard, 'shrink-0 flex flex-wrap items-center justify-between gap-1.5 print:hidden')}>
                <div className="flex-1 min-w-[280px]">
                    <TrackerContextSelector
                        context={context}
                        onChange={setContext}
                        layout="default"
                        showSearch={false}
                        showRecordActions={false}
                        showImportExport={false}
                        showViewModeToggle={true}
                        showColumnConfig={false}
                        showRegister={false}
                        allowedPeriodKinds={['month', 'custom']}
                        viewMode={context?.viewMode || propViewMode || 'ENROLLMENTS'}
                        onToggleViewMode={() => {
                            const next = (context?.viewMode || propViewMode || 'ENROLLMENTS') === 'EVENTS' ? 'ENROLLMENTS' : 'EVENTS'
                            setContext?.((prev) => ({ ...prev, viewMode: next }))
                        }}
                    />
                </div>

                <div className="flex items-center gap-1.5 print:hidden">
                    <button
                        type="button"
                        onClick={() => refetch()}
                        disabled={loading || !hasOrgUnit || !hasProgram || !hasPeriod}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-slate-200/90 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700/80 shadow-2xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        title={i18n.t('Refresh Report')}
                    >
                        <RefreshCw className={cn('h-3.5 w-3.5 text-slate-500 dark:text-zinc-400', loading && 'animate-spin')} />
                        <span>{i18n.t('Refresh')}</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleExportExcel}
                        disabled={!reportData || !periodRange || loading}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-slate-200/90 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700/80 shadow-2xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        title={i18n.t('Export to CSV')}
                    >
                        <Download className="h-3.5 w-3.5 text-slate-500 dark:text-zinc-400" />
                        <span>{i18n.t('Export')}</span>
                    </button>
                </div>
            </div>

            {/* Separate Tab Navigation Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 -mt-1 rounded-sm shadow-2xs print:hidden font-sans">
                <nav className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                    <button
                        type="button"
                        onClick={() => setReportViewMode('NCHADS')}
                        className={cn(
                            'h-8 min-h-8 px-2.5 py-1 text-xs sm:text-[13px] font-semibold rounded-md transition-all cursor-pointer select-none flex items-center gap-1.5',
                            reportViewMode === 'NCHADS'
                                ? 'bg-[var(--app-header-bar-bg)] text-white shadow-xs'
                                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        )}
                    >
                        <span>ទម្រង់របាយការណ៍ជាតិ ({reportData?.programReport?.programName || metadata?.displayName || metadata?.name || 'Program'})</span>
                        {isEventsMode && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-blue-500/20 text-blue-200 border border-blue-400/30">
                                ព្រឹត្តិការណ៍ (Events)
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setReportViewMode('DEMO_MATRIX')}
                        className={cn(
                            'h-8 min-h-8 px-2.5 py-1 text-xs sm:text-[13px] font-semibold rounded-md transition-all cursor-pointer select-none flex items-center',
                            reportViewMode === 'DEMO_MATRIX'
                                ? 'bg-[var(--app-header-bar-bg)] text-white shadow-xs'
                                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        )}
                    >
                        តារាងសូចនាករបំបែកតាមភេទ និងអាយុ
                    </button>

                    <button
                        type="button"
                        onClick={() => setReportViewMode('SUMMARY')}
                        className={cn(
                            'h-8 min-h-8 px-2.5 py-1 text-xs sm:text-[13px] font-semibold rounded-md transition-all cursor-pointer select-none flex items-center',
                            reportViewMode === 'SUMMARY'
                                ? 'bg-[var(--app-header-bar-bg)] text-white shadow-xs'
                                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
                        )}
                    >
                        ទិដ្ឋភាពសង្ខេប
                    </button>
                </nav>

                <div className="flex items-center gap-1.5">
                    {/* Modal Report Trigger (Opens Report Modal like report summary) */}
                    <button
                        type="button"
                        onClick={() => setIsReportModalOpen(true)}
                        disabled={!reportData || loading}
                        className="inline-flex items-center gap-1.5 h-8 min-h-8 px-2.5 py-1 rounded-md text-xs sm:text-[13px] font-semibold bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700 shadow-2xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        title={i18n.t('Print Official Report')}
                    >
                        <Printer className="h-3.5 w-3.5 text-slate-500 dark:text-zinc-400" />
                        <span>{i18n.t('Print Form')}</span>
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                {!hasOrgUnit || !hasProgram ? (
                    <EmptyWelcomeState context={context} mode="report" />
                ) : !hasPeriod ? (
                    <div className="app-card flex min-h-0 flex-1 flex-col overflow-hidden">
                        <div className="flex flex-1 flex-col items-center justify-center p-10 md:p-16 font-sans">
                            <div className="flex max-w-[400px] sm:max-w-lg flex-col items-center text-center">
                                <div className="mb-7 flex h-16 w-16 items-center justify-center rounded-2xl border border-sky-100 dark:border-sky-950/60 bg-sky-50 dark:bg-black text-sky-600 dark:text-sky-400 shadow-sm transition-transform duration-200 hover:scale-105">
                                    <Calendar className="h-7 w-7 stroke-[1.75]" />
                                </div>
                                <h2 className="mb-4 text-[20px] sm:text-[22px] font-bold font-sans text-slate-900 dark:text-zinc-100 tracking-normal m-0 leading-normal">
                                    សូមជ្រើសរើសកាលបរិច្ឆេទ / រយៈពេលរាយការណ៍
                                </h2>
                                <p className="mb-9 px-4 text-[14px] sm:text-[15px] leading-[1.85] text-slate-600 dark:text-zinc-400 font-sans m-0">
                                    សូមជ្រើសរើស <span className="font-bold text-slate-800 dark:text-zinc-200">ខែ និងឆ្នាំ</span> នៃរបាយការណ៍នៅរបារចម្រាញ់ខាងលើ ដើម្បីទាញយកទិន្នន័យពិនិត្យ។
                                </p>
                            </div>
                        </div>
                    </div>
                ) : loading ? (
                    <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-12 text-center">
                        <Spinner className="h-8 w-8 text-sky-600" />
                        <span className="mt-3 text-xs font-semibold text-slate-600 dark:text-zinc-300">
                            {i18n.t('Aggregating monthly clinical records...')}
                        </span>
                    </div>
                ) : error ? (
                    <div className="app-card p-4 border-red-200 bg-red-50/50 dark:bg-red-950/20 text-red-700 dark:text-red-300 text-xs rounded-xl shadow-2xs">
                        <p className="font-bold">{i18n.t('Failed to load report data')}</p>
                        <p className="text-[11px] mt-0.5">{error}</p>
                    </div>
                ) : reportData && periodRange ? (
                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-1.5 pb-8 pr-0.5">
                        <div className="app-card w-full border border-slate-200/90 dark:border-zinc-800 rounded-none overflow-hidden bg-white dark:bg-zinc-900 shadow-xs divide-y divide-slate-200/90 dark:divide-zinc-800">
                            {/* Official Header Banner in Khmer */}
                            <div className="p-3 sm:p-4 bg-transparent font-sans">
                                <div className="text-center my-2 sm:my-2.5">
                                    <h1 className="text-[16px] sm:text-[17.5px] font-bold text-slate-900 dark:text-zinc-100 tracking-normal m-0">
                                        {/sti|កាមរោគ/i.test(metadata?.displayName || metadata?.name || '')
                                            ? 'របាយការណ៍ប្រចាំខែស្តីពីសេវាពិនិត្យ និងព្យាបាលជំងឺកាមរោគ'
                                            : `របាយការណ៍ប្រចាំខែស្តីពី ${metadata?.displayName || metadata?.name || 'សេវាសុខាភិបាល'}`}
                                    </h1>
                                </div>

                                {/* Organisation Unit & Context Metadata Table */}
                                <div className="mt-2.5 overflow-x-auto custom-scrollbar">
                                    <table className="w-full border-collapse border border-stone-300 dark:border-zinc-700 text-[11px] sm:text-[11.5px] font-sans table-fixed">
                                        <colgroup>
                                            <col className="w-[20%]" />
                                            <col className="w-[30%]" />
                                            <col className="w-[20%]" />
                                            <col className="w-[30%]" />
                                        </colgroup>
                                        <tbody>
                                            <tr className="border-b border-stone-300 dark:border-zinc-700">
                                                <td className="px-2.5 py-1 bg-stone-100/90 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border-r border-stone-300 dark:border-zinc-700 text-left font-bold">
                                                    អង្គភាព / មូលដ្ឋានសុខាភិបាល
                                                </td>
                                                <td className="px-2.5 py-1 text-slate-900 dark:text-zinc-100 font-semibold border-r border-stone-300 dark:border-zinc-700 text-left">
                                                    {context.orgUnitName || context.orgUnit}
                                                </td>
                                                <td className="px-2.5 py-1 bg-stone-100/90 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border-r border-stone-300 dark:border-zinc-700 text-left font-bold">
                                                    កម្មវិធីសុខាភិបាល
                                                </td>
                                                <td className="px-2.5 py-1 text-slate-900 dark:text-zinc-100 font-semibold text-left">
                                                    {metadata?.displayName || metadata?.name || context.program}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-2.5 py-1 bg-stone-100/90 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border-r border-stone-300 dark:border-zinc-700 text-left font-bold">
                                                    កាលបរិច្ឆេទ / រយៈពេលរាយការណ៍
                                                </td>
                                                <td className="px-2.5 py-1 text-slate-900 dark:text-zinc-100 font-semibold border-r border-stone-300 dark:border-zinc-700 text-left">
                                                    {periodRange.label}
                                                </td>
                                                <td className="px-2.5 py-1 bg-stone-100/90 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border-r border-stone-300 dark:border-zinc-700 text-left font-bold">
                                                    ចន្លោះកាលបរិច្ឆេទ
                                                </td>
                                                <td className="px-2.5 py-1 text-slate-900 dark:text-zinc-100 font-semibold text-left font-mono text-[11px]">
                                                    {periodRange.startDate} ដល់ {periodRange.endDate}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* TAB 1: PROGRAM NATIONAL REPORT */}
                            {reportViewMode === 'NCHADS' && (
                                <div className="p-4 sm:p-6">
                                    <NchadsReportSection
                                        programReport={reportData.programReport}
                                        nchadsReport={reportData.nchadsReport}
                                        openDrilldown={openDrilldown}
                                        periodLabel={periodRange.label}
                                    />
                                </div>
                            )}

                            {/* TAB 2: UNIVERSAL DEMOGRAPHIC MATRIX */}
                            {reportViewMode === 'DEMO_MATRIX' && (
                                <div className="p-4 sm:p-6">
                                    <DemographicMatrixSection
                                        filteredSections={filteredSections}
                                        availableStages={availableStages}
                                        selectedStageFilter={selectedStageFilter}
                                        setSelectedStageFilter={setSelectedStageFilter}
                                        searchFilter={searchFilter}
                                        setSearchFilter={setSearchFilter}
                                        collapsedSections={collapsedSections}
                                        toggleSectionCollapse={toggleSectionCollapse}
                                        expandAllSections={expandAllSections}
                                        collapseAllSections={collapseAllSections}
                                        openDrilldown={openDrilldown}
                                        periodLabel={periodRange.label}
                                    />
                                </div>
                            )}

                            {/* TAB 3: SUMMARY OVERVIEW */}
                            {reportViewMode === 'SUMMARY' && (
                                <div className="flex flex-col divide-y divide-slate-200/90 dark:divide-zinc-800">
                                    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200/90 dark:divide-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50">
                                        <div
                                            onClick={() => openDrilldown(i18n.t('Total Unique Clients'), reportData.totalUniqueClientsTeis, periodRange.label)}
                                            className="p-3.5 cursor-pointer hover:bg-sky-500/10 dark:hover:bg-sky-400/10 transition-colors group relative"
                                            title={i18n.t('Click to view clients list')}
                                        >
                                            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 group-hover:text-sky-600 dark:group-hover:text-sky-400">
                                                <span>{i18n.t('Unique Clients')}</span>
                                                <Eye className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-sky-600 dark:text-sky-400" />
                                            </div>
                                            <div className="mt-1 text-2xl font-black tracking-tight text-slate-800 dark:text-zinc-100 group-hover:text-sky-600 dark:group-hover:text-sky-300 font-mono">
                                                {reportData.totalUniqueClients}
                                            </div>
                                            <div className="text-[11px] font-medium text-slate-400 dark:text-zinc-500 mt-0.5">
                                                {reportData.newEnrollmentsCount} {i18n.t('new enrollments')}
                                            </div>
                                        </div>

                                        <div
                                            onClick={() => openDrilldown(i18n.t('Consultations & Visits'), reportData.totalVisitsTeis, periodRange.label)}
                                            className="p-3.5 cursor-pointer hover:bg-indigo-500/10 dark:hover:bg-indigo-400/10 transition-colors group relative"
                                            title={i18n.t('Click to view consultations list')}
                                        >
                                            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                                <span>{i18n.t('Consultations')}</span>
                                                <Eye className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-600 dark:text-indigo-400" />
                                            </div>
                                            <div className="mt-1 text-2xl font-black tracking-tight text-slate-800 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 font-mono">
                                                {reportData.totalVisitsCount}
                                            </div>
                                            <div className="text-[11px] font-medium text-slate-400 dark:text-zinc-500 mt-0.5">
                                                {reportData.completedVisitsCount} {i18n.t('completed')} ({reportData.completionRate}%)
                                            </div>
                                        </div>

                                        <div
                                            onClick={() => openDrilldown(i18n.t('Total Tracked Entities'), reportData.totalUniqueClientsTeis, periodRange.label)}
                                            className="p-3.5 cursor-pointer hover:bg-emerald-500/10 dark:hover:bg-emerald-400/10 transition-colors group relative"
                                            title={i18n.t('Click to view clients list')}
                                        >
                                            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                                                <span>{i18n.t('Report Period')}</span>
                                                <Eye className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-emerald-600 dark:text-emerald-400" />
                                            </div>
                                            <div className="mt-1 text-lg font-bold tracking-tight text-slate-800 dark:text-zinc-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-300">
                                                {periodRange.label}
                                            </div>
                                            <div className="text-[11px] font-medium text-slate-400 dark:text-zinc-500 mt-0.5 font-mono">
                                                {periodRange.startDate} → {periodRange.endDate}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Demographics Summary */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200/90 dark:divide-zinc-800">
                                        <div className="p-3.5">
                                            <div className="bg-slate-50 dark:bg-zinc-800/60 px-3 py-2 text-xs font-bold text-slate-800 dark:text-zinc-100 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                                                <span>{i18n.t('Biological Sex')}</span>
                                                <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300 font-mono">{reportData.totalUniqueClients || 0}</span>
                                            </div>
                                            <table className="w-full table-fixed text-xs border-collapse">
                                                <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                                                    <tr
                                                        onClick={() => {
                                                            const count = reportData?.sexDistribution?.male ?? reportData?.sexCounts?.Male?.count ?? 0
                                                            const teis = reportData?.maleTeis ?? reportData?.sexCounts?.Male?.teis ?? []
                                                            openDrilldown(`${i18n.t('Male Clients')} (${count})`, teis, periodRange.label)
                                                        }}
                                                        className="cursor-pointer hover:bg-sky-50/60 dark:hover:bg-zinc-800/60 transition-colors group"
                                                    >
                                                        <td className="px-3 py-2 text-slate-700 dark:text-zinc-300 font-medium">{i18n.t('Male')}</td>
                                                        <td className="px-3 py-2 font-bold text-right text-slate-800 dark:text-zinc-200 font-mono">
                                                            {reportData?.sexDistribution?.male ?? reportData?.sexCounts?.Male?.count ?? 0}{' '}
                                                            <span className="text-[10.5px] text-slate-500 font-normal">
                                                                ({reportData?.sexDistribution?.malePct ?? '0.0'}%)
                                                            </span>
                                                        </td>
                                                    </tr>
                                                    <tr
                                                        onClick={() => {
                                                            const count = reportData?.sexDistribution?.female ?? reportData?.sexCounts?.Female?.count ?? 0
                                                            const teis = reportData?.femaleTeis ?? reportData?.sexCounts?.Female?.teis ?? []
                                                            openDrilldown(`${i18n.t('Female Clients')} (${count})`, teis, periodRange.label)
                                                        }}
                                                        className="cursor-pointer hover:bg-rose-50/60 dark:hover:bg-zinc-800/60 transition-colors group"
                                                    >
                                                        <td className="px-3 py-2 text-slate-700 dark:text-zinc-300 font-medium">{i18n.t('Female')}</td>
                                                        <td className="px-3 py-2 font-bold text-right text-slate-800 dark:text-zinc-200 font-mono">
                                                            {reportData?.sexDistribution?.female ?? reportData?.sexCounts?.Female?.count ?? 0}{' '}
                                                            <span className="text-[10.5px] text-slate-500 font-normal">
                                                                ({reportData?.sexDistribution?.femalePct ?? '0.0'}%)
                                                            </span>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>

                                        <div className="p-3.5">
                                            <div className="bg-slate-50 dark:bg-zinc-800/60 px-3 py-2 text-xs font-bold text-slate-800 dark:text-zinc-100 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                                                <span>{i18n.t('Patient Type')}</span>
                                                <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-300 font-mono">{reportData.totalUniqueClients}</span>
                                            </div>
                                            <table className="w-full table-fixed text-xs border-collapse">
                                                <colgroup>
                                                    <col className="w-[55%]" />
                                                    <col className="w-[45%]" />
                                                </colgroup>
                                                <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                                                    {reportData.populationGroups?.length ? (
                                                        reportData.populationGroups.slice(0, 5).map((pop) => (
                                                            <tr
                                                                key={pop.name}
                                                                onClick={() => openDrilldown(`${i18n.t('Patient Type')}: ${pop.name}`, pop.teis, periodRange.label)}
                                                                className="cursor-pointer hover:bg-sky-50/60 dark:hover:bg-zinc-800/60 transition-colors group"
                                                            >
                                                                <td className="px-3 py-2 text-slate-700 dark:text-zinc-300 font-medium truncate border-r border-slate-200 dark:border-zinc-800">{pop.name}</td>
                                                                <td className="px-3 py-2 font-bold text-right text-slate-800 dark:text-zinc-200 font-mono">
                                                                    {pop.count} <span className="text-[10.5px] text-slate-500 font-normal">({pop.percentage}%)</span>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <tr>
                                                            <td colSpan={2} className="px-3 py-3 text-center text-slate-400 font-medium">
                                                                {i18n.t('No population categories recorded')}
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Drilldown Modal */}
            <ReportDrilldownModal
                isOpen={drilldownState.isOpen}
                onClose={closeDrilldown}
                title={drilldownState.title}
                subtitle={drilldownState.subtitle}
                clients={drilldownState.clients}
                onSelectTei={onSelectTei}
            />

            {/* Official Report Modal: ONLY THE REPORT */}
            {isReportModalOpen && (
                <MonthlyReportModal
                    open={isReportModalOpen}
                    onClose={() => setIsReportModalOpen(false)}
                    context={context}
                    setContext={setContext}
                    onSelectTei={onSelectTei}
                />
            )}
        </div>
    )
}

export default MonthlyReportPage
