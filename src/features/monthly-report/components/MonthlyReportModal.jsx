import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import i18n from '@dhis2/d2-i18n'
import { useDataEngine } from '@dhis2/app-runtime'
import { Cross2Icon } from '@radix-ui/react-icons'
import {
    Calendar,
    ClipboardList,
    Download,
    FileSpreadsheet,
    Printer,
    RefreshCw,
} from 'lucide-react'
import { useI18nLanguage } from '../../../hooks/useI18nLanguage'
import { Button } from '../../../components/ui/button'
import { PeriodSelectModal } from '../../../components/PeriodSelectModal'
import { useMonthlyReportData } from '../hooks/useMonthlyReportData'
import { Spinner } from '../../../components/ui/spinner'
import { cn } from '../../../lib/utils'
import { ReportDrilldownModal } from './ReportDrilldownModal'
import { NchadsReportSection } from './NchadsReportSection'
import nchadsLogo from '../../../assets/nchads-logo.png'

const printMediaStyles = `
@media print {
    body * {
        visibility: hidden !important;
    }
    #monthly-report-modal-overlay,
    #monthly-report-modal-overlay * {
        visibility: visible !important;
    }
    #monthly-report-modal-overlay {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        background: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
        inset: auto !important;
        z-index: auto !important;
        overflow: visible !important;
    }
    #monthly-report-card {
        display: block !important;
        position: static !important;
        width: 100% !important;
        max-width: 100% !important;
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
        border: none !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        background: #ffffff !important;
    }
    #monthly-report-print-document {
        display: block !important;
        position: static !important;
        width: 100% !important;
        max-width: 100% !important;
        height: auto !important;
        max-height: none !important;
        overflow: visible !important;
        padding: 0 !important;
        margin: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
    }
    .no-print {
        display: none !important;
    }
    table, tr, td, th, tbody, thead {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
        -webkit-column-break-inside: avoid !important;
    }
}
`

