import i18n from '@dhis2/d2-i18n'
import { formToUserPayload } from '../../../lib/userForm'
import {
    createUser,
    disableUser,
    enableUser,
    fetchUserGroups,
    fetchUserRoles,
    findUserByUsername,
    formatUserManagementError,
    searchOrganisationUnits,
} from '../../../services/userManagementApi'

export const IMPORT_USER_ACTION = {
    create: 'create',
    /** Disables account (same as delete in user management UI). */
    disable: 'disable',
    enable: 'enable',
}
import { fetchOrgUnits } from '../../../services/trackerApi'

const norm = (s) => String(s || '').trim().toLowerCase()

const compact = (s) => norm(s).replace(/[^a-z0-9]/g, '')

const labelsFor = (item) =>
    [item?.displayName, item?.name, item?.code, item?.id]
        .map((v) => String(v || '').trim())
        .filter(Boolean)

const buildNameIndex = (items) => {
    const map = new Map()
    for (const item of items || []) {
        const id = item.id
        if (!id) continue
        for (const label of labelsFor(item)) {
            for (const key of [norm(label), compact(label)]) {
                if (key && !map.has(key)) map.set(key, id)
            }
        }
    }
    return map
}

const buildOrgUnitIndex = (items) => buildNameIndex(items)

const findUniqueFuzzyMatch = (name, items) => {
    const key = norm(name)
    if (!key) return null

    const matches = (items || []).filter((item) => {
        const labels = labelsFor(item).map(norm)
        return labels.some(
            (label) =>
                label === key ||
                label.includes(key) ||
                key.includes(label) ||
                compact(label) === compact(key)
        )
    })

    if (matches.length === 1) return matches[0].id

    const tokens = key.split(/\s+/).filter(Boolean)
    if (tokens.length > 1) {
        const tokenMatches = (items || []).filter((item) => {
            const label = norm(item.displayName || item.name || '')
            return tokens.every((t) => label.includes(t))
        })
        if (tokenMatches.length === 1) return tokenMatches[0].id
    }

    return null
}

const resolveNames = (names, items, index) => {
    const ids = []
    const missing = []
    for (const name of names || []) {
        let id =
            index.get(norm(name)) ||
            index.get(compact(name)) ||
            findUniqueFuzzyMatch(name, items)
        if (id) ids.push(id)
        else missing.push(name)
    }
    return { ids, missing }
}

const pickOrgUnitFromResults = (list, name) => {
    if (!list?.length) return null
    const key = norm(name)

    const exact = list.find(
        (ou) => norm(ou.displayName) === key || norm(ou.name) === key
    )
    if (exact?.id) return exact.id

    const fuzzy = findUniqueFuzzyMatch(name, list)
    if (fuzzy) return fuzzy

    return null
}

const orgUnitCache = new Map()

const resolveOrgUnitId = async ({ engine, name, orgUnitIndex, accessibleOrgUnits }) => {
    const key = norm(name)
    if (!key) return null
    if (orgUnitCache.has(key)) return orgUnitCache.get(key)

    const fromIndex =
        orgUnitIndex.get(key) ||
        orgUnitIndex.get(compact(name)) ||
        findUniqueFuzzyMatch(name, accessibleOrgUnits)
    if (fromIndex) {
        orgUnitCache.set(key, fromIndex)
        return fromIndex
    }

    const q = String(name || '').trim()
    if (q.length < 2) {
        orgUnitCache.set(key, null)
        return null
    }

    const list = await searchOrganisationUnits({ engine, search: q, pageSize: 25 })
    const id = pickOrgUnitFromResults(list, name)
    orgUnitCache.set(key, id)
    return id
}

const resolveOrgUnits = async ({ engine, names, orgUnitIndex, accessibleOrgUnits }) => {
    const ids = []
    const missing = []
    for (const name of names || []) {
        const id = await resolveOrgUnitId({
            engine,
            name,
            orgUnitIndex,
            accessibleOrgUnits,
        })
        if (id) ids.push(id)
        else missing.push(name)
    }
    return { ids, missing }
}

