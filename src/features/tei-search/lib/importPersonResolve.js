import i18n from '@dhis2/d2-i18n'
import { resolveUuicSourceAttributeIds } from '../../../lib/uuic'
import { findSmhTrackedEntityAttributeId } from '../../../lib/smhIdentifier'
import {
    createEnrollment,
    extractTrackerMutationReference,
    fetchTei,
    formatTrackerMutateError,
    searchTrackedEntities,
} from '../../../services/trackerApi'
import { isTrackedEntityUid } from './stageImportMaps'

const searchTeiByAttributeValue = async ({
    engine,
    context,
    attributeId,
    value,
    teiCache,
    cacheKey,
}) => {
    const trimmed = String(value || '').trim()
    if (!trimmed || !attributeId) return null

    if (cacheKey && teiCache?.has(cacheKey)) {
        return teiCache.get(cacheKey)
    }

    const { instances } = await searchTrackedEntities({
        engine,
        orgUnit: context.orgUnit,
        program: context.program,
        filters: [{ attributeId, operator: 'eq', value: trimmed }],
        paging: false,
        pageSize: 5,
    })

    if (!instances.length) return null
    if (instances.length > 1) {
        throw new Error(
            i18n.t(
                'Multiple people match {{field}} "{{value}}". Use tracked entity ID.',
                { field: attributeId, value: trimmed }
            )
        )
    }

    const teiId = instances[0].trackedEntity
    if (cacheKey && teiId) teiCache.set(cacheKey, teiId)
    return teiId
}

export const isDuplicateTeiRegistrationError = (error) => {
    const text = [
        formatTrackerMutateError(error, ''),
        JSON.stringify(error?.details?.response ?? error?.details ?? {}),
    ]
        .join(' ')
        .toLowerCase()
    return (
        text.includes('non-unique') ||
        text.includes('non unique') ||
        text.includes('duplicate attribute') ||
        text.includes('already exists')
    )
}

/**
 * Find an existing person before registration (SMH, UUIC, or tracked entity ID).
 */
export const resolveTeiIdFromImportAttributes = async ({
    engine,
    context,
    attributes = [],
    programAttributes = [],
    personRef = '',
    linkAttributeId,
    teiCache,
}) => {
    const ref = String(personRef || '').trim()
    if (ref) {
        const fromRef = await resolveTeiId({
            engine,
            context,
            personRef: ref,
            linkAttributeId,
            teiCache,
            allowMissing: true,
        })
        if (fromRef) return fromRef
    }

    const linkId =
        linkAttributeId || findSmhTrackedEntityAttributeId(programAttributes)
    if (linkId) {
        const linkVal = linkValueFromAttributes(attributes, linkId)
        if (linkVal) {
            const tei = await searchTeiByAttributeValue({
                engine,
                context,
                attributeId: linkId,
                value: linkVal,
                teiCache,
                cacheKey: `${linkId}:${linkVal.toLowerCase()}`,
            })
            if (tei) return tei
        }
    }

    const uuicIds = resolveUuicSourceAttributeIds(programAttributes)
    if (uuicIds.uuic) {
        const hit = (attributes || []).find((a) => a.attribute === uuicIds.uuic)
        const uuicVal = hit?.value ? String(hit.value).trim() : ''
        if (uuicVal) {
            const tei = await searchTeiByAttributeValue({
                engine,
                context,
                attributeId: uuicIds.uuic,
                value: uuicVal,
                teiCache,
                cacheKey: `uuic:${uuicVal.toLowerCase()}`,
            })
            if (tei) return tei
        }
    }

    return null
}

export const resolveEnrollment = async ({
    engine,
    context,
    teiId,
    enrollmentCache,
}) => {
    const cacheKey = `${teiId}:${context.program}`
    if (enrollmentCache.has(cacheKey)) {
        return enrollmentCache.get(cacheKey)
    }

    const tei = await fetchTei({
        engine,
        id: teiId,
        programId: context.program,
    })
    const enrollment = (tei?.enrollments || []).find(
        (e) => e.program === context.program && !e.deleted
    )
    let enrollmentId = enrollment?.enrollment

    if (!enrollmentId) {
        const created = await createEnrollment({
            engine,
            teiId,
            orgUnit: context.orgUnit,
            program: context.program,
        })
        enrollmentId =
            extractTrackerMutationReference(created, 'ENROLLMENT') ||
            created?.response?.importSummaries?.[0]?.reference
    }

    if (!enrollmentId) {
        throw new Error(i18n.t('Could not find or create enrollment for this person.'))
    }

    enrollmentCache.set(cacheKey, enrollmentId)
    return enrollmentId
}

/**
 * @param {{ allowMissing?: boolean }} options - when true, returns null if not found (no throw)
 */
export const resolveTeiId = async ({
    engine,
    context,
    personRef,
    linkAttributeId,
    teiCache,
    allowMissing = false,
}) => {
    const ref = String(personRef || '').trim()
    if (!ref) {
        if (allowMissing) return null
        throw new Error(i18n.t('Person reference is empty.'))
    }

    if (isTrackedEntityUid(ref)) {
        return ref
    }

    const cacheKey = `${linkAttributeId || 'query'}:${ref.toLowerCase()}`
    if (teiCache.has(cacheKey)) {
        return teiCache.get(cacheKey)
    }

    if (!linkAttributeId) {
        if (allowMissing) return null
        throw new Error(
            i18n.t(
                'Person "{{ref}}" is not a tracked entity ID and no link attribute (e.g. SMH) is configured.',
                { ref }
            )
        )
    }

    const { instances } = await searchTrackedEntities({
        engine,
        orgUnit: context.orgUnit,
        program: context.program,
        filters: [{ attributeId: linkAttributeId, operator: 'eq', value: ref }],
        paging: false,
        pageSize: 5,
    })

    if (instances.length === 0) {
        if (allowMissing) return null
        throw new Error(
            i18n.t('No person found with identifier "{{ref}}".', { ref })
        )
    }
    if (instances.length > 1) {
        throw new Error(
            i18n.t('Multiple people match "{{ref}}". Use tracked entity ID.', { ref })
        )
    }

    const teiId = instances[0].trackedEntity
    teiCache.set(cacheKey, teiId)
    return teiId
}

export const linkValueFromAttributes = (attributes = [], linkAttributeId) => {
    if (!linkAttributeId) return ''
    const hit = attributes.find((a) => a.attribute === linkAttributeId)
    return hit?.value ? String(hit.value).trim() : ''
}
