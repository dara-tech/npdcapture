import {
    buildVarMap,
    evalAssignValue,
    prepareRuleConditionExpression,
    evalPreparedCondition,
    actionAppliesInProgramStageContext,
} from '../services/ruleEngine'

export const buildRuleContext = ({
    ruleVariables,
    formValues,
    teiAttributes,
    dataElements,
    attributes,
    ruleVarContext = null,
}) => {
    const merged = { ...(teiAttributes || {}), ...(formValues || {}) }
    const typeMeta =
        dataElements || attributes ? { dataElements: dataElements || undefined, attributes: attributes || undefined } : null
    return buildVarMap(ruleVariables || [], merged, typeMeta, ruleVarContext)
}

/** Same semantics as rule engine for stage-scoped actions (incl. HIDESECTION ownership). */
const actionAppliesToStage = (action, programStageId, sectionIdToProgramStageId) =>
    actionAppliesInProgramStageContext(action, programStageId, sectionIdToProgramStageId)

const normalizeProgramRuleActionTypeForAdapter = (raw) => {
    let t = String(raw ?? '')
        .trim()
        .toUpperCase()
        .replace(/-/g, '_')
    if (t === 'HIDE_FIELD') return 'HIDEFIELD'
    if (t === 'HIDE_SECTION') return 'HIDESECTION'
    if (t === 'HIDE_PROGRAM_STAGE') return 'HIDEPROGRAMSTAGE'
    if (t === 'SET_MANDATORY_FIELD') return 'SETMANDATORYFIELD'
    if (t === 'MANDATORYFIELD') return 'SETMANDATORYFIELD'
    if (t === 'ASSIGN_VALUE') return 'ASSIGN'
    return t
}

const idFromMetadataRef = (ref) => {
    if (ref == null) return null
    if (typeof ref === 'string') return ref
    if (typeof ref === 'object' && ref.id) return String(ref.id)
    return null
}

/**
 * Event-stage program rules (hide field, mandatory, assign) using the same condition pipeline as registration/profile.
 * @param {{ rules: any[], contextMap: Record<string, unknown>, stageId: string, sectionIdToProgramStageId?: Record<string, string>, formValuesForV?: Record<string, string>, typeMeta?: { dataElements?: Record<string, unknown>, attributes?: unknown[] }|null, ruleVariables?: any[]|null }} params
 */
export const evaluateProgramRules = ({
    rules,
    contextMap,
    stageId,
    sectionIdToProgramStageId = null,
    formValuesForV = {},
    typeMeta = null,
    ruleVariables = null,
}) => {
    const effects = {
        hidden: {},
        mandatory: {},
        assignedValues: {},
    }

    const sortedRules = [...(rules || [])].sort((a, b) => {
        const pa = Number(a?.priority)
        const pb = Number(b?.priority)
        const na = Number.isFinite(pa) ? pa : 999999
        const nb = Number.isFinite(pb) ? pb : 999999
        if (na !== nb) return na - nb
        return String(a?.id || a?.name || '').localeCompare(String(b?.id || b?.name || ''))
    })

    for (const rule of sortedRules) {
        const ruleStage = idFromMetadataRef(rule?.programStage)
        if (ruleStage) {
            if (!stageId || ruleStage !== stageId) continue
        }

        const prepared = prepareRuleConditionExpression(
            rule.condition,
            contextMap,
            formValuesForV,
            typeMeta,
            ruleVariables
        )
        if (!evalPreparedCondition(prepared, contextMap)) continue

        for (const action of rule.programRuleActions || []) {
            if (!actionAppliesToStage(action, stageId, sectionIdToProgramStageId)) continue

            const act = normalizeProgramRuleActionTypeForAdapter(action.programRuleActionType)
            const dataElementId = idFromMetadataRef(action.dataElement)
            const teaId = idFromMetadataRef(action.trackedEntityAttribute)

            if (act === 'HIDEFIELD') {
                if (dataElementId) effects.hidden[dataElementId] = true
                if (teaId) effects.hidden[teaId] = true
            }
            if (act === 'SETMANDATORYFIELD') {
                if (dataElementId) effects.mandatory[dataElementId] = true
                if (teaId) effects.mandatory[teaId] = true
            }
            if (act === 'ASSIGN' && action.data) {
                const resolved = evalAssignValue(action.data, contextMap)
                if (dataElementId) effects.assignedValues[dataElementId] = resolved
                if (teaId) effects.assignedValues[teaId] = resolved
            }
        }
    }

    return effects
}
