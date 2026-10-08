import * as XLSX from 'xlsx'
import i18n from '@dhis2/d2-i18n'
import { parseCsvRows } from '../../../lib/parseCsv'

export { parseCsvRows }

const USERS_SHEET_NAME = 'Users'

const normalizeHeader = (h) =>
    String(h || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')

const HEADER_ALIASES = {
    name: 'displayname',
    displayname: 'displayname',
    username: 'username',
    user: 'username',
    password: 'password',
    firstname: 'firstname',
    first: 'firstname',
    surname: 'surname',
    lastname: 'surname',
    last: 'surname',
    email: 'email',
    phone: 'phone',
    phonenumber: 'phone',
    status: 'status',
    disabled: 'status',
    roles: 'roles',
    userroles: 'roles',
    groups: 'groups',
    usergroups: 'groups',
    organisationunits: 'organisationunits',
    orgunits: 'organisationunits',
    orgs: 'organisationunits',
}

const mapHeader = (raw) => HEADER_ALIASES[normalizeHeader(raw)] || normalizeHeader(raw)

/** Locate the header row that contains Username (skips instruction rows in the workbook). */
export const findUsersHeaderRowIndex = (table) => {
    for (let i = 0; i < table.length; i++) {
        const headers = (table[i] || []).map(mapHeader)
        if (headers.includes('username')) return i
    }
    return 0
}

const splitList = (value) =>
    String(value || '')
        .split(/[;|]/)
        .map((s) => s.trim())
        .filter(Boolean)

const parseStatus = (value) => {
    const v = String(value || '').trim().toLowerCase()
    if (!v) return false
    if (v === 'disabled' || v === 'yes' || v === 'true' || v === '1') return true
    return false
}

const splitDisplayName = (name) => {
    const parts = String(name || '').trim().split(/\s+/)
    if (parts.length <= 1) return { firstName: parts[0] || '', surname: '' }
    return {
        firstName: parts.slice(0, -1).join(' '),
        surname: parts[parts.length - 1],
    }
}

/**
 * @returns {{ rows: Array<Record<string,string>>, errors: string[] }}
 */
export function parseUsersImportTable(table) {
    if (!table.length) {
        return { rows: [], errors: [i18n.t('Import file is empty.')] }
    }

    const headerRowIndex = findUsersHeaderRowIndex(table)
    const headers = (table[headerRowIndex] || []).map(mapHeader)
    const rows = []
    const errors = []

    for (let r = headerRowIndex + 1; r < table.length; r++) {
        const cells = table[r]
        const record = {}
        headers.forEach((key, i) => {
            if (key) record[key] = String(cells[i] ?? '').trim()
        })

        if (!record.username && !record.displayname && !record.email) {
            continue
        }

        const nameParts = record.displayname
            ? splitDisplayName(record.displayname)
            : { firstName: '', surname: '' }

        rows.push({
            line: r + 1,
            username: record.username || '',
            password: record.password || '',
            firstName: record.firstname || nameParts.firstName,
            surname: record.surname || nameParts.surname,
            email: record.email || '',
            phoneNumber: record.phone || '',
            disabled: parseStatus(record.status),
            roleNames: splitList(record.roles),
            groupNames: splitList(record.groups),
            orgUnitNames: splitList(record.organisationunits),
        })
    }

    if (!rows.length) {
        errors.push(
            i18n.t('No user rows found. Use the Users sheet with Username, Password, … headers.')
        )
    }

    return { rows, errors }
}

/**
 * @returns {{ rows: Array<Record<string,string>>, errors: string[] }}
 */
export function parseUsersImportCsv(text) {
    const table = parseCsvRows(text)
    return parseUsersImportTable(table)
}

/**
 * Parse CSV or Excel (.xlsx) — only the Users sheet is read for import.
 * @returns {Promise<{ rows: Array<Record<string,string>>, errors: string[] }>}
 */
export async function parseUsersImportFile(file) {
    if (!file) {
        return { rows: [], errors: [i18n.t('No file selected.')] }
    }

    const lower = String(file.name || '').toLowerCase()
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        const sheetName =
            workbook.SheetNames.find(
                (n) => n.toLowerCase() === USERS_SHEET_NAME.toLowerCase()
            ) || workbook.SheetNames[0]

        if (!sheetName || !workbook.Sheets[sheetName]) {
            return {
                rows: [],
                errors: [
                    i18n.t('Workbook has no "{{sheet}}" sheet.', {
                        sheet: USERS_SHEET_NAME,
                    }),
                ],
            }
        }

        const table = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
            header: 1,
            defval: '',
            raw: false,
        })
        return parseUsersImportTable(table)
    }

    const text = await file.text()
    return parseUsersImportCsv(text)
}

export const USERS_IMPORT_TEMPLATE_HEADERS = [
    'Username',
    'Password',
    'First name',
    'Last name',
    'Email',
    'Phone',
    'Status',
    'Roles',
    'Groups',
    'Organisation units',
]

