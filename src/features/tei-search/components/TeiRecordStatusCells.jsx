import React from 'react'
import i18n from '@dhis2/d2-i18n'
import { cn } from '../../../lib/utils'
import { TEI_LIST } from '../teiListUi'
import {
    enrollmentStatusLabel,
    eventStatusLabel,
    getTeiEnrollmentStatus,
    getTeiLatestVisitStatus,
} from '../helpers'

export function EnrollmentStatusCell({ tei, programId, className }) {
    const status = getTeiEnrollmentStatus(tei, programId)
    const label = enrollmentStatusLabel(status)
    const isCompleted = status === 'COMPLETED'
    const isActive = status === 'ACTIVE'

    return (
        <div className={cn('flex items-center gap-1.5', className)}>
            <div
                className={
                    isCompleted
                        ? TEI_LIST.statusCompleteDot
                        : isActive
                          ? TEI_LIST.statusActiveDot
                          : 'h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300'
                }
                aria-hidden
            />
            <span
                className={
                    isCompleted
                        ? TEI_LIST.statusCompleteText
                        : isActive
                          ? TEI_LIST.statusActiveText
                          : 'text-[13px] font-medium text-slate-500'
                }
            >
                {label}
            </span>
        </div>
    )
}

export function VisitStatusCell({ tei, programId, className }) {
    const { status, hasEvents } = getTeiLatestVisitStatus(tei, programId)
    const label = hasEvents ? eventStatusLabel(status) : i18n.t('No visits')
    const isCompleted = status === 'COMPLETED'

    return (
        <div className={cn('flex items-center gap-1.5', className)}>
            <div
                className={
                    !hasEvents
                        ? 'h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300'
                        : isCompleted
                          ? TEI_LIST.statusCompleteDot
                          : TEI_LIST.statusActiveDot
                }
                aria-hidden
            />
            <span
                className={
                    !hasEvents
                        ? 'text-[13px] font-medium text-slate-400'
                        : isCompleted
                          ? TEI_LIST.statusCompleteText
                          : TEI_LIST.statusActiveText
                }
            >
                {label}
            </span>
        </div>
    )
}
