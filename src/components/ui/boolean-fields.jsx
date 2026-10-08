import i18n from '@dhis2/d2-i18n'
import { cn } from '../../lib/utils'
import { FORM } from '../../lib/formUi'
import { PaperCheckbox } from './PaperCheckbox'
import { Switch } from './switch'

const checkboxClass =
    'h-4 w-4 shrink-0 rounded border-slate-300 accent-[var(--app-header-bar-bg)] focus:outline-none focus:ring-2 focus:ring-[rgba(44,102,147,0.28)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

const shellClass = FORM.controlChoiceShell

/**
 * DHIS2 BOOLEAN: checkboxes instead of a Yes/No dropdown.
 * Mandatory: one “Yes” checkbox (unchecked = false). Optional: separate Yes / No (both off = empty).
 */
export function BooleanCheckboxField({ value, onChange, mandatory, disabled }) {
    const isTrue = String(value).toLowerCase() === 'true' || value === true
    const isFalse = String(value).toLowerCase() === 'false' || value === false

    if (mandatory) {
        return (
            <label
                className={cn(
                    'inline-flex min-h-9 w-fit max-w-md cursor-pointer items-center gap-2.5',
                    disabled && 'cursor-not-allowed opacity-60'
                )}
            >
                <input
                    type="checkbox"
                    disabled={disabled}
                    className={checkboxClass}
                    checked={isTrue}
                    onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
                />
                <span className="text-sm font-normal text-slate-700">{i18n.t('Yes')}</span>
            </label>
        )
    }

    return (
        <div className={cn('inline-flex min-h-9 w-fit max-w-lg flex-wrap items-center gap-4', shellClass, disabled && 'opacity-60')}>
            <label className={cn('inline-flex items-center gap-2', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
                <input
                    type="checkbox"
                    disabled={disabled}
                    className={checkboxClass}
                    checked={isTrue}
                    onChange={(e) => {
                        onChange(e.target.checked ? 'true' : '')
                    }}
                />
                <span className="text-sm font-normal text-slate-700">{i18n.t('Yes')}</span>
            </label>
            <label className={cn('inline-flex items-center gap-2', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
                <input
                    type="checkbox"
                    disabled={disabled}
                    className={checkboxClass}
                    checked={isFalse}
                    onChange={(e) => {
                        onChange(e.target.checked ? 'false' : '')
                    }}
                />
                <span className="text-sm font-normal text-slate-700">{i18n.t('No')}</span>
            </label>
        </div>
    )
}

/** Section header gate: calm clinical check + បាទ/ចាស label. */
export function HeaderGateYesField({ value, onChange, disabled, mandatory = true }) {
    const isTrue = String(value).toLowerCase() === 'true' || value === true
    return (
        <label
            className={cn(
                FORM.sectionHeaderGateYesPill,
                isTrue && FORM.sectionHeaderGateYesPillChecked,
                disabled && 'cursor-not-allowed opacity-60'
            )}
            onClick={(e) => e.stopPropagation()}
        >
            <PaperCheckbox
                disabled={disabled}
                checked={isTrue}
                onCheckedChange={(on) => {
                    if (disabled) return
                    onChange(mandatory ? (on ? 'true' : 'false') : on ? 'true' : '')
                }}
            />
            <span className={FORM.gateHeaderYesLabel}>{i18n.t('Yes')}</span>
        </label>
    )
}

/** DHIS2 TRUE_ONLY: single “Yes” checkbox. */
export function TrueOnlyCheckboxField({ value, onChange, disabled }) {
    const isTrue = String(value).toLowerCase() === 'true' || value === true
    return (
        <label
            className={cn(
                'inline-flex min-h-9 w-fit max-w-md cursor-pointer items-center gap-2.5',
                disabled && 'cursor-not-allowed opacity-60'
            )}
        >
            <input
                type="checkbox"
                disabled={disabled}
                className={checkboxClass}
                checked={isTrue}
                onChange={(e) => onChange(e.target.checked ? 'true' : '')}
            />
            <span className="text-sm font-normal text-slate-700">{i18n.t('Yes')}</span>
        </label>
    )
}

/** TRUE_ONLY as a single switch (symptom row: label is outside, switch on the right). */
export function TrueOnlySwitchField({ value, onChange, disabled, id, 'aria-label': ariaLabel }) {
    const isTrue = String(value).toLowerCase() === 'true' || value === true
    return (
        <Switch
            id={id}
            checked={isTrue}
            disabled={disabled}
            aria-label={ariaLabel || i18n.t('Yes')}
            onCheckedChange={(next) => onChange(next ? 'true' : '')}
        />
    )
}

/** BOOLEAN as one switch: on = Yes; off = No (mandatory) or blank (optional). */
export function BooleanSwitchField({ value, onChange, mandatory, disabled, id, 'aria-label': ariaLabel }) {
    const isTrue = String(value).toLowerCase() === 'true' || value === true
    return (
        <Switch
            id={id}
            checked={isTrue}
            disabled={disabled}
            aria-label={ariaLabel || i18n.t('Yes')}
            onCheckedChange={(next) => onChange(mandatory ? (next ? 'true' : 'false') : next ? 'true' : '')}
        />
    )
}
