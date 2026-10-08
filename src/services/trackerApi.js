import i18n from '@dhis2/d2-i18n'
import { mergeLocaleParams } from '../lib/apiLocale'

const defaultFields = 'trackedEntity,trackedEntityInstance,attributes,relationships,notes,createdBy,createdAt,created,lastUpdated,enrollments[enrollment,program,orgUnit,status,enrolledAt,occurredAt,enrollmentDate,incidentDate,notes,events[event,programStage,status,eventDate,occurredAt,completedAt,createdAt,updatedAt,createdBy,notes,dataValues[dataElement,value]]]'

export const listFields = 'trackedEntity,trackedEntityInstance,attributes,enrollments[enrollment,program,orgUnit,status,enrolledAt,occurredAt,enrollmentDate,incidentDate,events[event,programStage,status,eventDate,occurredAt,completedAt,dataValues[dataElement,value]]]'

const httpStatusFromError = (error) =>
    Number(error?.details?.httpStatusCode || error?.status || error?.details?.statusCode)

const is404 = (error) => httpStatusFromError(error) === 404

const is403 = (error) => httpStatusFromError(error) === 403

/** User-facing message for tracker/event mutate failures (403 on completed events, etc.). */
const GENERIC_MUTATE_KEYS = new Set([
    'value_required_but_not_provided',
    'import summary',
])

export const formatTrackerMutateError = (
    error,
    fallback = 'Request failed',
    { completedEventHint = false } = {}
) => {
    const status = httpStatusFromError(error)
    if (status === 403) {
        const detail = error?.details?.response ?? error?.details ?? error
        const importMsgs = collectTrackerImportErrorMessages(detail)
        if (importMsgs.length > 0) return importMsgs.join(' · ')
        const serverMsg = detail?.message
        if (serverMsg && !/^forbidden$/i.test(String(serverMsg).trim())) {
            return String(serverMsg)
        }
        if (completedEventHint) {
            return i18n.t(
                'This visit is complete on the server. Mark it incomplete before saving changes.'
            )
        }
        return i18n.t(
            'You do not have permission to perform this action. Check your DHIS2 role and organisation unit access.'
        )
    }
    const detail = error?.details?.response ?? error?.details ?? error
    const importMsgs = collectTrackerImportErrorMessages(detail)
    const specific = importMsgs.filter(
        (m) => !GENERIC_MUTATE_KEYS.has(String(m).trim())
    )
    if (specific.length > 0) return specific.join(' · ')
    if (importMsgs.length > 0) {
        if (importMsgs.length > 1) {
            return `${fallback} (${importMsgs.length} required fields are missing or empty.)`
        }
        return fallback
    }
    const generic = error?.message || fallback
    if ([...GENERIC_MUTATE_KEYS].some((k) => generic.includes(k))) {
        return fallback
    }
    return generic
}

const collectTrackerImportErrorMessages = (summary) => {
    const out = []
    const push = (arr) => {
        if (!Array.isArray(arr)) return
        for (const r of arr) {
            const m = r?.message || r?.errorMessage
            if (m) out.push(String(m))
        }
    }
    const pushConflicts = (arr) => {
        if (!Array.isArray(arr)) return
        for (const c of arr) {
            const m = c?.value || c?.message
            if (m) out.push(String(m))
        }
    }
    const pushLegacyConflicts = (arr) => {
        if (!Array.isArray(arr)) return
        for (const c of arr) {
            const key = c?.object || c?.property
            const msg = c?.value || c?.message
            if (key && msg && key !== msg) {
                out.push(`${key}: ${msg}`)
            } else if (msg) {
                out.push(String(msg))
            } else if (key) {
                out.push(String(key))
            }
        }
    }
    if (!summary || typeof summary !== 'object') return out
    if (summary.description) out.push(String(summary.description))
    push(summary.validationReport?.errorReports)
    pushConflicts(summary.conflicts)
    pushLegacyConflicts(summary.response?.conflicts)
    pushLegacyConflicts(summary.conflicts)
    if (Array.isArray(summary.importSummaries)) {
        for (const imp of summary.importSummaries) {
            if (imp?.description) out.push(String(imp.description))
            push(imp?.errorReports)
            pushConflicts(imp?.conflicts)
        }
    }
    const map = summary.bundleReport?.typeReportMap
    if (map && typeof map === 'object') {
        for (const rep of Object.values(map)) {
            for (const ob of rep?.objectReports || []) {
                push(ob?.errorReports)
                pushConflicts(ob?.conflicts)
            }
        }
    }
    return out
}

const resolveTrackerImportSummary = (raw) =>
    raw?.response ??
    (Array.isArray(raw?.importSummaries) ? raw.importSummaries[0] : null) ??
    raw

export const assertTrackerImportMutationOk = (raw) => {
    const summary = resolveTrackerImportSummary(raw)
    if (!summary || typeof summary !== 'object') return
    const errs = collectTrackerImportErrorMessages(summary)
    if (errs.length > 0) {
        throw new Error(errs.join(' · '))
    }
    if (summary.status === 'ERROR') {
        throw new Error(summary.message || summary.description || 'Tracker import returned ERROR')
    }
}

