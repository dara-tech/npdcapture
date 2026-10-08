const escapeCsv = (value) => {
    const s = String(value ?? '')
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
}

export const downloadImportTemplateCsv = (headers, fileName) => {
    const list = (headers || []).filter(Boolean)
    if (!list.length) return false

    const headerLine = list.map(escapeCsv).join(',')
    const blob = new Blob([`\uFEFF${headerLine}\n`], {
        type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    return true
}
