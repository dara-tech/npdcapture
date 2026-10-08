import { mergeLocaleParams } from '../lib/apiLocale'
import { formatProgramManagementError } from './programManagementApi'

export { formatProgramManagementError as formatIndicatorManagementError }

const PROGRAM_INDICATOR_FIELDS = [
    'id',
    'name',
    'shortName',
    'expression',
    'filter',
    'analyticsType',
    'aggregationType',
    'lastUpdated',
    'program[id]',
    'programStage[id,displayName,name]',
].join(',')

const parseValidationResponse = (response) => {
    const body = response?.response ?? response
    const status = String(body?.status || '').toUpperCase()
    const message = String(body?.message || '')
    const valid =
        status !== 'ERROR' &&
        !/not valid/i.test(message) &&
        message.toLowerCase() !== 'expression is not valid'
    return {
        valid,
        message,
        description: body?.description || '',
    }
}

export const fetchProgramIndicators = async ({ engine, programId }) => {
    const response = await engine.query({
        indicators: {
            resource: 'programIndicators',
            params: mergeLocaleParams({
                fields: PROGRAM_INDICATOR_FIELDS,
                filter: `program.id:eq:${programId}`,
                paging: false,
            }),
        },
    })
    return response?.indicators?.programIndicators || []
}

export const fetchProgramIndicatorById = async ({ engine, id }) => {
    const response = await engine.query({
        indicator: {
            resource: `programIndicators/${id}`,
            params: mergeLocaleParams({
                fields: PROGRAM_INDICATOR_FIELDS,
            }),
        },
    })
    return response?.indicator
}

export const createProgramIndicator = async ({ engine, payload }) => {
    const response = await engine.mutate({
        resource: 'programIndicators',
        type: 'create',
        data: payload,
    })
    return response?.response ?? response
}

export const updateProgramIndicator = async ({ engine, id, payload }) => {
    const response = await engine.mutate({
        resource: `programIndicators/${id}`,
        type: 'update',
        data: { ...payload, id },
    })
    return response?.response ?? response
}

export const deleteProgramIndicator = async ({ engine, id }) => {
    await engine.mutate({
        resource: `programIndicators/${id}`,
        type: 'delete',
    })
}

/**
 * DHIS2 app-runtime sends these endpoints as text/plain — `data` must be the
 * expression string, not `{ expression: "..." }` JSON.
 */
export const validateIndicatorExpression = async ({ engine, expression }) => {
    const response = await engine.mutate({
        resource: 'programIndicators/expression/description',
        type: 'create',
        data: String(expression ?? ''),
    })
    return parseValidationResponse(response)
}

export const validateIndicatorFilter = async ({ engine, filter }) => {
    const text = String(filter ?? '').trim()
    if (!text) {
        return { valid: true, message: '', description: '' }
    }
    const response = await engine.mutate({
        resource: 'programIndicators/filter/description',
        type: 'create',
        data: text,
    })
    return parseValidationResponse(response)
}
