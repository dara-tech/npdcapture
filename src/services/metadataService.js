import { applyPreventionProgramRulesFilter } from '../lib/preventionProgramRulesManifest'
import { extractProgramStageRenderType } from '../lib/stageFieldRender'
import { resolveSectionTitleFromMetadata } from '../lib/stageSectionProgress'

function buildStructureNameMaps(structureProgram) {
    const teaNames = new Map()
    const deNames = new Map()
    const sectionNames = new Map()
    const optionNamesByKey = new Map()
    if (!structureProgram) {
        return { teaNames, deNames, sectionNames, optionNamesByKey }
    }
    for (const entry of structureProgram.programTrackedEntityAttributes || []) {
        const tea = entry.trackedEntityAttribute
        if (tea?.id && tea.name) teaNames.set(tea.id, tea.name)
        for (const opt of entry.trackedEntityAttribute?.optionSet?.options || []) {
            if (tea?.id && opt?.id && opt.name) {
                optionNamesByKey.set(`${tea.id}:${opt.id}`, opt.name)
            }
        }
    }
    for (const stage of structureProgram.programStages || []) {
        for (const sde of stage.programStageDataElements || []) {
            const base = sde.dataElement
            if (base?.id && base.name) deNames.set(base.id, base.name)
            for (const opt of base.optionSet?.options || []) {
                if (base?.id && opt?.id && opt.name) {
                    optionNamesByKey.set(`${base.id}:${opt.id}`, opt.name)
                }
            }
        }
        for (const section of stage.programStageSections || []) {
            if (section?.id && section.name) sectionNames.set(section.id, section.name)
        }
    }
    return { teaNames, deNames, sectionNames, optionNamesByKey }
}

