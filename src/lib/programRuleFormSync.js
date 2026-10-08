import { trackerDataEntryValueIsPresent } from './trackerProgramRuleFieldUi'

/**
 * Apply ASSIGN effects without overwriting values the user already entered.
 * @param {Record<string, unknown>} prev
 * @param {Record<string, unknown>} assigned
 * @param {{ dataElements?: Record<string, { valueType?: string }>, attributeIds?: Set<string> }} [opts]
 */
export function applyRuleAssignedValues(prev, assigned, { dataElements = {}, attributeIds = null } = {}) {
    if (!assigned || typeof assigned !== 'object') return prev

    const next = { ...prev }
    let changed = false

    for (const [k, v] of Object.entries(assigned)) {
        const deMeta = dataElements[k]
        if (deMeta) {
            if (trackerDataEntryValueIsPresent(prev[k])) continue
            if (String(prev[k] ?? '') !== String(v ?? '')) {
                next[k] = v
                changed = true
            }
            continue
        }

        if (attributeIds?.has?.(k)) {
            if (trackerDataEntryValueIsPresent(prev[k])) continue
            if (String(prev[k] ?? '') !== String(v ?? '')) {
                next[k] = v
                changed = true
            }
        }
    }

    return changed ? next : prev
}
