/** Parse dates from CSV cells or Excel serial numbers. */

export const excelSerialToIsoDate = (serial) => {
    const num = Number(serial)
    if (!Number.isFinite(num) || num < 1000) return ''
    const utc = Math.round((num - 25569) * 86400 * 1000)
    const d = new Date(utc)
    if (Number.isNaN(d.getTime())) return ''
    return d.toISOString().slice(0, 10)
}

export const normalizeImportDate = (raw) => {
    if (raw instanceof Date) {
        if (Number.isNaN(raw.getTime())) return ''
        return raw.toISOString().slice(0, 10)
    }
    if (raw == null || raw === '') return ''

    const s = String(raw).trim()
    if (!s) return ''

    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)

    if (/^\d+(\.\d+)?$/.test(s)) {
        const iso = excelSerialToIsoDate(s)
        if (iso) return iso
    }

    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return ''
    return d.toISOString().slice(0, 10)
}
