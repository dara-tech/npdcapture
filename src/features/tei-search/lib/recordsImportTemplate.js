import i18n from '@dhis2/d2-i18n'
import { formatProfileAttributeImportHeader } from './importProfileAttributes'
import { downloadImportTemplateCsv } from './downloadImportTemplateCsv'

export const downloadRecordsImportTemplate = ({
    programAttributes = [],
    attributeIds = null,
} = {}) => {
    const idSet = attributeIds ? new Set(attributeIds) : null
    const attrs = (programAttributes || []).filter(
        (a) => a?.id && (!idSet || idSet.has(a.id))
    )
    if (!attrs.length) return false

    const headers = attrs.map((a) => formatProfileAttributeImportHeader(a))
    return downloadImportTemplateCsv(headers, i18n.t('personnel_import_template.csv'))
}
