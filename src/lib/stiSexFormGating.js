import { isPaperFormStage, isRiskQuestionnaireStage } from './paperFormStages'
import { PREVENTION_PROGRAM_STAGE_IDS } from './preventionProgramRulesManifest'
import { isStiProgram, STI_PROGRAM_STAGE_IDS } from './stiProgramManifest'
import { resolveUuicSourceAttributeIds, sexToUuicDigit } from './uuic'

/** Program rule variable → TEI attribute (STI program; same on prevention enrollment). */
export const STI_SEX_ATTRIBUTE_DEFAULT_ID = 'BR1fUe7Nx8V'

const STI_STAGE_NAME_HINT = /sti|ពិនិត្យនិងព្យាបាល|ពិនិត្យ.*ព្យាបាល|examination.*treatment/i
const SEX_ATTR_NAME_HINT = /ភេទ|^sex\b|gender|sex at birth|sex of birth|sex of client/i

/**
 * Section ids from DHIS2 STI rules (stage oj7dKrmA8eg) — also matched by section title when ids differ.
 * Male patient: hide female-only blocks (STI Sex is Male + contraceptive/risk rules).
 */
export const STI_SECTIONS_HIDDEN_WHEN_MALE = new Set([
    'VnFykLsT7nd',
    'PQej3LrEcHe',
    'hUPZdb0KvK2',
    'uDGwIB8FQmR',
    'WCELsehjiei',
    'g1g67GinLMT',
])

/**
 * Female patient: hide male-only blocks (STI Sex is Female rule).
 * Note: WCELsehjiei / g1g67GinLMT are hidden for *male* patients, not female.
 */
export const STI_SECTIONS_HIDDEN_WHEN_FEMALE = new Set(['jQbykgoSiTF'])

const STI_RULE_ACTION_HIDE_SECTION = /HIDE_?SECTION/i

function hideSectionIdsFromRuleActions(rule) {
    const ids = []
    for (const action of rule?.programRuleActions || []) {
        const t = String(action?.programRuleActionType || '')
        if (!STI_RULE_ACTION_HIDE_SECTION.test(t)) continue
        const secId = action?.programStageSection?.id ?? action?.programStageSection
        if (secId) ids.push(String(secId))
    }
    return ids
}

/**
 * HIDESECTION targets from STI sex rules in loaded metadata (dedicated STI program).
 * @param {object[]} [rules]
 * @param {'male'|'female'|null} patientSex
 * @param {string|null} [programStageId]
 */