const assertTrackerImportDeleteOk = (raw) => {
    assertTrackerImportMutationOk(raw)
}

/** Legacy `PUT /events/{id}` returns ImportSummary-style bodies; surface conflicts as errors. */
const assertLegacyEventMutationOk = (raw) => {
    if (!raw || typeof raw !== 'object') return
    const summary = resolveTrackerImportSummary(raw)
    if (!summary || typeof summary !== 'object') return
    const errs = collectTrackerImportErrorMessages(summary)
    if (errs.length > 0) {
        throw new Error(errs.join(' · '))
    }
    if (summary.status === 'ERROR') {
        throw new Error(summary.message || summary.description || 'Event update failed')
    }
}

/** Visit / occurred date (YYYY-MM-DD). */
export const normalizeEventApiDate = (date) => {
    if (!date) return new Date().toISOString().slice(0, 10)
    const s = String(date).trim()
    if (!s) return new Date().toISOString().slice(0, 10)
    return s.includes('T') ? s.split('T')[0] : s.slice(0, 10)
}

/** Completion timestamp — use today (tracker_npd), not visit date (avoids E1043 expiry). */
const completionApiDate = () => new Date().toISOString().slice(0, 10)

/** UID from tracker import / legacy create responses (EVENT, ENROLLMENT, etc.). */
export const extractTrackerMutationReference = (raw, type = 'EVENT') => {
    if (!raw || typeof raw !== 'object') return null
    const roots = [raw, raw.response, raw.bundleReport].filter(Boolean)
    for (const root of roots) {
        const map = root.typeReportMap || root.bundleReport?.typeReportMap
        const report = map?.[type] || map?.EVENT
        const uid = report?.objectReports?.[0]?.uid
        if (uid) return uid
    }
    const imp =
        raw.response?.importSummaries?.[0] ||
        raw.importSummaries?.[0] ||
        (Array.isArray(raw.importSummaries) ? raw.importSummaries[0] : null)
    return imp?.reference || null
}

const queryWithFallback = async ({ engine, primary, fallback }) => {
    try {
        return await engine.query(primary)
    } catch (error) {
        if (!is404(error) || !fallback) {
            throw error
        }
        return engine.query(fallback)
    }
}

const mutateWithFallback = async ({ engine, primary, fallback, fallbackOn403 = false }) => {
    try {
        return await engine.mutate(primary)
    } catch (error) {
        const canFallback =
            fallback && (is404(error) || (fallbackOn403 && is403(error)))
        if (!canFallback) {
            throw error
        }
        return engine.mutate(fallback)
    }
}

export const searchTrackedEntities = async ({
    engine,
    orgUnit,
    program,
    filters,
    value,
    startDate,
    endDate,
    dateFilterMode = 'ENROLLMENT',
    page = 1,
    pageSize = 15,
    order,
    paging = true,
    ouMode = 'DESCENDANTS',
    deletedOnly = false,
    fields = listFields,
}) => {
    const baseParams = mergeLocaleParams({
        orgUnit,
        program,
        fields,
        page,
        pageSize: value ? 100 : pageSize,
        paging,
        ouMode: ouMode || 'DESCENDANTS',
        totalPages: true,
    })
    if (deletedOnly) {
        baseParams.includeDeleted = true
    }
    if (order) {
        baseParams.order = order
    }

    // Filter by Enrollment Date or Event Date when NOT doing a specific text/code search
    if (!value) {
        if (dateFilterMode === 'EVENT') {
            if (startDate) {
                baseParams.eventOccurredAfter = startDate
                baseParams.eventStartDate = startDate
            }
            if (endDate) {
                baseParams.eventOccurredBefore = endDate
                baseParams.eventEndDate = endDate
            }
        } else {
            if (startDate) {
                baseParams.programStartDate = startDate
                baseParams.enrollmentEnrolledAfter = startDate
            }
            if (endDate) {
                baseParams.programEndDate = endDate
                baseParams.enrollmentEnrolledBefore = endDate
            }
        }
    }

    if (filters && filters.length > 0) {
        const filterParams = filters
            .filter((f) => f.attributeId && f.value != null && String(f.value) !== '')
            .map((f) => {
                const op = (f.operator || 'like').toLowerCase()
                return `${f.attributeId}:${op}:${f.value}`
            })

        if (filterParams.length > 0) {
            baseParams.filter = filterParams
        }
    }

    const runQuery = async (queryParams) => {
        try {
            return await queryWithFallback({
                engine,
                primary: {
                    tei: {
                        resource: 'tracker/trackedEntities',
                        params: queryParams,
                    },
                },
                fallback: {
                    tei: {
                        resource: 'trackedEntityInstances',
                        params: queryParams,
                    },
                },
            })
        } catch (err) {
            console.warn('Tracker search query error:', err)
            return { tei: {} }
        }
    }

    let res = {}
    let rawInstances = []

    if (value && String(value).trim()) {
        const qVal = String(value).trim()
        // 1. Try search with query=value
        const queryResponse = await runQuery({ ...baseParams, query: qVal })
        res = queryResponse.tei || {}
        rawInstances = res.instances || res.trackedEntityInstances || res.trackedEntities || []

        // 2. If 0 results, try digits only (e.g. '1190710' from 'សងបស1190710')
        if (rawInstances.length === 0) {
            const digits = qVal.replace(/\D/g, '')
            if (digits && digits.length >= 3 && digits !== qVal) {
                const digitsResponse = await runQuery({ ...baseParams, query: digits })
                const dRes = digitsResponse.tei || {}
                const dInstances = dRes.instances || dRes.trackedEntityInstances || dRes.trackedEntities || []
                if (dInstances.length > 0) {
                    res = dRes
                    rawInstances = dInstances
                }
            }
        }

        // 3. If still 0 results (attribute unindexed in DHIS2 or query param not filterable), fetch pool and filter client-side
        if (rawInstances.length === 0) {
            const poolResponse = await runQuery(baseParams)
            const pRes = poolResponse.tei || {}
            const pInstances = pRes.instances || pRes.trackedEntityInstances || pRes.trackedEntities || []
            if (pInstances.length > 0) {
                const targetLower = qVal.toLowerCase()
                const digits = qVal.replace(/\D/g, '')
                const matched = pInstances.filter((inst) => {
                    const attrs = inst.attributes || []
                    return attrs.some((a) => {
                        const v = String(a.value || '').trim().toLowerCase()
                        if (!v) return false
                        if (v.includes(targetLower)) return true
                        if (digits && digits.length >= 6 && v.replace(/\D/g, '').includes(digits)) return true
                        return false
                    })
                })
                res = pRes
                rawInstances = matched
            }
        }
    } else {
        const response = await runQuery(baseParams)
        res = response.tei || {}
        rawInstances = res.instances || res.trackedEntityInstances || res.trackedEntities || []
    }

    const instances = rawInstances.map((inst) => ({
        ...inst,
        trackedEntity: inst.trackedEntity || inst.trackedEntityInstance,
    }))

    const rawPager = res.pager || {}
    const pager = {
        page: rawPager.page ?? res.page ?? page,
        pageSize: rawPager.pageSize ?? res.pageSize ?? pageSize,
        total: rawPager.total ?? rawPager.totalRecords ?? res.total ?? res.totalCount ?? instances.length,
        pageCount: rawPager.pageCount ?? rawPager.totalPages ?? 1,
    }

    return { instances, pager }
}

