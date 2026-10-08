import React from 'react'
import i18n from '@dhis2/d2-i18n'
import { cn } from '../../lib/utils'
import { FORM } from '../../lib/formUi'
import { yesOptionFromBinarySet } from '../../lib/stageFieldLayout'
import { usesSharedHeaderRadio, booleanUiVariant, stageOptionSetUiVariant } from '../../lib/stageFieldRender'
import { resolveStageOptionDisplayLabel } from '../../lib/stageFieldLabelI18n'
import { PaperCheckbox } from './PaperCheckbox'

const codeOf = (o) => o?.code ?? o?.id

const valueMatchesOption = (value, opt) => {
    const v = String(value ?? '').trim()
    if (!v || !opt) return false
    if (opt.code != null && String(opt.code) === v) return true
    if (opt.id != null && String(opt.id) === v) return true
    const name = String(opt.displayName || opt.name || '').trim()
    if (name && name === v) return true
    return false
}

function segmentMatchesValue(value, segment, de) {
    const vt = de?.valueType
    if (vt === 'TRUE_ONLY') {
        const on = String(value ?? '').toLowerCase() === 'true' || value === true
        if (segment.code === 'true') return on
        return !on
    }
    if (vt === 'BOOLEAN') {
        const isTrue = String(value).toLowerCase() === 'true' || value === true
        const isFalse = String(value).toLowerCase() === 'false' || value === false
        const unset =
            value === undefined || value === null || String(value).trim() === ''
        if (segment.code === 'true') return isTrue
        if (segment.code === 'false') return isFalse || unset
        return unset && segment.code === ''
    }
    if (segment.option) return valueMatchesOption(value, segment.option)
    return String(value ?? '') === String(segment.code ?? '')
}

/** Build Yes/No (or option-set) segments for the section title gate. */
export function buildSectionHeaderGateSegments(de) {
    if (!de) {
        return [
            { code: 'false', label: i18n.t('No') },
            { code: 'true', label: i18n.t('Yes') },
        ]
    }

    const vt = de.valueType
    if (vt === 'TRUE_ONLY') {
        return [
            { code: '', label: i18n.t('No') },
            { code: 'true', label: i18n.t('Yes') },
        ]
    }

    if (vt === 'BOOLEAN') {
        return [
            { code: 'false', label: i18n.t('No') },
            { code: 'true', label: i18n.t('Yes') },
        ]
    }

    const opts = de.optionSet?.options || []
    if (!opts.length) {
        return [
            { code: 'false', label: i18n.t('No') },
            { code: 'true', label: i18n.t('Yes') },
        ]
    }

    if (opts.length === 2) {
        const yesOpt = yesOptionFromBinarySet(opts)
        const ordered = yesOpt ? [yesOpt, opts.find((o) => o !== yesOpt) || opts[1]] : opts
        return ordered.map((opt) => ({
            code: codeOf(opt),
            label: resolveStageOptionDisplayLabel(opt),
            option: opt,
        }))
    }

    return opts.map((opt) => ({
        code: codeOf(opt),
        label: resolveStageOptionDisplayLabel(opt),
        option: opt,
    }))
}

export function resolveSectionHeaderGateSegmentCount(de) {
    if (!de) return 2
    if (de.valueType === 'TRUE_ONLY' || de.valueType === 'BOOLEAN') return 2
    const n = de.optionSet?.options?.length || 0
    return n >= 2 ? n : 2
}

/**
 * Section header: Tracker Capture uses ទេ / បាទ·ចាស radio pills (SHARED_HEADER_RADIOBUTTONS),
 * not a single checkbox. Body fields in the section stay checkbox-by-row.
 */
export function sectionHeaderGateUsesCheckbox(de) {
    if (!de) return false
    if (usesSharedHeaderRadio(de)) return false
    const boolVariant = booleanUiVariant(de)
    if (boolVariant === 'VERTICAL_RADIO' || boolVariant === 'HORIZONTAL_RADIO') return false
    if (de.valueType === 'BOOLEAN' || de.valueType === 'TRUE_ONLY') return false
    const optCount = de.optionSet?.options?.length || 0
    if (optCount === 2) {
        const optVariant = stageOptionSetUiVariant(de)
        if (optVariant === 'VERTICAL_RADIO' || optVariant === 'HORIZONTAL_RADIO') {
            return false
        }
    }
    return resolveSectionHeaderGateSegmentCount(de) > 2
}

const KHMER_RE = /[\u1780-\u17FF]/

