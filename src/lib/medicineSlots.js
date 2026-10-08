import { optionSetUiVariant } from './stageFieldRender'
import { trackerDataEntryValueIsPresent } from './trackerProgramRuleFieldUi'

/** @param {unknown} ref */
const idFromRef = (ref) => {
    if (ref == null) return null
    if (typeof ref === 'string') return ref
    if (typeof ref === 'object' && ref.id) return String(ref.id)
    return null
}

const normalizeActionType = (raw) =>
    String(raw ?? '')
        .trim()
        .toUpperCase()
        .replace(/-/g, '_')

const medicineVarNameMatch = (name) => {
    const s = String(name || '').trim()
    const m = s.match(/^STI[_\s-]*Medicine\s*(\d+)$/i)
    return m ? Number(m[1]) : null
}

const medicineRuleIndexMatch = (ruleName) => {
    const m = String(ruleName || '').match(/Medicine\s*(\d+)\s+has\s+no\s+value/i)
    return m ? Number(m[1]) : null
}

const findVariableByName = (variables, varName) => {
    const key = String(varName || '').trim()
    if (!key) return null
    return (
        variables.find((x) => String(x.name || '').trim() === key) ||
        variables.find((x) => String(x.displayName || '').trim() === key) ||
        null
    )
}

const detailDeIdsFromRule = (rule, nameDeId) => {
    const detailDeIds = []
    for (const a of rule?.programRuleActions || []) {
        const act = normalizeActionType(a.programRuleActionType)
        if (act !== 'HIDEFIELD' && act !== 'HIDE_FIELD') continue
        const deId = idFromRef(a.dataElement)
        if (deId && deId !== nameDeId) detailDeIds.push(deId)
    }
    return [...new Set(detailDeIds)]
}

const KHMER_SLOT_DIGIT = { '១': 1, '២': 2, '៣': 3, '៤': 4, '៥': 5 }

/** Khmer/English clues that a numbered label is a medicine row, not e.g. HIV test "១-…" questions. */
const MEDICINE_LABEL_HINT = /ឱសថ|ឈ្មោះ\s*ឱសថ|medicine|medication|drug\b|Rx\b/i

const MEDICINE_NAME_LABEL = /ឈ្មោះ\s*ឱសថ|name\s*of\s*medicine|medicine\s*name|drug\s*name/i
const MEDICINE_FORM_LABEL = /ទម្រង់|dosage\s*form|medicine\s*form|form\s*of\s*medicine/i
const OTHER_MEDICINE_NAME_LABEL =
    /ផ្សេង\s*ទៀត|other\s*drug|other\s*medicine|ឈ្មោះឱសថផ្សេង|ឱសថផ្សេង/i

/** “Other drug name” row (often TEXT in Maintenance but uses the same drug list as row ១). */
export function isMedicineOtherDrugNameElement(de) {
    if (!de) return false
    const label = String(de.displayName || de.name || '').trim()
    return OTHER_MEDICINE_NAME_LABEL.test(label)
}

/** Medicine *name* DE (drug list) — searchable select in the treatment grid. */
export const isMedicineNameDataElement = (de) => {
    if (!de) return false
    const label = String(de.displayName || de.name || '').trim()
    if (isMedicineOtherDrugNameElement(de)) return true
    if (MEDICINE_NAME_LABEL.test(label)) return true
    const count = de?.optionSet?.options?.length || 0
    return count > 20
}

/** Treatment / medicine blocks (១–៥ rows, “other drug”, etc.). */
export function isMedicineTreatmentSection(
    section,
    { medicineDeToSlot, medicineSlots, mergeStageDe } = {}
) {
    if (!section) return false
    const title = String(section.name || section.formName || '').trim()
    
    // Do not classify Drug Allergy/Reaction sections as treatment grids
    if (/allergy|ប្រតិកម្ម/i.test(title)) return false
    
    if (MEDICINE_SECTION_TITLE_HINT.test(title)) return true
    const ids = section.dataElementIds || []
    if (medicineSlots?.some((s) => s.nameDeId && ids.includes(s.nameDeId))) return true
    if (ids.some((id) => medicineDeToSlot?.has?.(id))) return true
    if (mergeStageDe) {
        return ids.some((id) => {
            const de = mergeStageDe(id)
            return isMedicineOtherDrugNameElement(de) || isMedicineFormDataElement(de)
        })
    }
    return false
}

export function findPrimaryMedicineNameDataElement(stageDataElements, resolveDe) {
    for (const row of stageDataElements || []) {
        const de = typeof resolveDe === 'function' ? resolveDe(row?.id) : row
        if (!de) continue
        if (isMedicineOtherDrugNameElement(de)) continue
        if (isMedicineNameDataElement(de) && (de.optionSet?.options?.length || 0) > 0) {
            return de
        }
    }
    return null
}

/**
 * Other-drug name (TEXT) and similar rows: reuse the main medicine option set for a searchable select.
 */
export function resolveMedicineFieldDeForUi(de, { stageDataElements = [], resolveDe } = {}) {
    const base = typeof resolveDe === 'function' && de?.id ? resolveDe(de.id) : de
    if (!base) return de
    if (base.optionSet?.options?.length) return base
    const needsDrugList =
        isMedicineOtherDrugNameElement(base) ||
        (isMedicineNameDataElement(base) && base.valueType === 'TEXT')
    if (!needsDrugList) return base
    const primary = findPrimaryMedicineNameDataElement(stageDataElements, resolveDe)
    if (!primary?.optionSet?.options?.length) return base
    return {
        ...base,
        optionSet: primary.optionSet,
    }
}

