import i18n from '@dhis2/d2-i18n'
import { findSmhTrackedEntityAttributeId } from '../../../lib/smhIdentifier'
import {
    createEvent,
    extractTrackerMutationReference,
    formatTrackerMutateError,
    registerTei,
} from '../../../services/trackerApi'
import {
    isDuplicateTeiRegistrationError,
    linkValueFromAttributes,
    resolveEnrollment,
    resolveTeiIdFromImportAttributes,
} from './importPersonResolve'
import { sanitizeImportRowForApi } from './importOptionValues'

const createVisitForRow = async ({
    engine,
    context,
    row,
    teiId,
    enrollmentCache,
}) => {
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
        dataValues: row.dataValues || [],
        date: row.eventDate,
        status: row.status || 'ACTIVE',
    })
}

export const importProfileWithStageRecords = async ({
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
        personnelCreated: 0,
        visitsCreated: 0,
        skippedExisting: 0,
        errors: [],
        warnings: [],
    }

    const teiCache = new Map()
    const enrollmentCache = new Map()
    const total = rows.length

    for (let i = 0; i < rows.length; i++) {
        const row = sanitizeImportRowForApi(rows[i], {
            programAttributes,
            programStages,
        })
        const linkFromAttrs = linkValueFromAttributes(row.attributes, linkAttrId)
        try {
            const lookupRef = row.personRef || linkFromAttrs

            let teiId = await resolveTeiIdFromImportAttributes({
                engine,
                context,
                attributes: row.attributes,
                programAttributes,
                personRef: lookupRef,
                linkAttributeId: linkAttrId,
                teiCache,
            })

            const existingPerson = Boolean(teiId)
            let registeredNew = false

            if (!teiId && row.hasProfile && row.attributes?.length) {
                try {
                    const response = await registerTei({
                        engine,
                        orgUnit: context.orgUnit,
                        program: context.program,
                        trackedEntityType: context.trackedEntityType,
                        attributes: row.attributes,
                    })
                    teiId =
                        extractTrackerMutationReference(response, 'TRACKED_ENTITY') ||
                        response?.bundleReport?.typeReports?.[0]?.objectReports?.[0]
                            ?.uid ||
                        response?.response?.importSummaries?.[0]?.reference
                    if (teiId) {
                        registeredNew = true
                        results.personnelCreated += 1
                        if (linkFromAttrs) {
                            teiCache.set(
                                `${linkAttrId || 'query'}:${linkFromAttrs.toLowerCase()}`,
                                teiId
                            )
                        }
                    }
                } catch (regError) {
                    if (isDuplicateTeiRegistrationError(regError)) {
                        teiId = await resolveTeiIdFromImportAttributes({
                            engine,
                            context,
                            attributes: row.attributes,
                            programAttributes,
                            personRef: lookupRef,
                            linkAttributeId: linkAttrId,
                            teiCache,
                        })
                        if (!teiId) throw regError
                    } else {
                        throw regError
                    }
                }
            }

            if (!teiId) {
                throw new Error(
                    i18n.t(
                        'Could not register or find a person for this row. Add profile fields or an existing SMH / tracked entity ID.'
                    )
                )
            }

            if (existingPerson && !registeredNew && row.hasProfile) {
                results.skippedExisting += 1
                if (row.hasVisit) {
                    results.warnings.push(
                        i18n.t(
                            'Row {{line}} — person already exists — registered a new visit only.',
                            { line: row.line }
                        )
                    )
                }
            }

            if (row.hasVisit && row.stageId && row.eventDate) {
                await createVisitForRow({
                    engine,
                    context,
                    row,
                    teiId,
                    enrollmentCache,
                })
                results.visitsCreated += 1
            } else if (existingPerson && !registeredNew && row.hasProfile && !row.hasVisit) {
                results.warnings.push(
                    i18n.t(
                        'Row {{line}} — person already exists — no visit data in this row.',
                        { line: row.line }
                    )
                )
            }

            results.created += 1
        } catch (error) {
            if (row.hasVisit && isDuplicateTeiRegistrationError(error)) {
                try {
                    const teiId = await resolveTeiIdFromImportAttributes({
                        engine,
                        context,
                        attributes: row.attributes,
                        programAttributes,
                        personRef: row.personRef || linkValueFromAttributes(row.attributes, linkAttrId),
                        linkAttributeId: linkAttrId,
                        teiCache,
                    })
                    if (teiId) {
                        await createVisitForRow({
                            engine,
                            context,
                            row,
                            teiId,
                            enrollmentCache,
                        })
                        results.visitsCreated += 1
                        results.created += 1
                        results.skippedExisting += 1
                        results.warnings.push(
                            i18n.t(
                                'Row {{line}} — profile already exists — visit was created.',
                                { line: row.line }
                            )
                        )
                        onProgress?.(i + 1, total)
                        continue
                    }
                } catch (visitError) {
                    results.failed += 1
                    results.errors.push({
                        line: row.line,
                        message: formatTrackerMutateError(
                            visitError,
                            visitError?.message || i18n.t('Visit import failed')
                        ),
                    })
                    onProgress?.(i + 1, total)
                    continue
                }
            }

            results.failed += 1
            results.errors.push({
                line: row.line,
                message: formatTrackerMutateError(
                    error,
                    error?.message || i18n.t('Import failed')
                ),
            })
        }
        onProgress?.(i + 1, total)
    }

    return results
}
