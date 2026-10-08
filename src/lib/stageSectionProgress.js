import { validateFieldValue } from './fieldValidation'
import { resolveStageSectionGate, sectionUsesHeaderBooleanGate } from './stageFieldLayout'

const isEmpty = (v) => v === '' || v === null || v === undefined

export function isFieldValueFilled(value, valueType) {
    if (valueType === 'TRUE_ONLY') return String(value) === 'true' || value === true
    if (valueType === 'BOOLEAN') return !isEmpty(value)
    return !isEmpty(value)
}

/**
 * @returns {'empty'|'partial'|'complete'|'locked'}
 */
export function computeSectionProgress({
    bodyDeIds,
    visibleDeIds,
    mergeStageDe,
    formValues,
    mandatoryFieldIds,
    hasBooleanGate,
    gateDeId,
    gateOpen,
}) {
    if (hasBooleanGate && !gateOpen) return 'locked'

    const bodyIds = bodyDeIds ?? visibleDeIds ?? []
    let mandatoryTotal = 0
    let mandatoryFilled = 0
    let anyFilled = false

    for (const deId of bodyIds) {
        const de = mergeStageDe(deId)
        if (!de) continue
        const val = formValues[deId]
        if (isFieldValueFilled(val, de.valueType)) anyFilled = true
        const mandatory = Boolean(de.compulsory) || mandatoryFieldIds?.has?.(deId)
        if (!mandatory) continue
        mandatoryTotal += 1
        const err = validateFieldValue(val, {
            mandatory: true,
            pattern: de.pattern,
            valueType: de.valueType,
            name: de.displayName || de.name,
        })
        if (!err) mandatoryFilled += 1
    }

    if (hasBooleanGate && gateDeId) {
        const gateDe = mergeStageDe(gateDeId)
        if (gateDe) {
            const gVal = formValues[gateDeId]
            if (isFieldValueFilled(gVal, gateDe.valueType)) anyFilled = true
            const gateMandatory = Boolean(gateDe.compulsory) || mandatoryFieldIds?.has?.(gateDeId)
            if (gateMandatory) {
                mandatoryTotal += 1
                const err = validateFieldValue(gVal, {
                    mandatory: true,
                    pattern: gateDe.pattern,
                    valueType: gateDe.valueType,
                    name: gateDe.displayName || gateDe.name,
                })
                if (!err) mandatoryFilled += 1
            }
        }
    }

    if (mandatoryTotal > 0) {
        if (mandatoryFilled >= mandatoryTotal) return 'complete'
        if (mandatoryFilled > 0 || anyFilled) return 'partial'
        return 'empty'
    }

    if (anyFilled) return 'complete'
    return 'empty'
}

export function countRequiredRemainingInSection({
    bodyDeIds,
    visibleDeIds,
    mergeStageDe,
    formValues,
    mandatoryFieldIds,
    hasBooleanGate,
    gateDeId,
    gateOpen,
}) {
    let remaining = 0
    const check = (deId) => {
        const de = mergeStageDe(deId)
        if (!de) return
        const mandatory = Boolean(de.compulsory) || mandatoryFieldIds?.has?.(deId)
        if (!mandatory) return
        const err = validateFieldValue(formValues[deId], {
            mandatory: true,
            pattern: de.pattern,
            valueType: de.valueType,
            name: de.displayName || de.name,
        })
        if (err) remaining += 1
    }

    if (hasBooleanGate && gateDeId) {
        check(gateDeId)
        if (!gateOpen) return remaining
    }
    const bodyIds = bodyDeIds ?? visibleDeIds ?? []
    bodyIds.forEach(check)
    return remaining
}

export function listMissingStageFields({
    sections,
    mergeStageDe,
    formValues,
    mandatoryFieldIds,
    shouldOmitStageField,
    isMedicineSectionVisible,
    isSectionBodyUnlocked,
}) {
    const missing = []
    for (const section of sections || []) {
        if (!isMedicineSectionVisible(section.id)) continue
        const gate = resolveStageSectionGate(section, {
            mergeStageDe,
            formValues,
            shouldOmitStageField,
        })
        const { gateDeId: gateId, hasBooleanGate, gateOpen, bodyDeIds } = gate
        const ids = hasBooleanGate
            ? [gateId, ...bodyDeIds].filter(Boolean)
            : bodyDeIds
        for (const deId of ids) {
            const de = mergeStageDe(deId)
            if (!de) continue
            if (hasBooleanGate && deId !== gateId && !gateOpen) continue
            const mandatory = Boolean(de.compulsory) || mandatoryFieldIds?.has?.(deId)
            if (!mandatory) continue
            const err = validateFieldValue(formValues[deId], {
                mandatory: true,
                pattern: de.pattern,
                valueType: de.valueType,
                name: de.displayName || de.name,
            })
            if (err) {
                missing.push({
                    sectionId: section.id,
                    sectionName: section.name,
                    deId: de.id,
                    label: de.displayName || de.name,
                    error: err,
                })
            }
        }
    }
    return missing
}