/** Medicine form / presentation (tablet, IM, …) — select in the treatment grid. */
export const isMedicineFormDataElement = (de) => {
    if (!de) return false
    const label = String(de.displayName || de.name || '').trim()
    return MEDICINE_FORM_LABEL.test(label)
}

/**
 * Treatment row cells: searchable select for single-choice fields (Tracker Capture parity).
 * Multi-select DEs keep checkbox render type from Maintenance.
 */
export function medicineGridOptionUiVariant(de) {
    if (!de?.optionSet?.options?.length) return 'DROPDOWN'
    const raw = optionSetUiVariant(de)
    if (raw === 'VERTICAL_MULTI' || raw === 'HORIZONTAL_MULTI') return raw
    if (isMedicineNameDataElement(de) || isMedicineFormDataElement(de)) return 'DROPDOWN'
    return 'DROPDOWN'
}

const isMedicineNameDe = isMedicineNameDataElement

/**
 * Section/stage titles used to place the Add-medicine control (treatment block only).
 * Matches e.g. "ឆ-Treatment - ១.ការព្យាបាលដោយឱសថ"; excludes "តេស្ត/HIV test" blocks.
 */
export const MEDICINE_SECTION_TITLE_HINT =
    /treatment|ព្យាបាល|ឱសថ|medicine|medication|drug\b|ឈ្មោះឱសថ/i

/** True when program metadata includes STI medicine rule variables (not generic numbered option-set sections). */
export function programHasStiMedicineSlots(metadata) {
    if (!metadata) return false
    for (const v of metadata.ruleVariables || []) {
        if (medicineVarNameMatch(v.name || v.displayName) != null) return true
    }
    for (const r of metadata.rules || []) {
        const name = String(r.name || '')
        if (medicineRuleIndexMatch(name) != null && /STI/i.test(name)) return true
    }
    return false
}

/**
 * Medicine rows: ១-… / ២-… when label suggests medicine, DE is option-set (name), or field sits in a treatment/medicine section.
 * @param {{ inMedicineSection?: boolean }} [opts] — when true, numbered Khmer/ASCII rows count even if the DE label omits medicine keywords (Core Capture parity in treatment blocks).
 */
export const medicineSlotIndexFromDe = (de, opts = {}) => {
    if (!de) return null
    const label = String(de.displayName || de.name || '').trim()
    const allowNumberedMedicineRow =
        Boolean(opts.inMedicineSection) || MEDICINE_LABEL_HINT.test(label)

    let m = label.match(/^([១២៣៤៥]|[1-5])[\s.]*[-–—]/)
    if (m) {
        if (!allowNumberedMedicineRow) {
            m = null
        } else {
            const ch = m[1]
            if (KHMER_SLOT_DIGIT[ch] != null) return KHMER_SLOT_DIGIT[ch]
            const n = Number(ch)
            return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null
        }
    }
    m = label.match(/^medicine\s*([1-5])\b/i)
    if (m) return Number(m[1])
    return null
}

const resolveDe = (metadata, deId) => {
    const base = metadata?.dataElements?.[deId]
    if (base?.optionSet?.options?.length) return { ...base, id: deId }
    for (const stage of metadata?.stages || []) {
        const row = stage.dataElements?.find((d) => d.id === deId)
        if (row) {
            return {
                ...base,
                ...row,
                id: deId,
                displayName: row.displayName || row.name || base?.displayName,
                name: row.name || base?.name,
                optionSet: row.optionSet || base?.optionSet,
            }
        }
    }
    return base ? { ...base, id: deId } : null
}

/**
 * Infer medicine rows from an ordered list of DE ids (section or flat stage layout).
 * @param {string[]} ids
 */
function inferMedicineSlotsFromDeIdList(metadata, ids, slotOpts = {}) {
    if (!ids?.length) return []

    const bySlot = new Map()
    for (const deId of ids) {
        const de = resolveDe(metadata, deId)
        const slotIndex = medicineSlotIndexFromDe(de, slotOpts)
        if (slotIndex == null) continue
        if (!bySlot.has(slotIndex)) {
            bySlot.set(slotIndex, { index: slotIndex, nameDeId: null, detailDeIds: [], allDeIds: [] })
        }
        const slot = bySlot.get(slotIndex)
        slot.allDeIds.push(deId)
        if (isMedicineNameDe(de)) {
            slot.nameDeId = deId
        } else if (!slot.nameDeId) {
            slot.detailDeIds.push(deId)
        } else {
            slot.detailDeIds.push(deId)
        }
    }

    if (bySlot.size >= 2) {
        return [...bySlot.values()]
            .sort((a, b) => a.index - b.index)
            .map((slot) => {
                if (!slot.nameDeId) slot.nameDeId = slot.allDeIds[0]
                slot.detailDeIds = slot.allDeIds.filter((id) => id !== slot.nameDeId)
                return slot
            })
    }

    if (!slotOpts.inMedicineSection) {
        return []
    }

    const slots = []
    let i = 0
    while (i < ids.length) {
        const de = resolveDe(metadata, ids[i])
        if (isMedicineNameDe(de)) {
            const chunk = ids.slice(i, i + 5)
            slots.push({
                index: slots.length + 1,
                nameDeId: chunk[0],
                detailDeIds: chunk.slice(1).filter(Boolean),
                allDeIds: chunk.filter(Boolean),
            })
            i += 5
            continue
        }
        i += 1
    }
    if (slots.length >= 2) return slots

    const nameFieldIndices = []
    ids.forEach((deId, idx) => {
        if (isMedicineNameDe(resolveDe(metadata, deId))) nameFieldIndices.push(idx)
    })
    if (nameFieldIndices.length >= 2) {
        const inferred = []
        for (let k = 0; k < nameFieldIndices.length; k += 1) {
            const start = nameFieldIndices[k]
            const end = k + 1 < nameFieldIndices.length ? nameFieldIndices[k + 1] : ids.length
            const chunk = ids.slice(start, Math.min(start + 5, end))
            if (chunk.length) {
                inferred.push({
                    index: inferred.length + 1,
                    nameDeId: chunk[0],
                    detailDeIds: chunk.slice(1).filter(Boolean),
                    allDeIds: chunk.filter(Boolean),
                })
            }
        }
        if (inferred.length >= 2) return inferred
    }
    return []
}

