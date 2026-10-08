import i18n from '@dhis2/d2-i18n'

/** Action types commonly edited in Capture (others can still be saved if already on server). */
/** Which action inputs are relevant per DHIS2 action type. */
export const getActionFieldVisibility = (actionType) => {
    const t = String(actionType || '').toUpperCase()
    const needsField = !['HIDEPROGRAMSTAGE', 'HIDESECTION'].includes(t)
    const needsContent = [
        'SHOWWARNING',
        'SHOWERROR',
        'WARNINGONCOMPLETE',
        'ERRORONCOMPLETE',
    ].includes(t)
    const needsData = t === 'ASSIGN'
    return { field: needsField, content: needsContent, data: needsData }
}

export const PROGRAM_RULE_ACTION_TYPES = [
    { value: 'HIDEFIELD', label: 'Hide field' },
    { value: 'HIDESECTION', label: 'Hide section' },
    { value: 'HIDEPROGRAMSTAGE', label: 'Hide program stage' },
    { value: 'SETMANDATORYFIELD', label: 'Set mandatory field' },
    { value: 'ASSIGN', label: 'Assign value' },
    { value: 'SHOWWARNING', label: 'Show warning' },
    { value: 'SHOWERROR', label: 'Show error' },
    { value: 'WARNINGONCOMPLETE', label: 'Warning on complete' },
    { value: 'ERRORONCOMPLETE', label: 'Error on complete' },
    { value: 'HIDEOPTION', label: 'Hide option' },
]

const refId = (ref) => {
    if (ref == null) return ''
    if (typeof ref === 'string') return ref
    return ref?.id ? String(ref.id) : ''
}

export const emptyProgramRuleForm = (programId) => ({
    id: '',
    name: '',
    priority: '1',
    condition: '',
    programStageId: '',
    actions: [
        {
            id: '',
            programRuleActionType: 'HIDEFIELD',
            dataElementId: '',
            trackedEntityAttributeId: '',
            programStageId: '',
            content: '',
            data: '',
        },
    ],
})

export const ruleToForm = (rule) => ({
    id: rule?.id || '',
    name: rule?.name || '',
    priority: String(rule?.priority ?? 1),
    condition: rule?.condition || '',
    programStageId: refId(rule?.programStage),
    actions: (rule?.programRuleActions?.length
        ? rule.programRuleActions
        : [{ programRuleActionType: 'HIDEFIELD' }]
    ).map((a) => ({
        id: a?.id || '',
        programRuleActionType: String(a?.programRuleActionType || 'HIDEFIELD')
            .toUpperCase()
            .replace(/-/g, '_')
            .replace('HIDE_FIELD', 'HIDEFIELD')
            .replace('ASSIGN_VALUE', 'ASSIGN'),
        dataElementId: refId(a?.dataElement),
        trackedEntityAttributeId: refId(a?.trackedEntityAttribute),
        programStageId: refId(a?.programStage),
        content: a?.content || a?.displayContent || '',
        data: a?.data != null ? String(a.data) : '',
    })),
})

export const formToProgramRulePayload = (form, programId) => {
    const actions = (form.actions || [])
        .filter((a) => a?.programRuleActionType)
        .map((a) => {
            const row = {
                programRuleActionType: a.programRuleActionType,
            }
            if (a.id) row.id = a.id
            if (a.dataElementId) row.dataElement = { id: a.dataElementId }
            if (a.trackedEntityAttributeId) {
                row.trackedEntityAttribute = { id: a.trackedEntityAttributeId }
            }
            if (a.programStageId) row.programStage = { id: a.programStageId }
            if (a.content?.trim()) row.content = a.content.trim()
            if (a.data?.trim()) row.data = a.data.trim()
            return row
        })

    const payload = {
        name: form.name?.trim() || i18n.t('Unnamed rule'),
        condition: form.condition?.trim() || '',
        priority: Number(form.priority) || 1,
        program: { id: programId },
        programRuleActions: actions,
    }

    if (form.programStageId) {
        payload.programStage = { id: form.programStageId }
    }

    return payload
}

export const buildFieldOptions = (metadata) => {
    const attributes = (metadata?.attributes || []).map((a) => ({
        value: `tea:${a.id}`,
        label: a.name || a.id,
        group: 'Profile attribute',
    }))

    const dataElements = []
    for (const stage of metadata?.stages || []) {
        for (const de of stage.dataElements || []) {
            dataElements.push({
                value: `de:${de.id}`,
                label: `${stage.name} · ${de.name || de.id}`,
                group: 'Data element',
            })
        }
    }

    return { attributes, dataElements, all: [...attributes, ...dataElements] }
}

export const parseFieldRef = (value) => {
    if (!value) return { dataElementId: '', trackedEntityAttributeId: '' }
    if (value.startsWith('tea:')) {
        return { dataElementId: '', trackedEntityAttributeId: value.slice(4) }
    }
    if (value.startsWith('de:')) {
        return { dataElementId: value.slice(3), trackedEntityAttributeId: '' }
    }
    return { dataElementId: '', trackedEntityAttributeId: '' }
}

export const formatFieldRef = (dataElementId, trackedEntityAttributeId) => {
    if (trackedEntityAttributeId) return `tea:${trackedEntityAttributeId}`
    if (dataElementId) return `de:${dataElementId}`
    return ''
}