const LETTER_PREFIX_RE = /^([\u1780-\u17A2])\s*[-–—]\s*(.+)$/u
const EN_SUBTITLE_STOP_RE = /\s*[-–—]\s*(?:[១២៣៤៥៦៧៨៩]|[0-9]+)[\s.\-–—/]/
const SUBSECTION_NUM_RE = /^([១២៣៤៥៦៧៨៩]+|[0-9]+)[\s.\-–—]/

const KHMER_TO_ARABIC_DIGIT = {
    '១': '1',
    '២': '2',
    '៣': '3',
    '៤': '4',
    '៥': '5',
    '៦': '6',
    '៧': '7',
    '៨': '8',
    '៩': '9',
}

function leadingIndexDigit(text) {
    const m = String(text || '').trim().match(SUBSECTION_NUM_RE)
    if (!m) return null
    const raw = m[1]
    if (/^[0-9]+$/.test(raw)) return raw
    return raw
        .split('')
        .map((ch) => KHMER_TO_ARABIC_DIGIT[ch] || ch)
        .join('')
}

/** English line from DHIS2 name often repeats the Khmer numbered title — skip in UI. */
export function sectionEnglishIsRedundant(primary, englishHint) {
    if (!englishHint || !primary) return true
    const enIdx = leadingIndexDigit(englishHint)
    const khIdx = leadingIndexDigit(primary)
    if (enIdx && khIdx && enIdx === khIdx) return true
    return false
}

function stripLetterPrefix(text) {
    const t = String(text || '').trim()
    const m = t.match(LETTER_PREFIX_RE)
    return m ? m[2].trim() : t
}

function shortenEnglishLine(text, maxLen = 42) {
    let s = String(text || '').trim()
    if (!s) return ''
    const slash = s.indexOf('/')
    if (slash !== -1) s = s.slice(0, slash).trim()
    s = s.split(EN_SUBTITLE_STOP_RE)[0].trim()
    if (s.length > maxLen) return `${s.slice(0, maxLen - 1)}…`
    return s
}

/**
 * Pick the fullest section label from DHIS2 metadata (form name often has
 * "ក-…/General information"; displayName may be Khmer-only).
 */
export function resolveSectionTitleFromMetadata(section, structureNameById) {
    const structural =
        (typeof structureNameById?.get === 'function'
            ? structureNameById.get(section?.id)
            : null) || ''
    const form = String(section?.formName || '').trim()
    const display = String(section?.displayName || '').trim()
    const technical = String(section?.name || '').trim()
    const candidates = [form, structural, technical, display].filter(Boolean)
    const bilingual = candidates.find((c) => c.includes('/'))
    if (bilingual) return bilingual
    const letterLed = candidates.find((c) => LETTER_PREFIX_RE.test(c))
    if (letterLed) return letterLed
    return display || form || structural || technical || ''
}

/**
 * Compact section header from DHIS2 names like
 * "ខ-ប្រវត្តិ…/History and Reason - ១.ដៃគូ…/1.Partner…".
 */
export function formatSectionHeaderDisplay(name) {
    const fullTitle = String(name || '').trim()
    if (!fullTitle) {
        return { badge: null, primary: '', englishHint: '', fullTitle: '', displayTitle: '' }
    }

    let badge = null
    const letterAtStart = fullTitle.match(LETTER_PREFIX_RE)
    if (letterAtStart) badge = letterAtStart[1]

    const slash = fullTitle.indexOf('/')
    const beforeSlash = slash === -1 ? fullTitle : fullTitle.slice(0, slash).trim()
    const afterSlash = slash === -1 ? '' : fullTitle.slice(slash + 1).trim()

    const primary = stripLetterPrefix(beforeSlash)
    const englishHint = shortenEnglishLine(afterSlash)
    const primaryText = primary || stripLetterPrefix(fullTitle)
    const isSubsection = SUBSECTION_NUM_RE.test(primaryText)

    return {
        badge,
        primary: primaryText,
        englishHint,
        fullTitle,
        /** Full Maintenance title for the section bar (Khmer + English, letter prefix). */
        displayTitle: fullTitle,
        isSubsection,
        showBadge: Boolean(badge) && !isSubsection,
        showEnglish: Boolean(englishHint) && !sectionEnglishIsRedundant(primaryText, englishHint),
    }
}

const STEP_CHILD_NUM_RE = /[-–—]\s*([១២៣៤៥៦៧៨៩]|[0-9]+)[\s.\-–—]/

/**
 * Stepper chip: unique label + step number (avoids repeating "ខ" for every ខ-* section).
 */
export function formatSectionStepDisplay(name, stepIndex) {
    const header = formatSectionHeaderDisplay(name)
    const stepNumber = stepIndex + 1
    let sideLabel = header.primary || header.englishHint || header.fullTitle

    if (sideLabel.length > 32) {
        sideLabel = `${sideLabel.slice(0, 30)}…`
    }

    const tooltip =
        header.fullTitle.length > sideLabel.length + 8 ? header.fullTitle : undefined

    return { stepNumber, sideLabel, tooltip }
}

/** @deprecated Use formatSectionHeaderDisplay */
export function splitKhmerEnglishSectionTitle(name) {
    const { primary, englishHint, fullTitle } = formatSectionHeaderDisplay(name)
    return { khmer: primary, english: englishHint, full: fullTitle }
}
