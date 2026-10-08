import { mergeLocaleParams } from '../lib/apiLocale'
import { formatProgramManagementError } from './programManagementApi'

export const formatUserManagementError = formatProgramManagementError

const USER_LIST_FIELDS = [
    'id',
    'displayName',
    'firstName',
    'surname',
    'email',
    'phoneNumber',
    'disabled',
    'username',
    'gender',
    'jobTitle',
    'introduction',
    'code',
    'attributeValues[value,attribute[id,name,displayName,code,valueType]]',
    'userCredentials[username,disabled,lastLogin]',
    'userRoles[id,name,displayName]',
    'userGroups[id,name,displayName]',
    'organisationUnits[id,displayName,path]',
].join(',')

const USER_DETAIL_FIELDS = [
    ...USER_LIST_FIELDS.split(','),
    'dataViewOrganisationUnits[id,displayName,path]',
    'teiSearchOrganisationUnits[id,displayName,path]',
].join(',')

export const fetchUsers = async ({
    engine,
    search = '',
    page = 1,
    pageSize = 50,
    organisationUnitId = '',
}) => {
    const params = mergeLocaleParams({
        fields: USER_LIST_FIELDS,
        page,
        pageSize,
        order: 'surname,asc',
    })
    const q = search.trim()
    if (q) params.query = q
    if (organisationUnitId) params.ou = organisationUnitId

    const response = await engine.query({
        users: {
            resource: 'users',
            params,
        },
    })
    const block = response?.users
    return {
        users: block?.users || [],
        pager: block?.pager || null,
    }
}

export const fetchUserById = async ({ engine, id }) => {
    const response = await engine.query({
        user: {
            resource: `users/${id}`,
            params: mergeLocaleParams({
                fields: USER_DETAIL_FIELDS,
            }),
        },
    })
    return response.user
}

const lookupLocaleOptions = { translate: false }

export const fetchUserRoles = async ({ engine, forLookup = false } = {}) => {
    const response = await engine.query({
        roles: {
            resource: 'userRoles',
            params: mergeLocaleParams(
                {
                    fields: 'id,name,displayName',
                    paging: false,
                    pageSize: 500,
                },
                forLookup ? lookupLocaleOptions : {}
            ),
        },
    })
    return response?.roles?.userRoles || []
}

export const fetchUserGroups = async ({ engine, forLookup = false } = {}) => {
    const response = await engine.query({
        groups: {
            resource: 'userGroups',
            params: mergeLocaleParams(
                {
                    fields: 'id,name,displayName',
                    paging: false,
                    pageSize: 500,
                },
                forLookup ? lookupLocaleOptions : {}
            ),
        },
    })
    return response?.groups?.userGroups || []
}

/**
 * Custom user attribute definitions configured in DHIS2 (Maintenance → User).
 */
export const fetchUserAttributeDefinitions = async ({ engine }) => {
    const params = mergeLocaleParams({
        fields:
            'id,name,displayName,code,valueType,mandatory,unique,optionSet[id,name,displayName,options[id,code,name,displayName]]',
        paging: false,
        pageSize: 500,
        order: 'name:asc',
    })

    try {
        const response = await engine.query({
            userAttributes: {
                resource: 'userAttributes',
                params,
            },
        })
        const list = response?.userAttributes?.userAttributes
        if (Array.isArray(list) && list.length) return list
    } catch {
        /* fall through */
    }

    try {
        const response = await engine.query({
            attributes: {
                resource: 'attributes',
                params: {
                    ...params,
                    filter: 'userAttribute:eq:true',
                },
            },
        })
        return response?.attributes?.attributes || []
    } catch {
        return []
    }
}

export const searchOrganisationUnits = async ({ engine, search, pageSize = 25 }) => {
    const q = search.trim()
    if (!q) return []
    const response = await engine.query({
        units: {
            resource: 'organisationUnits',
            params: mergeLocaleParams({
                fields: 'id,name,displayName,path',
                query: q,
                pageSize,
                withinUserSearchHierarchy: true,
            }),
        },
    })
    return response?.units?.organisationUnits || []
}

export const createUser = async ({ engine, payload }) => {
    const response = await engine.mutate({
        resource: 'users',
        type: 'create',
        data: payload,
    })
    return response?.response ?? response
}

export const updateUser = async ({ engine, id, payload }) => {
    const response = await engine.mutate({
        resource: `users/${id}`,
        type: 'update',
        data: { ...payload, id },
    })
    return response?.response ?? response
}

/** POST /users/{id}/disabled — avoids partial PUT clearing required User.username */
export const disableUser = async ({ engine, id }) => {
    await engine.mutate({
        resource: `users/${id}/disabled`,
        type: 'create',
        data: {},
    })
}

export const enableUser = async ({ engine, id }) => {
    await engine.mutate({
        resource: `users/${id}/enabled`,
        type: 'create',
        data: {},
    })
}

/** Resolve a user by login name (exact match on username). */
export const findUserByUsername = async ({ engine, username }) => {
    const needle = String(username || '').trim()
    if (!needle) return null
    const key = needle.toLowerCase()
    const { users } = await fetchUsers({ engine, search: needle, pageSize: 100 })
    return (
        (users || []).find((u) => {
            const cred = u.userCredentials?.username || u.username || ''
            return String(cred).trim().toLowerCase() === key
        }) || null
    )
}
