import { formatUuic, resolveUuicSourceAttributeIds } from '../../../lib/uuic'

const attrValue = (attrMap, attrId) =>
    attrId != null ? String(attrMap.get(attrId) ?? '').trim() : ''

/**
 * Fill UUIC when empty and last name, first name, sex, and date of birth are present.
 */
export const applyUuicToAttributeMap = (attrMap, programAttributes = []) => {
    if (!attrMap || !programAttributes?.length) return attrMap

    const ids = resolveUuicSourceAttributeIds(programAttributes)
    if (!ids.uuic) return attrMap

    const existing = attrMap.get(ids.uuic)
    if (existing != null && String(existing).trim() !== '') return attrMap

    const sexAttr = programAttributes.find((a) => a.id === ids.sex) || null
    const code = formatUuic({
        lastName: attrValue(attrMap, ids.lastName),
        firstName: attrValue(attrMap, ids.firstName),
        sex: attrValue(attrMap, ids.sex),
        dob: attrValue(attrMap, ids.dob),
        sexAttribute: sexAttr,
    })

    if (code) attrMap.set(ids.uuic, code)
    return attrMap
}

export const applyUuicToImportAttributes = (attributes = [], programAttributes = []) => {
    const map = new Map()
    for (const item of attributes) {
        if (item?.attribute) map.set(item.attribute, item.value)
    }
    applyUuicToAttributeMap(map, programAttributes)
    return [...map.entries()].map(([attribute, value]) => ({ attribute, value }))
}
