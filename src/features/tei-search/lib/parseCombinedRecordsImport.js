import i18n from '@dhis2/d2-i18n'
import { parseCsvRows } from '../../admin/lib/parseUsersCsv'
import { findSmhTrackedEntityAttributeId } from '../../../lib/smhIdentifier'
import {
    buildStageImportMaps,
    getDeHeaderKeysForStage,
    normalizeHeader,
    resolveImportStage,
    PERSON_HEADERS,
    STAGE_HEADERS,
    DATE_HEADERS,
    STATUS_HEADERS,
} from './stageImportMaps'
import {
    applyProfileImportAttributeDefaults,
    formatProfileAttributeImportHeader,
    validateRequiredProfileAttributes,
} from './importProfileAttributes'
import { applyStageImportDataValueDefaults } from './stageImportDefaults'
import { readImportFileText } from './readImportFileText'
import { applyUuicToAttributeMap } from './applyImportUuic'
import {
    applyImportOptionValuesToAttrMap,
    applyImportOptionValuesToDataValues,
} from './importOptionValues'
import { normalizeImportDate } from './importDateParse'
import { buildCombinedImportColumns } from './importTemplateColumns'
import { TEMPLATE_DATA_FIRST_ROW } from './importTemplateExcel'
import {
    DEFAULT_SKIP_ROWS_AFTER_HEADER,
    dataRowLoopStart,
    normalizeSkipRowsAfterHeader,
} from './importRowSkip'

const sectionScopeFromOptions = (options = {}) => ({
    stageId: options.defaultStageId || null,
})

const SKIP_ATTR_HEADERS = new Set([
    'id',
    'trackedentity',
    'trackedentityid',
    'trackedentityinstance',
    'enrollment',
    'enrollmentid',
])

const buildAttributeHeaderMap = (programAttributes = []) => {
    const map = new Map()
    for (const attr of programAttributes) {
        const id = attr?.id
        if (!id) continue
        const labels = [
            attr.id,
            attr.name,
            attr.displayName,
            attr.code,
            attr.shortName,
            formatProfileAttributeImportHeader(attr, { markRequired: false }),
            formatProfileAttributeImportHeader(attr, { markRequired: true }),
        ].filter(Boolean)
        for (const label of labels) {
            const key = normalizeHeader(label)
            if (key && !map.has(key)) map.set(key, id)
        }
    }
    return map
}

const buildAllDeKeys = (programStages = [], sectionScope = {}) => {
    if (sectionScope?.stageId) {
        const stage = (programStages || []).find((s) => s.id === sectionScope.stageId)
        return getDeHeaderKeysForStage(stage)
    }
    const keys = new Set()
    const maps = buildStageImportMaps(programStages)
    for (const deMap of maps.stageDeHeaderMap.values()) {
        for (const key of deMap.keys()) keys.add(key)
    }
    return keys
}

const classifyCombinedHeader = (header, attrHeaderMap, allDeKeys) => {
    const key = normalizeHeader(header)
    if (!key) return { type: 'skip' }
    if (PERSON_HEADERS.has(key)) return { type: 'person' }
    if (STAGE_HEADERS.has(key)) return { type: 'stage' }
    if (DATE_HEADERS.has(key)) return { type: 'date' }
    if (STATUS_HEADERS.has(key)) return { type: 'status' }
    if (attrHeaderMap.has(key) && !SKIP_ATTR_HEADERS.has(key)) {
        return { type: 'attribute', attrId: attrHeaderMap.get(key) }
    }
    if (allDeKeys.has(key)) return { type: 'de', key }
    return { type: 'unknown' }
}

const normalizeStatus = (raw) => {
    const s = String(raw || '')
        .trim()
        .toUpperCase()
    if (s === 'COMPLETED' || s === 'COMPLETE') return 'COMPLETED'
    return 'ACTIVE'
}

const normalizeDate = (raw) => normalizeImportDate(raw)

