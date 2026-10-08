import React from 'react'
import i18n from '@dhis2/d2-i18n'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'

export function PaginationNav({
    page = 1,
    pageSize = 15,
    total = 0,
    onPageChange,
    disabled = false,
    className,
}) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const currentPage = Math.min(Math.max(1, page), totalPages)

    // Generate compact, professional page numbers: 1, 2, 3 ... N
    const getPageNumbers = () => {
        if (totalPages <= 4) {
            return Array.from({ length: totalPages }, (_, i) => i + 1)
        }

        // Near the beginning: 1, 2, 3 ... totalPages
        if (currentPage <= 2) {
            return [1, 2, 3, '...', totalPages]
        }

        // Page 3: 1, 2, 3, 4 ... totalPages
        if (currentPage === 3) {
            return [1, 2, 3, 4, '...', totalPages]
        }

        // Near the end: 1 ... (totalPages-2), (totalPages-1), totalPages
        if (currentPage >= totalPages - 1) {
            return [1, '...', totalPages - 2, totalPages - 1, totalPages]
        }

        if (currentPage === totalPages - 2) {
            return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
        }

        // In the middle: 1 ... (cur-1), cur, (cur+1) ... totalPages
        return [
            1,
            '...',
            currentPage - 1,
            currentPage,
            currentPage + 1,
            '...',
            totalPages,
        ]
    }

    const pages = getPageNumbers()

    return (
        <nav
            aria-label={i18n.t('Pagination')}
            className={cn(
                'inline-flex items-center gap-0.5 p-[2px] rounded-lg border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs select-none',
                className
            )}
        >
            {/* Previous Page Button */}
            <button
                type="button"
                disabled={disabled || currentPage <= 1}
                onClick={() => onPageChange(currentPage - 1)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                title={i18n.t('Previous Page')}
                aria-label={i18n.t('Previous Page')}
            >
                <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Numbered Page List */}
            <div className="flex items-center gap-0.5">
                {pages.map((p, index) => {
                    if (p === '...') {
                        return (
                            <span
                                key={`ellipsis-${index}`}
                                className="flex h-7 w-4 sm:w-5 items-center justify-center text-[10px] sm:text-[11px] font-bold text-slate-400 dark:text-zinc-500 tracking-wider select-none"
                            >
                                ...
                            </span>
                        )
                    }

                    const isCurrent = p === currentPage

                    return (
                        <button
                            key={p}
                            type="button"
                            disabled={disabled || isCurrent}
                            onClick={() => onPageChange(p)}
                            aria-current={isCurrent ? 'page' : undefined}
                            className={cn(
                                'flex h-7 min-w-[24px] sm:min-w-[28px] items-center justify-center rounded-md px-1 sm:px-1.5 text-[11px] sm:text-[12px] font-medium transition-all select-none cursor-pointer',
                                isCurrent
                                    ? 'bg-[var(--app-header-bar-bg,#2c6693)] text-white font-bold shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 active:scale-95'
                            )}
                        >
                            {p}
                        </button>
                    )
                })}
            </div>

            {/* Next Page Button */}
            <button
                type="button"
                disabled={disabled || currentPage >= totalPages}
                onClick={() => onPageChange(currentPage + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                title={i18n.t('Next Page')}
                aria-label={i18n.t('Next Page')}
            >
                <ChevronRight className="h-4 w-4" />
            </button>
        </nav>
    )
}
