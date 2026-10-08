import React from 'react'
import { MagnifyingGlassIcon } from '@radix-ui/react-icons'
import { TEI_LIST } from '../teiListUi'

export function TeiListEmptyState({ title, children, icon: Icon = MagnifyingGlassIcon }) {
    return (
        <div className="flex flex-col items-center justify-center p-12 text-center md:p-20">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl border border-slate-200/90 bg-slate-50 text-slate-300 dark:border-slate-700 dark:bg-zinc-900 dark:text-slate-500">
                <Icon className="h-8 w-8" />
            </div>
            <h3 className={TEI_LIST.emptyTitle}>{title}</h3>
            {children ? <div className={TEI_LIST.emptyBody}>{children}</div> : null}
        </div>
    )
}
