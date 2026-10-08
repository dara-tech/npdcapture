import React from 'react'
import i18n from '@dhis2/d2-i18n'
import { Select } from './select'
import {
    BooleanCheckboxField,
    BooleanSwitchField,
    TrueOnlyCheckboxField,
    TrueOnlySwitchField,
} from './boolean-fields'
import { PaperCheckbox } from './PaperCheckbox'
import { cn } from '../../lib/utils'
import { FORM } from '../../lib/formUi'
import {
    booleanUiVariant,
    joinMultiOptionValue,
    optionSetUiVariant,
    parseMultiOptionValue,
    stageFieldUsesOptionPills,
    stageOptionSetUiVariant,
} from '../../lib/stageFieldRender'
import {
    isBinaryOptionSet,
    paperFieldUsesSingleCheckbox,
    yesOptionFromBinarySet,
} from '../../lib/stageFieldLayout'
import { resolveStageOptionDisplayLabel } from '../../lib/stageFieldLabelI18n'
import { SymptomChecklistGrid } from './SymptomChecklistGrid'
import { OptionSetPillGroup, RoundedOptionRadioGroup } from './option-set-pill-group'
import { medicineGridOptionUiVariant } from '../../lib/medicineSlots'
import { SectionHeaderGateControl } from './SectionHeaderGateControl'

const codeOf = (o) => o.code || o.id

const valueMatchesOption = (value, opt) => {
    const v = String(value ?? '').trim()
    if (!v || !opt) return false
    if (opt.code != null && String(opt.code) === v) return true
    if (opt.id != null && String(opt.id) === v) return true
    const name = String(opt.displayName || opt.name || '').trim()
    if (name && name === v) return true
    return false
}

const findSelectedOption = (opts, value) => opts.find((o) => valueMatchesOption(value, o))

function ReadOnlyFieldValue({ children, emptyLabel }) {
    const text = children != null && String(children).trim() !== '' ? children : emptyLabel ?? i18n.t('Not answered')
    return <div className={cn(FORM.formValue, 'flex min-h-8 items-center')}>{text}</div>
}

const choiceLabelClass = (disabled) =>
    cn(
        'inline-flex items-center gap-2.5 text-sm font-normal leading-snug text-slate-900',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
    )

const isPaperGridFieldLayout = (fieldLayout) =>
    fieldLayout === 'toggle-row' ||
    fieldLayout === 'inline-row' ||
    fieldLayout === 'pill-below-title' ||
    fieldLayout === 'questionnaire-row'

const isQuestionnaireFieldLayout = (fieldLayout) => fieldLayout === 'questionnaire-row'

function PaperOptionYesCheckbox({ de, value, onChange, disabled, options }) {
    const yesOpt = yesOptionFromBinarySet(options)
    const yesCode = yesOpt ? codeOf(yesOpt) : null
    const checked = yesOpt ? valueMatchesOption(value, yesOpt) : false
    return (
        <PaperCheckbox
            id={`de-cb-${de.id}`}
            disabled={disabled}
            checked={checked}
            aria-label={de.name}
            onCheckedChange={(on) => onChange(on && yesCode ? yesCode : '')}
        />
    )
}

function StageOptionRadioList({
    name,
    value,
    options,
    disabled,
    onChange,
    ariaLabel,
    fieldLayout = 'default',
    twoColumn = false,
    allowDeselect = false,
}) {
    return (
        <RoundedOptionRadioGroup
            name={name}
            value={value}
            options={options}
            onChange={onChange}
            disabled={disabled}
            ariaLabel={ariaLabel}
            fieldLayout={fieldLayout}
            twoColumn={twoColumn}
            allowDeselect={allowDeselect}
            resolveLabel={(opt) => resolveStageOptionDisplayLabel(opt)}
        />
    )
}

function BooleanRadioPills({ de, value, options, onChange, disabled, fieldLayout, twoColumn, allowDeselect = false }) {
    return (
        <RoundedOptionRadioGroup
            name={`de-bool-${de.id}`}
            value={value}
            options={options}
            onChange={onChange}
            disabled={disabled}
            ariaLabel={de.name}
            fieldLayout={fieldLayout}
            twoColumn={twoColumn}
            allowDeselect={allowDeselect}
        />
    )
}

