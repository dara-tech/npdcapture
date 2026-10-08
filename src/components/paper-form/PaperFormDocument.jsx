import React from 'react'
import { cn } from '../../lib/utils'
import './paperForm.css'

/**
 * Single continuous clinical paper sheet (A4-like).
 */
export function PaperFormDocument({ title, subtitle, className, children }) {
    return (
        <div
            className={cn(
                'paper-doc paper-doc--wide paper-form-ui mx-auto w-full border-0 sm:border border-stone-300/90 bg-white dark:border-zinc-800 dark:bg-black',
                className
            )}
        >
            {title ? (
                <header className="paper-doc-header">
                    <h2 className="paper-doc-title">{title}</h2>
                    {subtitle ? <p className="paper-doc-subtitle">{subtitle}</p> : null}
                </header>
            ) : null}
            <div className="paper-doc-body">{children}</div>
        </div>
    )
}
