import { isPartnerSmhCodeStageField } from './partnerSmhField'
import { isPaperFormStage, resolvePaperFormGridClass, sectionUsesPaperFormMode } from './paperFormStages'
import {
    STI_OTHER_TESTED_GATE_DE_ID,
    STI_OTHER_TEST_TYPES_DE_ID,
    isSectionGateOpen,
    trackerDataEntryValueIsPresent,
} from './trackerProgramRuleFieldUi'
import {
    booleanUiVariant,
    stageFieldUsesOptionPills,
    stageOptionSetUiVariant,
    usesSharedHeaderRadio,
} from './stageFieldRender'

const YES_OPTION_HINT = /^(yes|true|y|1|បាទ|មាន|checked)$/i

/** ជ-ការផ្តល់ប្រឹក្សា… / Counselling and advice — four Yes/No rows like Tracker Capture. */
const COUNSELLING_ADVICE_SECTION_HINT = /counsell|counsel|ប្រឹក្សា|ដំបូន្មាន/i
const NON_GATED_SECTION_HINT = /counsell|counsel|ប្រឹក្សា|ដំបូន្មាន|last\s*hiv|តេស្ត.*អេដស៍|last\s*syphilis|តេស្ត.*ស្វាយ|\bprep\b|follow-?up|តាមដាន|referral|បញ្ជូន/i

export function isCounsellingAdviceSection(section) {
    const name = String(section?.name || section?.formName || '').trim()
    return COUNSELLING_ADVICE_SECTION_HINT.test(name)
}

export function isNonGatedSection(section) {
    const name = String(section?.name || section?.formName || '').trim()
    return NON_GATED_SECTION_HINT.test(name)
}

/** Yes/No row (BOOLEAN or 2-option radio) — not a section header gate or paper □ checklist. */
export function isCounsellingAdviceYesNoField(de) {
    if (!de) return false
    const optCount = de?.optionSet?.options?.length || 0
    if (optCount === 2) {
        const v = stageOptionSetUiVariant(de)
        return (
            v === 'VERTICAL_RADIO' ||
            v === 'HORIZONTAL_RADIO' ||
            usesSharedHeaderRadio(de) ||
            isBinaryOptionSet(de)
        )
    }
    return de.valueType === 'BOOLEAN' || de.valueType === 'TRUE_ONLY'
}

/**
 * Tracker Capture: counselling, testing, PrEP, and follow-up blocks use equal rows in the body,
 * not “header gate + checklist” like symptom sections.
 */
export function sectionResolvesHeaderBooleanGate(section, gateDe) {
    if (isNonGatedSection(section)) return false
    return sectionUsesHeaderBooleanGate(gateDe)
}

/**
 * Section header gate: checkbox/toggle, or SHARED_HEADER_RADIOBUTTONS (Yes/No in header).
 * Other BOOLEAN radios stay in the body like DHIS2 Capture.
 */
/**
 * Resolve section gate from Maintenance order (first DE), not from filtered visible list.
 * Gate DE is omitted from visibleDeIds but still drives body visibility.
 */
/**
 * Whether a stage DE should be included in save/complete payloads.
 * Matches rows the user can see: visible now, or has a value (Tracker Capture parity).
 */
export function isStageFieldSubmittableForSave(
    deId,
    section,
    { mergeStageDe, formValues, shouldOmitStageField, isMedicineSectionVisible }
) {
    if (!section?.dataElementIds?.includes(deId)) return true
    if (isMedicineSectionVisible && !isMedicineSectionVisible(section.id)) return false

    if (!shouldOmitStageField(deId)) return true
    if (trackerDataEntryValueIsPresent(formValues[deId])) return true

    const gateDeId = section.dataElementIds[0]
    if (!gateDeId || deId === gateDeId) return false
    const gateDe = mergeStageDe(gateDeId)
    if (!gateDe || !sectionResolvesHeaderBooleanGate(section, gateDe)) return false
    return isSectionGateOpen(gateDe, formValues[gateDeId])
}

