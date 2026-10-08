import React from 'react'
import i18n from '@dhis2/d2-i18n'
import { cn } from '../../lib/utils'
import { resolveStageOptionDisplayLabel } from '../../lib/stageFieldLabelI18n'
import { parseMultiOptionValue, joinMultiOptionValue } from '../../lib/stageFieldRender'
import { coerceBooleanFormDisplay } from '../../lib/paperFormBoolean'
import { codeOf, valueMatchesOption } from '../ui/option-set-pill-group'

function PaperMark({ kind, checked, color }) {
    return (
        <span
            className={cn(
                'paper-mark',
                kind === 'radio' ? 'paper-mark-radio' : 'paper-mark-check',
                checked && 'paper-mark-on',
                color === 'green' && 'paper-mark-green',
                color === 'red' && 'paper-mark-red'
            )}
            aria-hidden
        >
            {checked && kind === 'check' ? (
                <svg
                    className="h-3 w-3 fill-current text-white"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                >
                    <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                    />
                </svg>
            ) : null}
        </span>
    )
}

function PaperOption({ id, name, kind, checked, disabled, label, code, onSelect, onToggleOff, 'aria-label': ariaLabel, isYesBool, isNoBool }) {
    const a11y = ariaLabel || label || undefined
    // Color semantic marks ONLY for explicit boolean true/false codes — NOT for option sets
    const color = isYesBool ? 'green' : isNoBool ? 'red' : undefined

    return (
        <label 
            className={cn(
                'paper-option',
                checked && 'paper-option-selected',
                isYesBool && 'paper-option-yes',
                isNoBool && 'paper-option-no',
                disabled && 'paper-option-disabled'
            )} 
            htmlFor={id}
            onMouseDown={(e) => {
                // Prevent focus on click to avoid browser auto-scroll. 
                // Keyboard tab focus will still work and scroll normally.
                e.preventDefault()
            }}
            onClick={(e) => {
                if (disabled) return
                if (kind === 'radio' && checked) {
                    e.preventDefault()
                    onToggleOff?.()
                }
            }}
        >
            <input
                type={kind === 'radio' ? 'radio' : 'checkbox'}
                id={id}
                name={name}
                checked={checked}
                disabled={disabled}
                aria-label={a11y}
                onChange={() => onSelect?.()}
            />
            <PaperMark kind={kind} checked={checked} color={color} />
            {label ? <span className="paper-option-label" title={label}>{label}</span> : null}
        </label>
    )
}

/** Single-select: ○ options (vertical stack or horizontal row). */
export function PaperFormRadioGroup({
    name,
    value,
    options = [],
    onChange,
    disabled = false,
    layout = 'stack',
    allowEmpty = false,
}) {
    const items = allowEmpty
        ? [{ code: '', label: i18n.t('—'), isEmpty: true }, ...options]
        : options

    const layoutClass =
        layout === 'inline'
            ? 'paper-answers-inline'
            : layout === 'four-column'
              ? 'paper-answers-four-col'
              : layout === 'two-column'
                ? 'paper-answers-two-col'
                : 'paper-answers-stack'

    const body = (
        <div className={layoutClass}>
            {items.map((opt) => {
                const code = codeOf(opt)
                const id = `${name}-${code ?? 'empty'}`
                const label = opt.isEmpty ? opt.label : resolveStageOptionDisplayLabel(opt)
                const selected = opt.isEmpty
                    ? !value || String(value).trim() === ''
                    : Boolean(value) && valueMatchesOption(value, opt)
                // Only apply boolean semantics if this is an actual true/false boolean field
                const isBoolTrue = code === 'true'
                const isBoolFalse = code === 'false'
                return (
                    <PaperOption
                        key={id}
                        id={id}
                        name={name}
                        kind="radio"
                        checked={selected}
                        disabled={disabled}
                        label={label}
                        code={code}
                        isYesBool={isBoolTrue}
                        isNoBool={isBoolFalse}
                        onSelect={() => onChange?.(opt.isEmpty ? '' : code)}
                        onToggleOff={() => onChange?.('')}
                    />
                )
            })}
        </div>
    )
    return body
}

