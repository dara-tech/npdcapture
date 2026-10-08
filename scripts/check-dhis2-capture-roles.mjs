#!/usr/bin/env node
/**
 * Inspect DHIS2 user roles vs Capture app navigation rules.
 *
 *   DHIS2_URL=http://localhost:8080 DHIS2_USER=sovandara DHIS2_PASS='Mpi@2023' \
 *     node scripts/check-dhis2-capture-roles.mjs
 */

const baseUrl = (process.env.DHIS2_URL || 'http://localhost:8080').replace(/\/$/, '')
const username = process.env.DHIS2_USER || 'sovandara'
const password = process.env.DHIS2_PASS || process.env.DHIS2_PASSWORD || ''

const dataEntryRoleNames =
    process.env.CAPTURE_DATA_ENTRY_ROLES ||
    'Data Clerk Role (Tracker Capture),FCA - Tracker data capture,Data Clerk,Data Entry,Data entry,NPD Data Entry'

const DEFAULT_DATA_ENTRY_ROLE_PATTERNS = [
    /data\s*entry/i,
    /dataentry/i,
    /data\s*clerk/i,
    /field\s*worker/i,
    /capture\s*entry/i,
    /npd\s*data/i,
    /tracker\s*capture/i,
]

const ADMIN_NAVIGATION_ROLE_PATTERNS = [/\bsuperuser\b/i, /admin\s*user\s*role/i]

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const userHasDataEntryRole = (userRoles, extraNamesCsv) => {
    const patterns = [...DEFAULT_DATA_ENTRY_ROLE_PATTERNS]
    for (const token of String(extraNamesCsv || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)) {
        patterns.push(new RegExp(escapeRegExp(token), 'i'))
    }
    return (userRoles || []).some((role) => {
        const haystack = `${role?.displayName || ''} ${role?.name || ''} ${role?.code || ''}`
        return patterns.some((pattern) => pattern.test(haystack))
    })
}

const userHasAdminNavigationRole = (userRoles) =>
    (userRoles || []).some((role) => {
        const haystack = `${role?.displayName || ''} ${role?.name || ''} ${role?.code || ''}`
        return ADMIN_NAVIGATION_ROLE_PATTERNS.some((pattern) => pattern.test(haystack))
    })

const showAdminNavigation = (authorities, { userRoles, dataEntryRoleNames: csv }) => {
    const list = Array.isArray(authorities) ? authorities : []
    if (list.includes('ALL')) return true
    if (userHasAdminNavigationRole(userRoles)) return true
    if (userHasDataEntryRole(userRoles, csv)) return false
    const ADMIN_NAV = [
        'F_CAPTURE_SHOW_ADMIN_NAV',
        'F_USER_ADD',
        'F_CAPTURE_INDICATOR_MANAGEMENT',
        'F_CAPTURE_RULE_SUPERUSER',
        'F_CAPTURE_RULE_SUPER_ADMIN',
    ]
    if (ADMIN_NAV.some((auth) => list.includes(auth))) return true
    return false
}

if (!password) {
    console.error('Set DHIS2_PASS (or DHIS2_PASSWORD).')
    process.exit(1)
}

const auth = Buffer.from(`${username}:${password}`).toString('base64')

const get = async (path) => {
    const res = await fetch(`${baseUrl}${path}`, {
        headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
    })
    if (!res.ok) {
        throw new Error(`${path} → ${res.status} ${await res.text()}`)
    }
    return res.json()
}

const me = await get(
    '/api/me?fields=id,username,displayName,authorities,userRoles[id,name,displayName,code]'
)
const roles = me.userRoles || []
const authorities = me.authorities || []

const nav = showAdminNavigation(authorities, {
    userRoles: roles,
    dataEntryRoleNames,
})

console.log('DHIS2:', baseUrl)
console.log('User:', me.username, `(${me.displayName})`)
console.log('Has ALL:', authorities.includes('ALL'))
console.log('User roles:', roles.map((r) => r.displayName || r.name).join(', '))
console.log('Data-entry role match:', userHasDataEntryRole(roles, dataEntryRoleNames))
console.log('Admin navigation role match:', userHasAdminNavigationRole(roles))
console.log('→ Capture showAdminNavigation:', nav)
console.log('→ Sidebar:', nav ? 'VISIBLE' : 'HIDDEN (records only)')
