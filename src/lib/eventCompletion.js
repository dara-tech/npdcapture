/** Tracker Capture open statuses (editable visit, not complete). */
export const OPEN_TRACKER_EVENT_STATUSES = new Set(['ACTIVE', 'VISITED', 'SCHEDULE', 'OVERDUE', 'SKIPPED'])

export const normalizeLoadedEventStatus = (raw) => {
    const up = raw != null ? String(raw).toUpperCase().trim() : ''
    if (up === 'COMPLETED') return 'COMPLETED'
    if (OPEN_TRACKER_EVENT_STATUSES.has(up)) return up
    return 'ACTIVE'
}

/** @param {{ kind?: string }[]} ruleErrors */
export const errorsBlockingSave = (ruleErrors, eventStatus) => {
    const completing = String(eventStatus || '').toUpperCase() === 'COMPLETED'
    return (ruleErrors || []).filter((e) => {
        const kind = e?.kind === 'complete' ? 'complete' : 'show'
        if (kind === 'complete') return completing
        return true
    })
}

/** All program-rule errors block marking complete (tracker `completeIncompleteEvent`). */
export const errorsBlockingComplete = (ruleErrors) => ruleErrors || []

/** Warnings shown when completing; user may still proceed in core after acknowledging. */
export const warningsOnComplete = (ruleWarnings) => ruleWarnings || []

export const getVisitFormLockReason = (eventOrStatus, eventDateOrExperience, isDataEntryExperience = false) => {
    let eventObj = null
    let status = null
    let dateVal = null
    let isDataEntry = isDataEntryExperience

    if (typeof eventOrStatus === 'object' && eventOrStatus !== null) {
        eventObj = eventOrStatus
        status = eventObj.status
        isDataEntry = Boolean(eventDateOrExperience)
    } else {
        status = eventOrStatus
        dateVal = eventDateOrExperience
    }

    // 1. Check if event is expired (> 14 days / 2 weeks old) for Data Entry users
    if (isDataEntry) {
        if (eventObj) {
            const ageInDays = getEventAgeInDays(eventObj)
            if (ageInDays > 14) return 'EXPIRED'
        } else if (dateVal) {
            const ageInDays = getEventAgeInDays({ createdAt: dateVal, eventDate: dateVal })
            if (ageInDays > 14) return 'EXPIRED'
        }
    }

    // 2. Check if completed
    if (String(status || '').toUpperCase() === 'COMPLETED') return 'COMPLETED'

    return null
}

/** Visit form is read-only until marked incomplete (DHIS2 also rejects data updates while complete) or expired. */
export const isVisitFormLocked = (eventOrStatus, eventDateOrExperience, isDataEntryExperience = false) =>
    getVisitFormLockReason(eventOrStatus, eventDateOrExperience, isDataEntryExperience) !== null

export const getEventCreationDate = (event) => {
    if (!event) return null
    return (
        event.createdAt ||
        event.created ||
        event.occurredAt ||
        event.eventDate ||
        null
    )
}

export const getEventAgeInDays = (event) => {
    const raw = getEventCreationDate(event)
    if (!raw) return 0
    try {
        const created = new Date(raw).getTime()
        if (Number.isNaN(created)) return 0
        const diffMs = Date.now() - created
        return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
    } catch {
        return 0
    }
}

export const canUserDeleteEvent = ({
    event,
    isSuperuser = false,
    isCaptureAdmin = false,
    isDataEntryExperience = false,
}) => {
    const ageInDays = getEventAgeInDays(event)
    const maxDays = 14
    const daysRemaining = Math.max(0, maxDays - ageInDays)

    // Only non-data-entry superusers/admins can bypass the 14-day window
    const isStrictAdmin = (isSuperuser || isCaptureAdmin) && !isDataEntryExperience

    if (isStrictAdmin) {
        return {
            canDelete: true,
            reason: 'ADMIN',
            ageInDays,
            daysRemaining,
            maxDays,
        }
    }

    const canDelete = ageInDays <= maxDays

    return {
        canDelete,
        reason: canDelete ? 'WITHIN_2_WEEKS' : 'EXCEEDED_2_WEEKS',
        ageInDays,
        daysRemaining,
        maxDays,
    }
}

export const getRecordAgeInDays = (rawDate) => {
    if (!rawDate) return 0
    try {
        const d = new Date(rawDate).getTime()
        if (Number.isNaN(d)) return 0
        const diffMs = Date.now() - d
        return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
    } catch {
        return 0
    }
}

/**
 * Check if a client profile / enrollment is older than 14 days for Data Entry users.
 * Super admins bypass this window.
 */
export const isProfileExpired = (enrollment, tei, isDataEntryExperience = false) => {
    if (!isDataEntryExperience) return false
    const raw =
        enrollment?.enrolledAt ||
        enrollment?.enrollmentDate ||
        enrollment?.createdAt ||
        enrollment?.created ||
        tei?.created ||
        tei?.createdAt
    if (!raw) return false
    const ageInDays = getRecordAgeInDays(raw)
    return ageInDays > 14
}

