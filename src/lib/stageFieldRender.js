/**
 * Program stage data element display (DHIS2 {@link https://github.com/dhis2/dhis2-core/blob/master/dhis-2/dhis-api/src/main/java/org/hisp/dhis/render/type/ValueTypeRenderingType.java ValueTypeRenderingType}).
 */

export const extractProgramStageRenderType = (renderType) => {
    if (!renderType || typeof renderType !== 'object') return null
    const layer =
        renderType.DESKTOP ||
        renderType.MOBILE ||
        renderType.TABLET ||
        Object.values(renderType).find((v) => v && typeof v === 'object')
    if (!layer || typeof layer !== 'object') return null
    const raw = layer.type ?? layer.TYPE
    if (raw == null || raw === '') return null
    return String(raw).trim().toUpperCase().replace(/-/g, '_')
}

const radioRenderTypes = new Set([
    'VERTICAL_RADIOBUTTONS',
    'HORIZONTAL_RADIOBUTTONS',
    'SHARED_HEADER_RADIOBUTTONS',
])

const checkboxRenderTypes = new Set(['VERTICAL_CHECKBOXES', 'HORIZONTAL_CHECKBOXES'])

/** DHIS2 Maintenance: Yes/No radios in the section header (not a full-width body row). */
export const usesSharedHeaderRadio = (de) =>
    de?.stageRenderType === 'SHARED_HEADER_RADIOBUTTONS'

/** @returns {'DROPDOWN'|'VERTICAL_RADIO'|'HORIZONTAL_RADIO'|'VERTICAL_MULTI'|'HORIZONTAL_MULTI'} */
export const optionSetUiVariant = (de) => {
    if (!de?.optionSet?.options?.length) return 'DROPDOWN'
    if (de.renderOptionsAsRadio) {
        const count = de.optionSet.options.length
        return count > 4 ? 'HORIZONTAL_RADIO' : 'VERTICAL_RADIO'
    }
    const rt = de.stageRenderType
    if (!rt || rt === 'DEFAULT') return 'DROPDOWN'
    if (rt === 'DROPDOWN') return 'DROPDOWN'
    if (radioRenderTypes.has(rt)) return rt === 'HORIZONTAL_RADIOBUTTONS' ? 'HORIZONTAL_RADIO' : 'VERTICAL_RADIO'
    if (checkboxRenderTypes.has(rt)) return rt === 'HORIZONTAL_CHECKBOXES' ? 'HORIZONTAL_MULTI' : 'VERTICAL_MULTI'
    return 'DROPDOWN'
}

/** @returns {'CHECKBOX'|'VERTICAL_RADIO'|'HORIZONTAL_RADIO'|'VERTICAL_MULTI'|'HORIZONTAL_MULTI'|'TOGGLE'} */
export const booleanUiVariant = (de) => {
    const rt = de.stageRenderType
    if (!rt || rt === 'DEFAULT') return 'CHECKBOX'
    if (rt === 'TOGGLE') return 'TOGGLE'
    if (radioRenderTypes.has(rt)) return rt === 'HORIZONTAL_RADIOBUTTONS' ? 'HORIZONTAL_RADIO' : 'VERTICAL_RADIO'
    if (checkboxRenderTypes.has(rt)) return rt === 'HORIZONTAL_CHECKBOXES' ? 'HORIZONTAL_MULTI' : 'VERTICAL_MULTI'
    return 'CHECKBOX'
}

/** Single-select option sets use radio/checkbox groups, not searchable selects. */
const preferRadioOverDropdown = (variant, count) => {
    if (variant === 'VERTICAL_MULTI' || variant === 'HORIZONTAL_MULTI') return variant
    if (variant === 'DROPDOWN' && count >= 2) {
        return count > 4 ? 'HORIZONTAL_RADIO' : 'VERTICAL_RADIO'
    }
    if (variant === 'VERTICAL_RADIO' && count >= 4) return 'HORIZONTAL_RADIO'
    return variant
}

/** Profile / registration tracked-entity attributes. */
export const attributeOptionSetUiVariant = (attr) => {
    const count = attr?.optionSet?.options?.length || 0
    if (!count) return 'DROPDOWN'
    const de = {
        optionSet: attr.optionSet,
        stageRenderType: attr.attrRenderType || null,
        renderOptionsAsRadio: Boolean(attr.renderOptionsAsRadio),
    }
    const variant = optionSetUiVariant(de)
    return preferRadioOverDropdown(variant, count)
}

export const profileOptionFieldSpansFullRow = (attr) =>
    (attr?.optionSet?.options?.length || 0) >= 4

/** Program stage DE (non–medicine-grid cells): radio instead of select. */
export const stageOptionSetUiVariant = (de) => {
    const count = de?.optionSet?.options?.length || 0
    if (!count) return 'DROPDOWN'
    const variant = optionSetUiVariant(de)
    const resolved = preferRadioOverDropdown(variant, count)
    if (resolved === 'DROPDOWN') {
        return count > 4 ? 'HORIZONTAL_RADIO' : 'VERTICAL_RADIO'
    }
    return resolved
}

/** Stage forms: 2–12 options → pill row (Tracker Capture parity for risk / behavior sections). */
export const stageFieldUsesOptionPills = (de) => {
    const count = de?.optionSet?.options?.length || 0
    if (count < 2 || count > 12) return false
    const v = stageOptionSetUiVariant(de)
    return v !== 'VERTICAL_MULTI' && v !== 'HORIZONTAL_MULTI'
}

export const stageOptionFieldUsesChoiceGrid = (de) => {
    const count = de?.optionSet?.options?.length || 0
    if (count < 2) return false
    const variant = stageOptionSetUiVariant(de)
    return variant === 'VERTICAL_RADIO' || variant === 'HORIZONTAL_RADIO'
}

export const parseMultiOptionValue = (raw) => {
    if (raw == null || raw === '') return []
    return String(raw)
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
}

export const joinMultiOptionValue = (codes) => [...new Set(codes.filter(Boolean))].join(';')