export const fetchTei = async ({
    engine,
    id,
    programId,
    fresh = false,
    includeDeleted = false,
}) => {
    const params = mergeLocaleParams({
        program: programId,
        fields: defaultFields,
    })
    if (includeDeleted) {
        params.includeDeleted = true
    }
    if (fresh) {
        params.t = new Date().getTime()
    }
    const response = await queryWithFallback({
        engine,
        primary: {
            tei: {
                resource: `tracker/trackedEntities/${id}`,
                params,
            },
        },
        fallback: {
            tei: {
                resource: `trackedEntityInstances/${id}`,
                params,
            },
        },
    })
    
    const res = response.tei || {}
    let tei = res
    if (res.instances && res.instances.length > 0) tei = res.instances[0]
    else if (res.trackedEntities && res.trackedEntities.length > 0) tei = res.trackedEntities[0]
    else if (res.trackedEntityInstances && res.trackedEntityInstances.length > 0) tei = res.trackedEntityInstances[0]
    
    if (tei && !tei.trackedEntity && tei.trackedEntityInstance) {
        tei.trackedEntity = tei.trackedEntityInstance
    }
    
    return tei
}

export const eventTeiCache = new Map()

export const fetchTeiAttributes = async ({ engine, id, programId }) => {
    if (!id) return { trackedEntity: '', attributes: [] }
    if (eventTeiCache.has(id)) return eventTeiCache.get(id)

    try {
        const response = await queryWithFallback({
            engine,
            primary: {
                tei: {
                    resource: `tracker/trackedEntities/${id}`,
                    params: mergeLocaleParams({
                        program: programId,
                        fields: 'trackedEntity,trackedEntityInstance,attributes,enrollments[enrollment,status,enrolledAt,occurredAt]',
                    }),
                },
            },
            fallback: {
                tei: {
                    resource: `trackedEntityInstances/${id}`,
                    params: mergeLocaleParams({
                        program: programId,
                        fields: 'trackedEntity,trackedEntityInstance,attributes,enrollments[enrollment,status,enrolledAt,occurredAt]',
                    }),
                },
            },
        })
        const res = response.tei || {}
        let tei = res
        if (res.instances && res.instances.length > 0) tei = res.instances[0]
        else if (res.trackedEntities && res.trackedEntities.length > 0) tei = res.trackedEntities[0]
        else if (res.trackedEntityInstances && res.trackedEntityInstances.length > 0) tei = res.trackedEntityInstances[0]
        if (tei && !tei.trackedEntity && tei.trackedEntityInstance) {
            tei.trackedEntity = tei.trackedEntityInstance
        }
        eventTeiCache.set(id, tei)
        return tei
    } catch {
        const fallbackObj = { trackedEntity: id, attributes: [] }
        eventTeiCache.set(id, fallbackObj)
        return fallbackObj
    }
}