export function MonthlyReportModal({
    open,
    isOpen,
    onClose,
    context,
    setContext,
    viewMode: propViewMode,
    onSelectTei,
}) {
    useI18nLanguage()
    const engine = useDataEngine()
    const isVisible = open !== undefined ? open : (isOpen !== undefined ? isOpen : true)

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

    // Automatically initialize period to current month if opened without a period set
    useEffect(() => {
        if (!isVisible) return
        if (!context?.period && (!context?.periodKeys || context?.periodKeys.length === 0)) {
            const now = new Date()
            const curMonthKey = `${now.getFullYear()}-M${String(now.getMonth() + 1).padStart(2, '0')}`
            setContext?.((prev) => ({
                ...prev,
                period: curMonthKey,
                periodKeys: [curMonthKey],
            }))
        }
    }, [isVisible, context?.period, context?.periodKeys, setContext])

    // Keyboard Escape to close modal
    useEffect(() => {
        if (!isVisible) return
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault()
                onClose?.()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isVisible, onClose])

    const handlePrint = () => {
        window.print()
    }

    const handleExportExcel = () => {
        if (!reportData || !periodRange) return
        const lines = []
        lines.push(`KINGDOM OF CAMBODIA,NATION RELIGION KING`)
        lines.push(`MINISTRY OF HEALTH / NCHADS,MONTHLY ROUTINE REPORT ON CLINICAL & STI SERVICES`)
        lines.push(`Organisation Unit,${context.orgUnitName || context.orgUnit}`)
        lines.push(`Program,${metadata?.displayName || metadata?.name || context.program}`)
        lines.push(`Period,${periodRange.label} (${periodRange.startDate} to ${periodRange.endDate})`)
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

        const csvContent = lines.join('\n')
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `nchads_sti_report_${periodRange.startDate}_${periodRange.endDate}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    if (!isVisible) return null

    return createPortal(
        <>
            <style dangerouslySetInnerHTML={{ __html: printMediaStyles }} />

            {/* Modal Dialog Overlay */}
            <div
                id="monthly-report-modal-overlay"
                onClick={(e) => {
                    if (e.target.id === 'monthly-report-modal-overlay') {
                        onClose?.()
                    }
                }}
                className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
            >
                {/* Modal Dialog Card */}
                <div
                    id="monthly-report-card"
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-5xl max-h-[94vh] bg-white dark:bg-black rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-zinc-800"
                >
                    {/* Modal Top Control Bar (Hidden on print) */}
                    <div className="no-print px-4 sm:px-5 py-2.5 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-black shrink-0">
                        {/* Title & Badge */}
                        <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-app-tint-10 text-app-primary shrink-0">
                                <FileSpreadsheet className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col justify-center">
                                <h3 className="report-header-font text-sm text-slate-900 dark:text-zinc-100 flex items-center gap-2 m-0 leading-tight">
                                    <span>របាយការណ៍ប្រចាំខែ (NCHADS)</span>
                                    <span className="text-[10px] bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-mono px-2 py-0.5 rounded font-sans">
                                        A4 Standard
                                    </span>
                                </h3>
                                {metadata?.displayName || metadata?.name ? (
                                    <span className="text-[11px] text-slate-500 dark:text-zinc-400 truncate max-w-[200px] sm:max-w-[280px]">
                                        {metadata.displayName || metadata.name}
                                    </span>
                                ) : null}
                            </div>
                        </div>

                        {/* Controls: Period, Refresh, Export, Print, Close */}
                        <div className="flex items-center gap-1.5 shrink-0">
                            {/* Period Selector (Month / Year) */}
                            <div className="w-[140px] sm:w-[155px] shrink-0">
                                <PeriodSelectModal
                                    value={context?.periodKeys || (context?.period ? [context.period] : [])}
                                    onChange={(keys) => setContext?.({ ...context, periodKeys: keys, period: keys[0] || '' })}
                                    customValue={context?.customPeriodRange || null}
                                    onCustomRange={(range) => setContext?.({ ...context, customPeriodRange: range, period: 'custom' })}
                                    disabled={loading}
                                    buttonClassName="h-8 text-xs font-semibold px-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700 shadow-2xs"
                                    allowedPeriodKinds={['month', 'custom']}
                                    isEventView={(context?.viewMode || propViewMode) === 'EVENTS'}
                                    onToggleEventView={(isEv) =>
                                        setContext?.((prev) => ({
                                            ...prev,
                                            viewMode:
                                                (isEv !== undefined ? isEv : (prev?.viewMode || propViewMode) !== 'EVENTS')
                                                    ? 'EVENTS'
                                                    : 'ENROLLMENTS',
                                        }))
                                    }
                                />
                            </div>

                            {/* View Mode Toggle: Enrollments vs Events */}
                            <button
                                type="button"
                                onClick={() =>
                                    setContext?.((prev) => ({
                                        ...prev,
                                        viewMode:
                                            (prev?.viewMode || propViewMode || 'ENROLLMENTS') === 'EVENTS'
                                                ? 'ENROLLMENTS'
                                                : 'EVENTS',
                                    }))
                                }
                                className={cn(
                                    'h-8 px-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer select-none flex items-center gap-1 shrink-0',
                                    isEventsMode
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-200 shadow-2xs'
                                        : 'border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-700'
                                )}
                                title={i18n.t('Toggle between Events and Enrollments View')}
                            >
                                <span className={cn('h-1.5 w-1.5 rounded-full', isEventsMode ? 'bg-blue-500' : 'bg-slate-400')} />
                                <span>{isEventsMode ? i18n.t('ព្រឹត្តិការណ៍') : i18n.t('ចុះឈ្មោះ')}</span>
                            </button>

                            {/* Refresh */}
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => refetch()}
                                disabled={loading || !hasOrgUnit || !hasProgram || !hasPeriod}
                                className="h-8 w-8 p-0 text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer rounded-lg shrink-0"
                                title={i18n.t('Refresh')}
                                aria-label="Refresh"
                            >
                                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                            </Button>

                            {/* Export to CSV */}
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleExportExcel}
                                disabled={!reportData || !periodRange || loading}
                                className="h-8 w-8 p-0 text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer rounded-lg shrink-0"
                                title={i18n.t('Export to CSV')}
                                aria-label="Export"
                            >
                                <Download className="h-3.5 w-3.5" />
                            </Button>

                            {/* Print Button */}
                            <Button
                                type="button"
                                onClick={handlePrint}
                                disabled={!reportData || loading}
                                className="h-8 w-8 p-0 bg-app-primary hover:bg-app-primary/90 text-white rounded-lg shadow-xs cursor-pointer shrink-0 border-0"
                                title={i18n.t('Print A4 (Print)')}
                                aria-label="Print A4"
                            >
                                <Printer className="h-4 w-4" />
                            </Button>

                            {/* Close Button */}
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onClose?.()}
                                className="h-8 w-8 p-0 border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer rounded-lg shrink-0"
                                title={i18n.t('Close')}
                                aria-label="Close"
                            >
                                <Cross2Icon className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Printable Document Area: ONLY THE OFFICIAL REPORT */}
                    <div
                        className="p-4 sm:p-5 md:p-6 overflow-y-auto custom-scrollbar flex-1 bg-white text-black"
                        id="monthly-report-print-document"
                    >
                        {!hasOrgUnit || !hasProgram ? (
                            <div className="flex flex-col items-center justify-center p-8 text-center font-sans">
                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                                    <ClipboardList className="h-6 w-6" />
                                </div>
                                <h3 className="text-base font-bold text-slate-900 m-0">
                                    សូមជ្រើសរើស អង្គភាព និងកម្មវិធីសុខាភិបាល
                                </h3>
                                <p className="text-xs text-slate-500 mt-1 max-w-md">
                                    ដើម្បីបង្កើតរបាយការណ៍ប្រចាំខែ សូមជ្រើសរើសមូលដ្ឋានសុខាភិបាល និងកម្មវិធីនៅរបារខាងលើជាមុនសិន។
                                </p>
                            </div>
                        ) : !hasPeriod ? (
                            <div className="flex flex-col items-center justify-center p-8 text-center font-sans">
                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                                    <Calendar className="h-6 w-6" />
                                </div>
                                <h3 className="text-base font-bold text-slate-900 m-0">
                                    សូមជ្រើសរើសកាលបរិច្ឆេទ / រយៈពេលរាយការណ៍
                                </h3>
                                <p className="text-xs text-slate-500 mt-1 max-w-md">
                                    សូមជ្រើសរើសខែ និងឆ្នាំនៃរបាយការណ៍នៅប៊ូតុងជ្រើសរើសកាលបរិច្ឆេទខាងលើ។
                                </p>
                            </div>
                        ) : loading ? (
                            <div className="flex flex-col items-center justify-center p-12 text-center">
                                <Spinner className="h-7 w-7 text-sky-600" />
                                <span className="mt-2.5 text-xs font-semibold text-slate-600">
                                    {i18n.t('Aggregating monthly clinical records...')}
                                </span>
                            </div>
                        ) : error ? (
                            <div className="p-3.5 border border-red-200 bg-red-50 text-red-700 text-xs rounded-xl shadow-2xs">
                                <p className="font-bold">{i18n.t('Failed to load report data')}</p>
                                <p className="text-[11px] mt-0.5">{error}</p>
                            </div>
                        ) : reportData && periodRange ? (
                            <div className="space-y-3 font-sans">
                                {/* Official National Healthcare Letterhead */}
                                <div className="flex items-start justify-between gap-3 pb-2 border-b border-black">
                                    {/* Left: Ministry & NCHADS Logo */}
                                    <div className="flex items-start gap-2.5 max-w-[65%]">
                                        <img
                                            src={nchadsLogo}
                                            alt="NCHADS Logo"
                                            style={{ width: '48px', height: '48px', minWidth: '48px', minHeight: '48px' }}
                                            className="w-12 h-12 object-contain shrink-0"
                                        />
                                        <div className="text-left flex flex-col justify-center">
                                            <h4 className="text-[12.5px] font-bold text-black tracking-tight leading-tight m-0">
                                                ក្រសួងសុខាភិបាល
                                            </h4>
                                            <h5 className="text-[11px] font-semibold text-black leading-tight mt-0.5 m-0">
                                                មជ្ឈមណ្ឌលជាតិប្រយុទ្ធនឹងជំងឺអេដស៍ សើស្បែក និងកាមរោគ (NCHADS)
                                            </h5>
                                            <p className="text-[10px] text-stone-700 mt-0.5 m-0">
                                                មណ្ឌលសុខភាព / មន្ទីរពេទ្យបង្អែក ៖ {context.orgUnitName || context.orgUnit || '.......................................................'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Right: Kingdom of Cambodia Motto */}
                                    <div className="text-center shrink-0 pr-1">
                                        <h4 className="text-[12.5px] font-bold text-black tracking-normal m-0 leading-tight">
                                            ព្រះរាជាណាចក្រកម្ពុជា
                                        </h4>
                                        <h5 className="text-[10.5px] font-semibold text-black tracking-wide mt-0.5 m-0 leading-tight">
                                            ជាតិ សាសនា ព្រះមហាក្សត្រ
                                        </h5>
                                        <div className="w-12 h-0.5 bg-black mx-auto mt-1" />
                                    </div>
                                </div>

                                {/* Center Big Document Title */}
                                <div className="text-center my-2 sm:my-2.5">
                                    <h1 className="text-[15px] sm:text-[16.5px] font-bold text-black tracking-normal m-0 leading-snug">
                                        {/sti|កាមរោគ/i.test(metadata?.displayName || metadata?.name || '')
                                            ? 'របាយការណ៍ប្រចាំខែស្តីពីសេវាពិនិត្យ និងព្យាបាលជំងឺកាមរោគ'
                                            : `របាយការណ៍ប្រចាំខែស្តីពី ${metadata?.displayName || metadata?.name || 'សេវាសុខាភិបាល'}`}
                                    </h1>
                                </div>

                                {/* Organisation Unit & Context Metadata Table matching user screenshot */}
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse border border-stone-300 text-[11px] sm:text-[11.5px] font-sans table-fixed">
                                        <colgroup>
                                            <col className="w-[22%]" />
                                            <col className="w-[28%]" />
                                            <col className="w-[22%]" />
                                            <col className="w-[28%]" />
                                        </colgroup>
                                        <tbody>
                                            <tr className="border-b border-stone-300">
                                                <td className="px-2.5 py-1 bg-stone-100 font-bold text-stone-900 border-r border-stone-300 text-left">
                                                    អង្គភាព / មូលដ្ឋានសុខាភិបាល
                                                </td>
                                                <td className="px-2.5 py-1 text-black font-semibold border-r border-stone-300 text-left">
                                                    {context.orgUnitName || context.orgUnit}
                                                </td>
                                                <td className="px-2.5 py-1 bg-stone-100 font-bold text-stone-900 border-r border-stone-300 text-left">
                                                    កម្មវិធីសុខាភិបាល
                                                </td>
                                                <td className="px-2.5 py-1 text-black font-semibold text-left">
                                                    {metadata?.displayName || metadata?.name || context.program}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-2.5 py-1 bg-stone-100 font-bold text-stone-900 border-r border-stone-300 text-left">
                                                    កាលបរិច្ឆេទ / រយៈពេលរាយការណ៍
                                                </td>
                                                <td className="px-2.5 py-1 text-black font-semibold border-r border-stone-300 text-left">
                                                    {periodRange.label}
                                                </td>
                                                <td className="px-2.5 py-1 bg-stone-100 font-bold text-stone-900 border-r border-stone-300 text-left">
                                                    ចន្លោះកាលបរិច្ឆេទ
                                                </td>
                                                <td className="px-2.5 py-1 text-black font-semibold text-left font-mono text-[11px]">
                                                    {periodRange.startDate} ដល់ {periodRange.endDate}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* ONLY THE OFFICIAL NATIONAL REPORT: NchadsReportSection */}
                                <div className="mt-2.5">
                                    <NchadsReportSection
                                        programReport={reportData.programReport}
                                        nchadsReport={reportData.nchadsReport}
                                        openDrilldown={openDrilldown}
                                        periodLabel={periodRange.label}
                                    />
                                </div>

                                {/* Sign-off Block for Print / Official Signatures */}
                                <div className="mt-5 pt-3 border-t border-stone-300 grid grid-cols-2 gap-6 text-[11px] font-sans">
                                    <div className="text-center">
                                        <p className="font-medium text-black m-0">បានឃើញ និងពិនិត្យត្រឹមត្រូវ</p>
                                        <p className="font-bold text-black mt-0.5 text-[11.5px] m-0">ប្រធានមណ្ឌលសុខភាព / មន្ទីរពេទ្យបង្អែក</p>
                                        <div className="h-10" />
                                        <p className="font-medium text-stone-500 m-0">ហត្ថលេខា និងត្រា</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="font-medium text-black m-0">ថ្ងៃទី......... ខែ......... ឆ្នាំ២០២...</p>
                                        <p className="font-bold text-black mt-0.5 text-[11.5px] m-0">អ្នកធ្វើរបាយការណ៍</p>
                                        <div className="h-10" />
                                        <p className="font-medium text-stone-500 m-0">ហត្ថលេខា</p>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* Drilldown Modal (z-[240]) */}
            <ReportDrilldownModal
                isOpen={drilldownState.isOpen}
                onClose={closeDrilldown}
                title={drilldownState.title}
                subtitle={drilldownState.subtitle}
                clients={drilldownState.clients}
                onSelectTei={(tei) => {
                    closeDrilldown()
                    onClose?.()
                    onSelectTei?.(tei)
                }}
            />
        </>,
        document.body
    )
}

export default MonthlyReportModal