export const normalizeProgramMetadata = (program, structureProgram = null) => {
    if (!program) {
        return null
    }
    const { teaNames, deNames, sectionNames, optionNamesByKey } =
        buildStructureNameMaps(structureProgram)

    const mapOptionSet = (os, fieldId) => {
        if (!os) return null
        const options = (os.options || []).map((o) => {
            const fromStructure =
                fieldId && optionNamesByKey.get(`${fieldId}:${o.id}`)
            const label =
                o.displayName ||
                o.name ||
                fromStructure ||
                o.code ||
                o.id ||
                ''
            return {
                ...o,
                name: label,
                displayName: o.displayName || label,
                systemName: fromStructure || o.name || null,
            }
        })
        /** API often returns `{ id }` with no options — must not force a Select for every field. */
        if (!options.length) return null
        return {
            ...os,
            options,
        }
    }

    const pteaSorted = (program.programTrackedEntityAttributes || [])
        .slice()
        .sort((a, b) => {
            const teaA = a?.trackedEntityAttribute || {}
            const teaB = b?.trackedEntityAttribute || {}
            const nameA = String(teaA.displayName || teaA.name || teaA.shortName || '').toUpperCase()
            const nameB = String(teaB.displayName || teaB.name || teaB.shortName || '').toUpperCase()
            const isPmrsA = nameA.includes('PMRS')
            const isPmrsB = nameB.includes('PMRS')
            if (isPmrsA && !isPmrsB) return -1
            if (!isPmrsA && isPmrsB) return 1

            const sa = Number(a?.sortOrder)
            const sb = Number(b?.sortOrder)
            const na = Number.isFinite(sa) ? sa : 9999
            const nb = Number.isFinite(sb) ? sb : 9999
            if (na !== nb) return na - nb
            const ida = teaA.id ?? ''
            const idb = teaB.id ?? ''
            return String(ida).localeCompare(String(idb))
        })

    const attributes = pteaSorted
        .filter((entry) => {
            const access = entry.trackedEntityAttribute?.access
            // If explicit data write access is false, they cannot save it, so we don't include it
            if (access && access.data && access.data.write === false) return false
            return true
        })
        .map((entry) => ({
            id: entry.trackedEntityAttribute.id,
            name: entry.trackedEntityAttribute.displayName || entry.trackedEntityAttribute.name,
            /** Maintenance `name` — stable for UUIC/SMH heuristics when `translate` localizes `displayName`. */
            systemName:
                teaNames.get(entry.trackedEntityAttribute.id) ||
                entry.trackedEntityAttribute.name ||
                null,
            shortName: entry.trackedEntityAttribute.shortName || null,
            mandatory: entry.mandatory,
            valueType: entry.trackedEntityAttribute.valueType,
            pattern: entry.trackedEntityAttribute.pattern || null,
            optionSet: mapOptionSet(
                entry.trackedEntityAttribute.optionSet,
                entry.trackedEntityAttribute.id
            ),
            attrRenderType: extractProgramStageRenderType(entry.renderType),
            renderOptionsAsRadio: Boolean(entry.renderOptionsAsRadio),
        }))

    /** Registration form sections from Maintenance (Program → Sections). */
    const programSections = (program.programSections || [])
        .slice()
        .sort((a, b) => {
            const sa = Number(a?.sortOrder)
            const sb = Number(b?.sortOrder)
            const na = Number.isFinite(sa) ? sa : 9999
            const nb = Number.isFinite(sb) ? sb : 9999
            if (na !== nb) return na - nb
            return String(a?.id || '').localeCompare(String(b?.id || ''))
        })
        .map((s) => ({
            id: s.id,
            name: s.displayName || s.name || s.formName || '',
            description: s.description || null,
            trackedEntityAttributeIds: (s.trackedEntityAttributes || [])
                .map((t) => t?.id)
                .filter(Boolean),
        }))

    const dataElements = {}
    const sectionIdToProgramStageId = {}
    const stages = (program.programStages || [])
        .slice()
        .sort((a, b) => {
            const sa = Number(a?.sortOrder)
            const sb = Number(b?.sortOrder)
            const na = Number.isFinite(sa) ? sa : 9999
            const nb = Number.isFinite(sb) ? sb : 9999
            if (na !== nb) return na - nb
            return String(a?.id || '').localeCompare(String(b?.id || ''))
        })
        .map((stage) => {
        const registerStageRow = (base, sde = {}) => {
            if (!base?.id) return null
            const label = base.displayName || base.name
            const sortOrder = Number(sde.sortOrder)
            const core = {
                id: base.id,
                name: label,
                displayName: label,
                systemName: deNames.get(base.id) || base.name || null,
                valueType: base.valueType,
                pattern: base.pattern || null,
                compulsory: Boolean(sde.compulsory),
                optionSet: mapOptionSet(base.optionSet, base.id),
                sortOrder: Number.isFinite(sortOrder) ? sortOrder : 9999,
                stageRenderType: extractProgramStageRenderType(sde.renderType),
                renderOptionsAsRadio: Boolean(sde.renderOptionsAsRadio),
            }
            if (!dataElements[core.id]) {
                dataElements[core.id] = {
                    id: core.id,
                    name: core.name,
                    systemName: deNames.get(base.id) || base.name || null,
                    displayName: core.displayName,
                    valueType: core.valueType,
                    pattern: core.pattern,
                    compulsory: core.compulsory,
                    optionSet: mapOptionSet(base.optionSet, base.id),
                }
            }
            return core
        }

        const stageDataElements = (stage.programStageDataElements || [])
            .map((sde) => registerStageRow(sde.dataElement, sde))
            .filter(Boolean)

        const stageDeIds = new Set(stageDataElements.map((row) => row.id))
        for (const section of stage.programStageSections || []) {
            for (const base of section.dataElements || []) {
                if (!base?.id || stageDeIds.has(base.id)) continue
                const row = registerStageRow(base, { sortOrder: 9998, compulsory: false })
                if (row) {
                    stageDataElements.push(row)
                    stageDeIds.add(row.id)
                }
            }
        }

        const sections = (stage.programStageSections || [])
            .slice()
            .sort((a, b) => {
                const sa = Number(a?.sortOrder)
                const sb = Number(b?.sortOrder)
                const na = Number.isFinite(sa) ? sa : 9999
                const nb = Number.isFinite(sb) ? sb : 9999
                if (na !== nb) return na - nb
                return String(a?.id || '').localeCompare(String(b?.id || ''))
            })
            .map((section) => {
            sectionIdToProgramStageId[section.id] = stage.id
            return {
                id: section.id,
                name: resolveSectionTitleFromMetadata(section, sectionNames),
                systemName:
                    sectionNames.get(section.id) || section.name || section.formName || null,
                description: section.description || null,
                formName: section.formName || null,
                sortOrder: Number.isFinite(Number(section.sortOrder)) ? Number(section.sortOrder) : 9999,
                dataElementIds: (section.dataElements || []).map((de) => de.id),
            }
        })

        const orderedStageRows = [...stageDataElements].sort((a, b) => {
            if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
            return String(a.id).localeCompare(String(b.id))
        })

        return {
            id: stage.id,
            name: stage.displayName || stage.name,
            dataElements: orderedStageRows,
            sections,
        }
    })

    const rawRules = program.programRules || []
    const rawRuleVariables = program.programRuleVariables || []
    const usePreventionRuleFilter =
        typeof import.meta !== 'undefined' &&
        import.meta.env?.VITE_PREVENTION_FILTER_RULES === 'true'
    const filteredBundle = usePreventionRuleFilter
        ? applyPreventionProgramRulesFilter(program.id, {
              rules: rawRules,
              ruleVariables: rawRuleVariables,
          })
        : {
              rules: rawRules,
              ruleVariables: rawRuleVariables,
              filtered: false,
              droppedRules: 0,
              droppedVariables: 0,
          }
    const {
        rules,
        ruleVariables,
        filtered: preventionRulesFiltered,
        droppedRules,
        droppedVariables,
    } = filteredBundle

    return {
        id: program.id,
        name: program.displayName || program.name,
        trackedEntityType: program.trackedEntityType?.id,
        attributes,
        programSections,
        dataElements,
        stages,
        sectionIdToProgramStageId,
        rules,
        ruleVariables,
        preventionRulesFiltered: preventionRulesFiltered || undefined,
        preventionRulesDropped:
            preventionRulesFiltered && (droppedRules > 0 || droppedVariables > 0)
                ? { rules: droppedRules, variables: droppedVariables }
                : undefined,
    }
}