/** When programStageSections is empty, DHIS2 still orders DEs in programStageDataElements — use that. */
function buildMedicineSlotsFromFlatStage(metadata, programStageId) {
    if (!programStageId || !metadata?.stages?.length) return []
    const stage = metadata.stages.find((s) => s.id === programStageId)
    if (!stage?.dataElements?.length) return []
    const inMed = MEDICINE_SECTION_TITLE_HINT.test(stage.name || '')
    return inferMedicineSlotsFromDeIdList(metadata, stage.dataElements.map((d) => d.id), {
        inMedicineSection: inMed,
    })
}

/**
 * Group section DEs by Khmer/ascii slot prefix (១-, ២-, …) — most reliable for STI treatment section.
 */
export function buildMedicineSlotsFromStageLayout(metadata, programStageId = null) {
    const stages = programStageId
        ? (metadata?.stages || []).filter((s) => s.id === programStageId)
        : metadata?.stages || []

    for (const stage of stages) {
        for (const section of stage.sections || []) {
            const inMed = MEDICINE_SECTION_TITLE_HINT.test(section.name || section.formName || '')
            const slots = inferMedicineSlotsFromDeIdList(metadata, section.dataElementIds || [], {
                inMedicineSection: inMed,
            })
            if (slots.length >= 2) return slots
        }
    }
    return []
}

/** Build slot list from Khmer/ascii prefixes when rule variables are missing. */
export function buildMedicineSlotsFromLabels(metadata, programStageId = null) {
    const labelMap = buildMedicineDeToSlotIndexFromLabels(metadata, programStageId)
    if (!labelMap.size) return []

    const byIndex = new Map()
    for (const [deId, index] of labelMap) {
        if (!byIndex.has(index)) {
            byIndex.set(index, { index, nameDeId: null, detailDeIds: [], allDeIds: [] })
        }
        const slot = byIndex.get(index)
        slot.allDeIds.push(deId)
        const de = resolveDe(metadata, deId)
        if (isMedicineNameDe(de)) {
            slot.nameDeId = deId
        } else {
            slot.detailDeIds.push(deId)
        }
    }

    return [...byIndex.values()]
        .sort((a, b) => a.index - b.index)
        .map((slot) => {
            if (!slot.nameDeId) slot.nameDeId = slot.allDeIds[0]
            slot.detailDeIds = slot.allDeIds.filter((id) => id !== slot.nameDeId)
            return slot
        })
}

/**
 * Slot index for one DE (labels map + section-aware prefix), for visibility overrides.
 */
export function medicineSlotIndexForDeId(metadata, programStageId, deId, labelMap = null) {
    if (!deId || !metadata) return null
    const fromMap = labelMap?.get?.(deId)
    if (fromMap != null) return fromMap

    const de = resolveDe(metadata, deId)
    if (!de || !programStageId) return null

    const stage = metadata.stages?.find((s) => s.id === programStageId)
    if (!stage) return null

    for (const sec of stage.sections || []) {
        if (!(sec.dataElementIds || []).includes(deId)) continue
        const inMed = MEDICINE_SECTION_TITLE_HINT.test(sec.name || sec.formName || '')
        return medicineSlotIndexFromDe(de, { inMedicineSection: inMed })
    }

    if (!(stage.sections || []).length) {
        const inMed = MEDICINE_SECTION_TITLE_HINT.test(stage.name || '')
        return medicineSlotIndexFromDe(de, { inMedicineSection: inMed })
    }

    return null
}

/** Map every stage DE id → medicine slot index (1–5) from display name prefix. */
export function buildMedicineDeToSlotIndexFromLabels(metadata, programStageId = null) {
    if (!programHasStiMedicineSlots(metadata)) return new Map()
    const map = new Map()
    const stages = programStageId
        ? (metadata?.stages || []).filter((s) => s.id === programStageId)
        : metadata?.stages || []
    for (const stage of stages) {
        const hasSections = (stage.sections || []).length > 0

        for (const section of stage.sections || []) {
            const inMed = MEDICINE_SECTION_TITLE_HINT.test(section.name || section.formName || '')
            for (const deId of section.dataElementIds || []) {
                const idx = medicineSlotIndexFromDe(resolveDe(metadata, deId), {
                    inMedicineSection: inMed,
                })
                if (idx != null) map.set(deId, idx)
            }
        }

        /** Only flat stages (no sections): use stage title. Never tag every stage DE when sections exist. */
        if (!hasSections && MEDICINE_SECTION_TITLE_HINT.test(stage.name || '')) {
            for (const row of stage.dataElements || []) {
                const idx = medicineSlotIndexFromDe(resolveDe(metadata, row.id), {
                    inMedicineSection: true,
                })
                if (idx != null) map.set(row.id, idx)
            }
        }
    }
    return map
}

const asIdArray = (value) => (Array.isArray(value) ? value : [])

/** All DE ids for a slot (allDeIds may be unset before attachDetailIdsFromSection). */
export const getMedicineSlotDeIds = (slot) => {
    const all = asIdArray(slot?.allDeIds)
    if (all.length) return all
    return [slot?.nameDeId, ...asIdArray(slot?.detailDeIds)].filter(Boolean)
}

