import {
    defaultSectionGateValue,
    sectionResolvesHeaderBooleanGate,
} from '../../../lib/stageFieldLayout'
import { getStageSections } from './stageImportSections'

const stageDeById = (stage) => {
    const byId = new Map()
    for (const psde of stage?.programStageDataElements || []) {
        const de = psde?.dataElement
        if (de?.id) byId.set(de.id, de)
    }
    return byId
}

/**
 * Section header gates (Yes/No): default Off when the column is empty in import CSV.
 */
export const applyStageImportDataValueDefaults = (dataValues = [], stage) => {
    if (!stage) return dataValues

    const byId = stageDeById(stage)
    const provided = new Set((dataValues || []).map((dv) => dv.dataElement))
    const out = [...dataValues]

    for (const section of getStageSections(stage)) {
        const gateDeId = section.dataElementIds?.[0]
        if (!gateDeId || provided.has(gateDeId)) continue

        const gateDe = byId.get(gateDeId)
        const sectionMeta = { dataElementIds: section.dataElementIds }
        if (!gateDe || !sectionResolvesHeaderBooleanGate(sectionMeta, gateDe)) continue

        const value = defaultSectionGateValue(gateDe)
        if (value) {
            out.push({ dataElement: gateDeId, value: String(value) })
            provided.add(gateDeId)
        }
    }

    return out
}
