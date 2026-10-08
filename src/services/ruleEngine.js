/**
 * Client-side DHIS2-style program rules (**subset** of Maintenance / dhis2-core
 * {@link https://github.com/dhis2/dhis2-core/blob/master/dhis-2/dhis-api/src/main/java/org/hisp/dhis/programrule/ProgramRuleActionType.java ProgramRuleActionType}).
 *
 * **Actions implemented here:** HIDEFIELD, HIDESECTION, HIDEPROGRAMSTAGE, SETMANDATORYFIELD, ASSIGN
 * (incl. ASSIGN_VALUE alias), SHOWWARNING, WARNINGONCOMPLETE, SHOWERROR, ERRORONCOMPLETE, HIDEOPTION.
 *
 * **Actions in Maintenance but ignored in this client:** DISPLAYTEXT, DISPLAYKEYVALUEPAIR, SCHEDULEEVENT,
 * CREATEEVENT, SENDMESSAGE, SCHEDULEMESSAGE, SHOWOPTIONGROUP, HIDEOPTIONGROUP (server-side or not wired).
 *
 * **Conditions:** `#{programRuleVariable}`, `V{uid-or-name}`, `A{uid-or-name}` (tracker-style names e.g.
 * `A{STI_Attribute_Sex}`); `d2:hasValue`, `d2:matches`, `d2:daysBetween`, and logical AND/OR/NOT
 * are preprocessed for JS eval.
 *
 * **Variables (legacy map):** TEI_ATTRIBUTE, DATAELEMENT_CURRENT_EVENT (implicit), NEWEST/PREVIOUS program
 * and program-stage DE variables. CALCULATED_VALUE variables are skipped in the legacy `#{name}` map
 * (merged `@dhis2/rule-engine` path may still evaluate them when enrollment+TEI context exists).
 *
 * Stage scoping follows ProgramRule#programStage and per-action programStage / section ownership.
 */

import { tryEvaluateRulesWithDhis2 } from './dhis2RuleEngineRunner'
import { sexToUuicDigit } from '../lib/uuic'

const normalizeProgramRuleActionType = (raw) => {
    let t = String(raw ?? '')
        .trim()
        .toUpperCase()
        .replace(/-/g, '_')
    if (t === 'HIDE_FIELD') return 'HIDEFIELD'
    if (t === 'HIDE_SECTION') return 'HIDESECTION'
    if (t === 'HIDE_PROGRAM_STAGE') return 'HIDEPROGRAMSTAGE'
    if (t === 'SET_MANDATORY_FIELD') return 'SETMANDATORYFIELD'
    if (t === 'MANDATORYFIELD') return 'SETMANDATORYFIELD'
    if (t === 'SHOW_WARNING') return 'SHOWWARNING'
    if (t === 'SHOW_ERROR') return 'SHOWERROR'
    if (t === 'WARNING_ON_COMPLETE') return 'WARNINGONCOMPLETE'
    if (t === 'ERROR_ON_COMPLETE') return 'ERRORONCOMPLETE'
    if (t === 'HIDE_OPTION') return 'HIDEOPTION'
    if (t === 'ASSIGN_VALUE') return 'ASSIGN'
    return t
}

/** API may return `{ id }` or a plain uid string on nested refs. */
const idFromMetadataRef = (ref) => {
    if (ref == null) return null
    if (typeof ref === 'string') return ref
    if (typeof ref === 'object' && ref.id) return String(ref.id)
    return null
}

/** Maintenance often stores target field uid only on `programRuleAction.data`. */
const fieldIdsFromProgramRuleAction = (action, typeMeta) => {
    let teaId = idFromMetadataRef(action?.trackedEntityAttribute)
    let deId = idFromMetadataRef(action?.dataElement)
    const dataId =
        action?.data != null && String(action.data).trim() !== ''
            ? String(action.data).trim()
            : null
    if (!deId && !teaId && dataId && typeMeta) {
        if (typeMeta.dataElements?.[dataId]) deId = dataId
        else if (typeMeta.attributes?.some((a) => a.id === dataId)) teaId = dataId
    }
    return { teaId, deId }
}

/** Tracker Capture IndexedDB / older payloads sometimes use flat `programStageId` instead of `programStage.id`. */
const programStageRefId = (entity) => {
    if (!entity || typeof entity !== 'object') return null
    const flat = entity.programStageId
    if (flat != null && flat !== '') return String(flat)
    return idFromMetadataRef(entity.programStage)
}

