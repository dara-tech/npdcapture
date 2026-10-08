import * as XLSX from 'xlsx'
import i18n from '@dhis2/d2-i18n'
import { fetchUserGroups, fetchUserRoles } from '../../../services/userManagementApi'
import { fetchOrgUnits } from '../../../services/trackerApi'
import { USERS_IMPORT_TEMPLATE_HEADERS } from './parseUsersCsv'

const SHEET_USERS = 'Users'
const SHEET_ROLES = 'Roles'
const SHEET_GROUPS = 'Groups'
const SHEET_ORG_UNITS = 'Organisation units'

const roleLabel = (r) => String(r.displayName || r.name || r.id || '').trim()
const groupLabel = (g) => String(g.displayName || g.name || g.id || '').trim()
const ouLabel = (ou) => String(ou.displayName || ou.name || ou.id || '').trim()

const buildUsersSheetRows = () => [
    [
        i18n.t(
            'Fill user rows below. Copy role and group names from the Roles and Groups sheets; copy organisation unit names from the Organisation units sheet (exact spelling).'
        ),
    ],
    [
        i18n.t(
            'Multiple values — separate with a semicolon (;). Status — Active or Disabled. This sheet is the only one imported.'
        ),
    ],
    [
        i18n.t(
            'To delete or re-enable users via import — choose Delete or Enable in the import dialog and list usernames only (other columns optional).'
        ),
    ],
    [],
    USERS_IMPORT_TEMPLATE_HEADERS,
    [
        'jdoe',
        'ChangeMe123!',
        'Jane',
        'Doe',
        'jane@example.org',
        '',
        'Active',
        '',
        '',
        '',
    ],
]

const buildRolesSheetRows = (roles) => [
    [
        i18n.t('Copy to Users → Roles'),
        i18n.t('Role ID (reference)'),
    ],
    ...[...roles]
        .sort((a, b) => roleLabel(a).localeCompare(roleLabel(b)))
        .map((r) => [roleLabel(r), r.id || '']),
]

const buildGroupsSheetRows = (groups) => [
    [
        i18n.t('Copy to Users → Groups'),
        i18n.t('Group ID (reference)'),
    ],
    ...[...groups]
        .sort((a, b) => groupLabel(a).localeCompare(groupLabel(b)))
        .map((g) => [groupLabel(g), g.id || '']),
]

const buildOrgUnitsSheetRows = (orgUnits) => [
    [
        i18n.t('Copy to Users → Organisation units'),
        i18n.t('Level'),
        i18n.t('Org unit ID (reference)'),
    ],
    ...[...orgUnits]
        .sort((a, b) => {
            const levelDiff = (a.level || 0) - (b.level || 0)
            if (levelDiff !== 0) return levelDiff
            return ouLabel(a).localeCompare(ouLabel(b))
        })
        .map((ou) => [ouLabel(ou), ou.level ?? '', ou.id || '']),
]

/**
 * Download a multi-sheet Excel workbook: Users (import) + Roles, Groups, Organisation units (reference).
 */
export async function downloadUsersImportWorkbook({ engine }) {
    const [roles, groups, orgUnits] = await Promise.all([
        fetchUserRoles({ engine, forLookup: true }),
        fetchUserGroups({ engine, forLookup: true }),
        fetchOrgUnits({ engine }).catch(() => []),
    ])

    const wb = XLSX.utils.book_new()

    const wsUsers = XLSX.utils.aoa_to_sheet(buildUsersSheetRows())
    const wsRoles = XLSX.utils.aoa_to_sheet(buildRolesSheetRows(roles))
    const wsGroups = XLSX.utils.aoa_to_sheet(buildGroupsSheetRows(groups))
    const wsOrgUnits = XLSX.utils.aoa_to_sheet(buildOrgUnitsSheetRows(orgUnits))

    wsUsers['!cols'] = [
        { wch: 14 },
        { wch: 16 },
        { wch: 12 },
        { wch: 12 },
        { wch: 24 },
        { wch: 14 },
        { wch: 10 },
        { wch: 28 },
        { wch: 24 },
        { wch: 32 },
    ]
    wsRoles['!cols'] = [{ wch: 36 }, { wch: 14 }]
    wsGroups['!cols'] = [{ wch: 36 }, { wch: 14 }]
    wsOrgUnits['!cols'] = [{ wch: 40 }, { wch: 8 }, { wch: 14 }]

    XLSX.utils.book_append_sheet(wb, wsUsers, SHEET_USERS)
    XLSX.utils.book_append_sheet(wb, wsRoles, SHEET_ROLES)
    XLSX.utils.book_append_sheet(wb, wsGroups, SHEET_GROUPS)
    XLSX.utils.book_append_sheet(wb, wsOrgUnits, SHEET_ORG_UNITS)

    XLSX.writeFile(wb, 'users-import-guide.xlsx')
}

export const USERS_IMPORT_WORKBOOK_SHEET = SHEET_USERS
