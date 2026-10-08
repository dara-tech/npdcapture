/**
 * Map import file labels (Khmer/English/display names) → DHIS2 option codes / boolean strings.
 */
import { resolveStageOptionDisplayLabel } from '../../../lib/stageFieldLabelI18n'

const normKey = (s) =>
    String(s || '')
        .normalize('NFKC')
        .normalize('NFC')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()

const compactKey = (s) => normKey(s).replace(/[\s._\-–—/\\]+/g, '')

const decodeHtmlEntities = (s) =>
    String(s || '')
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')

const BOOL_TRUE = new Set([
    'yes',
    'true',
    '1',
    'y',
    'បាទ',
    'បាន',
    'មាន',
    'completed',
])
const BOOL_FALSE = new Set([
    'no',
    'false',
    '0',
    'n',
    'ទេ',
    'មិន',
    'មិនមាន',
    'off',
])

const boolLabelToApi = (raw) => {
    const s = normKey(decodeHtmlEntities(String(raw ?? '').trim()))
    if (BOOL_TRUE.has(s)) return 'true'
    if (BOOL_FALSE.has(s)) return 'false'
    return null
}

const optionApiValue = (opt) => {
    if (!opt) return ''
    const code = opt.code != null ? String(opt.code).trim() : ''
    if (code) return code
    if (opt.id != null) return String(opt.id).trim()
    return ''
}

const optionLabels = (opt) => {
    const display = resolveStageOptionDisplayLabel(opt)
    const labels = [
        opt?.code,
        opt?.id,
        opt?.displayName,
        opt?.name,
        opt?.systemName,
        opt?.shortName,
        display,
    ]
        .filter((v) => v != null && String(v).trim() !== '')
        .map((v) => decodeHtmlEntities(String(v).trim()))
    return [...new Set(labels)]
}

/** Value in parentheses at end, e.g. "ស្ត្រី… (FEW)" → "FEW". */
const trailingParenToken = (value) => {
    const m = String(value || '').match(/\(([^)]+)\)\s*$/u)
    return m ? String(m[1]).trim() : ''
}

export const valueMatchesImportOption = (value, opt) => {
    const v = decodeHtmlEntities(String(value ?? '').trim())
    if (!v || !opt) return false

    for (const label of optionLabels(opt)) {
        if (label === v) return true
        if (normKey(label) === normKey(v)) return true
        if (compactKey(label) === compactKey(v)) return true
    }

    const code = optionApiValue(opt)
    if (code && (code === v || normKey(code) === normKey(v))) return true

    const paren = trailingParenToken(v)
    if (paren && (paren === code || normKey(paren) === normKey(code))) return true

    return false
}

export const findImportOptionMatch = (value, options = []) => {
    const v = String(value ?? '').trim()
    if (!v) return null
    return (options || []).find((opt) => valueMatchesImportOption(v, opt)) || null
}

const resolveBooleanImportValue = (raw) => {
    const s = normKey(decodeHtmlEntities(String(raw ?? '').trim()))
    if (!s) return ''
    const mapped = boolLabelToApi(raw)
    if (mapped) return mapped
    return String(raw).trim()
}

/**
 * @param {string} raw Cell value from CSV/Excel
 * @param {{ valueType?: string, optionSet?: { options?: object[] } }|null} field Attribute or DE
 * @returns {string} Value safe for tracker API
 */
export const resolveImportFieldValue = (raw, field) => {
    if (raw == null) return ''
    const s = String(raw).trim()
    if (!s) return ''

    const vt = field?.valueType
    if (vt === 'BOOLEAN') return resolveBooleanImportValue(s)
    if (vt === 'TRUE_ONLY') {
        const resolved = resolveBooleanImportValue(s)
        return resolved === 'true' ? 'true' : ''
    }

    const opts = field?.optionSet?.options
    if (!Array.isArray(opts) || !opts.length) return s

    const opt = findImportOptionMatch(s, opts)
    if (!opt) return s
    return optionApiValue(opt) || s
}

export const applyImportOptionValuesToAttrMap = (attrMap, programAttributes = []) => {
    if (!attrMap || !programAttributes?.length) return attrMap
    for (const attr of programAttributes) {
        const id = attr?.id
        if (!id || !attrMap.has(id)) continue
        const raw = attrMap.get(id)
        const resolved = resolveImportFieldValue(raw, attr)
        if (resolved !== raw) attrMap.set(id, resolved)
    }
    return attrMap
}

const stageDeById = (stage) => {
    const byId = new Map()
    for (const psde of stage?.programStageDataElements || []) {
        const de = psde?.dataElement
        if (de?.id) byId.set(de.id, de)
    }
    return byId
}

export const applyImportOptionValuesToDataValues = (dataValues = [], stage) => {
    if (!stage || !dataValues?.length) return dataValues
    const byId = stageDeById(stage)
    return dataValues.map((dv) => {
        const de = byId.get(dv.dataElement)
        if (!de) return dv
        const resolved = resolveImportFieldValue(dv.value, de)
        return resolved === dv.value ? dv : { ...dv, value: resolved }
    })
}

export const sanitizeImportRowForApi = (row, { programAttributes = [], programStages = [] } = {}) => {
    if (!row) return row
    const attrMap = new Map((row.attributes || []).map((a) => [a.attribute, a.value]))
    applyImportOptionValuesToAttrMap(attrMap, programAttributes)
    const attributes = [...attrMap.entries()].map(([attribute, value]) => ({ attribute, value }))

    let dataValues = row.dataValues || []
    if (row.stageId) {
        const stage = (programStages || []).find((s) => s.id === row.stageId)
        dataValues = applyImportOptionValuesToDataValues(dataValues, stage)
    }

    return { ...row, attributes, dataValues }
}

/** Dropdown / validation list: API codes (re-import safe). */
export const importOptionCodesFromField = (field) =>
    (field?.optionSet?.options || [])
        .map((o) => optionApiValue(o))
        .filter(Boolean)

/** Excel dropdown labels — Khmer/display names (import maps these to API codes). */
export const importOptionLabelsFromField = (field) => {
    const vt = field?.valueType
    if (vt === 'BOOLEAN' || vt === 'TRUE_ONLY') {
        return ['ទេ', 'បាទ']
    }
    return [...new Set(
        (field?.optionSet?.options || [])
            .map((o) => resolveStageOptionDisplayLabel(o))
            .filter(Boolean)
    )]
}
