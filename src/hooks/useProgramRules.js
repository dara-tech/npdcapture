import { useState, useEffect } from 'react'
import { evaluateRules } from '../services/ruleEngine'

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
 * Client-side program rules for registration and tracker profile/event forms.
 * @param {Object} metadata - Normalized program metadata (rules + ruleVariables)
 * @param {Object} formValues - Map of trackedEntityAttribute id and/or dataElement id → value
 * @param {{ programStageId?: string|null, ruleVarContext?: { enrollmentEvents?: unknown[], currentEventId?: string|null, currentProgramStageId?: string|null, evaluatingDraftEvent?: boolean, eventStatusOverride?: string|null, snapshotEventStatus?: string|null, snapshotEventOccurredAt?: string|null, snapshotEventDueDate?: string|null, snapshotEventCompletedAt?: string|null }|null, dhis2Context?: { enrollment: object, tei: object, programName?: string }|null }} [context] - When `dhis2Context` has enrollment + tei, rules run through @dhis2/rule-engine when possible.
 */
export const useProgramRules = (metadata, formValues, context = {}) => {
    const { programStageId = null, ruleVarContext = null, dhis2Context = null } = context
    const [ruleEffects, setRuleEffects] = useState(() => emptyEffects())

    useEffect(() => {
        if (!metadata?.rules?.length) {
            setRuleEffects(emptyEffects())
            return
        }

        try {
            const effects = evaluateRules({
                rules: metadata.rules,
                variables: metadata.ruleVariables || [],
                formValues,
                programStageId,
                sectionIdToProgramStageId: metadata.sectionIdToProgramStageId || null,
                dataElements: metadata.dataElements || null,
                attributes: metadata.attributes || null,
                ruleVarContext,
                dhis2Context,
            })
            setRuleEffects(effects)
        } catch (e) {
            console.error('[Capture] Program rules evaluation failed', e)
            setRuleEffects(emptyEffects())
        }
    }, [metadata, formValues, programStageId, ruleVarContext, dhis2Context])

    return ruleEffects
}
