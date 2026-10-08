import i18n from '@dhis2/d2-i18n'
import { findSmhTrackedEntityAttributeId } from '../../../lib/smhIdentifier'
import { getStageFormColumnsForImport } from './stageImportSections'
import { downloadImportTemplateCsv } from './downloadImportTemplateCsv'
import { IMPORT_META_HEADERS } from './importMetaColumns'

/** Visit import template — selected sections/fields for the stage (form order). */
export const downloadStageImportTemplate = ({
    programStages = [],
    programAttributes = [],
    stageId,
    dataElementIds = null,
} = {}) => {
    const stage = stageId
        ? (programStages || []).filter((s) => s.id === stageId)
        : programStages || []

    if (!stage.length) return false

    const st = stage[0]
    const deIdSet = dataElementIds ? new Set(dataElementIds) : null
    const deHeaders = getStageFormColumnsForImport(st)
        .filter((col) => !deIdSet || deIdSet.has(col.de.id))
        .map((col) => col.columnHeader)

    const linkAttrId = findSmhTrackedEntityAttributeId(programAttributes)
    const linkAttr = (programAttributes || []).find((a) => a.id === linkAttrId)
    const personCol =
        linkAttr?.displayName || linkAttr?.name || i18n.t('trackedEntity')

    const headers = [
        personCol,
        ...(stageId ? [] : [IMPORT_META_HEADERS.stage]),
        IMPORT_META_HEADERS.eventDate,
        IMPORT_META_HEADERS.status,
        ...deHeaders,
    ]

    const stageName = (st.displayName || st.name || st.id)
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 40)

    return downloadImportTemplateCsv(
        headers,
        i18n.t('stage_import_{{stage}}.csv', { stage: stageName })
    )
}
