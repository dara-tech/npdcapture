import { mapProgramAttributesFromMetadata } from './importProfileAttributes'

/** Maps for EventHistoryModal (stages, data elements, profile attributes). */
export const buildEventHistoryModalMaps = (metadata) => {
    const attributes = mapProgramAttributesFromMetadata(metadata)
    const deMap = {}
    const deMetaMap = {}
    const stMap = {}

    const registerDeMeta = (core) => {
        if (!core?.id || deMetaMap[core.id]) return
        deMetaMap[core.id] = {
            id: core.id,
            name: core.name,
            displayName: core.displayName || core.name,
            valueType: core.valueType,
            optionSet: core.optionSet,
        }
    }

    metadata?.programStages?.forEach((stage) => {
        stMap[stage.id] = stage.displayName || stage.name
        stage.programStageDataElements?.forEach((psde) => {
            if (psde.dataElement) registerDeMeta(psde.dataElement)
        })
        stage.programStageSections?.forEach((section) => {
            section.dataElements?.forEach((de) => registerDeMeta(de))
        })
    })

    for (const meta of Object.values(deMetaMap)) {
        deMap[meta.id] = meta.displayName || meta.name
    }

    return {
        stagesMap: stMap,
        dataElementsMap: deMap,
        dataElementMetaMap: deMetaMap,
        programAttributes: attributes,
        visibleAttributes: attributes,
    }
}
