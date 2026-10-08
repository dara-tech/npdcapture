import i18n from '@dhis2/d2-i18n'
import { formatUuic, resolveUuicSourceAttributeIds } from '../../../lib/uuic'

import { importOptionLabelsFromField } from './importOptionValues'

/**
 * Example row values for profile columns, with Khmer names + computed UUIC when possible.
 */
export const buildProfileExampleValueMap = (columns, programAttributes, defaultForColumn) => {
    const values = new Map()
    const ids = resolveUuicSourceAttributeIds(programAttributes)
    const sexAttr = programAttributes.find((a) => a.id === ids.sex)
    const sexOptions = importOptionLabelsFromField(sexAttr)
    const defaultSex =
        sexOptions.find((label) => /ប្រុស|male/i.test(label)) ||
        sexOptions[0] ||
        'ប្រុស'

    for (const col of columns) {
        if (col.fieldType !== 'attribute' || !col.field) {
            values.set(col.key, defaultForColumn(col))
            continue
        }
        const id = col.field.id
        if (id === ids.lastName) values.set(col.key, 'ពួន')
        else if (id === ids.firstName) values.set(col.key, 'សុខ')
        else if (id === ids.dob) values.set(col.key, '2001-01-28')
        else if (id === ids.sex) values.set(col.key, defaultSex)
        else if (id === ids.uuic) values.set(col.key, '')
        else values.set(col.key, defaultForColumn(col))
    }

    if (ids.uuic) {
        const code = formatUuic({
            lastName: ids.lastName ? values.get(`attr:${ids.lastName}`) : '',
            firstName: ids.firstName ? values.get(`attr:${ids.firstName}`) : '',
            sex: ids.sex ? values.get(`attr:${ids.sex}`) : '',
            dob: ids.dob ? values.get(`attr:${ids.dob}`) : '',
            sexAttribute: sexAttr,
        })
        if (code) values.set(`attr:${ids.uuic}`, code)
    }

    return { values, ids }
}

export const buildUuicExcelFormula = ({ lastCol, firstCol, sexCol, dobCol }, row) => {
    const sexDigit = `IF(OR(${sexCol}${row}="Male",${sexCol}${row}="male",${sexCol}${row}="M",${sexCol}${row}="1",${sexCol}${row}="ប្រុស"),"1",IF(OR(${sexCol}${row}="Female",${sexCol}${row}="female",${sexCol}${row}="F",${sexCol}${row}="2",${sexCol}${row}="ស្រី"),"2",""))`
    const ln = `UPPER(LEFT(TRIM(${lastCol}${row}),1)&IF(LEN(TRIM(${lastCol}${row}))>=2,MID(TRIM(${lastCol}${row}),2,1),"0"))`
    const fn = `UPPER(LEFT(TRIM(${firstCol}${row}),1)&IF(LEN(TRIM(${firstCol}${row}))>=2,MID(TRIM(${firstCol}${row}),2,1),"0"))`
    const dt = `IFERROR(TEXT(${dobCol}${row},"ddmmyy"),"")`
    return `IF(OR(${lastCol}${row}="",${firstCol}${row}="",${sexCol}${row}="",${dobCol}${row}=""),"",${ln}&${fn}&${sexDigit}&${dt})`
}

/**
 * Row 5: static Khmer-correct UUIC. Rows 6+: Excel formula (Latin names) or blank.
 */
export const applyUuicExcelColumn = (
    worksheet,
    columns,
    programAttributes,
    { excelColLetter, exampleRow, dataLastRow }
) => {
    const ids = resolveUuicSourceAttributeIds(programAttributes)
    if (!ids.uuic || !ids.lastName || !ids.firstName || !ids.sex || !ids.dob) return

    const colIndex = (attrId) => columns.findIndex((c) => c.key === `attr:${attrId}`)
    const lastIdx = colIndex(ids.lastName)
    const firstIdx = colIndex(ids.firstName)
    const sexIdx = colIndex(ids.sex)
    const dobIdx = colIndex(ids.dob)
    const uuicIdx = colIndex(ids.uuic)
    if (lastIdx < 0 || firstIdx < 0 || sexIdx < 0 || dobIdx < 0 || uuicIdx < 0) return

    const refs = {
        lastCol: excelColLetter(lastIdx + 1),
        firstCol: excelColLetter(firstIdx + 1),
        sexCol: excelColLetter(sexIdx + 1),
        dobCol: excelColLetter(dobIdx + 1),
    }

    const headerCell = worksheet.getCell(exampleRow - 1, uuicIdx + 1)
    headerCell.note = i18n.t(
        'Leave blank to auto-generate from last name, first name, sex, and date of birth (same as registration). Khmer names — filled on import; row {{row}} shows a sample.',
        { row: exampleRow }
    )

    for (let row = exampleRow + 1; row <= dataLastRow; row++) {
        worksheet.getCell(row, uuicIdx + 1).value = {
            formula: buildUuicExcelFormula(refs, row),
        }
    }
}