async function importUsersCreate({ engine, rows, onProgress }) {
    orgUnitCache.clear()

    const [roles, groups, accessibleOrgUnits] = await Promise.all([
        fetchUserRoles({ engine, forLookup: true }),
        fetchUserGroups({ engine, forLookup: true }),
        fetchOrgUnits({ engine }).catch(() => []),
    ])
    const roleIndex = buildNameIndex(roles)
    const groupIndex = buildNameIndex(groups)
    const orgUnitIndex = buildOrgUnitIndex(accessibleOrgUnits)

    const results = []
    const total = rows.length

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        onProgress?.(i, total)

        const rowErrors = []
        const username = row.username?.trim()
        if (!username) {
            results.push({
                line: row.line,
                username: '',
                ok: false,
                error: i18n.t('Username is required.'),
            })
            continue
        }
        if (!row.password?.trim()) {
            results.push({
                line: row.line,
                username,
                ok: false,
                error: i18n.t('Password is required.'),
            })
            continue
        }

        const rolesResolved = resolveNames(row.roleNames, roles, roleIndex)
        const groupsResolved = resolveNames(row.groupNames, groups, groupIndex)
        const orgResolved = await resolveOrgUnits({
            engine,
            names: row.orgUnitNames,
            orgUnitIndex,
            accessibleOrgUnits,
        })

        if (rolesResolved.missing.length) {
            rowErrors.push(
                i18n.t('Unknown role(s) — {{names}}', {
                    names: rolesResolved.missing.join(', '),
                })
            )
        }
        if (groupsResolved.missing.length) {
            rowErrors.push(
                i18n.t('Unknown group(s) — {{names}}', {
                    names: groupsResolved.missing.join(', '),
                })
            )
        }
        if (orgResolved.missing.length) {
            rowErrors.push(
                i18n.t('Unknown organisation unit(s) — {{names}}', {
                    names: orgResolved.missing.join(', '),
                })
            )
        }

        const organisationUnitIds = orgResolved.ids
        const roleIds = rolesResolved.ids

        if (!organisationUnitIds.length && !roleIds.length) {
            rowErrors.push(
                i18n.t('Assign at least one organisation unit or user role.')
            )
        }

        if (rowErrors.length) {
            results.push({
                line: row.line,
                username,
                ok: false,
                error: rowErrors.join(' '),
            })
            continue
        }

        const form = {
            id: '',
            username,
            password: row.password.trim(),
            firstName: row.firstName || '',
            surname: row.surname || '',
            email: row.email || '',
            phoneNumber: row.phoneNumber || '',
            disabled: Boolean(row.disabled),
            roleIds,
            groupIds: groupsResolved.ids,
            organisationUnitIds,
        }

        try {
            const payload = formToUserPayload(form, { includePassword: true })
            await createUser({ engine, payload })
            results.push({ line: row.line, username, ok: true })
        } catch (e) {
            results.push({
                line: row.line,
                username,
                ok: false,
                error: formatUserManagementError(e, i18n.t('Failed to create user')),
            })
        }
    }

    onProgress?.(total, total)

    const created = results.filter((r) => r.ok).length
    const failed = results.filter((r) => !r.ok).length

    return {
        results,
        created,
        failed,
        disabled: 0,
        enabled: 0,
        action: IMPORT_USER_ACTION.create,
    }
}

async function importUsersDisable({ engine, rows, onProgress }) {
    const results = []
    const total = rows.length

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        onProgress?.(i, total)

        const username = row.username?.trim()
        if (!username) {
            results.push({
                line: row.line,
                username: '',
                ok: false,
                error: i18n.t('Username is required.'),
            })
            continue
        }

        try {
            const user = await findUserByUsername({ engine, username })
            if (!user?.id) {
                results.push({
                    line: row.line,
                    username,
                    ok: false,
                    error: i18n.t('User not found.'),
                })
                continue
            }

            const alreadyDisabled =
                Boolean(user.disabled) || Boolean(user.userCredentials?.disabled)
            if (alreadyDisabled) {
                results.push({ line: row.line, username, ok: true, skipped: true })
                continue
            }

            await disableUser({ engine, id: user.id })
            results.push({ line: row.line, username, ok: true })
        } catch (e) {
            results.push({
                line: row.line,
                username,
                ok: false,
                error: formatUserManagementError(e, i18n.t('Failed to disable user')),
            })
        }
    }

    onProgress?.(total, total)

    const disabled = results.filter((r) => r.ok).length
    const failed = results.filter((r) => !r.ok).length

    return {
        results,
        created: 0,
        failed,
        disabled,
        enabled: 0,
        action: IMPORT_USER_ACTION.disable,
    }
}

async function importUsersEnable({ engine, rows, onProgress }) {
    const results = []
    const total = rows.length

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        onProgress?.(i, total)

        const username = row.username?.trim()
        if (!username) {
            results.push({
                line: row.line,
                username: '',
                ok: false,
                error: i18n.t('Username is required.'),
            })
            continue
        }

        try {
            const user = await findUserByUsername({ engine, username })
            if (!user?.id) {
                results.push({
                    line: row.line,
                    username,
                    ok: false,
                    error: i18n.t('User not found.'),
                })
                continue
            }

            const isDisabled =
                Boolean(user.disabled) || Boolean(user.userCredentials?.disabled)
            if (!isDisabled) {
                results.push({ line: row.line, username, ok: true, skipped: true })
                continue
            }

            await enableUser({ engine, id: user.id })
            results.push({ line: row.line, username, ok: true })
        } catch (e) {
            results.push({
                line: row.line,
                username,
                ok: false,
                error: formatUserManagementError(e, i18n.t('Failed to enable user')),
            })
        }
    }

    onProgress?.(total, total)

    const enabled = results.filter((r) => r.ok).length
    const failed = results.filter((r) => !r.ok).length

    return {
        results,
        created: 0,
        failed,
        disabled: 0,
        enabled,
        action: IMPORT_USER_ACTION.enable,
    }
}

/**
 * @param {{
 *   engine,
 *   rows: import('./parseUsersCsv').rows,
 *   action?: 'create' | 'disable' | 'enable',
 *   onProgress?: (done: number, total: number) => void
 * }} opts
 */
export async function importUsersFromCsv({
    engine,
    rows,
    action = IMPORT_USER_ACTION.create,
    onProgress,
}) {
    if (action === IMPORT_USER_ACTION.disable) {
        return importUsersDisable({ engine, rows, onProgress })
    }
    if (action === IMPORT_USER_ACTION.enable) {
        return importUsersEnable({ engine, rows, onProgress })
    }
    return importUsersCreate({ engine, rows, onProgress })
}
