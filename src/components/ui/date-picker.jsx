import React, { useState, useEffect, useMemo } from 'react'
import { format, parseISO, isValid } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { ChevronDownIcon, Cross2Icon } from '@radix-ui/react-icons'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { useI18nLanguage } from '../../hooks/useI18nLanguage'
import { cn } from '../../lib/utils'
import { formControlClasses } from '../../lib/formUi'

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

function parseToDate(value) {
    if (!value) return undefined
    try {
        const parsed = typeof value === 'string' ? parseISO(value) : value
        return parsed instanceof Date && isValid(parsed) ? parsed : undefined
    } catch {
        return undefined
    }
}

function fmt(d) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
}

function formatDisplayDate(d) {
    if (!d) return ''
    return format(d, 'dd/MM/yyyy')
}

export function DatePicker({
    date,
    setDate,
    placeholder,
    className,
    disabled = false,
    showExternalClear = true,
    disableFuture = false,
    minDate = null,
    maxDate = null,
}) {
    const lang = useI18nLanguage()
    const isKm = !lang || lang.startsWith('km') || lang === 'kh'

    const [open, setOpen] = useState(false)
    const selectedDate = useMemo(() => parseToDate(date), [date])
    const selectedDateStr = useMemo(() => {
        if (!selectedDate) return ''
        return fmt(selectedDate)
    }, [selectedDate])

    const minDateStr = useMemo(() => {
        if (!minDate) return null
        if (typeof minDate === 'string') {
            const raw = minDate.trim()
            if (!raw) return null
            return raw.includes('T') ? raw.split('T')[0] : raw.slice(0, 10)
        }
        if (minDate instanceof Date && isValid(minDate)) {
            return fmt(minDate)
        }
        return null
    }, [minDate])

    const maxDateStr = useMemo(() => {
        if (!maxDate) return null
        if (typeof maxDate === 'string') {
            const raw = maxDate.trim()
            if (!raw) return null
            return raw.includes('T') ? raw.split('T')[0] : raw.slice(0, 10)
        }
        if (maxDate instanceof Date && isValid(maxDate)) {
            return fmt(maxDate)
        }
        return null
    }, [maxDate])

    const today = useMemo(() => new Date(), [])
    const todayStr = useMemo(() => fmt(new Date()), [])

    const [viewYear, setViewYear] = useState(() => {
        const base = selectedDate ?? (minDateStr ? parseToDate(minDateStr) : new Date()) ?? new Date()
        return base.getFullYear()
    })
    const [viewMonth, setViewMonth] = useState(() => {
        const base = selectedDate ?? (minDateStr ? parseToDate(minDateStr) : new Date()) ?? new Date()
        return base.getMonth()
    })

    const [showYearPicker, setShowYearPicker] = useState(false)

    useEffect(() => {
        if (open) {
            const base = selectedDate ?? (minDateStr ? parseToDate(minDateStr) : new Date()) ?? new Date()
            setViewYear(base.getFullYear())
            setViewMonth(base.getMonth())
            setShowYearPicker(false)
        }
    }, [open, selectedDate, minDateStr])

    const isDateDisabled = (dateStr) => {
        if (disableFuture && dateStr > todayStr) return true
        if (maxDateStr && dateStr > maxDateStr) return true
        if (minDateStr && dateStr < minDateStr) return true
        return false
    }

    const minYearMonth = useMemo(() => {
        if (!minDateStr) return null
        const parts = minDateStr.split('-')
        if (parts.length < 2) return null
        return {
            year: parseInt(parts[0], 10),
            month: parseInt(parts[1], 10) - 1,
        }
    }, [minDateStr])

    const isAtMinMonth = minYearMonth && (viewYear < minYearMonth.year || (viewYear === minYearMonth.year && viewMonth <= minYearMonth.month))
    const isAtCurrentMonth = disableFuture && viewYear === today.getFullYear() && viewMonth === today.getMonth()

    const handlePrevMonth = () => {
        if (isAtMinMonth) return
        if (viewMonth === 0) {
            setViewMonth(11)
            setViewYear((y) => y - 1)
        } else {
            setViewMonth((m) => m - 1)
        }
    }

    const handleNextMonth = () => {
        if (disableFuture) {
            const isAtOrAfterCurrent = viewYear > today.getFullYear() || (viewYear === today.getFullYear() && viewMonth >= today.getMonth())
            if (isAtOrAfterCurrent) return
        }
        if (maxDate) {
            const maxYear = parseInt(maxDate.split('-')[0], 10)
            const maxMonth = parseInt(maxDate.split('-')[1], 10) - 1
            if (viewYear > maxYear || (viewYear === maxYear && viewMonth >= maxMonth)) return
        }
        if (viewMonth === 11) {
            setViewMonth(0)
            setViewYear((y) => y + 1)
        } else {
            setViewMonth((m) => m + 1)
        }
    }

    const handleSelectDate = (dateStr) => {
        if (disabled || isDateDisabled(dateStr)) return
        setDate(dateStr)
        setOpen(false)
    }

    const handleClear = () => {
        if (disabled) return
        setDate('')
        setOpen(false)
    }

    // Calendar matrix
    const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate()

    const calendarDays = []
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const dNum = daysInPrevMonth - i
        const prevMonthIdx = viewMonth === 0 ? 11 : viewMonth - 1
        const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear
        const dStr = `${prevYear}-${String(prevMonthIdx + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`
        calendarDays.push({ day: dNum, dateStr: dStr, isCurrentMonth: false, disabled: isDateDisabled(dStr) })
    }
    for (let i = 1; i <= daysInMonth; i++) {
        const dStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
        calendarDays.push({ day: i, dateStr: dStr, isCurrentMonth: true, disabled: isDateDisabled(dStr) })
    }
    const totalCells = Math.ceil(calendarDays.length / 7) * 7
    const remaining = totalCells - calendarDays.length
    for (let i = 1; i <= remaining; i++) {
        const nextMonthIdx = viewMonth === 11 ? 0 : viewMonth + 1
        const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear
        const dStr = `${nextYear}-${String(nextMonthIdx + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
        calendarDays.push({ day: i, dateStr: dStr, isCurrentMonth: false, disabled: isDateDisabled(dStr) })
    }

    // Year selection range (100 years back to 5 years ahead)
    const yearsList = useMemo(() => {
        const curY = today.getFullYear()
        const minYear = minYearMonth ? minYearMonth.year : curY - 100
        const maxYear = disableFuture ? curY : curY + 10
        const list = []
        for (let y = maxYear; y >= minYear; y--) {
            list.push(y)
        }
        return list
    }, [today, minYearMonth, disableFuture])

    const ph = placeholder ?? (isKm ? 'ជ្រើសរើសថ្ងៃខែឆ្នាំ' : 'Pick a date')

    return (
        <div className="flex w-full min-w-0 items-stretch gap-1.5">
            <Popover open={disabled ? false : open} onOpenChange={(next) => !disabled && setOpen(next)}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        disabled={disabled}
                        className={cn(
                            formControlClasses(
                                'inline-flex flex-1 min-w-0 items-center justify-between gap-2 text-left font-normal cursor-pointer'
                            ),
                            !date && 'text-slate-400',
                            date && 'border-[rgba(44,102,147,0.35)] bg-white shadow-xs ring-1 ring-[rgba(44,102,147,0.12)] font-medium text-slate-800 dark:bg-zinc-900 dark:text-zinc-100',
                            open && !disabled && 'border-[rgba(44,102,147,0.5)] ring-2 ring-[rgba(44,102,147,0.22)]',
                            disabled && 'cursor-not-allowed opacity-60',
                            className
                        )}
                        aria-expanded={open}
                        aria-label={ph}
                    >
                        <CalendarDays
                            className={cn('h-4 w-4 shrink-0', date ? 'text-[var(--app-header-bar-bg)]' : 'text-slate-400')}
                            aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate text-xs sm:text-sm">
                            {date && selectedDate ? (
                                formatDisplayDate(selectedDate)
                            ) : (
                                <span className="text-slate-400">{ph}</span>
                            )}
                        </span>
                        <ChevronDownIcon
                            className={cn(
                                'h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200',
                                open && 'rotate-180 text-[var(--app-header-bar-bg)]'
                            )}
                            aria-hidden
                        />
                    </button>
                </PopoverTrigger>
                <PopoverContent
                    className="w-[280px] sm:w-[300px] p-3 shadow-2xl border border-slate-200 bg-white rounded-xl dark:border-zinc-800 dark:bg-zinc-900 z-[1000]"
                    align="start"
                    side="bottom"
                    sideOffset={4}
                    collisionPadding={12}
                >
                    {/* Month / Year Navigator */}
                    <div className="flex items-center justify-between mb-2">
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

                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setShowYearPicker((p) => !p)}
                                className="px-2 py-1 text-xs font-bold text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer dark:text-zinc-200 dark:hover:bg-zinc-800"
                            >
                                {isKm
                                    ? `ខែ${KHMER_MONTHS[viewMonth]} ${viewYear}`
                                    : `${EN_MONTHS[viewMonth]} ${viewYear}`}
                                <ChevronDownIcon className="inline-block w-3 h-3 ml-1 text-slate-400" />
                            </button>
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

                    {/* Year / Month Quick Picker View */}
                    {showYearPicker ? (
                        <div className="max-h-[190px] overflow-y-auto custom-scrollbar grid grid-cols-3 gap-1 p-1 bg-slate-50 rounded-lg border border-slate-100 dark:bg-zinc-800 dark:border-zinc-700 mb-2">
                            {yearsList.map((y) => (
                                <button
                                    key={y}
                                    type="button"
                                    onClick={() => {
                                        setViewYear(y)
                                        setShowYearPicker(false)
                                    }}
                                    className={cn(
                                        'py-1.5 text-xs font-medium rounded transition-colors',
                                        viewYear === y
                                            ? 'bg-[#2d6693] text-white font-bold'
                                            : 'hover:bg-white text-slate-700 dark:text-zinc-300 dark:hover:bg-zinc-700'
                                    )}
                                >
                                    {y}
                                </button>
                            ))}
                        </div>
                    ) : null}

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
                            const isSelected = selectedDateStr === cDay.dateStr
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
                                            ? 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-200 dark:hover:bg-zinc-800 cursor-pointer'
                                            : 'text-slate-400 hover:bg-slate-50 dark:text-zinc-500 cursor-pointer',
                                        isToday && !isSelected && 'border border-[#2d6693]/40 font-bold text-[#2d6693]'
                                    )}
                                >
                                    {cDay.day}
                                </button>
                            )
                        })}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between gap-2 pt-2 mt-2 border-t border-slate-100 dark:border-zinc-800">
                        {date ? (
                            <button
                                type="button"
                                className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer dark:hover:bg-rose-950/40"
                                onClick={handleClear}
                            >
                                {isKm ? 'លុបចេញ' : 'Clear'}
                            </button>
                        ) : <div />}
                        <button
                            type="button"
                            className="px-3 py-1 text-xs font-semibold text-[#2d6693] hover:bg-[#2d6693]/10 rounded-md transition-colors cursor-pointer"
                            onClick={() => setOpen(false)}
                        >
                            {isKm ? 'បិទ' : 'Close'}
                        </button>
                    </div>
                </PopoverContent>
            </Popover>

            {date && !disabled && showExternalClear ? (
                <button
                    type="button"
                    onClick={(e) => {
                        e.preventDefault()
                        setDate('')
                    }}
                    className="flex h-9 w-9 rounded-md shrink-0 items-center justify-center border border-slate-200 bg-white text-slate-400 shadow-2xs transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(44,102,147,0.35)] cursor-pointer"
                    aria-label={isKm ? 'លុបកាលបរិច្ឆេទ' : 'Clear date'}
                >
                    <Cross2Icon className="h-4 w-4" />
                </button>
            ) : null}
        </div>
    )
}
