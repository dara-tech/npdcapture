import { PREVENTION_PROGRAM_STAGE_IDS } from './preventionProgramRulesManifest'
import { STI_PROGRAM_STAGE_IDS } from './stiProgramManifest'
import { isMedicineTreatmentSection, programHasStiMedicineSlots } from './medicineSlots'

const COUNSELLING_SECTION_HINT = /counsell|counsel|ប្រឹក្សា|ដំបូន្មាន/i

export const PAPER_FORM_STAGE_IDS = new Set([
    PREVENTION_PROGRAM_STAGE_IDS.riskAssessment,
    PREVENTION_PROGRAM_STAGE_IDS.preventionForm,
    STI_PROGRAM_STAGE_IDS.clinicalForm,
])

const RISK_SECTION_HINT = /risk|ប្រឈម|screening|questionnaire/i
const PREVENTION_SECTION_HINT = /prevention|បង្ការ|counsel|ប្រឹក្សា|education|អប់រំ/i

export function isPaperFormStage(programStageId) {
    if (!programStageId) return false
    return PAPER_FORM_STAGE_IDS.has(programStageId)
}

export function sectionUsesPaperFormMode(
    section,
    programStageId,
    { bodyDeIds = [], mergeStageDe, medicineDeToSlot, medicineSlots } = {}
) {
    if (!isPaperFormStage(programStageId)) return false
    if (COUNSELLING_SECTION_HINT.test(String(section?.name || section?.formName || ''))) return true

    if (
        programHasStiMedicineSlots &&
        isMedicineTreatmentSection(section, {
            medicineDeToSlot,
            medicineSlots,
            mergeStageDe,
        })
    ) {
        return false
    }

    const name = String(section?.name || section?.formName || '')
    if (RISK_SECTION_HINT.test(name) || PREVENTION_SECTION_HINT.test(name)) return true

    const des = (bodyDeIds || []).map((id) => mergeStageDe?.(id)).filter(Boolean)
    if (!des.length) return false

    const paperLike = des.filter(
        (de) =>
            de.valueType === 'BOOLEAN' ||
            de.valueType === 'TRUE_ONLY' ||
            de.valueType === 'DATE' ||
            (de.optionSet?.options?.length || 0) > 0 ||
            ['TEXT', 'NUMBER', 'INTEGER', 'INTEGER_POSITIVE', 'INTEGER_ZERO_OR_POSITIVE'].includes(
                de.valueType
            )
    ).length

    return paperLike >= Math.max(2, Math.ceil(des.length * 0.5))
}

export function isRiskQuestionnaireStage(programStageId) {
    return programStageId === PREVENTION_PROGRAM_STAGE_IDS.riskAssessment
}

/** Risk = single-column numbered list; Prevention form = sectioned paper grid. */
export function resolvePaperFormGridClass(bodyDeIds, mergeStageDe, programStageId, section) {
    if (!isPaperFormStage(programStageId)) return null
    if (isRiskQuestionnaireStage(programStageId)) return 'paperQuestionnaireList'
    const count = (bodyDeIds || []).length
    if (count <= 4) return 'paperFormGridSingle'
    return 'paperFormGrid'
}