const parseDateToUtc = (s) => {
    if (!s || typeof s !== 'string') return null
    const t = s.trim().split('T')[0]
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
    if (!m) return null
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** Web API often returns Java-style names (`DATA_ELEMENT_*`); our logic uses `DATAELEMENT_*`. */
const canonicalizeProgramRuleVariableSourceType = (raw) => {
    if (raw == null || raw === '') return ''
    let s = String(raw).trim().replace(/-/g, '_')
    s = s.replace(/TRACKED_ENTITY_ATTRIBUTE/gi, 'TEI_ATTRIBUTE')
    s = s.replace(/DATA_ELEMENT/gi, 'DATAELEMENT')
    return s
}

/** Aligns with {@link https://github.com/dhis2/dhis2-core/blob/master/dhis-2/dhis-api/src/main/java/org/hisp/dhis/programrule/ProgramRuleVariableSourceType.java ProgramRuleVariableSourceType} (JSON may use enum name or snake_case value). */
const normalizeProgramRuleVariableSourceType = (raw) => {
    if (raw == null || raw === '') return null
    const canonical = canonicalizeProgramRuleVariableSourceType(raw)
    const key = canonical.toLowerCase()
    const fromSnake = {
        dataelement_newest_event_program_stage: 'DATAELEMENT_NEWEST_EVENT_PROGRAM_STAGE',
        dataelement_newest_event_program: 'DATAELEMENT_NEWEST_EVENT_PROGRAM',
        dataelement_current_event: 'DATAELEMENT_CURRENT_EVENT',
        dataelement_previous_event: 'DATAELEMENT_PREVIOUS_EVENT',
        calculated_value: 'CALCULATED_VALUE',
        tei_attribute: 'TEI_ATTRIBUTE',
    }[key]
    if (fromSnake) return fromSnake
    const up = canonical.toUpperCase()
    if (
        [
            'DATAELEMENT_NEWEST_EVENT_PROGRAM_STAGE',
            'DATAELEMENT_NEWEST_EVENT_PROGRAM',
            'DATAELEMENT_CURRENT_EVENT',
            'DATAELEMENT_PREVIOUS_EVENT',
            'CALCULATED_VALUE',
            'TEI_ATTRIBUTE',
        ].includes(up)
    ) {
        return up
    }
    return null
}

const deFromEventDataValues = (event, deId) => {
    const hit = event?.dataValues?.find((d) => d.dataElement === deId)
    return hit === undefined ? undefined : hit.value
}

const getDeRawFromTimeline = (event, deId, formValues, currentEventId) => {
    if (currentEventId && event?.event === currentEventId) {
        if (formValues && Object.prototype.hasOwnProperty.call(formValues, deId)) {
            return formValues[deId]
        }
    }
    return deFromEventDataValues(event, deId)
}

const eventSortKey = (e) => {
    const day = String(e?.eventDate || e?.occurredAt || e?.scheduledDate || '').split('T')[0]
    const utc = parseDateToUtc(day) ?? 0
    const bump = String(e?.updatedAt || e?.createdAt || e?.created || e?.lastUpdated || '')
    const bumpMs = bump && !Number.isNaN(Date.parse(bump)) ? Date.parse(bump) : 0
    return { utc, bumpMs, id: String(e?.event || '') }
}

const compareEventsNewestFirst = (a, b) => {
    const ta = eventSortKey(a)
    const tb = eventSortKey(b)
    if (tb.utc !== ta.utc) return tb.utc - ta.utc
    if (tb.bumpMs !== ta.bumpMs) return tb.bumpMs - ta.bumpMs
    return tb.id.localeCompare(ta.id)
}

const resolveRawForVariable = (v, formValues, ruleVarContext) => {
    const teaId = idFromMetadataRef(v.trackedEntityAttribute)
    const deId = idFromMetadataRef(v.dataElement)
    const st = normalizeProgramRuleVariableSourceType(v.programRuleVariableSourceType)

    const effectiveType = (() => {
        if (st) return st
        if (teaId) return 'TEI_ATTRIBUTE'
        if (deId) return 'DATAELEMENT_CURRENT_EVENT'
        return null
    })()

    if (!effectiveType || effectiveType === 'CALCULATED_VALUE') return undefined

    if (effectiveType === 'TEI_ATTRIBUTE') {
        if (!teaId) return undefined
        return formValues[teaId]
    }

    if (effectiveType === 'DATAELEMENT_CURRENT_EVENT') {
        if (!deId) return undefined
        return formValues[deId]
    }

    if (!deId) return undefined

    const events = ruleVarContext?.enrollmentEvents || []
    const currentEventId = ruleVarContext?.currentEventId || null
    const currentProgramStageId = ruleVarContext?.currentProgramStageId || null
    const draftEvent =
        Boolean(ruleVarContext?.evaluatingDraftEvent) && !currentEventId && formValues && typeof formValues === 'object'

    if (effectiveType === 'DATAELEMENT_NEWEST_EVENT_PROGRAM') {
        if (draftEvent && Object.prototype.hasOwnProperty.call(formValues, deId)) {
            return formValues[deId]
        }
        const list = [...events].sort(compareEventsNewestFirst)
        for (const ev of list) {
            const raw = getDeRawFromTimeline(ev, deId, formValues, currentEventId)
            if (raw !== undefined && raw !== null && String(raw).trim() !== '') return raw
        }
        return formValues[deId]
    }

    if (effectiveType === 'DATAELEMENT_NEWEST_EVENT_PROGRAM_STAGE') {
        const stageFilter = programStageRefId(v) || currentProgramStageId
        const draftApplies =
            draftEvent &&
            (!stageFilter || !currentProgramStageId || stageFilter === currentProgramStageId)
        if (draftApplies && Object.prototype.hasOwnProperty.call(formValues, deId)) {
            return formValues[deId]
        }
        const list = [...events]
            .filter((ev) => !stageFilter || ev.programStage === stageFilter)
            .sort(compareEventsNewestFirst)
        for (const ev of list) {
            const raw = getDeRawFromTimeline(ev, deId, formValues, currentEventId)
            if (raw !== undefined && raw !== null && String(raw).trim() !== '') return raw
        }
        return formValues[deId]
    }

    if (effectiveType === 'DATAELEMENT_PREVIOUS_EVENT') {
        const stageFilter = currentProgramStageId
        let list = [...events]
        if (stageFilter) list = list.filter((ev) => ev.programStage === stageFilter)
        list.sort((a, b) => -compareEventsNewestFirst(a, b))
        if (!currentEventId) {
            const last = list[list.length - 1]
            return last ? getDeRawFromTimeline(last, deId, formValues, null) : undefined
        }
        const idx = list.findIndex((ev) => ev.event === currentEventId)
        if (idx <= 0) return undefined
        return getDeRawFromTimeline(list[idx - 1], deId, formValues, null)
    }

    return undefined
}

/**
 * Map stored option id/code to the string DHIS2 uses in #{variable} comparisons (Capture parity).
 * @see https://github.com/dhis2/dhis2-core/blob/master/dhis-2/dhis-api/src/main/java/org/hisp/dhis/programrule/ProgramRuleVariable.java useCodeForOptionSet
 */
const resolveOptionValueForRuleVariable = (raw, variable, teaId, deId, typeMeta, valueType) => {
    if (raw === undefined || raw === null) return raw
    if (valueType === 'BOOLEAN' || valueType === 'TRUE_ONLY') return raw
    const s = String(raw).trim()
    if (s === '') return raw

    let options = null
    if (teaId && typeMeta?.attributes) {
        const a = typeMeta.attributes.find((x) => x.id === teaId)
        options = a?.optionSet?.options
    }
    if ((!options || !options.length) && deId && typeMeta?.dataElements?.[deId]) {
        options = typeMeta.dataElements[deId].optionSet?.options
    }
    if (!options?.length) return raw

    const opt = options.find(
        (o) =>
            String(o.id) === s ||
            String(o.code ?? '') === s ||
            String(o.name ?? '') === s ||
            String(o.displayName ?? '') === s
    )
    if (!opt) return raw

    const useCode = Boolean(variable?.useCodeForOptionSet)
    const code = opt.code != null && String(opt.code).trim() !== '' ? String(opt.code).trim() : null
    if (useCode || code) return String(code ?? opt.id ?? s)
    return String(opt.name ?? opt.displayName ?? opt.code ?? opt.id ?? s)
}

/** BOOLEAN / TRUE_ONLY handling shared by #{var} map and V{uid}/A{uid} substitution. */
const normalizeBooleanishForRules = (raw, valueType) => {
    if (valueType === 'TRUE_ONLY') {
        if (raw === undefined || raw === null) return null
        const s = String(raw).trim()
        if (s === '') return null
        const sl = s.toLowerCase()
        if (sl === 'true' || sl === '1' || sl === 'yes' || sl === 'y') return true
        return null
    }
    if (valueType !== 'BOOLEAN') return null
    if (raw === undefined || raw === null) return null
    const s = String(raw).trim()
    if (s === '') return null
    const sl = s.toLowerCase()
    if (sl === 'true' || sl === '1' || sl === 'yes' || sl === 'y') return true
    if (sl === 'false' || sl === '0' || sl === 'no' || sl === 'n') return false
    return null
}

const useCodePreferenceForFieldUid = (ruleVariables, uid) => {
    for (const v of ruleVariables || []) {
        if (idFromMetadataRef(v.trackedEntityAttribute) === uid || idFromMetadataRef(v.dataElement) === uid) {
            return Boolean(v.useCodeForOptionSet)
        }
    }
    return false
}

const DHIS2_UID_RE = /^[a-zA-Z]{11}$/

const teaDeAndValueTypeForUid = (typeMeta, uid) => {
    const attrList = typeMeta?.attributes
    if (attrList && uid) {
        const a = attrList.find((x) => x.id === uid)
        if (a) return { teaId: uid, deId: null, valueType: a.valueType || null }
    }
    const de = typeMeta?.dataElements?.[uid]
    if (de) return { teaId: null, deId: uid, valueType: de.valueType || null }
    return { teaId: null, deId: null, valueType: null }
}

const registerFieldLookupKey = (map, key, entry) => {
    const k = key != null ? String(key).trim() : ''
    if (!k || map.has(k)) return
    map.set(k, entry)
}

/**
 * Maps Maintenance `A{name}` / `V{name}` to field uid (tracker_npd parity).
 * Includes program rule variable names (e.g. `A{STI_Attribute_Sex}` → TEA `Sex of Birth`).
 */
const buildFieldUidLookup = (typeMeta, ruleVariables = null) => {
    const map = new Map()
    const attrList = typeMeta?.attributes
    const deMap = typeMeta?.dataElements || {}

    const valueTypeForTea = (teaId) => {
        if (!attrList || !teaId) return null
        const a = attrList.find((x) => x.id === teaId)
        return a?.valueType || null
    }

    if (typeMeta) {
        for (const a of attrList || []) {
            if (!a?.id) continue
            const entry = { uid: a.id, teaId: a.id, deId: null, valueType: a.valueType || null }
            registerFieldLookupKey(map, a.id, entry)
            registerFieldLookupKey(map, a.systemName, entry)
            registerFieldLookupKey(map, a.name, entry)
            registerFieldLookupKey(map, a.shortName, entry)
        }
        for (const [id, de] of Object.entries(deMap)) {
            if (!id) continue
            const entry = { uid: id, teaId: null, deId: id, valueType: de?.valueType || null }
            registerFieldLookupKey(map, id, entry)
            registerFieldLookupKey(map, de.systemName, entry)
            registerFieldLookupKey(map, de.name, entry)
            registerFieldLookupKey(map, de.displayName, entry)
            registerFieldLookupKey(map, de.shortName, entry)
            for (const opt of de.optionSet?.options || []) {
                registerFieldLookupKey(map, opt.systemName, entry)
                registerFieldLookupKey(map, opt.code, entry)
            }
        }
    }

    for (const v of ruleVariables || []) {
        if (!v) continue
        const teaId = idFromMetadataRef(v.trackedEntityAttribute)
        const deId = idFromMetadataRef(v.dataElement)
        if (!teaId && !deId) continue
        const uid = teaId || deId
        const vt =
            v.valueType ||
            (teaId ? valueTypeForTea(teaId) : null) ||
            (deId ? deMap[deId]?.valueType : null) ||
            null
        const entry = teaId
            ? { uid, teaId, deId: null, valueType: vt }
            : { uid, teaId: null, deId, valueType: vt }
        registerFieldLookupKey(map, v.name, entry)
        registerFieldLookupKey(map, v.displayName, entry)
    }

    return map
}

const effectiveEventStatusForRules = (ruleVarContext) => {
    const st = ruleVarContext?.eventStatusOverride ?? ruleVarContext?.snapshotEventStatus ?? null
    if (st == null || String(st).trim() === '') return null
    return String(st).trim().toUpperCase()
}

const resolveFieldFromIdentifier = (identifier, typeMeta, lookup, ruleVarContext = null) => {
    const key = String(identifier || '').trim()
    if (!key) return null
    if (key.toLowerCase() === 'event_status') {
        const st = effectiveEventStatusForRules(ruleVarContext)
        if (!st) return null
        return { uid: 'event_status', teaId: null, deId: null, valueType: 'TEXT', eventStatus: st }
    }
    if (DHIS2_UID_RE.test(key)) {
        const m = teaDeAndValueTypeForUid(typeMeta, key)
        return { uid: key, ...m }
    }
    const hit = lookup?.get(key)
    if (hit) return hit
    return null
}

/** JS literal for empty/missing values in rule conditions (`#{x} == ''`, `V{x} == ''`). */
const conditionLiteralForEmptyValue = () => "''"

const SEX_ATTR_RULE_HINT = /ភេទ|^sex\b|gender|sex at birth|sex of birth|sex of client/i

const isSexTrackedEntityAttribute = (teaId, typeMeta) => {
    if (!teaId || !typeMeta?.attributes?.length) return false
    const id = String(teaId)
    if (id === 'BR1fUe7Nx8V') return true
    if (id === 'D7xpPXd6yMl') return false
    const attr = typeMeta.attributes.find((a) => a.id === id)
    if (!attr) return false
    const label = `${attr.name || ''} ${attr.displayName || ''} ${attr.shortName || ''} ${attr.systemName || ''}`
    const withoutTypes = label.replace(/ប្រភេទ/g, '')
    return SEX_ATTR_RULE_HINT.test(withoutTypes)
}

/** Map stored sex (option id/code/Khmer) to Maintenance rule literals Male / Female. */
const stiSexRuleLiteral = (raw, teaId, typeMeta) => {
    if (!isSexTrackedEntityAttribute(teaId, typeMeta)) return null
    const attr = typeMeta.attributes.find((a) => a.id === String(teaId))
    const digit = sexToUuicDigit(raw, attr)
    if (digit === '1') return 'Male'
    if (digit === '2') return 'Female'
    return null
}

const formatSubstitutedFieldValue = (raw, fieldUid, fieldMeta, typeMeta, ruleVariables) => {
    if (fieldMeta?.eventStatus != null) {
        return `'${String(fieldMeta.eventStatus).replace(/'/g, "\\'")}'`
    }
    if (raw === undefined || raw === null || raw === '') return conditionLiteralForEmptyValue()
    if (!typeMeta || (!typeMeta.attributes && !typeMeta.dataElements)) {
        return `'${String(raw).replace(/'/g, "\\'")}'`
    }
    const { teaId, deId, valueType } = fieldMeta || teaDeAndValueTypeForUid(typeMeta, fieldUid)
    if (!teaId && !deId) {
        return `'${String(raw).replace(/'/g, "\\'")}'`
    }
    const sexLit = teaId ? stiSexRuleLiteral(raw, teaId, typeMeta) : null
    if (sexLit) return `'${sexLit}'`
    const pseudoVar = { useCodeForOptionSet: useCodePreferenceForFieldUid(ruleVariables, fieldUid) }
    const resolved = resolveOptionValueForRuleVariable(raw, pseudoVar, teaId, deId, typeMeta, valueType)
    const nb = normalizeBooleanishForRules(resolved, valueType)
    if (nb !== null) return nb ? 'true' : 'false'
    if (resolved === undefined || resolved === null || resolved === '') return conditionLiteralForEmptyValue()
    if (typeof resolved === 'number' && Number.isFinite(resolved)) return String(resolved)
    return `'${String(resolved).replace(/'/g, "\\'")}'`
}

/**
 * Build map: program rule variable name → value for conditions (booleans unquoted in JS).
 * @param {Record<string, unknown>|null} [ruleVarContext] - Optional enrollment timeline for non–current-event variable sources.
 * @param {Array} [ruleVarContext.enrollmentEvents]
 * @param {string|null} [ruleVarContext.currentEventId]
 * @param {string|null} [ruleVarContext.currentProgramStageId]
 * @param {boolean} [ruleVarContext.evaluatingDraftEvent] - True when creating a new event (no event id yet): newest-event variables prefer in-form values when present.
 */
export const buildVarMap = (variables, formValues, typeMeta = null, ruleVarContext = null) => {
    const varMap = {}
    const attrList = typeMeta?.attributes
    const deMap = typeMeta?.dataElements

    const valueTypeForTea = (teaId) => {
        if (!attrList || !teaId) return null
        const a = attrList.find((x) => x.id === teaId)
        return a?.valueType || null
    }
    const valueTypeForDe = (deId) => {
        if (!deMap || !deId) return null
        return deMap[deId]?.valueType || null
    }

    for (const v of variables || []) {
        if (!v) continue
        const nameKey = v.name != null ? String(v.name).trim() : ''
        const displayKey = v.displayName != null ? String(v.displayName).trim() : ''
        if (!nameKey && !displayKey) continue

        const teaId = idFromMetadataRef(v.trackedEntityAttribute)
        const deId = idFromMetadataRef(v.dataElement)
        const st = normalizeProgramRuleVariableSourceType(v.programRuleVariableSourceType)
        if (st === 'CALCULATED_VALUE') continue
        if (!teaId && !deId) continue

        let raw = resolveRawForVariable(v, formValues || {}, ruleVarContext)
        const effectiveSt =
            st || (teaId ? 'TEI_ATTRIBUTE' : deId ? 'DATAELEMENT_CURRENT_EVENT' : null)
        const vt =
            effectiveSt === 'TEI_ATTRIBUTE' && teaId ? valueTypeForTea(teaId) : deId ? valueTypeForDe(deId) : null
        if (teaId && isSexTrackedEntityAttribute(teaId, typeMeta)) {
            const sexNorm = stiSexRuleLiteral(raw, teaId, typeMeta)
            if (sexNorm) raw = sexNorm
        } else {
            raw = resolveOptionValueForRuleVariable(raw, v, teaId, deId, typeMeta, vt)
        }
        const nb = normalizeBooleanishForRules(raw, vt)
        const value = nb !== null ? nb : raw === undefined || raw === null ? '' : String(raw)
        const keys = [...new Set([nameKey, displayKey].filter(Boolean))]
        for (const k of keys) {
            varMap[k] = value
        }
    }
    return varMap
}

/**
 * DHIS2 rule conditions reference form values using:
 * - `V{uid-or-name}` — data element or TEI attribute in the current form context
 * - `A{uid-or-name}` — tracked entity attribute (same resolution as V for merged `formValues`)
 * Names match tracker_npd / Maintenance (e.g. `A{STI_Attribute_Sex}`), not only 11-char uids.
 */
const substituteVAndAIdentifiers = (expr, formValues, typeMeta = null, ruleVariables = null, ruleVarContext = null) => {
    const lookup = buildFieldUidLookup(typeMeta, ruleVariables)
    return String(expr || '').replace(/\b[VA]\{([^}]+)\}/gi, (_, identifier) => {
        const resolved = resolveFieldFromIdentifier(identifier, typeMeta, lookup, ruleVarContext)
        const fieldUid = resolved?.uid || String(identifier || '').trim()
        const raw = formValues?.[fieldUid] ?? formValues?.[String(identifier || '').trim()]
        return formatSubstitutedFieldValue(raw, fieldUid, resolved, typeMeta, ruleVariables)
    })
}

