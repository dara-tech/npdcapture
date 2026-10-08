import { isRiskQuestionnaireStage } from './paperFormStages'
import { riskPaperFieldGroupKind, riskPaperGroupTitle } from './riskPaperFormGroups'
import { reorderBodyFieldsAfterGateChildren } from './trackerProgramRuleFieldUi'
import { sectionUsesLabTestChecklistLayout } from './stageFieldLayout'

function isChecklistBooleanDe(de) {
    if (!de) return false
    if (de.optionSet?.options?.length) return false
    return de.valueType === 'BOOLEAN' || de.valueType === 'TRUE_ONLY'
}

/**
 * Build render items for paper stage form: single fields, risk Q5/Q7 groups, lab checklists.
 */
export function buildPaperSectionItems(
    bodyFields,
    { programStageId, bodyDeIds, mergeStageDe, useTableLayout = false, gateToChildren = null } = {}
) {
    const riskStage = isRiskQuestionnaireStage(programStageId)
    const labChecklist =
        bodyDeIds?.length &&
        mergeStageDe &&
        sectionUsesLabTestChecklistLayout(bodyDeIds, mergeStageDe)

    if (labChecklist) {
        const ordered = gateToChildren
            ? reorderBodyFieldsAfterGateChildren(bodyFields, gateToChildren)
            : bodyFields

        if (useTableLayout) {
            return ordered.map((de) => ({ type: 'field', de }))
        }

        const booleans = ordered.filter(isChecklistBooleanDe)
        const rest = ordered.filter((de) => !isChecklistBooleanDe(de))
        const items = []
        for (const de of rest) items.push({ type: 'field', de })
        if (booleans.length >= 2) {
            items.push({ type: 'checklist', fields: booleans, useFieldLabels: true, layout: 'four-column' })
        } else {
            for (const de of booleans) items.push({ type: 'field', de })
        }
        return items
    }

    const items = []
    let pendingGroup = null
    let pendingChecklist = null

    const flushGroup = () => {
        if (!pendingGroup) return
        items.push({
            type: 'group',
            kind: pendingGroup.kind,
            fields: pendingGroup.fields,
            title: pendingGroup.title,
            number: pendingGroup.number,
        })
        pendingGroup = null
    }

    const flushChecklist = () => {
        if (!pendingChecklist?.length) return
        if (pendingChecklist.length >= 2) {
            items.push({
                type: 'checklist',
                fields: pendingChecklist,
                useFieldLabels: true,
                layout: 'four-column',
            })
        } else {
            items.push({ type: 'field', de: pendingChecklist[0] })
        }
        pendingChecklist = null
    }

    for (const de of bodyFields) {
        const riskKind = riskStage ? riskPaperFieldGroupKind(de.id) : null
        if (riskKind) {
            flushChecklist()
            if (pendingGroup?.kind === riskKind) {
                pendingGroup.fields.push(de)
            } else {
                flushGroup()
                const meta = riskPaperGroupTitle(riskKind)
                pendingGroup = {
                    kind: riskKind,
                    fields: [de],
                    title: meta?.titleKey ?? null,
                    number: meta?.number ?? null,
                }
            }
            continue
        }

        if (isChecklistBooleanDe(de)) {
            flushGroup()
            if (!pendingChecklist) pendingChecklist = []
            pendingChecklist.push(de)
            continue
        }

        flushChecklist()
        flushGroup()
        items.push({ type: 'field', de })
    }

    flushChecklist()
    flushGroup()
    return items
}
