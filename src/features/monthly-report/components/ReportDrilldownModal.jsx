import React, { useState, useMemo, useEffect } from 'react'
import {
    X,
    Search,
    Users,
    ExternalLink,
    Download,
    User,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react'
import { cn } from '../../../lib/utils'

export function ReportDrilldownModal({
    isOpen,
    onClose,
    title,
    subtitle,
    clients = [],
    onSelectTei,
}) {
    const [searchQuery, setSearchQuery] = useState('')
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)

    // Reset page on search or when client list changes
    useEffect(() => {
        setPage(1)
    }, [searchQuery, clients, isOpen])

    const filteredClients = useMemo(() => {
        if (!isOpen) return []
        const query = searchQuery.trim().toLowerCase()
        if (!query) return clients
        return clients.filter((c) => {
            const uuic = String(c.uuic || '').toLowerCase()
            const pmrs = String(c.pmrs || '').toLowerCase()
            const name = String(c.name || '').toLowerCase()
            const sex = String(c.sex || '').toLowerCase()
            const patientType = String(c.patientType || '').toLowerCase()
            const phone = String(c.phone || '').toLowerCase()
            return (
                uuic.includes(query) ||
                pmrs.includes(query) ||
                name.includes(query) ||
                sex.includes(query) ||
                patientType.includes(query) ||
                phone.includes(query)
            )
        })
    }, [isOpen, clients, searchQuery])

    const totalItems = filteredClients.length
    const totalPages = Math.ceil(totalItems / pageSize) || 1
    const safePage = Math.min(Math.max(1, page), totalPages)
    const startIndex = (safePage - 1) * pageSize
    const endIndex = Math.min(totalItems, startIndex + pageSize)
    const paginatedClients = useMemo(() => {
        return filteredClients.slice(startIndex, endIndex)
    }, [filteredClients, startIndex, endIndex])

    // Numbered page links with ellipsis
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

    if (!isOpen) return null

    const handleExportCsv = () => {
        if (!clients.length) return
        const headers = ['ល.រ', 'កូដ UUIC', 'កូដ PMRS', 'ឈ្មោះអតិថិជន', 'ភេទ', 'អាយុ', 'ប្រភេទអតិថិជន', 'លេខទូរស័ព្ទ', 'កាលបរិច្ឆេទ']
        const rows = clients.map((c, i) => [
            i + 1,
            `"${c.uuic || ''}"`,
            `"${c.pmrs || ''}"`,
            `"${c.name || ''}"`,
            `"${c.sex || ''}"`,
            `"${c.age || ''}"`,
            `"${c.patientType || ''}"`,
            `"${c.phone || ''}"`,
            `"${c.enrollmentDate || ''}"`,
        ])
        const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `report_drilldown_${(title || 'clients').replace(/[^a-zA-Z0-9_-]/g, '_')}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="fixed inset-0 z-[240] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 font-sans antialiased">
            <div className="relative w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 shadow-xl overflow-hidden font-sans">
                {/* Modal Header — Clean & Minimal */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
                            <Users className="h-3.5 w-3.5" />
                        </div>
                        <div>
                            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2 m-0 leading-snug font-sans">
                                <span>{title || 'បញ្ជីឈ្មោះអតិថិជន'}</span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 font-mono">
                                    {clients.length}
                                </span>
                            </h3>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {clients.length > 0 && (
                            <button
                                type="button"
                                onClick={handleExportCsv}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-zinc-300 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700 transition-colors cursor-pointer font-sans"
                                title="ទាញយកជា CSV / Excel"
                            >
                                <Download className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">ទាញយកជា Excel</span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                            aria-label="បិទ"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Search Bar Toolbar — Minimal */}
                <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="ស្វែងរកតាម UUIC, PMRS, ឈ្មោះ, ភេទ ឬលេខទូរស័ព្ទ..."
                            className="h-8 w-full rounded-lg border border-slate-200/80 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-800/40 pl-8 pr-3 text-xs text-slate-800 dark:text-zinc-200 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 font-sans"
                        />
                    </div>
                    <div className="text-xs text-slate-500 dark:text-zinc-400 pl-2 font-sans">
                        {filteredClients.length} / {clients.length} កំណត់ត្រា
                    </div>
                </div>

                {/* Table Content — Clean & Consistent */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                    {paginatedClients.length > 0 ? (
                        <table className="w-full text-xs text-left border-collapse font-sans">
                            <thead className="sticky top-0 bg-slate-50/95 dark:bg-zinc-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-700 dark:text-zinc-200 z-10">
                                <tr>
                                    <th className="px-3.5 py-2.5 w-12 text-center">ល.រ</th>
                                    <th className="px-3.5 py-2.5">កូដ UUIC</th>
                                    <th className="px-3.5 py-2.5">កូដ PMRS</th>
                                    <th className="px-3.5 py-2.5">ឈ្មោះអតិថិជន</th>
                                    <th className="px-3.5 py-2.5 text-center">ភេទ</th>
                                    <th className="px-3.5 py-2.5 text-center">អាយុ</th>
                                    <th className="px-3.5 py-2.5">ប្រភេទអតិថិជន</th>
                                    <th className="px-3.5 py-2.5">កាលបរិច្ឆេទ</th>
                                    <th className="px-3.5 py-2.5 text-right pr-4">សកម្មភាព</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100/80 dark:divide-zinc-800/60 text-xs">
                                {paginatedClients.map((client, index) => (
                                    <tr
                                        key={client.id || index}
                                        className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors group font-sans"
                                    >
                                        <td className="px-3.5 py-2 text-center text-slate-400 text-xs font-mono">
                                            {startIndex + index + 1}
                                        </td>
                                        {/* UUIC Column */}
                                        <td className="px-3.5 py-2 font-semibold text-sky-700 dark:text-sky-400 text-xs font-sans">
                                            {client.uuic || '—'}
                                        </td>
                                        {/* PMRS Column */}
                                        <td className="px-3.5 py-2 text-slate-600 dark:text-zinc-400 text-xs font-mono">
                                            {client.pmrs || '—'}
                                        </td>
                                        {/* Name */}
                                        <td className="px-3.5 py-2 font-medium text-slate-800 dark:text-zinc-100 text-xs font-sans">
                                            {client.name}
                                        </td>
                                        {/* Sex */}
                                        <td className="px-3.5 py-2 text-center text-slate-700 dark:text-zinc-300 text-xs font-sans">
                                            {client.sex}
                                        </td>
                                        {/* Age */}
                                        <td className="px-3.5 py-2 text-center text-slate-700 dark:text-zinc-300 text-xs font-mono">
                                            {client.age}
                                        </td>
                                        {/* Patient Type */}
                                        <td className="px-3.5 py-2 text-xs text-slate-700 dark:text-zinc-300 font-sans">
                                            {client.patientType || '—'}
                                        </td>
                                        {/* Date */}
                                        <td className="px-3.5 py-2 text-slate-500 dark:text-zinc-400 text-xs font-mono">
                                            {client.enrollmentDate}
                                        </td>
                                        {/* Action */}
                                        <td className="px-3.5 py-2 text-right pr-4">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    onClose()
                                                    if (onSelectTei && (client.tei || client.teiId)) {
                                                        onSelectTei(client.tei || { trackedEntity: client.teiId, trackedEntityInstance: client.teiId })
                                                    }
                                                }}
                                                className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-800 dark:text-sky-400 hover:underline text-xs font-medium py-0.5 px-1.5 rounded hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors cursor-pointer font-sans"
                                                title="មើលប្រវត្តិរូបអតិថិជន"
                                            >
                                                <span>មើល</span>
                                                <ExternalLink className="h-3 w-3" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400 font-sans">
                            <User className="h-7 w-7 text-slate-300 dark:text-zinc-700 mb-2" />
                            <p className="text-xs font-medium">
                                {searchQuery ? 'មិនមានទិន្នន័យអតិថិជនត្រូវនឹងការស្វែងរកនេះទេ។' : 'មិនមានកំណត់ត្រាអតិថិជនក្នុងផ្នែកនេះទេ។'}
                            </p>
                        </div>
                    )}
                </div>

                {/* Modal Footer with Clean Minimal Pagination */}
                <div className="px-5 py-2.5 bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0 text-xs font-sans">
                    {/* Left: Showing range */}
                    <div className="text-slate-500 dark:text-zinc-400 text-xs font-sans">
                        {totalItems > 0 ? (
                            <span>
                                បង្ហាញ {startIndex + 1} - {endIndex} នៃ {totalItems}
                            </span>
                        ) : (
                            <span>0 កំណត់ត្រា</span>
                        )}
                    </div>

                    {/* Center: Page Navigation with Numbers & Ellipsis */}
                    {totalPages > 1 && (
                        <div className="flex items-center gap-0.5 font-sans">
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={safePage <= 1}
                                className="h-6 w-6 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                aria-label="ទំព័រមុន"
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </button>

                            {getPageNumbers(safePage, totalPages).map((p, i) => {
                                if (p === '...') {
                                    return (
                                        <span
                                            key={`ellipsis-${i}`}
                                            className="h-6 w-4 flex items-center justify-center text-xs text-slate-400 font-mono"
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
                                            'h-6 min-w-[24px] px-1.5 flex items-center justify-center rounded text-xs font-medium transition-all cursor-pointer font-mono',
                                            safePage === p
                                                ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-slate-900 shadow-2xs font-bold'
                                                : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
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
                                className="h-6 w-6 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-25 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                aria-label="ទំព័របន្ទាប់"
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}

                    {/* Right: Page Size & Close */}
                    <div className="flex items-center gap-2 font-sans">
                        <select
                            value={pageSize}
                            onChange={(e) => setPageSize(Number(e.target.value))}
                            className="h-7 px-2 text-xs font-medium rounded-lg border border-slate-200/80 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 cursor-pointer focus:outline-none font-sans"
                        >
                            <option value={10}>10 / ទំព័រ</option>
                            <option value={20}>20 / ទំព័រ</option>
                            <option value={50}>50 / ទំព័រ</option>
                            <option value={100}>100 / ទំព័រ</option>
                        </select>

                        <button
                            type="button"
                            onClick={onClose}
                            className="h-7 px-3 rounded-lg border border-slate-200/80 hover:bg-slate-100 dark:border-zinc-700 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-medium transition-colors cursor-pointer font-sans"
                        >
                            បិទ
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
