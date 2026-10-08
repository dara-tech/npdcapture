/** Risk assessment paper-form grouping (guide Q5 / Q7). */

export const RISK_RESULT_DE_ID = 'MBizmGFOeZg'

/** Partner gender — multi □ under one Q5. */
export const RISK_Q5_PARTNER_DE_IDS = new Set([
    'IjncwaiwvUv',
    'TlXvK6qrt1b',
    'G4r3E6LI70l',
    'tbhIV6y082E',
])

/** Practices — multi □ under one Q7. */
export const RISK_Q7_PRACTICE_DE_IDS = new Set([
    'b5Jgn263AJT',
    'BKILZQUFa2t',
    'bls0dsZMoRO',
    'JhZONUgUE87',
    'HnK9Yh1aWn1',
    'nXk4YihKCF5',
    'fVWjzCcSCyF',
    'FdYD7ISx2s6',
    'q4Xuew3y1c7',
])

export function riskPaperFieldGroupKind(deId) {
    if (!deId) return null
    if (RISK_Q5_PARTNER_DE_IDS.has(deId)) return 'q5-partner'
    if (RISK_Q7_PRACTICE_DE_IDS.has(deId)) return 'q7-practice'
    return null
}

export function riskPaperGroupTitle(kind) {
    if (kind === 'q5-partner') {
        return {
            number: '5',
            titleKey:
                'In the past 6 months, what was the gender of your sexual partner(s)? (check all that apply)',
        }
    }
    if (kind === 'q7-practice') {
        return {
            number: '7',
            titleKey:
                'Have you had any of the following experiences in the past 6 months? (check all that apply)',
        }
    }
    return null
}
