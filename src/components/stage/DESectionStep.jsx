import React from 'react'
import { Check } from 'lucide-react'
import { formatSectionStepDisplay } from '../../lib/stageSectionProgress'
import { cn, decodeBasicHtmlEntities } from '../../lib/utils'

function stepDotClass(status, { isActive, isPast, visitLocked }) {
    if (visitLocked) {
        return isActive
            ? 'bg-emerald-700 text-white'
            : 'bg-emerald-500 text-white'
    }
    if (status === 'complete' || isPast) {
        return 'bg-emerald-600 text-white'
    }
    if (isActive) {
        return 'bg-stone-800 text-white'
    }
    if (status === 'partial') {
        return 'border-2 border-amber-500 bg-amber-50 text-amber-800'
    }
    if (status === 'locked') {
        return 'border border-slate-200 bg-slate-100 text-slate-400'
    }
    return 'border border-slate-200 bg-white text-slate-600 group-hover:border-slate-300'
}

export function DESectionStep({
    sections = [],
    activeSectionId,
    onSectionSelect,
    visitLocked = false,
    sectionProgress = {},
    className,
}) {
    if (!sections.length) return null

    const activeIndex = Math.max(
        0,
        sections.findIndex((s) => s.id === activeSectionId)
    )

    return (
        <nav
            className={cn(
                'w-full min-w-0',
                visitLocked && 'overflow-hidden rounded-xl border border-emerald-200/90 bg-emerald-100/50',
                className
            )}
            aria-label="Form sections"
        >
            <ol className="flex flex-nowrap items-center gap-1.5 overflow-x-auto p-2 custom-scrollbar">
                {sections.map((section, index) => {
                    const isActive = section.id === activeSectionId
                    const isPast = !visitLocked && index < activeIndex
                    const status = sectionProgress[section.id] || 'empty'
                    const showCompleteStep = visitLocked || status === 'complete' || isPast
                    const step = formatSectionStepDisplay(section.name, index)

                    return (
                        <li key={section.id} className="flex shrink-0 items-stretch">
                            <button
                                type="button"
                                onClick={() => onSectionSelect?.(section.id)}
                                aria-current={isActive ? 'step' : undefined}
                                aria-label={decodeBasicHtmlEntities(section.name) || section.id}
                                title={step.tooltip}
                                className={cn(
                                    'group flex min-h-[44px] max-w-[10rem] items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors sm:max-w-[12rem] sm:px-2.5',
                                    visitLocked
                                        ? isActive
                                            ? 'border border-emerald-400/80 bg-emerald-200/80'
                                            : 'border border-transparent bg-emerald-100/60 hover:border-emerald-200/60 hover:bg-emerald-200/50'
                                        : isActive
                                          ? 'border border-[color:var(--app-border)] bg-stone-100/90'
                                          : 'border border-transparent hover:bg-slate-50'
                                )}
                            >
                                <span
                                    className={cn(
                                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums transition-colors',
                                        stepDotClass(status, { isActive, isPast, visitLocked })
                                    )}
                                    aria-hidden
                                >
                                    {showCompleteStep ? (
                                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                                    ) : (
                                        step.stepNumber
                                    )}
                                </span>
                                <span
                                    className={cn(
                                        'min-w-0 truncate text-xs leading-snug sm:text-sm',
                                        visitLocked
                                            ? isActive
                                                ? 'font-semibold text-emerald-950'
                                                : 'font-medium text-emerald-800'
                                            : isActive
                                              ? 'font-semibold text-slate-900'
                                              : status === 'complete' || isPast
                                                ? 'font-medium text-slate-600'
                                                : 'font-normal text-slate-500 group-hover:text-slate-700'
                                    )}
                                >
                                    {decodeBasicHtmlEntities(step.sideLabel)}
                                </span>
                            </button>
                        </li>
                    )
                })}
            </ol>
        </nav>
    )
}
