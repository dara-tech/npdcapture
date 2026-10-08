import i18n from '@dhis2/d2-i18n'
import { getUserAttributeLabel, userAttributeColumnId } from './userAttributes'

export const USER_COLUMN_STORAGE_KEY = 'capture-user-mgmt-columns'

/** Built-in optional columns (Name, Status, and actions are always shown). */
export const USER_STATIC_OPTIONAL_COLUMNS = [
    { id: 'roles', labelKey: 'Roles', kind: 'static' },
    { id: 'groups', labelKey: 'Groups', kind: 'static' },
    { id: 'email', labelKey: 'Email', kind: 'static' },
    { id: 'phone', labelKey: 'Phone', kind: 'static' },
    { id: 'gender', labelKey: 'Gender', kind: 'static' },
    { id: 'jobTitle', labelKey: 'Job title', kind: 'static' },
    { id: 'lastLogin', labelKey: 'Last login', kind: 'static' },
]

export const DEFAULT_USER_VISIBLE_COLUMN_IDS = ['roles', 'groups']

/**
 * @param {Array<{ id: string, name?: string, displayName?: string, code?: string }>} userAttributes
 */
export const buildUserTableColumns = (userAttributes = []) => {
    const staticCols = USER_STATIC_OPTIONAL_COLUMNS.map((col) => ({
        id: col.id,
        label: i18n.t(col.labelKey),
        kind: 'static',
    }))

    const attrCols = (userAttributes || [])
        .filter((a) => a?.id)
        .sort((a, b) =>
            String(a.displayName || a.name || '').localeCompare(
                String(b.displayName || b.name || '')
            )
        )
        .map((attr) => ({
            id: userAttributeColumnId(attr.id),
            label: getUserAttributeLabel(attr),
            kind: 'attribute',
            attributeId: attr.id,
        }))

    return [...staticCols, ...attrCols]
}