const rowHasVisitData = ({ stageLabel, eventDate, dataValues }) =>
    Boolean(
        String(stageLabel || '').trim() ||
            String(eventDate || '').trim() ||
            (dataValues?.length > 0)
    )

const mergeTemplateColumnHeaderKeys = (
    attrHeaderKeys,
    deHeaderKeys,
    { programAttributes, programStages, defaultStageId, attributeIds, dataElementIds }
) => {
    const columns = buildCombinedImportColumns({
        programAttributes,
        programStages,
        stageId: defaultStageId,
        attributeIds,
        dataElementIds,
    })
    for (const col of columns) {
        const key = normalizeHeader(col.header)
        if (!key) continue
        if (col.fieldType === 'attribute') attrHeaderKeys.add(key)
        if (col.fieldType === 'dataElement') deHeaderKeys.add(key)
    }
}

const buildParseContextKeys = (
    programAttributes,
    programStages,
    defaultStageId,
    templateColumnIds = {}
) => {
    const attrHeaderMap = buildAttributeHeaderMap(programAttributes)
    const attrHeaderKeys = new Set(attrHeaderMap.keys())
    const sectionScope = { stageId: defaultStageId || null }
    const deKeys = buildAllDeKeys(programStages, sectionScope)
    const deHeaderKeys = new Set(deKeys)
    mergeTemplateColumnHeaderKeys(attrHeaderKeys, deHeaderKeys, {
        programAttributes,
        programStages,
        defaultStageId,
        attributeIds: templateColumnIds.attributeIds,
        dataElementIds: templateColumnIds.dataElementIds,
    })
    return { attrHeaderKeys, deHeaderKeys }
}

export const detectCombinedImportFile = async (file, programAttributes = []) => {
    if (!file) return false
    const attrMap = buildAttributeHeaderMap(programAttributes)
    if (!attrMap.size) return false

    const name = String(file.name || '').toLowerCase()
    const headerKeys = buildParseContextKeys(programAttributes, [], null)
    const text = await readImportFileText(file, headerKeys)

    if (name.endsWith('.json')) {
        try {
            const data = JSON.parse(text.replace(/^\uFEFF/, ''))
            const list = Array.isArray(data) ? data : data?.records || data?.rows
            if (!Array.isArray(list) || !list.length) return false
            const hasStage = list.some(
                (r) => r && (r.stage || r.programStage || r.eventDate || r.visitDate)
            )
            const hasAttr = list.some((r) => {
                if (!r || typeof r !== 'object') return false
                return Object.keys(r).some((k) => attrMap.has(normalizeHeader(k)))
            })
            return hasStage && hasAttr
        } catch {
            return false
        }
    }

    const table = parseCsvRows(text)
    const headerRow = table.find((row) => {
        let hasVisitMeta = false
        let hasAttr = false
        for (const cell of row) {
            const k = normalizeHeader(cell)
            if (STAGE_HEADERS.has(k) || DATE_HEADERS.has(k)) hasVisitMeta = true
            if (attrMap.has(k)) hasAttr = true
        }
        return hasVisitMeta && hasAttr
    })
    return Boolean(headerRow)
}