export function resolveStageSectionGate(section, { mergeStageDe, formValues, shouldOmitStageField }) {
    const sectionDeIds = section?.dataElementIds || []
    const gateDeId = sectionDeIds[0] || null
    const gateDe = gateDeId ? mergeStageDe(gateDeId) : null
    const hasBooleanGate = sectionResolvesHeaderBooleanGate(section, gateDe)
    const resolvedGateId = hasBooleanGate ? gateDeId : null
    const gateOpen = hasBooleanGate
        ? isSectionGateOpen(gateDe, formValues?.[gateDeId])
        : true
    const bodyDeIds = hasBooleanGate
        ? sectionDeIds.filter((id) => id !== gateDeId && !shouldOmitStageField(id))
        : sectionDeIds.filter((id) => !shouldOmitStageField(id))
    const visibleDeIds = sectionDeIds.filter((id) => !shouldOmitStageField(id))

    return {
        gateDeId: resolvedGateId,
        gateDe,
        hasBooleanGate,
        gateOpen,
        bodyDeIds,
        visibleDeIds,
    }
}

/**
 * All visible body fields for a section in Maintenance order.
 * Same DE set for every UI locale (no grouped-layout drops).
 */
export function resolveStageSectionBodyFields(
    section,
    {
        mergeStageDe,
        shouldOmitStageField,
        gateDeId,
        hasBooleanGate,
        gateOpen = true,
        formValues = {},
        eventDataValues = null,
    }
) {
    const persistedByDe = new Map()
    for (const dv of eventDataValues || []) {
        if (dv?.dataElement) persistedByDe.set(dv.dataElement, dv.value)
    }

    const sectionDeIds = section?.dataElementIds || []
    return sectionDeIds
        .filter((id) => !(hasBooleanGate && gateDeId && id === gateDeId))
        .filter((id) => {
            if (!shouldOmitStageField(id)) return true
            const de = mergeStageDe(id)
            if (trackerDataEntryValueIsPresent(formValues[id], de?.valueType)) return true
            return trackerDataEntryValueIsPresent(persistedByDe.get(id), de?.valueType)
        })
        .map((id) => mergeStageDe(id))
        .filter(Boolean)
}

export function sectionUsesHeaderBooleanGate(gateDe) {
    if (!gateDe) return false
    if (usesSharedHeaderRadio(gateDe)) {
        if (gateDe.valueType === 'TRUE_ONLY' || gateDe.valueType === 'BOOLEAN') return true
        const optCount = gateDe.optionSet?.options?.length || 0
        if (optCount >= 1 && optCount <= 2) {
            const v = stageOptionSetUiVariant(gateDe)
            return (
                v === 'VERTICAL_RADIO' ||
                v === 'HORIZONTAL_RADIO' ||
                isBinaryOptionSet(gateDe)
            )
        }
    }
    if (gateDe.valueType === 'TRUE_ONLY') return true
    if (gateDe.valueType === 'BOOLEAN') {
        const v = booleanUiVariant(gateDe)
        return (
            v === 'CHECKBOX' ||
            v === 'TOGGLE' ||
            v === 'VERTICAL_RADIO' ||
            v === 'HORIZONTAL_RADIO'
        )
    }
    const gateOptCount = gateDe.optionSet?.options?.length || 0
    if (gateOptCount === 2) {
        const v = stageOptionSetUiVariant(gateDe)
        return v === 'VERTICAL_RADIO' || v === 'HORIZONTAL_RADIO' || isBinaryOptionSet(gateDe)
    }
    return false
}

/**
 * Single on/off symptom checkbox (not a full option list).
 * 3+ options (e.g. PrEP type: pill / injection / ring) must stay dropdown/radio like Tracker.
 */
export function isBinaryOptionSet(de) {
    const opts = de?.optionSet?.options
    if (!Array.isArray(opts) || opts.length === 0) return false
    if (opts.length > 2) return false
    if (opts.length === 1) return true
    const variant = stageOptionSetUiVariant(de)
    if (
        variant === 'DROPDOWN' ||
        variant === 'VERTICAL_RADIO' ||
        variant === 'HORIZONTAL_RADIO' ||
        usesSharedHeaderRadio(de)
    ) {
        return false
    }
    return true
}

