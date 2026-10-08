import i18n from '@dhis2/d2-i18n'
import { parseCsvRows } from '../../admin/lib/parseUsersCsv'
import {
    applyProfileImportAttributeDefaults,
    validateRequiredProfileAttributes,
} from './importProfileAttributes'
import { readImportFileText } from './readImportFileText'
import { applyUuicToAttributeMap } from './applyImportUuic'
import { applyImportOptionValuesToAttrMap } from './importOptionValues'
import { normalizeImportHeaderKey as normalizeHeader } from './importHeaderNormalize'
import {
    DEFAULT_SKIP_ROWS_AFTER_HEADER,
    dataRowLoopStart,
    normalizeSkipRowsAfterHeader,
} from './importRowSkip'

const SKIP_HEADERS = new Set([
    'id',
    'trackedentity',
    'trackedentityid',
    'trackedentityinstance',
    'enrollment',
    'enrollmentid',
])

const buildAttributeHeaderMap = (programAttributes = []) => {
    const map = new Map()
    for (const attr of programAttributes) {
        const id = attr?.id
        if (!id) continue
        const labels = [attr.id, attr.name, attr.displayName, attr.code, attr.shortName].filter(
            Boolean
        )
        for (const label of labels) {
            const key = normalizeHeader(label)
            if (key && !map.has(key)) map.set(key, id)
        }
    }
    return map
}

const rowToAttributes = (cells, headers, headerMap, programAttributes) => {
    const attrMap = new Map()
    const unknownHeaders = []

    headers.forEach((header, colIndex) => {
        const key = normalizeHeader(header)
        if (!key || SKIP_HEADERS.has(key)) return
        const attrId = headerMap.get(key)
        if (!attrId) {
            unknownHeaders.push(String(header).trim())
            return
        }
        const raw = cells[colIndex]
        const value = raw == null ? '' : String(raw).trim()
        if (value !== '') attrMap.set(attrId, value)
    })

    applyProfileImportAttributeDefaults(attrMap, programAttributes)
    applyImportOptionValuesToAttrMap(attrMap, programAttributes)
    applyUuicToAttributeMap(attrMap, programAttributes)

    return {
        attributes: [...attrMap.entries()].map(([attribute, value]) => ({
            attribute,
            value,
        })),
        unknownHeaders,
    }
}

const validateMandatory = (attributes, programAttributes, line) =>
    validateRequiredProfileAttributes(attributes, programAttributes, line)

export const parseRecordsCsvText = (
    text,
    programAttributes = [],
    { skipRowsAfterHeader = DEFAULT_SKIP_ROWS_AFTER_HEADER } = {}
) => {
    const skipRows = normalizeSkipRowsAfterHeader(skipRowsAfterHeader)
    const errors = []
    const warnings = []
    const table = parseCsvRows(text)
    if (!table.length) {
        return { rows: [], errors: [i18n.t('Import file is empty.')], warnings: [] }
    }

    const headerMap = buildAttributeHeaderMap(programAttributes)
    const headerRowIndex = table.findIndex((row) =>
        row.some((cell) => headerMap.has(normalizeHeader(cell)))
    )
    if (headerRowIndex < 0) {
        return {
            rows: [],
            errors: [
                i18n.t(
                    'No recognised attribute columns. Use the same column names as export, or download the import template.'
                ),
            ],
            warnings: [],
        }
    }

    const headers = table[headerRowIndex]
    const rows = []
    const dataStart = dataRowLoopStart(headerRowIndex, skipRows)

    for (let i = dataStart; i < table.length; i++) {
        const cells = table[i]
        if (!cells.some((c) => String(c || '').trim() !== '')) continue
        const line = i + 1
        const { attributes, unknownHeaders } = rowToAttributes(
            cells,
            headers,
            headerMap,
            programAttributes
        )
        if (attributes.length === 0) {
            errors.push(i18n.t('Row {{line}} — no attribute values found.', { line }))
            continue
        }
        if (unknownHeaders.length) {
            warnings.push(
                i18n.t('Row {{line}} — unknown column(s) — {{columns}}', {
                    line,
                    columns: [...new Set(unknownHeaders)].join(', '),
                })
            )
        }
        const mandatoryErr = validateMandatory(attributes, programAttributes, line)
        if (mandatoryErr) {
            errors.push(mandatoryErr)
            continue
        }
        rows.push({ line, attributes })
    }

    return { rows, errors, warnings }
}

export const parseRecordsJsonText = (
    text,
    programAttributes = [],
    { skipRowsAfterHeader = DEFAULT_SKIP_ROWS_AFTER_HEADER } = {}
) => {
    const skipRows = normalizeSkipRowsAfterHeader(skipRowsAfterHeader)
    const errors = []
    const warnings = []
    let data
    try {
        data = JSON.parse(String(text || '').replace(/^\uFEFF/, ''))
    } catch {
        return { rows: [], errors: [i18n.t('Invalid JSON file.')], warnings: [] }
    }

    const list = Array.isArray(data) ? data : data?.records || data?.rows
    if (!Array.isArray(list) || list.length === 0) {
        return { rows: [], errors: [i18n.t('Import file is empty.')], warnings: [] }
    }

    const headerMap = buildAttributeHeaderMap(programAttributes)
    const rows = []

    list.slice(skipRows).forEach((item, index) => {
        const line = index + skipRows + 1
        if (!item || typeof item !== 'object') {
            errors.push(i18n.t('Row {{line}} — invalid record.', { line }))
            return
        }
        const attrMap = new Map()
        for (const [key, raw] of Object.entries(item)) {
            const norm = normalizeHeader(key)
            if (!norm || SKIP_HEADERS.has(norm)) continue
            const attrId = headerMap.get(norm)
            if (!attrId) continue
            const value = raw == null ? '' : String(raw).trim()
            if (value !== '') attrMap.set(attrId, value)
        }
        applyProfileImportAttributeDefaults(attrMap, programAttributes)
        applyImportOptionValuesToAttrMap(attrMap, programAttributes)
        applyUuicToAttributeMap(attrMap, programAttributes)
        const attributes = [...attrMap.entries()].map(([attribute, value]) => ({
            attribute,
            value,
        }))
        if (attributes.length === 0) {
            errors.push(i18n.t('Row {{line}} — no attribute values found.', { line }))
            return
        }
        const mandatoryErr = validateMandatory(attributes, programAttributes, line)
        if (mandatoryErr) {
            errors.push(mandatoryErr)
            return
        }
        rows.push({ line, attributes })
    })

    return { rows, errors, warnings }
}

export const parseRecordsImportFile = async (
    file,
    programAttributes = [],
    { skipRowsAfterHeader = DEFAULT_SKIP_ROWS_AFTER_HEADER } = {}
) => {
    if (!file) return { rows: [], errors: [], warnings: [] }
    const name = String(file.name || '').toLowerCase()
    const headerMap = buildAttributeHeaderMap(programAttributes)
    const text = await readImportFileText(file, {
        attrHeaderKeys: new Set(headerMap.keys()),
    })
    const skipOpts = { skipRowsAfterHeader }

    if (name.endsWith('.json')) {
        return parseRecordsJsonText(text, programAttributes, skipOpts)
    }
    return parseRecordsCsvText(text, programAttributes, skipOpts)
}
