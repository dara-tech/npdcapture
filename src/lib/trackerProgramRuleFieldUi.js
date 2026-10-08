import { resolveStiPatientSex, STI_SEX_ATTRIBUTE_DEFAULT_ID } from './stiSexFormGating'

/**
 * Parity with Tracker Capture data entry `isHidden` (dataentry-controller.js) and
 * default-form.html `ng-if="!isHidden(...)"`: when the event already has a value for the DE,
 * the row stays visible even if HIDEFIELD is active (e.g. SCHEDULE/SKIPPED where values are not cleared).
 */
export function trackerDataEntryValueIsPresent(raw) {
    if (raw === false || raw === 0) return true
    if (raw == null) return false
    if (typeof raw === 'string' && raw.trim() === '') return false
    return true
}

/**
 * @param {Set<string>|null|undefined} hiddenFieldsSet
 * @param {string|null} [valueType] - DATE fields hide when ruled hidden (follow-up date parity).
 */
export function shouldOmitStageDataElementRow(hiddenFieldsSet, deId, rawValue, valueType = null) {
    if (!hiddenFieldsSet?.has?.(deId)) return false
    if (valueType === 'DATE') return true
    if (trackerDataEntryValueIsPresent(rawValue)) return false
    return true
}

const GATE_YES_TEXT = /^(true|yes|y|1|បាទ|ចាស|មាន|checked|បាទ\/ចាស)$/i

/** Yes answer for BOOLEAN / TRUE_ONLY / binary option-set section gate. */
export function isYesLikeGateAnswer(raw, gateDeMeta = null) {
    if (raw === true) return true
    const s = String(raw ?? '').trim()
    if (!s) return false
    if (GATE_YES_TEXT.test(s) || GATE_YES_TEXT.test(s.toLowerCase())) return true
    if (gateDeMeta?.optionSet?.options?.length) {
        const opts = gateDeMeta.optionSet.options
        const byHint = opts.find((o) =>
            GATE_YES_TEXT.test(String(o.name || o.displayName || o.code || '').trim())
        )
        const yesOpt = byHint || opts[0]
        if (yesOpt) {
            const v = s
            if (yesOpt.code != null && String(yesOpt.code) === v) return true
            if (yesOpt.id != null && String(yesOpt.id) === v) return true
        }
    }
    return false
}

/** Section header gate is “on” (body fields should show). */
export function isSectionGateOpen(gateDeMeta, gateValue) {
    if (!gateDeMeta) return true
    return isYesLikeGateAnswer(gateValue, gateDeMeta)
}

/** STI program: sex attribute values that trigger male-only HIDEFIELD rules. */
export function isStiPatientMale(
    formValues,
    sexAttributeId = STI_SEX_ATTRIBUTE_DEFAULT_ID,
    sexAttributeMeta = null
) {
    return resolveStiPatientSex(formValues, { sexAttributeId, sexAttributeMeta }) === 'male'
}

export function isStiPatientFemale(
    formValues,
    sexAttributeId = STI_SEX_ATTRIBUTE_DEFAULT_ID,
    sexAttributeMeta = null
) {
    return resolveStiPatientSex(formValues, { sexAttributeId, sexAttributeMeta }) === 'female'
}

/** Smear section ៦: hidden by STI Sex is Female rule when patient is female. */
export const STI_SMEAR_DE_HIDDEN_WHEN_FEMALE = new Set([
    'nX52Ui5ZLuy',
    'aMKzf9AMKs2',
    'PcVXPDzmLdo',
])

/** Smear section ៦: hidden by STI Sex is Male rule when patient is male. */
export const STI_SMEAR_DE_HIDDEN_WHEN_MALE = new Set(['PUMhXOXw32o', 'rDZsCdgQFpJ'])

/** Lab section ៨ gate: Other tested? (first DE in “other tests” section). */
export const STI_OTHER_TESTED_GATE_DE_ID = 'euWIj6VZTOg'

/** Types of tests performed (NAAT / PCR / Rapid Test). */
export const STI_OTHER_TEST_TYPES_DE_ID = 'vtLwSM4FoJK'

/**
 * Site-specific result dropdowns (STI_Other test_Oral / _Urethral / … rules).
 * Must stay rule-driven when the section gate is Yes — gate only unlocks site rows,
 * not every `-- Result-*` field at once.
 */
export const STI_OTHER_TEST_LAB_RESULT_DE_IDS = new Set([
    'lifuh6j6sed',
    'tlJvr2lhHcq',
    'L3E85hjukhx',
    'FIdNZevhUcY',
    'jaCaPgnwHvf',
    'lIYs1FG6ziE',
    'maBGFzXxkkH',
    'CXU86ft7cFh',
    'VzoOMe0EvOv',
    'MastKZwsgEr',
    'wHUqXhoxNhR',
    'DU6rOwgOvJK',
    'h7GwfLULmNT',
    'dsZm5tREhHw',
    'ZTzqQK9hR1Q',
    'SnrRWzWzBHE',
])

