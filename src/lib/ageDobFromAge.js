import { format, subYears, differenceInYears, parseISO, isValid, startOfDay } from 'date-fns'

const normKey = (s) =>
    String(s || '')
        .normalize('NFKC')
        .normalize('NFC')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()

function pickAttributeId(attributes, needles) {
    if (!attributes?.length) return null
    let bestId = null
    let bestScore = 0
    for (const attr of attributes) {
        const n = normKey(attr.name)
        const sn = normKey(attr.shortName || '')
        for (const needle of needles) {
            let score = 0
            if (n === needle || sn === needle) score = 100
            else if (n.includes(needle) || sn.includes(needle)) score = 50 + needle.length
            if (score > bestScore) {
                bestScore = score
                bestId = attr.id
            }
        }
    }
    return bestScore > 0 ? bestId : null
}

/** Tracked entity attribute for age (completed years), by label heuristics. */
export const findAgeAttributeId = (attributes) =>
    pickAttributeId(attributes, [
        'age',
        'អាយុ',
        'age in years',
        'completed age',
        'អាយុគ្រប់',
        'current age',
        'years old',
    ])

const STI_DOB_NEEDLES = [
    'sti date of birth',
    'sti dob',
    'date of birth (sti)',
    'birth date (sti)',
    'dob (sti)',
    'stibirth',
]

const GENERIC_DOB_NEEDLES = [
    'date of birth',
    'birth date',
    'dateofbirth',
    'dob',
    'birthday',
    'birth day',
    'ថ្ងៃខែឆ្នាំកំណើត',
    'ថ្ងៃកំណើត',
]

const DOB_UI_NEEDLES = [...STI_DOB_NEEDLES, ...GENERIC_DOB_NEEDLES]

/** Tracked entity attribute for date of birth: STI-specific label wins over generic when both exist. */
export const findDobAttributeId = (attributes) =>
    pickAttributeId(attributes, STI_DOB_NEEDLES) ?? pickAttributeId(attributes, GENERIC_DOB_NEEDLES)

/**
 * Use the calendar DatePicker for this attribute: true when valueType is DATE/DATETIME,
 * or when the label matches DOB but valueType is TEXT/LONG_TEXT (Maintenance often leaves TEXT).
 */
export const attributeIsDatePickerDob = (attr) => {
    if (!attr?.id) return false
    if (attr.valueType === 'DATE' || attr.valueType === 'DATETIME') return true
    if (attr.valueType === 'BOOLEAN' || attr.valueType === 'TRUE_ONLY') return false
    return pickAttributeId([attr], DOB_UI_NEEDLES) === attr.id
}

/**
 * Completed years → approximate DOB as the same calendar day N years ago (DHIS2 `yyyy-MM-dd`).
 * Returns null if age is not a usable integer in 0..130.
 */
export const dobIsoFromCompletedAgeYears = (rawAge) => {
    if (rawAge === '' || rawAge == null) return null
    const n = typeof rawAge === 'number' ? rawAge : parseInt(String(rawAge).trim(), 10)
    if (!Number.isFinite(n) || n < 0 || n > 130) return null
    return format(subYears(new Date(), n), 'yyyy-MM-dd')
}

/**
 * Exact calendar completed years from DOB (local date) for pairing with age input.
 * @param {string} iso — `yyyy-MM-dd` or ISO string
 * @returns {string} integer years as string, or '' if invalid
 */
export const completedYearsFromDobIso = (iso) => {
    if (iso == null || iso === '') return ''
    const raw = String(iso).trim()
    const day = parseISO(raw.length >= 10 ? raw.slice(0, 10) : raw)
    if (!isValid(day)) return ''
    const today = startOfDay(new Date())
    const birth = startOfDay(day)
    const y = differenceInYears(today, birth)
    if (!Number.isFinite(y) || y < 0 || y > 130) return ''
    return String(y)
}
