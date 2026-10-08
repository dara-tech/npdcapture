import React from 'react'
import { cn } from '../../lib/utils'

export const Input = React.forwardRef(({ className, rightElement, ...props }, ref) => {
    const input = (
        <input
            ref={ref}
            className={cn(
                'capture-font flex h-8 min-h-8 w-full rounded-md border border-[color:var(--app-border)] bg-white px-2 py-1 text-[13px] font-normal app-text-title placeholder:app-text-meta focus:border-[var(--app-header-bar-bg)] focus:ring-1 focus:ring-[rgba(44,102,147,0.2)] focus:outline-none transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-black dark:focus:bg-black',
                rightElement && 'pr-9',
                className
            )}
            {...props}
        />
    )

    if (!rightElement) return input

    return (
        <div className="relative w-full">
            {input}
            <div className="absolute right-0 top-0 flex h-full items-center justify-center pr-1">
                {rightElement}
            </div>
        </div>
    )
})
Input.displayName = 'Input'