export const searchEvents = async ({
    engine,
    orgUnit,
    program,
    programStage,
    startDate,
    endDate,
    status,
    page = 1,
    pageSize = 15,
    order = 'occurredAt:desc',
    ouMode = 'DESCENDANTS',
    value,
}) => {
    const baseParams = mergeLocaleParams({
        orgUnit,
        program,
        page,
        pageSize,
        paging: true,
        ouMode: ouMode || 'DESCENDANTS',
        totalPages: true,
        fields: 'event,program,programStage,orgUnit,orgUnitName,trackedEntity,trackedEntityInstance,enrollment,status,occurredAt,eventDate,createdAt,updatedAt,dataValues[dataElement,value]',
    })

    if (programStage) {
        baseParams.programStage = programStage
    }
    if (status) {
        baseParams.status = status
    }
    if (order) {
        baseParams.order = order
    }
    if (startDate) {
        baseParams.occurredAfter = startDate
    }
    if (endDate) {
        baseParams.occurredBefore = endDate
    }

    const runQuery = async (params) => {
        try {
            return await queryWithFallback({
                engine,
                primary: {
                    events: {
                        resource: 'tracker/events',
                        params,
                    },
                },
                fallback: {
                    events: {
                        resource: 'events',
                        params: (() => {
                            const p = { ...params }
                            delete p.occurredAfter
                            delete p.occurredBefore
                            if (startDate) p.startDate = startDate
                            if (endDate) p.endDate = endDate
                            if (p.order && p.order.includes('occurredAt')) {
                                p.order = p.order.replace('occurredAt', 'eventDate')
                            }
                            return p
                        })(),
                    },
                },
            })
        } catch (err) {
            console.warn('searchEvents query error:', err)
            return { events: {} }
        }
    }

    const response = await runQuery(baseParams)
    const res = response.events || {}
    let rawEvents = res.instances || res.events || []

    let instances = rawEvents.map((ev) => ({
        ...ev,
        event: ev.event || ev.id,
        trackedEntity: ev.trackedEntity || ev.trackedEntityInstance,
        eventDate: ev.eventDate || ev.occurredAt,
        occurredAt: ev.occurredAt || ev.eventDate,
    }))

    // Also populate enrollments without events so they are not missing from event data/counts
    if (!programStage) {
        try {
            const enrParams = mergeLocaleParams({
                orgUnit,
                program,
                ouMode: ouMode || 'DESCENDANTS',
                fields: 'enrollment,trackedEntity,trackedEntityInstance,program,orgUnit,orgUnitName,status,enrolledAt,enrollmentDate,createdAt,events[event]',
                paging: false,
            })
            if (startDate) {
                enrParams.enrolledAfter = startDate
                enrParams.enrollmentEnrolledAfter = startDate
            }
            if (endDate) {
                enrParams.enrolledBefore = endDate
                enrParams.enrollmentEnrolledBefore = endDate
            }
            const enrResponse = await queryWithFallback({
                engine,
                primary: {
                    enr: {
                        resource: 'tracker/enrollments',
                        params: enrParams,
                    },
                },
                fallback: {
                    enr: {
                        resource: 'enrollments',
                        params: (() => {
                            const p = { ...enrParams }
                            delete p.enrolledAfter
                            delete p.enrolledBefore
                            delete p.enrollmentEnrolledAfter
                            delete p.enrollmentEnrolledBefore
                            if (startDate) p.startDate = startDate
                            if (endDate) p.endDate = endDate
                            return p
                        })(),
                    },
                },
            })
            const rawEnrs = enrResponse.enr?.instances || enrResponse.enr?.enrollments || []
            const emptyEnrs = rawEnrs.filter((enr) => !enr.events || enr.events.length === 0)
            for (const enr of emptyEnrs) {
                const teiId = enr.trackedEntity || enr.trackedEntityInstance
                if (!teiId) continue
                const eventId = `enr_${enr.enrollment || teiId}`
                if (instances.some((e) => e.event === eventId || e.enrollment === enr.enrollment)) continue

                const enrDate = enr.enrolledAt || enr.enrollmentDate || enr.createdAt
                instances.push({
                    event: eventId,
                    enrollment: enr.enrollment,
                    program: enr.program || program,
                    programStage: null,
                    orgUnit: enr.orgUnit || orgUnit,
                    orgUnitName: enr.orgUnitName || '',
                    trackedEntity: teiId,
                    status: enr.status || 'ACTIVE',
                    eventDate: enrDate,
                    occurredAt: enrDate,
                    createdAt: enr.createdAt || enrDate,
                    dataValues: [],
                    isEnrollmentOnly: true,
                })
            }
        } catch (enrErr) {
            console.warn('searchEvents enrollment populate error:', enrErr)
        }
    }

    // Collect unique TEI IDs missing from cache
    const uniqueTeiIds = [...new Set(instances.map((e) => e.trackedEntity).filter(Boolean))]
    const missing = uniqueTeiIds.filter((id) => !eventTeiCache.has(id))
    if (missing.length > 0) {
        const BATCH_SIZE = 5
        for (let i = 0; i < missing.length; i += BATCH_SIZE) {
            const batch = missing.slice(i, i + BATCH_SIZE)
            await Promise.all(
                batch.map(async (id) => {
                    await fetchTeiAttributes({ engine, id, programId: program })
                })
            )
        }
    }

    let eventsWithTei = instances.map((ev) => ({
        ...ev,
        tei: eventTeiCache.get(ev.trackedEntity) || {
            trackedEntity: ev.trackedEntity,
            attributes: [],
        },
    }))

    // If search text value is provided, filter matching events
    if (value && String(value).trim()) {
        const q = String(value).trim().toLowerCase()
        const digits = q.replace(/\D/g, '')
        eventsWithTei = eventsWithTei.filter((ev) => {
            if (ev.event?.toLowerCase().includes(q)) return true
            if (ev.trackedEntity?.toLowerCase().includes(q)) return true
            const attrs = ev.tei?.attributes || []
            return attrs.some((a) => {
                const v = String(a.value || '').trim().toLowerCase()
                if (!v) return false
                if (v.includes(q)) return true
                if (digits && digits.length >= 4 && v.replace(/\D/g, '').includes(digits)) return true
                return false
            })
        })
    }

    const rawPager = res.pager || {}
    const pager = {
        page: rawPager.page ?? res.page ?? page,
        pageSize: rawPager.pageSize ?? res.pageSize ?? pageSize,
        total: rawPager.total ?? rawPager.totalRecords ?? res.total ?? res.totalCount ?? eventsWithTei.length,
        pageCount: rawPager.pageCount ?? rawPager.totalPages ?? 1,
    }

    return { instances: eventsWithTei, pager }
}

