import * as XLSX from 'xlsx'
import { normalizeImportHeaderKey } from './importHeaderNormalize'
import { normalizeImportDate } from './importDateParse'
import { TEMPLATE_HEADER_ROW } from './importTemplateExcel'
import { IMPORT_META_HEADERS } from './importMetaColumns'

const escapeCsvCell = (value) => {
    const s = String(value ?? '')
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
}

const VISIT_HEADER_KEYS = new Set([
    normalizeImportHeaderKey(IMPORT_META_HEADERS.eventDate),
    normalizeImportHeaderKey(IMPORT_META_HEADERS.status),
    normalizeImportHeaderKey(IMPORT_META_HEADERS.stage),
    'eventdate',
    'visitdate',
    'occurredat',
    'status',
    'eventstatus',
    'visitstatus',
    'stage',
    'programstage',
])

const cellDisplayValue = (cell) => {
    if (!cell) return ''
    if (cell.t === 'd' && cell.v instanceof Date) {
        return normalizeImportDate(cell.v)
    }
    if (cell.w != null && String(cell.w).trim() !== '') {
        return String(cell.w).trim()
    }
    if (cell.v != null && cell.v !== '') {
        if (cell.t === 'n' && cell.z && String(cell.z).includes('y')) {
            return normalizeImportDate(cell.v)
        }
        return cell.v
    }
    return ''
}

const worksheetToRows = (worksheet) => {
    const ref = worksheet['!ref']
    if (!ref) return []

    const range = XLSX.utils.decode_range(ref)
    const rows = []

    for (let r = range.s.r; r <= range.e.r; r += 1) {
        const row = []
        for (let c = range.s.c; c <= range.e.c; c += 1) {
            const addr = XLSX.utils.encode_cell({ r, c })
            const val = cellDisplayValue(worksheet[addr])
            row.push(val == null ? '' : val)
        }
        rows.push(row)
    }
    return rows
}

const scoreHeaderRow = (row, attrHeaderKeys, deHeaderKeys) => {
    let score = 0
    for (const cell of row || []) {
        const key = normalizeImportHeaderKey(cell)
        if (!key) continue
        if (attrHeaderKeys?.has(key)) score += 2
        if (deHeaderKeys?.has(key)) score += 1
        if (VISIT_HEADER_KEYS.has(key)) score += 2
    }
    return score
}

const findHeaderRowIndex = (rows, attrHeaderKeys, deHeaderKeys) => {
    let bestIndex = Math.max(0, TEMPLATE_HEADER_ROW - 1)
    let bestScore = 0

    const scanLimit = Math.min(rows.length, 25)
    for (let i = 0; i < scanLimit; i += 1) {
        const score = scoreHeaderRow(rows[i], attrHeaderKeys, deHeaderKeys)
        if (score > bestScore) {
            bestScore = score
            bestIndex = i
        }
    }

    return bestScore >= 2 ? bestIndex : Math.max(0, TEMPLATE_HEADER_ROW - 1)
}

/**
 * Excel → CSV text for parsers. Finds the real header row and preserves date/formula values.
 */
export const sheetToCsvText = (worksheet, { attrHeaderKeys, deHeaderKeys } = {}) => {
    const rows = worksheetToRows(worksheet)
    if (!rows.length) return ''

    const headerIndex = findHeaderRowIndex(rows, attrHeaderKeys, deHeaderKeys)
    const dataRows = rows
        .slice(headerIndex)
        .filter((row) => (row || []).some((cell) => String(cell ?? '').trim() !== ''))

    if (!dataRows.length) return ''
    return dataRows.map((row) => (row || []).map(escapeCsvCell).join(',')).join('\n')
}

/**
 * Read CSV/JSON as text; Excel templates → CSV text for existing parsers.
 */
export const readImportFileText = async (file, { attrHeaderKeys, deHeaderKeys } = {}) => {
    const name = String(file?.name || '').toLowerCase()
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
        return file.text()
    }

    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, {
        type: 'array',
        cellDates: true,
        cellNF: true,
        cellText: true,
    })
    const sheetName =
        workbook.SheetNames.find((n) => n === 'Import') || workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    if (!worksheet) return ''

    return sheetToCsvText(worksheet, { attrHeaderKeys, deHeaderKeys })
}