/** Paper row: single □ (checked = yes). Unchecked clears / no option. */
export function paperFieldUsesSingleCheckbox(de) {
    if (!de) return false
    if (de.valueType === 'BOOLEAN' || de.valueType === 'TRUE_ONLY') return false
    const count = de?.optionSet?.options?.length || 0
    return count === 1
}

/** Merge stage row + global DE so option lists are not wiped by `{ ...base, ...row }`. */
export function mergeStageDataElement(base, row) {
    if (!row && !base) return null
    if (!row) return base ? { ...base } : null
    if (!base) return { ...row }
    const baseOpts = base.optionSet?.options?.length || 0
    const rowOpts = row.optionSet?.options?.length || 0
    const optionSet =
        rowOpts > 0 ? row.optionSet : baseOpts > 0 ? base.optionSet : row.optionSet || base.optionSet
    return {
        ...base,
        ...row,
        optionSet: optionSet || null,
    }
}

/** 2–6 options in paper sections: title on top + horizontal pill row. */
export function isPaperSymptomPillField(de) {
    const count = de?.optionSet?.options?.length || 0
    return count >= 2 && count <= 6 && stageFieldUsesOptionPills(de)
}

/** Title on top + one horizontal pill row (paper + Risk Behavior / similar stage sections). */
export function fieldUsesPillBelowTitleLayout(de, { paperSection = false } = {}) {
    if (!stageFieldUsesOptionPills(de)) return false
    if (paperSection && paperFieldUsesSingleCheckbox(de)) return false
    return true
}

export function paperFieldUsesPillBelowTitle(de, opts = {}) {
    return fieldUsesPillBelowTitleLayout(de, opts)
}

/** Small option sets in paper sections (checkbox or 3-option pills). */
export function isPaperSymptomOptionField(de) {
    return paperFieldUsesSingleCheckbox(de) || isPaperSymptomPillField(de)
}

/** Fields that work as a single on/off switch in a label | switch row (symptom checklist style). */
export function isToggleStyleField(de) {
    if (!de) return false
    if (de.valueType === 'TRUE_ONLY' || de.valueType === 'BOOLEAN') return true
    if (de.stageRenderType === 'TOGGLE') return true
    const rt = de.stageRenderType
    if (rt === 'VERTICAL_CHECKBOXES' || rt === 'HORIZONTAL_CHECKBOXES') return true
    const variant = stageOptionSetUiVariant(de)
    if (variant === 'VERTICAL_MULTI' || variant === 'HORIZONTAL_MULTI') return true
    if (isBinaryOptionSet(de)) return true
    if (isPaperSymptomOptionField(de)) return true
    if (de.renderOptionsAsRadio && (de.optionSet?.options?.length || 0) <= 2) return true
    return false
}

/**
 * Row layout: label left, paper checkbox right (symptom checklist).
 * @param {{ paperSection?: boolean }} [opts] — in paper sections, always checkbox (ignore DHIS2 radio render type).
 */
export function fieldUsesToggleRowLayout(de, opts = {}) {
    const { paperSection = false, counsellingYesNoList = false } = opts
    if (counsellingYesNoList && isCounsellingAdviceYesNoField(de)) return false
    if (fieldUsesPillBelowTitleLayout(de, { paperSection })) return false
    if (!isToggleStyleField(de)) return false
    const optCount = de?.optionSet?.options?.length || 0
    if (paperSection && paperFieldUsesSingleCheckbox(de)) return true
    if (optCount > 0 && stageOptionSetUiVariant(de) === 'DROPDOWN') return false
    if (de.valueType === 'BOOLEAN' || de.valueType === 'TRUE_ONLY') {
        const v = booleanUiVariant(de)
        if (!paperSection && (v === 'VERTICAL_RADIO' || v === 'HORIZONTAL_RADIO')) return false
    }
    return true
}

/** Inline paper row needs a wider control column for Yes/No radios (not checkbox width). */
export function stageFieldNeedsWideInlineControl(de) {
    if (isPaperSymptomPillField(de)) return false
    if (!de?.optionSet?.options?.length) return false
    const variant = stageOptionSetUiVariant(de)
    if (variant !== 'VERTICAL_RADIO' && variant !== 'HORIZONTAL_RADIO') return false
    return de.optionSet.options.length <= 2
}

