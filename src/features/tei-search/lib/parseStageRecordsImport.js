import i18n from '@dhis2/d2-i18n'
import { parseCsvRows } from '../../admin/lib/parseUsersCsv'
import { findSmhTrackedEntityAttributeId } from '../../../lib/smhIdentifier'
import {
    buildStageImportMaps,
    classifyStageImportHeader,
    normalizeHeader,
    resolveImportStage,
    STAGE_HEADERS,
    DATE_HEADERS,
} from './stageImportMaps'
import { applyStageImportDataValueDefaults } from './stageImportDefaults'
import { applyImportOptionValuesToDataValues } from './importOptionValues'
import { readImportFileText } from './readImportFileText'
import { normalizeImportDate } from './importDateParse'
import {
    DEFAULT_SKIP_ROWS_AFTER_HEADER,
    dataRowLoopStart,
    normalizeSkipRowsAfterHeader,
} from './importRowSkip'

const normalizeStatus = (raw) => {
    const s = String(raw || '')
        .trim()
        .toUpperCase()
    if (s === 'COMPLETED' || s === 'COMPLETE') return 'COMPLETED'
    return 'ACTIVE'
}

const normalizeDate = (raw) => normalizeImportDate(raw)

const parseStageRowObject = (
    item,
    line,
    maps,
    linkAttribute,
    { defaultStageId, programStages = [] } = {}
) => {
    const errors = []
    const { stageNameToId, stageDeHeaderMap } = maps

    const linkValues = linkAttribute
        ? [
              item[linkAttribute.id],
              item[linkAttribute.name],
              item[linkAttribute.displayName],
              item[linkAttribute.shortName],
              item[linkAttribute.code],
          ]
        : []

    const personRef = String(
        item.trackedEntity ||
            item.trackedEntityId ||
            item.trackedEntityInstance ||
            item.person ||
            item.personId ||
            item.smh ||
            linkValues.find((v) => v != null && String(v).trim() !== '') ||
            ''
    ).trim()

    const stageLabel = String(
        item.stage || item.programStage || item.visit || item.programStageId || ''
    ).trim()

    const eventDate = normalizeDate(
        item.eventDate || item.visitDate || item.occurredAt || item.date
    )
    const status = normalizeStatus(item.status || item.eventStatus)

    if (!personRef) {
        errors.push(i18n.t('Row {{line}} — person reference is required.', { line }))
        return { errors, row: null }
    }

    const resolved = resolveImportStage({
        stageLabel,
        defaultStageId,
        programStages,
        stageNameToId,
    })
    if (resolved.missing) {
        errors.push(i18n.t('Row {{line}} — stage is required.', { line }))
        return { errors, row: null }
    }
    if (resolved.unknown) {
        errors.push(
            i18n.t('Row {{line}} — unknown stage "{{stage}}".', {
                line,
                stage: stageLabel || resolved.stageLabel,
            })
        )
        return { errors, row: null }
    }
    if (!eventDate) {
        errors.push(i18n.t('Row {{line}} — event date is required.', { line }))
        return { errors, row: null }
    }

    const deMap = stageDeHeaderMap.get(resolved.stageId) || new Map()
    const dataValues = []
    const dataBlock = item.dataValues && typeof item.dataValues === 'object'

    if (dataBlock) {
        for (const [key, raw] of Object.entries(item.dataValues)) {
            const deId = deMap.get(normalizeHeader(key))
            if (!deId) continue
            const value = raw == null ? '' : String(raw).trim()
            if (value !== '') dataValues.push({ dataElement: deId, value })
        }
    } else {
        for (const [key, raw] of Object.entries(item)) {
            const norm = normalizeHeader(key)
            if (
                ['trackedentity', 'stage', 'eventdate', 'status', 'datavalues'].includes(
                    norm
                ) ||
                norm === linkAttributeKey
            ) {
                continue
            }
            const deId = deMap.get(norm)
            if (!deId) continue
            const value = raw == null ? '' : String(raw).trim()
            if (value !== '') dataValues.push({ dataElement: deId, value })
        }
    }

    const stage = (programStages || []).find((s) => s.id === resolved.stageId)
    const resolvedDataValues = stage
        ? applyImportOptionValuesToDataValues(dataValues, stage)
        : dataValues
    const visitDataValues = stage
        ? applyStageImportDataValueDefaults(resolvedDataValues, stage)
        : resolvedDataValues

    return {
        errors,
        row: {
            line,
            personRef,
            stageId: resolved.stageId,
            stageLabel: resolved.stageLabel,
            eventDate,
            status,
            dataValues: visitDataValues,
        },
    }
}

