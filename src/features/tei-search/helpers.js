import i18n from '@dhis2/d2-i18n'
import { trackedEntityAttributeIdFromEntry } from '../../utils/trackerMappers'

export const getEnrollmentForProgram = (tei, programId) => {
    if (!tei?.enrollments) return null
    if (!programId) return tei.enrollments[0] || null
    return tei.enrollments.find((e) => e.program === programId) || tei.enrollments[0] || null
}

/** Column header: localized DHIS2 `displayName` (see `mergeLocaleParams` + `translate`). */
export const getColumnHeaderLabel = (col) => col?.name || col?.id || ''

export const getAttributeValue = (tei, attributeId) =>
    tei?.attributes?.find((item) => trackedEntityAttributeIdFromEntry(item) === attributeId)?.value || '-'

export const findEnrollmentForEvent = (tei, event, programId) => {
    const eventId = event?.event
    if (!eventId) return getEnrollmentForProgram(tei, programId)
    const match = (tei?.enrollments || []).find((enr) =>
        (enr.events || []).some((e) => e.event === eventId)
    )
    return match || getEnrollmentForProgram(tei, programId)
}


export const getTeiEnrollmentStatus = (tei, programId) => {
    const enrollment = getEnrollmentForProgram(tei, programId)
    return enrollment?.status ? String(enrollment.status).toUpperCase() : null
}

export const getLatestEventForProgram = (tei, programId) => {
    const enrollment = getEnrollmentForProgram(tei, programId)
    const events = [...(enrollment?.events || [])].sort(
        (a, b) =>
            new Date(b.eventDate || b.occurredAt || b.createdAt || 0) -
            new Date(a.eventDate || a.occurredAt || a.createdAt || 0)
    )
    return events[0] || null
}

export const getTeiLatestVisitStatus = (tei, programId) => {
    const latest = getLatestEventForProgram(tei, programId)
    if (!latest) {
        return { status: null, hasEvents: false }
    }
    return {
        status: latest.status ? String(latest.status).toUpperCase() : null,
        hasEvents: true,
    }
}

export const enrollmentStatusLabel = (status) => {
    const code = String(status || '').toUpperCase()
    switch (code) {
        case 'COMPLETED':
            return i18n.t('បានបញ្ចប់')
        case 'ACTIVE':
            return i18n.t('សកម្ម')
        case 'CANCELLED':
            return i18n.t('បានបោះបង់')
        default:
            return code ? code : i18n.t('មិនទាន់បានចុះឈ្មោះ')
    }
}

export const eventStatusLabel = (status) => {
    const code = String(status || '').toUpperCase()
    switch (code) {
        case 'COMPLETED':
            return i18n.t('បានបញ្ចប់')
        case 'ACTIVE':
            return i18n.t('សកម្ម')
        case 'SCHEDULE':
        case 'SCHEDULED':
            return i18n.t('បានកំណត់ពេល')
        case 'SKIPPED':
            return i18n.t('បានរំលង')
        case 'OVERDUE':
            return i18n.t('ហួសកាលកំណត់')
        default:
            return code || '-'
    }
}

export const getLatestEventDate = (tei) => {
    if (!tei?.enrollments) return null
    const allEvents = tei.enrollments.flatMap(enr => enr.events || [])
    if (allEvents.length === 0) return null
    const dates = allEvents
        .map(e => e.eventDate || e.occurredAt || e.updatedAt || e.createdAt)
        .filter(Boolean)
        .map(d => new Date(d).getTime())
        .filter(t => !isNaN(t))
    if (dates.length === 0) return null
    return new Date(Math.max(...dates)).toISOString().split('T')[0]
}

/**
 * Returns the most recent activity or update date for a TEI.
 * Considers TEI timestamps, all enrollment dates/timestamps, and all event dates/timestamps.
 * This guarantees the date reflects the true latest update and won't be older than the enrollment date.
 */
