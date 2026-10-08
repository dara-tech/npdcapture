/**
 * Normalize column headers for import matching.
 * Strips template decorations (* required, (auto)) so Excel/CSV headers still match DHIS2 fields.
 */

export const stripImportHeaderLabel = (header) =>
    String(header || '')
        .trim()
        .replace(/\s*[*＊]+\s*$/u, '')
        .replace(/\s*\(\s*auto\s*\)\s*$/iu, '')
        .replace(/\s*\(\s*required\s*\)\s*$/iu, '')
        .trim()

/** Key for header → attribute / data element lookup (ASCII + Khmer letters/digits). */
export const normalizeImportHeaderKey = (header) =>
    stripImportHeaderLabel(header)
        .toLowerCase()
        .normalize('NFC')
        .replace(/[^a-z0-9\u1780-\u17ff]+/g, '')