/** Multi-select: □ checklist (vertical or two columns). */
export function PaperFormCheckboxList({
    options = [],
    value,
    onChange,
    disabled = false,
    layout = 'stack',
}) {
    const selected = parseMultiOptionValue(value)
    const isOn = (opt) =>
        selected.some((v) => valueMatchesOption(v, opt) || String(v) === String(codeOf(opt)))

    const toggle = (opt) => {
        if (disabled) return
        const code = String(codeOf(opt))
        const next = new Set(selected.map(String))
        if (next.has(code)) next.delete(code)
        else next.add(code)
        onChange(joinMultiOptionValue([...next]))
    }

    const layoutClass =
        layout === 'inline'
            ? 'paper-answers-inline paper-answers-indented'
            : layout === 'four-column'
              ? 'paper-answers-four-col paper-answers-indented'
              : layout === 'two-column'
                ? 'paper-answers-two-col paper-answers-indented'
                : 'paper-answers-stack paper-answers-indented'

    return (
        <div className={layoutClass}>
            {options.map((opt) => {
                const code = codeOf(opt)
                const id = `paper-cb-${code}`
                const checked = isOn(opt)
                return (
                    <PaperOption
                        key={id}
                        id={id}
                        kind="check"
                        checked={checked}
                        disabled={disabled}
                        label={resolveStageOptionDisplayLabel(opt)}
                        code={code}
                        onSelect={() => toggle(opt)}
                    />
                )
            })}
        </div>
    )
}

/** Apple Segmented Dual-Pill for Yes / No (ទេ No vs បាទ/ចាស Yes) with tactile micro-springs and semantic glows */
export function PaperFormYesNo({ name, value, onChange, disabled, mandatory }) {
    const current = coerceBooleanFormDisplay(value)
    const isYes = current === 'true'
    const isNo = current === 'false'

    const handleSelect = (next) => {
        if (disabled) return
        if (current === next) {
            // Deselect support: toggles off if not mandatory
            onChange?.(mandatory ? next : '')
        } else {
            onChange?.(next)
        }
    }

    return (
        <div 
            className="apple-segmented-dual-pill" 
            role="radiogroup" 
            aria-label={name}
        >
            <button
                type="button"
                role="radio"
                aria-checked={isNo}
                disabled={disabled}
                onClick={() => handleSelect('false')}
                className={cn(
                    'apple-dual-pill-item apple-dual-pill-no',
                    isNo && 'apple-dual-pill-active'
                )}
            >
                <span className={cn('apple-pill-dot', isNo ? 'apple-pill-dot-active' : '')} />
                <span>{i18n.t('No')}</span>
            </button>
            <button
                type="button"
                role="radio"
                aria-checked={isYes}
                disabled={disabled}
                onClick={() => handleSelect('true')}
                className={cn(
                    'apple-dual-pill-item apple-dual-pill-yes',
                    isYes && 'apple-dual-pill-active'
                )}
            >
                <span className={cn('apple-pill-dot', isYes ? 'apple-pill-dot-active' : '')} />
                <span>{i18n.t('Yes')}</span>
            </button>
        </div>
    )
}

export function PaperFormTextLine({ value, onChange, disabled, type = 'text', className }) {
    return (
        <input
            type={type}
            value={value ?? ''}
            disabled={disabled}
            onChange={(e) => onChange?.(e.target.value)}
            className={cn('paper-line-field', className)}
        />
    )
}

export function PaperFormReadonly({ children }) {
    return <div className="paper-readonly">{children || '—'}</div>
}

/** Single □ line (Q5/Q7 checklist items). */
export function PaperFormBooleanCheck({ id, label, checked, disabled, onChange, 'aria-label': ariaLabel }) {
    return (
        <PaperOption
            id={id}
            kind="check"
            checked={checked}
            disabled={disabled}
            label={label}
            aria-label={ariaLabel}
            onSelect={() => onChange?.(!checked)}
        />
    )
}
