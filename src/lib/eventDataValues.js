import i18n from '@dhis2/d2-i18n'
import { joinMultiOptionValue, parseMultiOptionValue } from './stageFieldRender'
import { resolveStageOptionDisplayLabel } from './stageFieldLabelI18n'
import {
    findMedicineSlotByIndex,
    getMedicineSlotDeIds,
    isFirstDrugListSelection,
    isMedicineFormDataElement,
    isMedicineNameDataElement,
    isMedicineNamePlaceholderValue,
    isMedicineOtherDrugNameElement,
    isSpuriousSecondaryMedicineRow,
    highestMedicineSlotQualifyingForCap,
    slotQualifiesForMedicineUnlockCap,
    medicineNamesReferToSameDrug,
    medicineSlotsHaveIdenticalValues,
    slotHasUserMedicineName,
} from './medicineSlots'
import { trackerDataEntryValueIsPresent } from './trackerProgramRuleFieldUi'

function valueMatchesOption(value, opt) {
    const v = String(value ?? '').trim()
    if (!v || !opt) return false
    if (opt.code != null && String(opt.code) === v) return true
    if (opt.id != null && String(opt.id) === v) return true
    const name = String(opt.displayName || opt.name || '').trim()
    if (name && name === v) return true
    return false
}

function findSelectedOption(opts, value) {
    return opts.find((o) => valueMatchesOption(value, o))
}

/**
 * Format a form value for DHIS2 legacy `PUT /events/{id}` (Tracker Capture `formatDataValue` parity).
 */
export function formatEventDataValueForApi(value, de) {
    if (value == null) return null
    const vt = de?.valueType

    if (Array.isArray(value)) {
        const joined = joinMultiOptionValue(value.map((v) => String(v ?? '').trim()).filter(Boolean))
        return joined || null
    }

    if (vt === 'TRUE_ONLY') {
        if (value === true || value === 'true') return 'true'
        return null
    }
    if (vt === 'BOOLEAN') {
        if (value === true || value === 'true') return 'true'
        if (value === false || value === 'false') return 'false'
    }

    const s = String(value).trim()
    return s === '' ? null : s
}

/** Form value with fallback to persisted event dataValues (completed visit reload). */
export function resolveStageFieldFormValue(deId, formValues, eventDataValues) {
    const fromForm = formValues?.[deId]
    if (trackerDataEntryValueIsPresent(fromForm)) return fromForm
    const hit = (eventDataValues || []).find((dv) => dv?.dataElement === deId)
    return hit?.value ?? ''
}

