import React, { useEffect, useMemo, useState } from 'react'
import i18n from '@dhis2/d2-i18n'
import { useDataEngine } from '@dhis2/app-runtime'
import { createEvent, fetchProgramMetadata, updateEvent } from '../../services/trackerApi'
import { normalizeProgramMetadata } from '../../services/metadataService'
import { useProgramRules } from '../../hooks/useProgramRules'
import { trackedEntityAttributeIdFromEntry } from '../../utils/trackerMappers'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { Alert } from '../../components/ui/alert'
import { Spinner } from '../../components/ui/spinner'
import { Pencil2Icon } from '@radix-ui/react-icons'
import { CheckCircle2, Circle } from 'lucide-react'
import { cn } from '../../lib/utils'
import { shouldOmitStageDataElementRow } from '../../lib/trackerProgramRuleFieldUi'
import { applyRuleAssignedValues } from '../../lib/programRuleFormSync'

const valueFromEvent = (event, dataElementId) =>
    event?.dataValues?.find((dv) => dv.dataElement === dataElementId)?.value || ''

const normalizeLoadedEventStatus = (raw) => {
    const up = raw != null ? String(raw).toUpperCase().trim() : ''
    if (up === 'COMPLETED') return 'COMPLETED'
    if (['ACTIVE', 'VISITED', 'SCHEDULE', 'OVERDUE', 'SKIPPED'].includes(up)) return up
    return 'ACTIVE'
}

