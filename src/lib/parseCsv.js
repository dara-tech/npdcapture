/** Parse CSV text into rows of string cells (handles quoted fields). */
export function parseCsvRows(text) {
    const raw = String(text || '').replace(/^\uFEFF/, '')
    const rows = []
    let row = []
    let cell = ''
    let inQuotes = false

    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i]
        const next = raw[i + 1]

        if (inQuotes) {
            if (ch === '"' && next === '"') {
                cell += '"'
                i++
            } else if (ch === '"') {
                inQuotes = false
            } else {
                cell += ch
            }
            continue
        }

        if (ch === '"') {
            inQuotes = true
            continue
        }
        if (ch === ',') {
            row.push(cell)
            cell = ''
            continue
        }
        if (ch === '\n' || (ch === '\r' && next === '\n')) {
            row.push(cell)
            if (row.some((c) => String(c).trim() !== '')) rows.push(row)
            row = []
            cell = ''
            if (ch === '\r') i++
            continue
        }
        if (ch === '\r') {
            row.push(cell)
            if (row.some((c) => String(c).trim() !== '')) rows.push(row)
            row = []
            cell = ''
            continue
        }
        cell += ch
    }

    row.push(cell)
    if (row.some((c) => String(c).trim() !== '')) rows.push(row)
    return rows
}
