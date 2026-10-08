import React from 'react'
import i18n from '@dhis2/d2-i18n'
import { cn } from '../../lib/utils'
import { FORM } from '../../lib/formUi'
import {
    OPTION_CHOICE_CONTEXT,
    optionChoiceContextFromFieldLayout,
    optionChoicePillClass,
    resolveOptionChoiceGroupClass,
} from '../../lib/optionChoiceLayout'
import { booleanOptionDisplayLabel } from '../../lib/paperFormBoolean'

function choiceButtonClasses(context, selected, disabled, extra) {
    const questionnaire = context === OPTION_CHOICE_CONTEXT.QUESTIONNAIRE
    return cn(
        questionnaire ? FORM.paperChoiceButton : FORM.roundedChoiceButton,
        selected &&
            (questionnaire ? FORM.paperChoiceButtonSelected : FORM.roundedChoiceButtonSelected),
        disabled && 'cursor-not-allowed opacity-50',
        extra
    )
}

export const codeOf = (o) => o?.code ?? o?.id

export const valueMatchesOption = (value, opt) => {
    if (!opt) return false
    const v = String(value ?? '').trim()
    if (!v) return false
    if (opt.code != null && String(opt.code) === v) return true
    if (opt.id != null && String(opt.id) === v) return true
    const name = String(opt.displayName || opt.name || '').trim()
    if (name && name === v) return true
    return false
}

function resolveOptionLabel(opt, resolveLabel) {
    if (typeof resolveLabel === 'function') return resolveLabel(opt)
    return (
        booleanOptionDisplayLabel(opt) ||
        opt?.name ||
        opt?.displayName ||
        codeOf(opt)
    )
}

/**
 * Single rounded pill choice — equal height in grid via h-full + items-stretch parent.
 */
export function RoundedChoiceButton({
    id,
    name,
    label,
    selected,
    disabled,
    onSelect,
    onDeselect,
    allowDeselect = false,
    className,
    labelClassName,
    layoutContext,
}) {
    const questionnaire = layoutContext === OPTION_CHOICE_CONTEXT.QUESTIONNAIRE
    return (
        <button
            type="button"
            id={id}
            name={name}
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={(e) => {
                e.stopPropagation()
                if (disabled) return
                if (allowDeselect && selected) {
                    onDeselect?.()
                } else {
                    onSelect?.()
                }
            }}
            className={choiceButtonClasses(layoutContext, selected, disabled, className)}
        >
            <span
                className={cn(
                    questionnaire ? 'whitespace-nowrap' : FORM.roundedChoiceButtonLabel,
                    labelClassName
                )}
            >
                {label}
            </span>
        </button>
    )
}

/**
 * Rounded pill radio group — always CSS grid (no squeezed horizontal flex).
 */
export function RoundedOptionRadioGroup({
    name,
    value,
    options = [],
    onChange,
    disabled = false,
    ariaLabel,
    resolveLabel,
    layoutContext,
    fieldLayout,
    twoColumn = false,
    className,
    allowDeselect = false,
}) {
    if (!options.length) {
        return (
            <span className="text-sm font-normal text-slate-400">{i18n.t('No options available')}</span>
        )
    }

    const groupName = name || 'option-set'
    const labelFor = (opt) => resolveOptionLabel(opt, resolveLabel)
    const context =
        layoutContext ||
        (fieldLayout ? optionChoiceContextFromFieldLayout(fieldLayout) : OPTION_CHOICE_CONTEXT.BODY)
    const medicineGrid = context === OPTION_CHOICE_CONTEXT.MEDICINE_GRID
    const pillLabelClass = medicineGrid ? FORM.roundedChoiceButtonLabelMedicine : undefined

    return (
        <div
            className={cn(
                resolveOptionChoiceGroupClass({
                    count: options.length,
                    layoutContext: context,
                    twoColumn,
                }),
                className
            )}
            role="radiogroup"
            aria-label={ariaLabel}
        >
            {options.map((opt, index) => {
                const code = codeOf(opt)
                const id = `${groupName}-${code ?? '__empty'}`
                return (
                    <RoundedChoiceButton
                        key={id}
                        id={id}
                        name={groupName}
                        label={labelFor(opt)}
                        selected={valueMatchesOption(value, opt)}
                        disabled={disabled}
                        className={cn(
                            optionChoicePillClass(index, options.length, context),
                            medicineGrid && 'min-h-9 shrink-0 px-2 py-1.5 sm:px-2.5'
                        )}
                        labelClassName={pillLabelClass}
                        layoutContext={context}
                        allowDeselect={allowDeselect}
                        onSelect={() => {
                            if (typeof onChange === 'function') onChange(code)
                        }}
                        onDeselect={() => {
                            if (typeof onChange === 'function') onChange('')
                        }}
                    />
                )
            })}
        </div>
    )
}

/**
 * Full-width option grid (profile, registration, stage body fields).
 */
export function OptionSetPillGroup({
    name,
    value,
    options = [],
    onChange,
    disabled = false,
    allowClear = false,
    paperTwoColumn = false,
    className,
    resolveLabel,
    'aria-label': ariaLabel,
}) {
    if (!options.length) {
        return (
            <span className="text-sm font-normal text-slate-400">{i18n.t('No options available')}</span>
        )
    }

    const groupName = name || 'option-set'
    const labelFor = (opt) => resolveOptionLabel(opt, resolveLabel)
    const items = allowClear
        ? [{ code: '', label: i18n.t('Select...'), isEmpty: true }, ...options]
        : options

    return (
        <div
            className={cn(
                resolveOptionChoiceGroupClass({
                    count: items.length,
                    layoutContext: OPTION_CHOICE_CONTEXT.BODY,
                    twoColumn: paperTwoColumn,
                    gap: 'gap-2',
                }),
                className
            )}
            role="radiogroup"
            aria-label={ariaLabel}
        >
            {items.map((opt) => {
                const code = codeOf(opt)
                const id = `${groupName}-${code || '__empty'}`
                const selected = opt.isEmpty
                    ? !value
                    : valueMatchesOption(value, opt)
                return (
                    <RoundedChoiceButton
                        key={id}
                        id={id}
                        name={groupName}
                        label={opt.isEmpty ? opt.label : labelFor(opt)}
                        selected={selected}
                        disabled={disabled}
                        onSelect={() => {
                            if (typeof onChange === 'function') {
                                onChange(opt.isEmpty ? '' : code)
                            }
                        }}
                    />
                )
            })}
        </div>
    )
}
