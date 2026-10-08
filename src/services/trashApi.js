import i18n from '@dhis2/d2-i18n'
import { mergeLocaleParams } from '../lib/apiLocale'
import {
    assertTrackerImportMutationOk,
    fetchTei,
    formatTrackerMutateError,
} from './trackerApi'

const TRASH_OU_MODE = 'DESCENDANTS'

const isSoftDeleted = (row) => {
    const deleted = row?.deleted
    return deleted === true || deleted === 'true'
}

const appendFilter = (params, clause) => {
    if (!clause) return params
    const existing = params.filter
    if (!existing) {
        params.filter = clause
    } else if (Array.isArray(existing)) {
        params.filter = [...existing, clause]
    } else {
        params.filter = [existing, clause]
    }
    return params
}

const queryErrorMentionsDeleted = (error) => {
    const text = [
        error?.message,
        error?.details?.message,
        JSON.stringify(error?.details?.response || error?.details || ''),
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
    return (
        text.includes('deleted') ||
        text.includes('includedeleted') ||
        text.includes('include_deleted')
    )
}

const normalizePager = (res, page, pageSize) => {
    const rawPager = res.pager || {}
    return {
        page: rawPager.page ?? res.page ?? page,
        pageSize: rawPager.pageSize ?? res.pageSize ?? pageSize,
        total: rawPager.total ?? rawPager.totalRecords ?? res.total,
        pageCount: rawPager.pageCount ?? rawPager.totalPages,
    }
}

const normalizeTeiInstances = (res) => {
    const raw = res.instances || res.trackedEntityInstances || res.trackedEntities || []
    return raw.map((inst) => ({
        ...inst,
        trackedEntity: inst.trackedEntity || inst.trackedEntityInstance,
    }))
}

const teiTrashFields =
    'trackedEntity,trackedEntityType,orgUnit,deleted,createdAt,updatedAt,createdBy,updatedBy,storedBy,attributes,enrollments[enrollment,program,orgUnit,deleted,updatedAt,updatedBy]'

const enrollmentTrashFields =
    'enrollment,trackedEntity,program,orgUnit,deleted,enrolledAt,occurredAt,updatedAt,createdAt,createdBy,updatedBy'

const eventTrashFields =
    'event,program,programStage,orgUnit,trackedEntity,enrollment,status,deleted,occurredAt,eventDate,createdAt,updatedAt,createdBy,updatedBy,storedBy'

export const teiAttributeCache = new Map()
export const teiLabelCache = new Map()

export const formatTrashUser = (user, storedBy) => {
    if (!user && !storedBy) return '-'
    if (typeof user === 'string' && user.trim()) return user.trim()
    if (user && typeof user === 'object') {
        if (user.username) return user.username
        if (user.name) return user.name
        const full = [user.firstName, user.lastName].filter(Boolean).join(' ')
        if (full) return full
    }
    if (typeof storedBy === 'string' && storedBy.trim()) return storedBy.trim()
    return '-'
}

const DELETED_EVENT_FILTER = 'deleted:eq:true'

const queryDeletedTrackedEntitiesRaw = async ({
    engine,
    orgUnit,
    program,
    trackedEntityType,
    value,
    page,
    pageSize,
    order,
}) => {
    // CRITICAL: DHIS2 rejects requests containing BOTH program and trackedEntityType with:
    // "Program and tracked entity cannot be specified simultaneously"
    // When program is present, omit trackedEntityType.
    const resolvedProgram = program || undefined
    const resolvedTet = resolvedProgram ? undefined : (trackedEntityType || undefined)

    const baseParams = mergeLocaleParams({
        orgUnit,
        program: resolvedProgram,
        trackedEntityType: resolvedTet,
        fields: teiTrashFields,
        page,
        pageSize,
        paging: true,
        totalPages: true,
        includeDeleted: true,
        ouMode: TRASH_OU_MODE,
        order,
    })
    if (value) {
        baseParams.query = value
    }

    const runTrackerQuery = async () => {
        const response = await engine.query({
            tei: {
                resource: 'tracker/trackedEntities',
                params: baseParams,
            },
        })
        return response.tei || {}
    }

    try {
        return await runTrackerQuery()
    } catch (error) {
        if (queryErrorMentionsDeleted(error)) {
            const params = { ...baseParams }
            delete params.includeDeleted
            const response = await engine.query({
                tei: {
                    resource: 'tracker/trackedEntities',
                    params,
                },
            })
            return response.tei || {}
        }
        try {
            const response = await engine.query({
                tei: {
                    resource: 'trackedEntityInstances',
                    params: baseParams,
                },
            })
            return response.tei || {}
        } catch (legacyError) {
            throw error
        }
    }
}

export const searchDeletedTrackedEntities = async ({
    engine,
    orgUnit,
    program,
    trackedEntityType,
    value,
    page = 1,
    pageSize = 20,
    order = 'updatedAt:desc',
}) => {
    const res = await queryDeletedTrackedEntitiesRaw({
        engine,
        orgUnit,
        program,
        trackedEntityType,
        value,
        page,
        pageSize,
        order,
    })
    const instances = normalizeTeiInstances(res).filter(isSoftDeleted)
    return { instances, pager: normalizePager(res, page, pageSize) }
}

export const searchDeletedEnrollments = async ({
    engine,
    orgUnit,
    program,
    page = 1,
    pageSize = 50,
}) => {
    const params = mergeLocaleParams({
        orgUnit,
        program,
        fields: enrollmentTrashFields,
        page,
        pageSize,
        paging: true,
        totalPages: true,
        includeDeleted: true,
        ouMode: TRASH_OU_MODE,
        order: 'updatedAt:desc',
    })

    let response
    try {
        response = await engine.query({
            enrollments: {
                resource: 'tracker/enrollments',
                params,
            },
        })
    } catch (error) {
        if (!queryErrorMentionsDeleted(error)) {
            throw error
        }
        const fallbackParams = { ...params }
        delete fallbackParams.includeDeleted
        response = await engine.query({
            enrollments: {
                resource: 'tracker/enrollments',
                params: fallbackParams,
            },
        })
    }

    const res = response.enrollments || {}
    const instances = (res.instances || []).filter(isSoftDeleted)
    return { instances, pager: normalizePager(res, page, pageSize) }
}

const enrichRowsWithTeiDetails = async ({ engine, program, rows }) => {
    if (!rows || !rows.length) return rows

    // 1. Identify which rows need audit enrichment (empty attributes)
    const neededIds = []
    for (const r of rows) {
        const id = r.tei?.trackedEntity
        if (!id) continue

        // Check if already in cache
        if (teiAttributeCache.has(id)) {
            const cachedAttrs = teiAttributeCache.get(id)
            if (cachedAttrs && cachedAttrs.length > 0) {
                r.tei.attributes = cachedAttrs
            }
        }

        // If row has attributes from the initial query, store in cache
        if (r.tei?.attributes && r.tei.attributes.length > 0) {
            teiAttributeCache.set(id, r.tei.attributes)
        } else if (!neededIds.includes(id)) {
            neededIds.push(id)
        }
    }

    if (!neededIds.length) return rows

    // 2. Fetch TEI profile and attributes in parallel batches of 5
    const BATCH_SIZE = 5
    for (let i = 0; i < neededIds.length; i += BATCH_SIZE) {
        const batch = neededIds.slice(i, i + BATCH_SIZE)
        await Promise.all(
            batch.map(async (id) => {
                // Direct TEI lookup (works for active TEIs with deleted enrollments and soft-deleted TEIs)
                try {
                    const tei = await fetchTei({
                        engine,
                        id,
                        programId: program || undefined,
                        includeDeleted: true,
                    })
                    if (tei?.attributes && tei.attributes.length > 0) {
                        teiAttributeCache.set(id, tei.attributes)
                        return
                    }
                } catch {
                    /* fallback to audit query */
                }

                // If fetchTei failed or had no attributes, check audit logs
                try {
                    const auditRes = await engine.query({
                        audits: {
                            resource: 'audits/trackedEntityAttributeValue',
                            params: {
                                tei: id,
                                skipPaging: true,
                            },
                        },
                    })
                    const auditRecords = auditRes.audits?.trackedEntityAttributeValueAudits || []
                    if (auditRecords.length > 0) {
                        const attrMap = new Map()
                        const sorted = [...auditRecords].sort(
                            (a, b) => new Date(b.created || 0) - new Date(a.created || 0)
                        )
                        for (const record of sorted) {
                            const attrId = record.trackedEntityAttribute?.id
                            if (attrId && !attrMap.has(attrId) && record.value != null && record.value !== '') {
                                attrMap.set(attrId, {
                                    attribute: attrId,
                                    value: String(record.value),
                                    auditType: record.auditType,
                                    created: record.created,
                                })
                            }
                        }
                        const auditAttrs = Array.from(attrMap.values())
                        if (auditAttrs.length > 0) {
                            teiAttributeCache.set(id, auditAttrs)
                        }
                    }
                } catch {
                    /* audit query failed or not permitted */
                }
            })
        )
    }

    return rows.map((row) => {
        const id = row.tei?.trackedEntity
        const cached = id ? teiAttributeCache.get(id) : null
        if (cached && cached.length > 0 && (!row.tei?.attributes || row.tei.attributes.length === 0)) {
            return {
                ...row,
                tei: {
                    ...row.tei,
                    attributes: cached,
                },
            }
        }
        return row
    })
}

const enrichEventsWithTeiLabels = async ({ engine, program, instances }) => {
    if (!instances || !instances.length) return { instances: [], teiById: {} }
    const unique = [...new Set(instances.map((e) => e.trackedEntity).filter(Boolean))]
    const teiById = {}
    const missing = []

    for (const id of unique) {
        if (teiLabelCache.has(id)) {
            teiById[id] = teiLabelCache.get(id)
        } else {
            missing.push(id)
        }
    }

    if (missing.length > 0) {
        const BATCH_SIZE = 5
        for (let i = 0; i < missing.length; i += BATCH_SIZE) {
            const batch = missing.slice(i, i + BATCH_SIZE)
            await Promise.all(
                batch.map(async (id) => {
                    try {
                        const tei = await fetchTei({
                            engine,
                            id,
                            programId: program || undefined,
                            includeDeleted: true,
                        })
                        teiById[id] = tei
                        teiLabelCache.set(id, tei)
                    } catch {
                        /* ignore */
                    }
                })
            )
        }
    }

    return { instances, teiById }
}

/** Merges soft-deleted TEIs and enrollments (enrollment-only rows when TEI is still active). */
export const searchDeletedPersonnel = async (args) => {
    const cleanArgs = {
        ...args,
        program: args.program || undefined,
        trackedEntityType: args.program ? undefined : (args.trackedEntityType || undefined),
    }

    const [{ instances: teis, pager }, enrollmentsResult] = await Promise.all([
        searchDeletedTrackedEntities(cleanArgs),
        cleanArgs.program
            ? searchDeletedEnrollments({
                  engine: cleanArgs.engine,
                  orgUnit: cleanArgs.orgUnit,
                  program: cleanArgs.program,
                  page: 1,
                  pageSize: cleanArgs.pageSize || 20,
              }).catch(() => ({ instances: [] }))
            : Promise.resolve({ instances: [] }),
    ])

    const enrollments = enrollmentsResult?.instances || []
    const teiIds = new Set(teis.map((t) => t.trackedEntity).filter(Boolean))
    const enrollmentRows = enrollments
        .filter((en) => en.trackedEntity && !teiIds.has(en.trackedEntity))
        .map((enrollment) => ({
            kind: 'enrollment',
            id: `enrollment:${enrollment.enrollment}`,
            enrollment,
            tei: {
                trackedEntity: enrollment.trackedEntity,
                deleted: true,
                updatedAt: enrollment.updatedAt || enrollment.enrolledAt,
                updatedBy: enrollment.updatedBy,
                attributes: [],
            },
        }))

    const teiRows = teis.map((tei) => ({
        kind: 'tei',
        id: `tei:${tei.trackedEntity}`,
        tei,
    }))

    let rows = [...teiRows, ...enrollmentRows]
    rows = await enrichRowsWithTeiDetails({
        engine: cleanArgs.engine,
        program: cleanArgs.program,
        rows,
    })

    if (cleanArgs.value && typeof cleanArgs.value === 'string' && cleanArgs.value.trim()) {
        const q = cleanArgs.value.trim().toLowerCase()
        rows = rows.filter((r) => {
            const tei = r.tei
            if (tei?.trackedEntity?.toLowerCase().includes(q)) return true
            if (tei?.attributes?.some((a) => String(a.value || '').toLowerCase().includes(q))) return true
            if (r.enrollment?.enrollment?.toLowerCase().includes(q)) return true
            return false
        })
    }

    return { rows, pager }
}

export const searchDeletedEvents = async ({
    engine,
    orgUnit,
    program,
    value,
    page = 1,
    pageSize = 20,
}) => {
    const baseParams = mergeLocaleParams({
        orgUnit,
        program,
        fields: eventTrashFields,
        page,
        pageSize,
        paging: true,
        totalPages: true,
        includeDeleted: true,
        ouMode: TRASH_OU_MODE,
        order: 'updatedAt:desc',
    })

    const runQuery = async (withDeletedFilter) => {
        const params = { ...baseParams }
        if (withDeletedFilter) {
            appendFilter(params, DELETED_EVENT_FILTER)
        }
        return engine.query({
            events: {
                resource: 'tracker/events',
                params,
            },
        })
    }

    let response
    try {
        response = await runQuery(true)
    } catch (error) {
        if (!queryErrorMentionsDeleted(error)) {
            throw error
        }
        response = await runQuery(false)
    }

    const res = response.events || {}
    let instances = (res.instances || []).filter(isSoftDeleted)

    const { instances: enriched, teiById } = await enrichEventsWithTeiLabels({
        engine,
        program,
        instances,
    })

    if (value && typeof value === 'string' && value.trim()) {
        const q = value.trim().toLowerCase()
        instances = enriched.filter((e) => {
            if (e.event?.toLowerCase().includes(q)) return true
            if (e.trackedEntity?.toLowerCase().includes(q)) return true
            const tei = teiById[e.trackedEntity]
            if (tei?.attributes?.some((a) => String(a.value || '').toLowerCase().includes(q))) {
                return true
            }
            return false
        })
    } else {
        instances = enriched
    }

    return {
        instances,
        teiById,
        pager: normalizePager(res, page, pageSize),
    }
}

const runTrackerRestore = async ({ engine, payload }) => {
    try {
        const result = await engine.mutate({
            resource: 'tracker',
            type: 'create',
            params: mergeLocaleParams({
                async: false,
                importStrategy: 'UPDATE',
            }),
            data: payload,
        })
        assertTrackerImportMutationOk(result)
        return result
    } catch (error) {
        throw new Error(
            formatTrackerMutateError(
                error,
                i18n.t('Restore failed. Your DHIS2 version may not support restoring from the app.')
            )
        )
    }
}

/** Best-effort restore of a soft-deleted tracked entity. */
export const restoreTrackedEntity = async ({
    engine,
    trackedEntityId,
    programId,
    orgUnitId,
    trackedEntityType,
}) => {
    teiAttributeCache.delete(trackedEntityId)
    teiLabelCache.delete(trackedEntityId)

    try {
        return await runTrackerRestore({
            engine,
            payload: {
                trackedEntities: [
                    {
                        trackedEntity: trackedEntityId,
                        deleted: false,
                        ...(programId ? { program: programId } : {}),
                        ...(orgUnitId ? { orgUnit: orgUnitId } : {}),
                        ...(trackedEntityType ? { trackedEntityType } : {}),
                    },
                ],
            },
        })
    } catch (error) {
        const msg = String(error?.message || '')
        if (
            msg.includes('already deleted and cannot be modified') ||
            msg.includes('already been deleted') ||
            msg.includes('could not be found')
        ) {
            throw new Error(
                i18n.t('Tracked entity was permanently deleted and cannot be restored.')
            )
        }
        throw error
    }
}

/** Restore a soft-deleted program enrollment by re-enrolling into the program with client attributes. */
export const restoreEnrollment = async ({
    engine,
    enrollmentId,
    programId,
    orgUnitId,
    trackedEntityId,
    attributes = [],
    enrolledAt,
    occurredAt,
}) => {
    if (trackedEntityId) {
        teiAttributeCache.delete(trackedEntityId)
        teiLabelCache.delete(trackedEntityId)
    }

    let attrList = Array.isArray(attributes) ? [...attributes] : []
    if (attrList.length === 0 && trackedEntityId) {
        try {
            const tei = await fetchTei({ engine, id: trackedEntityId, includeDeleted: true })
            if (tei?.attributes?.length) {
                attrList = tei.attributes
            }
        } catch {
            /* ignore */
        }
    }

    const cleanAttrs = attrList
        .filter((a) => (a.attribute || a.id || a.trackedEntityAttribute?.id) && a.value != null && a.value !== '')
        .map((a) => ({
            attribute: a.attribute || a.id || a.trackedEntityAttribute?.id,
            value: String(a.value),
        }))

    const nowIso = new Date().toISOString()
    const enrollmentPayload = {
        trackedEntity: trackedEntityId,
        program: programId,
        orgUnit: orgUnitId,
        status: 'ACTIVE',
        enrolledAt: enrolledAt || nowIso,
        occurredAt: occurredAt || enrolledAt || nowIso,
        ...(cleanAttrs.length > 0 ? { attributes: cleanAttrs } : {}),
    }

    try {
        const result = await engine.mutate({
            resource: 'tracker',
            type: 'create',
            params: mergeLocaleParams({
                async: false,
                importStrategy: 'CREATE',
            }),
            data: {
                enrollments: [enrollmentPayload],
            },
        })
        assertTrackerImportMutationOk(result)
        return result
    } catch (createError) {
        const errText = String(createError?.message || '')
        if (errText.includes('already exists') || errText.includes('already enrolled')) {
            return { status: 'OK', message: i18n.t('Client is already active in this program.') }
        }
        if (
            errText.includes('already deleted and cannot be modified') ||
            errText.includes('already been deleted') ||
            errText.includes('could not be found')
        ) {
            throw new Error(
                i18n.t('Tracked entity was permanently deleted and cannot be restored.')
            )
        }
        throw new Error(
            formatTrackerMutateError(
                createError,
                i18n.t('Failed to restore enrollment. Check mandatory attributes or access rights.')
            )
        )
    }
}

/** Best-effort restore of a soft-deleted event. */
export const restoreEvent = async ({ engine, eventId, programId, orgUnitId }) => {
    try {
        return await runTrackerRestore({
            engine,
            payload: {
                events: [
                    {
                        event: eventId,
                        deleted: false,
                        ...(programId ? { program: programId } : {}),
                        ...(orgUnitId ? { orgUnit: orgUnitId } : {}),
                    },
                ],
            },
        })
    } catch (error) {
        const msg = String(error?.message || '')
        if (
            msg.includes('already deleted and cannot be modified') ||
            msg.includes('already been deleted')
        ) {
            throw new Error(
                i18n.t('Event was permanently deleted and cannot be restored.')
            )
        }
        throw error
    }
}
