import React from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const alertVariants = cva('rounded-md border px-3 py-2 text-sm', {
    variants: {
        variant: {
            default: 'border-slate-200 bg-slate-50 text-slate-900',
            destructive: 'border-red-300 bg-red-50 text-red-900',
        },
    },
    defaultVariants: {
        variant: 'default',
    },
})

export const Alert = ({ className, variant, title, children }) => (
    <div className={cn(alertVariants({ variant }), className)}>
        {title ? <div className="mb-1 font-semibold leading-none tracking-tight">{title}</div> : null}
        <div className="text-sm leading-relaxed">{children}</div>
    </div>
)
