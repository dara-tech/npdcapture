import { formatProfileAttributeImportHeader } from './importProfileAttributes'

const escapeCsv = (value) => `"${String(value || '').replace(/"/g, '""')}"`

export function downloadRecordsImportTemplate(programAttributes = [], attributeIds = null) {
    const idSet = attributeIds ? new Set(attributeIds) : null
    const attrs = programAttributes.filter((a) => a?.id && (!idSet || idSet.has(a.id)))
    const headers = attrs.map((a) => formatProfileAttributeImportHeader(a))
    const headerLine = headers.map(escapeCsv).join(',')
    const blob = new Blob([`\uFEFF${headerLine}\n`], {
        type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `personnel_import_template_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
}
