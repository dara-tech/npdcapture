import React, { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import i18n from '@dhis2/d2-i18n'
import {
    Bell,
    Calendar,
    CalendarCheck,
    CalendarX,
    ChevronLeft,
    ChevronRight,
    Clock,
    Download,
    Phone,
    Search,
    User,
    X,
} from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { cn } from '../lib/utils'

export function AppointmentsModal({
    open,
    onClose,
    todayAppointments = [],
    missedAppointments = [],
    onOpenDetail,
    defaultTab,
}) {
    // If today is empty and missed has items, start on MISSED tab so user sees the notifications
    const getInitialTab = () => {
        if (defaultTab) return defaultTab
        if (todayAppointments.length === 0 && missedAppointments.length > 0) return 'MISSED'
        return 'TODAY'
    }

    const [activeTab, setActiveTab] = useState(getInitialTab) // 'TODAY' | 'MISSED'
    const [searchQuery, setSearchQuery] = useState('')
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(15)

    // Auto-select MISSED tab when opened if today is empty but missed has items
    React.useEffect(() => {
        if (open) {
            if (defaultTab) {
                setActiveTab(defaultTab)
            } else if (todayAppointments.length === 0 && missedAppointments.length > 0) {
                setActiveTab('MISSED')
            }
        }
    }, [open, defaultTab, todayAppointments.length, missedAppointments.length])

    const currentList = activeTab === 'TODAY' ? todayAppointments : missedAppointments

    // Smart pagination with ellipsis
    const getPageNumbers = (currentPage, total) => {
        if (total <= 7) {
            return Array.from({ length: total }, (_, i) => i + 1)
        }
        if (currentPage <= 3) {
            return [1, 2, 3, 4, '...', total]
        }
        if (currentPage >= total - 2) {
            return [1, '...', total - 3, total - 2, total - 1, total]
        }
        return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', total]
    }

    // Filter by search query
    const filteredList = useMemo(() => {
        if (!searchQuery.trim()) return currentList
        const q = searchQuery.toLowerCase().trim()
        return currentList.filter((item) => {
            const name = String(item.clientName || '').toLowerCase()
            const uuic = String(item.clientUuic || '').toLowerCase()
            const smh = String(item.clientSmh || '').toLowerCase()
            const phone = String(item.clientPhone || '').toLowerCase()
            return name.includes(q) || uuic.includes(q) || smh.includes(q) || phone.includes(q)
        })
    }, [currentList, searchQuery])

    // Reset page to 1 when search or tab changes
    React.useEffect(() => {
        setPage(1)
    }, [activeTab, searchQuery])

    // Pagination calculations
    const totalItems = filteredList.length
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
    const safePage = Math.min(Math.max(1, page), totalPages)
    const startIndex = (safePage - 1) * pageSize
    const endIndex = Math.min(startIndex + pageSize, totalItems)
    const pagedList = filteredList.slice(startIndex, endIndex)

    // Export to CSV
    const handleExport = () => {
        if (!filteredList.length) return
        const isMissed = activeTab === 'MISSED'
        const headers = [
            '#',
            'Client Name',
            'UUIC',
            'SMH ID',
            'Phone Number',
            'Appointment Date',
            isMissed ? 'Days Overdue' : 'Status',
        ]
        const rows = filteredList.map((item, idx) => [
            idx + 1,
            `"${String(item.clientName || '').replace(/"/g, '""')}"`,
            `"${item.clientUuic || ''}"`,
            `"${item.clientSmh || ''}"`,
            `"${item.clientPhone || ''}"`,
            item.appointmentDate || '',
            isMissed ? `${item.daysOverdue} days` : 'Today',
        ])
        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.setAttribute('href', url)
        link.setAttribute(
            'download',
            `${isMissed ? 'missed_appointments' : 'today_appointments'}_${new Date().toISOString().slice(0, 10)}.csv`
        )
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    if (!open) return null

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />

            {/* Modal Box / Mobile Bottom Sheet */}
            <div
                className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-t-[28px] sm:rounded-3xl overflow-hidden shadow-2xl relative animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200 border-t sm:border border-slate-200/80 dark:border-zinc-800 flex flex-col max-h-[92vh] sm:max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Mobile Drag Handle */}
                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-zinc-700 mx-auto mt-2.5 shrink-0 sm:hidden" />

                {/* Modal Header */}
                <div className="px-4 sm:px-6 pt-3 sm:pt-5 pb-3 sm:pb-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/50 shrink-0">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[var(--app-header-bar-bg)] dark:bg-blue-950/60 dark:text-blue-300 border border-blue-100 dark:border-blue-900/60 shadow-2xs">
                            <Bell className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm sm:text-base md:text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100 truncate">
                                    {i18n.t('Appointments & Follow-ups')}
                                </h3>
                                <span className="inline-flex items-center rounded-full bg-app-tint-10 px-2 py-0.5 text-[10px] font-bold text-app-primary shrink-0">
                                    {totalItems} {i18n.t('records')}
                                </span>
                            </div>
                            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                                {i18n.t('Clients scheduled for clinical visits')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {/* Export Button */}
                        <button
                            type="button"
                            onClick={handleExport}
                            disabled={filteredList.length === 0}
                            className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                            title={i18n.t('Export to CSV')}
                        >
                            <Download className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">{i18n.t('Export')}</span>
                        </button>

                        {/* Close Button */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                            title={i18n.t('Close')}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Subheader: Separate Tabs Bar & Global Search */}
                <div className="px-4 sm:px-6 py-2.5 sm:py-3.5 bg-slate-50/80 dark:bg-zinc-900/80 border-b border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0">
                    {/* Separate Distinct Tabs - 50/50 grid on mobile */}
                    <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto">
                        <button
                            type="button"
                            onClick={() => setActiveTab('TODAY')}
                            className={cn(
                                'flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all border shadow-2xs',
                                activeTab === 'TODAY'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                    : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-100/70 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                            )}
                        >
                            <CalendarCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate">{i18n.t('Appointed Today')}</span>
                            <span
                                className={cn(
                                    'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10.5px] font-extrabold shrink-0',
                                    activeTab === 'TODAY'
                                        ? 'bg-emerald-200/80 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200'
                                        : 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300'
                                )}
                            >
                                {todayAppointments.length > 99 ? '99+' : todayAppointments.length}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('MISSED')}
                            className={cn(
                                'flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all border shadow-2xs',
                                activeTab === 'MISSED'
                                    ? 'bg-red-50 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800'
                                    : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-100/70 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                            )}
                        >
                            <CalendarX className="h-3.5 w-3.5 text-red-600 shrink-0" />
                            <span className="truncate">{i18n.t('Missed / Overdue')}</span>
                            <span
                                className={cn(
                                    'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10.5px] font-extrabold shrink-0',
                                    activeTab === 'MISSED'
                                        ? 'bg-red-200/80 text-red-900 dark:bg-red-900 dark:text-red-200'
                                        : 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300'
                                )}
                            >
                                {missedAppointments.length > 99 ? '99+' : missedAppointments.length}
                            </span>
                        </button>
                    </div>

                    {/* Quick Search */}
                    <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <Input
                            type="text"
                            placeholder={i18n.t('Search name, UUIC, phone...')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-8 pl-8 pr-3 text-xs rounded-xl bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 font-medium w-full"
                        />
                    </div>
                </div>

                {/* Modal Body: Client Cards List */}
                <div className="p-3 sm:p-6 flex flex-col gap-2.5 sm:gap-3 overflow-y-auto custom-scrollbar flex-1 min-h-[250px] sm:min-h-[300px]">
                    {pagedList.map((item, idx) => {
                        const isMissed = activeTab === 'MISSED'
                        return (
                            <div
                                key={idx}
                                onClick={() => {
                                    onClose?.()
                                    onOpenDetail?.(item.tei)
                                }}
                                className={cn(
                                    'group flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border transition-all duration-150 cursor-pointer shadow-2xs select-none',
                                    'bg-white hover:bg-slate-50/80 hover:border-[var(--app-header-bar-bg)] dark:bg-zinc-900 dark:hover:bg-zinc-800/60 dark:border-zinc-800',
                                    isMissed
                                        ? 'border-red-100 hover:border-red-300 dark:border-red-950/60'
                                        : 'border-emerald-100 hover:border-emerald-300 dark:border-emerald-950/60'
                                )}
                            >
                                {/* Left Client Info */}
                                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                    <div
                                        className={cn(
                                            'flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl font-bold text-xs shadow-2xs group-hover:scale-105 transition-transform',
                                            isMissed
                                                ? 'bg-red-50 text-red-700 border border-red-200/80 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900/60'
                                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900/60'
                                        )}
                                    >
                                        <User className="h-4.5 w-4.5 sm:h-5 sm:w-5 opacity-80" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                            <span className="font-bold text-slate-900 dark:text-zinc-100 text-xs sm:text-sm truncate">
                                                {item.clientName}
                                            </span>
                                            {item.clientUuic && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-[10px] sm:text-[11px] font-mono font-medium text-slate-600 dark:text-zinc-400">
                                                    UUIC: {item.clientUuic}
                                                </span>
                                            )}
                                            {item.clientSmh && (
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-[10px] sm:text-[11px] font-mono font-medium text-slate-600 dark:text-zinc-400">
                                                    SMH: {item.clientSmh}
                                                </span>
                                            )}
                                        </div>

                                        <div className="mt-0.5 sm:mt-1 flex items-center gap-2.5 sm:gap-3 text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400 flex-wrap">
                                            <div className="flex items-center gap-1 font-mono">
                                                <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-400" />
                                                <span>{item.appointmentDate}</span>
                                            </div>
                                            {item.clientPhone && (
                                                <div className="flex items-center gap-1 font-mono text-[10.5px] sm:text-[11px]">
                                                    <Phone className="h-3 w-3 text-slate-400" />
                                                    <span>{item.clientPhone}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Badge & Action */}
                                <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-zinc-800">
                                    {isMissed ? (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-700 border border-red-200/80 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10.5px] sm:text-[11px] font-bold dark:bg-red-950/50 dark:text-red-300 dark:border-red-900/60">
                                            <Clock className="h-3 w-3 text-red-600" />
                                            <span>
                                                {i18n.t('Overdue {{days}} days', { days: item.daysOverdue })}
                                            </span>
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10.5px] sm:text-[11px] font-bold dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/60">
                                            <CalendarCheck className="h-3 w-3 text-emerald-600" />
                                            <span>{i18n.t('Today')}</span>
                                        </span>
                                    )}

                                    <div className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 group-hover:bg-[var(--app-header-bar-bg)] group-hover:text-white dark:bg-zinc-800 dark:text-zinc-400 transition-colors">
                                        <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    </div>
                                </div>
                            </div>
                        )
                    })}

                    {filteredList.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center text-slate-400">
                            {activeTab === 'TODAY' ? (
                                <>
                                    <CalendarCheck className="h-10 w-10 sm:h-12 sm:w-12 stroke-[1.5] text-emerald-500/70 mb-2.5 sm:mb-3" />
                                    <p className="font-bold text-slate-700 dark:text-zinc-300 text-xs sm:text-sm">
                                        {i18n.t('No appointments scheduled for today')}
                                    </p>
                                    <p className="text-[11px] sm:text-xs text-slate-400 max-w-xs mt-1">
                                        {i18n.t('All scheduled follow-ups are up to date.')}
                                    </p>
                                </>
                            ) : (
                                <>
                                    <CalendarX className="h-10 w-10 sm:h-12 sm:w-12 stroke-[1.5] text-emerald-500/70 mb-2.5 sm:mb-3" />
                                    <p className="font-bold text-slate-700 dark:text-zinc-300 text-xs sm:text-sm">
                                        {i18n.t('No missed or overdue appointments')}
                                    </p>
                                    <p className="text-[11px] sm:text-xs text-slate-400 max-w-xs mt-1">
                                        {i18n.t('Great job! No clients have overdue follow-up dates.')}
                                    </p>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer with Responsive Pagination */}
                <div className="px-4 sm:px-6 py-2.5 sm:py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3 bg-slate-50/90 dark:bg-zinc-900/90 border-t border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0">
                    {/* Top Row on Mobile: Range indicator + Mobile Compact Stepper */}
                    <div className="flex items-center justify-between w-full sm:w-auto">
                        <div className="text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400 font-medium">
                            {totalItems > 0 ? (
                                <span>
                                    {i18n.t('Showing {{start}} - {{end}} / {{total}}', {
                                        start: startIndex + 1,
                                        end: endIndex,
                                        total: totalItems,
                                    })}
                                </span>
                            ) : (
                                <span>{i18n.t('0 records')}</span>
                            )}
                        </div>

                        {/* Mobile Stepper: < 1 / 6 > */}
                        {totalPages > 1 && (
                            <div className="flex items-center gap-1 sm:hidden">
                                <button
                                    type="button"
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={safePage <= 1}
                                    className="h-7 w-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                </button>
                                <span className="px-2 text-xs font-bold text-slate-700 dark:text-zinc-200 font-mono">
                                    {safePage} / {totalPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={safePage >= totalPages}
                                    className="h-7 w-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Desktop Center: Centered Numbered Page Buttons with Ellipsis */}
                    {totalPages > 1 && (
                        <div className="hidden sm:flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={safePage <= 1}
                                className="h-7 w-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </button>

                            {getPageNumbers(safePage, totalPages).map((p, i) => {
                                if (p === '...') {
                                    return (
                                        <span
                                            key={`ellipsis-${i}`}
                                            className="h-7 w-5 flex items-center justify-center text-xs text-slate-400 font-bold"
                                        >
                                            ...
                                        </span>
                                    )
                                }
                                return (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setPage(p)}
                                        className={cn(
                                            'h-7 min-w-[28px] px-1.5 flex items-center justify-center rounded-lg text-xs font-bold transition-all',
                                            safePage === p
                                                ? 'bg-[var(--app-header-bar-bg)] text-white shadow-2xs'
                                                : 'border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700'
                                        )}
                                    >
                                        {p}
                                    </button>
                                )
                            })}

                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={safePage >= totalPages}
                                className="h-7 w-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}

                    {/* Bottom Row on Mobile / Right on Desktop: Page Size & Close */}
                    <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-2">
                        {/* Styled page-size segmented pills */}
                        {totalItems > 0 && (
                            <div className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-zinc-800 p-0.5">
                                {[10, 15, 30, 50].map((size) => (
                                    <button
                                        key={size}
                                        type="button"
                                        onClick={() => { setPageSize(size); setPage(1) }}
                                        className={cn(
                                            'h-6 min-w-[28px] px-2 rounded-lg text-[11px] font-bold transition-all',
                                            pageSize === size
                                                ? 'bg-white dark:bg-zinc-700 text-slate-800 dark:text-zinc-100 shadow-sm'
                                                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
                                        )}
                                    >
                                        {size}
                                    </button>
                                ))}
                            </div>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-3 rounded-lg text-xs font-semibold ml-auto sm:ml-0"
                            onClick={onClose}
                        >
                            {i18n.t('Close')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}
