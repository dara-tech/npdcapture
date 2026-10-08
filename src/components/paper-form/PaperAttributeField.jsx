import React, { useState } from 'react'
import i18n from '@dhis2/d2-i18n'
import { Copy, Check } from 'lucide-react'
import { attributeOptionSetUiVariant } from '../../lib/stageFieldRender'
import { resolvePaperRadioLayout } from '../../lib/paperFormLayout'
import { getInputTypeForValueType } from '../../lib/fieldValidation'
import { attributeIsDatePickerDob, completedYearsFromDobIso } from '../../lib/ageDobFromAge'
import { resolveStageOptionDisplayLabel } from '../../lib/stageFieldLabelI18n'
import {
    coerceBooleanFormDisplay,
    normalizeBooleanFieldValue,
} from '../../lib/paperFormBoolean'
import { DatePicker } from '../ui/date-picker'
import { AgeBirthDateComposite } from '../ui/age-birth-date-composite'
import {
    PaperFormCheckboxList,
    PaperFormRadioGroup,
    PaperFormReadonly,
    PaperFormTextLine,
    PaperFormYesNo,
    PaperFormBooleanCheck,
} from './PaperFormControls'
import { PaperFormFileResource } from './PaperFormFileResource'
import { formatProfileAttributeDisplayValue } from '../../lib/profileAttributeForm'
import { parseMultiOptionValue } from '../../lib/stageFieldRender'
import { codeOf, valueMatchesOption } from '../ui/option-set-pill-group'
import { KhmerVirtualKeyboard } from '../ui/khmer-virtual-keyboard'

function IdentifierBadge({ value }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = (e) => {
        e.stopPropagation()
        if (!value) return
        navigator.clipboard.writeText(String(value).trim())
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    return (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 px-2.5 py-0.5 font-mono text-[12px] font-semibold text-slate-800 dark:text-zinc-100 border border-slate-200/80 dark:border-zinc-700 select-all">
            <span>{value}</span>
            <button
                type="button"
                onClick={handleCopy}
                title={copied ? i18n.t('Copied!') : i18n.t('Copy to clipboard')}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors cursor-pointer p-0.5 rounded hover:bg-slate-200/60 dark:hover:bg-zinc-700"
            >
                {copied ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                ) : (
                    <Copy className="h-3 w-3" />
                )}
            </button>
        </span>
    )
}

