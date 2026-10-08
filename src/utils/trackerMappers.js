/** Tracker payloads may use `attribute` (uid) or nested `trackedEntityAttribute.id`. */
export const trackedEntityAttributeIdFromEntry = (entry) => {
    if (!entry || typeof entry !== 'object') return ''
    if (entry.attribute) return String(entry.attribute)
    const ta = entry.trackedEntityAttribute
    if (ta && typeof ta === 'object' && ta.id) return String(ta.id)
    if (typeof ta === 'string') return ta
    return ''
}

export const teiAttributesToMap = (tei) => {
    const result = {}
    for (const attribute of tei?.attributes || []) {
        const id = trackedEntityAttributeIdFromEntry(attribute)
        if (id) result[id] = attribute.value
    }
    return result
}

export const mergeAssignedValues = (values, assignedValues) => {
    return {
        ...values,
        ...assignedValues,
    }
}