/** Update tracked-entity profile attributes (tracker import UPDATE, legacy TEI PUT fallback). */
export const updateTrackedEntity = async ({
    engine,
    trackedEntityId,
    orgUnit,
    trackedEntityType,
    attributes,
}) => {
    const tePayload = {
        trackedEntity: trackedEntityId,
        ...(orgUnit ? { orgUnit } : {}),
        ...(trackedEntityType ? { trackedEntityType } : {}),
        attributes,
    }
    const result = await mutateWithFallback({
        engine,
        primary: {
            resource: 'tracker',
            type: 'create',
            params: {
                async: false,
                importStrategy: 'UPDATE',
            },
            data: {
                trackedEntities: [tePayload],
            },
        },
        fallback: {
            resource: `trackedEntityInstances/${trackedEntityId}`,
            type: 'update',
            data: {
                trackedEntity: trackedEntityId,
                trackedEntityInstance: trackedEntityId,
                ...(orgUnit ? { orgUnit } : {}),
                attributes,
            },
        },
    })
    assertTrackerImportMutationOk(result)
    eventTeiCache.delete(trackedEntityId)
    return result
}

/** Server rule-engine errors for visit data elements during TE registration (E1301). */
export const isRegistrationRuleEngineDeError = (error) => {
    const detail = error?.details?.response ?? error?.details ?? error
    const msgs = collectTrackerImportErrorMessages(detail)
    if (msgs.length === 0 && error?.message) {
        msgs.push(String(error.message))
    }
    return msgs.some(
        (m) =>
            /Mandatory DataElement/i.test(m) &&
            /program rule/i.test(m)
    )
}

export const registerTei = async ({
    engine,
    orgUnit,
    program,
    trackedEntityType,
    attributes,
    enrollmentDate,
    incidentDate,
}) => {
    const normEnrollmentDate = enrollmentDate || new Date().toISOString().slice(0, 10)
    const normIncidentDate = incidentDate || normEnrollmentDate
    const trackerMutation = {
        resource: 'tracker',
        type: 'create',
        params: {
            async: false,
            importStrategy: 'CREATE',
            // Profile registration has no visit dataValues; client rules already ran on attributes.
            skipRuleEngine: true,
        },
        data: {
            trackedEntities: [{
                attributes,
                enrollments: [{
                    orgUnit,
                    program,
                    enrolledAt: normEnrollmentDate,
                    occurredAt: normIncidentDate,
                }],
                orgUnit,
                trackedEntityType,
            }],
        },
    }
    const legacyMutation = {
        resource: 'trackedEntityInstances',
        type: 'create',
        data: {
            attributes,
            enrollments: [{
                orgUnit,
                program,
                enrollmentDate: normEnrollmentDate,
                incidentDate: normIncidentDate,
            }],
            orgUnit,
            trackedEntityType,
        },
    }

    try {
        const result = await engine.mutate(trackerMutation)
        assertTrackerImportMutationOk(result)
        return result
    } catch (error) {
        // Do not fall back on 403: legacy TEI create has no skipRuleEngine and reproduces
        // "Mandatory DataElement … is not present" for stage fields (production vs local).
        if (!is404(error)) {
            throw error
        }
        const result = await engine.mutate(legacyMutation)
        assertTrackerImportMutationOk(result)
        return result
    }
}

export const createEnrollment = async ({ engine, teiId, orgUnit, program }) => {
    return mutateWithFallback({
        engine,
        primary: {
            resource: 'tracker/enrollments',
            type: 'create',
            data: {
                trackedEntity: teiId,
                orgUnit,
                program,
                enrollmentDate: new Date().toISOString().slice(0, 10),
                incidentDate: new Date().toISOString().slice(0, 10),
            },
        },
        fallback: {
            resource: 'enrollments',
            type: 'create',
            data: {
                trackedEntityInstance: teiId,
                orgUnit,
                program,
                enrollmentDate: new Date().toISOString().slice(0, 10),
                incidentDate: new Date().toISOString().slice(0, 10),
            },
        },
    })
}

