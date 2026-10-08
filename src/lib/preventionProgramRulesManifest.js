/**
 * Prevention program (១.កម្មវិធីបង្ការសហគមន៍) — canonical rules/variables for Capture.
 *
 * DHIS2 Maintenance often attaches PrEP/STI/Kit/GIS rules to this program (185 rules).
 * Capture filters to prevention-only rules so the form matches what we actually use.
 *
 * To fully clean DHIS2: run `node scripts/prevention-program-rules-audit.mjs` and follow
 * capture/docs/prevention-program-rules-cleanup.md
 */

export const PREVENTION_PROGRAM_ID = 'gmO3xUubvMb'

export const PREVENTION_PROGRAM_STAGE_IDS = {
    preventionForm: 'mX4OjpyZw3A',
    riskAssessment: 'hqJKFmOU6s7',
}

/** Rule name prefixes that belong to other programs — not evaluated in Capture for prevention. */
const EXCLUDED_RULE_NAME_PREFIXES = [/^(PrEP)/, /^STI/, /^Kit_/, /^GIS /]

/** Variable name prefixes to drop when loading prevention metadata. */
const EXCLUDED_VARIABLE_NAME_PREFIXES = [/^PrEP /, /^STI_/, /^Kit_/, /^GIS /]

/**
 * Variables referenced by the 15 prevention-only rules (audit on DHIS2 2.40.5).
 * Used as allowlist fallback when a variable is not matched by rule conditions.
 */
export const PREVENTION_RULE_VARIABLE_ALLOWLIST = [
    'ART DE',
    'DE modality',
    'Next appointment Date',
    'Pre confirm hiv result-F2 form',
    'Risk_10HIV tested',
    'Risk_11HIVresult',
    'Risk_1sex at birth',
    'Risk_3sex6m',
    'Risk_5partner',
    'Risk_6.10-non above',
    'Risk_61Receive money',
    'Risk_62Paidsex',
    'Risk_63Sexwith known',
    'Risk_64Sexwithoutcondom',
    'Risk_65sti',
    'Risk_66abortion',
    'Risk_67alcohol',
    'Risk_68highfun',
    'Risk_69injected',
    'Risk_7sexagainst',
    'Risk_8concerns',
    'Risk_9PrEP',
    'Ulceration Ano',
]

const ALLOWLIST_SET = new Set(PREVENTION_RULE_VARIABLE_ALLOWLIST)

export function isPreventionProgram(programId) {
    return String(programId || '') === PREVENTION_PROGRAM_ID
}

function matchesExcludedPrefix(name, prefixes) {
    const n = String(name || '')
    return prefixes.some((re) => re.test(n))
}

export function isExcludedPreventionRuleName(ruleName) {
    return matchesExcludedPrefix(ruleName, EXCLUDED_RULE_NAME_PREFIXES)
}

export function isExcludedPreventionVariableName(variableName) {
    return matchesExcludedPrefix(variableName, EXCLUDED_VARIABLE_NAME_PREFIXES)
}

/** Extract #{var} and A{var} names from rule conditions. */
export function extractVariableNamesFromRules(rules = []) {
    const names = new Set()
    for (const rule of rules || []) {
        const condition = String(rule?.condition || '')
        for (const m of condition.matchAll(/#\{([^}]+)\}/g)) {
            names.add(m[1].trim())
        }
        for (const m of condition.matchAll(/A\{([^}]+)\}/g)) {
            names.add(m[1].trim())
        }
    }
    return names
}

/**
 * Keep prevention workflow rules only (≈15 on a clean server).
 * @param {object[]} rules
 * @returns {object[]}
 */
export function filterPreventionProgramRules(rules = []) {
    return (rules || []).filter((r) => r?.id && !isExcludedPreventionRuleName(r.name))
}

/**
 * Keep variables needed for filtered rules + TEI attributes + Risk_* gates.
 * @param {object[]} variables
 * @param {object[]} [filteredRules]
 * @returns {object[]}
 */
export function filterPreventionProgramRuleVariables(variables = [], filteredRules = []) {
    const fromConditions = extractVariableNamesFromRules(filteredRules)

    return (variables || []).filter((v) => {
        const name = String(v?.name || '').trim()
        if (!name) return false
        if (isExcludedPreventionVariableName(name)) return false
        if (fromConditions.has(name)) return true
        if (ALLOWLIST_SET.has(name)) return true
        if (name.startsWith('Risk_')) return true
        if (v.programRuleVariableSourceType === 'TEI_ATTRIBUTE') return true
        return false
    })
}

/**
 * Apply prevention filters to normalized metadata rules/variables.
 * @param {string} programId
 * @param {{ rules?: object[], ruleVariables?: object[] }} metadataSlice
 */
export function applyPreventionProgramRulesFilter(programId, { rules = [], ruleVariables = [] } = {}) {
    if (!isPreventionProgram(programId)) {
        return { rules, ruleVariables, filtered: false }
    }
    const filteredRules = filterPreventionProgramRules(rules)
    const filteredVariables = filterPreventionProgramRuleVariables(ruleVariables, filteredRules)
    return {
        rules: filteredRules,
        ruleVariables: filteredVariables,
        filtered: true,
        droppedRules: (rules?.length || 0) - filteredRules.length,
        droppedVariables: (ruleVariables?.length || 0) - filteredVariables.length,
    }
}
