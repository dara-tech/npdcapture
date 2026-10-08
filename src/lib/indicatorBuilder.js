import i18n from '@dhis2/d2-i18n'
import { decodeBasicHtmlEntities } from './utils'

export const FILTER_OPERATORS = [
    { value: 'notEmpty', labelKey: 'Is not empty', needsValue: false },
    { value: 'empty', labelKey: 'Is empty', needsValue: false },
    { value: 'eq', labelKey: 'Equals', needsValue: true },
    { value: 'ne', labelKey: 'Not equals', needsValue: true },
    { value: 'gt', labelKey: 'Greater than', needsValue: true },
    { value: 'gte', labelKey: 'Greater or equal', needsValue: true },
    { value: 'lt', labelKey: 'Less than', needsValue: true },
    { value: 'lte', labelKey: 'Less or equal', needsValue: true },
]

export const FILTER_JOIN_OPTIONS = [
    { value: 'and', label: 'AND' },
    { value: 'or', label: 'OR' },
]

export const EXPRESSION_OPERATOR_CHIPS = [
    { token: ' + ', label: '+' },
    { token: ' - ', label: '−' },
    { token: ' * ', label: '×' },
    { token: ' / ', label: '÷' },
    { token: ' > ', label: '>' },
    { token: ' < ', label: '<' },
    { token: ' >= ', label: '≥' },
    { token: ' <= ', label: '≤' },
    { token: ' == ', label: '=' },
    { token: ' != ', label: '≠' },
    { token: ' && ', label: 'AND' },
    { token: ' || ', label: 'OR' },
    { token: ' ( ', label: '(' },
    { token: ' ) ', label: ')' },
]

export const EXPRESSION_FUNCTION_CHIPS = [
    { token: 'count(', label: 'count(' },
    { token: 'isNull(', label: 'isNull(' },
    { token: 'isNotNull(', label: 'isNotNull(' },
    { token: 'hasValue(', label: 'hasValue(' },
    { token: 'daysBetween(', label: 'daysBetween(' },
]

export const newFilterRowId = () =>
    `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export const emptyFilterRow = (join = 'and') => ({
    id: newFilterRowId(),
    join,
    fieldToken: '',
    operator: 'notEmpty',
    value: '',
})

/** Flat field list for filter row picker. */
export const buildFilterFieldOptions = (metadata) => {
    const out = []
    for (const a of metadata?.attributes || []) {
        out.push({
            value: `A{${a.id}}`,
            label: `${decodeBasicHtmlEntities(a.name || a.id)} (${i18n.t('Profile')})`,
            group: i18n.t('Profile attribute'),
        })
    }
    for (const stage of metadata?.stages || []) {
        const stageName = decodeBasicHtmlEntities(stage.name || stage.id)
        for (const de of stage.dataElements || []) {
            out.push({
                value: `#{${stage.id}.${de.id}}`,
                label: `${stageName} · ${decodeBasicHtmlEntities(de.name || de.id)}`,
                group: i18n.t('Data element'),
            })
        }
    }
    return out
}

export const groupTokenOptions = (options) => {
    const groups = new Map()
    for (const opt of options || []) {
        const key = opt.group || i18n.t('Other')
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(opt)
    }
    return [...groups.entries()].map(([title, chips]) => ({ title, chips }))
}

const quoteValue = (raw) => {
    const v = String(raw ?? '').trim()
    if (v === '') return "''"
    if (/^-?\d+(\.\d+)?$/.test(v)) return v
    const escaped = v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    return `'${escaped}'`
}

const rowToFragment = (row) => {
    const field = String(row.fieldToken || '').trim()
    if (!field) return ''
    const op = row.operator || 'eq'
    const val = String(row.value ?? '').trim()

    switch (op) {
        case 'notEmpty':
            return `${field} != ''`
        case 'empty':
            return `${field} == ''`
        case 'eq':
            return `${field} == ${quoteValue(val)}`
        case 'ne':
            return `${field} != ${quoteValue(val)}`
        case 'gt':
            return `${field} > ${quoteValue(val)}`
        case 'gte':
            return `${field} >= ${quoteValue(val)}`
        case 'lt':
            return `${field} < ${quoteValue(val)}`
        case 'lte':
            return `${field} <= ${quoteValue(val)}`
        default:
            return `${field} == ${quoteValue(val)}`
    }
}

/** Build DHIS2 filter expression from puzzle rows. */
export const serializeFilterRows = (rows) => {
    const parts = (rows || [])
        .map(rowToFragment)
        .filter(Boolean)
    if (!parts.length) return ''
    return parts.reduce((acc, part, index) => {
        if (index === 0) return part
        const join = rows[index]?.join === 'or' ? ' || ' : ' && '
        return `${acc}${join}${part}`
    }, '')
}

export const buildIndicatorTemplates = (metadata) => {
    const vars = (metadata?.ruleVariables || []).filter((v) => v?.name)
    const enrollmentVar = vars.find((v) =>
        /enrollment/i.test(String(v.name || ''))
    )
    const firstStage = metadata?.stages?.[0]
    const firstDe = firstStage?.dataElements?.[0]

    const templates = [
        {
            id: 'count-zero',
            label: i18n.t('Count (constant 0)'),
            hint: i18n.t('Placeholder numerator — replace with your formula'),
            apply: () => ({ expression: '0' }),
        },
        {
            id: 'count-one',
            label: i18n.t('Count (constant 1)'),
            hint: i18n.t('Each row counts as 1'),
            apply: () => ({ expression: '1' }),
        },
    ]

    if (enrollmentVar) {
        templates.push({
            id: 'enrollment-var',
            label: i18n.t('Enrollment count variable'),
            hint: `V{${enrollmentVar.name}}`,
            apply: () => ({ expression: `V{${enrollmentVar.name}}` }),
        })
    }

    if (firstStage && firstDe) {
        templates.push({
            id: 'stage-de',
            label: i18n.t('Stage data element'),
            hint: `${decodeBasicHtmlEntities(firstStage.name)} · ${decodeBasicHtmlEntities(firstDe.name || firstDe.id)}`,
            apply: () => ({
                expression: `#{${firstStage.id}.${firstDe.id}}`,
                programStageId: firstStage.id,
            }),
        })
    }

    const firstAttr = metadata?.attributes?.[0]
    if (firstAttr) {
        templates.push({
            id: 'attribute',
            label: i18n.t('Profile attribute'),
            hint: decodeBasicHtmlEntities(firstAttr.name || firstAttr.id),
            apply: () => ({ expression: `A{${firstAttr.id}}` }),
        })
    }

    templates.push({
        id: 'enrollment-analytics',
        label: i18n.t('Enrollment analytics preset'),
        hint: i18n.t('Sets analytics type to Enrollment + Count'),
        apply: () => ({
            analyticsType: 'ENROLLMENT',
            aggregationType: 'COUNT',
        }),
    })

    return templates
}
