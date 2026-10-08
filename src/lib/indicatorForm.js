import i18n from '@dhis2/d2-i18n'
import { decodeBasicHtmlEntities } from './utils'

export const ANALYTICS_TYPE_OPTIONS = [
    { value: 'EVENT', label: 'Event' },
    { value: 'ENROLLMENT', label: 'Enrollment' },
    { value: 'TRACKED_ENTITY_INSTANCE', label: 'Tracked entity instance' },
]

export const AGGREGATION_TYPE_OPTIONS = [
    { value: 'COUNT', label: 'Count' },
    { value: 'SUM', label: 'Sum' },
    { value: 'AVERAGE', label: 'Average' },
    { value: 'MIN', label: 'Min' },
    { value: 'MAX', label: 'Max' },
    { value: 'STDDEV', label: 'Standard deviation' },
    { value: 'VARIANCE', label: 'Variance' },
]

const refId = (ref) => {
    if (ref == null) return ''
    if (typeof ref === 'string') return ref
    return ref?.id ? String(ref.id) : ''
}

export const emptyIndicatorForm = (programId) => ({
    id: '',
    name: '',
    shortName: '',
    expression: '0',
    filter: '',
    analyticsType: 'EVENT',
    aggregationType: 'COUNT',
    programStageId: '',
    programId: programId || '',
})

export const indicatorToForm = (indicator, programId) => ({
    id: indicator?.id || '',
    name: indicator?.name || '',
    shortName: indicator?.shortName || '',
    expression: indicator?.expression || '0',
    filter: indicator?.filter || '',
    analyticsType: indicator?.analyticsType || 'EVENT',
    aggregationType: indicator?.aggregationType || 'COUNT',
    programStageId: refId(indicator?.programStage),
    programId: refId(indicator?.program) || programId || '',
})

export const formToIndicatorPayload = (form, programId) => {
    const payload = {
        name: form.name?.trim() || i18n.t('Unnamed indicator'),
        shortName: (form.shortName?.trim() || form.name?.trim() || i18n.t('Indicator')).slice(
            0,
            32
        ),
        expression: form.expression?.trim() || '0',
        filter: form.filter?.trim() || '',
        analyticsType: form.analyticsType || 'EVENT',
        aggregationType: form.aggregationType || 'COUNT',
        program: { id: programId },
    }
    if (form.programStageId) {
        payload.programStage = { id: form.programStageId }
    }
    return payload
}

/** Build insert tokens for program indicator expressions. */
export const buildIndicatorTokenOptions = (metadata) => {
    const attributes = (metadata?.attributes || []).map((a) => {
        const name = decodeBasicHtmlEntities(a.name || a.id)
        return {
            value: `A{${a.id}}`,
            label: `${name} · A{${a.id}}`,
            chipLabel: name,
            chipTitle: `${name} · A{${a.id}}`,
            group: i18n.t('Profile attribute'),
        }
    })

    const dataElements = []
    for (const stage of metadata?.stages || []) {
        const stageName = decodeBasicHtmlEntities(stage.name || stage.id)
        for (const de of stage.dataElements || []) {
            const deName = decodeBasicHtmlEntities(de.name || de.id)
            const token = `#{${stage.id}.${de.id}}`
            dataElements.push({
                value: token,
                label: `${stageName} · ${deName} · ${token}`,
                chipLabel: deName,
                chipTitle: `${stageName} · ${deName} · ${token}`,
                group: stageName,
            })
        }
    }

    const variables = (metadata?.ruleVariables || [])
        .filter((v) => v?.name)
        .map((v) => {
            const name = decodeBasicHtmlEntities(v.displayName || v.name)
            return {
                value: `V{${v.name}}`,
                label: `${name} · V{${v.name}}`,
                chipLabel: name,
                chipTitle: `${name} · V{${v.name}}`,
                group: i18n.t('Rule variable'),
            }
        })

    return [...attributes, ...dataElements, ...variables]
}
