import { userDisplayLabel } from '../../../lib/userForm'
import {
    buildUserAttributeDefMap,
    getUserAttributeDisplayValue,
    getUserAttributeLabel,
} from './userAttributes'

const escapeCsv = (value) => {
    const s = value == null ? '' : String(value)
    return `"${s.replace(/"/g, '""')}"`
}

export const exportUsersCsv = (
    users,
    filename = 'users.csv',
    userAttributeDefs = []
) => {
    const attrDefMap = buildUserAttributeDefMap(userAttributeDefs)
    const attrHeaders = (userAttributeDefs || []).map((a) => getUserAttributeLabel(a))
    const headers = [
        'Name',
        'Username',
        'Email',
        'Phone',
        'Gender',
        'Job title',
        'Status',
        'Roles',
        'Groups',
        'Organisation units',
        ...attrHeaders,
    ]
    const rows = (users || []).map((u) => [
        userDisplayLabel(u),
        u?.userCredentials?.username || u?.username || '',
        u?.email || '',
        u?.phoneNumber || '',
        u?.gender || '',
        u?.jobTitle || '',
        u?.disabled ? 'Disabled' : 'Active',
        (u.userRoles || []).map((r) => r.displayName || r.name).filter(Boolean).join('; '),
        (u.userGroups || []).map((g) => g.displayName || g.name).filter(Boolean).join('; '),
        (u.organisationUnits || [])
            .map((ou) => ou.displayName || ou.path)
            .filter(Boolean)
            .join('; '),
        ...(userAttributeDefs || []).map((attr) =>
            getUserAttributeDisplayValue(u, attr.id, attrDefMap)
        ),
    ])
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
}