/**
 * Paper-style symptom block: use 2-column grid when several toggle-style fields appear together.
 */
export function sectionUsesToggleGrid(bodyDeIds, mergeStageDe) {
    const des = (bodyDeIds || []).map((id) => mergeStageDe(id)).filter(Boolean)
    return des.some(isToggleStyleField)
}

/** Partner SMH + symptom checklist sections always use the paper 2-column grid. */
export function sectionHasPartnerSmhField(bodyDeIds, mergeStageDe) {
    return (bodyDeIds || []).some((id) => isPartnerSmhCodeStageField(mergeStageDe(id)))
}

export function sectionUsesPaperGrid(bodyDeIds, mergeStageDe, programStageId, section, paperFormOpts) {
    if (programStageId && section && sectionUsesPaperFormMode(section, programStageId, { bodyDeIds, mergeStageDe, ...paperFormOpts })) {
        return true
    }
    return sectionUsesToggleGrid(bodyDeIds, mergeStageDe) || sectionHasPartnerSmhField(bodyDeIds, mergeStageDe)
}

const LAB_SECTION_TITLE_HINT = /តេស្ត|test|lab|ពិនិត្យ|specimen/i
const LAB_TEST_TYPE_LABEL = /ប្រភេទតេស្ត|types?\s*of\s*tests?\s*performed|test\s*type/i

/** Paper row with □ on the right (symptom or lab site). */
export function isPaperCheckboxRowField(de, { paperSection = false } = {}) {
    if (!de) return false
    if (fieldUsesToggleRowLayout(de, { paperSection })) return true
    if (!paperSection) return false
    if (de.valueType === 'BOOLEAN' || de.valueType === 'TRUE_ONLY') return true
    return paperFieldUsesSingleCheckbox(de)
}

/**
 * Test-type pills on top + site checkboxes below (lab section ៨ pattern).
 * Works from field layout, not only English/Khmer section titles.
 */
export function sectionUsesLabTestChecklistLayout(bodyDeIds, mergeStageDe) {
    const ids = bodyDeIds || []
    let hasPillRow = false
    let hasCheckboxRow = false
    for (const id of ids) {
        const de = mergeStageDe(id)
        if (!de) continue
        if (fieldUsesPillBelowTitleLayout(de, { paperSection: true })) hasPillRow = true
        if (isPaperCheckboxRowField(de, { paperSection: true })) hasCheckboxRow = true
    }
    return hasPillRow && hasCheckboxRow
}

/** Lab “other tests” (test-type pills + site checkboxes): one column; symptom lists stay 2-col. */
export function sectionUsesSingleColumnPaperGrid(bodyDeIds, mergeStageDe, sectionName = '') {
    if (COUNSELLING_ADVICE_SECTION_HINT.test(String(sectionName || ''))) return true
    if (sectionHasPartnerSmhField(bodyDeIds, mergeStageDe)) return false
    if (sectionUsesLabTestChecklistLayout(bodyDeIds, mergeStageDe)) return true
    const ids = bodyDeIds || []
    for (const id of ids) {
        if (id === STI_OTHER_TESTED_GATE_DE_ID || id === STI_OTHER_TEST_TYPES_DE_ID) return true
        const de = mergeStageDe(id)
        if (!de) continue
        const label = String(de.systemName || de.displayName || de.name || '').trim()
        if (LAB_TEST_TYPE_LABEL.test(label)) return true
    }
    if (LAB_SECTION_TITLE_HINT.test(String(sectionName || ''))) {
        let hasTestType = false
        let siteToggleCount = 0
        for (const id of ids) {
            const de = mergeStageDe(id)
            if (!de) continue
            const label = String(de.displayName || de.name || '').trim()
            if (LAB_TEST_TYPE_LABEL.test(label)) hasTestType = true
            if (fieldUsesPillBelowTitleLayout(de, { paperSection: true })) hasTestType = true
            if (isPaperCheckboxRowField(de, { paperSection: true })) siteToggleCount += 1
        }
        if (hasTestType && siteToggleCount >= 1) return true
    }
    return false
}

