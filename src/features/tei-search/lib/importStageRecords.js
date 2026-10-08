import i18n from '@dhis2/d2-i18n'
import { findSmhTrackedEntityAttributeId } from '../../../lib/smhIdentifier'
import { createEvent, formatTrackerMutateError } from '../../../services/trackerApi'
import { resolveEnrollment, resolveTeiId } from './importPersonResolve'
import { sanitizeImportRowForApi } from './importOptionValues'

export const importStageRecords = async ({
    engine,
    context,
    rows,
    programAttributes = [],
    programStages = [],
    linkAttributeId,
    onProgress,
}) => {
    const linkAttrId =
        linkAttributeId || findSmhTrackedEntityAttributeId(programAttributes)

    const results = {
        created: 0,
        failed: 0,
        errors: [],
    }

    const teiCache = new Map()
    const enrollmentCache = new Map()
    const total = rows.length

    for (let i = 0; i < rows.length; i++) {
        const row = sanitizeImportRowForApi(rows[i], { programStages })
        try {
            const teiId = await resolveTeiId({
                engine,
                context,
                personRef: row.personRef,
                linkAttributeId: linkAttrId,
                teiCache,
            })
            const enrollmentId = await resolveEnrollment({
                engine,
                context,
                teiId,
                enrollmentCache,
            })

            await createEvent({
                engine,
                enrollmentId,
                orgUnit: context.orgUnit,
                program: context.program,
                stage: row.stageId,
                dataValues: row.dataValues,
                date: row.eventDate,
                status: row.status || 'ACTIVE',
            })
            results.created += 1
        } catch (error) {
            results.failed += 1
            results.errors.push({
                line: row.line,
                message: formatTrackerMutateError(
                    error,
                    error?.message || i18n.t('Visit import failed')
                ),
            })
        }
        onProgress?.(i + 1, total)
    }

    return results
}