export function OptionSetValueControl({
    de,
    value,
    onChange,
    hiddenOptionIds,
    hiddenOptionCodes,
    disabled = false,
    readOnly = false,
    fieldLayout = 'default',
    inMedicineGrid = false,
    inPaperSection = false,
    paperSingleColumn = false,
    selectClassName,
    gateOpen = false,
    allowDeselect = false,
}) {
    const opts = (de.optionSet?.options || []).filter((o) => {
        if (!o) return false
        const id = String(o.id || '')
        const code = String(o.code || '').trim()
        const codeUpper = code.toUpperCase()
        if (hiddenOptionIds?.has?.(id) || hiddenOptionIds?.has?.(code) || hiddenOptionIds?.has?.(codeUpper)) return false
        if (hiddenOptionCodes?.has?.(id) || hiddenOptionCodes?.has?.(code) || hiddenOptionCodes?.has?.(codeUpper)) return false
        return true
    })
    const variant = inMedicineGrid ? medicineGridOptionUiVariant(de) : stageOptionSetUiVariant(de)
    const emptyToken = '__EMPTY__'
    const showReadOnly = readOnly || disabled

    const renderOptionSelect = () => {
        const selectVal = value != null && String(value) !== '' ? String(value) : emptyToken
        return (
            <Select
                value={selectVal}
                onValueChange={(next) => onChange(next === emptyToken ? '' : next)}
                options={[
                    { value: emptyToken, label: i18n.t('Select or search from the list') },
                    ...opts.map((opt) => {
                        const code = codeOf(opt)
                        return {
                            value: code,
                            label: resolveStageOptionDisplayLabel(opt) || String(code ?? ''),
                        }
                    }),
                ]}
                placeholder={i18n.t('Select or search from the list')}
                searchPlaceholder={i18n.t('Search...')}
                className={cn('w-full', selectClassName)}
                disabled={disabled}
            />
        )
    }
    const usePaperChecklist =
        isPaperGridFieldLayout(fieldLayout) ||
        isBinaryOptionSet(de) ||
        variant === 'VERTICAL_MULTI' ||
        variant === 'HORIZONTAL_MULTI'

    if (fieldLayout === 'header-inline') {
        return (
            <SectionHeaderGateControl
                de={opts.length ? { ...de, optionSet: { options: opts } } : de}
                value={value}
                onChange={onChange}
                disabled={disabled}
                readOnly={showReadOnly}
                gateOpen={gateOpen}
            />
        )
    }

    if (showReadOnly) {
        if (variant === 'VERTICAL_MULTI' || variant === 'HORIZONTAL_MULTI') {
            const labels = parseMultiOptionValue(value)
                .map((code) => findSelectedOption(opts, code)?.name || code)
                .filter(Boolean)
            return <ReadOnlyFieldValue>{labels.join('; ')}</ReadOnlyFieldValue>
        }
        const selected = findSelectedOption(opts, value)
        return (
            <ReadOnlyFieldValue>
                {selected ? resolveStageOptionDisplayLabel(selected) : value}
            </ReadOnlyFieldValue>
        )
    }

    if (isQuestionnaireFieldLayout(fieldLayout) && opts.length >= 2) {
        return (
            <StageOptionRadioList
                name={`de-${de.id}`}
                value={value}
                options={opts}
                onChange={onChange}
                disabled={disabled}
                ariaLabel={de.name}
                fieldLayout="questionnaire-row"
                allowDeselect={allowDeselect}
            />
        )
    }

    if (inMedicineGrid && opts.length > 0) {
        if (variant === 'VERTICAL_MULTI' || variant === 'HORIZONTAL_MULTI') {
            const selectedCodes = parseMultiOptionValue(value)
            const isOptSelected = (opt) =>
                selectedCodes.some(
                    (v) => valueMatchesOption(v, opt) || String(v) === String(codeOf(opt))
                )
            const toggle = (code) => {
                if (disabled) return
                const next = new Set(selectedCodes)
                if (next.has(code)) next.delete(code)
                else next.add(code)
                onChange(joinMultiOptionValue([...next]))
            }
            return (
                <SymptomChecklistGrid
                    idPrefix={de.id}
                    options={opts}
                    disabled={disabled}
                    isSelected={isOptSelected}
                    onToggle={(code) => toggle(String(code))}
                    singleColumn={paperSingleColumn}
                />
            )
        }
        return renderOptionSelect()
    }

    if (
        isPaperGridFieldLayout(fieldLayout) &&
        (paperFieldUsesSingleCheckbox(de) || isBinaryOptionSet(de))
    ) {
        return (
            <PaperOptionYesCheckbox
                de={de}
                value={value}
                onChange={onChange}
                disabled={disabled}
                options={opts}
            />
        )
    }

    if (
        isPaperGridFieldLayout(fieldLayout) &&
        (variant === 'VERTICAL_RADIO' || variant === 'HORIZONTAL_RADIO') &&
        (fieldLayout === 'pill-below-title' || opts.length >= 2)
    ) {
        const pillLayout =
            fieldLayout === 'pill-below-title' || opts.length >= 2
                ? 'pill-below-title'
                : fieldLayout
        return (
            <StageOptionRadioList
                name={`de-${de.id}`}
                value={value}
                options={opts}
                disabled={disabled}
                fieldLayout={pillLayout}
                twoColumn={false}
                aria-label={de.name}
                onChange={onChange}
                allowDeselect={allowDeselect}
            />
        )
    }

    if (
        !inMedicineGrid &&
        stageFieldUsesOptionPills({ ...de, optionSet: { options: opts } }) &&
        opts.length >= 2
    ) {
        return (
            <StageOptionRadioList
                name={`de-${de.id}`}
                value={value}
                options={opts}
                disabled={disabled}
                fieldLayout="pill-below-title"
                twoColumn={false}
                aria-label={de.name}
                onChange={onChange}
                allowDeselect={allowDeselect}
            />
        )
    }

    if (variant === 'DROPDOWN') {
        return renderOptionSelect()
    }

    if (variant === 'VERTICAL_RADIO' || variant === 'HORIZONTAL_RADIO') {
        if (fieldLayout === 'inline-row') {
            return (
                <StageOptionRadioList
                    name={`de-${de.id}`}
                    value={value}
                    options={opts}
                    disabled={disabled}
                    fieldLayout={fieldLayout}
                    twoColumn={inPaperSection && opts.length >= 4}
                    aria-label={de.name}
                    onChange={onChange}
                    allowDeselect={allowDeselect}
                />
            )
        }
        return (
            <OptionSetPillGroup
                name={`de-${de.id}`}
                value={value}
                options={opts}
                disabled={disabled}
                allowClear={false}
                paperTwoColumn={inPaperSection && opts.length >= 3}
                aria-label={de.name}
                resolveLabel={(opt) => resolveStageOptionDisplayLabel(opt)}
                onChange={onChange}
            />
        )
    }

    /* Multi-select option sets (DHIS2 stores codes separated by ';') */
    const selectedCodes = parseMultiOptionValue(value)
    const isOptSelected = (opt) =>
        selectedCodes.some((v) => valueMatchesOption(v, opt) || String(v) === String(codeOf(opt)))
    const toggle = (code) => {
        if (disabled) return
        const next = new Set(selectedCodes)
        if (next.has(code)) next.delete(code)
        else next.add(code)
        onChange(joinMultiOptionValue([...next]))
    }

    if (usePaperChecklist && (variant === 'VERTICAL_MULTI' || variant === 'HORIZONTAL_MULTI')) {
        return (
            <SymptomChecklistGrid
                idPrefix={de.id}
                options={opts}
                disabled={disabled}
                isSelected={isOptSelected}
                onToggle={(code) => toggle(String(code))}
                singleColumn={paperSingleColumn}
            />
        )
    }

    const choiceLayout =
        variant === 'HORIZONTAL_MULTI' && (opts.length > 5 || (inPaperSection && opts.length >= 3))
            ? 'grid grid-cols-2 gap-x-3 gap-y-2'
            : variant === 'HORIZONTAL_MULTI'
              ? 'flex flex-row flex-wrap gap-x-6 gap-y-2'
              : 'flex flex-col gap-2.5'
    return (
        <div className={cn('w-full', choiceLayout, FORM.controlChoiceShell)}>
            {opts.map((opt) => {
                const c = codeOf(opt)
                const id = `${de.id}-cb-${c}`
                return (
                    <label key={c} htmlFor={id} className={choiceLabelClass(disabled)}>
                        <input
                            id={id}
                            type="checkbox"
                            disabled={disabled}
                            className="h-4 w-4 shrink-0 rounded border-slate-300 accent-[var(--app-header-bar-bg)] focus:outline-none focus:ring-2 focus:ring-[rgba(44,102,147,0.28)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            checked={isOptSelected(opt)}
                            onChange={() => toggle(String(c))}
                        />
                        <span>{resolveStageOptionDisplayLabel(opt)}</span>
                    </label>
                )
            })}
        </div>
    )
}

