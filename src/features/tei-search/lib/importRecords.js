import i18n from '@dhis2/d2-i18n'
import {
    extractTrackerMutationReference,
    formatTrackerMutateError,
    registerTei,
} from '../../../services/trackerApi'
import { sanitizeImportRowForApi } from './importOptionValues'

export const importRecords = async ({
    engine,
    context,
    rows,
    programAttributes = [],
    onProgress,
}) => {
    const results = {
        created: 0,
        failed: 0,
        errors: [],
        teiIds: [],
    }

    const total = rows.length
    for (let i = 0; i < rows.length; i++) {
        const row = sanitizeImportRowForApi(rows[i], { programAttributes })
        try {
            const response = await registerTei({
                engine,
                orgUnit: context.orgUnit,
                program: context.program,
                trackedEntityType: context.trackedEntityType,
                attributes: row.attributes,
            })
            const teiId =
                extractTrackerMutationReference(response, 'TRACKED_ENTITY') ||
                response?.bundleReport?.typeReports?.[0]?.objectReports?.[0]?.uid ||
                response?.response?.importSummaries?.[0]?.reference
            results.created += 1
            if (teiId) results.teiIds.push(teiId)
        } catch (error) {
            results.failed += 1
            results.errors.push({
                line: row.line,
                message: formatTrackerMutateError(
                    error,
                    i18n.t('Registration failed')
                ),
            })
        }
        onProgress?.(i + 1, total)
    }

    return results
}
