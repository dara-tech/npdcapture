import React from 'react'
import { captureFieldDomId } from '../../lib/formUi'
import { cn } from '../../lib/utils'

/**
 * Paper row: stack (question above answers) or table (# | question | answer).
 */
function PaperFormQuestionLabel({ title, subtitle, required, isResult }) {
    return (
        <>
            <p className={cn(isResult && 'paper-result-label', !isResult && 'paper-question-text')}>
                {title}
                {required ? (
                    <span className="ml-0.5 font-bold text-red-600" aria-hidden>
                        *
                    </span>
                ) : null}
            </p>
            {subtitle ? <p className="paper-question-sub">{subtitle}</p> : null}
        </>
    )
}

export function PaperFormQuestion({
    de,
    fieldScope = 'de',
    number,
    title,
    subtitle,
    required,
    invalid,
    children,
    indentAnswers,
    isResult,
    layout = 'stack',
}) {
    const fieldId = de?.id
    const domId = fieldId ? captureFieldDomId(fieldScope, fieldId) : undefined
    const numText =
        number != null && number !== '' ? `${number}.` : isResult ? '—' : null

    if (layout === 'table') {
        return (
            <tr
                id={domId}
                aria-invalid={invalid}
                className={cn(
                    'paper-table-row',
                    !numText && 'paper-table-row--no-num',
                    invalid && 'paper-question-invalid',
                    isResult && 'paper-table-row--result'
                )}
            >
                {numText ? (
                    <th scope="row" className="paper-table-num">
                        {numText}
                    </th>
                ) : null}
                <td className="paper-table-label" colSpan={numText ? 1 : 2}>
                    <PaperFormQuestionLabel
                        title={title}
                        subtitle={subtitle}
                        required={required}
                        isResult={isResult}
                    />
                </td>
                <td className="paper-table-answer">
                    {children ? (
                        <div
                            className={cn(
                                'paper-table-answer-inner',
                                indentAnswers && 'paper-answers-indented'
                            )}
                        >
                            {children}
                        </div>
                    ) : null}
                </td>
            </tr>
        )
    }

    return (
        <div
            id={domId}
            aria-invalid={invalid}
            className={cn(
                'paper-question',
                invalid && 'paper-question-invalid',
                isResult && 'paper-result-box'
            )}
        >
            <div className="paper-question-head">
                <span className="paper-question-num">{numText}</span>
                <div className="min-w-0 flex-1">
                    <PaperFormQuestionLabel
                        title={title}
                        subtitle={subtitle}
                        required={required}
                        isResult={isResult}
                    />
                </div>
            </div>
            {children ? (
                <div className={cn('paper-answers', indentAnswers && 'paper-answers-indented')}>
                    {children}
                </div>
            ) : null}
        </div>
    )
}