export const parseCombinedRecordsCsvText = (
    text,
    {
        programStages = [],
        programAttributes = [],
        defaultStageId,
        skipRowsAfterHeader = DEFAULT_SKIP_ROWS_AFTER_HEADER,
    } = {}
) => {
    const skipRows = normalizeSkipRowsAfterHeader(skipRowsAfterHeader)
    const sectionScope = sectionScopeFromOptions({ defaultStageId })
    const errors = []
    const warnings = []
    const table = parseCsvRows(text)
    if (!table.length) {
        return { rows: [], errors: [i18n.t('Import file is empty.')], warnings: [] }
    }

    const attrHeaderMap = buildAttributeHeaderMap(programAttributes)
    const allDeKeys = buildAllDeKeys(programStages, sectionScope)
    const stageMaps = buildStageImportMaps(programStages, sectionScope)

    const headerRowIndex = table.findIndex((row) =>
        row.some((cell) => {
            const k = normalizeHeader(cell)
            return attrHeaderMap.has(k) || STAGE_HEADERS.has(k) || DATE_HEADERS.has(k)
        })
    )

    if (headerRowIndex < 0) {
        return {
            rows: [],
            errors: [
                i18n.t(
                    'No profile or stage columns found. Download the profile + stage template.'
                ),
            ],
            warnings: [],
        }
    }

    const headers = table[headerRowIndex]
    const columnKinds = headers.map((h) =>
        classifyCombinedHeader(h, attrHeaderMap, allDeKeys)
    )
    const hasStageColumn = columnKinds.some((k) => k.type === 'stage')
    const hasVisitMetaInHeader = columnKinds.some(
        (k) => k.type === 'date' || k.type === 'de' || k.type === 'status'
    )
    const hasVisitColumns = hasVisitMetaInHeader

    const rows = []
    const dataStart = dataRowLoopStart(headerRowIndex, skipRows)

    for (let i = dataStart; i < table.length; i++) {
        const cells = table[i]
        if (!cells.some((c) => String(c || '').trim() !== '')) continue
        const line = i + 1

        let personRef = ''
        let stageLabel = ''
        let eventDate = ''
        let status = 'ACTIVE'
        const attrMap = new Map()
        const unknownHeaders = []

        headers.forEach((header, colIndex) => {
            const kind = columnKinds[colIndex]
            const raw = cells[colIndex]
            const value = raw == null ? '' : String(raw).trim()
            if (!value) return

            if (kind.type === 'person') personRef = value
            else if (kind.type === 'stage') stageLabel = value
            else if (kind.type === 'date') eventDate = normalizeDate(value)
            else if (kind.type === 'status') status = normalizeStatus(value)
            else if (kind.type === 'attribute') attrMap.set(kind.attrId, value)
            else if (kind.type === 'unknown') unknownHeaders.push(String(header).trim())
        })

        const resolved = resolveImportStage({
            stageLabel,
            defaultStageId,
            programStages,
            stageNameToId: stageMaps.stageNameToId,
        })
        const stageId = resolved.stageId
        const resolvedStageLabel = resolved.stageLabel
        const stage = stageId
            ? (programStages || []).find((s) => s.id === stageId)
            : null
        const deMap = stageId ? stageMaps.stageDeHeaderMap.get(stageId) : null
        const dataValues = []

        headers.forEach((header, colIndex) => {
            const kind = columnKinds[colIndex]
            if (kind.type !== 'de') return
            const value = String(cells[colIndex] || '').trim()
            if (!value) return
            const deId = deMap?.get(kind.key)
            if (deId) dataValues.push({ dataElement: deId, value })
            else if (stageId) unknownHeaders.push(String(header).trim())
        })

        applyProfileImportAttributeDefaults(attrMap, programAttributes)
        applyImportOptionValuesToAttrMap(attrMap, programAttributes)
        applyUuicToAttributeMap(attrMap, programAttributes)
        const attributes = [...attrMap.entries()].map(([attribute, value]) => ({
            attribute,
            value,
        }))

        const visitDataValuesResolved = stage
            ? applyImportOptionValuesToDataValues(dataValues, stage)
            : dataValues

        const hasVisit = Boolean(
            hasVisitMetaInHeader &&
                rowHasVisitData({ stageLabel, eventDate, dataValues: visitDataValuesResolved })
        )
        const hasProfile = attributes.length > 0

        if (!hasProfile && !personRef) {
            errors.push(
                i18n.t('Row {{line}} — profile fields or person reference required.', { line })
            )
            continue
        }

        if (hasVisit) {
            if (resolved.missing && !defaultStageId && !hasStageColumn) {
                errors.push(i18n.t('Row {{line}} — stage is required.', { line }))
                continue
            }
            if (resolved.unknown) {
                errors.push(
                    i18n.t('Row {{line}} — unknown stage "{{stage}}".', {
                        line,
                        stage: stageLabel || resolvedStageLabel || '—',
                    })
                )
                continue
            }
            if (!eventDate) {
                errors.push(i18n.t('Row {{line}} — event date is required.', { line }))
                continue
            }
        }

        if (hasProfile && !personRef) {
            const mandatoryErr = validateRequiredProfileAttributes(
                attributes,
                programAttributes,
                line
            )
            if (mandatoryErr) {
                errors.push(mandatoryErr)
                continue
            }
        }

        if (unknownHeaders.length) {
            warnings.push(
                i18n.t('Row {{line}} — unknown column(s) — {{columns}}', {
                    line,
                    columns: [...new Set(unknownHeaders)].join(', '),
                })
            )
        }

        const visitDataValues =
            hasVisit && stage
                ? applyStageImportDataValueDefaults(visitDataValuesResolved, stage)
                : visitDataValuesResolved

        rows.push({
            line,
            personRef,
            attributes,
            stageId: hasVisit ? stageId : null,
            stageLabel: hasVisit ? resolvedStageLabel : '',
            eventDate: eventDate || '',
            status,
            dataValues: visitDataValues,
            hasVisit,
            hasProfile,
        })
    }

    if (!rows.length && !errors.length) {
        errors.push(
            i18n.t(
                'No data rows found. Add rows below the example (row {{row}}), include eventDate, and save the file.',
                { row: TEMPLATE_DATA_FIRST_ROW }
            )
        )
    }

    return { rows, errors, warnings }
}