export const createEvent = async ({ engine, enrollmentId, orgUnit, program, stage, dataValues, date, status = 'ACTIVE' }) => {
    const eventDate = normalizeEventApiDate(date)
    const completed = status === 'COMPLETED'
    const completedOn = completionApiDate()
    const completionTracker = completed ? { completedAt: completedOn } : { completedAt: null }
    const completionLegacy = completed ? { completedDate: completedOn } : { completedDate: null }
    return mutateWithFallback({
        engine,
        primary: {
            resource: 'tracker',
            type: 'create',
            params: {
                async: false,
            },
            data: {
                events: [{
                    enrollment: enrollmentId,
                    orgUnit,
                    program,
                    programStage: stage,
                    occurredAt: eventDate,
                    status,
                    ...completionTracker,
                    dataValues,
                }]
            },
        },
        fallback: {
            resource: 'events',
            type: 'create',
            data: {
                enrollment: enrollmentId,
                orgUnit,
                program,
                programStage: stage,
                eventDate: eventDate,
                status,
                ...completionLegacy,
                dataValues,
            },
        },
    })
}

/**
 * Legacy event update (`PUT /api/events/{id}`) — same path as tracker_npd `DHIS2EventFactory.update`.
 * Use for complete/incomplete toggles so HIDEFIELD-hidden mandatory DEs are not required in the payload.
 */
export const updateEventLegacy = async ({
    engine,
    eventId,
    enrollmentId,
    orgUnit,
    program,
    stage,
    dataValues,
    date,
    status = 'ACTIVE',
    trackedEntity,
}) => {
    const eventDate = normalizeEventApiDate(date)
    const completed = status === 'COMPLETED'
    const completedOn = completionApiDate()
    const teiRef = trackedEntity || undefined
    const data = {
        event: eventId,
        enrollment: enrollmentId,
        orgUnit,
        program,
        programStage: stage,
        eventDate,
        status,
        ...(completed ? { completedDate: completedOn } : { completedDate: null }),
    }
    if (teiRef) {
        data.trackedEntity = teiRef
        data.trackedEntityInstance = teiRef
    }
    if (dataValues !== undefined) {
        data.dataValues = dataValues
    }
    const result = await engine.mutate({
        resource: `events/${eventId}`,
        type: 'update',
        data,
    })
    assertLegacyEventMutationOk(result)
    return result
}

export const updateEvent = async ({
    engine,
    eventId,
    enrollmentId,
    orgUnit,
    program,
    stage,
    dataValues,
    date,
    status = 'ACTIVE',
}) => {
    const eventDate = normalizeEventApiDate(date)
    const completed = status === 'COMPLETED'
    const completedOn = completionApiDate()
    const completionTracker = completed ? { completedAt: completedOn } : { completedAt: null }
    const completionLegacy = completed ? { completedDate: completedOn } : { completedDate: null }
    const trackerEvent = {
        event: eventId,
        enrollment: enrollmentId,
        orgUnit,
        program,
        programStage: stage,
        occurredAt: eventDate,
        status,
        ...completionTracker,
    }
    const legacyEvent = {
        enrollment: enrollmentId,
        orgUnit,
        program,
        programStage: stage,
        eventDate,
        status,
        ...completionLegacy,
    }
    if (dataValues !== undefined) {
        trackerEvent.dataValues = dataValues
        legacyEvent.dataValues = dataValues
    }
    const trackerMutation = {
        resource: 'tracker',
        type: 'create',
        params: {
            async: false,
            importStrategy: 'UPDATE',
            // Client validates visible fields + omitted-compulsory placeholders before complete.
            ...(completed ? { skipRuleEngine: true } : {}),
        },
        data: {
            events: [trackerEvent],
        },
    }
    // Completing via legacy /events has no skipRuleEngine → program-rule mandatory DE errors.
    if (completed) {
        const result = await engine.mutate(trackerMutation)
        assertTrackerImportMutationOk(result)
        return result
    }
    const result = await mutateWithFallback({
        engine,
        primary: trackerMutation,
        fallback: {
            resource: `events/${eventId}`,
            type: 'update',
            data: legacyEvent,
        },
    })
    assertTrackerImportMutationOk(result)
    return result
}

/**
 * Approve (complete) a tracker event — same path as form "Mark Complete".
 */
export const approveEvent = async (args) =>
    updateEvent({ ...args, status: 'COMPLETED' })

/**
 * Reopen a completed tracker event.
 */
export const unapproveEvent = async ({ status = 'ACTIVE', ...args }) =>
    updateEvent({ ...args, status })

/**
 * Complete (approve) an enrollment via tracker import; legacy PUT fallback.
 */
