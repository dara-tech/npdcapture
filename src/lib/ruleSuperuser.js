/**
 * DHIS2 superuser: authority `ALL` only (same as Maintenance superuser).
 */
export const isDhis2Superuser = (authorities) => {
    const list = Array.isArray(authorities) ? authorities : []
    return list.includes('ALL')
}

/** Capture-granted program-rule admin (not the same as DHIS2 superuser). */
export const CAPTURE_PROGRAM_ADMIN_AUTHORITIES = [
    'F_CAPTURE_RULE_SUPERUSER',
    'F_CAPTURE_RULE_SUPER_ADMIN',
    'F_PROGRAM_RULE_MANAGEMENT',
    'F_PROGRAMRULE_MANAGEMENT',
    'F_PROGRAM_RULES_MANAGEMENT',
    'F_PROGRAMRULES_MANAGEMENT',
    'F_PROGRAM_RULE_ADD',
    'F_PROGRAM_RULE_DELETE',
]

export const isCaptureProgramAdmin = (authorities) => {
    const list = Array.isArray(authorities) ? authorities : []
    if (isDhis2Superuser(list)) return true
    return CAPTURE_PROGRAM_ADMIN_AUTHORITIES.some((auth) => list.includes(auth))
}

/** Sidebar + program management: DHIS2 superuser only. */
export const isSuperuser = isDhis2Superuser

/** @deprecated */
export const CAPTURE_SUPERUSER_AUTHORITIES = ['ALL', ...CAPTURE_PROGRAM_ADMIN_AUTHORITIES]
