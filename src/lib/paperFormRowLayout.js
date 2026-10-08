import { isPartnerSmhCodeStageField } from './partnerSmhField'
import {
    isCounsellingAdviceYesNoField,
    isPaperChecklistMultiField,
    isPaperInlineTextField,
} from './stageFieldLayout'
import { khmerFieldLabelParts } from './stageKhmerFieldGroups'

/** Leading question number from DE label (1., ១., etc.). */
export function paperFormQuestionIndex(de, fallbackIndex = null) {
    const label = String(de?.displayName || de?.name || de?.systemName || '').trim()
    const parts = khmerFieldLabelParts(label)
    if (parts?.kind === 'numbered' && parts.childNum != null) {
        return String(parts.childNum)
    }
    const m = label.match(/^([១២៣៤៥៦៧៨៩0-9]+)\s*[\.\)]\s*/u)
    if (m) return m[1]
    if (fallbackIndex != null) return String(fallbackIndex)
    return null
}

/** Paper questionnaire: almost every field is a full-width numbered row. */
export function paperFormRowLayoutForDe(de, { counsellingSection = false } = {}) {
    if (!de) return 'default'
    if (isPaperChecklistMultiField(de)) return 'toggle-panel'
    if (isPartnerSmhCodeStageField(de)) return 'partner-smh-search'
    if (counsellingSection && isCounsellingAdviceYesNoField(de)) return 'questionnaire-row'
    if (isPaperInlineTextField(de) || de.valueType === 'DATE' || de.valueType === 'LONG_TEXT') {
        return 'questionnaire-row'
    }
    if (de.optionSet?.options?.length || de.valueType === 'BOOLEAN' || de.valueType === 'TRUE_ONLY') {
        return 'questionnaire-row'
    }
    return 'questionnaire-row'
}