export const EventEditor = ({ context, selectedTei, selectedEnrollment, selectedStage }) => {
    const engine = useDataEngine()
    const [metadata, setMetadata] = useState(null)
    const [formValues, setFormValues] = useState({})
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState('')
    const [eventStatus, setEventStatus] = useState('ACTIVE')

    const existingEvent = useMemo(
        () =>
            (selectedEnrollment.events || []).find((event) => event.programStage === selectedStage.id),
        [selectedEnrollment.events, selectedStage.id]
    )

    useEffect(() => {
        const run = async () => {
            try {
                setLoading(true)
                const program = await fetchProgramMetadata({ engine, programId: context.program })
                const normalized = normalizeProgramMetadata(program)
                setMetadata(normalized)

                const nextValues = {}
                for (const de of selectedStage.dataElements) {
                    nextValues[de.id] = valueFromEvent(existingEvent, de.id)
                }
                setFormValues(nextValues)
                setEventStatus(normalizeLoadedEventStatus(existingEvent?.status))
            } catch (e) {
                setError(e.message || 'Failed to initialize event editor')
            } finally {
                setLoading(false)
            }
        }
        run()
    }, [context.program, engine, selectedEnrollment.events, selectedStage, existingEvent])

    const teiAttributes = useMemo(() => {
        const m = {}
        for (const a of selectedTei?.attributes || []) {
            const id = trackedEntityAttributeIdFromEntry(a)
            if (id) m[id] = a.value
        }
        return m
    }, [selectedTei])

    const ruleFormValues = useMemo(() => ({ ...teiAttributes, ...formValues }), [teiAttributes, formValues])

    const ruleVarContext = useMemo(
        () => ({
            enrollmentEvents: selectedEnrollment.events || [],
            currentEventId: existingEvent?.event || null,
            currentProgramStageId: selectedStage.id,
            evaluatingDraftEvent: !existingEvent?.event,
            eventStatusOverride: existingEvent?.event ? eventStatus : null,
        }),
        [selectedEnrollment.events, existingEvent?.event, selectedStage.id, eventStatus]
    )

    const dhis2Context = useMemo(() => {
        if (!selectedEnrollment || !selectedTei) return null
        return {
            enrollment: selectedEnrollment,
            tei: selectedTei,
            programName: metadata?.name || '',
        }
    }, [selectedEnrollment, selectedTei, metadata?.name])

    const { hiddenFields, mandatoryFieldIds, assignedValues } = useProgramRules(metadata, ruleFormValues, {
        programStageId: selectedStage.id,
        ruleVarContext,
        dhis2Context,
    })

    const mandatory = useMemo(() => {
        const o = {}
        for (const id of mandatoryFieldIds) o[id] = true
        return o
    }, [mandatoryFieldIds])

    const assignedKey = useMemo(() => JSON.stringify(assignedValues), [assignedValues])

    useEffect(() => {
        if (assignedKey === '{}') return
        const parsed = JSON.parse(assignedKey)
        const deMap = metadata?.dataElements || {}

        setFormValues((prev) => applyRuleAssignedValues(prev, parsed, { dataElements: deMap }))
    }, [assignedKey, metadata?.attributes, metadata?.dataElements])

    const validate = () => {
        for (const de of selectedStage.dataElements) {
            if (shouldOmitStageDataElementRow(hiddenFields, de.id, formValues[de.id])) {
                continue
            }
            const mandatoryDe = de.compulsory || mandatory[de.id]
            if (mandatoryDe && !formValues[de.id]) {
                return `${de.name} is required`
            }
        }
        return ''
    }

    const onSave = async () => {
        try {
            setSaving(true)
            setSuccess('')
            const validationError = validate()
            if (validationError) {
                setError(validationError)
                return
            }
            setError('')

            const dataValues = Object.entries(formValues)
                .filter(
                    ([dataElement, v]) =>
                        !shouldOmitStageDataElementRow(hiddenFields, dataElement, v)
                )
                .map(([dataElement, value]) => ({
                    dataElement,
                    value: value ?? '',
                }))
            const eventDate = existingEvent?.occurredAt || existingEvent?.eventDate || undefined
            if (existingEvent?.event) {
                await updateEvent({
                    engine,
                    eventId: existingEvent.event,
                    enrollmentId: selectedEnrollment.enrollment,
                    orgUnit: context.orgUnit,
                    program: context.program,
                    stage: selectedStage.id,
                    dataValues,
                    date: eventDate,
                    status: eventStatus,
                })
            } else {
                await createEvent({
                    engine,
                    enrollmentId: selectedEnrollment.enrollment,
                    orgUnit: context.orgUnit,
                    program: context.program,
                    stage: selectedStage.id,
                    dataValues,
                    status: eventStatus,
                })
            }
            setSuccess('Event saved successfully')
        } catch (e) {
            setError(e.message || 'Save failed')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return <Spinner />
    }

    const stageFormReadOnly = eventStatus === 'COMPLETED'

    return (
        <Card className="mt-8 border-0 shadow-premium bg-white/80 backdrop-blur-sm overflow-hidden rounded-[24px]">
            <CardHeader className="px-8 pt-8 pb-4 border-b border-slate-100/50 bg-[#fbfcfd]/50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-white shadow-lg shadow-slate-800/20">
                            <Pencil2Icon className="w-5 h-5" />
                        </div>
                        <CardTitle className="text-xl font-bold tracking-tight text-slate-800">
                            Event editor: <span className="text-slate-500 font-medium">{selectedStage.name}</span>
                        </CardTitle>
                    </div>
                    <button
                        type="button"
                        title={eventStatus === 'COMPLETED' ? 'Completed' : 'Mark complete'}
                        aria-pressed={eventStatus === 'COMPLETED'}
                        onClick={() =>
                            setEventStatus((prev) => (prev === 'COMPLETED' ? 'VISITED' : 'COMPLETED'))
                        }
                        disabled={saving}
                        className={cn(
                            'inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors',
                            eventStatus === 'COMPLETED'
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                : 'border-slate-200 bg-white text-slate-500'
                        )}
                    >
                        {eventStatus === 'COMPLETED' ? (
                            <CheckCircle2 className="h-5 w-5" strokeWidth={2} aria-hidden />
                        ) : (
                            <Circle className="h-5 w-5" strokeWidth={2} aria-hidden />
                        )}
                    </button>
                </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-8 p-8">
                {error ? <Alert variant="destructive" title="Validation/API error" className="rounded-xl border-red-100 bg-red-50/50">{error}</Alert> : null}
                {success ? <Alert title="Saved" className="rounded-xl border-emerald-100 bg-emerald-50/50 text-emerald-800 font-bold">{success}</Alert> : null}

                {stageFormReadOnly ? (
                    <Alert title="Read-only" className="rounded-xl border-emerald-100 bg-emerald-50/50 text-emerald-900">
                        {i18n.t(
                            'Fields are locked while this visit is complete. Use the status button to mark incomplete before editing.'
                        )}
                    </Alert>
                ) : null}

                <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
                    {selectedStage.dataElements.map((de) => {
                        if (shouldOmitStageDataElementRow(hiddenFields, de.id, formValues[de.id])) {
                            return null
                        }
                        const mandatoryDe = de.compulsory || mandatory[de.id]
                        return (
                            <div className="flex flex-col gap-2" key={de.id}>
                                <label className="flex items-center justify-between px-1">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500/80">
                                        {de.name}
                                    </span>
                                    {mandatoryDe && (
                                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest bg-red-50 px-1.5 py-0.5 rounded">
                                            Required
                                        </span>
                                    )}
                                </label>
                                <Input
                                    required={mandatoryDe}
                                    value={formValues[de.id] || ''}
                                    placeholder={`Enter ${de.name.toLowerCase()}...`}
                                    className="h-11 bg-slate-50/50 border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-slate-800/5 transition-all text-sm font-medium shadow-sm"
                                    disabled={stageFormReadOnly}
                                    onChange={(e) =>
                                        setFormValues((prev) => ({
                                            ...prev,
                                            [de.id]: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                        )
                    })}
                </div>

                <div className="flex justify-start border-t border-slate-100/50 pt-6">
                    <Button
                        type="button"
                        variant="primary"
                        onClick={onSave}
                        disabled={saving}
                        className="px-10 h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold tracking-wide rounded-xl shadow-xl shadow-slate-900/10 transition-all hover:-translate-y-0.5 active:translate-y-0"
                    >
                        {saving ? (
                            <div className="flex items-center gap-2">
                                <Spinner className="w-4 h-4" />
                                <span>Saving event...</span>
                            </div>
                        ) : (
                            'Save data entry'
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
