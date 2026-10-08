import i18n from '@dhis2/d2-i18n'
import { resolveStageOptionDisplayLabel } from './stageFieldLabelI18n'
import { evaluateRules } from '../services/ruleEngine'
import { trackedEntityAttributeIdFromEntry } from '../utils/trackerMappers'
import { mandatoryFieldSetHas } from './paperFormSafety'

/** Human-readable profile field value for read-only grid (booleans, option sets). */
export function formatProfileAttributeDisplayValue(attr, rawValue) {
    if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') {
        return '-'
    }
    const s = String(rawValue)
    if (attr?.valueType === 'BOOLEAN' || attr?.valueType === 'TRUE_ONLY') {
        const lower = s.toLowerCase()
        if (lower === 'true') return i18n.t('Yes')
        if (lower === 'false') return i18n.t('No')
        return '-'
    }
    if (attr?.valueType === 'FILE_RESOURCE' || attr?.valueType === 'IMAGE') {
        return attr?.valueType === 'IMAGE' ? i18n.t('Attached image') : i18n.t('Attached file')
    }
    const options = attr?.optionSet?.options
    if (Array.isArray(options) && options.length > 0) {
        const match = options.find(
            (opt) =>
                opt.code === s ||
                opt.id === s ||
                String(opt.displayName || opt.name || '').trim() === s
        )
        if (match) return resolveStageOptionDisplayLabel(match)
    }
    return s
}

/** Build attribute payload for tracker create/update from form state. */
export function buildTrackedEntityAttributesPayload(formValues, visibleAttributes, hiddenFields, mandatoryFieldIds, validAttributeIds) {
    const attrMap = new Map()
    for (const [id, value] of Object.entries(formValues)) {
        if (hiddenFields.has(id) || id === '__pseudo_age__') continue
        if (validAttributeIds && !validAttributeIds.has(id)) continue
        if (value !== '' && value !== null && value !== undefined) {
            attrMap.set(id, String(value))
        } else {
            // Explicitly set null so DHIS2 clears/unsets the attribute instead of keeping previous value
            attrMap.set(id, null)
        }
    }
    for (const attr of visibleAttributes) {
        if (attr.valueType === 'BOOLEAN' && (attr.mandatory || mandatoryFieldSetHas(mandatoryFieldIds, attr.id)) && (!attrMap.has(attr.id) || attrMap.get(attr.id) === null)) {
            attrMap.set(attr.id, 'false')
        }
    }
    return [...attrMap.entries()].map(([attribute, value]) => ({ attribute, value }))
}

export function profileAttributeValuesFromTei(tei, attributeIds) {
    const out = {}
    const allowed = attributeIds ? new Set(attributeIds) : null
    for (const entry of tei?.attributes || []) {
        const id = trackedEntityAttributeIdFromEntry(entry)
        if (!id) continue
        if (allowed && !allowed.has(id)) continue
        out[id] = entry.value ?? ''
    }
    return out
}

/** Show profile attribute when not hidden, or when partner TEI already has a value (Capture parity). */
export function shouldShowProfileAttributeAfterRules(attributeId, teaValues, hiddenFields) {
    if (!hiddenFields?.has?.(attributeId)) return true
    const v = teaValues?.[attributeId]
    return v != null && String(v).trim() !== ''
}

/**
 * Profile attributes for a TEI (e.g. partner lookup): program section order, partner rule evaluation,
 * plus any TEI attributes with values that are not on a program section.
 */
export function resolveVisibleProfileAttributesForTei(metadata, tei, options = {}) {
    if (!metadata?.attributes?.length || !tei) return []

    const { programStageId = null, ruleVarContext = null, enrollment = null } = options
    const allAttrs = metadata.attributes
    const byId = new Map(allAttrs.map((a) => [a.id, a]))
    const teaValues = profileAttributeValuesFromTei(tei)

    const programId = metadata.id || metadata.programId
    const enrollmentForTei =
        enrollment ||
        (tei.enrollments || []).find((e) => e.program === programId) ||
        tei.enrollments?.[0]

    let hiddenFields = new Set()
    if (metadata.rules?.length) {
        const effects = evaluateRules({
            rules: metadata.rules,
            variables: metadata.ruleVariables || [],
            formValues: teaValues,
            programStageId,
            sectionIdToProgramStageId: metadata.sectionIdToProgramStageId || null,
            dataElements: metadata.dataElements || null,
            attributes: metadata.attributes || null,
            ruleVarContext:
                ruleVarContext || {
                    enrollmentEvents: enrollmentForTei?.events || [],
                    currentProgramStageId: programStageId,
                },
            dhis2Context: enrollmentForTei
                ? { enrollment: enrollmentForTei, tei, programName: metadata.name || '' }
                : { tei },
        })
        hiddenFields = effects.hiddenFields || new Set()
    }

    const shouldShow = (id) => shouldShowProfileAttributeAfterRules(id, teaValues, hiddenFields)
    const out = []
    const seen = new Set()
    const ps = metadata.programSections

    const pushAttr = (id) => {
        if (seen.has(id) || !shouldShow(id)) return
        const a = byId.get(id)
        if (a) {
            out.push(a)
            seen.add(id)
        }
    }

    if (ps?.length) {
        for (const s of ps) {
            for (const id of s.trackedEntityAttributeIds || []) {
                pushAttr(id)
            }
        }
    } else {
        for (const a of allAttrs) {
            pushAttr(a.id)
        }
    }

    for (const [id, value] of Object.entries(teaValues)) {
        if (seen.has(id) || !shouldShow(id)) continue
        if (value == null || String(value).trim() === '') continue
        pushAttr(id)
    }

    return out
}
