/** Safe helpers for paper form (avoid crashes when rules/metadata are partial). */

export function mandatoryFieldSetHas(mandatoryFieldIds, fieldId) {
    if (!fieldId) return false
    if (mandatoryFieldIds instanceof Set) return mandatoryFieldIds.has(fieldId)
    if (Array.isArray(mandatoryFieldIds)) return mandatoryFieldIds.includes(fieldId)
    return false
}

export function hiddenFieldOptionSet(hiddenOptionsByField, fieldId) {
    const raw = hiddenOptionsByField?.[fieldId]
    if (raw instanceof Set) return raw
    return null
}
