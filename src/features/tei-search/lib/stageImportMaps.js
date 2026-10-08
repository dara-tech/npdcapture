import i18n from '@dhis2/d2-i18n'
import {
    buildSectionedDeHeaderMap,
    getSectionedDeHeaderKeys,
    getStageFormColumnsForImport,
    normalizeImportHeader,
} from './stageImportSections'
import { IMPORT_META_HEADERS } from './importMetaColumns'

const registerLegacyI18nHeader = (set, messageKey) => {
    const translated = i18n.t(messageKey)
    if (!translated || translated === messageKey) return
    const key = normalizeImportHeader(translated)
    if (key) set.add(key)
}

const normalizeHeader = normalizeImportHeader

const isTrackedEntityUid = (value) => /^[a-zA-Z][a-zA-Z0-9]{10}$/.test(String(value || '').trim())

const PERSON_HEADERS = new Set([
    'trackedentity',
    'trackedentityid',
    'trackedentityinstance',
    'tei',
    'person',
    'personnel',
    'personid',
    'smh',
])

const STAGE_HEADERS = new Set([
    normalizeImportHeader(IMPORT_META_HEADERS.stage),
    'stage',
    'programstage',
    'visit',
    'visitstage',
    'programstageid',
])

const DATE_HEADERS = new Set([
    normalizeImportHeader(IMPORT_META_HEADERS.eventDate),
    'eventdate',
    'visitdate',
    'occurredat',
    'date',
    'visit',
])

const STATUS_HEADERS = new Set([
    normalizeImportHeader(IMPORT_META_HEADERS.status),
    'status',
    'eventstatus',
    'visitstatus',
])
registerLegacyI18nHeader(DATE_HEADERS, 'eventDate')
registerLegacyI18nHeader(STATUS_HEADERS, 'status')
registerLegacyI18nHeader(STAGE_HEADERS, 'stage')

export const buildStageDeMap = (stage) => buildSectionedDeHeaderMap(stage)

export const getDeHeaderKeysForStage = (stage) => getSectionedDeHeaderKeys(stage)

/**
 * DE maps per stage — columns follow program stage sections (full form).
 */
export const buildStageImportMaps = (programStages = [], { stageId: scopeStageId } = {}) => {
    const stageNameToId = new Map()
    const stageDeHeaderMap = new Map()

    for (const stage of programStages) {
        const id = stage?.id
        if (!id) continue
        const labels = [stage.id, stage.name, stage.displayName, stage.shortName].filter(Boolean)
        for (const label of labels) {
            const key = normalizeHeader(label)
            if (key && !stageNameToId.has(key)) stageNameToId.set(key, id)
        }

        if (!scopeStageId || scopeStageId === id) {
            stageDeHeaderMap.set(id, buildSectionedDeHeaderMap(stage))
        } else {
            stageDeHeaderMap.set(id, new Map())
        }
    }

    return { stageNameToId, stageDeHeaderMap, isTrackedEntityUid }
}

export const classifyStageImportHeader = (header, linkAttributeKey) => {
    const key = normalizeHeader(header)
    if (!key) return { type: 'skip' }
    if (PERSON_HEADERS.has(key) || key === linkAttributeKey) return { type: 'person' }
    if (STAGE_HEADERS.has(key)) return { type: 'stage' }
    if (DATE_HEADERS.has(key)) return { type: 'date' }
    if (STATUS_HEADERS.has(key)) return { type: 'status' }
    return { type: 'de', key }
}

export const resolveImportStage = ({
    stageLabel = '',
    defaultStageId,
    programStages = [],
    stageNameToId,
}) => {
    const trimmed = String(stageLabel || '').trim()
    if (trimmed) {
        const stageId = stageNameToId.get(normalizeHeader(trimmed))
        const stage = (programStages || []).find((s) => s.id === stageId)
        return {
            stageId: stageId || null,
            stageLabel: stage?.displayName || stage?.name || trimmed,
            missing: !stageId,
            unknown: Boolean(trimmed && !stageId),
        }
    }
    if (defaultStageId) {
        const stage = (programStages || []).find((s) => s.id === defaultStageId)
        return {
            stageId: defaultStageId,
            stageLabel: stage?.displayName || stage?.name || defaultStageId,
            missing: !stage,
            unknown: !stage,
        }
    }
    return { stageId: null, stageLabel: '', missing: true, unknown: false }
}

export {
    normalizeHeader,
    isTrackedEntityUid,
    PERSON_HEADERS,
    STAGE_HEADERS,
    DATE_HEADERS,
    STATUS_HEADERS,
    getStageFormColumnsForImport,
}
