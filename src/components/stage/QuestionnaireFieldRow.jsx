import React from 'react'
import { FORM, captureFieldDomId } from '../../lib/formUi'
import { cn } from '../../lib/utils'

/**
 * One numbered screening question: label block + answer options below (paper form).
 */
export function QuestionnaireFieldRow({
    de,
    questionNo,
    displayLabel,
    mandatoryFieldIds,
    isInvalid,
    children,
}) {
    const label = displayLabel ?? de.name

    return (
        <div
            id={captureFieldDomId('de', de.id)}
            aria-invalid={isInvalid}
            className={cn(FORM.paperQuestionRow, isInvalid && FORM.fieldRowInvalid, isInvalid && 'scroll-mt-28')}
        >
            {questionNo ? (
                <span className={FORM.paperFormQuestionNo} aria-hidden>
                    {questionNo}
                </span>
            ) : (
                <span className="w-5 shrink-0" aria-hidden />
            )}
            <div className={FORM.paperQuestionBody}>
                <p className={FORM.paperQuestionLabel}>
                    {label}
                    {de.compulsory || mandatoryFieldIds?.has?.(de.id) ? (
                        <span className={cn(FORM.fieldRequiredMark, 'ml-0.5')} aria-hidden>
                            *
                        </span>
                    ) : null}
                </p>
                <div className={FORM.paperQuestionOptions}>{children}</div>
            </div>
        </div>
    )
}
