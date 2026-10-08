import i18n from '@dhis2/d2-i18n'
import { formatProfileAttributeImportHeader } from './importProfileAttributes'
import { getStageFormColumnsForImport } from './stageImportSections'
import { downloadImportTemplateCsv } from './downloadImportTemplateCsv'
import { IMPORT_META_HEADERS } from './importMetaColumns'

/**
 * Profile attributes + full visit form (selected columns, section order).
 */
export const downloadCombinedImportTemplate = ({
    programAttributes = [],
    programStages = [],
    stageId,
    attributeIds = null,
    dataElementIds = null,
} = {}) => {
    const attrIdSet = attributeIds ? new Set(attributeIds) : null
    const deIdSet = dataElementIds ? new Set(dataElementIds) : null

    const attrs = (programAttributes || []).filter(
        (a) => a?.id && (!attrIdSet || attrIdSet.has(a.id))
    )
    const stage = stageId
        ? (programStages || []).find((s) => s.id === stageId)
        : (programStages || [])[0]
    if (!attrs.length || !stage) return false

    const attrHeaders = attrs.map((a) => formatProfileAttributeImportHeader(a))

    const deHeaders = getStageFormColumnsForImport(stage)
        .filter((col) => !deIdSet || deIdSet.has(col.de.id))
        .map((col) => col.columnHeader)

    const headers = [
        ...attrHeaders,
        ...(stageId ? [] : [IMPORT_META_HEADERS.stage]),
        IMPORT_META_HEADERS.eventDate,
        IMPORT_META_HEADERS.status,
        ...deHeaders,
    ]

    const stageSlug = (stage.displayName || stage.name || stage.id)
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 40)

    return downloadImportTemplateCsv(
        headers,
        stageId
            ? i18n.t('profile_stage_import_{{stage}}.csv', { stage: stageSlug })
            : i18n.t('profile_and_stage_import_template.csv')
    )
}