/** Site checkbox → result fields (STI “other tests” section, from program rules). */
export const STI_OTHER_TEST_SITE_CHILDREN_BY_GATE = {
    BtXZgruB3hO: ['VzoOMe0EvOv', 'DU6rOwgOvJK', 'MastKZwsgEr', 'wHUqXhoxNhR'],
    XfWS76Up07B: ['lifuh6j6sed', 'tlJvr2lhHcq', 'FIdNZevhUcY', 'L3E85hjukhx'],
    NayamnG4Q1P: ['maBGFzXxkkH', 'lIYs1FG6ziE', 'CXU86ft7cFh', 'jaCaPgnwHvf'],
    DY5lhiNfJ0M: ['nX52Ui5ZLuy', 'aMKzf9AMKs2', 'PcVXPDzmLdo', 'rDZsCdgQFpJ'],
}

const GATE_EMPTY_CONDITION = /#\{([^}]+)\}\s*==\s*(?:''|false)\b/

/**
 * Map gate DE id → child DE ids from rules like `#{STI_Other test_Oral} ==''` → HIDEFIELD children.
 */
export function buildGateToDependentFieldsMap(rules, ruleVariables) {
    const varToDe = new Map()
    for (const v of ruleVariables || []) {
        const deId = v?.dataElement?.id
        if (deId && v?.name) varToDe.set(String(v.name).trim(), String(deId))
    }

    const gateToChildren = { ...STI_OTHER_TEST_SITE_CHILDREN_BY_GATE }

    for (const rule of rules || []) {
        const cond = String(rule?.condition || '')
        const m = cond.match(GATE_EMPTY_CONDITION)
        if (!m) continue
        const gateDeId = varToDe.get(m[1].trim())
        if (!gateDeId) continue

        const children = []
        for (const action of rule.programRuleActions || []) {
            if (action?.programRuleActionType !== 'HIDEFIELD') continue
            const childId = action?.dataElement?.id
            if (childId) children.push(String(childId))
        }
        if (children.length) gateToChildren[gateDeId] = children
    }

    return gateToChildren
}

/**
 * Keep each site’s dependent fields directly under its gate row (Capture parity).
 */
export function reorderBodyFieldsAfterGateChildren(bodyFields, gateToChildren = {}) {
    if (!bodyFields?.length) return bodyFields || []

    const gates = gateToChildren && typeof gateToChildren === 'object' ? gateToChildren : {}
    const gateKeys = Object.keys(gates)
    if (!gateKeys.length) return bodyFields

    const byId = new Map(bodyFields.map((de) => [de.id, de]))
    const childIds = new Set()
    for (const ids of Object.values(gates)) {
        for (const id of ids || []) childIds.add(id)
    }

    const ordered = []
    const placed = new Set()

    for (const de of bodyFields) {
        if (!de?.id || placed.has(de.id)) continue
        if (childIds.has(de.id)) continue

        ordered.push(de)
        placed.add(de.id)

        const kids = gates[de.id]
        if (!kids?.length) continue
        for (const kidId of kids) {
            const kid = byId.get(kidId)
            if (kid && !placed.has(kidId)) {
                ordered.push(kid)
                placed.add(kidId)
            }
        }
    }

    for (const de of bodyFields) {
        if (de?.id && !placed.has(de.id)) {
            ordered.push(de)
            placed.add(de.id)
        }
    }

    return ordered
}

/**
 * When legacy + @dhis2/rule-engine both apply sex HIDEFIELD lists, all five smear DEs can
 * stay hidden. Show the fields that belong to the current sex (Core Capture parity).
 */
export function shouldOmitStiSexGatedLabField(
    hiddenFieldsSet,
    deId,
    rawValue,
    { isMale, isFemale, valueType = null } = {}
) {
    const ruleOmit = shouldOmitStageDataElementRow(hiddenFieldsSet, deId, rawValue, valueType)
    if (!ruleOmit) return false

    if (!isMale && !isFemale) return ruleOmit

    if (isFemale && STI_SMEAR_DE_HIDDEN_WHEN_MALE.has(deId)) return false
    if (isMale && STI_SMEAR_DE_HIDDEN_WHEN_FEMALE.has(deId)) return false

    return ruleOmit
}

/**
 * Tracker Capture: when a section gate (first BOOLEAN / TRUE_ONLY) is Yes, body fields are shown
 * unless HIDEFIELD still applies from an independent rule (partner HIV, sex-based, lab site, etc.).
 * Gate-closed blanket hides are cleared when the rule engine re-evaluates on gate Yes; do not
 * force-show every ruled-hidden body field while the gate is open.
 */
export function shouldOmitStageFieldAfterBooleanGate({
    hiddenFieldsSet,
    deId,
    rawValue,
    gateDeId,
    gateDeMeta,
    gateValue,
    sectionDeIds,
    isPatientMale = false,
    maleOnlyHiddenDeIds = null,
    deValueType = null,
}) {
    const ruleOmit = shouldOmitStageDataElementRow(
        hiddenFieldsSet,
        deId,
        rawValue,
        deValueType
    )
    if (!ruleOmit) return false

    if (!gateDeId || !gateDeMeta || !sectionDeIds?.length) return true
    const gateIdx = sectionDeIds.indexOf(gateDeId)
    const deIdx = sectionDeIds.indexOf(deId)
    if (deIdx <= gateIdx || deId === gateDeId) return true
    if (!isSectionGateOpen(gateDeMeta, gateValue)) return true

    if (isPatientMale && maleOnlyHiddenDeIds?.has?.(deId)) return true

    if (
        gateDeId === STI_OTHER_TESTED_GATE_DE_ID &&
        STI_OTHER_TEST_LAB_RESULT_DE_IDS.has(deId) &&
        ruleOmit
    ) {
        return true
    }

    return ruleOmit
}
