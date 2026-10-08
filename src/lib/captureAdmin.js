import {
    CAPTURE_PROGRAM_ADMIN_AUTHORITIES,
    isCaptureProgramAdmin,
    isDhis2Superuser,
    isSuperuser,
} from './ruleSuperuser'

export {
    CAPTURE_PROGRAM_ADMIN_AUTHORITIES,
    CAPTURE_SUPERUSER_AUTHORITIES,
    isCaptureProgramAdmin,
    isDhis2Superuser,
    isSuperuser,
} from './ruleSuperuser'

/** @deprecated Use isSuperuser */
export { isSuperuser as isRuleSuperAdmin } from './ruleSuperuser'

/** Authorities that can open User Management (DHIS2 user admin). */
export const USER_ADMIN_AUTHORITIES = [
    'ALL',
    'F_CAPTURE_RULE_SUPERUSER',
    'F_CAPTURE_RULE_SUPER_ADMIN',
    'F_USER_ADD',
    'F_USER_VIEW',
    'F_USER_VIEW_LISTING',
]

export const isUserAdmin = (authorities) => {
    const list = Array.isArray(authorities) ? authorities : []
    if (isDhis2Superuser(list)) return true
    return USER_ADMIN_AUTHORITIES.some(
        (auth) =>
            auth !== 'ALL' &&
            auth !== 'F_CAPTURE_RULE_SUPERUSER' &&
            auth !== 'F_CAPTURE_RULE_SUPER_ADMIN' &&
            list.includes(auth)
    )
}

export const isCaptureAdmin = (authorities) =>
    isSuperuser(authorities) ||
    isCaptureProgramAdmin(authorities) ||
    isUserAdmin(authorities)

export const canEditUsers = (authorities) => {
    const list = Array.isArray(authorities) ? authorities : []
    if (isDhis2Superuser(list)) return true
    return list.includes('F_USER_ADD')
}

/** Explicit DHIS2 authorities that may open the admin sidebar. */
export const ADMIN_NAVIGATION_AUTHORITIES = [
    'F_CAPTURE_SHOW_ADMIN_NAV',
    'F_USER_ADD',
    'F_CAPTURE_RULE_SUPERUSER',
    'F_CAPTURE_RULE_SUPER_ADMIN',
]

const DEFAULT_DATA_ENTRY_ROLE_PATTERNS = [
    /fca\s*[-–—]\s*capture/i,
    /fca\s*[-–—]\s*tracker\s*data\s*capture/i,
    /data\s*entry/i,
    /dataentry/i,
    /data\s*clerk/i,
    /field\s*worker/i,
    /capture\s*entry/i,
    /npd\s*data/i,
    /tracker\s*capture/i,
]

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const roleHaystack = (role) =>
    `${role?.displayName || ''} ${role?.name || ''} ${role?.code || ''}`

const userHasRoleMatchingPatterns = (userRoles, patterns) =>
    (userRoles || []).some((role) => patterns.some((pattern) => pattern.test(roleHaystack(role))))

const userHasRoleId = (userRoles, roleIds) => {
    if (!Array.isArray(roleIds) || !roleIds.length) return false
    return (userRoles || []).some((role) => roleIds.includes(role?.id))
}

/**
 * Match DHIS2 user role names/codes configured for records-only mode.
 */
export const userHasDataEntryRole = (userRoles, extraNamesCsv = '', roleIds = []) => {
    if (userHasRoleId(userRoles, roleIds)) return true
    const patterns = [...DEFAULT_DATA_ENTRY_ROLE_PATTERNS]
    for (const token of String(extraNamesCsv || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)) {
        patterns.push(new RegExp(escapeRegExp(token), 'i'))
    }
    return userHasRoleMatchingPatterns(userRoles, patterns)
}

/** DHIS2 role names that always keep the admin sidebar. */
const ADMIN_NAVIGATION_ROLE_PATTERNS = [/\bsuperuser\b/i, /admin\s*user\s*role/i]

export const userHasAdminNavigationRole = (userRoles) =>
    (userRoles || []).some((role) => {
        const haystack = `${role?.displayName || ''} ${role?.name || ''} ${role?.code || ''}`
        return ADMIN_NAVIGATION_ROLE_PATTERNS.some((pattern) => pattern.test(haystack))
    })

/**
 * Admin sidebar visibility logic — records-only users do not see it.
 */
export const showAdminNavigation = (authorities, options = {}) => {
    const list = Array.isArray(authorities) ? authorities : []
    const {
        userRoles = [],
        dataEntryRoleNames = '',
        captureRoleIds = [],
    } = options

    if (isDhis2Superuser(list)) return true
    if (userHasAdminNavigationRole(userRoles)) return true

    if (userHasDataEntryRole(userRoles, dataEntryRoleNames, captureRoleIds)) {
        return false
    }

    if (ADMIN_NAVIGATION_AUTHORITIES.some((auth) => list.includes(auth))) return true
    if (isCaptureProgramAdmin(list)) return true

    return false
}

/** Records-only experience: no sidebar, no admin sections. */
export const isDataEntryExperience = (authorities, options = {}) =>
    !showAdminNavigation(authorities, options)
