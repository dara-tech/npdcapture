import React from 'react'
import { cn } from '../../lib/utils'

/**
 * Accessible toggle switch (iOS-style) for BOOLEAN / TRUE_ONLY / multi-option rows.
 */
export function Switch({ id, checked, onCheckedChange, disabled = false, className, 'aria-label': ariaLabel }) {
    return (
        <button
            type="button"
            id={id}
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={() => !disabled && onCheckedChange?.(!checked)}
            className={cn(
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-out',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(44,102,147,0.35)] focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                checked ? 'bg-[var(--app-header-bar-bg)]' : 'bg-slate-200',
                className
            )}
        >
            <span
                aria-hidden
                className={cn(
                    'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-out',
                    checked ? 'translate-x-5' : 'translate-x-0'
                )}
            />
        </button>
    )
}