export function resolveSectionPaperGridClass(
    bodyDeIds,
    mergeStageDe,
    { singleColumnFallback, sectionName = '', programStageId = null, section = null, paperFormOpts } = {}
) {
    if (!sectionUsesPaperGrid(bodyDeIds, mergeStageDe, programStageId, section, paperFormOpts)) {
        return singleColumnFallback
    }
    if (isPaperFormStage(programStageId)) {
        return resolvePaperFormGridClass(bodyDeIds, mergeStageDe, programStageId, section)
    }
    return sectionUsesSingleColumnPaperGrid(bodyDeIds, mergeStageDe, sectionName)
        ? 'symptomToggleGridSingle'
        : 'symptomToggleGrid'
}

/** Short text/number inputs in a paper 2-col cell (label left, compact field right). */
export function isPaperInlineTextField(de) {
    if (!de) return false
    const vt = de.valueType
    return (
        vt === 'TEXT' ||
        vt === 'NUMBER' ||
        vt === 'INTEGER' ||
        vt === 'INTEGER_POSITIVE' ||
        vt === 'INTEGER_NEGATIVE' ||
        vt === 'INTEGER_ZERO_OR_POSITIVE' ||
        vt === 'PERCENTAGE' ||
        vt === 'UNIT_INTERVAL' ||
        vt === 'PHONE_NUMBER' ||
        vt === 'EMAIL' ||
        vt === 'URL' ||
        vt === 'LETTER'
    )
}

/** Multi-option field fills the paper checklist as one 2-col block (not one row per option DE). */
export function isPaperChecklistMultiField(de) {
    if (!de) return false
    const variant = stageOptionSetUiVariant(de)
    const count = de.optionSet?.options?.length || 0
    return (
        (variant === 'VERTICAL_MULTI' || variant === 'HORIZONTAL_MULTI') &&
        count >= 4
    )
}

/** Pick the “yes” option for a 1–3 option set used as a switch. */
export function yesOptionFromBinarySet(opts) {
    if (!opts?.length) return null
    const byHint = opts.find((o) => YES_OPTION_HINT.test(String(o.name || o.displayName || '').trim()))
    return byHint || opts[0]
}

const codeOfOption = (opt) => opt?.code ?? opt?.id

export function defaultSectionGateValue(gateDe) {
    return ''
}

/** Pre-fill empty section header gates when starting a new stage event. */
export function applySectionGateDefaults(formValues, sections, mergeStageDe) {
    return formValues || {}
}

const valueIsTrue = (value) =>
    String(value ?? '').toLowerCase() === 'true' || value === true

const valueMatchesOption = (value, opt) => {
    const v = String(value ?? '').trim()
    if (!v || !opt) return false
    if (opt.code != null && String(opt.code) === v) return true
    if (opt.id != null && String(opt.id) === v) return true
    return false
}

/** Whether a toggle-style field is currently “on” (for row highlight). */
export function isToggleFieldActive(de, formValues) {
    if (!de) return false
    const val = formValues?.[de.id]
    if (de.valueType === 'TRUE_ONLY' || de.valueType === 'BOOLEAN') {
        return valueIsTrue(val)
    }
    const opts = de.optionSet?.options || []
    if (isBinaryOptionSet(de)) {
        const yesOpt = yesOptionFromBinarySet(opts)
        return yesOpt ? valueMatchesOption(val, yesOpt) : false
    }
    return false
}

/** How many checklist items are on in a paper-style section. */
export function countPaperSectionSelected(bodyDeIds, mergeStageDe, formValues) {
    let count = 0
    for (const id of bodyDeIds || []) {
        const de = mergeStageDe(id)
        if (!de) continue
        if (isPaperChecklistMultiField(de)) {
            const codes = String(formValues?.[de.id] ?? '')
                .split(';')
                .map((s) => s.trim())
                .filter(Boolean)
            count += codes.length
        } else if (isToggleStyleField(de) && isToggleFieldActive(de, formValues)) {
            count += 1
        }
    }
    return count
}
