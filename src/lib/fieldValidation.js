const NUMERIC_TYPES = new Set([
    'NUMBER',
    'INTEGER',
    'INTEGER_POSITIVE',
    'INTEGER_NEGATIVE',
    'PERCENTAGE',
    'UNIT_INTERVAL',
])

const isEmpty = (value) => value === '' || value === null || value === undefined

/**
 * HTML input type hint for DHIS2 value types (subset).
 */
export const getInputTypeForValueType = (valueType) => {
    if (NUMERIC_TYPES.has(valueType)) return 'number'
    if (valueType === 'PHONE_NUMBER') return 'tel'
    return 'text'
}

const validateNumeric = (value, valueType, label) => {
    const n = Number(value)
    if (Number.isNaN(n)) {
        return `${label} must be a number`
    }
    if (
        valueType === 'INTEGER' ||
        valueType === 'INTEGER_POSITIVE' ||
        valueType === 'INTEGER_NEGATIVE'
    ) {
        if (!Number.isInteger(n)) {
            return `${label} must be a whole number`
        }
    }
    if (valueType === 'INTEGER_POSITIVE' && n < 1) {
        return `${label} must be a positive integer`
    }
    if (valueType === 'INTEGER_NEGATIVE' && n >= 0) {
        return `${label} must be a negative number`
    }
    if (valueType === 'UNIT_INTERVAL' && (n < 0 || n > 1)) {
        return `${label} must be between 0 and 1`
    }
    if (valueType === 'PERCENTAGE' && (n < 0 || n > 100)) {
        return `${label} must be between 0 and 100`
    }
    return null
}

/**
 * Only forward patterns that compile as JavaScript RegExp (DHIS2 uses Java; some differ).
 */
export const patternForHtmlInput = (pattern) => {
    if (!pattern) return undefined
    try {
        // eslint-disable-next-line no-new
        new RegExp(pattern)
        return pattern
    } catch {
        return undefined
    }
}

export const validateFieldValue = (value, { mandatory, pattern, valueType, name }) => {
    const label = name || 'This field'
    if (mandatory && isEmpty(value)) {
        if (valueType === 'BOOLEAN') {
            return null
        }
        return `${label} is required`
    }
    if (isEmpty(value)) {
        return null
    }

    const str = String(value)

    if (valueType === 'TRUE_ONLY') {
        if (str !== 'true') {
            return `${label} must be checked (true only)`
        }
        return null
    }

    if (NUMERIC_TYPES.has(valueType)) {
        const numErr = validateNumeric(str, valueType, label)
        if (numErr) return numErr
    }

    if (pattern && str) {
        const isSmhField = /SMH/i.test(label || '')
        if (isSmhField && /^SMH[A-Za-z0-9]+-\d+$/i.test(str.trim())) {
            return null
        }
        try {
            const re = new RegExp(pattern)
            if (!re.test(str)) {
                return `${label} does not match the required format`
            }
        } catch {
            // Pattern may be Java-specific; skip rather than block save
        }
    }

    return null
}
