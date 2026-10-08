import React from 'react'
import i18n from '@dhis2/d2-i18n'
import { booleanUiVariant, stageOptionSetUiVariant } from '../../lib/stageFieldRender'
import { resolvePaperRadioLayout } from '../../lib/paperFormLayout'
import { formatEventDataValueForDisplay } from '../../lib/eventDataValues'
import { getInputTypeForValueType } from '../../lib/fieldValidation'
import { resolveStageOptionDisplayLabel } from '../../lib/stageFieldLabelI18n'
import {
    coerceBooleanFormDisplay,
    isBooleanYesNoOptionSet,
    normalizeBooleanFieldValue,
} from '../../lib/paperFormBoolean'
import { DatePicker } from '../ui/date-picker'
import { PartnerSmhCodeSearchField } from '../stage/PartnerSmhCodeSearchField'
import { isPartnerSmhCodeStageField } from '../../lib/partnerSmhField'
import {
    PaperFormCheckboxList,
    PaperFormRadioGroup,
    PaperFormReadonly,
    PaperFormTextLine,
    PaperFormYesNo,
    PaperFormBooleanCheck,
} from './PaperFormControls'
import { PaperFormFileResource } from './PaperFormFileResource'
import { codeOf, valueMatchesOption } from '../ui/option-set-pill-group'
import { KhmerVirtualKeyboard } from '../ui/khmer-virtual-keyboard'

const RISK_RESULT_DE = 'MBizmGFOeZg'

function readOnlyText(raw, de) {
    const text = formatEventDataValueForDisplay(raw, de)
    return text || <span className="text-slate-400 font-normal select-none">—</span>
}

function filterVisibleOptions(de, hiddenOptionIds, hiddenOptionCodes) {
    return (de?.optionSet?.options || []).filter((o) => {
        if (!o) return false
        const id = String(o.id || '')
        const code = String(o.code || '').trim()
        const codeUpper = code.toUpperCase()
        if (hiddenOptionIds?.has?.(id) || hiddenOptionIds?.has?.(code) || hiddenOptionIds?.has?.(codeUpper)) return false
        if (hiddenOptionCodes?.has?.(id) || hiddenOptionCodes?.has?.(code) || hiddenOptionCodes?.has?.(codeUpper)) return false
        return true
    })
}

/**
 * Renders one DE control in true paper style (○ □ underline).
 */
export function isAppointmentDateField(de) {
    if (!de) return false
    const str = `${de.name || ''} ${de.displayName || ''} ${de.shortName || ''} ${de.formName || ''}`.toLowerCase()
    return (
        str.includes('appointment') ||
        str.includes('follow-up') ||
        str.includes('followup') ||
        str.includes('follow up') ||
        str.includes('មកពិនិត្យតាមដាន') ||
        str.includes('ណាត់') ||
        str.includes('តាមដាន')
    )
}