const mergeMedicineSlot = (existing, incoming) => {
    existing.detailDeIds = [
        ...new Set([...asIdArray(existing.detailDeIds), ...asIdArray(incoming.detailDeIds)]),
    ]
    existing.allDeIds = [...new Set([...getMedicineSlotDeIds(existing), ...getMedicineSlotDeIds(incoming)])]
    if (!existing.nameDeId) existing.nameDeId = incoming.nameDeId
}

const maxSlotIndex = (slots) => {
    if (!slots?.length) return 0
    return Math.max(...slots.map((s) => s.index))
}

function attachDetailIdsFromSection(slots, metadata, programStageId = null) {
    const sectionByDe = new Map()
    for (const stage of metadata?.stages || []) {
        for (const section of stage.sections || []) {
            for (const deId of section.dataElementIds || []) {
                if (!sectionByDe.has(deId)) sectionByDe.set(deId, section.dataElementIds)
            }
        }
    }

    let flatOrderIds = null
    if (programStageId) {
        const st = metadata?.stages?.find((s) => s.id === programStageId)
        const ids = st?.dataElements?.map((d) => d.id)
        if (ids?.length) flatOrderIds = ids
    }

    for (const slot of slots) {
        if (slot.detailDeIds.length === 0) {
            let orderedIds = sectionByDe.get(slot.nameDeId)
            if (!orderedIds && flatOrderIds?.includes(slot.nameDeId)) {
                orderedIds = flatOrderIds
            }
            if (orderedIds) {
                const pos = orderedIds.indexOf(slot.nameDeId)
                if (pos >= 0) {
                    slot.detailDeIds = orderedIds
                        .slice(pos + 1, pos + 5)
                        .filter((id) => id && id !== slot.nameDeId)
                }
            }
        }
        slot.allDeIds = [slot.nameDeId, ...slot.detailDeIds].filter(Boolean)
    }
    return slots
}

/**
 * STI medicine slots from program rule variables, rule names, and stage layout.
 * @returns {Array<{ index: number, nameDeId: string, detailDeIds: string[], allDeIds: string[] }>}
 */