/** DHIS2: BOOLEAN false still “has value”; TRUE_ONLY uses empty when unchecked (handled in varMap as ''). */
const d2HasValue = (v) => {
    if (v === undefined || v === null) return false
    if (typeof v === 'boolean') return true
    return String(v).trim() !== ''
}

const d2MatchesResult = (raw, patternLit) => {
    const val = raw === undefined || raw === null ? '' : String(raw)
    const pattern = String(patternLit || '').replace(/\\'/g, "'")
    try {
        return new RegExp(pattern).test(val) ? 'true' : 'false'
    } catch {
        return 'false'
    }
}

const normalizeDhis2LogicalOperators = (expr) => {
    let s = String(expr || '')
    // Keep `AND NOT` / `OR NOT` valid after token replacement.
    s = s.replace(/\bAND\s+NOT\b/gi, '&& !')
    s = s.replace(/\bOR\s+NOT\b/gi, '|| !')
    s = s.replace(/\bNOT\s*\(/gi, '!')
    s = s.replace(/\bNOT\s+/gi, '!')
    s = s.replace(/\bAND\b/gi, '&&')
    s = s.replace(/\bOR\b/gi, '||')
    // Some malformed conditions end up like: `false !false` (missing operator before NOT).
    s = s.replace(/(\btrue\b|\bfalse\b|\)|\d+)\s+!(?=[a-zA-Z_(]|true|false)/gi, '$1 && !')
    return s
}

/** Remove comparisons where a #{var} resolved to empty (e.g. `true && <= 11`). */
const sanitizeMalformedComparisons = (expr) =>
    String(expr || '')
        .replace(/&&\s*([<>=!]=?)/g, '&& false $1')
        .replace(/\|\|\s*([<>=!]=?)/g, '|| false $1')
        .replace(/\(\s*([<>=!]=?)/g, '(false $1')

const sanitizeUnbalancedParentheses = (expr) => {
    const src = String(expr || '')
    let open = 0
    let out = ''
    for (const ch of src) {
        if (ch === '(') {
            open += 1
            out += ch
            continue
        }
        if (ch === ')') {
            if (open > 0) {
                open -= 1
                out += ch
            }
            continue
        }
        out += ch
    }
    while (open > 0) {
        out += ')'
        open -= 1
    }
    return out
}

const preprocessD2 = (expr, varMap) => {
    let out = String(expr || '')
    out = out.replace(/d2:hasValue\s*\(\s*#\{([^}]+)\}\s*\)/gi, (_, varName) => {
        const v = varMap[varName]
        return d2HasValue(v) ? 'true' : 'false'
    })
    out = out.replace(/d2:hasValue\s*\(\s*'([^']*)'\s*\)/gi, (_, arg) => {
        if (Object.prototype.hasOwnProperty.call(varMap, arg)) {
            const v = varMap[arg]
            return d2HasValue(v) ? 'true' : 'false'
        }
        const has = String(arg).trim() !== ''
        return has ? 'true' : 'false'
    })
    out = out.replace(/d2:hasValue\s*\(\s*[AV]\{([^}]+)\}\s*\)/gi, (_, identifier) => {
        const key = String(identifier || '').trim()
        const v = varMap[key]
        return d2HasValue(v) ? 'true' : 'false'
    })
    out = out.replace(
        /d2:matches\s*\(\s*#\{([^}]+)\}\s*,\s*'((?:\\'|[^'])*)'\s*\)/gi,
        (_, varName, pattern) => d2MatchesResult(varMap[varName], pattern)
    )
    out = out.replace(
        /d2:matches\s*\(\s*[AV]\{([^}]+)\}\s*,\s*'((?:\\'|[^'])*)'\s*\)/gi,
        (_, identifier, pattern) => d2MatchesResult(varMap[String(identifier || '').trim()], pattern)
    )
    out = out.replace(
        /d2:matches\s*\(\s*'((?:\\'|[^'])*)'\s*,\s*'((?:\\'|[^'])*)'\s*\)/gi,
        (_, valueLit, pattern) => {
            const unescaped = String(valueLit).replace(/\\'/g, "'")
            if (Object.prototype.hasOwnProperty.call(varMap, unescaped)) {
                return d2MatchesResult(varMap[unescaped], pattern)
            }
            return d2MatchesResult(unescaped, pattern)
        }
    )
    out = out.replace(/d2:daysBetween\s*\(\s*#\{([^}]+)\}\s*,\s*#\{([^}]+)\}\s*\)/gi, (_, a, b) => {
        const da = parseDateToUtc(varMap[a])
        const db = parseDateToUtc(varMap[b])
        if (da == null || db == null) return 'null'
        const ms = Math.abs(db - da)
        return String(Math.floor(ms / 86400000))
    })
    out = out.replace(/d2:length\s*\(\s*'((?:\\'|[^'])*)'\s*\)/gi, (_, lit) => {
        const unescaped = String(lit).replace(/\\'/g, "'")
        return String(unescaped.length)
    })
    out = out.replace(/d2:length\s*\(\s*#\{([^}]+)\}\s*\)/gi, (_, varName) => {
        const v = varMap[String(varName || '').trim()]
        return String(v == null ? 0 : String(v).length)
    })
    out = out.replace(/d2:length\s*\(\s*[AV]\{([^}]+)\}\s*\)/gi, (_, identifier) => {
        const v = varMap[String(identifier || '').trim()]
        return String(v == null ? 0 : String(v).length)
    })
    return normalizeDhis2LogicalOperators(out)
}

const substituteVariablesForCondition = (expr, varMap) =>
    expr.replace(/#\{([^}]+)\}/g, (_, name) => {
        const key = String(name || '').trim()
        const val = varMap[key]
        if (val === undefined || val === null || val === '') return conditionLiteralForEmptyValue()
        if (typeof val === 'boolean') return val ? 'true' : 'false'
        if (typeof val === 'number' && Number.isFinite(val)) return String(val)
        if (typeof val === 'string') return `'${String(val).replace(/'/g, "\\'")}'`
        return `'${String(val).replace(/'/g, "\\'")}'`
    })

/**
 * Maintenance conditions may reference `#{variable}` before the variable is in the map
 * (or the variable name matches a data element display name). Resolve from current form values.
 */
const enrichVarMapForCondition = (condition, varMap, formValues, typeMeta, ruleVariables) => {
    if (!condition || !formValues || typeof formValues !== 'object') return
    const lookup = buildFieldUidLookup(typeMeta, ruleVariables)
    String(condition).replace(/#\{([^}]+)\}/g, (_, rawName) => {
        const name = String(rawName || '').trim()
        if (!name || Object.prototype.hasOwnProperty.call(varMap, name)) return
        const field = lookup.get(name)
        if (!field) return
        const uid = field.deId || field.teaId
        if (!uid) return
        const v = (ruleVariables || []).find(
            (x) => String(x?.name || '').trim() === name || String(x?.displayName || '').trim() === name
        )
        let raw = formValues[uid]
        raw = resolveOptionValueForRuleVariable(
            raw,
            v || {},
            field.teaId,
            field.deId,
            typeMeta,
            field.valueType
        )
        const nb = normalizeBooleanishForRules(raw, field.valueType)
        varMap[name] = nb !== null ? nb : raw === undefined || raw === null ? '' : String(raw)
    })
}

/** Maintenance often uses `== ""` for empty DE checks; normalize to single-quoted form for JS eval. */
const normalizeEmptyStringComparisons = (expr) =>
    String(expr || '')
        .replace(/===?\s*""/g, "== ''")
        .replace(/!==?\s*""/g, "!= ''")

/**
 * JS `false == ''` is true, which breaks BOOLEAN rules that mean “empty OR false” as two distinct checks.
 * Use strict empty compare for boolean literals so only `== false` matches false, not loose empty.
 */
const normalizeBooleanFalseEmptyComparisons = (expr) =>
    String(expr || '').replace(/\bfalse\s*==\s*(['"])\s*\1/g, 'false === $1$1')

/** DHIS2 UI often compares BOOLEAN to 'Yes'/'No'; Capture-style rules expect that to match stored true/false. */
const relaxDhBooleanYesNoComparisons = (expr) => {
    let s = String(expr || '')
    const eqYes = [/(\btrue\b)\s*===?\s*'Yes'/gi, /'Yes'\s*===?\s*(\btrue\b)/gi, /(\btrue\b)\s*===?\s*"Yes"/gi, /"Yes"\s*===?\s*(\btrue\b)/gi]
    const eqNo = [/(\bfalse\b)\s*===?\s*'No'/gi, /'No'\s*===?\s*(\bfalse\b)/gi, /(\bfalse\b)\s*===?\s*"No"/gi, /"No"\s*===?\s*(\bfalse\b)/gi]
    for (const r of eqYes) s = s.replace(r, 'true')
    for (const r of eqNo) s = s.replace(r, 'true')
    const neYes = [/(\btrue\b)\s*!==?\s*'Yes'/gi, /'Yes'\s*!==?\s*(\btrue\b)/gi, /(\btrue\b)\s*!==?\s*"Yes"/gi, /"Yes"\s*!==?\s*(\btrue\b)/gi]
    const neNo = [/(\bfalse\b)\s*!==?\s*'No'/gi, /'No'\s*!==?\s*(\bfalse\b)/gi, /(\bfalse\b)\s*!==?\s*"No"/gi, /"No"\s*!==?\s*(\bfalse\b)/gi]
    for (const r of neYes) s = s.replace(r, 'false')
    for (const r of neNo) s = s.replace(r, 'false')
    const yesLower = [/(\btrue\b)\s*===?\s*'yes'/gi, /'yes'\s*===?\s*(\btrue\b)/gi]
    for (const r of yesLower) s = s.replace(r, 'true')
    const noLower = [/(\bfalse\b)\s*===?\s*'no'/gi, /'no'\s*===?\s*(\bfalse\b)/gi]
    for (const r of noLower) s = s.replace(r, 'true')
    return s
}

const shouldSkipDhis2RuleEngine = (rules = []) => {
    // @dhis2/rule-engine in this app build crashes/noises heavily on these legacy syntax patterns.
    for (const rule of rules || []) {
        const condition = String(rule?.condition || '')
        if (!condition) continue
        if (/\b[AV]\{[^}]+\}/.test(condition)) return true
        if ((condition.match(/\(/g) || []).length !== (condition.match(/\)/g) || []).length) return true
    }
    return false
}

const substituteVariablesForAssign = (expr, varMap) =>
    String(expr || '').replace(/#\{([^}]+)\}/g, (_, name) => {
        const val = varMap[name]
        if (val === undefined || val === null || val === '') return "''"
        if (typeof val === 'string') return `'${String(val).replace(/'/g, "\\'")}'`
        if (typeof val === 'number' && Number.isFinite(val)) return String(val)
        if (val === true || val === false) return String(val)
        return `'${String(val).replace(/'/g, "\\'")}'`
    })

/**
 * Subset of Tracker Capture `dhisFunctions` (dhis2.angular.services.js) for program rule **conditions**
 * when the @dhis2/rule-engine path is unavailable or throws.
 */
const buildLegacyD2Shim = (varMap) => {
    const toStr = (x) => (x == null ? '' : String(x))
    const dateMs = (x) => {
        if (x == null || x === '') return null
        if (typeof x === 'number' && Number.isFinite(x)) return x
        const t = toStr(x).trim().split('T')[0]
        if (!t) return null
        return parseDateToUtc(t)
    }
    const daysBetweenInner = (a, b) => {
        const da = dateMs(a)
        const db = dateMs(b)
        if (da == null || db == null) return NaN
        return Math.floor(Math.abs(db - da) / 86400000)
    }
    const varKey = (x) => (typeof x === 'string' ? x.trim().replace(/^['"]|['"]$/g, '') : '')

    return {
        hasValue(x) {
            const k = varKey(x)
            if (k && Object.prototype.hasOwnProperty.call(varMap, k)) return d2HasValue(varMap[k])
            return d2HasValue(x)
        },
        daysBetween: (a, b) => daysBetweenInner(a, b),
        weeksBetween: (a, b) => {
            const d = daysBetweenInner(a, b)
            return Number.isNaN(d) || d == null ? NaN : Math.floor(d / 7)
        },
        monthsBetween: (a, b) => {
            const d = daysBetweenInner(a, b)
            return Number.isNaN(d) || d == null ? NaN : Math.floor(d / 30.44)
        },
        yearsBetween: (a, b) => {
            const d = daysBetweenInner(a, b)
            return Number.isNaN(d) || d == null ? NaN : Math.floor(d / 365.25)
        },
        floor: (x) => Math.floor(Number(x) || 0),
        ceil: (x) => Math.ceil(Number(x) || 0),
        round(x, n) {
            const v = Number(x)
            if (!Number.isFinite(v)) return NaN
            if (n == null || n === '') return Math.round(v)
            const p = 10 ** Math.round(Number(n))
            return Math.round((v + Number.EPSILON) * p) / p
        },
        modulus: (a, b) => {
            const y = Number(b)
            if (!y) return NaN
            return Number(a) % y
        },
        concatenate: (...xs) => xs.map((t) => toStr(t)).join(''),
        zing: (x) => (Number(x) < 0 ? 0 : Number(x)),
        oizp: (x) => (Number(x) < 0 ? 0 : 1),
        length: (x) => toStr(x).length,
        condition: (c, a, b) => (c ? a : b),
        validatePattern: (input, pattern) => {
            try {
                const reg = new RegExp(pattern, 'g')
                const m = toStr(input).match(reg)
                return m !== null && toStr(input) === m[0]
            } catch {
                return false
            }
        },
        matches(input, pattern) {
            try {
                return new RegExp(String(pattern)).test(toStr(input))
            } catch {
                return false
            }
        },
        hasvalue: (x) => d2HasValue(x),
        hasValue: (x) => d2HasValue(x),
        lastEventDate: () => '',
        count(x) {
            const k = varKey(x)
            if (!k || !Object.prototype.hasOwnProperty.call(varMap, k)) return 0
            return d2HasValue(varMap[k]) ? 1 : 0
        },
        countIfZeroPos(x) {
            const k = varKey(x)
            if (!k || !Object.prototype.hasOwnProperty.call(varMap, k)) return 0
            const v = Number(varMap[k])
            return d2HasValue(varMap[k]) && Number.isFinite(v) && v >= 0 ? 1 : 0
        },
        countIfValue(x, y) {
            const k = varKey(x)
            if (!k || !Object.prototype.hasOwnProperty.call(varMap, k)) return 0
            return String(varMap[k]) === String(y) ? 1 : 0
        },
        addDays(dateStr, n) {
            const base = dateMs(dateStr)
            if (base == null) return ''
            const days = Math.round(Number(n) || 0)
            const d = new Date(base)
            d.setUTCDate(d.getUTCDate() + days)
            return d.toISOString().split('T')[0]
        },
        substring(s, start, end) {
            const t = toStr(s)
            const a = Math.round(Number(start)) || 0
            const b = Math.round(Number(end))
            if (a < 0 || b < 0 || b < a) return ''
            return t.substring(a, b)
        },
        split(s, sep, idx) {
            const parts = toStr(s).split(toStr(sep))
            const i = Math.round(Number(idx)) || 0
            return parts[i] != null ? parts[i] : ''
        },
        left(s, n) {
            const t = toStr(s)
            const k = Math.round(Number(n)) || 0
            return k <= 0 ? '' : t.slice(0, k)
        },
        right(s, n) {
            const t = toStr(s)
            const k = Math.round(Number(n)) || 0
            return k <= 0 ? '' : t.slice(-k)
        },
        zScoreWFA: () => 0,
        zScoreHFA: () => 0,
        zScoreWFH: () => 0,
        inOrgUnitGroup: () => false,
        hasUserRole: () => false,
    }
}

/** @internal exported for EventEditor / adapter parity */
export const evalPreparedCondition = (prepared, varMap = null) => {
    const isDev =
        (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') ||
        (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV)
    let src = normalizeDhis2LogicalOperators(String(prepared || '').trim())
    src = sanitizeMalformedComparisons(src)
    src = sanitizeUnbalancedParentheses(src)
    if (!src) return false
    const usesD2 = /\bd2:/i.test(src)
    if (!usesD2 || !varMap || typeof varMap !== 'object') {
        try {
            // eslint-disable-next-line no-new-func
            return Boolean(new Function(`return (${src});`)())
        } catch (e) {
            if (isDev) {
                // eslint-disable-next-line no-console
                console.warn('[program-rules] Legacy condition eval failed:', e?.message || e, '\n', src.slice(0, 280))
            }
            return false
        }
    }
    const lowered = src.replace(/\bd2:([a-zA-Z][a-zA-Z0-9]*)\b/g, (_, n) => `__dhis2.${String(n).toLowerCase()}`)
    const base = buildLegacyD2Shim(varMap)
    const shim = new Proxy(base, {
        get(t, prop) {
            if (typeof prop === 'string' && prop in t) return t[prop]
            if (typeof prop === 'string') {
                const lower = prop.toLowerCase()
                for (const k of Object.keys(t)) {
                    if (k.toLowerCase() === lower) return t[k]
                }
            }
            return function d2Stub() {
                return NaN
            }
        },
    })
    try {
        // eslint-disable-next-line no-new-func
        return Boolean(new Function('__dhis2', `return (${lowered});`)(shim))
    } catch (e) {
        if (isDev) {
            // eslint-disable-next-line no-console
            console.warn('[program-rules] d2 shim eval failed:', e?.message || e, '\n', lowered.slice(0, 280))
        }
        try {
            // eslint-disable-next-line no-new-func
            return Boolean(new Function(`return (${src});`)())
        } catch (e2) {
            if (isDev) {
                // eslint-disable-next-line no-console
                console.warn('[program-rules] Fallback eval failed:', e2?.message || e2, '\n', src.slice(0, 280))
            }
            return false
        }
    }
}

/** Build executable condition string (V{}, A{}, d2:*, #{var}). */
export const prepareRuleConditionExpression = (
    condition,
    varMap,
    formValuesForV = {},
    typeMeta = null,
    ruleVariables = null,
    ruleVarContext = null
) => {
    let processed = substituteVAndAIdentifiers(condition, formValuesForV, typeMeta, ruleVariables, ruleVarContext)
    processed = normalizeEmptyStringComparisons(processed)
    processed = preprocessD2(processed, varMap)
    processed = substituteVariablesForCondition(processed, varMap)
    processed = normalizeBooleanFalseEmptyComparisons(processed)
    processed = relaxDhBooleanYesNoComparisons(processed)
    processed = sanitizeMalformedComparisons(processed)
    processed = sanitizeUnbalancedParentheses(processed)
    processed = normalizeDhis2LogicalOperators(processed)
    return processed
}

export const evalAssignValue = (dataTemplate, varMap) => {
    if (dataTemplate == null || dataTemplate === '') return ''
    const substituted = substituteVariablesForAssign(dataTemplate, varMap)
    try {
        // eslint-disable-next-line no-new-func
        const v = new Function(`return (${substituted});`)()
        if (v === undefined || v === null) return ''
        return String(v)
    } catch {
        return String(dataTemplate)
    }
}

/**
 * When a program rule is bound to a program stage (Maintenance), it must not run on *other* stages.
 * On TEI registration / profile (`programStageId` null), Capture still evaluates rules so
 * gender-based HIDEFIELD on attributes works; stage-only effects are gated per action below.
 */
const ruleAppliesInProgramStageContext = (rule, programStageId) => {
    const ruleStage = programStageRefId(rule)
    if (!programStageId) {
        if (!ruleStage) return true
        return (rule.programRuleActions || []).some((a) =>
            enrollmentActionIgnoresProgramStageBinding(a, normalizeProgramRuleActionType(a.programRuleActionType))
        )
    }
    if (!ruleStage) return true
    return ruleStage === programStageId
}

const teaEnrollmentActionTypes = new Set([
    'HIDEFIELD',
    'SETMANDATORYFIELD',
    'ASSIGN',
    'SHOWWARNING',
    'WARNINGONCOMPLETE',
    'SHOWERROR',
    'ERRORONCOMPLETE',
    'HIDEOPTION',
])

/**
 * Enrollment / profile form: attribute-targeted actions apply even if Maintenance set
 * `programStage` on the action (common for “hide female fields when male” program rules).
 * Same applies on tracker **stage** tabs: TEI attributes are global, not stage-scoped.
 */
const enrollmentActionIgnoresProgramStageBinding = (action, act) => {
    if (!idFromMetadataRef(action?.trackedEntityAttribute)) return false
    return teaEnrollmentActionTypes.has(act)
}

/**
 * HIDESECTION: prefer resolving owning stage from layout (`sectionIdToProgramStageId`) so we
 * still hide when the action omits `programStage` or it is inconsistent. Other actions follow
 * `programStage` on the action when present.
 */
export const actionAppliesInProgramStageContext = (action, programStageId, sectionIdToProgramStageId) => {
    const act = normalizeProgramRuleActionType(action.programRuleActionType)
    if (act === 'HIDEPROGRAMSTAGE') return true

    // TEI attributes are not per–program-stage; ignore Maintenance `programStage` on the action
    // even when the user is on a tracker stage tab (otherwise sex-based hides never run there).
    if (enrollmentActionIgnoresProgramStageBinding(action, act)) {
        return true
    }

    const bind = programStageRefId(action)
    const secId = idFromMetadataRef(action.programStageSection)
    const deId = idFromMetadataRef(action.dataElement)

    /**
     * Tracker Capture data entry (`dataentry-controller.js` → `processRuleEffect`) applies DE-targeted
     * field effects whenever the rule fired for the current event; it does **not** re-filter HIDEFIELD
     * by `programRuleAction.programStage`. Maintenance often sets that field to another stage or a
     * stale value, which caused us to skip hides while the core app still hid fields.
     */
    if (
        programStageId &&
        deId &&
        !secId &&
        (act === 'HIDEFIELD' ||
            act === 'SETMANDATORYFIELD' ||
            act === 'HIDEOPTION' ||
            act === 'SHOWWARNING' ||
            act === 'WARNINGONCOMPLETE' ||
            act === 'SHOWERROR' ||
            act === 'ERRORONCOMPLETE')
    ) {
        return true
    }

    if (act === 'HIDESECTION' && secId) {
        if (!programStageId) return false
        const owner = sectionIdToProgramStageId?.[secId]
        if (owner) return owner === programStageId
        if (bind) return bind === programStageId
        return true
    }

    if (!bind) {
        if (!programStageId) {
            return Boolean(idFromMetadataRef(action?.trackedEntityAttribute))
        }
        return true
    }
    if (!programStageId) return false
    return bind === programStageId
}

const emptyEffects = () => ({
    hiddenFields: new Set(),
    assignedValues: {},
    hiddenProgramStages: new Set(),
    hiddenSectionIds: new Set(),
    mandatoryFieldIds: new Set(),
    ruleWarnings: [],
    ruleErrors: [],
    hiddenOptionsByField: {},
})

/**
 * Union legacy + @dhis2/rule-engine effects so stage/profile UI never loses hides when
 * one evaluator omits them (variable parity gaps, enrollment TEI merge bugs, etc.).
 * @param {ReturnType<emptyEffects>} legacy
 * @param {ReturnType<emptyEffects>} engine
 */
const mergeProgramRuleEffects = (legacy, engine) => {
    const hiddenFields = new Set(legacy.hiddenFields)
    for (const id of engine.hiddenFields) hiddenFields.add(id)

    const hiddenSectionIds = new Set(legacy.hiddenSectionIds)
    for (const id of engine.hiddenSectionIds) hiddenSectionIds.add(id)

    const hiddenProgramStages = new Set(legacy.hiddenProgramStages)
    for (const id of engine.hiddenProgramStages) hiddenProgramStages.add(id)

    const mandatoryFieldIds = new Set(legacy.mandatoryFieldIds)
    for (const id of engine.mandatoryFieldIds) mandatoryFieldIds.add(id)

    const hiddenOptionsByField = { ...legacy.hiddenOptionsByField }
    for (const [deId, opts] of Object.entries(engine.hiddenOptionsByField || {})) {
        if (!hiddenOptionsByField[deId]) hiddenOptionsByField[deId] = new Set()
        for (const o of opts) hiddenOptionsByField[deId].add(o)
    }

    return {
        hiddenFields,
        hiddenSectionIds,
        hiddenProgramStages,
        mandatoryFieldIds,
        hiddenOptionsByField,
        assignedValues: (() => {
            const L = legacy.assignedValues || {}
            const E = engine.assignedValues || {}
            const out = { ...L }
            for (const [k, v] of Object.entries(E)) {
                const ev = String(v ?? '').trim()
                if (ev !== '') out[k] = v
                else if (!Object.prototype.hasOwnProperty.call(L, k)) out[k] = v
            }
            return out
        })(),
        ruleWarnings: [...legacy.ruleWarnings, ...engine.ruleWarnings],
        ruleErrors: [...legacy.ruleErrors, ...engine.ruleErrors],
    }
}

/**
 * @param {Object} params
 * @param {Array} params.rules
 * @param {Array} params.variables - programRuleVariables
 * @param {Record<string, string>} params.formValues - TEA id and/or dataElement id → value
 * @param {string|null} [params.programStageId] - current stage for stage-bound rules/actions
 * @param {Record<string, string>|null} [params.sectionIdToProgramStageId] - program stage section id → program stage id
 * @param {Record<string, unknown>|null} [params.ruleVarContext] - enrollment events + current event/stage for program-rule variable sources
 * @param {{ enrollment: object, tei: object, programName?: string }|null} [params.dhis2Context] - when set, also runs @dhis2/rule-engine and unions effects with the legacy evaluator
 */
export const evaluateRules = (params) => {
    if (!params?.rules?.length) {
        return emptyEffects()
    }
    const legacy = evaluateRulesLegacy({
        ...params,
        variables: params.variables || [],
    })
    if (shouldSkipDhis2RuleEngine(params.rules)) return legacy
    const engine = tryEvaluateRulesWithDhis2({
        ...params,
        variables: params.variables || [],
    })
    if (!engine) return legacy
    const merged = mergeProgramRuleEffects(legacy, engine)
    /**
     * @dhis2/rule-engine often fails BOOLEAN / #{variable} conditions (coercion errors) and returns
     * no HIDEFIELD effects. Unioning engine hides then blocked valid legacy hides or left stale state.
     * Legacy JS evaluator matches Capture for hide/show; use engine for assign + warnings only.
     */
    return {
        ...merged,
        hiddenFields: legacy.hiddenFields,
        hiddenSectionIds: legacy.hiddenSectionIds,
        hiddenProgramStages: legacy.hiddenProgramStages,
    }
}

function evaluateRulesLegacy({
    rules,
    variables,
    formValues,
    programStageId = null,
    sectionIdToProgramStageId = null,
    dataElements = null,
    attributes = null,
    ruleVarContext = null,
}) {
    if (!rules?.length) {
        return emptyEffects()
    }

    const hiddenFields = new Set()
    const hiddenProgramStages = new Set()
    const hiddenSectionIds = new Set()
    const mandatoryFieldIds = new Set()
    const ruleWarnings = []
    const ruleErrors = []
    /** @type {Record<string, Set<string>>} */
    const hiddenOptionsByField = {}
    const assignedValues = {}

    const fv = formValues || {}
    const typeMeta =
        dataElements || attributes
            ? { dataElements: dataElements || undefined, attributes: attributes || undefined }
            : null
    const varMap = buildVarMap(variables, fv, typeMeta, ruleVarContext)
    const eventSt = effectiveEventStatusForRules(ruleVarContext)
    if (eventSt) varMap.event_status = eventSt

    const sortedRules = [...rules].sort((a, b) => {
        const pa = Number(a?.priority)
        const pb = Number(b?.priority)
        const na = Number.isFinite(pa) ? pa : 999999
        const nb = Number.isFinite(pb) ? pb : 999999
        if (na !== nb) return na - nb
        return String(a?.id || a?.name || '').localeCompare(String(b?.id || b?.name || ''))
    })

    for (const rule of sortedRules) {
        try {
            if (!ruleAppliesInProgramStageContext(rule, programStageId)) continue

            const condition = rule.condition
            if (!condition) continue

            enrichVarMapForCondition(condition, varMap, fv, typeMeta, variables)
            const prepared = prepareRuleConditionExpression(condition, varMap, fv, typeMeta, variables, ruleVarContext)
            if (!evalPreparedCondition(prepared, varMap)) continue

            for (const action of rule.programRuleActions || []) {
                if (!actionAppliesInProgramStageContext(action, programStageId, sectionIdToProgramStageId)) {
                    continue
                }

                const act = normalizeProgramRuleActionType(action.programRuleActionType)

                if (act === 'HIDEFIELD') {
                    const { teaId, deId } = fieldIdsFromProgramRuleAction(action, typeMeta)
                    if (teaId) hiddenFields.add(teaId)
                    if (deId) hiddenFields.add(deId)
                } else if (act === 'HIDEPROGRAMSTAGE') {
                    const sid = programStageRefId(action)
                    if (sid) hiddenProgramStages.add(sid)
                } else if (act === 'HIDESECTION') {
                    const secId = idFromMetadataRef(action.programStageSection)
                    if (secId) hiddenSectionIds.add(secId)
                } else if (act === 'SETMANDATORYFIELD') {
                    const { teaId, deId } = fieldIdsFromProgramRuleAction(action, typeMeta)
                    if (teaId) mandatoryFieldIds.add(teaId)
                    if (deId) mandatoryFieldIds.add(deId)
                } else if (act === 'ASSIGN') {
                    const { teaId, deId } = fieldIdsFromProgramRuleAction(action, typeMeta)
                    const resolved = evalAssignValue(action.data, varMap)
                    if (teaId) assignedValues[teaId] = resolved
                    if (deId) assignedValues[deId] = resolved
                } else if (act === 'SHOWWARNING') {
                    const text = action.displayContent || action.content || ''
                    const isStaticTip =
                        rule?.condition === 'true' &&
                        (String(rule?.name || '').toLowerCase().includes('show tip') ||
                            text.includes('មានកត្តាប្រព្រឹត្តប្រឈម') ||
                            text.includes('បើ មាន(បាទ/ចាស'))
                    if (text && !isStaticTip) {
                        ruleWarnings.push({
                            text,
                            fieldId: idFromMetadataRef(action.dataElement) || idFromMetadataRef(action.trackedEntityAttribute),
                            kind: 'show',
                        })
                    }
                } else if (act === 'WARNINGONCOMPLETE') {
                    const text = action.displayContent || action.content || ''
                    if (text) {
                        ruleWarnings.push({
                            text,
                            fieldId: idFromMetadataRef(action.dataElement) || idFromMetadataRef(action.trackedEntityAttribute),
                            kind: 'complete',
                        })
                    }
                } else if (act === 'SHOWERROR') {
                    const text = action.displayContent || action.content || ''
                    if (text) {
                        ruleErrors.push({
                            text,
                            fieldId: idFromMetadataRef(action.dataElement) || idFromMetadataRef(action.trackedEntityAttribute),
                            kind: 'show',
                        })
                    }
                } else if (act === 'ERRORONCOMPLETE') {
                    const text = action.displayContent || action.content || ''
                    if (text) {
                        ruleErrors.push({
                            text,
                            fieldId: idFromMetadataRef(action.dataElement) || idFromMetadataRef(action.trackedEntityAttribute),
                            kind: 'complete',
                        })
                    }
                } else if (act === 'HIDEOPTION') {
                    const { teaId, deId } = fieldIdsFromProgramRuleAction(action, typeMeta)
                    const targetId = teaId || deId
                    const optId = idFromMetadataRef(action.option)
                    const optCode = action.option?.code != null ? String(action.option.code) : null
                    if (targetId) {
                        if (!hiddenOptionsByField[targetId]) hiddenOptionsByField[targetId] = new Set()
                        if (optId) hiddenOptionsByField[targetId].add(optId)
                        if (optCode) hiddenOptionsByField[targetId].add(optCode)
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to evaluate rule:', rule?.name, e)
        }
    }

    // Partner of Pregnant Women (PPW) is for Male only.
    // Pregnant Women (PW) is hidden for Female as requested.
    const sexVal = String(
        formValues?.['BR1fUe7Nx8V'] ??
        formValues?.['STI_Attribute_Sex'] ??
        formValues?.['Sex'] ??
        formValues?.['sex'] ??
        Object.entries(formValues || {}).find(([k, v]) => {
            const vs = String(v || '').toLowerCase()
            return vs === 'female' || vs === 'uvcdfaipcv' || vs === 'ស្រី' || vs === 'male' || vs === 'hnwywvgnon0' || vs === 'ប្រុស'
        })?.[1] ??
        ''
    ).toLowerCase().trim()
    const isMale = sexVal === 'male' || sexVal === 'ប្រុស' || sexVal === 'm' || sexVal === '1' || sexVal === 'hnwywvgnon0'
    const isFemale = sexVal === 'female' || sexVal === 'ស្រី' || sexVal === 'f' || sexVal === '2' || sexVal === 'uvcdfaipcv'

    for (const [targetId, set] of Object.entries(hiddenOptionsByField)) {
        if (isFemale || set.has('MEN') || set.has('kh97GX5bWlD') || set.has('MSM') || set.has('jCKuO78o3g0')) {
            // Female patient: hide PPW and hide PW
            set.add('PPW')
            set.add('ARL8Z19H2kd')
            set.add('PW')
            set.add('blIxIScSfiF')
        } else if (isMale || set.has('FEW') || set.has('yrjuA39zIxS') || set.has('PW') || set.has('blIxIScSfiF')) {
            // Male patient: hide PW; PPW is visible
            set.add('PW')
            set.add('blIxIScSfiF')
            set.delete('PPW')
            set.delete('ARL8Z19H2kd')
        }
    }

    if (isFemale) {
        if (!hiddenOptionsByField['SRmKYu8iQvK']) {
            hiddenOptionsByField['SRmKYu8iQvK'] = new Set()
        }
        // Female: Hide both PPW and PW
        hiddenOptionsByField['SRmKYu8iQvK'].add('PPW')
        hiddenOptionsByField['SRmKYu8iQvK'].add('ARL8Z19H2kd')
        hiddenOptionsByField['SRmKYu8iQvK'].add('PW')
        hiddenOptionsByField['SRmKYu8iQvK'].add('blIxIScSfiF')
    } else if (isMale) {
        if (!hiddenOptionsByField['SRmKYu8iQvK']) {
            hiddenOptionsByField['SRmKYu8iQvK'] = new Set()
        }
        // Male: Hide PW; Keep PPW visible
        hiddenOptionsByField['SRmKYu8iQvK'].add('PW')
        hiddenOptionsByField['SRmKYu8iQvK'].add('blIxIScSfiF')
        hiddenOptionsByField['SRmKYu8iQvK'].delete('PPW')
        hiddenOptionsByField['SRmKYu8iQvK'].delete('ARL8Z19H2kd')
    }

    return {
        hiddenFields,
        assignedValues,
        hiddenProgramStages,
        hiddenSectionIds,
        mandatoryFieldIds,
        ruleWarnings,
        ruleErrors,
        hiddenOptionsByField,
    }
}

/** Action types executed by {@link evaluateRulesLegacy}. */
const CLIENT_IMPLEMENTED_RULE_ACTIONS = new Set([
    'HIDEFIELD',
    'HIDEPROGRAMSTAGE',
    'HIDESECTION',
    'SETMANDATORYFIELD',
    'ASSIGN',
    'SHOWWARNING',
    'WARNINGONCOMPLETE',
    'SHOWERROR',
    'ERRORONCOMPLETE',
    'HIDEOPTION',
])

/**
 * Counts of program rule action types in metadata that this client does not run (Maintenance still has them).
 * @param {Array<{ programRuleActions?: { programRuleActionType?: string }[] }>} rules
 * @returns {Record<string, number>}
 */
export const getUnsupportedProgramRuleActionsSummary = (rules) => {
    const counts = {}
    for (const r of rules || []) {
        for (const a of r?.programRuleActions || []) {
            const t = normalizeProgramRuleActionType(a?.programRuleActionType)
            if (!t) continue
            if (!CLIENT_IMPLEMENTED_RULE_ACTIONS.has(t)) {
                counts[t] = (counts[t] || 0) + 1
            }
        }
    }
    return counts
}

/**
 * Static parity notes vs DHIS2 Program Rule Maintenance (for in-app reference panel).
 * @returns {{ actionsImplemented: string[], actionsNotImplemented: string[], conditionsPartial: string[], variablesPartial: string[] }}
 */
export const getProgramRulesClientParityNotes = () => ({
    actionsImplemented: [...CLIENT_IMPLEMENTED_RULE_ACTIONS].sort(),
    actionsNotImplemented: [
        'DISPLAYTEXT',
        'DISPLAYKEYVALUEPAIR',
        'SCHEDULEEVENT',
        'CREATEEVENT',
        'SENDMESSAGE',
        'SCHEDULEMESSAGE',
        'SHOWOPTIONGROUP',
        'HIDEOPTIONGROUP',
    ],
    conditionsPartial: [
        'Implemented: #{variable}, V{uid-or-name}, A{uid-or-name}; d2:hasValue(#{var}), d2:hasValue(\'name\'), d2:daysBetween(#{a},#{b}).',
        'Other d2:* functions are not expanded — rules using them may always evaluate false in the legacy evaluator.',
    ],
    variablesPartial: [
        'Legacy #{map}: TEI_ATTRIBUTE, DATAELEMENT_CURRENT_EVENT, NEWEST/PREVIOUS event (program / program-stage).',
        'CALCULATED_VALUE variables are omitted from the legacy variable map; use enrollment+TEI context so @dhis2/rule-engine can merge results where variables are mapped.',
    ],
})
