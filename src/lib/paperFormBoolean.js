import i18n from '@dhis2/d2-i18n'

/** Normalize DHIS2 BOOLEAN / TRUE_ONLY values for paper form controls. */

/** DHIS2 attaches a 2-option set (codes true/false) to many BOOLEAN data elements. */
export function isBooleanYesNoOptionSet(options = []) {
    if (!options?.length || options.length > 3) return false
    const codes = new Set(
        options
            .map((o) => String(o?.code ?? o?.id ?? '').trim().toLowerCase())
            .filter(Boolean)
    )
    return codes.has('true') && codes.has('false')
}

/** Map DHIS2 boolean option codes/names to Capture labels (ទេ / បាទ·ចាស in km). */
export function booleanOptionDisplayLabel(opt) {
    if (!opt) return null
    const code = String(opt.code ?? '').trim().toLowerCase()
    const name = String(opt.name || opt.displayName || opt.systemName || '')
        .trim()
        .toLowerCase()
    if (code === 'true' || name === 'true' || name === 'yes') return i18n.t('Yes')
    if (code === 'false' || name === 'false' || name === 'no') return i18n.t('No')
    return null
}

export function coerceBooleanFormDisplay(value) {
    if (value === true) return 'true'
    if (value === false) return 'false'
    const s = String(value ?? '').trim().toLowerCase()
    if (s === 'true') return 'true'
    if (s === 'false') return 'false'
    return ''
}

export function normalizeBooleanFieldValue(value, { mandatory = false, trueOnly = false } = {}) {
    const display = coerceBooleanFormDisplay(value)
    if (display === 'true') return 'true'
    if (display === 'false') return trueOnly ? '' : 'false'
    if (trueOnly) return ''
    return mandatory ? 'false' : ''
}
