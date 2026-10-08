import React from 'react'
import { cn } from '../../lib/utils'

const SIZE = {
    page: 'h-9 w-9',
    block: 'h-7 w-7',
    inline: 'h-4 w-4',
    spinner: 'h-3.5 w-3.5',
}

/** Sleek Gradient Ring with Soft Center Glow */
export function LoadingMark({ className }) {
    const gradientId = React.useId()
    const filterId = React.useId()

    return (
        <span
            className={cn('relative inline-flex shrink-0 items-center justify-center text-[var(--app-header-bar-bg)]', className)}
            aria-hidden
        >
            <svg viewBox="0 0 40 40" fill="none" className="h-full w-full">
                <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
                        <stop offset="60%" stopColor="#38bdf8" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
                    </linearGradient>
                    <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="1.5" />
                    </filter>
                </defs>

                {/* Soft center glow */}
                <circle
                    cx="20"
                    cy="20"
                    r="6"
                    className="animate-pulse fill-current opacity-25"
                    filter={`url(#${filterId})`}
                />

                {/* Subtle track background */}
                <circle
                    cx="20"
                    cy="20"
                    r="15"
                    className="stroke-slate-200/80 dark:stroke-zinc-800"
                    strokeWidth="3"
                />

                {/* Spinning gradient ring */}
                <circle
                    cx="20"
                    cy="20"
                    r="15"
                    stroke={`url(#${gradientId})`}
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="animate-spin origin-center"
                    strokeDasharray="65 30"
                    style={{ animationDuration: '0.8s' }}
                />

                {/* Center pulse dot */}
                <circle
                    cx="20"
                    cy="20"
                    r="2.5"
                    className="animate-pulse fill-current"
                />
            </svg>
        </span>
    )
}

/**
 * Single loading UI for the whole app.
 * page/block always center their content.
 */
export function Loading({
    label,
    variant = 'block',
    className,
    sizeClassName,
}) {
    const mark = <LoadingMark className={cn(SIZE[variant] || SIZE.block, sizeClassName)} />

    const content = (
        <>
            <div
                className={cn(
                    'flex items-center justify-center rounded-2xl border border-slate-200/60 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900',
                    variant === 'page' && 'h-16 w-16',
                    variant === 'block' && 'h-14 w-14',
                    variant === 'inline' && 'h-auto border-0 bg-transparent p-0 shadow-none'
                )}
            >
                {mark}
            </div>
            {label ? (
                <span
                    className={cn(
                        'text-center tracking-tight app-text-meta',
                        variant === 'page' && 'text-sm font-medium text-slate-800 dark:text-zinc-200',
                        variant === 'block' && 'text-[13px]',
                        variant === 'inline' && 'text-[12px]'
                    )}
                >
                    {label}
                </span>
            ) : null}
        </>
    )

    if (variant === 'spinner') {
        return (
            <span
                className={cn('inline-flex items-center gap-1.5', className)}
                role="status"
                aria-live="polite"
                aria-busy="true"
            >
                {mark}
                {label ? (
                    <span className="text-[13px] leading-none">{label}</span>
                ) : null}
            </span>
        )
    }

    if (variant === 'page') {
        return (
            <div
                className={cn(
                    'fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-white/75 backdrop-blur-[2px] text-slate-500 dark:bg-zinc-950/75 dark:text-zinc-400',
                    className
                )}
                role="status"
                aria-live="polite"
                aria-busy="true"
            >
                {content}
            </div>
        )
    }

    if (variant === 'block') {
        return (
            <div
                className={cn(
                    'flex h-full min-h-[120px] w-full flex-1 flex-col items-center justify-center gap-3 text-slate-500 dark:text-zinc-400',
                    className
                )}
                role="status"
                aria-live="polite"
                aria-busy="true"
            >
                {content}
            </div>
        )
    }

    return (
        <div
            className={cn(
                'flex w-full flex-row items-center justify-center gap-2 px-1 py-1.5 text-slate-500 dark:text-zinc-400',
                className
            )}
            role="status"
            aria-live="polite"
            aria-busy="true"
        >
            {content}
        </div>
    )
}

export default Loading
