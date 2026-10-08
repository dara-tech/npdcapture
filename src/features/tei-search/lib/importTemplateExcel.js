import ExcelJS from 'exceljs'
import i18n from '@dhis2/d2-i18n'
import {
    buildCombinedImportColumns,
    buildPersonnelImportColumns,
    buildStageVisitImportColumns,
} from './importTemplateColumns'
import { applyUuicExcelColumn, buildProfileExampleValueMap } from './importTemplateUuic'
import { importOptionLabelsFromField } from './importOptionValues'

const SHEET_IMPORT = 'Import'
const SHEET_LISTS = '_lists'

/** Row 1 = headers, row 2 = example; data from row 3. */
export const TEMPLATE_HEADER_ROW = 1
export const TEMPLATE_EXAMPLE_ROW = 2
export const TEMPLATE_DATA_FIRST_ROW = 3
const DATA_LAST_ROW = 500

const KHMER_OS_FONT = { name: 'Khmer OS', size: 11 }
const KHMER_OS_FONT_BOLD = { name: 'Khmer OS', size: 11, bold: true }

const excelColLetter = (colIndex) => {
    let letter = ''
    let n = colIndex
    while (n > 0) {
        const rem = (n - 1) % 26
        letter = String.fromCharCode(65 + rem) + letter
        n = Math.floor((n - 1) / 26)
    }
    return letter
}

const optionLabelsFromField = (field) => importOptionLabelsFromField(field)

const validationOptionsForColumn = (col) => {
    if (col.options?.length) return col.options
    const field = col.field
    if (!field) {
        if (col.fieldType === 'status') return ['ACTIVE', 'COMPLETED']
        return null
    }
    const vt = field.valueType
    if (vt === 'BOOLEAN') return ['ទេ', 'បាទ']
    if (vt === 'TRUE_ONLY') return ['ទេ', 'បាទ']
    const fromSet = optionLabelsFromField(field)
    if (fromSet.length) return fromSet
    return null
}

const exampleValueForColumn = (col) => {
    if (col.fieldType === 'person') return 'SMH2101-000001'
    if (col.fieldType === 'eventDate') return new Date().toISOString().slice(0, 10)
    if (col.fieldType === 'status') return 'ACTIVE'
    if (col.fieldType === 'stage' && col.options?.length) return col.options[0]

    const field = col.field
    if (!field) return ''

    const vt = field.valueType
    if (vt === 'BOOLEAN' || vt === 'TRUE_ONLY') return 'ទេ'

    const opts = validationOptionsForColumn(col)
    if (opts?.length) return opts[0]

    return ''
}

const applyKhmerOsFont = (worksheet, columnCount) => {
    for (let r = 1; r <= DATA_LAST_ROW; r += 1) {
        for (let c = 1; c <= columnCount; c += 1) {
            const cell = worksheet.getCell(r, c)
            const isHeader = r === TEMPLATE_HEADER_ROW
            cell.font = isHeader
                ? {
                      ...KHMER_OS_FONT_BOLD,
                      color: cell.font?.color,
                  }
                : { ...KHMER_OS_FONT }
        }
    }
}

