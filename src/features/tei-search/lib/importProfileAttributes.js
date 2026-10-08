import i18n from '@dhis2/d2-i18n'
import { normalizeProgramMetadata } from '../../../services/metadataService'

/** Map program API payload → attributes with mandatory, valueType, etc. */
export const mapProgramAttributesFromMetadata = (metadata) => {
    const normalized = normalizeProgramMetadata(metadata)
    return normalized?.attributes || []
}

/** Yes/No profile fields: default Off in capture; not required in import CSV. */
export const isImportOptionalToggleAttribute = (attr) => {
    const vt = attr?.valueType
    return vt === 'BOOLEAN' || vt === 'TRUE_ONLY'
}

export const isImportRequiredProfileAttribute = (attr) =>
    Boolean(attr?.mandatory) && !isImportOptionalToggleAttribute(attr)

export const formatProfileAttributeImportHeader = (attr, { markRequired = true } = {}) => {
    const label = attr?.displayName || attr?.name || attr?.id || ''
    if (!markRequired) return label
    return isImportRequiredProfileAttribute(attr) ? `${label} *` : label
}

/** Empty CSV cells → Off (No) for mandatory boolean / true-only attributes. */
export const applyProfileImportAttributeDefaults = (attrMap, programAttributes = []) => {
    for (const attr of programAttributes) {
        if (!attr?.mandatory || attrMap.has(attr.id)) continue
        if (attr.valueType === 'BOOLEAN') {
            attrMap.set(attr.id, 'false')
        } else if (attr.valueType === 'TRUE_ONLY') {
            attrMap.set(attr.id, '')
        }
    }
}

export const validateRequiredProfileAttributes = (attributes, programAttributes, line) => {
    const provided = new Set((attributes || []).map((a) => a.attribute))
    const missing = (programAttributes || [])
        .filter((a) => isImportRequiredProfileAttribute(a))
        .filter((a) => !provided.has(a.id))
        .map((a) => a.displayName || a.name || a.id)

    if (missing.length === 0) return null
    return i18n.t('Row {{line}} — missing required field(s) — {{fields}}', {
        line,
        fields: missing.join(', '),
    })
}