export function PaperAttributeField({
    attr,
    value,
    onChange,
    disabled = false,
    readOnly = false,
    mandatory = false,
    hiddenOptionIds,
    hiddenOptionCodes,
    ageDobPair = null,
    isNameField = false,
}) {
    const showReadOnly = readOnly || disabled
    const opts = (attr?.optionSet?.options || []).filter((o) => {
        if (!o) return false
        const id = String(o.id || '')
        const code = String(o.code || '').trim()
        const codeUpper = code.toUpperCase()
        if (hiddenOptionIds?.has?.(id) || hiddenOptionIds?.has?.(code) || hiddenOptionIds?.has?.(codeUpper)) return false
        if (hiddenOptionCodes?.has?.(id) || hiddenOptionCodes?.has?.(code) || hiddenOptionCodes?.has?.(codeUpper)) return false
        return true
    })

    if (attr?.valueType === 'FILE_RESOURCE' || attr?.valueType === 'IMAGE') {
        return (
            <PaperFormFileResource
                value={value}
                onChange={onChange}
                disabled={disabled}
                readOnly={readOnly}
                attr={attr}
                domain="TRACKED_ENTITY_ATTRIBUTE"
            />
        )
    }

    if (ageDobPair && !showReadOnly) {
        return (
            <AgeBirthDateComposite
                ageValue={ageDobPair.ageValue ?? ''}
                dobIso={ageDobPair.dobValue ?? ''}
                disabled={disabled}
                onAgeChange={ageDobPair.onAgeChange}
                onDobChange={ageDobPair.onDobChange}
            />
        )
    }

    if (showReadOnly) {
        if (ageDobPair) {
            let actualAgeValue = ageDobPair.ageValue
            if ((actualAgeValue == null || actualAgeValue === '') && ageDobPair.dobValue) {
                actualAgeValue = completedYearsFromDobIso(ageDobPair.dobValue)
            }
            const ageText = formatProfileAttributeDisplayValue(
                { valueType: 'INTEGER' },
                actualAgeValue
            )
            const dobText = formatProfileAttributeDisplayValue(
                { valueType: 'DATE' },
                ageDobPair.dobValue
            )
            return (
                <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2.5 text-right">
                    {dobText && dobText !== '-' ? (
                        <span className="font-semibold text-slate-800 dark:text-zinc-100">{dobText}</span>
                    ) : null}
                    {ageText && ageText !== '-' ? (
                        <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-700">
                            {i18n.t('Age')}: {ageText}
                        </span>
                    ) : null}
                    {(!dobText || dobText === '-') && (!ageText || ageText === '-') ? (
                        <span className="text-slate-400 font-normal select-none">—</span>
                    ) : null}
                </div>
            )
        }
        const text = formatProfileAttributeDisplayValue(attr, value)
        const variant = attributeOptionSetUiVariant(attr)
        const isMulti = variant === 'VERTICAL_MULTI' || variant === 'HORIZONTAL_MULTI'
        if (isMulti && opts.length) {
            const labels = parseMultiOptionValue(value)
                .map((code) => {
                    const hit = opts.find((o) => valueMatchesOption(code, o))
                    return hit ? resolveStageOptionDisplayLabel(hit) : code
                })
                .filter(Boolean)
            return <PaperFormReadonly>{labels.length ? labels.join('; ') : <span className="text-slate-400 font-normal">—</span>}</PaperFormReadonly>
        }

        if (!text || text === '-' || text === '—') {
            return <PaperFormReadonly><span className="text-slate-400 font-normal select-none">—</span></PaperFormReadonly>
        }

        const attrName = String(attr?.name || '').toLowerCase()
        const isIdentifier =
            attrName.includes('uuic') ||
            attrName.includes('pmrs') ||
            attrName.includes('nssf') ||
            attrName.includes('id poor') ||
            attrName.includes('phone') ||
            attrName.includes('ទូរស័ព្ទ') ||
            attrName.includes('លេខកូដ')

        if (isIdentifier) {
            return (
                <PaperFormReadonly>
                    <IdentifierBadge value={text} />
                </PaperFormReadonly>
            )
        }

        return <PaperFormReadonly>{text}</PaperFormReadonly>
    }

    if (attr.valueType === 'BOOLEAN') {
        return (
            <PaperFormYesNo
                name={`paper-attr-bool-${attr.id}`}
                value={coerceBooleanFormDisplay(value)}
                onChange={(v) =>
                    onChange?.(normalizeBooleanFieldValue(v, { mandatory }))
                }
                disabled={disabled}
                mandatory={mandatory}
            />
        )
    }

    if (attr.valueType === 'TRUE_ONLY') {
        const on = coerceBooleanFormDisplay(value) === 'true'
        return (
            <PaperFormBooleanCheck
                id={`paper-attr-to-${attr.id}`}
                aria-label={attr.name}
                checked={on}
                disabled={disabled}
                onChange={(checked) =>
                    onChange?.(
                        normalizeBooleanFieldValue(checked ? 'true' : '', { trueOnly: true })
                    )
                }
            />
        )
    }

    if (attributeIsDatePickerDob(attr) || attr.valueType === 'DATE') {
        return (
            <DatePicker
                date={value}
                setDate={onChange}
                placeholder="dd/MM/yyyy"
                disabled={disabled}
            />
        )
    }

    if (opts.length > 0) {
        const variant = attributeOptionSetUiVariant(attr)
        const isMulti = variant === 'VERTICAL_MULTI' || variant === 'HORIZONTAL_MULTI'
        if (isMulti) {
            return (
                <PaperFormCheckboxList
                    options={opts}
                    value={value}
                    onChange={onChange}
                    disabled={disabled}
                    layout={resolvePaperRadioLayout(opts, {
                        minTwoColumn: 6,
                        variant: attributeOptionSetUiVariant(attr),
                    })}
                />
            )
        }
        return (
            <PaperFormRadioGroup
                name={`paper-attr-opt-${attr.id}`}
                value={value}
                options={opts}
                onChange={onChange}
                disabled={disabled}
                layout={resolvePaperRadioLayout(opts, {
                    variant: attributeOptionSetUiVariant(attr),
                })}
            />
        )
    }

    const attrName = (attr?.name || attr?.displayName || '').toLowerCase()
    const isPhoneField =
        attr?.valueType === 'PHONE_NUMBER' ||
        attrName.includes('phone') ||
        attrName.includes('mobile') ||
        attrName.includes('ទូរស័ព្ទ') ||
        attrName.includes('លេខទូរស័ព្ទ')

    const handleChange = (val) => {
        if (isNameField) {
            val = val.replace(/[^\u1780-\u17FF\s]/g, '')
        } else if (isPhoneField) {
            val = val.replace(/[^\d+]/g, '')
        }
        onChange?.(val)
    }

    if (isNameField) {
        return (
            <div className="relative w-full">
                <PaperFormTextLine
                    value={value ?? ''}
                    onChange={handleChange}
                    disabled={disabled}
                    type={getInputTypeForValueType(attr.valueType)}
                    className="w-full pr-10"
                />
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-auto">
                    <KhmerVirtualKeyboard 
                        onInsert={(char) => {
                            handleChange((value || '') + char)
                        }}
                        onBackspace={() => {
                            const current = value || ''
                            handleChange(current.slice(0, -1))
                        }}
                    />
                </div>
            </div>
        )
    }

    return (
        <PaperFormTextLine
            value={value ?? ''}
            onChange={handleChange}
            disabled={disabled}
            type={isPhoneField ? 'tel' : getInputTypeForValueType(attr.valueType)}
        />
    )
}