/** Gate column sizing from real label text (Khmer needs more px per character). */
export function resolveSectionHeaderGateLayout(de) {
    if (sectionHeaderGateUsesCheckbox(de)) {
        return {
            stacked: false,
            minWidth: 108,
            widthClass: 'w-auto shrink-0',
        }
    }

    const segments = buildSectionHeaderGateSegments(de)
    const labels = segments.map((s) => String(s.label || ''))
    const maxLen = Math.max(...labels.map((l) => l.length), 2)
    const hasKhmer = labels.some((l) => KHMER_RE.test(l))
    const count = segments.length

    const charPx = hasKhmer ? 10 : 7.5
    const padPx = 28
    const segmentPx = Math.ceil(maxLen * charPx + padPx)
    const gapPx = 8
    const minWidth = Math.min(
        segmentPx * count + gapPx * Math.max(0, count - 1),
        hasKhmer ? 360 : 300
    )

    return {
        stacked: false,
        minWidth: Math.max(minWidth, 112),
        widthClass: 'w-full shrink-0 sm:w-auto sm:max-w-full',
    }
}

/** @deprecated Use resolveSectionHeaderGateLayout().widthClass */
export function resolveSectionHeaderGateWidthClass(de) {
    return resolveSectionHeaderGateLayout(de).widthClass
}

function SectionHeaderGateCheckbox({ de, value, onChange, disabled, segments }) {
    const vt = de?.valueType
    let checked = false

    if (vt === 'TRUE_ONLY') {
        checked = String(value ?? '').toLowerCase() === 'true' || value === true
    } else if (vt === 'BOOLEAN') {
        checked = String(value).toLowerCase() === 'true' || value === true
    } else {
        const yesSeg =
            segments.find((s) => s.option && yesOptionFromBinarySet([s.option]) === s.option) ||
            segments[0]
        checked = segmentMatchesValue(value, yesSeg, de)
    }

    const handleToggle = (on) => {
        if (disabled) return
        if (vt === 'TRUE_ONLY') {
            onChange(on ? 'true' : '')
            return
        }
        if (vt === 'BOOLEAN') {
            onChange(on ? 'true' : 'false')
            return
        }
        const yesSeg =
            segments.find((s) => s.option && yesOptionFromBinarySet([s.option]) === s.option) ||
            segments[0]
        const noSeg = segments.find((s) => s !== yesSeg) || segments[1]
        onChange(on ? yesSeg.code : noSeg?.code ?? '')
    }

    const yesLabel = i18n.t('Yes')

    return (
        <label
            className={cn(
                FORM.sectionHeaderGateYesPill,
                checked && FORM.sectionHeaderGateYesPillChecked,
                disabled && 'cursor-not-allowed opacity-60'
            )}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <PaperCheckbox
                id={`section-gate-${de?.id || 'gate'}`}
                disabled={disabled}
                checked={checked}
                aria-label={`${yesLabel} — ${de?.displayName || de?.name || i18n.t('Section gate')}`}
                onCheckedChange={handleToggle}
            />
            <span className={FORM.gateHeaderYesLabel}>{yesLabel}</span>
        </label>
    )
}

/**
 * Section gate beside the title — checkbox for Yes/No, segmented pills for 3+ options.
 */
export function SectionHeaderGateControl({
    de,
    value,
    onChange,
    disabled = false,
    readOnly = false,
    gateOpen = false,
}) {
    const segments = buildSectionHeaderGateSegments(de)
    const useCheckbox = sectionHeaderGateUsesCheckbox(de)

    if (readOnly || disabled) {
        const selected = segments.find((seg) => segmentMatchesValue(value, seg, de))
        return (
            <span className={cn(FORM.formValue, 'block text-center')}>
                {selected?.label ?? i18n.t('Not answered')}
            </span>
        )
    }

    if (useCheckbox) {
        return (
            <div className="flex w-full items-center justify-end">
                <SectionHeaderGateCheckbox
                    de={de}
                    value={value}
                    onChange={onChange}
                    disabled={disabled}
                    segments={segments}
                />
            </div>
        )
    }

    return (
        <div
            className={cn(
                FORM.sectionHeaderGateSegments,
                gateOpen && FORM.sectionHeaderGateSegmentsOpen
            )}
            role="radiogroup"
            aria-label={de?.displayName || de?.name || i18n.t('Section gate')}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
        >
            {segments.map((seg) => {
                const selected = segmentMatchesValue(value, seg, de)
                return (
                    <button
                        key={`${seg.code || '__empty'}`}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={disabled}
                        className={cn(
                            FORM.sectionHeaderGateSegment,
                            selected && FORM.sectionHeaderGateSegmentSelected
                        )}
                        onClick={() => {
                            if (disabled) return
                            onChange(seg.code)
                        }}
                    >
                        {seg.label}
                    </button>
                )
            })}
        </div>
    )
}
