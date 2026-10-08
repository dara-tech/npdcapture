import React from 'react'
import i18n from '@dhis2/d2-i18n'
import { LoadingMark } from '../../../components/ui/loading'
import { TEI_LIST } from '../teiListUi'
import { cn } from '../../../lib/utils'

/** Top animated progress bar for tables and panels */
export function TopLoadingBar({ className }) {
    return (
        <div
            className={cn(
                'absolute top-0 left-0 right-0 h-0.5 z-30 overflow-hidden bg-sky-100/60 dark:bg-sky-950/40 pointer-events-none',
                className
            )}
        >
            <div className="h-full w-full bg-gradient-to-r from-transparent via-[var(--app-header-bar-bg)] to-transparent animate-pulse" />
        </div>
    )
}

/** Modern glassmorphic loading overlay with glowing LoadingMark */
export function TeiListLoadingOverlay({ label, compact = false, showTopBar = true }) {
    if (!label) return null
    return (
        <div className={TEI_LIST.loadingOverlay}>
            {showTopBar && <TopLoadingBar />}
            <div className={TEI_LIST.loadingPanel}>
                <LoadingMark className={compact ? 'h-6 w-6' : 'h-7 w-7'} />
                <div className="flex flex-col text-left">
                    <span className={TEI_LIST.loadingText}>{label}</span>
                    <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-500">
                        {i18n.t('Please wait…')}
                    </span>
                </div>
            </div>
        </div>
    )
}

/** Realistic Shimmer Table Skeleton Rows for desktop views */
export function TeiTableSkeleton({ rows = 6, cols = 8 }) {
    const rowWidths = [
        ['w-28', 'w-36', 'w-20', 'w-24', 'w-32', 'w-24', 'w-20'],
        ['w-32', 'w-24', 'w-28', 'w-20', 'w-24', 'w-24', 'w-20'],
        ['w-24', 'w-40', 'w-20', 'w-32', 'w-28', 'w-24', 'w-20'],
        ['w-36', 'w-28', 'w-24', 'w-20', 'w-24', 'w-24', 'w-20'],
        ['w-20', 'w-32', 'w-36', 'w-24', 'w-20', 'w-24', 'w-20'],
        ['w-28', 'w-24', 'w-20', 'w-28', 'w-32', 'w-24', 'w-20'],
        ['w-32', 'w-36', 'w-24', 'w-20', 'w-28', 'w-24', 'w-20'],
    ]

    return (
        <>
            {Array.from({ length: rows }).map((_, rIdx) => {
                const widths = rowWidths[rIdx % rowWidths.length]
                return (
                    <tr
                        key={rIdx}
                        className="border-b border-slate-100 dark:border-zinc-800/80 animate-pulse last:border-0"
                    >
                        {/* Checkbox */}
                        <td className="w-10 px-3 py-3 align-middle">
                            <div className="h-4 w-4 rounded border border-slate-200/80 bg-slate-100 dark:border-zinc-800 dark:bg-zinc-800" />
                        </td>

                        {/* Staggered Data Columns */}
                        {Array.from({ length: Math.max(1, cols - 2) }).map((_, cIdx) => (
                            <td key={cIdx} className="px-2.5 py-3 md:px-3">
                                <div
                                    className={cn(
                                        'h-4 rounded bg-slate-200/70 dark:bg-zinc-800',
                                        widths[cIdx % widths.length] || 'w-24'
                                    )}
                                />
                            </td>
                        ))}

                        {/* Action Button */}
                        <td className="px-2.5 py-3 text-right md:px-3">
                            <div className="ml-auto h-7 w-20 rounded-md bg-slate-200/70 dark:bg-zinc-800" />
                        </td>
                    </tr>
                )
            })}
        </>
    )
}

/** Mobile Card Skeletons */
export function TeiMobileSkeleton({ count = 5 }) {
    return (
        <div className="divide-y divide-slate-100 dark:divide-zinc-800/80 md:hidden">
            {Array.from({ length: count }).map((_, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 px-3.5 py-3 animate-pulse">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="h-4 w-4 rounded border border-slate-200/80 bg-slate-100 dark:border-zinc-800 dark:bg-zinc-800 shrink-0" />
                        <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="h-4 w-36 rounded bg-slate-200/80 dark:bg-zinc-800" />
                            <div className="h-3 w-24 rounded bg-slate-200/60 dark:bg-zinc-800" />
                            <div className="flex items-center gap-2 pt-0.5">
                                <div className="h-2.5 w-16 rounded bg-slate-200/50 dark:bg-zinc-800" />
                                <div className="h-2.5 w-14 rounded bg-slate-200/50 dark:bg-zinc-800" />
                            </div>
                        </div>
                    </div>
                    <div className="h-7 w-16 rounded-md bg-slate-200/70 dark:bg-zinc-800 shrink-0" />
                </div>
            ))}
        </div>
    )
}
