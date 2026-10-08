import React from 'react'
import { cn } from '../../lib/utils'

export const Card = ({ className, ...props }) => (
    <section
        className={cn('rounded-[var(--app-radius)] border border-[color:var(--app-border)] app-surface shadow-none dark:border-zinc-800', className)}
        {...props}
    />
)

export const CardHeader = ({ className, ...props }) => (
    <div className={cn('flex flex-col gap-1.5 p-4 pb-0', className)} {...props} />
)

export const CardTitle = ({ className, ...props }) => (
    <h3 className={cn('text-base font-semibold app-text-title', className)} {...props} />
)

export const CardDescription = ({ className, ...props }) => (
    <p className={cn('text-sm app-text-label', className)} {...props} />
)

export const CardContent = ({ className, ...props }) => (
    <div className={cn('p-4 pt-0', className)} {...props} />
)

export const CardFooter = ({ className, ...props }) => (
    <div className={cn('flex items-center p-4 pt-0', className)} {...props} />
)
