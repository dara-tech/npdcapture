import React from 'react'
import { QuestionnaireFieldRow } from '../../components/stage/QuestionnaireFieldRow'
import { FORM, captureFieldDomId } from '../../lib/formUi'
import {
    isPaperInlineTextField,
    stageFieldNeedsWideInlineControl,
} from '../../lib/stageFieldLayout'
import { booleanUiVariant } from '../../lib/stageFieldRender'
import { cn } from '../../lib/utils'

function isPaperOptionPillField(de) {
    return stageFieldNeedsWideInlineControl(de)
}

/**
 * One program-stage data element row.
 * Default: label on top, control below.
 * inline-row: label left, control right (paper symptom grid).
 */
export function StageFieldRow({
    de,
    mandatoryFieldIds,
    isInvalid,
    isWide,
    rowClassName,
    rowInnerClassName,
    layout = 'default',
    active = false,
    displayLabel,
    prefixBadge,
    questionNo,
    hideLabel = false,
    children,
}) {
    const label = displayLabel ?? de.name
    const questionPrefix = questionNo ? (
        <span className={FORM.paperFormQuestionNo} aria-hidden>
            {questionNo}
        </span>
    ) : null
    const rowPrefix = questionPrefix || (prefixBadge ? (
        <span className={FORM.khmerInlinePrefix} aria-hidden>
            {prefixBadge}
        </span>
    ) : null)
    const isMedicineGridRow = rowInnerClassName === FORM.medicineGridFieldRowInner
    const isToggleRow = layout === 'toggle-row'
    const isTogglePanel = layout === 'toggle-panel'
    const isPillBelowTitle = layout === 'pill-below-title'
    const isQuestionnaireRow = layout === 'questionnaire-row'
    const isInlineRow = layout === 'inline-row'
    const isPartnerSmhSearch = layout === 'partner-smh-search'

    if (isQuestionnaireRow) {
        return (
            <QuestionnaireFieldRow
                de={de}
                questionNo={questionNo}
                displayLabel={label}
                mandatoryFieldIds={mandatoryFieldIds}
                isInvalid={isInvalid}
            >
                {children}
            </QuestionnaireFieldRow>
        )
    }

    if (isPartnerSmhSearch) {
        return (
            <div
                id={captureFieldDomId('de', de.id)}
                aria-invalid={isInvalid}
                className={cn(
                    rowClassName,
                    FORM.partnerSmhSearchRow,
                    isInvalid && FORM.fieldRowInvalid,
                    isInvalid && 'scroll-mt-28'
                )}
            >
                <span className={FORM.partnerSmhSearchLabel}>
                    {label}
                    {de.compulsory || mandatoryFieldIds?.has?.(de.id) ? (
                        <span className={cn(FORM.fieldRequiredMark, 'ml-0.5')} aria-hidden>
                            *
                        </span>
                    ) : null}
                </span>
                <div className={FORM.partnerSmhSearchControl}>{children}</div>
            </div>
        )
    }

    if (isPillBelowTitle) {
        return (
            <div
                id={captureFieldDomId('de', de.id)}
                aria-invalid={isInvalid}
                className={cn(
                    rowClassName,
                    FORM.pillBelowTitleRow,
                    isInvalid && FORM.fieldRowInvalid,
                    isInvalid && 'scroll-mt-28'
                )}
            >
                <div className={FORM.pillBelowTitleInner}>
                    <div className={FORM.pillBelowTitleLabelRow}>
                        {rowPrefix}
                        <span className={cn(FORM.fieldLabel, 'min-w-0 flex-1')}>
                            {label}
                            {de.compulsory || mandatoryFieldIds?.has?.(de.id) ? (
                                <span className={cn(FORM.fieldRequiredMark, 'ml-0.5')} aria-hidden>
                                    *
                                </span>
                            ) : null}
                        </span>
                    </div>
                    <div className={FORM.pillBelowTitleControl}>{children}</div>
                </div>
            </div>
        )
    }

    if (isToggleRow) {
        const checkboxId = `de-cb-${de.id}`
        const useOptionRadios = false
        const toggleInnerClass = useOptionRadios
            ? FORM.toggleFieldRowInnerOptions
            : FORM.toggleFieldRowInner
        const toggleControlClass = useOptionRadios
            ? FORM.toggleFieldOptionControl
            : FORM.toggleFieldCheckboxCol
        const toggleRowClass = cn(
            rowClassName,
            FORM.toggleFieldRow,
            active && FORM.toggleFieldRowActive,
            isInvalid && FORM.fieldRowInvalid,
            isInvalid && 'scroll-mt-28'
        )
        const toggleRowBody = (
            <span className={toggleInnerClass}>
                <span className="flex min-w-0 items-start gap-2 self-start">
                    {rowPrefix}
                    <span className={FORM.toggleFieldLabel}>
                        {label}
                        {de.compulsory || mandatoryFieldIds?.has?.(de.id) ? (
                            <span className={cn(FORM.fieldRequiredMark, 'ml-0.5')} aria-hidden>
                                *
                            </span>
                        ) : null}
                    </span>
                </span>
                <span className={cn(toggleControlClass, useOptionRadios && 'self-stretch')}>
                    {children}
                </span>
            </span>
        )
        if (useOptionRadios) {
            return (
                <div
                    id={captureFieldDomId('de', de.id)}
                    aria-invalid={isInvalid}
                    className={toggleRowClass}
                >
                    {toggleRowBody}
                </div>
            )
        }
        return (
            <label
                id={captureFieldDomId('de', de.id)}
                htmlFor={checkboxId}
                aria-invalid={isInvalid}
                className={toggleRowClass}
            >
                {toggleRowBody}
            </label>
        )
    }

    if (isInlineRow) {
        const boolRadio =
            (de.valueType === 'BOOLEAN' || de.valueType === 'TRUE_ONLY') &&
            (booleanUiVariant(de) === 'VERTICAL_RADIO' ||
                booleanUiVariant(de) === 'HORIZONTAL_RADIO')
        const isInlinePaperCheckbox =
            (de.valueType === 'BOOLEAN' || de.valueType === 'TRUE_ONLY') &&
            !boolRadio &&
            !stageFieldNeedsWideInlineControl(de)
        const isInlinePaperText = isPaperInlineTextField(de)
        const useOptionPills = isPaperOptionPillField(de)
        const useWideInline =
            de.valueType === 'DATE' || boolRadio || stageFieldNeedsWideInlineControl(de)
        const inlineInnerClass =
            useWideInline
                ? FORM.fieldRowInlineInnerWideControl
                : useOptionPills
                  ? FORM.fieldRowInlineInnerOptions
                  : isInlinePaperText
                    ? FORM.fieldRowInlineInnerText
                    : FORM.fieldRowInlineInner
        const controlClass =
            de.valueType === 'DATE'
                ? FORM.fieldRowInlineDateControl
                : useOptionPills
                  ? FORM.fieldRowInlineOptionControl
                  : isInlinePaperCheckbox
                    ? FORM.toggleFieldCheckboxCol
                    : useWideInline
                      ? FORM.fieldRowInlineOptionControl
                      : isInlinePaperText
                        ? FORM.fieldRowInlineTextControl
                        : FORM.fieldRowInlineControl

        return (
            <div
                id={captureFieldDomId('de', de.id)}
                aria-invalid={isInvalid}
                className={cn(
                    rowClassName,
                    FORM.inlineFieldRow,
                    isInvalid && FORM.fieldRowInvalid,
                    isInvalid && 'scroll-mt-28'
                )}
            >
                <div className={inlineInnerClass}>
                    <span className="flex min-w-0 items-start gap-2 self-start">
                        {rowPrefix}
                        <span className={FORM.toggleFieldLabel}>
                            {label}
                            {de.compulsory || mandatoryFieldIds?.has?.(de.id) ? (
                                <span className={cn(FORM.fieldRequiredMark, 'ml-0.5')} aria-hidden>
                                    *
                                </span>
                            ) : null}
                        </span>
                    </span>
                    <div className={cn(controlClass, useOptionPills && 'self-stretch')}>{children}</div>
                </div>
            </div>
        )
    }

    if (isTogglePanel) {
        return (
            <div
                id={captureFieldDomId('de', de.id)}
                aria-invalid={isInvalid}
                className={cn(
                    FORM.symptomFullWidthCell,
                    'overflow-hidden',
                    isInvalid && FORM.fieldRowInvalid,
                    isInvalid && 'scroll-mt-28'
                )}
            >
                {label ? (
                    <div
                        className={cn(
                            FORM.profileSectionHeaderBar,
                            'border-b border-[color:var(--app-border)] py-1.5'
                        )}
                    >
                        <span className={FORM.fieldLabel}>
                            {label}
                            {de.compulsory || mandatoryFieldIds?.has?.(de.id) ? (
                                <span className={cn(FORM.fieldRequiredMark, 'ml-0.5')} aria-hidden>
                                    *
                                </span>
                            ) : null}
                        </span>
                    </div>
                ) : null}
                <div className="w-full px-2.5 py-1.5 sm:px-3">{children}</div>
            </div>
        )
    }

    return (
        <div
            id={captureFieldDomId('de', de.id)}
            aria-invalid={isInvalid}
            aria-label={hideLabel ? label : undefined}
            className={cn(
                rowClassName,
                isInvalid && FORM.fieldRowInvalid,
                isInvalid && 'scroll-mt-28',
                hideLabel && 'flex min-h-10 items-center justify-center py-1'
            )}
        >
            {hideLabel ? (
                <div className="flex w-full items-center justify-center">{children}</div>
            ) : (
                <div className={rowInnerClassName || FORM.fieldRowInner}>
                    <div className="flex min-w-0 items-start gap-2">
                        {rowPrefix}
                        <span
                            className={cn(
                                isMedicineGridRow ? FORM.medicineGridFieldLabel : FORM.fieldLabel,
                                'min-w-0 flex-1'
                            )}
                        >
                            {label}
                            {de.compulsory || mandatoryFieldIds?.has?.(de.id) ? (
                                <span className={cn(FORM.fieldRequiredMark, 'ml-0.5')} aria-hidden>
                                    *
                                </span>
                            ) : null}
                        </span>
                    </div>
                    <div className="w-full min-w-0">{children}</div>
                </div>
            )}
        </div>
    )
}