/** Human-readable event field value for timelines and summaries (booleans, option sets). */
export function formatEventDataValueForDisplay(rawValue, de) {
    if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') {
        return ''
    }
    const s = String(rawValue)
    const vt = de?.valueType

    if (vt === 'BOOLEAN' || vt === 'TRUE_ONLY') {
        const lower = s.toLowerCase()
        if (lower === 'true') return i18n.t('Yes')
        if (lower === 'false') return i18n.t('No')
        return s
    }

    if (vt === 'FILE_RESOURCE' || vt === 'IMAGE') {
        return vt === 'IMAGE' ? i18n.t('Attached image') : i18n.t('Attached file')
    }

    if (vt === 'DATE' || /^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const parts = s.split('-')
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`
        }
    }

    const opts = de?.optionSet?.options
    if (Array.isArray(opts) && opts.length > 0) {
        if (s.includes(';')) {
            const labels = parseMultiOptionValue(s)
                .map((code) => {
                    const opt = findSelectedOption(opts, code)
                    return opt ? resolveStageOptionDisplayLabel(opt) : code
                })
                .filter(Boolean)
            if (labels.length) return labels.join('; ')
        }
        const selected = findSelectedOption(opts, s)
        if (selected) return resolveStageOptionDisplayLabel(selected)
    }

    return s
}

const NA_OPTION_RE = /^(na|n\/a|none|not applicable|មិន|គ្មាន|other|unknown)$/i

/** NA option code only — never the first drug/dose in the list (avoids Cefixime autofill on rows ២–៥). */
export function naOnlyOptionSetCode(de) {
    const opts = de?.optionSet?.options
    if (!opts?.length) return null
    const na = opts.find((o) =>
        NA_OPTION_RE.test(String(o.code || o.name || o.displayName || '').trim())
    )
    if (na?.code != null && String(na.code).trim() !== '') return String(na.code)
    return null
}

/**
 * Sentinel for compulsory DEs hidden by medicine slot / program rules (not shown in the form).
 * DHIS2 Maintenance may still mark them compulsory; tracker complete requires a value on the event.
 */
function firstOptionSetCode(de) {
    const na = naOnlyOptionSetCode(de)
    if (na != null) return na
    const opts = de?.optionSet?.options
    const code = opts?.[0]?.code
    return code != null && String(code).trim() !== '' ? String(code) : null
}

/** Placeholder for a hidden medicine-slot row (Maintenance compulsory, UI cap hides the row). */
export function placeholderValueForOmittedMedicineSlot(de) {
    if (!de) return null
    if (de.optionSet?.options?.length || isMedicineFormDataElement(de)) {
        return naOnlyOptionSetCode(de)
    }
    return null
}

/**
 * Row ២+ where complete/save filled the first drug in the list while row ១ has a different drug.
 * (Legacy payloads used firstOptionSetCode fallback → Cefixime + 1g + 1.)
 */
export function isLikelyAutofillMedicineRow(slot, slots, formValues, resolveDe) {
    if (!slot || slot.index <= 1 || typeof resolveDe !== 'function') return false
    const slot1 = findMedicineSlotByIndex(slots, 1)
    if (!slot1?.nameDeId) return false

    const primaryNameDe = resolveDe(slot1.nameDeId)
    const primaryName = formValues?.[slot1.nameDeId]
    if (!trackerDataEntryValueIsPresent(primaryName)) return false
    if (isMedicineNamePlaceholderValue(primaryNameDe, primaryName)) return false

    const nameDe = resolveDe(slot.nameDeId)
    const nameVal = formValues?.[slot.nameDeId]
    if (!trackerDataEntryValueIsPresent(nameVal)) return false
    if (isMedicineNamePlaceholderValue(nameDe, nameVal)) return true

    if (
        !isFirstDrugListSelection(nameDe, nameVal) ||
        medicineNamesReferToSameDrug(primaryName, nameVal, primaryNameDe, nameDe)
    ) {
        return false
    }

    for (const id of getMedicineSlotDeIds(slot)) {
        if (id === slot.nameDeId) continue
        const raw = formValues?.[id]
        if (!trackerDataEntryValueIsPresent(raw)) continue
        const fieldDe = resolveDe(id)
        const ph = placeholderValueForOmittedMedicineSlot(fieldDe)
        if (ph != null && String(raw) === String(ph)) continue
        if (
            fieldDe?.valueType === 'INTEGER_POSITIVE' &&
            String(raw).trim() === '1'
        ) {
            continue
        }
        if (fieldDe?.valueType === 'INTEGER' && String(raw).trim() === '0') {
            continue
        }
        return false
    }
    return true
}

export function placeholderValueForOmittedCompulsory(
    de,
    { allowRiskyOptionFallback = false, forComplete = false, omittedMedicineSlot = false } = {}
) {
    if (!de) return null
    if (omittedMedicineSlot) {
        return placeholderValueForOmittedMedicineSlot(de)
    }
    const vt = de.valueType

    /**
     * Never auto-pick the first drug in long medicine lists for hidden slots — that made
     * rows ២–៥ look “filled” after complete/save. Use NA-only or skip (Maintenance rules).
     */
    if (isMedicineNameDataElement(de) || isMedicineOtherDrugNameElement(de)) {
        if (de.optionSet?.options?.length) {
            const na = firstOptionSetCode(de)
            if (na != null) return na
        }
        return null
    }

    /** TRUE_ONLY accepts only `true` on the server — never auto-send false. */
    if (vt === 'TRUE_ONLY') return null
    if (vt === 'BOOLEAN') return 'false'
    if (vt === 'INTEGER_POSITIVE') return '1'
    if (vt === 'INTEGER_NEGATIVE') return '-1'
    if (vt === 'INTEGER' || vt === 'INTEGER_ZERO_OR_POSITIVE' || vt === 'NUMBER' || vt === 'PERCENTAGE') {
        return '0'
    }
    if (vt === 'UNIT_INTERVAL') return '0'

    if (de.optionSet?.options?.length) {
        if (forComplete || allowRiskyOptionFallback || de.optionSet.options.length <= 6) {
            return firstOptionSetCode(de)
        }
        return null
    }

    if (vt === 'TEXT' || vt === 'LONG_TEXT') return '-'

    return null
}

/** Section DE ids + every DE on the program stage (Maintenance compulsory may not appear in a section). */
export function collectStageDataElementIds({ sections = [], dataElements = [] }) {
    const ids = new Set()
    for (const section of sections) {
        for (const deId of section.dataElementIds || []) {
            if (deId) ids.add(deId)
        }
    }
    for (const de of dataElements) {
        if (de?.id) ids.add(de.id)
    }
    return [...ids]
}

function isCompulsoryStageDe(deId, mergeStageDe, mandatoryFieldIds) {
    const de = mergeStageDe?.(deId)
    if (!de) return Boolean(mandatoryFieldIds?.has?.(deId))
    return Boolean(de.compulsory) || Boolean(mandatoryFieldIds?.has?.(deId))
}

/**
 * Event payload: only DEs with a real value (Tracker Capture `reconstructEvent` parity).
 * When `fillOmittedCompulsory` is true, hidden compulsory medicine-slot DEs get a safe placeholder
 * so DHIS2 complete validation passes (Maintenance compulsory + UI slot cap).
 */
export function buildEventDataValuesPayload({
    formValues = {},
    existingDataValues = [],
    shouldOmitStageField = () => false,
    mergeStageDe,
    stageDataElementIds = [],
    mandatoryFieldIds,
    medicineDeToSlot,
    fillOmittedCompulsory = false,
}) {
    const merged = new Map()

    /**
     * Stage boundary set: when known, ALL paths (existingDataValues, formValues,
     * mandatoryFieldIds compulsory fill, medicine placeholders) are blocked from
     * inserting DEs that don't belong to this program stage.
     * This prevents cross-stage DEs (e.g. Q48tCCn9YFt from prevention/follow-up
     * stage appearing in STI clinical form oj7dKrmA8eg) from causing DHIS2
     * "DataElement is not part of program stage" errors on complete.
     */
    const stageDeIdSet = stageDataElementIds.length > 0 ? new Set(stageDataElementIds) : null

    const put = (deId, raw, { ignoreOmit = false } = {}) => {
        if (!deId) return
        // Hard stage boundary: never send a DE that doesn't belong to this stage
        if (stageDeIdSet && !stageDeIdSet.has(deId)) return
        if (!ignoreOmit && shouldOmitStageField(deId)) {
            return
        }
        const de = mergeStageDe?.(deId)
        const formatted = formatEventDataValueForApi(raw, de)
        if (!trackerDataEntryValueIsPresent(formatted)) return
        if (de?.valueType === 'TRUE_ONLY' && formatted === 'false') return
        merged.set(deId, formatted)
    }

    for (const dv of existingDataValues) {
        const deId = dv?.dataElement
        if (!deId) continue
        if (shouldOmitStageField(deId)) {
            if (!fillOmittedCompulsory) continue
            /** Do not re-apply old autofill (e.g. Cefixime on rows ២–៥) from the server. */
            if (medicineDeToSlot?.has?.(deId)) continue
        }
        put(deId, dv?.value)
    }

    if (stageDataElementIds.length > 0) {
        for (const deId of stageDataElementIds) {
            put(deId, formValues[deId] ?? merged.get(deId))
        }
    } else {
        for (const [deId, raw] of Object.entries(formValues)) {
            put(deId, raw)
        }
    }

    const tryFillMissingCompulsory = (deId) => {
        const de = mergeStageDe?.(deId)
        if (de?.valueType === 'TRUE_ONLY') return
        if (trackerDataEntryValueIsPresent(merged.get(deId))) return
        const fromForm = formatEventDataValueForApi(formValues[deId], de)
        if (trackerDataEntryValueIsPresent(fromForm)) {
            merged.set(deId, fromForm)
            return
        }
        const ph =
            placeholderValueForOmittedCompulsory(de, {
                allowRiskyOptionFallback: true,
                forComplete: true,
                omittedMedicineSlot: Boolean(medicineDeToSlot?.has?.(deId)),
            }) ??
            (mandatoryFieldIds?.has?.(deId) ? '-' : null)
        if (ph != null) put(deId, ph, { ignoreOmit: true })
    }

    if (fillOmittedCompulsory) {
        const idsForComplete = new Set(stageDataElementIds || [])
        if (mandatoryFieldIds) {
            for (const id of mandatoryFieldIds) idsForComplete.add(id)
        }
        for (const deId of idsForComplete) {
            const compulsory = isCompulsoryStageDe(deId, mergeStageDe, mandatoryFieldIds)
            const omitted = shouldOmitStageField(deId)
            const ruleMandatory = Boolean(mandatoryFieldIds?.has?.(deId))
            if (!compulsory && !omitted && !ruleMandatory) continue
            tryFillMissingCompulsory(deId)
        }
    }

    /** Hidden medicine rows: compulsory → NA-safe placeholders; optional → clear duplicate values. */
    const idsToProcess =
        stageDataElementIds.length > 0 ? stageDataElementIds : [...merged.keys()]
    for (const deId of idsToProcess) {
        if (!shouldOmitStageField(deId)) continue
        const de = mergeStageDe?.(deId)
        const compulsory =
            isCompulsoryStageDe(deId, mergeStageDe, mandatoryFieldIds) ||
            Boolean(mandatoryFieldIds?.has?.(deId))

        if (compulsory) {
            const ph = medicineDeToSlot?.has?.(deId)
                ? placeholderValueForOmittedMedicineSlot(de)
                : placeholderValueForOmittedCompulsory(de, {
                      allowRiskyOptionFallback: true,
                      forComplete: true,
                  })
            if (ph != null) {
                merged.set(deId, ph)
            } else if (medicineDeToSlot?.has?.(deId)) {
                merged.set(deId, '')
            }
            continue
        }

        const hadValue =
            trackerDataEntryValueIsPresent(merged.get(deId)) ||
            trackerDataEntryValueIsPresent(formValues[deId])
        if (hadValue) merged.set(deId, '')
    }

    return Array.from(merged.entries()).map(([dataElement, value]) => ({
        dataElement,
        value,
    }))
}

/**
 * Values for program-rule evaluation when completing: hidden compulsory / rule-mandatory
 * fields get the same NA-safe placeholders as the tracker API payload (rows ២–៥, etc.).
 */
export function augmentFormValuesForOmittedCompulsory(
    formValues,
    {
        shouldOmitStageField,
        mergeStageDe,
        stageDataElementIds = [],
        mandatoryFieldIds,
        medicineDeToSlot,
    }
) {
    const next = { ...(formValues || {}) }
    const idSet = new Set(stageDataElementIds || [])
    if (mandatoryFieldIds) {
        for (const id of mandatoryFieldIds) idSet.add(id)
    }

    for (const deId of idSet) {
        if (!shouldOmitStageField(deId)) continue
        const compulsory =
            isCompulsoryStageDe(deId, mergeStageDe, mandatoryFieldIds) ||
            Boolean(mandatoryFieldIds?.has?.(deId))
        if (!compulsory) continue
        if (trackerDataEntryValueIsPresent(next[deId])) continue

        const de = mergeStageDe?.(deId)
        const ph = medicineDeToSlot?.has?.(deId)
            ? placeholderValueForOmittedMedicineSlot(de)
            : placeholderValueForOmittedCompulsory(de, {
                  allowRiskyOptionFallback: true,
                  forComplete: true,
              })
        if (ph != null) {
            next[deId] = ph
        } else if (medicineDeToSlot?.has?.(deId)) {
            next[deId] = ''
        }
    }

    return next
}

/** Slot filled only with complete/save placeholders (no real drug row). */
export function medicineSlotIsOnlyAutoPlaceholders(slot, formValues, resolveDe) {
    if (!slot || typeof resolveDe !== 'function') return false

    const nameDe = resolveDe(slot.nameDeId)
    const nameVal = formValues?.[slot.nameDeId]
    if (!trackerDataEntryValueIsPresent(nameVal)) return false

    /** Any real drug name (not NA) is user data — never strip on load/save sanitize. */
    if (!isMedicineNamePlaceholderValue(nameDe, nameVal)) return false

    let hasAny = false
    for (const id of getMedicineSlotDeIds(slot)) {
        const raw = formValues?.[id]
        if (!trackerDataEntryValueIsPresent(raw)) continue
        hasAny = true
        const de = resolveDe(id)
        if (!de) return false

        if (isMedicineNameDataElement(de)) {
            if (isMedicineNamePlaceholderValue(de, raw)) continue
            return false
        }

        const ph = placeholderValueForOmittedMedicineSlot(de)
        if (ph == null || String(raw) !== String(ph)) return false
    }
    return hasAny
}

/**
 * Drop auto-filled medicine rows ២–៥ from loaded/saved events so UI matches one real drug.
 */
export function sanitizeMedicineSlotFormValues(
    slots,
    formValues,
    resolveDe,
    { serverSnapshot = null } = {}
) {
    if (!slots?.length || !formValues) return formValues
    const next = { ...formValues }

    const preserveSlotIndexes = new Set()
    if (serverSnapshot && typeof resolveDe === 'function') {
        for (const slot of slots) {
            if (slotQualifiesForMedicineUnlockCap(slot, slots, serverSnapshot, resolveDe)) {
                preserveSlotIndexes.add(slot.index)
            }
        }
    }

    const slot1 = findMedicineSlotByIndex(slots, 1)
    if (slot1) {
        for (const slot of slots) {
            if (slot.index <= 1) continue
            if (preserveSlotIndexes.has(slot.index)) continue
            if (
                medicineSlotsHaveIdenticalValues(slot, slot1, next) ||
                isSpuriousSecondaryMedicineRow(slot, slots, next, resolveDe) ||
                isLikelyAutofillMedicineRow(slot, slots, next, resolveDe)
            ) {
                for (const id of getMedicineSlotDeIds(slot)) delete next[id]
            }
        }
    }

    for (const slot of slots) {
        if (preserveSlotIndexes.has(slot.index)) continue
        if (medicineSlotIsOnlyAutoPlaceholders(slot, next, resolveDe)) {
            for (const id of getMedicineSlotDeIds(slot)) delete next[id]
            continue
        }
        if (isSpuriousSecondaryMedicineRow(slot, slots, next, resolveDe)) {
            for (const id of getMedicineSlotDeIds(slot)) delete next[id]
            continue
        }
        if (isLikelyAutofillMedicineRow(slot, slots, next, resolveDe)) {
            for (const id of getMedicineSlotDeIds(slot)) delete next[id]
        }
    }

    let keepThrough = highestMedicineSlotQualifyingForCap(slots, next, resolveDe)
    if (serverSnapshot && typeof resolveDe === 'function') {
        keepThrough = Math.max(
            keepThrough,
            highestMedicineSlotQualifyingForCap(slots, serverSnapshot, resolveDe)
        )
    }

    for (const slot of slots) {
        if (slot.index <= keepThrough || preserveSlotIndexes.has(slot.index)) continue
        for (const id of getMedicineSlotDeIds(slot)) delete next[id]
    }

    if (serverSnapshot && typeof resolveDe === 'function') {
        for (const slot of slots) {
            if (!preserveSlotIndexes.has(slot.index) && slot.index > keepThrough) continue
            for (const id of getMedicineSlotDeIds(slot)) {
                const serverVal = serverSnapshot[id]
                if (trackerDataEntryValueIsPresent(serverVal)) {
                    next[id] = serverVal
                }
            }
        }
    }

    return next
}