export function buildMedicineSlotsFromMetadata(metadata, programStageId = null) {
    if (!metadata) return []
    const stiMedicineProgram = programHasStiMedicineSlots(metadata)

    const variables = metadata?.ruleVariables || []
    const rules = metadata?.rules || []
    const slotsMap = new Map()

    for (const v of variables) {
        const index = medicineVarNameMatch(v.name || v.displayName)
        if (index == null) continue
        const nameDeId = idFromRef(v.dataElement)
        if (!nameDeId) continue

        const rule = rules.find(
            (r) =>
                medicineRuleIndexMatch(r.name) === index && /STI/i.test(String(r.name || ''))
        )
        slotsMap.set(index, {
            index,
            nameDeId,
            detailDeIds: detailDeIdsFromRule(rule, nameDeId),
            allDeIds: [],
        })
    }

    for (const rule of rules) {
        const index = medicineRuleIndexMatch(rule.name)
        if (index == null || slotsMap.has(index)) continue
        if (!/STI/i.test(String(rule.name || ''))) continue

        const condMatch = String(rule.condition || '').match(/#\{([^}]+)\}/)
        const varName = condMatch?.[1]?.trim()
        let nameDeId = null
        if (varName) {
            const v = findVariableByName(variables, varName)
            nameDeId = idFromRef(v?.dataElement)
        }

        if (!nameDeId) continue
        slotsMap.set(index, {
            index,
            nameDeId,
            detailDeIds: detailDeIdsFromRule(rule, nameDeId),
            allDeIds: [],
        })
    }

    const fromLayout = stiMedicineProgram
        ? buildMedicineSlotsFromStageLayout(metadata, programStageId)
        : []
    for (const s of fromLayout) {
        const existing = slotsMap.get(s.index)
        if (!existing) {
            slotsMap.set(s.index, s)
            continue
        }
        mergeMedicineSlot(existing, s)
    }
    const labelSlots = stiMedicineProgram ? buildMedicineSlotsFromLabels(metadata, programStageId) : []
    for (const s of labelSlots) {
        const existing = slotsMap.get(s.index)
        if (!existing) {
            slotsMap.set(s.index, s)
            continue
        }
        mergeMedicineSlot(existing, s)
    }
    const flatSlots = stiMedicineProgram ? buildMedicineSlotsFromFlatStage(metadata, programStageId) : []
    for (const s of flatSlots) {
        const existing = slotsMap.get(s.index)
        if (!existing) {
            slotsMap.set(s.index, s)
            continue
        }
        mergeMedicineSlot(existing, s)
    }

    const labelOnlySlots = labelSlots
    const flatSlotsForMax = flatSlots
    const maxRuleIndex = stiMedicineProgram
        ? Math.max(
              0,
              ...rules
                  .filter((r) => /STI/i.test(String(r.name || '')))
                  .map((r) => medicineRuleIndexMatch(r.name) || 0),
              ...variables.map((v) => medicineVarNameMatch(v.name || v.displayName) || 0),
              maxSlotIndex([...slotsMap.values()]),
              maxSlotIndex(labelOnlySlots),
              maxSlotIndex(flatSlotsForMax)
          )
        : maxSlotIndex([...slotsMap.values()])
    if (stiMedicineProgram && maxRuleIndex >= 2) {
        for (let i = 1; i <= maxRuleIndex; i += 1) {
            if (slotsMap.has(i)) continue
            const fromFlat = flatSlotsForMax.find((s) => s.index === i)
            if (fromFlat) {
                slotsMap.set(i, { ...fromFlat, allDeIds: [...asIdArray(fromFlat.allDeIds)] })
                continue
            }
            const fromLabel = labelOnlySlots.find((s) => s.index === i)
            if (fromLabel) {
                slotsMap.set(i, { ...fromLabel, allDeIds: [...asIdArray(fromLabel.allDeIds)] })
                continue
            }
            const varMatch = variables.find((v) => medicineVarNameMatch(v.name || v.displayName) === i)
            const nameDeId = idFromRef(varMatch?.dataElement)
            const rule = rules.find(
                (r) =>
                    medicineRuleIndexMatch(r.name) === i && /STI/i.test(String(r.name || ''))
            )
            if (nameDeId) {
                slotsMap.set(i, {
                    index: i,
                    nameDeId,
                    detailDeIds: detailDeIdsFromRule(rule, nameDeId),
                    allDeIds: [],
                })
            }
        }
    }

    let slots = [...slotsMap.values()].sort((a, b) => a.index - b.index)

    if (!slots.length) return []
    return attachDetailIdsFromSection(slots, metadata, programStageId)
}

export function slotHasAnyValue(slot, formValues) {
    if (!slot) return false
    return getMedicineSlotDeIds(slot).some((id) => {
        const v = formValues?.[id]
        return v !== undefined && v !== null && String(v).trim() !== ''
    })
}

const NA_MEDICINE_NAME_RE =
    /^(na|n\/a|none|not applicable|មិន|គ្មាន|other|unknown)$/i

/** Medicine name that is NA/empty — not a user-selected drug (incl. auto-complete placeholders). */
export function isMedicineNamePlaceholderValue(de, value) {
    if (!de || !isMedicineNameDataElement(de)) return false
    if (value == null || String(value).trim() === '') return true
    const code = String(value).trim()
    const opts = de.optionSet?.options || []
    const match = opts.find((o) => String(o.code ?? '').trim() === code)
    const label = String(match?.name || match?.displayName || code).trim()
    return NA_MEDICINE_NAME_RE.test(code) || NA_MEDICINE_NAME_RE.test(label)
}

function medicineValueMatchesOption(value, opt) {
    const v = String(value ?? '').trim()
    if (!v || !opt) return false
    if (opt.code != null && String(opt.code) === v) return true
    if (opt.id != null && String(opt.id) === v) return true
    const label = String(opt.displayName || opt.name || '').trim()
    if (label && label === v) return true
    return false
}

/** Stored value is the first entry in a long medicine / dose option list (often Cefixime). */
export function isFirstDrugListSelection(de, value) {
    const first = de?.optionSet?.options?.[0]
    if (!first) return false
    return medicineValueMatchesOption(value, first)
}

export function medicineNamesReferToSameDrug(valueA, valueB, deA, deB) {
    if (String(valueA ?? '').trim() === String(valueB ?? '').trim()) return true
    const optsA = deA?.optionSet?.options || []
    const optsB = deB?.optionSet?.options || deA?.optionSet?.options || []
    const matchA = optsA.find((o) => medicineValueMatchesOption(valueA, o))
    const matchB = optsB.find((o) => medicineValueMatchesOption(valueB, o))
    if (matchA && matchB) {
        return String(matchA.code ?? matchA.id) === String(matchB.code ?? matchB.id)
    }
    return false
}

/**
 * Row ២–៥ that is not a real user add: first drug in list while row ១ is another drug,
 * NA placeholder, or duplicate autofill from complete/save.
 */
export function isSpuriousSecondaryMedicineRow(slot, slots, formValues, resolveDe) {
    if (!slot || slot.index <= 1 || typeof resolveDe !== 'function') return false
    const slot1 = findMedicineSlotByIndex(slots, 1)
    if (!slot1?.nameDeId) return false
    if (!slotHasMedicineName(slot1, formValues, resolveDe)) return false

    const primaryNameDe = resolveDe(slot1.nameDeId)
    const primaryName = formValues?.[slot1.nameDeId]
    const nameDe = resolveDe(slot.nameDeId)
    const nameVal = formValues?.[slot.nameDeId]
    if (!trackerDataEntryValueIsPresent(nameVal)) return false
    if (isMedicineNamePlaceholderValue(nameDe, nameVal)) return true

    if (
        isFirstDrugListSelection(nameDe, nameVal) &&
        !medicineNamesReferToSameDrug(primaryName, nameVal, primaryNameDe, nameDe)
    ) {
        return true
    }

    if (medicineSlotsHaveIdenticalValues(slot, slot1, formValues)) return true

    return false
}

export function slotHasMedicineName(slot, formValues, resolveDe) {
    if (!slot?.nameDeId) return false
    const v = formValues?.[slot.nameDeId]
    if (v === undefined || v === null || String(v).trim() === '') return false
    if (typeof resolveDe === 'function') {
        const de = resolveDe(slot.nameDeId)
        if (isMedicineNamePlaceholderValue(de, v)) return false
    }
    return true
}

/** Medicine name chosen by the user (not complete/save autofill on rows ២+). */
export function slotHasUserMedicineName(slot, slots, formValues, resolveDe) {
    if (!slotHasMedicineName(slot, formValues, resolveDe)) return false
    if (typeof resolveDe === 'function' && isSpuriousSecondaryMedicineRow(slot, slots, formValues, resolveDe)) {
        return false
    }
    return true
}

export function findMedicineSlotByIndex(slots, slotIndex) {
    const n = Number(slotIndex)
    if (!Number.isFinite(n) || n < 1) return null
    return slots?.find((s) => s.index === n) ?? null
}

/** True when two slots store the same values on every DE (duplicate row after save/complete). */
export function medicineSlotsHaveIdenticalValues(slotA, slotB, formValues) {
    if (!slotA || !slotB) return false
    const idsA = getMedicineSlotDeIds(slotA)
    const idsB = getMedicineSlotDeIds(slotB)
    if (!idsA.length || idsA.length !== idsB.length) return false
    let any = false
    for (let i = 0; i < idsA.length; i += 1) {
        const a = formValues?.[idsA[i]]
        const b = formValues?.[idsB[i]]
        const sa = a == null ? '' : String(a).trim()
        const sb = b == null ? '' : String(b).trim()
        if (sa !== sb) return false
        if (sa !== '') any = true
    }
    return any
}

/** Row has a drug name or non-empty detail (ignores boolean false on hidden fields). */
export function slotHasRemovableMedicineData(slot, formValues) {
    if (!slot) return false
    if (slotHasMedicineName(slot, formValues)) return true
    return getMedicineSlotDeIds(slot).some((id) => {
        if (id === slot.nameDeId) return false
        const v = formValues?.[id]
        if (v === undefined || v === null || String(v).trim() === '') return false
        if (v === false || v === 'false') return false
        return true
    })
}

export function highestMedicineSlotWithData(slots, formValues) {
    let max = 0
    for (const slot of slots || []) {
        if (slotHasRemovableMedicineData(slot, formValues)) {
            max = Math.max(max, slot.index)
        }
    }
    return max
}

/** Only the last filled row can be removed (avoids gaps in ១–៥). */
export function canRemoveMedicineSlot(slots, slotIndex, formValues) {
    const n = Number(slotIndex)
    if (!Number.isFinite(n) || n < 1) return false
    const slot = findMedicineSlotByIndex(slots, n)
    if (!slot || !slotHasRemovableMedicineData(slot, formValues)) return false
    return n === highestMedicineSlotWithData(slots, formValues)
}

/** Merge rule-based slots with label-map pseudo slots (១–៥ prefixes in separate sections). */
export function resolveEffectiveMedicineSlots(slots, metadata, programStageId, deToSlotMap) {
    const capFromSlots = maxSlotIndex(slots)
    const capFromMap = deToSlotMap?.size ? Math.max(...deToSlotMap.values()) : 0
    const absoluteCap = Math.max(capFromSlots, capFromMap, 0)
    if (!absoluteCap) return slots || []
    const pseudo = buildPseudoMedicineSlotsFromDeToSlotMap(metadata, programStageId, deToSlotMap)
    return ensureMedicineSlotsCoverIndices(slots, pseudo, absoluteCap)
}

/**
 * Row counts toward unlock cap: real user drug, same drug on row ២+, or saved row with details.
 * Excludes Cefixime/NA autofill on rows ២+ only.
 */
export function slotQualifiesForMedicineUnlockCap(slot, slots, formValues, resolveDe) {
    if (!slot) return false
    if (slotHasUserMedicineName(slot, slots, formValues, resolveDe)) return true
    if (typeof resolveDe !== 'function') {
        return slotHasRemovableMedicineData(slot, formValues)
    }
    if (slotHasMedicineName(slot, formValues, resolveDe)) {
        return !isSpuriousSecondaryMedicineRow(slot, slots, formValues, resolveDe)
    }
    if (
        slotHasRemovableMedicineData(slot, formValues) &&
        !isSpuriousSecondaryMedicineRow(slot, slots, formValues, resolveDe)
    ) {
        return true
    }
    return false
}

export function highestMedicineSlotQualifyingForCap(slots, formValues, resolveDe) {
    let max = 0
    for (const slot of slots || []) {
        if (slotQualifiesForMedicineUnlockCap(slot, slots, formValues, resolveDe)) {
            max = Math.max(max, slot.index)
        }
    }
    return max
}

/**
 * Section unlock cap: show rows up to the highest slot with a medicine *name* chosen.
 * `manualRows` only opens one extra *empty* row after “Add medicine” — it does not keep
 * row 2+ visible when only row 1 has a drug, and does not count dose defaults without a name.
 */
export function computeMedicineSectionUnlockCap(
    slots,
    formValues,
    manualRows = 1,
    maxCap = 5,
    resolveDe,
    { metadata = null, programStageId = null, deToSlotMap = null } = {}
) {
    const manual = Math.max(1, Number(manualRows) || 1)
    const effectiveSlots =
        metadata && deToSlotMap?.size
            ? resolveEffectiveMedicineSlots(slots, metadata, programStageId, deToSlotMap)
            : slots || []
    const cap =
        maxCap != null && Number(maxCap) > 0
            ? Number(maxCap)
            : Math.max(maxSlotIndex(effectiveSlots), deToSlotMap?.size ? Math.max(...deToSlotMap.values()) : 0, 5)
    if (!effectiveSlots.length) return Math.min(cap, manual)

    const namedMax = highestMedicineSlotQualifyingForCap(effectiveSlots, formValues, resolveDe)
    const fromData = namedMax > 0 ? namedMax : 1
    let visible = fromData
    if (manual > fromData) {
        const extraSlot = findMedicineSlotByIndex(effectiveSlots, manual)
        const openedEmptyRowViaAdd =
            extraSlot &&
            !slotHasMedicineName(extraSlot, formValues) &&
            !slotHasRemovableMedicineData(extraSlot, formValues)
        if (openedEmptyRowViaAdd) visible = manual
    }
    return Math.min(cap, Math.max(1, visible))
}

/**
 * How many medicine rows should be visible (saved data + Core-style cascade when name is set).
 * @param {number|null} capOverride - when set (e.g. max of rule + label detection), clamps cascade to this ceiling
 */
export function desiredUnlockedMedicineSlots(slots, formValues, floor = 1, capOverride = null) {
    if (!slots?.length) return floor
    const cap =
        capOverride != null && Number(capOverride) > 0
            ? Number(capOverride)
            : maxSlotIndex(slots)
    if (!cap) return floor
    let max = Math.max(floor, 1)
    for (const slot of slots) {
        if (slotHasAnyValue(slot, formValues)) {
            max = Math.max(max, slot.index)
        }
        if (slotHasMedicineName(slot, formValues) && slot.index < cap) {
            max = Math.max(max, slot.index + 1)
        }
    }
    return Math.min(max, cap)
}

/** @deprecated use desiredUnlockedMedicineSlots */
export function initialUnlockedMedicineSlots(slots, formValues) {
    return desiredUnlockedMedicineSlots(slots, formValues, 1)
}

/**
 * Slots inferred only from DE→index label map (when rule-based metadata is incomplete).
 */
function buildPseudoMedicineSlotsFromDeToSlotMap(metadata, programStageId, deToSlotMap) {
    if (!deToSlotMap?.size) return []
    const byIdx = new Map()
    for (const [deId, idx] of deToSlotMap) {
        if (!Number.isFinite(Number(idx)) || Number(idx) < 1) continue
        const i = Number(idx)
        if (!byIdx.has(i)) byIdx.set(i, [])
        byIdx.get(i).push(deId)
    }
    const stage = programStageId ? metadata?.stages?.find((s) => s.id === programStageId) : null
    const flatOrder = stage?.dataElements?.map((d) => d.id) || []

    const slots = []
    for (const index of [...byIdx.keys()].sort((a, b) => a - b)) {
        const ids = [...new Set(byIdx.get(index))]
        let nameDeId = ids.find((id) => isMedicineNameDe(resolveDe(metadata, id)))
        if (!nameDeId && flatOrder.length) {
            nameDeId = [...ids].sort((a, b) => {
                const ia = flatOrder.indexOf(a)
                const ib = flatOrder.indexOf(b)
                return (ia === -1 ? 99999 : ia) - (ib === -1 ? 99999 : ib)
            })[0]
        }
        if (!nameDeId) nameDeId = ids[0]
        const detailDeIds = ids.filter((id) => id !== nameDeId)
        slots.push({
            index,
            nameDeId,
            detailDeIds,
            allDeIds: ids,
        })
    }
    return slots
}

function ensureMedicineSlotsCoverIndices(slots, pseudo, absoluteCap) {
    const byIdx = new Map()
    const add = (s) => {
        if (!s || !Number.isFinite(Number(s.index))) return
        const index = Number(s.index)
        const incoming = {
            index,
            nameDeId: s.nameDeId,
            detailDeIds: [...asIdArray(s.detailDeIds)],
            allDeIds: [...getMedicineSlotDeIds(s)],
        }
        if (byIdx.has(index)) {
            mergeMedicineSlot(byIdx.get(index), incoming)
        } else {
            byIdx.set(index, incoming)
        }
    }
    for (const s of slots || []) add(s)
    for (const s of pseudo || []) add(s)
    const out = []
    for (let i = 1; i <= absoluteCap; i++) {
        if (byIdx.has(i)) out.push(byIdx.get(i))
    }
    return out
}

/**
 * Highest medicine slot index the UI should show (Core Tracker Capture–style: row 1 first; row N+1 after row N has medicine name or any value).
 * Use with shouldOmitStageField to hide slots above this cap; program rules still apply within the cap.
 */
export function computeMedicineVisibleSlotCap(metadata, programStageId, slots, deToSlotMap, formValues) {
    if (!programStageId) return 0
    const capFromSlots = slots?.length ? maxSlotIndex(slots) : 0
    const capFromMap = deToSlotMap?.size ? Math.max(...deToSlotMap.values()) : 0
    const absoluteCap = Math.max(capFromSlots, capFromMap, 0)
    if (absoluteCap <= 0) return 0

    const pseudo = buildPseudoMedicineSlotsFromDeToSlotMap(metadata, programStageId, deToSlotMap)
    const merged = ensureMedicineSlotsCoverIndices(slots, pseudo, absoluteCap)
    if (!merged.length) return 0
    return desiredUnlockedMedicineSlots(merged, formValues, 1, absoluteCap)
}

export function canAddAnotherMedicineSlot(slots, unlockedCount, formValues, capOverride) {
    const cap =
        capOverride != null && Number(capOverride) > 0
            ? Number(capOverride)
            : maxSlotIndex(slots)
    if (!cap || unlockedCount >= cap) return false
    if (!slots?.length) {
        return unlockedCount < cap
    }

    const slot1 = slots.find((s) => s.index === 1)
    const row1Touched =
        slot1 &&
        (slotHasMedicineName(slot1, formValues) || slotHasAnyValue(slot1, formValues))

    /** First extra row — always offer when under cap (manual / fallback UX). */
    if (unlockedCount === 1 && cap > 1) {
        return true
    }

    /**
     * After "Add" bumps unlocked to 2+, `current` becomes the newly opened row and is often empty,
     * which wrongly hid the button. Keep showing Add until cap once row 1 has any data.
     */
    if (unlockedCount < cap && row1Touched) {
        return true
    }

    const current = slots.find((s) => s.index === unlockedCount)
    return Boolean(
        current &&
            (slotHasMedicineName(current, formValues) || slotHasAnyValue(current, formValues))
    )
}

export function buildMedicineDeToSlotIndex(slots) {
    const map = new Map()
    for (const slot of slots || []) {
        for (const id of getMedicineSlotDeIds(slot)) {
            map.set(id, slot.index)
        }
    }
    return map
}

/**
 * Map program stage section → medicine slot (1–5) using medicine *name* DE in that section
 * (matches DHIS2 layout: one treatment block per slot). Falls back to min slot among mapped DEs.
 */
/** Slot index from section title (១. …, ២. …, Medicine 2, etc.). */
export function medicineSlotIndexFromSectionTitle(section) {
    if (!section) return null
    const title = String(section.name || section.formName || section.description || '').trim()
    if (!title) return null
    const fakeDe = { displayName: title, name: title }
    return medicineSlotIndexFromDe(fakeDe, { inMedicineSection: true })
}

export function buildMedicineSectionSlotIndex(sections, medicineSlots, deToSlotMap) {
    const map = new Map()
    const nameDeToSlot = new Map()
    for (const s of medicineSlots || []) {
        if (s?.nameDeId) nameDeToSlot.set(s.nameDeId, s.index)
    }
    for (const section of sections || []) {
        const ids = section.dataElementIds || []
        let assigned = false
        for (const deId of ids) {
            if (nameDeToSlot.has(deId)) {
                map.set(section.id, nameDeToSlot.get(deId))
                assigned = true
                break
            }
        }
        if (assigned) continue
        let primary = null
        for (const deId of ids) {
            const slot = deToSlotMap?.get?.(deId)
            if (slot == null) continue
            primary = primary == null ? slot : Math.min(primary, slot)
        }
        if (primary != null) {
            map.set(section.id, primary)
            continue
        }
        const fromTitle = medicineSlotIndexFromSectionTitle(section)
        if (fromTitle != null) map.set(section.id, fromTitle)
    }
    return map
}

/** @deprecated use buildMedicineSectionSlotIndex */
export function buildMedicineSectionPrimarySlotIndex(sections, deToSlotMap) {
    return buildMedicineSectionSlotIndex(sections, [], deToSlotMap)
}

export function findMedicineSlotForDeId(medicineSlots, deId) {
    if (!deId || !medicineSlots?.length) return null
    return (
        medicineSlots.find(
            (s) => s.nameDeId === deId || getMedicineSlotDeIds(s).includes(deId)
        ) || null
    )
}

/**
 * Field row visibility for medicine DEs: cap hides future rows; program rules hide details
 * until the row’s medicine name is chosen, then show dose/form fields (Core Capture).
 */
export function shouldOmitMedicineStageField(
    deId,
    {
        medicineSlots,
        medicineDeToSlot,
        effectiveMedicineSlotCap,
        hiddenFields,
        formValue,
        formValues,
        shouldOmitByRule,
        /** Treatment section gate Yes (drug use): show full medicine row (name + form + dose + …). */
        treatmentGateOpen = true,
    }
) {
    const slotIndex = medicineDeToSlot?.get?.(deId)
    if (slotIndex == null) {
        return shouldOmitByRule(hiddenFields, deId, formValue)
    }
    if (effectiveMedicineSlotCap <= 0 || slotIndex > effectiveMedicineSlotCap) {
        return true
    }
    const slot = findMedicineSlotForDeId(medicineSlots, deId)
    if (slot?.nameDeId === deId) {
        return false
    }
    const fv = formValues || {}
    /** Drug-use Yes: show slot 1 detail fields without waiting for a medicine name; slots 2+ still cascade. */
    if (treatmentGateOpen && slot?.index === 1) {
        return false
    }
    if (slot && slotHasMedicineName(slot, fv)) {
        return false
    }
    return shouldOmitByRule(hiddenFields, deId, formValue)
}

/**
 * Section visibility: non-medicine sections follow program rules; medicine treatment blocks
 * (១–៥, other) only show when their slot index ≤ effectiveMedicineSlotCap (cascade / Add).
 */
export function isStageSectionVisible(
    sectionId,
    hiddenSectionIds,
    sectionSlotIndex,
    effectiveMedicineSlotCap,
    { medicineTreatmentSectionIds } = {}
) {
    const slot = sectionSlotIndex?.get?.(sectionId)
    if (slot != null) {
        return effectiveMedicineSlotCap > 0 && slot <= effectiveMedicineSlotCap
    }
    if (medicineTreatmentSectionIds?.has?.(sectionId)) {
        return false
    }
    return !hiddenSectionIds?.has?.(sectionId)
}

/** Show Add control on the treatment block for the highest unlocked slot only. */
export function isMedicineAddButtonSection(sectionId, sectionSlotIndex, effectiveMedicineSlotCap) {
    const slot = sectionSlotIndex?.get?.(sectionId)
    return (
        slot != null &&
        effectiveMedicineSlotCap > 0 &&
        slot === effectiveMedicineSlotCap &&
        slot >= 1
    )
}

/** @deprecated use isStageSectionVisible */
export function isMedicineSectionUnlockedBySlotCap(
    sectionId,
    hiddenSectionIds,
    sectionPrimarySlot,
    effectiveMedicineSlotCap
) {
    return isStageSectionVisible(
        sectionId,
        hiddenSectionIds,
        sectionPrimarySlot,
        effectiveMedicineSlotCap
    )
}

/** Sections that contain at least one program-defined medicine *name* DE (reliable Add-button placement). */
export function getSectionIdsContainingMedicineSlots(metadata, programStageId, medicineSlots) {
    const ids = new Set()
    if (!programStageId || !metadata?.stages?.length) return ids
    const stage = metadata.stages.find((s) => s.id === programStageId)
    if (!stage?.sections?.length) return ids
    const nameDeSet = new Set(
        (medicineSlots || [])
            .map((s) => s?.nameDeId)
            .filter(Boolean)
    )
    if (!nameDeSet.size) return ids
    for (const sec of stage.sections || []) {
        if ((sec.dataElementIds || []).some((id) => nameDeSet.has(id))) {
            ids.add(sec.id)
        }
    }
    return ids
}