export function buildStiSexHiddenSectionIdsFromRules(rules, patientSex, programStageId = null) {
    const hidden = new Set()
    if (!patientSex || !rules?.length) return hidden

    const stageId = programStageId != null ? String(programStageId) : null
    const ruleMatchesStage = (rule) => {
        const bind = rule?.programStage?.id ?? rule?.programStage
        if (!stageId) return true
        if (!bind) return true
        return String(bind) === stageId
    }

    if (patientSex === 'male') {
        for (const rule of rules) {
            const name = String(rule?.name || '')
            const cond = String(rule?.condition || '')
            if (!ruleMatchesStage(rule)) continue
            if (
                /^STI Sex is Male/i.test(name) ||
                /^STI_hide using contraceptive.*male/i.test(name) ||
                /A\{STI_Attribute_Sex\}[^=]*==\s*['"](?:Male|ប្រុស)['"]/i.test(cond)
            ) {
                for (const id of hideSectionIdsFromRuleActions(rule)) hidden.add(id)
            }
        }
    }
    if (patientSex === 'female') {
        for (const rule of rules) {
            const name = String(rule?.name || '')
            const cond = String(rule?.condition || '')
            if (!ruleMatchesStage(rule)) continue
            if (
                /^STI Sex is Female/i.test(name) ||
                /^STI_hide risk behaviour.*female/i.test(name) ||
                /A\{STI_Attribute_Sex\}[^=]*==\s*['"](?:Female|ស្រី)['"]/i.test(cond)
            ) {
                for (const id of hideSectionIdsFromRuleActions(rule)) hidden.add(id)
            }
        }
    }
    return hidden
}

/** Word-boundary English so `female` does not match `male`. */
const ENGLISH_FEMALE_WORD = /(^|[^a-z])female([^a-z]|$)/i
const ENGLISH_MALE_WORD = /(^|[^a-z])male([^a-z]|$)/i

const SECTION_HIDDEN_WHEN_MALE_HINT =
    /ស្រី|patient\s*type|ប្រភេទអ្នកជំងឺ|obstetric|ផ្ទៃពោះ|cervical|មាត់ស្បូង/i

const SECTION_HIDDEN_WHEN_FEMALE_HINT =
    /ប្រុស|ពន្យាបាទ|រង្វាន់គ្រោះ.*ប្រុស|risk\s*screen.*male|male.*risk\s*screen|ano-?scope|រន្ធគូថ/i

function sectionTitleMatchesFemaleOnlyBlock(name) {
    if (SECTION_HIDDEN_WHEN_FEMALE_HINT.test(name)) return true
    return ENGLISH_MALE_WORD.test(name)
}

function sectionTitleMatchesMaleOnlyBlock(name) {
    if (SECTION_HIDDEN_WHEN_MALE_HINT.test(name)) return true
    return ENGLISH_FEMALE_WORD.test(name)
}

function stageLabelText(stage) {
    return `${stage?.displayName || ''} ${stage?.name || ''} ${stage?.formName || ''}`
}

/**
 * STI examination form (prevention embedded stage or dedicated STI program).
 * @param {string} programStageId
 * @param {object|null} [stage]
 * @param {string|null} [programId] — enrollment program; enables STI program when stage id varies.
 */
export function isStiClinicalPaperFormStage(programStageId, stage = null, programId = null) {
    if (!programStageId || programStageId === 'PROGRAM') return false
    if (isRiskQuestionnaireStage(programStageId)) return false
    if (programStageId === PREVENTION_PROGRAM_STAGE_IDS.preventionForm) return true
    if (programStageId === STI_PROGRAM_STAGE_IDS.clinicalForm) return true
    if (programId && isStiProgram(programId)) return true
    if (isPaperFormStage(programStageId) && STI_STAGE_NAME_HINT.test(stageLabelText(stage))) {
        return true
    }
    return STI_STAGE_NAME_HINT.test(stageLabelText(stage))
}

/**
 * @param {object} metadata
 * @returns {string}
 */
export function resolveProfileSexAttributeId(metadata) {
    const ruleVars = metadata?.ruleVariables || []
    const fromVar = ruleVars.find((x) => String(x?.name || '').trim() === 'STI_Attribute_Sex')
    const fromVarId = fromVar?.trackedEntityAttribute?.id ?? fromVar?.trackedEntityAttribute
    if (fromVarId) return String(fromVarId)

    const uuicIds = resolveUuicSourceAttributeIds(metadata?.attributes, {
        programSections: metadata?.programSections,
    })
    if (uuicIds.sex) return String(uuicIds.sex)

    for (const a of metadata?.attributes || []) {
        if (a?.id === 'D7xpPXd6yMl') continue
        const label = `${a.name || ''} ${a.displayName || ''} ${a.shortName || ''} ${a.systemName || ''}`
        const withoutTypes = label.replace(/ប្រភេទ/g, '')
        if (SEX_ATTR_NAME_HINT.test(withoutTypes)) return String(a.id)
    }

    return STI_SEX_ATTRIBUTE_DEFAULT_ID
}

function sexAttributeMetaForId(metadata, sexAttributeMeta, attrId) {
    if (sexAttributeMeta?.id === attrId) return sexAttributeMeta
    return metadata?.attributes?.find((a) => a.id === attrId) || null
}

function collectSexAttributeIds(metadata, primaryId) {
    const ids = []
    const add = (id) => {
        const s = id != null ? String(id).trim() : ''
        if (s && !ids.includes(s)) ids.push(s)
    }
    add(primaryId)
    if (metadata?.attributes?.length) {
        const uuic = resolveUuicSourceAttributeIds(metadata.attributes, {
            programSections: metadata.programSections,
        })
        add(uuic.sex)
        for (const a of metadata.attributes) {
            if (a?.id === 'D7xpPXd6yMl') continue
            const label = `${a.name || ''} ${a.displayName || ''} ${a.shortName || ''} ${a.systemName || ''}`
            const withoutTypes = label.replace(/ប្រភេទ/g, '')
            if (SEX_ATTR_NAME_HINT.test(withoutTypes)) add(a.id)
        }
    }
    add(STI_SEX_ATTRIBUTE_DEFAULT_ID)
    return ids
}

/**
 * @param {Record<string, unknown>} formValues
 * @param {{ sexAttributeId?: string|null, sexAttributeMeta?: object|null, metadata?: object|null }} [opts]
 * @returns {'male'|'female'|null}
 */
export function resolveStiPatientSex(formValues, { sexAttributeId, sexAttributeMeta, metadata } = {}) {
    if (!formValues) return null

    const ids = collectSexAttributeIds(metadata, sexAttributeId)
    for (const id of ids) {
        const raw = formValues[id]
        if (raw === undefined || raw === null || String(raw).trim() === '') continue
        const meta = sexAttributeMetaForId(metadata, sexAttributeMeta, id)
        const digit = sexToUuicDigit(raw, meta)
        if (digit === '1') return 'male'
        if (digit === '2') return 'female'
    }
    return null
}

export function stiSectionHiddenByPatientSex(section, patientSex, { useTitleHints = false } = {}) {
    if (!section?.id || !patientSex) return false
    const id = String(section.id)
    const name = `${section.name || ''} ${section.formName || ''} ${section.displayName || ''}`

    if (patientSex === 'male') {
        if (STI_SECTIONS_HIDDEN_WHEN_MALE.has(id)) return true
        if (useTitleHints && sectionTitleMatchesMaleOnlyBlock(name)) return true
    }
    if (patientSex === 'female') {
        if (STI_SECTIONS_HIDDEN_WHEN_FEMALE.has(id)) return true
        if (useTitleHints && sectionTitleMatchesFemaleOnlyBlock(name)) return true
    }
    return false
}

/**
 * Client-side HIDESECTION parity for Capture prevention program (STI_* rules are filtered out).
 * @param {object[]} sections
 * @param {'male'|'female'|null} patientSex
 * @returns {Set<string>}
 */
export function buildStiSexHiddenSectionIds(sections, patientSex, rules = null, programStageId = null) {
    const hidden = new Set()
    if (!patientSex) return hidden

    // Rule-driven first: when STI rules are present on metadata, follow them exactly.
    const fromRules = buildStiSexHiddenSectionIdsFromRules(rules, patientSex, programStageId)
    if (fromRules.size > 0) return fromRules

    // Fallback for environments where STI_* rules are filtered out (e.g. prevention manifests).
    const idSet =
        patientSex === 'male' ? STI_SECTIONS_HIDDEN_WHEN_MALE : STI_SECTIONS_HIDDEN_WHEN_FEMALE
    for (const section of sections || []) {
        if (section?.id && idSet.has(String(section.id))) {
            hidden.add(section.id)
        }
    }
    return hidden
}

/**
 * @param {string} baseTitle — stage display name (e.g. ពិនិត្យនិងព្យាបាល STI)
 * @param {'male'|'female'|null} patientSex
 * @param {(key: string, opts?: object) => string} t — i18n.t
 */
const STI_FORM_SUFFIX_FALLBACK = {
    male: { km: 'ទម្រង់បុរស', en: 'Male form' },
    female: { km: 'ទម្រង់ស្រី', en: 'Female form' },
}

export function resolveStiPaperFormTitle(baseTitle, patientSex, t) {
    const base = String(baseTitle || '').trim()
    if (!base || !patientSex || typeof t !== 'function') return base || ''
    const key = patientSex === 'male' ? 'Male form' : 'Female form'
    let suffix = t(key)
    if (!suffix || suffix === key) {
        const fb = STI_FORM_SUFFIX_FALLBACK[patientSex]
        suffix = /[\u1780-\u17FF]/.test(base) ? fb.km : fb.en
    }
    return `${base} — ${suffix}`
}