export const parseCombinedRecordsJsonText = (
    text,
    {
        programStages = [],
        programAttributes = [],
        defaultStageId,
        skipRowsAfterHeader = DEFAULT_SKIP_ROWS_AFTER_HEADER,
    } = {}
) => {
    const skipRows = normalizeSkipRowsAfterHeader(skipRowsAfterHeader)
    const sectionScope = sectionScopeFromOptions({ defaultStageId })
    const errors = []
    const warnings = []
    let data
    try {
        data = JSON.parse(String(text || '').replace(/^\uFEFF/, ''))
    } catch {
        return { rows: [], errors: [i18n.t('Invalid JSON file.')], warnings: [] }
    }

    const list = Array.isArray(data) ? data : data?.records || data?.rows
    if (!Array.isArray(list) || !list.length) {
        return { rows: [], errors: [i18n.t('Import file is empty.')], warnings: [] }
    }

    const attrHeaderMap = buildAttributeHeaderMap(programAttributes)
    const stageMaps = buildStageImportMaps(programStages, sectionScope)
    const rows = []

    list.slice(skipRows).forEach((item, index) => {
        const line = index + skipRows + 1
        if (!item || typeof item !== 'object') {
            errors.push(i18n.t('Row {{line}} — invalid record.', { line }))
            return
        }

        const personRef = String(
            item.trackedEntity ||
                item.trackedEntityId ||
                item.person ||
                item.personId ||
                ''
        ).trim()

        const stageLabel = String(
            item.stage || item.programStage || item.visit || ''
        ).trim()
        const eventDate = normalizeDate(
            item.eventDate || item.visitDate || item.occurredAt || item.date
        )
        const status = normalizeStatus(item.status || item.eventStatus)

        const attrMap = new Map()
        const profileBlock =
            item.profile && typeof item.profile === 'object' ? item.profile : null

        if (profileBlock) {
            for (const [key, raw] of Object.entries(profileBlock)) {
                const attrId = attrHeaderMap.get(normalizeHeader(key))
                if (!attrId) continue
                const value = raw == null ? '' : String(raw).trim()
                if (value !== '') attrMap.set(attrId, value)
            }
        } else {
            for (const [key, raw] of Object.entries(item)) {
                const norm = normalizeHeader(key)
                if (
                    SKIP_ATTR_HEADERS.has(norm) ||
                    STAGE_HEADERS.has(norm) ||
                    DATE_HEADERS.has(norm) ||
                    STATUS_HEADERS.has(norm) ||
                    norm === 'datavalues' ||
                    norm === 'profile'
                ) {
                    continue
                }
                const attrId = attrHeaderMap.get(norm)
                if (!attrId) continue
                const value = raw == null ? '' : String(raw).trim()
                if (value !== '') attrMap.set(attrId, value)
            }
        }

        applyProfileImportAttributeDefaults(attrMap, programAttributes)
        applyImportOptionValuesToAttrMap(attrMap, programAttributes)
        applyUuicToAttributeMap(attrMap, programAttributes)
        const attributes = [...attrMap.entries()].map(([attribute, value]) => ({
            attribute,
            value,
        }))

        const resolved = resolveImportStage({
            stageLabel,
            defaultStageId,
            programStages,
            stageNameToId: stageMaps.stageNameToId,
        })
        const stageId = resolved.stageId
        const resolvedStageLabel = resolved.stageLabel
        const stage = stageId
            ? (programStages || []).find((s) => s.id === stageId)
            : null
        const deMap = stageId ? stageMaps.stageDeHeaderMap.get(stageId) : null
        const dataValues = []

        const dvBlock = item.dataValues
        if (dvBlock && typeof dvBlock === 'object') {
            for (const [key, raw] of Object.entries(dvBlock)) {
                const deId = deMap?.get(normalizeHeader(key))
                if (!deId) continue
                const value = raw == null ? '' : String(raw).trim()
                if (value !== '') dataValues.push({ dataElement: deId, value })
            }
        }

        const visitDataValuesResolved = stage
            ? applyImportOptionValuesToDataValues(dataValues, stage)
            : dataValues

        const hasVisit = rowHasVisitData({
            stageLabel,
            eventDate,
            dataValues: visitDataValuesResolved,
        })
        const hasProfile = attributes.length > 0

        if (!hasProfile && !personRef) {
            errors.push(
                i18n.t('Row {{line}} — profile fields or person reference required.', { line })
            )
            return
        }
        if (hasVisit) {
            if (resolved.missing && !defaultStageId) {
                errors.push(i18n.t('Row {{line}} — stage is required.', { line }))
                return
            }
            if (resolved.unknown) {
                errors.push(
                    i18n.t('Row {{line}} — unknown stage "{{stage}}".', {
                        line,
                        stage: stageLabel || resolvedStageLabel || '—',
                    })
                )
                return
            }
            if (!eventDate) {
                errors.push(i18n.t('Row {{line}} — event date is required.', { line }))
                return
            }
        }

        if (hasProfile && !personRef) {
            const mandatoryErr = validateRequiredProfileAttributes(
                attributes,
                programAttributes,
                line
            )
            if (mandatoryErr) {
                errors.push(mandatoryErr)
                return
            }
        }

        const visitDataValues =
            hasVisit && stage
                ? applyStageImportDataValueDefaults(visitDataValuesResolved, stage)
                : visitDataValuesResolved

        rows.push({
            line,
            personRef,
            attributes,
            stageId: hasVisit ? stageId : null,
            stageLabel: hasVisit ? resolvedStageLabel : '',
            eventDate: eventDate || '',
            status,
            dataValues: visitDataValues,
            hasVisit,
            hasProfile,
        })
    })

    return { rows, errors, warnings }
}

export const parseCombinedRecordsImportFile = async (file, options = {}) => {
    if (!file) return { rows: [], errors: [], warnings: [] }
    const name = String(file.name || '').toLowerCase()
    const headerKeys = buildParseContextKeys(
        options.programAttributes,
        options.programStages,
        options.defaultStageId,
        {
            attributeIds: options.attributeIds,
            dataElementIds: options.dataElementIds,
        }
    )
    const text = await readImportFileText(file, headerKeys)
    if (name.endsWith('.json')) {
        return parseCombinedRecordsJsonText(text, options)
    }
    return parseCombinedRecordsCsvText(text, options)
}