const enrollmentStatusMutation = async ({
    engine,
    enrollmentId,
    program,
    trackedEntity,
    orgUnit,
    status,
}) => {
    const trackerPayload = {
        resource: 'tracker',
        type: 'create',
        params: {
            async: false,
            importStrategy: 'UPDATE',
        },
        data: {
            enrollments: [
                {
                    enrollment: enrollmentId,
                    program,
                    trackedEntity,
                    orgUnit,
                    status,
                },
            ],
        },
    }
    try {
        const result = await engine.mutate(trackerPayload)
        assertTrackerImportMutationOk(result)
        return result
    } catch (error) {
        if (!is404(error)) throw error
        const legacy =
            status === 'COMPLETED'
                ? {
                      resource: `enrollments/${enrollmentId}/completed`,
                      type: 'update',
                      data: {},
                  }
                : {
                      resource: `enrollments/${enrollmentId}/completed`,
                      type: 'delete',
                  }
        return engine.mutate(legacy)
    }
}

export const completeEnrollment = (args) =>
    enrollmentStatusMutation({ ...args, status: 'COMPLETED' })

export const reopenEnrollment = (args) =>
    enrollmentStatusMutation({ ...args, status: 'ACTIVE' })

export const deleteEvent = async ({ engine, eventId }) => {
    const runLegacyEventDelete = () =>
        engine.mutate({
            resource: `events/${eventId}`,
            type: 'delete',
        })

    try {
        const result = await engine.mutate({
            resource: 'tracker',
            type: 'create',
            params: {
                async: false,
                importStrategy: 'DELETE',
                skipRuleEngine: true,
            },
            data: {
                events: [{ event: eventId }],
            },
        })
        assertTrackerImportDeleteOk(result)
        return result
    } catch (error) {
        if (!is404(error)) {
            throw error
        }
        return runLegacyEventDelete()
    }
}

/**
 * Soft-deletes a tracked entity via tracker import (sets deleted=true; recoverable in Trash).
 * Falls back to legacy DELETE /trackedEntityInstances/{id} only when tracker import is missing (404).
 * @param {{ engine: unknown, trackedEntityId: string, programId?: string, orgUnitId?: string, trackedEntityType?: string }} args
 */
export const deleteTrackedEntity = async ({
    engine,
    trackedEntityId,
    programId,
    orgUnitId,
    trackedEntityType,
}) => {
    const tePayload = {
        trackedEntity: trackedEntityId,
        ...(orgUnitId ? { orgUnit: orgUnitId } : {}),
        ...(trackedEntityType ? { trackedEntityType: trackedEntityType } : {}),
    }

    const runLegacyInstanceDelete = () =>
        engine.mutate({
            resource: `trackedEntityInstances/${trackedEntityId}`,
            type: 'delete',
            params: mergeLocaleParams({
                ...(programId ? { program: programId } : {}),
            }),
        })

    try {
        const result = await engine.mutate({
            resource: 'tracker',
            type: 'create',
            params: mergeLocaleParams({
                async: false,
                importStrategy: 'DELETE',
            }),
            data: {
                trackedEntities: [tePayload],
            },
        })
        assertTrackerImportDeleteOk(result)
        return result
    } catch (error) {
        if (!is404(error)) {
            throw error
        }
        return runLegacyInstanceDelete()
    }
}

/** Fields for `GET programRules` — must stay in sync with `ruleEngine.js` / `metadataService.js`. */
const PROGRAM_RULE_FIELDS = [
    'id',
    'name',
    'priority',
    'condition',
    'program[id]',
    'programStage[id]',
    'programRuleActions[id,programRuleActionType,data,content,displayContent,programStage[id],programStageSection[id],dataElement[id],trackedEntityAttribute[id],option[id,code,name],optionGroup[id]]',
].join(',')

const programMetadataCache = new Map()
const orgUnitsCache = new Map()
const programsCache = new Map()

export const clearTrackerMetadataCache = () => {
    programMetadataCache.clear()
    orgUnitsCache.clear()
    programsCache.clear()
}

/**
 * Single program metadata load for UI + client program rules.
 * Targets DHIS2 2.40.x (including 2.40.5): use Web API 40 (`REACT_APP_DHIS2_API_VERSION=40`).
 * On 2.40.x, `GET programs/{id}` does not embed `programRules`; rules are loaded from
 * `GET programRules?filter=program.id:eq:{id}` in parallel with the program payload.
 */
