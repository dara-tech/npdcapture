import React, { useState, useEffect, useCallback } from 'react'
import {
    ArrowUp,
    Building2,
    Calendar,
    CalendarX,
    Check,
    ChevronLeft,
    ChevronRight,
    CreditCard,
    FileText,
    Hash,
    Layers,
    Phone,
    UserCheck,
} from 'lucide-react'
import { cn } from '../lib/utils'
import emptyCaptureImg from '../assets/empty-capture.png'

export function EmptyWelcomeState({ context = {}, mode = 'capture' }) {
    const [activeSlide, setActiveSlide] = useState(0)
    const [isPaused, setIsPaused] = useState(false)

    const hasOrgUnit = Boolean(context.orgUnit)
    const hasProgram = Boolean(context.program)

    // Auto-advance slides every 6.5 seconds unless paused on hover
    useEffect(() => {
        if (isPaused) return
        const timer = setInterval(() => {
            setActiveSlide((prev) => (prev + 1) % 3)
        }, 6500)
        return () => clearInterval(timer)
    }, [isPaused])

    const handlePrev = useCallback(() => {
        setActiveSlide((prev) => (prev === 0 ? 2 : prev - 1))
    }, [])

    const handleNext = useCallback(() => {
        setActiveSlide((prev) => (prev + 1) % 3)
    }, [])

    const handleOpenOrgUnit = useCallback(() => {
        window.dispatchEvent(new CustomEvent('d2:open-org-unit-modal'))
        const el = document.getElementById('org-unit-select-trigger')
        if (el) el.click()
    }, [])

    const handleOpenProgram = useCallback(() => {
        const el = document.getElementById('program-select-trigger')
        if (el) {
            el.click()
        } else {
            handleOpenOrgUnit()
        }
    }, [handleOpenOrgUnit])

    return (
        <div
            className="app-card flex min-h-0 flex-1 flex-col overflow-hidden relative font-sans"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-10 md:p-12 select-none">
                <div className="flex max-w-[580px] w-full flex-col items-center text-center">

                    {/* Top Guide Indicator pointing up (Interactive shortcut) */}
                    <button
                        type="button"
                        onClick={!hasOrgUnit ? handleOpenOrgUnit : handleOpenProgram}
                        className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-200/80 dark:border-sky-800/50 bg-sky-50/90 dark:bg-sky-950/40 px-3.5 py-1 text-xs font-semibold text-sky-700 dark:text-sky-300 shadow-xs hover:bg-sky-100 hover:border-sky-300 transition-all cursor-pointer animate-pulse active:scale-95"
                        title="ចុចដើម្បីជ្រើសរើស"
                    >
                        <ArrowUp className="h-3.5 w-3.5 animate-bounce text-sky-600 dark:text-sky-400" />
                        <span>សូមជ្រើសរើស អង្គភាព និង កម្មវិធី នៅរបារខាងលើ</span>
                    </button>

                    {/* 3D Illustration with Soft Glow */}
                    <div className="relative mb-5 flex items-center justify-center">
                        <div className="absolute -inset-6 rounded-full bg-teal-500/10 dark:bg-cyan-400/5 blur-3xl pointer-events-none" />
                        <img
                            src={emptyCaptureImg}
                            alt="DHIS2 Capture Ready"
                            className="relative w-44 h-44 sm:w-52 sm:h-52 object-contain drop-shadow-sm transition-transform duration-300 hover:scale-105 pointer-events-none"
                            draggable="false"
                        />
                    </div>

                    {/* Slide Content with smooth transition container */}
                    <div className="min-h-[190px] w-full flex flex-col items-center justify-center">
                        {activeSlide === 0 && (
                            <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-300 w-full">
                                <h2 className="mb-2 text-[20px] sm:text-[22px] font-bold text-slate-900 dark:text-zinc-100 tracking-normal m-0 leading-normal">
                                    តើអ្នកត្រៀមខ្លួនរួចរាល់ហើយឬនៅ?
                                </h2>
                                <p className="mb-5 px-3 max-w-md text-[13.5px] sm:text-[14.5px] leading-[1.85] text-slate-600 dark:text-zinc-400 m-0">
                                    {mode === 'report' ? (
                                        <>សូមជ្រើសរើស <span className="font-bold text-slate-800 dark:text-zinc-200">អង្គភាព/មូលដ្ឋានសុខាភិបាល</span> និង <span className="font-bold text-slate-800 dark:text-zinc-200">កម្មវិធី</span> នៅរបារខាងលើ ដើម្បីទាញយកទិន្នន័យរបាយការណ៍។</>
                                    ) : (
                                        <>សូមជ្រើសរើស <span className="font-bold text-slate-800 dark:text-zinc-200">អង្គភាព/មូលដ្ឋានសុខាភិបាល</span> និង <span className="font-bold text-slate-800 dark:text-zinc-200">កម្មវិធី</span> នៅរបារខាងលើ ដើម្បីចាប់ផ្តើមស្វែងរក ឬបញ្ចូលទិន្នន័យ។</>
                                    )}
                                </p>

                                {/* Interactive Step Cards */}
                                <div className="grid grid-cols-2 gap-2.5 w-full max-w-md px-1">
                                    <button
                                        type="button"
                                        onClick={handleOpenOrgUnit}
                                        className={cn(
                                            'group flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
                                            hasOrgUnit
                                                ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300 shadow-xs hover:bg-emerald-100/80'
                                                : 'border-slate-200 bg-white/90 text-slate-700 hover:border-sky-300 hover:bg-sky-50/50 hover:shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:border-sky-700',
                                            'active:scale-[0.98]'
                                        )}
                                        title={hasOrgUnit ? 'ចុចដើម្បីប្តូរអង្គភាព' : 'ចុចដើម្បីជ្រើសរើសអង្គភាព'}
                                    >
                                        <div
                                            className={cn(
                                                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105',
                                                hasOrgUnit
                                                    ? 'bg-emerald-600 text-white'
                                                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 group-hover:bg-sky-100 group-hover:text-sky-600'
                                            )}
                                        >
                                            {hasOrgUnit ? <Check className="h-4 w-4 stroke-[2.5]" /> : <Building2 className="h-4 w-4" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[10.5px] uppercase tracking-wider font-semibold opacity-70">
                                                {hasOrgUnit ? '✓ បានជ្រើសរើស' : 'ជំហានទី ១'}
                                            </div>
                                            <div className="text-[12.5px] font-bold truncate leading-snug py-0.5">
                                                អង្គភាព / មូលដ្ឋាន
                                            </div>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleOpenProgram}
                                        className={cn(
                                            'group flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all duration-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
                                            hasProgram
                                                ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300 shadow-xs hover:bg-emerald-100/80'
                                                : 'border-slate-200 bg-white/90 text-slate-700 hover:border-sky-300 hover:bg-sky-50/50 hover:shadow-xs dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:border-sky-700',
                                            'active:scale-[0.98]'
                                        )}
                                        title={hasProgram ? 'ចុចដើម្បីប្តូរកម្មវិធី' : 'ចុចដើម្បីជ្រើសរើសកម្មវិធី'}
                                    >
                                        <div
                                            className={cn(
                                                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105',
                                                hasProgram
                                                    ? 'bg-emerald-600 text-white'
                                                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 group-hover:bg-sky-100 group-hover:text-sky-600'
                                            )}
                                        >
                                            {hasProgram ? <Check className="h-4 w-4 stroke-[2.5]" /> : <Layers className="h-4 w-4" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[10.5px] uppercase tracking-wider font-semibold opacity-70">
                                                {hasProgram ? '✓ បានជ្រើសរើស' : 'ជំហានទី ២'}
                                            </div>
                                            <div className="text-[12.5px] font-bold truncate leading-snug py-0.5">
                                                កម្មវិធីសុខាភិបាល
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeSlide === 1 && (
                            <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-300 w-full">
                                <h2 className="mb-2 text-[20px] sm:text-[22px] font-bold text-slate-900 dark:text-zinc-100 tracking-normal m-0 leading-normal">
                                    ស្វែងរកទិន្នន័យអតិថិជនបានរហ័ស
                                </h2>
                                <p className="mb-5 px-3 max-w-md text-[13.5px] sm:text-[14.5px] leading-[1.85] text-slate-600 dark:text-zinc-400 m-0">
                                    ស្វែងរកកំណត់ត្រាអតិថិជនបានយ៉ាងងាយស្រួល តាមរយៈលក្ខខណ្ឌចម្រុះជាច្រើនជម្រើស៖
                                </p>

                                {/* Search Attributes Chips */}
                                <div className="flex flex-wrap justify-center gap-2 max-w-md">
                                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-300">
                                        <Hash className="h-3.5 w-3.5 text-sky-500" />
                                        លេខកូដសម្គាល់ (UUIC)
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-800/60 dark:bg-indigo-950/40 dark:text-indigo-300">
                                        <UserCheck className="h-3.5 w-3.5 text-indigo-500" />
                                        ឈ្មោះពេញ / នាមត្រកូល
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                                        <Phone className="h-3.5 w-3.5 text-emerald-500" />
                                        លេខទូរស័ព្ទទំនាក់ទំនង
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300">
                                        <CreditCard className="h-3.5 w-3.5 text-amber-500" />
                                        លេខ PMRS
                                    </span>
                                </div>
                            </div>
                        )}

                        {activeSlide === 2 && (
                            <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-300 w-full">
                                <h2 className="mb-2 text-[20px] sm:text-[22px] font-bold text-slate-900 dark:text-zinc-100 tracking-normal m-0 leading-normal">
                                    តាមដានការណាត់ជួប និងរបាយការណ៍
                                </h2>
                                <p className="mb-5 px-3 max-w-md text-[13.5px] sm:text-[14.5px] leading-[1.85] text-slate-600 dark:text-zinc-400 m-0">
                                    តាមដានការណាត់ជួបប្រចាំថ្ងៃ អតិថិជនខកខាន និងទាញយករបាយការណ៍បូកសរុប៖
                                </p>

                                {/* Appointments & Reports Chips */}
                                <div className="flex flex-wrap justify-center gap-2 max-w-md">
                                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 dark:border-teal-800/60 dark:bg-teal-950/40 dark:text-teal-300">
                                        <Calendar className="h-3.5 w-3.5 text-teal-500" />
                                        ការណាត់ជួបប្រចាំថ្ងៃ
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300">
                                        <CalendarX className="h-3.5 w-3.5 text-rose-500" />
                                        អតិថិជនខកខានការណាត់
                                    </span>
                                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:border-cyan-800/60 dark:bg-cyan-950/40 dark:text-cyan-300">
                                        <FileText className="h-3.5 w-3.5 text-cyan-500" />
                                        របាយការណ៍បូកសរុបប្រចាំខែ
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Interactive Carousel Navigation & Dots */}
                    <div className="mt-6 flex items-center justify-center gap-3">
                        <button
                            type="button"
                            onClick={handlePrev}
                            className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                            aria-label="ត្រឡប់ក្រោយ"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>

                        <div className="flex items-center gap-2">
                            {[0, 1, 2].map((idx) => {
                                const isActive = activeSlide === idx
                                return (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setActiveSlide(idx)}
                                        className={cn(
                                            'transition-all duration-300 focus:outline-none',
                                            isActive
                                                ? 'h-2 w-7 rounded-full bg-[var(--app-header-bar-bg)] shadow-xs'
                                                : 'h-2 w-2 rounded-full bg-slate-200 hover:bg-slate-300 dark:bg-zinc-700 dark:hover:bg-zinc-600'
                                        )}
                                        aria-label={`ផ្ទាំងទី ${idx + 1}`}
                                    />
                                )
                            })}
                        </div>

                        <button
                            type="button"
                            onClick={handleNext}
                            className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                            aria-label="បន្ទាប់"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>

                </div>
            </div>
        </div>
    )
}
