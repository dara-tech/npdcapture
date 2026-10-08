import i18n from '@dhis2/d2-i18n'

/** Column id prefix for custom user attributes in the table config. */
export const USER_ATTR_COLUMN_PREFIX = 'attr:'

export const userAttributeColumnId = (attributeId) =>
    `${USER_ATTR_COLUMN_PREFIX}${attributeId}`

export const parseUserAttributeColumnId = (columnId) => {
    if (!String(columnId || '').startsWith(USER_ATTR_COLUMN_PREFIX)) return null
    return columnId.slice(USER_ATTR_COLUMN_PREFIX.length)
}

const humanizeSnakeCase = (name) =>
    String(name || '')
        .trim()
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())

/** Friendly column / field label for a DHIS2 user attribute definition. */
export const getUserAttributeLabel = (attr) => {
    const display = String(attr?.displayName || '').trim()
    if (display) return display

    const name = String(attr?.name || attr?.code || '').trim()
    const lower = name.toLowerCase()
    if (lower === 'gender_male' || lower === 'male') return i18n.t('Male')
    if (lower === 'gender_female' || lower === 'female') return i18n.t('Female')
    if (lower === 'gender') return i18n.t('Gender')

    return humanizeSnakeCase(name) || attr?.id || ''
}

const isTruthy = (value) => {
    if (value === true || value === 1) return true
    const v = String(value ?? '')
        .trim()
        .toLowerCase()
    return v === 'true' || v === '1' || v === 'yes'
}

/**
 * Turn raw DHIS2 attribute value into readable text (booleans, option sets, etc.).
 */
export const formatUserAttributeValue = (rawValue, attr) => {
    if (rawValue == null || rawValue === '') return ''

    if (typeof rawValue === 'object') {
        return (
            rawValue.displayName ||
            rawValue.name ||
            rawValue.code ||
            (rawValue.id ? String(rawValue.id) : '')
        )
    }

    const value = String(rawValue).trim()
    if (!value) return ''

    const valueType = attr?.valueType
    const name = String(attr?.name || attr?.code || '').toLowerCase()

    if (valueType === 'BOOLEAN' || valueType === 'TRUE_ONLY') {
        const on = isTruthy(value)
        if (name.includes('male') && !name.includes('female')) {
            return on ? i18n.t('Male') : ''
        }
        if (name.includes('female')) {
            return on ? i18n.t('Female') : ''
        }
        return on ? i18n.t('Yes') : i18n.t('No')
    }

    const options = attr?.optionSet?.options
    if (Array.isArray(options) && options.length) {
        const match = options.find(
            (o) =>
                o?.code === value ||
                o?.name === value ||
                o?.id === value ||
                String(o?.displayName || '').toLowerCase() === value.toLowerCase()
        )
        if (match) return match.displayName || match.name || value
    }

    if (/^male$/i.test(value)) return i18n.t('Male')
    if (/^female$/i.test(value)) return i18n.t('Female')
    if (/^true$/i.test(value)) return i18n.t('Yes')
    if (/^false$/i.test(value)) return i18n.t('No')

    return value
}

/**
 * Normalise DHIS2 attributeValues (array or legacy shapes) to { attributeId, value }[].
 */
export const normaliseUserAttributeValues = (user) => {
    const raw = user?.attributeValues
    if (!raw) return []

    if (Array.isArray(raw)) {
        return raw
            .map((entry) => {
                const attributeId =
                    entry?.attribute?.id ||
                    (typeof entry?.attribute === 'string' ? entry.attribute : '') ||
                    entry?.attributeId ||
                    ''
                const value = entry?.value ?? ''
                if (!attributeId) return null
                return { attributeId, value, attribute: entry?.attribute }
            })
            .filter(Boolean)
    }

    if (typeof raw === 'object') {
        return Object.entries(raw).map(([attributeId, value]) => ({
            attributeId,
            value: value == null ? '' : value,
        }))
    }

    return []
}

export const buildUserAttributeDefMap = (defs) => {
    const map = new Map()
    for (const attr of defs || []) {
        if (attr?.id) map.set(attr.id, attr)
    }
    return map
}

export const getUserAttributeDisplayValue = (user, attributeId, attributeDefMap) => {
    if (!attributeId) return ''
    const match = normaliseUserAttributeValues(user).find(
        (v) => v.attributeId === attributeId
    )
    if (!match) return ''

    const attr =
        attributeDefMap?.get?.(attributeId) ||
        (typeof attributeDefMap === 'object' && !(attributeDefMap instanceof Map)
            ? attributeDefMap[attributeId]
            : match.attribute)

    return formatUserAttributeValue(match.value, attr)
}

export const getUserScalarFieldValue = (user, fieldId) => {
    switch (fieldId) {
        case 'gender':
            return user?.gender || ''
        case 'jobTitle':
            return user?.jobTitle || ''
        case 'introduction':
            return user?.introduction || ''
        case 'code':
            return user?.code || ''
        case 'lastLogin':
            return user?.userCredentials?.lastLogin || ''
        default:
            return user?.[fieldId] != null ? String(user[fieldId]) : ''
    }
}
