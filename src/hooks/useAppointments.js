import { useCallback, useEffect, useRef, useState } from 'react'
import { searchTrackedEntities } from '../services/trackerApi'

// Stable empty array — prevents re-render loops when no results are passed
const EMPTY_RESULTS = []

/**
 * Identify appointment dates from events:
 * 1. Scheduled / Overdue events (dueDate, scheduledAt, scheduledDate)
 * 2. Data values containing appointment dates (e.g. Next appointment Date)
 */
function extractAppointmentInfo(tei, programId) {
    if (!tei) return null
    const enrollments = tei.enrollments || []
    const matchingEnr = programId ? enrollments.filter((e) => e.program === programId) : enrollments
    const allEvents = matchingEnr.flatMap((e) => e.events || [])

    if (allEvents.length === 0) return null

    const todayStr = new Date().toISOString().slice(0, 10)
    const todayTimestamp = new Date(todayStr).getTime()

    // Find any scheduled events first
    const scheduledEvent = allEvents.find(
        (ev) =>
            ev.status === 'SCHEDULED' ||
            ev.status === 'OVERDUE' ||
            (ev.status === 'ACTIVE' && (ev.dueDate || ev.scheduledAt))
    )

    let appointmentDateStr = null
    let targetEvent = scheduledEvent || null

    if (scheduledEvent) {
        appointmentDateStr = (
            scheduledEvent.dueDate ||
            scheduledEvent.scheduledAt ||
            scheduledEvent.scheduledDate ||
            scheduledEvent.eventDate ||
            ''
        ).slice(0, 10)
    }

    // If no scheduled event, search dataValues for appointment date strings in the latest completed/active event
    if (!appointmentDateStr) {
        const sortedEvents = [...allEvents].sort(
            (a, b) =>
                new Date(b.eventDate || b.occurredAt || b.createdAt || 0) -
                new Date(a.eventDate || a.occurredAt || a.createdAt || 0)
        )

        for (const ev of sortedEvents) {
            for (const dv of ev.dataValues || []) {
                const val = String(dv.value || '').trim()
                // Check if value matches date pattern YYYY-MM-DD
                if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
                    const dvTime = new Date(val).getTime()
                    const evTime = new Date(ev.eventDate || ev.occurredAt || 0).getTime()
                    // If the date value is in the future relative to the event date, it's a follow-up date
                    if (dvTime >= evTime) {
                        appointmentDateStr = val
                        targetEvent = ev
                        break
                    }
                }
            }
            if (appointmentDateStr) break
        }
    }

    if (!appointmentDateStr) return null

    // Check if the patient has had a completed visit ON or AFTER the appointment date
    const attendedEvent = allEvents.find((ev) => {
        const evDate = (ev.eventDate || ev.occurredAt || ev.completedAt || '').slice(0, 10)
        return ev.status === 'COMPLETED' && evDate >= appointmentDateStr
    })

    // If already attended after the appointment, this appointment is fulfilled
    if (attendedEvent) return null

    const apptTimestamp = new Date(appointmentDateStr).getTime()
    const diffDays = Math.round((todayTimestamp - apptTimestamp) / (1000 * 60 * 60 * 24))

    // Extract patient details
    const attrs = tei.attributes || []
    const getAttr = (hints) => {
        for (const a of attrs) {
            const name = String(a.displayName || a.name || '').toLowerCase()
            const code = String(a.code || '').toLowerCase()
            if (hints.some((h) => name.includes(h) || code.includes(h))) {
                return a.value
            }
        }
        return null
    }

    const name = getAttr(['name', 'ឈ្មោះ', 'client']) || attrs.map((a) => a.value).slice(0, 2).join(' ') || tei.trackedEntity
    const uuic = getAttr(['uuic'])
    const smh = getAttr(['smh'])
    const phone = getAttr(['phone', 'tel', 'ទូរស័ព្ទ', 'mobile'])

    return {
        tei,
        event: targetEvent,
        appointmentDate: appointmentDateStr,
        daysOverdue: diffDays,
        isToday: diffDays === 0,
        isMissed: diffDays > 0,
        clientName: name,
        clientUuic: uuic,
        clientSmh: smh,
        clientPhone: phone,
    }
}

export function useAppointments({ engine, context, results }) {
    // Use stable reference when no results are provided
    const stableResults = results ?? EMPTY_RESULTS

    const [loading, setLoading] = useState(false)
    const [fetchedTeis, setFetchedTeis] = useState([])
    const [todayAppointments, setTodayAppointments] = useState([])
    const [missedAppointments, setMissedAppointments] = useState([])

    // Keep latest context values in a ref so callbacks don't need context in deps
    const orgUnit = context?.orgUnit || ''
    const program = context?.program || ''
    const orgUnitRef = useRef(orgUnit)
    const programRef = useRef(program)
    useEffect(() => { orgUnitRef.current = orgUnit }, [orgUnit])
    useEffect(() => { programRef.current = program }, [program])

    const fetchAppointments = useCallback(async () => {
        const ou = orgUnitRef.current
        const prog = programRef.current
        if (!ou || !prog) {
            setTodayAppointments([])
            setMissedAppointments([])
            return
        }

        try {
            setLoading(true)
            // Fetch recent / all active TEIs in the orgUnit & program
            const { instances } = await searchTrackedEntities({
                engine,
                orgUnit: ou,
                ouMode: 'DESCENDANTS',
                program: prog,
                pageSize: 100,
                page: 1,
            })
            setFetchedTeis(instances || [])
        } catch (e) {
            console.error('Failed to load appointments', e)
        } finally {
            setLoading(false)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [engine, orgUnit, program])

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchAppointments()
        }, 800)
        return () => clearTimeout(timer)
    }, [fetchAppointments])

    useEffect(() => {
        // Pool records from both results and fetched instances
        const allPool = [...stableResults, ...(fetchedTeis || [])]
        const uniqueMap = new Map()
        for (const tei of allPool) {
            const id = tei.trackedEntity || tei.trackedEntityInstance
            if (id && !uniqueMap.has(id)) {
                uniqueMap.set(id, tei)
            }
        }

        const todayList = []
        const missedList = []
        const prog = programRef.current

        for (const tei of uniqueMap.values()) {
            const info = extractAppointmentInfo(tei, prog)
            if (info) {
                if (info.isToday) {
                    todayList.push(info)
                } else if (info.isMissed) {
                    missedList.push(info)
                }
            }
        }

        // Sort today list by name
        todayList.sort((a, b) => String(a.clientName).localeCompare(String(b.clientName)))
        // Sort missed list by most overdue first
        missedList.sort((a, b) => b.daysOverdue - a.daysOverdue)

        setTodayAppointments(todayList)
        setMissedAppointments(missedList)
    // stableResults is stable when no results passed; program read via ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stableResults, fetchedTeis, program])

    return {
        todayAppointments,
        missedAppointments,
        todayCount: todayAppointments.length,
        missedCount: missedAppointments.length,
        totalAppointmentsCount: todayAppointments.length + missedAppointments.length,
        loading,
        refetch: fetchAppointments,
    }
}