export const parseStageRecordsCsvText = (
    text,
    {
        programStages = [],
        programAttributes = [],
        linkAttributeId,
        defaultStageId,
        skipRowsAfterHeader = DEFAULT_SKIP_ROWS_AFTER_HEADER,
    } = {}
) => {
    const skipRows = normalizeSkipRowsAfterHeader(skipRowsAfterHeader)
    const sectionScope = { stageId: defaultStageId || null }
    const errors = []
    const warnings = []
    const table = parseCsvRows(text)
    if (!table.length) {
        return { rows: [], errors: [i18n.t('Import file is empty.')], warnings: [] }
    }

    const maps = buildStageImportMaps(programStages, sectionScope)
    const linkAttrId =
        linkAttributeId || findSmhTrackedEntityAttributeId(programAttributes)
    const linkAttr = (programAttributes || []).find((a) => a.id === linkAttrId)
    const linkAttributeKey = linkAttr
        ? normalizeHeader(linkAttr.displayName || linkAttr.name || linkAttr.id)
        : null

    const headerRowIndex = table.findIndex((row) =>
        row.some((cell) => {
            const k = normalizeHeader(cell)
            return STAGE_HEADERS.has(k) || DATE_HEADERS.has(k)
        })
    )

    if (headerRowIndex < 0) {
        return {
            rows: [],
            errors: [
                i18n.t(
                    'No stage columns found. Include stage and eventDate (or visitDate) columns, or download the stage import template.'
                ),
            ],
            warnings: [],
        }
    }

    const headers = table[headerRowIndex]
    const columnKinds = headers.map((h) =>
        classifyStageImportHeader(h, linkAttributeKey)
    )
    const hasStageColumn = columnKinds.some((k) => k.type === 'stage')

    if (!hasStageColumn && !defaultStageId) {
        return {
            rows: [],
            errors: [
                i18n.t(
                    'Select a program stage above, or add a stage column to your file.'
                ),
            ],
            warnings: [],
        }
    }

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
        })

        const resolved = resolveImportStage({
            stageLabel,
            defaultStageId,
            programStages,
            stageNameToId: maps.stageNameToId,
        })
        const stageId = resolved.stageId
        const resolvedStageLabel = resolved.stageLabel
        const deMap = stageId ? maps.stageDeHeaderMap.get(stageId) : null
        const dataValues = []

        headers.forEach((header, colIndex) => {
            const kind = columnKinds[colIndex]
            if (kind.type !== 'de') return
            const value = String(cells[colIndex] || '').trim()
            if (!value) return
            const deId = deMap?.get(kind.key)
            if (deId) dataValues.push({ dataElement: deId, value })
            else unknownHeaders.push(String(header).trim())
        })

        if (!personRef) {
            errors.push(i18n.t('Row {{line}} — person reference is required.', { line }))
            continue
        }
        if (resolved.missing) {
            errors.push(i18n.t('Row {{line}} — stage is required.', { line }))
            continue
        }
        if (resolved.unknown) {
            errors.push(
                i18n.t('Row {{line}} — unknown stage "{{stage}}".', {
                    line,
                    stage: stageLabel || resolvedStageLabel,
                })
            )
            continue
        }
        if (!eventDate) {
            errors.push(i18n.t('Row {{line}} — event date is required.', { line }))
            continue
        }

        if (unknownHeaders.length) {
            warnings.push(
                i18n.t('Row {{line}} — unknown data element column(s) for stage — {{columns}}', {
                    line,
                    columns: [...new Set(unknownHeaders)].join(', '),
                })
            )
        }

        const stage = (programStages || []).find((s) => s.id === stageId)
        const resolvedDataValues = stage
            ? applyImportOptionValuesToDataValues(dataValues, stage)
            : dataValues
        const visitDataValues = stage
            ? applyStageImportDataValueDefaults(resolvedDataValues, stage)
            : dataValues

        rows.push({
            line,
            personRef,
            stageId,
            stageLabel: resolvedStageLabel,
            eventDate,
            status,
            dataValues: visitDataValues,
        })
    }

    return { rows, errors, warnings }
}

