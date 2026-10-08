import i18n from '@dhis2/d2-i18n'
import { findSmhTrackedEntityAttributeId } from '../../../lib/smhIdentifier'
import { IMPORT_META_HEADERS } from './importMetaColumns'
import {
    formatProfileAttributeImportHeader,
    isImportRequiredProfileAttribute,
} from './importProfileAttributes'
import { getStageFormColumnsForImport } from './stageImportSections'

const STATUS_OPTIONS = ['ACTIVE', 'COMPLETED']

/**
 * @typedef {{ key: string, header: string, field?: object|null, fieldType: string, options?: string[], stageLabel?: string }} ImportTemplateColumn
 */

/** @returns {ImportTemplateColumn[]} */
export const buildPersonnelImportColumns = ({
    programAttributes = [],
    attributeIds = null,
} = {}) => {
    const idSet = attributeIds ? new Set(attributeIds) : null
    return (programAttributes || [])
        .filter((a) => a?.id && (!idSet || idSet.has(a.id)))
        .map((attr) => ({
            key: `attr:${attr.id}`,
            header: formatProfileAttributeImportHeader(attr, { markRequired: false }),
            field: attr,
            fieldType: 'attribute',
            required: isImportRequiredProfileAttribute(attr),
        }))
}

/** @returns {ImportTemplateColumn[]} */
export const buildStageVisitImportColumns = ({
    programStages = [],
    programAttributes = [],
    stageId,
    dataElementIds = null,
    includePerson = true,
    includeStageName = false,
} = {}) => {
    const stage = stageId
        ? (programStages || []).find((s) => s.id === stageId)
        : (programStages || [])[0]
    if (!stage) return []

    const cols = []

    if (includePerson) {
        const linkAttrId = findSmhTrackedEntityAttributeId(programAttributes)
        const linkAttr = (programAttributes || []).find((a) => a.id === linkAttrId)
        cols.push({
            key: 'person',
            header: linkAttr?.displayName || linkAttr?.name || i18n.t('trackedEntity'),
            field: linkAttr || null,
            fieldType: 'person',
        })
    }

    if (includeStageName) {
        cols.push({
            key: 'stage',
            header: IMPORT_META_HEADERS.stage,
            field: null,
            fieldType: 'stage',
            options: (programStages || []).map((s) => s.displayName || s.name || s.id),
        })
    }

    cols.push({
        key: 'eventDate',
        header: IMPORT_META_HEADERS.eventDate,
        field: { valueType: 'DATE' },
        fieldType: 'eventDate',
    })

    cols.push({
        key: 'status',
        header: IMPORT_META_HEADERS.status,
        field: null,
        fieldType: 'status',
        options: STATUS_OPTIONS,
    })

    const deIdSet = dataElementIds ? new Set(dataElementIds) : null
    for (const col of getStageFormColumnsForImport(stage)) {
        if (deIdSet && !deIdSet.has(col.de.id)) continue
        cols.push({
            key: `de:${col.de.id}`,
            header: col.columnHeader,
            field: col.de,
            fieldType: 'dataElement',
        })
    }

    return cols
}

/** @returns {ImportTemplateColumn[]} */
export const buildCombinedImportColumns = (options = {}) => {
    const profile = buildPersonnelImportColumns({
        programAttributes: options.programAttributes,
        attributeIds: options.attributeIds,
    })
    const visit = buildStageVisitImportColumns({
        ...options,
        includePerson: false,
        includeStageName: !options.stageId,
    })
    return [...profile, ...visit]
}
