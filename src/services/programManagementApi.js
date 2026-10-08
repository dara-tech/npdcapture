import { mergeLocaleParams } from '../lib/apiLocale'

const PROGRAM_RULE_FIELDS = [
    'id',
    'name',
    'priority',
    'condition',
    'program[id]',
    'programStage[id]',
    'programRuleActions[id,programRuleActionType,data,content,displayContent,programStage[id],programStageSection[id],dataElement[id],trackedEntityAttribute[id],option[id,code,name],optionGroup[id]]',
].join(',')

export const formatProgramManagementError = (error, fallback = 'Request failed') => {
    const details = error?.details
    if (details?.response?.errorReports?.length) {
        return details.response.errorReports
            .map((r) => r.message)
            .filter(Boolean)
            .join(' · ')
    }
    if (details?.message) return String(details.message)
    return error?.message || fallback
}

export const createProgramRule = async ({ engine, payload }) => {
    const response = await engine.mutate({
        resource: 'programRules',
        type: 'create',
        data: payload,
    })
    return response?.response ?? response
}

export const updateProgramRule = async ({ engine, id, payload }) => {
    const response = await engine.mutate({
        resource: `programRules/${id}`,
        type: 'update',
        data: { ...payload, id },
    })
    return response?.response ?? response
}

export const deleteProgramRule = async ({ engine, id }) => {
    await engine.mutate({
        resource: `programRules/${id}`,
        type: 'delete',
    })
}

export const fetchProgramRuleById = async ({ engine, id }) => {
    const response = await engine.query({
        rule: {
            resource: `programRules/${id}`,
            params: mergeLocaleParams({
                fields: PROGRAM_RULE_FIELDS,
            }),
        },
    })
    return response.rule
}