const triggerBrowserDownload = async (workbook, fileName) => {
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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

const writeListColumn = (listsSheet, listCol, values) => {
    values.forEach((value, index) => {
        const cell = listsSheet.getCell(index + 1, listCol)
        cell.value = value
        cell.font = KHMER_OS_FONT
    })
    const letter = excelColLetter(listCol)
    return `'${SHEET_LISTS}'!$${letter}$1:$${letter}$${values.length}`
}

const applyDropdownValidations = (workbook, worksheet, columns, listsSheet) => {
    let listCol = 1

    columns.forEach((col, colIndex) => {
        const options = validationOptionsForColumn(col)
        if (!options?.length) return

        const colLetter = excelColLetter(colIndex + 1)
        const sqref = `${colLetter}${TEMPLATE_EXAMPLE_ROW}:${colLetter}${DATA_LAST_ROW}`

        // Always use a hidden-sheet range (one option per row). Inline comma lists
        // render as cramped segmented chips in Excel instead of a normal dropdown.
        const formula = writeListColumn(listsSheet, listCol, options)
        listCol += 1

        worksheet.dataValidations.add(sqref, {
            type: 'list',
            allowBlank: true,
            formulae: [formula],
            showErrorMessage: true,
            errorStyle: 'warning',
            errorTitle: i18n.t('Invalid value'),
            error: i18n.t('Choose a value from the dropdown list.'),
        })
    })
}

const buildWorkbookFromColumns = (columns, { programAttributes = [] } = {}) => {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Capture Tracker'
    const worksheet = workbook.addWorksheet(SHEET_IMPORT, {
        views: [{ state: 'frozen', ySplit: TEMPLATE_HEADER_ROW }],
    })
    const listsSheet = workbook.addWorksheet(SHEET_LISTS, { state: 'veryHidden' })

    const hasProfileCols = columns.some((c) => c.fieldType === 'attribute')
    const { values: profileExamples } = hasProfileCols
        ? buildProfileExampleValueMap(columns, programAttributes, exampleValueForColumn)
        : { values: new Map() }

    columns.forEach((col, index) => {
        const colNum = index + 1
        const headerCell = worksheet.getCell(TEMPLATE_HEADER_ROW, colNum)
        headerCell.value = col.header
        headerCell.font = {
            ...KHMER_OS_FONT_BOLD,
            color: col.required ? { argb: 'FFB45309' } : undefined,
        }
        if (col.required) {
            headerCell.note = i18n.t('Required on import (column name has no *).')
        }

        const exampleCell = worksheet.getCell(TEMPLATE_EXAMPLE_ROW, colNum)
        exampleCell.value =
            profileExamples.get(col.key) ?? exampleValueForColumn(col)
        exampleCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' },
        }

        const width = Math.min(48, Math.max(12, String(col.header).length + 2))
        worksheet.getColumn(colNum).width = width
    })

    applyKhmerOsFont(worksheet, columns.length)

    if (hasProfileCols && programAttributes.length) {
        applyUuicExcelColumn(worksheet, columns, programAttributes, {
            excelColLetter,
            exampleRow: TEMPLATE_EXAMPLE_ROW,
            dataLastRow: DATA_LAST_ROW,
        })
    }

    applyDropdownValidations(workbook, worksheet, columns, listsSheet)

    return workbook
}

export const downloadPersonnelImportExcel = ({
    programAttributes = [],
    attributeIds = null,
} = {}) => {
    const columns = buildPersonnelImportColumns({ programAttributes, attributeIds })
    if (!columns.length) return false

    const wb = buildWorkbookFromColumns(columns, { programAttributes })
    return triggerBrowserDownload(wb, i18n.t('personnel_import_template.xlsx'))
}

export const downloadStageImportExcel = ({
    programStages = [],
    programAttributes = [],
    stageId,
    dataElementIds = null,
} = {}) => {
    const columns = buildStageVisitImportColumns({
        programStages,
        programAttributes,
        stageId,
        dataElementIds,
        includePerson: true,
        includeStageName: !stageId,
    })
    if (!columns.length) return false

    const stage = stageId
        ? programStages.find((s) => s.id === stageId)
        : programStages[0]
    const stageSlug = (stage?.displayName || stage?.name || 'stage')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 40)

    const wb = buildWorkbookFromColumns(columns)
    return triggerBrowserDownload(wb, i18n.t('stage_import_{{stage}}.xlsx', { stage: stageSlug }))
}

export const downloadCombinedImportExcel = ({
    programAttributes = [],
    programStages = [],
    stageId,
    attributeIds = null,
    dataElementIds = null,
} = {}) => {
    const columns = buildCombinedImportColumns({
        programAttributes,
        programStages,
        stageId,
        attributeIds,
        dataElementIds,
    })
    if (!columns.length) return false

    const stage = stageId
        ? programStages.find((s) => s.id === stageId)
        : programStages[0]
    const stageSlug = (stage?.displayName || stage?.name || 'stage')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 40)

    const wb = buildWorkbookFromColumns(columns, { programAttributes })

    return triggerBrowserDownload(
        wb,
        stageId
            ? i18n.t('profile_stage_import_{{stage}}.xlsx', { stage: stageSlug })
            : i18n.t('profile_and_stage_import_template.xlsx')
    )
}