export function PaperFormField({
    de,
    value,
    onChange,
    disabled = false,
    readOnly = false,
    mandatory = false,
    hiddenOptionIds,
    hiddenOptionCodes,
    partnerSmhProps = null,
    eventDate = null,
    eventId = null,
}) {
    if (!de?.id) return null

    const showReadOnly = readOnly || disabled
    const opts = filterVisibleOptions(de, hiddenOptionIds, hiddenOptionCodes)
    const emitBoolean = (v) => onChange?.(normalizeBooleanFieldValue(v, { mandatory }))
    const emitValue = (v) => {
        if (de.valueType === 'BOOLEAN') {
            onChange?.(normalizeBooleanFieldValue(v, { mandatory }))
            return
        }
        onChange?.(v)
    }

    if (de.valueType === 'FILE_RESOURCE' || de.valueType === 'IMAGE') {
        return (
            <PaperFormFileResource
                value={value}
                onChange={onChange}
                disabled={disabled}
                readOnly={readOnly}
                de={de}
                eventId={eventId}
                domain="DATA_VALUE"
            />
        )
    }

    if (isPartnerSmhCodeStageField(de) && partnerSmhProps && !showReadOnly) {
        return (
            <PartnerSmhCodeSearchField
                value={value}
                onChange={onChange}
                disabled={disabled}
                {...partnerSmhProps}
            />
        )
    }

    if (showReadOnly) {
        if (de.valueType === 'BOOLEAN' || de.valueType === 'TRUE_ONLY') {
            const on = coerceBooleanFormDisplay(value) === 'true'
            const off = coerceBooleanFormDisplay(value) === 'false'
            if (on) return <PaperFormReadonly>{i18n.t('Yes')}</PaperFormReadonly>
            if (off) return <PaperFormReadonly>{i18n.t('No')}</PaperFormReadonly>
            return <PaperFormReadonly />
        }
        if (opts.length) {
            const hit = opts.find((o) => valueMatchesOption(value, o))
            return (
                <PaperFormReadonly>
                    {hit
                        ? resolveStageOptionDisplayLabel(hit)
                        : readOnlyText(value, de)}
                </PaperFormReadonly>
            )
        }
        return <PaperFormReadonly>{readOnlyText(value, de)}</PaperFormReadonly>
    }

    if (de.valueType === 'TRUE_ONLY') {
        const on = coerceBooleanFormDisplay(value) === 'true'
        return (
            <PaperFormBooleanCheck
                id={`paper-to-${de.id}`}
                aria-label={de.displayName || de.name}
                checked={on}
                disabled={disabled}
                onChange={(checked) =>
                    onChange?.(normalizeBooleanFieldValue(checked ? 'true' : '', { trueOnly: true }))
                }
            />
        )
    }

    if (de.valueType === 'BOOLEAN') {
        const boolDisplay = coerceBooleanFormDisplay(value)

        if (opts.length >= 2 && !isBooleanYesNoOptionSet(opts)) {
            return (
                <PaperFormRadioGroup
                    name={`paper-bool-opt-${de.id}`}
                    value={coerceBooleanFormDisplay(value)}
                    options={opts}
                    onChange={emitValue}
                    disabled={disabled}
                    layout={resolvePaperRadioLayout(opts, {
                        variant: booleanUiVariant(de),
                    })}
                />
            )
        }

        /* Capture default: ○ ទេ  ○ បាទ/ចាស (incl. DHIS2 true/false option sets). */
        return (
            <PaperFormYesNo
                name={`paper-bool-${de.id}`}
                value={boolDisplay}
                onChange={emitBoolean}
                disabled={disabled}
                mandatory={mandatory}
            />
        )
    }

    if (de.valueType === 'DATE') {
        const isAppt = isAppointmentDateField(de)
        return (
            <DatePicker
                date={value}
                setDate={onChange}
                placeholder="dd/MM/yyyy"
                disabled={disabled}
                minDate={isAppt ? eventDate : null}
                disableFuture={!isAppt}
            />
        )
    }

    if (opts.length > 0) {
        const variant = stageOptionSetUiVariant(de)
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
                        variant: stageOptionSetUiVariant(de),
                    })}
                />
            )
        }
        return (
            <PaperFormRadioGroup
                name={`paper-opt-${de.id}`}
                value={value}
                options={opts}
                onChange={onChange}
                disabled={disabled}
                layout={resolvePaperRadioLayout(opts, {
                    variant: stageOptionSetUiVariant(de),
                })}
            />
        )
    }

    const deName = (de?.name || de?.displayName || '').toLowerCase()
    const isPhoneField =
        de?.valueType === 'PHONE_NUMBER' ||
        deName.includes('phone') ||
        deName.includes('mobile') ||
        deName.includes('ទូរស័ព្ទ') ||
        deName.includes('លេខទូរស័ព្ទ')

    const handleChange = (val) => {
        if (isPhoneField) {
            val = val.replace(/[^\d+]/g, '')
        }
        onChange?.(val)
    }

    const inputType = getInputTypeForValueType(de.valueType)
    const isTextField = !isPhoneField && (inputType === 'text' || de?.valueType === 'TEXT' || de?.valueType === 'LONG_TEXT')

    if (isTextField && !disabled && !showReadOnly) {
        return (
            <div className="relative w-full">
                <PaperFormTextLine
                    value={value ?? ''}
                    onChange={handleChange}
                    disabled={disabled}
                    type="text"
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
            type={isPhoneField ? 'tel' : inputType}
        />
    )
}