export const getRecentlyUpdatedDate = (tei) => {
    if (!tei) return '-'
    const candidates = []

    const pushCandidate = (raw) => {
        if (!raw) return
        const time = new Date(raw).getTime()
        if (!isNaN(time)) {
            candidates.push({ raw: String(raw).split('T')[0], time })
        }
    }

    pushCandidate(tei.updatedAt)
    pushCandidate(tei.lastUpdated)
    pushCandidate(tei.createdAt)
    pushCandidate(tei.created)

    if (Array.isArray(tei.enrollments)) {
        for (const enr of tei.enrollments) {
            pushCandidate(enr.enrolledAt)
            pushCandidate(enr.enrollmentDate)
            pushCandidate(enr.incidentDate)
            pushCandidate(enr.occurredAt)
            pushCandidate(enr.updatedAt)
            pushCandidate(enr.lastUpdated)
            pushCandidate(enr.createdAt)

            if (Array.isArray(enr.events)) {
                for (const evt of enr.events) {
                    pushCandidate(evt.eventDate)
                    pushCandidate(evt.occurredAt)
                    pushCandidate(evt.updatedAt)
                    pushCandidate(evt.lastUpdated)
                    pushCandidate(evt.createdAt)
                }
            }
        }
    }

    if (candidates.length === 0) return '-'
    candidates.sort((a, b) => b.time - a.time)
    return candidates[0].raw
}


/**
 * Resolve a column value from a TEI.
 * - 'attr' columns → read from tei.attributes
 * - 'de' columns  → read from the most recent event's dataValues
 */
export const getColumnValue = (tei, col) => {
    if (col.type === 'attr') {
        return getAttributeValue(tei, col.id)
    }
    const allEvts = tei.enrollments?.flatMap(enr => enr.events || []) || []
    const sorted = [...allEvts].sort(
        (a, b) =>
            new Date(b.eventDate || b.occurredAt || b.createdAt || 0) -
            new Date(a.eventDate || a.occurredAt || a.createdAt || 0)
    )
    for (const evt of sorted) {
        const dv = evt.dataValues?.find(d => d.dataElement === col.id)
        if (dv?.value !== undefined && dv.value !== null && dv.value !== '') return String(dv.value)
    }
    return '-'
}

export const isEmptyColumnValue = (value) =>
    value == null || String(value).trim() === '' || value === '-'

/**
 * Best label for a TEI in the events worklist (first filled visible attr, then any program attr).
 */
export const getEventClientLabel = (tei, visibleColumns, programAttributes, getColumnValueFn) => {
    const { title, subtitle } = getMobileCardLines(tei, visibleColumns, getColumnValueFn)
    if (!isEmptyColumnValue(title)) return title
    if (!isEmptyColumnValue(subtitle)) return subtitle

    for (const attr of programAttributes || []) {
        const value = getAttributeValue(tei, attr.id)
        if (!isEmptyColumnValue(value)) return value
    }

    const anyAttr = (tei?.attributes || []).find(
        (item) => item?.value != null && String(item.value).trim() !== ''
    )
    if (anyAttr?.value != null) return String(anyAttr.value)

    if (tei?.trackedEntity) {
        return tei.trackedEntity
    }

    return null
}

/**
 * Mobile card title/subtitle — same column order as the worklist table (`visibleColumns`),
 * preferring the first attributes that actually have values (avoids "–" when UUIC/name are later).
 */
export const getMobileCardLines = (tei, visibleColumns, getColumnValueFn) => {
    const attrCols = (visibleColumns || []).filter((c) => c.type === 'attr')
    if (!attrCols.length) {
        return { title: '-', subtitle: null }
    }

    const filled = attrCols
        .map((col) => ({ col, value: getColumnValueFn(tei, col) }))
        .filter(({ value }) => !isEmptyColumnValue(value))

    const title = filled[0]?.value ?? getColumnValueFn(tei, attrCols[0])
    const subtitleCandidate =
        filled[1]?.value ?? (attrCols[1] ? getColumnValueFn(tei, attrCols[1]) : null)
    const subtitle =
        !isEmptyColumnValue(subtitleCandidate) && subtitleCandidate !== title
            ? subtitleCandidate
            : null

    return {
        title: isEmptyColumnValue(title) ? '-' : title,
        subtitle,
    }
}
