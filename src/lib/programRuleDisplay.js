import { decodeBasicHtmlEntities } from './utils'

export function idFromProgramRuleRef(ref) {
    if (ref == null) return null
    if (typeof ref === 'string') return ref.trim() || null
    return ref.id || ref.uid || null
}

export function resolveActionDataElementId(action, metadata) {
    const fromRef = idFromProgramRuleRef(action?.dataElement)
    if (fromRef) return fromRef
    const data =
        action?.data != null && String(action.data).trim() !== ''
            ? String(action.data).trim()
            : null
    if (data && metadata?.dataElements?.[data]) return data
    return null
}

export function resolveActionTrackedEntityAttributeId(action, metadata) {
    const fromRef = idFromProgramRuleRef(action?.trackedEntityAttribute)
    if (fromRef) return fromRef
    const data =
        action?.data != null && String(action.data).trim() !== ''
            ? String(action.data).trim()
            : null
    if (data && metadata?.attributes?.some((a) => a.id === data)) return data
    return null
}

export function ruleHasDataElementAction(rule, metadata) {
    return (rule?.programRuleActions || []).some((a) => resolveActionDataElementId(a, metadata))
}

export function summarizeProgramRuleAction(action, metadata) {
    const t = action?.programRuleActionType ?? ''
    const parts = [t]
    if (action?.content) parts.push(String(action.content))

    const deId = resolveActionDataElementId(action, metadata)
    const teaId = resolveActionTrackedEntityAttributeId(action, metadata)

    if (deId) {
        const de = metadata?.dataElements?.[deId]
        const label = de ? decodeBasicHtmlEntities(de.displayName || de.name || deId) : deId
        parts.push(`DE: ${label} (${deId})`)
    } else if (teaId) {
        const attr = metadata?.attributes?.find((a) => a.id === teaId)
        const label = attr ? decodeBasicHtmlEntities(attr.name || teaId) : teaId
        parts.push(`TEA: ${label} (${teaId})`)
    } else if (action?.data != null && String(action.data).trim() !== '') {
        parts.push(`data: ${String(action.data)}`)
    }

    const secId = idFromProgramRuleRef(action?.programStageSection)
    if (secId) parts.push(`Section ${secId}`)
    const stageId = idFromProgramRuleRef(action?.programStage)
    if (stageId) {
        const stage = metadata?.stages?.find((s) => s.id === stageId)
        const stageLabel = stage
            ? decodeBasicHtmlEntities(stage.name || stageId)
            : stageId
        parts.push(`Stage: ${stageLabel} (${stageId})`)
    }
    const optId = idFromProgramRuleRef(action?.option)
    if (optId) parts.push(`Option ${optId}`)
    return parts.join(' · ')
}
