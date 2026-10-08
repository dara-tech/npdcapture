import { TEMPLATE_DATA_FIRST_ROW, TEMPLATE_HEADER_ROW } from './importTemplateExcel'

/** Rows between header and first data row in the Excel template (row 2 = example). */
export const DEFAULT_SKIP_ROWS_AFTER_HEADER =
    TEMPLATE_DATA_FIRST_ROW - TEMPLATE_HEADER_ROW - 1

const MAX_SKIP_ROWS = 20

export function normalizeSkipRowsAfterHeader(value) {
    const n = Number.parseInt(String(value ?? ''), 10)
    if (!Number.isFinite(n) || n < 0) return DEFAULT_SKIP_ROWS_AFTER_HEADER
    return Math.min(MAX_SKIP_ROWS, n)
}

export function dataRowLoopStart(headerRowIndex, skipRowsAfterHeader) {
    const skip = normalizeSkipRowsAfterHeader(skipRowsAfterHeader)
    return Math.max(0, headerRowIndex) + 1 + skip
}
