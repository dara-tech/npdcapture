import React, { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Calendar as CalendarIcon, X, ArrowRight, Clock, Check, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import { useI18nLanguage } from '../hooks/useI18nLanguage'
import { cn } from '../lib/utils'

const KHMER_MONTHS = [
    'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា',
    'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'
]

const EN_MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
]

const KHMER_WEEKDAYS = ['អា', 'ច', 'អ', 'ព', 'ព្រ', 'សុ', 'ស']
const EN_WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function fmt(d) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

function formatDisplayDate(dateStr) {
    if (!dateStr) return ''
    const parts = dateStr.split('-')
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    return dateStr
}

function getTodayString() {
    return fmt(new Date())
}

function getYesterdayString() {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return fmt(d)
}

export function RegistrationDateModal({
    open,
    onClose,
    onConfirm,
    initialDate,
    title,
    subtitle,
    minDate, // e.g. Enrollment Date (YYYY-MM-DD)
    maxDate, // e.g. Today (YYYY-MM-DD)
    confirmText,
}) {
    const lang = useI18nLanguage()
    const isKm = !lang || lang.startsWith('km') || lang === 'kh'

    const todayStr = useMemo(() => getTodayString(), [])
    const yesterdayStr = useMemo(() => getYesterdayString(), [])
    const effectiveMaxDate = maxDate || todayStr

    const defaultInitial = useMemo(() => {
        if (initialDate) return initialDate
        if (minDate && todayStr < minDate) return minDate
        return todayStr
    }, [initialDate, minDate, todayStr])

    const [selectedDate, setSelectedDate] = useState(defaultInitial)

    // Current viewing month and year in the calendar
    const [viewYear, setViewYear] = useState(() => {
        const d = defaultInitial ? new Date(defaultInitial) : new Date()
        return isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear()
    })
    const [viewMonth, setViewMonth] = useState(() => {
        const d = defaultInitial ? new Date(defaultInitial) : new Date()
        return isNaN(d.getTime()) ? new Date().getMonth() : d.getMonth()
    })

    useEffect(() => {
        if (open) {
            const init = initialDate || (minDate && todayStr < minDate ? minDate : todayStr)
            setSelectedDate(init)
            const d = new Date(init)
            if (!isNaN(d.getTime())) {
                setViewYear(d.getFullYear())
                setViewMonth(d.getMonth())
            }
            const prev = document.body.style.overflow
            document.body.style.overflow = 'hidden'
            return () => {
                document.body.style.overflow = prev
            }
        }
    }, [open, initialDate, minDate, todayStr])

    if (!open) return null

    const minYearMonth = minDate ? {
        year: parseInt(minDate.split('-')[0], 10),
        month: parseInt(minDate.split('-')[1], 10) - 1,
    } : null

    const handlePrevMonth = () => {
        if (minYearMonth) {
            const isAtOrBeforeMin = viewYear < minYearMonth.year || (viewYear === minYearMonth.year && viewMonth <= minYearMonth.month)
            if (isAtOrBeforeMin) return
        }
        if (viewMonth === 0) {
            setViewMonth(11)
            setViewYear((y) => y - 1)
        } else {
            setViewMonth((m) => m - 1)
        }
    }

    const handleNextMonth = () => {
        const now = new Date()
        const isCurrentOrFuture = viewYear > now.getFullYear() || (viewYear === now.getFullYear() && viewMonth >= now.getMonth())
        if (isCurrentOrFuture) return
        if (viewMonth === 11) {
            setViewMonth(0)
            setViewYear((y) => y + 1)
        } else {
            setViewMonth((m) => m + 1)
        }
    }

    const isDateDisabled = (dateStr) => {
        if (effectiveMaxDate && dateStr > effectiveMaxDate) return true
        if (minDate && dateStr < minDate) return true
        return false
    }

    const handleSelectDate = (dateStr) => {
        if (isDateDisabled(dateStr)) return
        setSelectedDate(dateStr)
    }

    const handleQuickSelect = (dateStr) => {
        if (isDateDisabled(dateStr)) return
        setSelectedDate(dateStr)
        const d = new Date(dateStr)
        if (!isNaN(d.getTime())) {
            setViewYear(d.getFullYear())
            setViewMonth(d.getMonth())
        }
    }

    const handleSubmit = (e) => {
        e?.preventDefault?.()
        if (!selectedDate || isDateDisabled(selectedDate)) return
        onConfirm(selectedDate)
    }

    // Build the calendar matrix for viewYear & viewMonth
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()

    const calendarDays = []
    // Previous month trailing days
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const dNum = daysInPrevMonth - i
        const prevMonthIdx = viewMonth === 0 ? 11 : viewMonth - 1
        const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear
        const dStr = `${prevYear}-${String(prevMonthIdx + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`
        calendarDays.push({ day: dNum, dateStr: dStr, isCurrentMonth: false, disabled: isDateDisabled(dStr) })
    }
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
        const dStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
        calendarDays.push({ day: i, dateStr: dStr, isCurrentMonth: true, disabled: isDateDisabled(dStr) })
    }
    // Next month leading days to complete grid
    const totalCells = Math.ceil(calendarDays.length / 7) * 7
    const remaining = totalCells - calendarDays.length
    for (let i = 1; i <= remaining; i++) {
        const nextMonthIdx = viewMonth === 11 ? 0 : viewMonth + 1
        const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear
        const dStr = `${nextYear}-${String(nextMonthIdx + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
        calendarDays.push({ day: i, dateStr: dStr, isCurrentMonth: false, disabled: isDateDisabled(dStr) })
    }

    const now = new Date()
    const isAtCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth()
    const isAtMinMonth = minYearMonth && (viewYear < minYearMonth.year || (viewYear === minYearMonth.year && viewMonth <= minYearMonth.month))

    const modalTitle = title || (isKm ? 'កាលបរិច្ឆេទចុះឈ្មោះ' : 'Registration Date')
    const modalSubtitle = subtitle || (isKm ? 'ជ្រើសរើសកាលបរិច្ឆេទចុះឈ្មោះអតិថិជនថ្មី' : 'Select enrollment date for new registration')
    const actionButtonText = confirmText || (isKm ? 'បន្តទៅកាន់ការចុះឈ្មោះ' : 'Proceed to Register')

    const isYesterdayDisabled = minDate && yesterdayStr < minDate
    const isTodayDisabled = minDate && todayStr < minDate

    const modalContent = (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
                onClick={onClose}
            />

            {/* Modal Box */}
            <div
                className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 dark:bg-zinc-900 dark:ring-white/10 animate-in fade-in-0 zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 bg-[#2d6693] px-4 py-3 text-white">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-white shrink-0">
                            <CalendarIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-sm font-semibold tracking-wide text-white truncate">
                                {modalTitle}
                            </h3>
                            <p className="text-[11px] text-white/80 leading-tight truncate">
                                {modalSubtitle}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-white/80 hover:bg-white/15 hover:text-white transition-colors cursor-pointer shrink-0 ml-2"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
                    {/* Quick Selection Shortcuts */}
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            disabled={isTodayDisabled}
                            onClick={() => handleQuickSelect(todayStr)}
                            className={cn(
                                'flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-all',
                                isTodayDisabled
                                    ? 'opacity-40 cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                                    : selectedDate === todayStr
                                    ? 'border-[#2d6693] bg-[#2d6693]/10 text-[#2d6693] font-semibold dark:bg-[#2d6693]/25 shadow-xs cursor-pointer'
                                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 cursor-pointer'
                            )}
                        >
                            <Clock className="h-3.5 w-3.5" />
                            <span>{isKm ? 'ថ្ងៃនេះ' : 'Today'}</span>
                            {selectedDate === todayStr && !isTodayDisabled && <Check className="h-3.5 w-3.5 ml-auto text-[#2d6693]" />}
                        </button>
                        <button
                            type="button"
                            disabled={isYesterdayDisabled}
                            onClick={() => handleQuickSelect(yesterdayStr)}
                            className={cn(
                                'flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-all',
                                isYesterdayDisabled
                                    ? 'opacity-40 cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                                    : selectedDate === yesterdayStr
                                    ? 'border-[#2d6693] bg-[#2d6693]/10 text-[#2d6693] font-semibold dark:bg-[#2d6693]/25 shadow-xs cursor-pointer'
                                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 cursor-pointer'
                            )}
                        >
                            <CalendarIcon className="h-3.5 w-3.5" />
                            <span>{isKm ? 'ម្សិលមិញ' : 'Yesterday'}</span>
                            {selectedDate === yesterdayStr && !isYesterdayDisabled && <Check className="h-3.5 w-3.5 ml-auto text-[#2d6693]" />}
                        </button>
                    </div>

                    {/* Integrated Calendar Box */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                        {/* Month/Year Navigation */}
                        <div className="flex items-center justify-between mb-2.5">
                            <button
                                type="button"
                                onClick={handlePrevMonth}
                                disabled={isAtMinMonth}
                                className={cn(
                                    'flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition-colors dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 shadow-2xs',
                                    isAtMinMonth ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-100 cursor-pointer'
                                )}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <div className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                                {isKm
                                    ? `ខែ${KHMER_MONTHS[viewMonth]} ${viewYear}`
                                    : `${EN_MONTHS[viewMonth]} ${viewYear}`}
                            </div>
                            <button
                                type="button"
                                onClick={handleNextMonth}
                                disabled={isAtCurrentMonth}
                                className={cn(
                                    'flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition-colors dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 shadow-2xs',
                                    isAtCurrentMonth
                                        ? 'opacity-40 cursor-not-allowed'
                                        : 'hover:bg-slate-100 cursor-pointer'
                                )}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Weekday Headers */}
                        <div className="grid grid-cols-7 gap-1 text-center mb-1">
                            {(isKm ? KHMER_WEEKDAYS : EN_WEEKDAYS).map((w, idx) => (
                                <div
                                    key={idx}
                                    className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500 py-0.5"
                                >
                                    {w}
                                </div>
                            ))}
                        </div>

                        {/* Days Grid */}
                        <div className="grid grid-cols-7 gap-1">
                            {calendarDays.map((cDay, idx) => {
                                const isSelected = selectedDate === cDay.dateStr
                                const isToday = todayStr === cDay.dateStr

                                return (
                                    <button
                                        key={idx}
                                        type="button"
                                        disabled={cDay.disabled}
                                        onClick={() => handleSelectDate(cDay.dateStr)}
                                        className={cn(
                                            'h-7 w-full flex items-center justify-center rounded-md text-xs font-medium transition-all',
                                            isSelected
                                                ? 'bg-[#2d6693] text-white font-bold shadow-xs cursor-pointer'
                                                : cDay.disabled
                                                ? 'text-slate-300 dark:text-zinc-600 opacity-40 cursor-not-allowed'
                                                : cDay.isCurrentMonth
                                                ? 'text-slate-700 hover:bg-white hover:shadow-2xs dark:text-zinc-200 dark:hover:bg-zinc-700 cursor-pointer'
                                                : 'text-slate-400 hover:bg-white/60 dark:text-zinc-500 cursor-pointer',
                                            isToday && !isSelected && 'border border-[#2d6693]/40 font-bold text-[#2d6693]'
                                        )}
                                    >
                                        {cDay.day}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Minimum Enrollment Date Restriction Warning/Hint */}
                    {minDate && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300 text-[11px]">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                            <span>
                                {isKm
                                    ? `កាលបរិច្ឆេទចុះឈ្មោះ៖ ${formatDisplayDate(minDate)} (មិនអាចតូចជាងថ្ងៃចុះឈ្មោះទេ)`
                                    : `Enrolled Date: ${formatDisplayDate(minDate)} (cannot be before enrollment)`}
                            </span>
                        </div>
                    )}

                    {/* Selected Date Indicator */}
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#2d6693]/5 border border-[#2d6693]/15 text-xs text-slate-700 dark:text-zinc-300">
                        <span className="text-[11px] font-medium text-slate-500">
                            {isKm ? 'កាលបរិច្ឆេទជ្រើសរើស' : 'Selected Date'}
                        </span>
                        <span className="font-bold text-[#2d6693]">
                            {formatDisplayDate(selectedDate)}
                        </span>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                            {isKm ? 'បោះបង់' : 'Cancel'}
                        </button>
                        <button
                            type="submit"
                            disabled={!selectedDate || isDateDisabled(selectedDate)}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-[#2d6693] hover:bg-[#245277] active:bg-[#1e4463] rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                        >
                            <span>{actionButtonText}</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )

    return createPortal(modalContent, document.body)
}