export const fetchProgramMetadata = async ({ engine, programId, translate, locale, forceRefresh = false } = {}) => {
    if (!programId) return null
    const cacheKey = `${programId}:${locale || ''}:${translate !== undefined ? translate : ''}`
    if (!forceRefresh && programMetadataCache.has(cacheKey)) {
        return programMetadataCache.get(cacheKey)
    }

    const promise = (async () => {
        const response = await engine.query({
            program: {
                resource: `programs/${programId}`,
                params: mergeLocaleParams({
                    fields: [
                        'id',
                        'name',
                        'displayName',
                        'trackedEntityType[id]',
                        'programTrackedEntityAttributes[trackedEntityAttribute[id,name,shortName,displayName,valueType,pattern,access,optionSet[id,options[id,name,code,displayName]]],mandatory,sortOrder,renderOptionsAsRadio,renderType]',
                        'programSections[id,name,displayName,description,sortOrder,formName,trackedEntityAttributes[id]]',
                        'programStages[id,name,displayName,sortOrder,programStageDataElements[compulsory,sortOrder,renderOptionsAsRadio,renderType,dataElement[id,name,displayName,valueType,pattern,optionSet[id,options[id,name,code,displayName]]]],programStageSections[id,name,displayName,description,formName,sortOrder,dataElements[id,name,displayName,valueType,pattern,optionSet[id,options[id,name,code,displayName]]]]]',
                        'programRuleVariables[id,name,displayName,programRuleVariableSourceType,useCodeForOptionSet,valueType,dataElement[id],trackedEntityAttribute[id],programStage[id]]',
                    ],
                }, { translate, locale }),
            },
            programRules: {
                resource: 'programRules',
                params: mergeLocaleParams({
                    program: programId,
                    fields: PROGRAM_RULE_FIELDS,
                    paging: false,
                }, { translate, locale }),
            },
            programRuleVariables: {
                resource: 'programRuleVariables',
                params: mergeLocaleParams({
                    program: programId,
                    fields: 'id,name,displayName,programRuleVariableSourceType,useCodeForOptionSet,valueType,dataElement[id],trackedEntityAttribute[id],programStage[id]',
                    paging: false,
                }, { translate, locale }),
            },
        })

        const program = response.program || {}
        const rulesPayload = response.programRules
        const programRules = Array.isArray(rulesPayload)
            ? rulesPayload
            : rulesPayload?.programRules || []
        const varsPayload = response.programRuleVariables
        const programRuleVariables = Array.isArray(varsPayload)
            ? varsPayload
            : varsPayload?.programRuleVariables || program.programRuleVariables || []

        return {
            ...program,
            programRules,
            programRuleVariables,
        }
    })().catch((err) => {
        programMetadataCache.delete(cacheKey)
        throw err
    })

    programMetadataCache.set(cacheKey, promise)
    return promise
}

export const fetchOrganisationUnit = async ({ engine, id }) => {
    if (!id) return null
    try {
        const response = await engine.query({
            ou: {
                resource: 'organisationUnits',
                id,
                params: mergeLocaleParams({
                    fields: 'id,name,displayName,code,level',
                }),
            },
        })
        return response?.ou || null
    } catch {
        try {
            const fallback = await engine.query({
                ou: {
                    resource: `organisationUnits/${id}`,
                    params: mergeLocaleParams({
                        fields: 'id,name,displayName,code',
                    }),
                },
            })
            return fallback?.ou || null
        } catch {
            return null
        }
    }
}

export const fetchOrgUnits = async ({ engine, forceRefresh = false } = {}) => {
    const cacheKey = `orgUnits:${i18n.language || ''}`
    if (!forceRefresh && orgUnitsCache.has(cacheKey)) {
        return orgUnitsCache.get(cacheKey)
    }

    const promise = (async () => {
        const response = await engine.query({
            me: {
                resource: 'me',
                params: mergeLocaleParams({
                    fields: 'organisationUnits[id,name,displayName,path,level,parent[id]]',
                }),
            },
        })
        const assignedOrgUnits = response.me?.organisationUnits || []
        if (!assignedOrgUnits.length) {
            return []
        }

        const rootsWithPath = assignedOrgUnits.filter((ou) => ou.path)
        if (!rootsWithPath.length) {
            return assignedOrgUnits
        }

        const descendants = await Promise.all(
            rootsWithPath.map(async (root) => {
                const result = await engine.query({
                    units: {
                        resource: 'organisationUnits',
                        params: mergeLocaleParams({
                            fields: 'id,name,displayName,path,level,parent[id]',
                            filter: `path:like:${root.path}`,
                            pageSize: 1000,
                        }),
                    },
                })
                return result.units?.organisationUnits || []
            })
        )

        const byId = new Map()
        for (const root of assignedOrgUnits) {
            byId.set(root.id, root)
        }
        for (const group of descendants) {
            for (const ou of group) {
                byId.set(ou.id, ou)
            }
        }

        return Array.from(byId.values()).sort((a, b) => {
            if ((a.level || 0) !== (b.level || 0)) {
                return (a.level || 0) - (b.level || 0)
            }
            const la = (a.displayName && String(a.displayName).trim()) || a.name || ''
            const lb = (b.displayName && String(b.displayName).trim()) || b.name || ''
            return la.localeCompare(lb)
        })
    })().catch((err) => {
        orgUnitsCache.delete(cacheKey)
        throw err
    })

    orgUnitsCache.set(cacheKey, promise)
    return promise
}

export const fetchPrograms = async ({ engine, forceRefresh = false } = {}) => {
    const cacheKey = `programs:${i18n.language || ''}`
    if (!forceRefresh && programsCache.has(cacheKey)) {
        return programsCache.get(cacheKey)
    }

    const promise = (async () => {
        const response = await engine.query({
            programs: {
                resource: 'programs',
                params: mergeLocaleParams({
                    fields: 'id,name,displayName,trackedEntityType[id],organisationUnits[id,path]',
                    filter: 'programType:eq:WITH_REGISTRATION',
                    pageSize: 100,
                }),
            },
        })
        return response.programs?.programs || []
    })().catch((err) => {
        programsCache.delete(cacheKey)
        throw err
    })

    programsCache.set(cacheKey, promise)
    return promise
}