/** BOOLEAN / TRUE_ONLY respecting program stage render type. */
export function BooleanValueControl({
    de,
    value,
    onChange,
    mandatory,
    disabled = false,
    readOnly = false,
    fieldLayout = 'default',
    inPaperSection = false,
    gateOpen = false,
    allowDeselect = false,
}) {
    const variant = booleanUiVariant(de)
    const vt = de.valueType
    const showReadOnly = readOnly || disabled
    const useRadio =
        variant === 'VERTICAL_RADIO' ||
        variant === 'HORIZONTAL_RADIO' ||
        variant === 'VERTICAL_MULTI' ||
        variant === 'HORIZONTAL_MULTI'
    const usePaperCheckbox =
        isPaperGridFieldLayout(fieldLayout) && !isQuestionnaireFieldLayout(fieldLayout)
    const useSwitch = variant === 'TOGGLE' && !usePaperCheckbox

    if (fieldLayout === 'header-inline') {
        return (
            <SectionHeaderGateControl
                de={de}
                value={value}
                onChange={onChange}
                disabled={disabled}
                readOnly={showReadOnly}
                gateOpen={gateOpen}
            />
        )
    }

    if (isQuestionnaireFieldLayout(fieldLayout) && !showReadOnly) {
        const isTrue = String(value).toLowerCase() === 'true' || value === true
        const isFalse = String(value).toLowerCase() === 'false' || value === false
        const unset = value === undefined || value === null || String(value).trim() === ''
        const boolValue = unset ? '' : isTrue ? 'true' : 'false'
        return (
            <BooleanRadioPills
                de={de}
                value={boolValue}
                onChange={onChange}
                disabled={disabled}
                fieldLayout="questionnaire-row"
                allowDeselect={allowDeselect}
                options={[
                    ...(!mandatory ? [{ code: '', name: i18n.t('Not answered') }] : []),
                    { code: 'false', name: i18n.t('No') },
                    { code: 'true', name: i18n.t('Yes') },
                ]}
            />
        )
    }

    if (showReadOnly) {
        if (vt === 'TRUE_ONLY') {
            const on = String(value || '').toLowerCase() === 'true' || value === true
            return <ReadOnlyFieldValue>{on ? i18n.t('Yes') : i18n.t('No')}</ReadOnlyFieldValue>
        }
        const isTrue = String(value).toLowerCase() === 'true' || value === true
        const isFalse = String(value).toLowerCase() === 'false' || value === false
        if (isTrue) return <ReadOnlyFieldValue>{i18n.t('Yes')}</ReadOnlyFieldValue>
        if (isFalse) return <ReadOnlyFieldValue>{i18n.t('No')}</ReadOnlyFieldValue>
        return <ReadOnlyFieldValue />
    }

    if (vt === 'TRUE_ONLY') {
        if (usePaperCheckbox) {
            const isTrue = String(value || '').toLowerCase() === 'true' || value === true
            return (
                <PaperCheckbox
                    id={`de-cb-${de.id}`}
                    checked={isTrue}
                    disabled={disabled}
                    aria-label={de.name}
                    onCheckedChange={(on) => onChange(on ? 'true' : '')}
                />
            )
        }
        if (useSwitch) {
            return (
                <TrueOnlySwitchField
                    id={`de-sw-${de.id}`}
                    value={value}
                    disabled={disabled}
                    onChange={onChange}
                    aria-label={de.name}
                />
            )
        }
        if (variant === 'CHECKBOX') {
            return <TrueOnlyCheckboxField value={value} disabled={disabled} onChange={onChange} />
        }
        const current = String(value || '').toLowerCase() === 'true' || value === true ? 'true' : ''
        return (
            <BooleanRadioPills
                de={de}
                value={current}
                onChange={onChange}
                disabled={disabled}
                fieldLayout={fieldLayout}
                twoColumn={inPaperSection && variant === 'HORIZONTAL_RADIO'}
                options={[
                    { code: '', name: i18n.t('No') },
                    { code: 'true', name: i18n.t('Yes') },
                ]}
            />
        )
    }

    /* BOOLEAN in paper sections: Capture-style ○ ទេ / ○ បាទ·ចាស (not a lone checkbox). */
    if (inPaperSection && !useSwitch) {
        const isTrue = String(value).toLowerCase() === 'true' || value === true
        const isFalse = String(value).toLowerCase() === 'false' || value === false
        const unset = value === undefined || value === null || String(value).trim() === ''
        const boolValue = unset ? '' : isTrue ? 'true' : 'false'
        return (
            <BooleanRadioPills
                de={de}
                value={boolValue}
                onChange={onChange}
                disabled={disabled}
                fieldLayout={fieldLayout}
                twoColumn={variant === 'HORIZONTAL_RADIO'}
                allowDeselect={allowDeselect}
                options={[
                    ...(!mandatory ? [{ code: '', name: i18n.t('Not answered') }] : []),
                    { code: 'false', name: i18n.t('No') },
                    { code: 'true', name: i18n.t('Yes') },
                ]}
            />
        )
    }

    /* BOOLEAN (non-paper grid): single checkbox when layout is toggle-row */
    if (usePaperCheckbox) {
        const isTrue = String(value).toLowerCase() === 'true' || value === true
        return (
            <PaperCheckbox
                id={`de-cb-${de.id}`}
                checked={isTrue}
                disabled={disabled}
                aria-label={de.name}
                onCheckedChange={(on) =>
                    onChange(mandatory ? (on ? 'true' : 'false') : on ? 'true' : '')
                }
            />
        )
    }
    if (useSwitch) {
        return (
            <BooleanSwitchField
                id={`de-sw-${de.id}`}
                value={value}
                mandatory={mandatory}
                disabled={disabled}
                onChange={onChange}
                aria-label={de.name}
            />
        )
    }
    if (variant === 'CHECKBOX' || variant === 'VERTICAL_MULTI' || variant === 'HORIZONTAL_MULTI') {
        return (
            <BooleanCheckboxField
                value={value}
                mandatory={mandatory}
                disabled={disabled}
                onChange={onChange}
            />
        )
    }

    const isTrue = String(value).toLowerCase() === 'true' || value === true
    const isFalse = String(value).toLowerCase() === 'false' || value === false
    const unset = value === undefined || value === null || String(value).trim() === ''
    const boolValue = unset ? '' : isTrue ? 'true' : 'false'

    return (
        <BooleanRadioPills
            de={de}
            value={boolValue}
            onChange={onChange}
            disabled={disabled}
            fieldLayout={fieldLayout}
            twoColumn={inPaperSection && variant === 'HORIZONTAL_RADIO'}
            allowDeselect={allowDeselect}
            options={[
                ...(!mandatory ? [{ code: '', name: i18n.t('Not answered') }] : []),
                { code: 'false', name: i18n.t('No') },
                { code: 'true', name: i18n.t('Yes') },
            ]}
        />
    )
}