export const parseStageRecordsJsonText = (text, options = {}) => {
    const {
        defaultStageId,
        programStages = [],
        skipRowsAfterHeader = DEFAULT_SKIP_ROWS_AFTER_HEADER,
    } = options
    const skipRows = normalizeSkipRowsAfterHeader(skipRowsAfterHeader)
    const errors = []
    const warnings = []
    let data
    try {
        data = JSON.parse(String(text || '').replace(/^\uFEFF/, ''))
    } catch {
        return { rows: [], errors: [i18n.t('Invalid JSON file.')], warnings: [] }
    }

    const list = Array.isArray(data) ? data : data?.events || data?.visits || data?.rows
    if (!Array.isArray(list) || list.length === 0) {
        return { rows: [], errors: [i18n.t('Import file is empty.')], warnings: [] }
    }

    const sectionScope = { stageId: options.defaultStageId || null }
    const maps = buildStageImportMaps(options.programStages || [], sectionScope)
    const linkAttrId =
        options.linkAttributeId ||
        findSmhTrackedEntityAttributeId(options.programAttributes || [])
    const linkAttr = (options.programAttributes || []).find((a) => a.id === linkAttrId)

    const rows = []
    list.slice(skipRows).forEach((item, index) => {
        const line = index + skipRows + 1
        const { errors: rowErrors, row } = parseStageRowObject(
            item,
            line,
            maps,
            linkAttr,
            { defaultStageId, programStages }
        )
        errors.push(...rowErrors)
        if (row) rows.push(row)
    })

    return { rows, errors, warnings }
}

export const parseStageRecordsImportFile = async (file, options = {}) => {
    if (!file) return { rows: [], errors: [], warnings: [] }
    const name = String(file.name || '').toLowerCase()
    const sectionScope = { stageId: options.defaultStageId || null }
    const maps = buildStageImportMaps(options.programStages || [], sectionScope)
    const deHeaderKeys = new Set()
    for (const deMap of maps.stageDeHeaderMap.values()) {
        for (const key of deMap.keys()) deHeaderKeys.add(key)
    }
    const text = await readImportFileText(file, { deHeaderKeys })

    if (name.endsWith('.json')) {
        return parseStageRecordsJsonText(text, options)
    }
    return parseStageRecordsCsvText(text, options)
}

export const detectStageImportFile = async (file) => {
    if (!file) return false
    const name = String(file.name || '').toLowerCase()
    const text = await readImportFileText(file)
    if (name.endsWith('.json')) {
        try {
            const data = JSON.parse(text.replace(/^\uFEFF/, ''))
            const list = Array.isArray(data) ? data : data?.events || data?.visits
            return (
                Array.isArray(list) &&
                list.length > 0 &&
                list.some((r) => r && (r.stage || r.programStage || r.eventDate))
            )
        } catch {
            return false
        }
    }
    const table = parseCsvRows(text)
    const headerRow = table.find((row) =>
        row.some((cell) => {
            const k = normalizeHeader(cell)
            return STAGE_HEADERS.has(k) || DATE_HEADERS.has(k)
        })
    )
    return Boolean(headerRow)
}
