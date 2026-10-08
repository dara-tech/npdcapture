import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useConfig, useDataEngine } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import {
    fetchProgramMetadata,
    fetchTei,
    createEvent,
    updateEvent,
    updateEventLegacy,
    updateTrackedEntity,
    deleteEvent,
    deleteTrackedEntity,
    formatTrackerMutateError,
    extractTrackerMutationReference,
} from '../../services/trackerApi'
import { normalizeProgramMetadata } from '../../services/metadataService'
import { Spinner } from '../../components/ui/spinner'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { DatePicker } from '../../components/ui/date-picker'
import { OptionSetValueControl, BooleanValueControl } from '../../components/ui/stage-data-element-controls'
import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons'
import { Trash2, AlertTriangle, Calendar, Clock, ShieldAlert, Timer, CheckCircle2 } from 'lucide-react'
import { useProgramRules } from '../../hooks/useProgramRules'
import { evaluateRules } from '../../services/ruleEngine'
import { getInputTypeForValueType, validateFieldValue, patternForHtmlInput } from '../../lib/fieldValidation'
import {
    errorsBlockingComplete,
    errorsBlockingSave,
    isVisitFormLocked,
    normalizeLoadedEventStatus,
    OPEN_TRACKER_EVENT_STATUSES,
    warningsOnComplete,
    getVisitFormLockReason,
    getEventCreationDate,
    getEventAgeInDays,
    canUserDeleteEvent,
    isProfileExpired,
} from '../../lib/eventCompletion'
import {
    FORM,
    captureFieldDomId,
    formControlClasses,
    formControlPaperClasses,
    formControlPaperInlineClasses,
    formControlMedicineClasses,
} from '../../lib/formUi'
import { stageOptionFieldUsesChoiceGrid } from '../../lib/stageFieldRender'
import {
    countPaperSectionSelected,
    fieldUsesToggleRowLayout,
    fieldUsesPillBelowTitleLayout,
    isPaperSymptomPillField,
    mergeStageDataElement,
    paperFieldUsesPillBelowTitle,
    isPaperChecklistMultiField,
    isPaperInlineTextField,
    isToggleFieldActive,
    isToggleStyleField,
    resolveStageSectionGate,
    resolveStageSectionBodyFields,
    isCounsellingAdviceSection,
    isCounsellingAdviceYesNoField,
    sectionResolvesHeaderBooleanGate,
    applySectionGateDefaults,
    sectionUsesHeaderBooleanGate,
    resolveSectionPaperGridClass,
    sectionUsesPaperGrid,
    sectionUsesLabTestChecklistLayout,
} from '../../lib/stageFieldLayout'
import { cn, decodeBasicHtmlEntities } from '../../lib/utils'
import {
    isStiPatientFemale,
    isStiPatientMale,
    isSectionGateOpen,
    shouldOmitStageDataElementRow,
    shouldOmitStageFieldAfterBooleanGate,
    shouldOmitStiSexGatedLabField,
    trackerDataEntryValueIsPresent,
} from '../../lib/trackerProgramRuleFieldUi'
import { applyRuleAssignedValues } from '../../lib/programRuleFormSync'
import { mandatoryFieldSetHas } from '../../lib/paperFormSafety'
import {
    buildMedicineDeToSlotIndex,
    buildMedicineDeToSlotIndexFromLabels,
    buildMedicineSlotsFromMetadata,
    buildMedicineSectionSlotIndex,
    canAddAnotherMedicineSlot,
    canRemoveMedicineSlot,
    computeMedicineSectionUnlockCap,
    getMedicineSlotDeIds,
    isMedicineAddButtonSection,
    isStageSectionVisible,
    programHasStiMedicineSlots,
    shouldOmitMedicineStageField,
    MEDICINE_SECTION_TITLE_HINT,
    isMedicineTreatmentSection,
    resolveMedicineFieldDeForUi,
} from '../../lib/medicineSlots'
import {
    buildTrackedEntityAttributesPayload,
    profileAttributeValuesFromTei,
} from '../../lib/profileAttributeForm'
import { trackedEntityAttributeIdFromEntry } from '../../utils/trackerMappers'
import { ProfileDetailHeader } from './ProfileDetailHeader'
import { ProfileEventTimeline } from './ProfileEventTimeline'
import { ProfileRuleAlerts } from './ProfileRuleAlerts'
import { ProfileSummaryCard } from './ProfileSummaryCard'
import { StageFieldRow } from './StageFieldRow'
import { ProgramRulesReferencePanel } from '../program-rules/ProgramRulesReferencePanel'
import { CompleteVisitChecklistModal } from '../../components/stage/CompleteVisitChecklistModal'
import { RegistrationDateModal } from '../../components/RegistrationDateModal'
import { PatientSummaryPrintModal } from './components/PatientSummaryPrintModal'
import { useCaptureAdmin } from '../../hooks/useCaptureAdmin'
import {
    AddMedicineButton,
    AddMedicineButtonFooter,
    RemoveMedicineButton,
    ShowAllMedicineButton,
} from '../../components/stage/AddMedicineButton'
import { PartnerSmhCodeSearchField } from '../../components/stage/PartnerSmhCodeSearchField'
import { StageFormSection } from '../../components/stage/StageFormSection'
import { PaperStageForm } from '../../components/paper-form/PaperStageForm'
import { isAppointmentDateField } from '../../components/paper-form/PaperFormField'
import { StageFormErrorBoundary } from '../../components/paper-form/StageFormErrorBoundary'
import { getNextProgramStage, getShortStageLabel } from './lib/stageWorkflowGroups'
import { StageNavigationSidebar } from './components/StageNavigationSidebar'
import { isPreventionProgram } from '../../lib/preventionProgramRulesManifest'
import { isPaperFormStage, isRiskQuestionnaireStage } from '../../lib/paperFormStages'
import {
    buildStiSexHiddenSectionIds,
    isStiClinicalPaperFormStage,
    resolveProfileSexAttributeId,
    resolveStiPatientSex,
    resolveStiPaperFormTitle,
} from '../../lib/stiSexFormGating'
import { stripLeadingListIndex } from '../../lib/stageFieldLabelI18n'
import { paperFormQuestionIndex, paperFormRowLayoutForDe } from '../../lib/paperFormRowLayout'
import { isPartnerSmhCodeStageField } from '../../lib/partnerSmhField'
import { useStageSectionScrollSync } from '../../hooks/useStageSectionScrollSync'
import { useRestoreScrollOnFormUpdate } from '../../hooks/useRestoreScrollOnFormUpdate'
import {
    augmentFormValuesForOmittedCompulsory,
    buildEventDataValuesPayload,
    collectStageDataElementIds,
    formatEventDataValueForDisplay,
    resolveStageFieldFormValue,
    sanitizeMedicineSlotFormValues,
} from '../../lib/eventDataValues'
import { buildMetadataForProgramRules } from '../../lib/programRulesMetadata'
import { stageFieldLayoutParts } from '../../lib/stageKhmerFieldGroups'
import { resolveStageFieldDisplayLabel } from '../../lib/stageFieldLabelI18n'
import { PAGE_LAYOUT } from '../tei-search/teiListUi'
import {
    computeSectionProgress,
    countRequiredRemainingInSection,
    listMissingStageFields,
} from '../../lib/stageSectionProgress'

const getAttributeValue = (tei, attributeId) => {
    if (!tei || !tei.attributes) return '-'
    const attr = tei.attributes.find((a) => trackedEntityAttributeIdFromEntry(a) === attributeId)
    return attr ? attr.value : '-'
}

const isSectionBodyUnlocked = (gateDe, gateValue) => {
    if (!gateDe) return true
    if (!sectionUsesHeaderBooleanGate(gateDe)) return true
    return isSectionGateOpen(gateDe, gateValue)
}

/** Lab section: cervix checkbox hidden for male patients by program rule (independent of Other tested gate). */
const STI_MALE_ONLY_LAB_DE_IDS = new Set(['DY5lhiNfJ0M'])

/** Full-width row for option-set choice grids (3-column tiles). */
const isWideStageChoiceField = (de) => stageOptionFieldUsesChoiceGrid(de)

function getCounsellingDefaultValues(sections, resolveDe) {
    if (!sections?.length) return {}
    const init = {}
    for (const sec of sections) {
        if (isCounsellingAdviceSection(sec)) {
            const des = (sec.dataElements || (sec.dataElementIds || []).map((id) => resolveDe?.(id))).filter(Boolean)
            for (const de of des) {
                if (isCounsellingAdviceYesNoField(de)) {
                    if (de?.optionSet?.options?.length > 0) {
                        const yesOpt = de.optionSet.options.find((opt) => {
                            const c = String(opt.code || '').toLowerCase().trim()
                            const n = String(opt.name || opt.displayName || '').toLowerCase().trim()
                            return c === 'true' || c === 'yes' || c === '1' || n.includes('បាទ') || n.includes('ចាស') || n.includes('yes')
                        })
                        init[de.id] = yesOpt ? yesOpt.code : 'true'
                    } else {
                        init[de.id] = 'true'
                    }
                }
            }
        }
    }
    return init
}

export const ProfileDetail = ({ context, tei: initialTei, onBack, onUpdateSuccess, onTeiDeleted }) => {
    const engine = useDataEngine()
    const appConfig = useConfig()
    const { currentUsername, isSuperuser, isCaptureAdmin, isDataEntryExperience } = useCaptureAdmin()
    const [tei, setTei] = useState(initialTei)
    const [metadata, setMetadata] = useState(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [deletingTei, setDeletingTei] = useState(false)
    const [deleteTeiModalOpen, setDeleteTeiModalOpen] = useState(false)
    const [deleteEventModalOpen, setDeleteEventModalOpen] = useState(false)
    const [completeWarningModalOpen, setCompleteWarningModalOpen] = useState(false)
    const [completeWarningText, setCompleteWarningText] = useState('')
    const [printModalOpen, setPrintModalOpen] = useState(false)
    const [isEventDateModalOpen, setIsEventDateModalOpen] = useState(false)
    const [draftRestoredNotice, setDraftRestoredNotice] = useState(false)
    const [message, setMessage] = useState(null)
    const [expandedEventIds, setExpandedEventIds] = useState(new Set())
    const [activeTab, setActiveTab] = useState('PROGRAM')
    const [editingEventId, setEditingEventId] = useState(null)
    const lastFormLoadedEventIdRef = useRef(null)
    const [isAddingRecord, setIsAddingRecord] = useState(false)
    const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10))
    const [formValues, setFormValues] = useState({})
    const clearedFieldIds = useRef(new Set())
    const [eventStatus, setEventStatus] = useState('ACTIVE')
    const [lastUpdatedEventId, setLastUpdatedEventId] = useState(null)
    const [invalidHighlightFieldId, setInvalidHighlightFieldId] = useState(null)
    const invalidFieldBaselineRef = useRef(null)
    const [programRulesPanelOpen, setProgramRulesPanelOpen] = useState(false)
    /** When un-completing, restore this open status (VISITED vs ACTIVE, etc.) like Capture. */
    const incompleteEventStatusRef = useRef('VISITED')
    const [activeSectionId, setActiveSectionId] = useState(null)
    const [collapsedSectionIds, setCollapsedSectionIds] = useState(() => new Set())
    const [completeChecklistOpen, setCompleteChecklistOpen] = useState(false)
    const [missingForComplete, setMissingForComplete] = useState([])
    const stageFormScrollRef = useRef(null)
    const [editingProfile, setEditingProfile] = useState(false)
    const [profileAttrValues, setProfileAttrValues] = useState({})
    const [invalidProfileAttrHighlightId, setInvalidProfileAttrHighlightId] = useState(null)
    const invalidProfileAttrBaselineRef = useRef(null)
    /** Manual row unlock from Add button (not reset when auto-cascade ticks). */
    const [manualMedicineRows, setManualMedicineRows] = useState(1)
    const manualMedicineRowsRef = useRef(1)
    const medicineSessionRef = useRef('')
    const lastSanitizedMedicineEventRef = useRef(null)

    const scrollToInvalidField = useCallback((scope, id) => {
        const domId = captureFieldDomId(scope, id)
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const el = document.getElementById(domId)
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                const focusable = el?.querySelector(
                    'input:not([type="hidden"]), select, textarea, button, [role="combobox"]'
                )
                focusable?.focus?.({ preventScroll: true })
            })
        })
    }, [])

    const enrollment = useMemo(() => {
        if (!tei?.enrollments || tei.enrollments.length === 0) return null
        // First try to match by program ID
        const match = tei.enrollments.find((enr) => enr.program === context.program)
        if (match) return match
        // Fallback to first active enrollment if only one exists, or just the first one
        const active = tei.enrollments.find(enr => enr.status === 'ACTIVE')
        return active || tei.enrollments[0]
    }, [tei, context.program])

    const enrollmentDateStr = useMemo(() => {
        const raw =
            enrollment?.enrolledAt ||
            enrollment?.enrollmentDate ||
            enrollment?.createdAt ||
            tei?.enrollments?.[0]?.enrolledAt ||
            tei?.enrollments?.[0]?.enrollmentDate ||
            tei?.enrollments?.[0]?.createdAt ||
            tei?.enrolledAt ||
            tei?.enrollmentDate ||
            tei?.createdAt ||
            ''
        return raw ? String(raw).split('T')[0] : ''
    }, [enrollment, tei])

    const profileExpired = useMemo(
        () => isProfileExpired(enrollment, tei, isDataEntryExperience && !isSuperuser),
        [enrollment, tei, isDataEntryExperience, isSuperuser]
    )

    const events = useMemo(() => {
        if (!enrollment) return []
        return enrollment.events || []
    }, [enrollment])

    const [sidebarOpen, setSidebarOpen] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.innerWidth >= 1536
        }
        return false
    })

    useEffect(() => {
        setInvalidHighlightFieldId(null)
        invalidFieldBaselineRef.current = null
    }, [activeTab, editingEventId, isAddingRecord])

    useEffect(() => {
        if (activeTab !== 'PROGRAM' && editingProfile) {
            setEditingProfile(false)
            setProfileAttrValues({})
            setInvalidProfileAttrHighlightId(null)
            invalidProfileAttrBaselineRef.current = null
        }
    }, [activeTab, editingProfile])

    useEffect(() => {
        const id = invalidHighlightFieldId
        if (!id) return
        const baseline = invalidFieldBaselineRef.current
        if (String(formValues[id] ?? '') !== String(baseline ?? '')) {
            setInvalidHighlightFieldId(null)
            invalidFieldBaselineRef.current = null
        }
    }, [formValues, invalidHighlightFieldId])

    useEffect(() => {
        const run = async () => {
            try {
                setLoading(true)
                const teiId =
                    initialTei?.trackedEntity ||
                    initialTei?.trackedEntityInstance ||
                    (typeof initialTei === 'string' ? initialTei : initialTei?.id)
                const programId =
                    context?.program ||
                    initialTei?.enrollments?.[0]?.program ||
                    tei?.enrollments?.[0]?.program

                if (programId) {
                    const [programData, freshTei] = await Promise.all([
                        fetchProgramMetadata({
                            engine,
                            programId,
                            translate: false,
                            locale: 'km',
                        }),
                        teiId
                            ? fetchTei({
                                  engine,
                                  id: teiId,
                                  programId,
                                  fresh: true,
                              }).catch((err) => {
                                  console.warn('Could not fetch fresh TEI', err)
                                  return null
                              })
                            : Promise.resolve(null),
                    ])

                    setMetadata(normalizeProgramMetadata(programData))
                    if (freshTei) {
                        setTei(freshTei)
                    }
                } else if (teiId) {
                    const freshTei = await fetchTei({
                        engine,
                        id: teiId,
                        fresh: true,
                    })
                    if (freshTei) {
                        setTei(freshTei)
                        const discoveredProg = freshTei.enrollments?.[0]?.program
                        if (discoveredProg) {
                            const programData = await fetchProgramMetadata({
                                engine,
                                programId: discoveredProg,
                                translate: false,
                                locale: 'km',
                            })
                            setMetadata(normalizeProgramMetadata(programData))
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to load profile data', error)
            } finally {
                setLoading(false)
            }
        }
        run()
    }, [
        engine,
        context?.program,
        initialTei?.trackedEntity,
        initialTei?.trackedEntityInstance,
        initialTei?.enrollments,
        i18n.language,
    ])

    // Initialize form values when selected event or tab changes
    const selectedEvent = useMemo(() => {
        if (!enrollment || !editingEventId) return null
        return (enrollment.events || []).find(e => e.event === editingEventId)
    }, [enrollment, editingEventId])

    const eventActorUsername = useCallback((event) => {
        const createdByUser =
            event?.createdBy?.username ||
            event?.createdByUserInfo?.username ||
            event?.lastUpdatedBy?.username ||
            event?.storedBy
        return String(createdByUser || '').trim().toLowerCase()
    }, [])



    useEffect(() => {
        if (isAddingRecord) {
            lastFormLoadedEventIdRef.current = null
            setEventStatus('ACTIVE')
            incompleteEventStatusRef.current = 'ACTIVE'
            return
        }
        if (!selectedEvent) return

        const isNewEvent = lastFormLoadedEventIdRef.current !== selectedEvent.event
        if (isNewEvent) {
            lastFormLoadedEventIdRef.current = selectedEvent.event
            lastSanitizedMedicineEventRef.current = null
            const rawDate = selectedEvent.occurredAt || selectedEvent.eventDate || ''
            setEventDate(rawDate ? rawDate.slice(0, 10) : new Date().toISOString().slice(0, 10))
        }

        const fromServer = {}
        for (const dv of selectedEvent.dataValues || []) {
            if (dv?.dataElement) fromServer[dv.dataElement] = dv.value
        }

        setFormValues((prev) => {
            const status = normalizeLoadedEventStatus(selectedEvent.status)
            if (isNewEvent || status === 'COMPLETED') {
                clearedFieldIds.current = new Set()
                return fromServer
            }
            if (Object.keys(fromServer).length === 0 && Object.keys(prev).length > 0) {
                return prev
            }
            return { ...prev, ...fromServer }
        })

        const normalized = normalizeLoadedEventStatus(selectedEvent.status)
        if (normalized === 'COMPLETED') {
            incompleteEventStatusRef.current = 'VISITED'
            setEventStatus('COMPLETED')
        } else {
            incompleteEventStatusRef.current = normalized
            setEventStatus(normalized)
        }
    }, [selectedEvent, isAddingRecord, activeTab])

    const getDraftKey = useCallback(() => {
        const teiId = tei?.trackedEntity || tei?.trackedEntityInstance
        const programId = context?.program
        const stageId = activeTab !== 'PROGRAM' ? activeTab : null
        if (!teiId || !programId || !stageId) return null
        const eventKey = editingEventId || (isAddingRecord ? 'new' : null)
        if (!eventKey) return null
        return `npd_draft_${teiId}_${programId}_${stageId}_${eventKey}`
    }, [tei, context?.program, activeTab, editingEventId, isAddingRecord])

    const clearCurrentDraft = useCallback(() => {
        const key = getDraftKey()
        if (!key) return
        try {
            localStorage.removeItem(key)
            setDraftRestoredNotice(false)
        } catch (e) {}
    }, [getDraftKey])

    const handleDiscardDraft = useCallback(() => {
        clearCurrentDraft()
        if (isAddingRecord) {
            setFormValues({})
            setEventDate(new Date().toISOString().slice(0, 10))
        } else if (selectedEvent) {
            const fromServer = {}
            for (const dv of selectedEvent.dataValues || []) {
                if (dv?.dataElement) fromServer[dv.dataElement] = dv.value
            }
            setFormValues(fromServer)
            const rawDate = selectedEvent.occurredAt || selectedEvent.eventDate || ''
            setEventDate(rawDate ? rawDate.slice(0, 10) : new Date().toISOString().slice(0, 10))
        }
        setDraftRestoredNotice(false)
        setMessage({ type: 'success', text: i18n.t('Discard draft') })
        setTimeout(() => setMessage(null), 2000)
    }, [clearCurrentDraft, isAddingRecord, selectedEvent])

    const startAddNewRecord = useCallback(() => {
        setIsEventDateModalOpen(true)
    }, [])

    const handleConfirmNewRecordDate = useCallback((selectedDate) => {
        let dateToSet = selectedDate || new Date().toISOString().slice(0, 10)
        if (enrollmentDateStr && dateToSet < enrollmentDateStr) {
            dateToSet = enrollmentDateStr
        }
        const teiId = tei?.trackedEntity || tei?.trackedEntityInstance
        const programId = context?.program
        const stageId = activeTab !== 'PROGRAM' ? activeTab : null
        if (teiId && programId && stageId) {
            try {
                localStorage.removeItem(`npd_draft_${teiId}_${programId}_${stageId}_new`)
            } catch (e) {}
        }
        setDraftRestoredNotice(false)
        setFormValues({})
        setEventDate(dateToSet)
        setEditingEventId(null)
        setIsAddingRecord(true)
        setIsEventDateModalOpen(false)
    }, [tei, context?.program, activeTab])

    useEffect(() => {
        const key = getDraftKey()
        if (!key) return
        if (Object.keys(formValues).length === 0) return

        try {
            localStorage.setItem(
                key,
                JSON.stringify({
                    formValues,
                    eventDate,
                    updatedAt: Date.now(),
                })
            )
        } catch (e) {}
    }, [formValues, eventDate, getDraftKey])

    useEffect(() => {
        if (isAddingRecord) return
        const key = getDraftKey()
        if (!key) return
        try {
            const saved = localStorage.getItem(key)
            if (saved) {
                const parsed = JSON.parse(saved)
                if (parsed?.formValues && Object.keys(parsed.formValues).length > 0) {
                    setFormValues((prev) => ({ ...prev, ...parsed.formValues }))
                    if (parsed.eventDate) setEventDate(parsed.eventDate)
                    setDraftRestoredNotice(true)
                }
            }
        } catch (e) {}
    }, [getDraftKey, isAddingRecord])

    const openDeleteTeiModal = () => {
        const teiId = tei?.trackedEntity || tei?.trackedEntityInstance
        if (!teiId) return
        setDeleteTeiModalOpen(true)
    }

    const closeDeleteTeiModal = () => {
        if (deletingTei) return
        setDeleteTeiModalOpen(false)
    }

    const confirmDeleteTrackedEntity = async () => {
        const teiId = tei?.trackedEntity || tei?.trackedEntityInstance
        if (!teiId) return
        try {
            setDeletingTei(true)
            setMessage(null)
            const orgUnitForDelete =
                enrollment?.orgUnit || tei?.orgUnit || context.orgUnit || undefined
            await deleteTrackedEntity({
                engine,
                trackedEntityId: teiId,
                programId: context.program || undefined,
                orgUnitId: orgUnitForDelete || undefined,
                trackedEntityType: tei?.trackedEntityType || metadata?.trackedEntityType || undefined,
            })
            setDeleteTeiModalOpen(false)
            if (onTeiDeleted) {
                onTeiDeleted(teiId)
            } else {
                onUpdateSuccess?.(teiId)
                onBack?.()
            }
        } catch (error) {
            console.error('Failed to delete profile', error)
            setDeleteTeiModalOpen(false)
            setMessage({
                type: 'error',
                text: error.message || i18n.t('Failed to delete profile'),
            })
            setTimeout(() => setMessage(null), 5000)
        } finally {
            setDeletingTei(false)
        }
    }

    useEffect(() => {
        if (!deleteTeiModalOpen) return undefined
        const onKeyDown = (e) => {
            if (e.key === 'Escape' && !deletingTei) {
                e.preventDefault()
                setDeleteTeiModalOpen(false)
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [deleteTeiModalOpen, deletingTei])

    const eventDeletePermission = useMemo(() => {
        return canUserDeleteEvent({
            event: selectedEvent,
            isSuperuser,
            isCaptureAdmin,
            isDataEntryExperience,
        })
    }, [selectedEvent, isSuperuser, isCaptureAdmin, isDataEntryExperience])

    const handleDelete = () => {
        if (!editingEventId) return
        setDeleteEventModalOpen(true)
    }

    const confirmDeleteEvent = async () => {
        if (!editingEventId) return
        if (!eventDeletePermission.canDelete) {
            setMessage({
                type: 'error',
                text: i18n.t(
                    'Cannot delete record: Tracker Capture role can only delete records within 2 weeks (14 days) of creation.'
                ),
            })
            setTimeout(() => setMessage(null), 4000)
            return
        }

        try {
            setSaving(true)
            await deleteEvent({ engine, eventId: editingEventId })
            setMessage({ type: 'success', text: i18n.t('Record deleted successfully') })
            setTimeout(() => setMessage(null), 3000)
            
            const freshTei = await fetchTei({ engine, id: tei.trackedEntity, programId: context.program, fresh: true })
            if (freshTei) {
                setTei(freshTei)
            }
            setEditingEventId(null)
            setDeleteEventModalOpen(false)
        } catch (error) {
            console.error("Failed to delete record", error)
            setMessage({ type: 'error', text: error.message || i18n.t('Failed to delete record') })
            setTimeout(() => setMessage(null), 3000)
        } finally {
            setSaving(false)
        }
    }

    const refreshTeiFromServer = useCallback(async () => {
        const freshTei = await fetchTei({
            engine,
            id: tei.trackedEntity,
            programId: context.program,
            fresh: true,
        })
        if (freshTei) setTei(freshTei)
        return freshTei
    }, [engine, tei?.trackedEntity, context.program])



    const toggleEventExpansion = (eventId) => {
        setExpandedEventIds((prev) => {
            const next = new Set(prev)
            if (next.has(eventId)) next.delete(eventId)
            else next.add(eventId)
            return next
        })
    }

    const stagesMap = useMemo(() => {
        const map = {}
        if (metadata?.stages) {
            metadata.stages.forEach((stage) => {
                map[stage.id] = decodeBasicHtmlEntities(stage.name)
            })
        }
        return map
    }, [metadata])

    const newestEventInActiveStage = useMemo(() => {
        if (activeTab === 'PROGRAM' || !enrollment?.events?.length) return null
        const stageEvents = enrollment.events.filter((e) => e.programStage === activeTab)
        if (!stageEvents.length) return null
        return [...stageEvents].sort((a, b) => {
            const ta = new Date(a.occurredAt || a.eventDate || 0).getTime()
            const tb = new Date(b.occurredAt || b.eventDate || 0).getTime()
            if (tb !== ta) return tb - ta
            return String(b.event || '').localeCompare(String(a.event || ''))
        })[0]
    }, [enrollment?.events, activeTab])

    const ruleFormValues = useMemo(() => {
        const tea = {}
        if (tei?.attributes) {
            tei.attributes.forEach((a) => {
                const id = trackedEntityAttributeIdFromEntry(a)
                if (id) tea[id] = a.value
            })
        }
        if (activeTab === 'PROGRAM') {
            return editingProfile ? { ...tea, ...profileAttrValues } : tea
        }
        if (!editingEventId && !isAddingRecord) {
            // Stage list: overlay newest event’s data values for this stage so program rules (e.g. HIDEFIELD) still evaluate.
            const fromEvent = {}
            for (const dv of newestEventInActiveStage?.dataValues || []) {
                if (dv?.dataElement) fromEvent[dv.dataElement] = dv.value
            }
            return { ...tea, ...profileAttrValues, ...fromEvent }
        }
        return { ...tea, ...profileAttrValues, ...formValues }
    }, [tei, activeTab, formValues, editingEventId, isAddingRecord, newestEventInActiveStage, editingProfile, profileAttrValues])

    const ruleVarContext = useMemo(
        () => ({
            enrollmentEvents: events,
            currentEventId: editingEventId,
            currentProgramStageId: activeTab !== 'PROGRAM' ? activeTab : null,
            evaluatingDraftEvent: Boolean(isAddingRecord),
            /**
             * Tracker dataentry-controller watches `currentEvent.status` and calls `executeRules()` so rules
             * that depend on completion / VISITED still evaluate before save. Enrollment payload can lag UI.
             */
            eventStatusOverride: editingEventId ? eventStatus : null,
            /** When browsing the stage timeline, mirror the newest real event’s status/dates on the synthetic RuleEventJs. */
            snapshotEventStatus:
                !editingEventId && !isAddingRecord && activeTab !== 'PROGRAM'
                    ? newestEventInActiveStage?.status ?? null
                    : null,
            snapshotEventOccurredAt:
                !editingEventId && !isAddingRecord && activeTab !== 'PROGRAM'
                    ? newestEventInActiveStage?.occurredAt || newestEventInActiveStage?.eventDate || null
                    : null,
            snapshotEventDueDate:
                !editingEventId && !isAddingRecord && activeTab !== 'PROGRAM'
                    ? newestEventInActiveStage?.dueDate || null
                    : null,
            snapshotEventCompletedAt:
                !editingEventId && !isAddingRecord && activeTab !== 'PROGRAM'
                    ? newestEventInActiveStage?.completedAt || newestEventInActiveStage?.completedDate || null
                    : null,
        }),
        [events, editingEventId, activeTab, isAddingRecord, eventStatus, newestEventInActiveStage]
    )

    const dhis2Context = useMemo(() => {
        if (!enrollment || !tei) return null
        return {
            enrollment,
            tei,
            programName: metadata?.name ? decodeBasicHtmlEntities(metadata.name) : '',
        }
    }, [enrollment, tei, metadata?.name])

    const metadataForRules = useMemo(
        () => buildMetadataForProgramRules(metadata),
        [metadata]
    )

    const { hiddenFields, hiddenProgramStages, hiddenSectionIds, mandatoryFieldIds, ruleWarnings, ruleErrors, assignedValues, hiddenOptionsByField } = useProgramRules(
        metadataForRules,
        ruleFormValues,
        { programStageId: activeTab !== 'PROGRAM' ? activeTab : null, ruleVarContext, dhis2Context }
    )

    const hiddenFieldsKey = useMemo(() => [...hiddenFields].sort().join(','), [hiddenFields])

    const preservePaperFormScroll =
        Boolean(editingEventId || isAddingRecord) &&
        activeTab !== 'PROGRAM' &&
        isPaperFormStage(activeTab)

    useRestoreScrollOnFormUpdate(
        stageFormScrollRef,
        `${hiddenFieldsKey}\0${JSON.stringify(formValues)}`,
        preservePaperFormScroll
    )

    const hasStiMedicineSlots = useMemo(() => programHasStiMedicineSlots(metadata), [metadata])

    const medicineSlots = useMemo(
        () => buildMedicineSlotsFromMetadata(metadata, activeTab !== 'PROGRAM' ? activeTab : null),
        [metadata, activeTab]
    )
    const medicineDeToSlot = useMemo(() => {
        const fromSlots = buildMedicineDeToSlotIndex(medicineSlots)
        const fromLabels = buildMedicineDeToSlotIndexFromLabels(
            metadata,
            activeTab !== 'PROGRAM' ? activeTab : null
        )
        /** Prefer label/index layout for slot 2+ ; rule-based map only fills DE ids labels missed. */
        const merged = new Map(fromLabels)
        for (const [id, idx] of fromSlots) {
            if (!merged.has(id)) merged.set(id, idx)
        }
        return merged
    }, [medicineSlots, metadata, activeTab])

    const medicineSlotMax = useMemo(() => {
        if (medicineSlots.length) {
            return Math.max(...medicineSlots.map((s) => s.index))
        }
        if (medicineDeToSlot.size) {
            return Math.max(...medicineDeToSlot.values())
        }
        return 0
    }, [medicineSlots, medicineDeToSlot])

    const medicineSlotCapContext = useMemo(
        () => ({
            metadata,
            programStageId: activeTab !== 'PROGRAM' ? activeTab : null,
            deToSlotMap: medicineDeToSlot,
        }),
        [metadata, activeTab, medicineDeToSlot]
    )

    const activeStage = useMemo(
        () => metadata?.stages?.find((s) => s.id === activeTab),
        [metadata?.stages, activeTab]
    )

    const mergeSaveDe = useCallback(
        (id) => {
            const row = activeStage?.dataElements?.find((d) => d.id === id)
            const base = metadata?.dataElements?.[id]
            if (row && base) return mergeStageDataElement(base, row)
            if (row || base) return row || base
            for (const stage of metadata?.stages || []) {
                const fallback = stage.dataElements?.find((d) => d.id === id)
                if (fallback) {
                    return base ? mergeStageDataElement(base, fallback) : fallback
                }
            }
            return null
        },
        [activeStage?.dataElements, metadata?.dataElements, metadata?.stages]
    )

    useEffect(() => {
        if (!isAddingRecord || activeTab === 'PROGRAM') return
        if (!activeStage?.sections?.length) return
        setFormValues((prev) => {
            const withGates = applySectionGateDefaults(prev, activeStage.sections, mergeSaveDe)
            const counsellingDefaults = getCounsellingDefaultValues(activeStage.sections, mergeSaveDe)
            return { ...counsellingDefaults, ...withGates }
        })
    }, [isAddingRecord, activeTab, activeStage?.sections, mergeSaveDe])

    const medicineStageSessionKey = useMemo(
        () =>
            `${activeTab}:${editingEventId ?? (isAddingRecord ? 'new' : 'list')}`,
        [activeTab, editingEventId, isAddingRecord]
    )

    useEffect(() => {
        if (medicineSessionRef.current === medicineStageSessionKey) return
        medicineSessionRef.current = medicineStageSessionKey
        lastSanitizedMedicineEventRef.current = null
        manualMedicineRowsRef.current = 1
        setManualMedicineRows(1)
    }, [medicineStageSessionKey, activeTab, medicineSlotMax])

    const selectedEventFormValues = useMemo(() => {
        const out = {}
        for (const dv of selectedEvent?.dataValues || []) {
            if (dv?.dataElement) out[dv.dataElement] = dv.value
        }
        return out
    }, [selectedEvent?.dataValues])

    useEffect(() => {
        if (isAddingRecord && !editingEventId) return
        const capFromForm = (rows) =>
            computeMedicineSectionUnlockCap(
                medicineSlots,
                formValues,
                rows,
                medicineSlotMax,
                mergeSaveDe,
                medicineSlotCapContext
            )
        const capFromServer = computeMedicineSectionUnlockCap(
            medicineSlots,
            selectedEventFormValues,
            1,
            medicineSlotMax,
            mergeSaveDe,
            medicineSlotCapContext
        )
        const dataCap = Math.max(capFromForm(1), capFromServer)
        setManualMedicineRows((prev) => {
            const effective = Math.max(capFromForm(prev), capFromServer)
            let next = prev
            if (effective < prev) {
                next = Math.max(1, dataCap)
            } else if (prev < dataCap) {
                next = dataCap
            }
            if (next === prev) return prev
            manualMedicineRowsRef.current = next
            return next
        })
    }, [
        medicineSlots,
        formValues,
        medicineSlotMax,
        isAddingRecord,
        editingEventId,
        mergeSaveDe,
        medicineSlotCapContext,
        selectedEventFormValues,
    ])

    const effectiveMedicineSlotCap = useMemo(() => {
        const fromForm = computeMedicineSectionUnlockCap(
            medicineSlots,
            formValues,
            manualMedicineRows,
            medicineSlotMax,
            mergeSaveDe,
            medicineSlotCapContext
        )
        const fromServer = computeMedicineSectionUnlockCap(
            medicineSlots,
            selectedEventFormValues,
            1,
            medicineSlotMax,
            mergeSaveDe,
            medicineSlotCapContext
        )
        return Math.max(fromForm, fromServer)
    }, [
        medicineSlots,
        formValues,
        selectedEventFormValues,
        manualMedicineRows,
        medicineSlotMax,
        mergeSaveDe,
        medicineSlotCapContext,
    ])

    useEffect(() => {
        if (isAddingRecord || !selectedEvent?.event || !hasStiMedicineSlots || !medicineSlots.length) {
            return
        }
        if (lastSanitizedMedicineEventRef.current === selectedEvent.event) return
        lastSanitizedMedicineEventRef.current = selectedEvent.event

        if (isVisitFormLocked(normalizeLoadedEventStatus(selectedEvent.status), eventDate, isDataEntryExperience)) {
            return
        }

        const serverSnapshot = {}
        for (const dv of selectedEvent.dataValues || []) {
            if (dv?.dataElement) serverSnapshot[dv.dataElement] = dv.value
        }
        setFormValues((prev) =>
            sanitizeMedicineSlotFormValues(medicineSlots, prev, mergeSaveDe, { serverSnapshot })
        )
    }, [
        selectedEvent?.event,
        selectedEvent?.dataValues,
        isAddingRecord,
        hasStiMedicineSlots,
        medicineSlots,
        medicineSlotMax,
        mergeSaveDe,
    ])

    const medicineSectionSlotIndex = useMemo(
        () => buildMedicineSectionSlotIndex(activeStage?.sections, medicineSlots, medicineDeToSlot),
        [activeStage?.sections, medicineSlots, medicineDeToSlot]
    )

    const showAddMedicineControl =
        medicineSlotMax > 1 &&
        canAddAnotherMedicineSlot(
            medicineSlots,
            effectiveMedicineSlotCap,
            formValues,
            medicineSlotMax
        )

    const medicineTreatmentSectionIds = useMemo(() => {
        const ids = new Set()
        for (const section of activeStage?.sections || []) {
            if (
                isMedicineTreatmentSection(section, {
                    medicineDeToSlot,
                    medicineSlots,
                    mergeStageDe: mergeSaveDe,
                })
            ) {
                ids.add(section.id)
            }
        }
        return ids
    }, [activeStage?.sections, medicineDeToSlot, medicineSlots, mergeSaveDe])

    const stiClinicalPaperFormActive = useMemo(
        () => isStiClinicalPaperFormStage(activeTab, activeStage, context?.program),
        [activeTab, activeStage, context?.program]
    )

    const stiSexAttributeId = useMemo(
        () => resolveProfileSexAttributeId(metadata),
        [metadata]
    )

    const stiSexAttributeMeta = useMemo(
        () => metadata?.attributes?.find((a) => a.id === stiSexAttributeId) || null,
        [metadata?.attributes, stiSexAttributeId]
    )

    const stiPatientSex = useMemo(
        () =>
            stiClinicalPaperFormActive
                ? resolveStiPatientSex(ruleFormValues, {
                      sexAttributeId: stiSexAttributeId,
                      sexAttributeMeta: stiSexAttributeMeta,
                      metadata,
                  })
                : null,
        [
            stiClinicalPaperFormActive,
            ruleFormValues,
            stiSexAttributeId,
            stiSexAttributeMeta,
            metadata,
        ]
    )

    const stiSexHiddenSectionIds = useMemo(() => {
        if (!stiClinicalPaperFormActive || !stiPatientSex || activeTab === 'PROGRAM') return new Set()
        return buildStiSexHiddenSectionIds(
            activeStage?.sections,
            stiPatientSex,
            metadataForRules?.rules,
            activeTab
        )
    }, [
        stiClinicalPaperFormActive,
        stiPatientSex,
        activeTab,
        activeStage?.sections,
        metadataForRules?.rules,
    ])

    const effectiveHiddenSectionIds = useMemo(() => {
        // Always start from rule-engine sections so attribute-driven rules (e.g. PLHIV hides
        // section 6 "Last HIV test done") apply even inside the STI clinical paper form.
        // stiSexHiddenSectionIds adds the sex-based hides on top.
        // Note: medicine-slot section visibility is handled separately by isMedicineSectionVisible,
        // so including hiddenSectionIds here does NOT break medicine slot logic.
        const merged = new Set(hiddenSectionIds)
        for (const id of stiSexHiddenSectionIds) merged.add(id)
        return merged
    }, [hiddenSectionIds, stiSexHiddenSectionIds])

    const stiPaperFormTitle = useMemo(() => {
        const base = decodeBasicHtmlEntities(
            activeStage?.displayName || activeStage?.name || i18n.t('Clinical form')
        )
        if (!stiClinicalPaperFormActive) return base
        return resolveStiPaperFormTitle(base, stiPatientSex, (key, opts) => i18n.t(key, opts))
    }, [
        activeStage?.displayName,
        activeStage?.name,
        stiClinicalPaperFormActive,
        stiPatientSex,
    ])

    const isMedicineSectionVisible = useCallback(
        (sectionId) =>
            isStageSectionVisible(
                sectionId,
                effectiveHiddenSectionIds,
                medicineSectionSlotIndex,
                effectiveMedicineSlotCap,
                { medicineTreatmentSectionIds }
            ),
        [
            effectiveHiddenSectionIds,
            medicineSectionSlotIndex,
            effectiveMedicineSlotCap,
            medicineTreatmentSectionIds,
        ]
    )

    /** First treatment-section drug-use gate (Yes → show all medicine columns/fields). */
    const stiTreatmentDrugUseOpen = useMemo(() => {
        if (!hasStiMedicineSlots) return true
        for (const section of activeStage?.sections || []) {
            if (!MEDICINE_SECTION_TITLE_HINT.test(section.name || section.formName || '')) continue
            const gateDeId = section.dataElementIds?.[0]
            if (!gateDeId) continue
            const gateDe = mergeSaveDe(gateDeId)
            if (!sectionUsesHeaderBooleanGate(gateDe)) continue
            return isSectionGateOpen(gateDe, formValues[gateDeId])
        }
        return true
    }, [hasStiMedicineSlots, activeStage?.sections, formValues, mergeSaveDe])

    const sectionGateDeIds = useMemo(() => {
        const ids = new Set()
        for (const section of activeStage?.sections || []) {
            const gateDeId = section.dataElementIds?.[0]
            if (!gateDeId) continue
            if (sectionResolvesHeaderBooleanGate(section, mergeSaveDe(gateDeId))) {
                ids.add(gateDeId)
            }
        }
        return ids
    }, [activeStage?.sections, mergeSaveDe])

    const sectionBooleanGateByDeId = useMemo(() => {
        const map = new Map()
        for (const section of activeStage?.sections || []) {
            const sectionDeIds = section.dataElementIds || []
            const gateDeId = sectionDeIds[0]
            if (!gateDeId) continue
            const gateDeMeta = mergeSaveDe(gateDeId)
            if (!sectionResolvesHeaderBooleanGate(section, gateDeMeta)) {
                continue
            }
            const ctx = {
                gateDeId,
                gateDeMeta,
                sectionDeIds,
                gateValue: formValues[gateDeId],
            }
            for (let i = 1; i < sectionDeIds.length; i += 1) {
                map.set(sectionDeIds[i], ctx)
            }
        }
        return map
    }, [activeStage?.sections, formValues, mergeSaveDe])

    const isPatientMaleForRules = useMemo(
        () => isStiPatientMale(ruleFormValues, stiSexAttributeId, stiSexAttributeMeta),
        [ruleFormValues, stiSexAttributeId, stiSexAttributeMeta]
    )

    const isPatientFemaleForRules = useMemo(
        () => isStiPatientFemale(ruleFormValues, stiSexAttributeId, stiSexAttributeMeta),
        [ruleFormValues, stiSexAttributeId, stiSexAttributeMeta]
    )

    const shouldOmitStageField = useCallback(
        (deId) => {
            const deMeta = mergeSaveDe(deId)
            const valueType = deMeta?.valueType || null
            if (hasStiMedicineSlots && medicineDeToSlot?.has?.(deId)) {
                return shouldOmitMedicineStageField(deId, {
                    medicineSlots,
                    medicineDeToSlot,
                    effectiveMedicineSlotCap,
                    hiddenFields,
                    formValue: formValues[deId],
                    formValues,
                    treatmentGateOpen: stiTreatmentDrugUseOpen,
                    shouldOmitByRule: (hid, id, raw) =>
                        shouldOmitStageDataElementRow(hid, id, raw, valueType),
                })
            }
            const gateCtx = sectionBooleanGateByDeId.get(deId)
            if (gateCtx) {
                return shouldOmitStageFieldAfterBooleanGate({
                    hiddenFieldsSet: hiddenFields,
                    deId,
                    rawValue: formValues[deId],
                    ...gateCtx,
                    deValueType: valueType,
                    isPatientMale: isPatientMaleForRules,
                    maleOnlyHiddenDeIds: STI_MALE_ONLY_LAB_DE_IDS,
                })
            }
            return shouldOmitStiSexGatedLabField(hiddenFields, deId, formValues[deId], {
                isMale: isPatientMaleForRules,
                isFemale: isPatientFemaleForRules,
                valueType,
            })
        },
        [
            hasStiMedicineSlots,
            medicineSlots,
            medicineDeToSlot,
            effectiveMedicineSlotCap,
            hiddenFields,
            formValues,
            stiTreatmentDrugUseOpen,
            sectionBooleanGateByDeId,
            isPatientMaleForRules,
            isPatientFemaleForRules,
            mergeSaveDe,
        ]
    )

    const stageVisibleSections = useMemo(() => {
        const sections = activeStage?.sections || []
        if (!sections.length) return []
        return sections
            .filter((s) => isMedicineSectionVisible(s.id))
            .slice()
            .sort(
                (a, b) =>
                    (Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : 9999) -
                    (Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 9999)
            )
            .map((s) => ({
                id: s.id,
                name: s.name,
            }))
    }, [activeStage?.sections, isMedicineSectionVisible])

    const stageSectionIdsKey = useMemo(
        () => stageVisibleSections.map((s) => s.id).join(','),
        [stageVisibleSections]
    )

    useEffect(() => {
        if (!stageVisibleSections.length) {
            setActiveSectionId(null)
            return
        }
        setActiveSectionId((prev) =>
            prev && stageVisibleSections.some((s) => s.id === prev)
                ? prev
                : stageVisibleSections[0].id
        )
    }, [activeTab, editingEventId, isAddingRecord, stageSectionIdsKey, stageVisibleSections])

    const { sectionProgressMap, sectionProgressRecord } = useMemo(() => {
        const map = new Map()
        const record = {}
        for (const section of activeStage?.sections || []) {
            if (!isMedicineSectionVisible(section.id)) continue
            const gate = resolveStageSectionGate(section, {
                mergeStageDe: mergeSaveDe,
                formValues,
                shouldOmitStageField,
            })
            const status = computeSectionProgress({
                bodyDeIds: gate.bodyDeIds,
                mergeStageDe: mergeSaveDe,
                formValues,
                mandatoryFieldIds,
                hasBooleanGate: gate.hasBooleanGate,
                gateDeId: gate.gateDeId,
                gateOpen: gate.gateOpen,
            })
            const requiredRemaining = countRequiredRemainingInSection({
                bodyDeIds: gate.bodyDeIds,
                mergeStageDe: mergeSaveDe,
                formValues,
                mandatoryFieldIds,
                hasBooleanGate: gate.hasBooleanGate,
                gateDeId: gate.gateDeId,
                gateOpen: gate.gateOpen,
            })
            map.set(section.id, { status, requiredRemaining })
            record[section.id] = status
        }
        return { sectionProgressMap: map, sectionProgressRecord: record }
    }, [
        activeStage?.sections,
        formValues,
        mandatoryFieldIds,
        mergeSaveDe,
        shouldOmitStageField,
        isMedicineSectionVisible,
    ])

    const selectStageSection = useCallback(
        (sectionId) => {
            setActiveSectionId((prev) => {
                if (prev && prev !== sectionId) {
                    const prevProgress = sectionProgressMap.get(prev)
                    if (prevProgress?.status === 'complete') {
                        setCollapsedSectionIds((collapsed) => {
                            const next = new Set(collapsed)
                            next.add(prev)
                            return next
                        })
                    }
                }
                return sectionId
            })
            setCollapsedSectionIds((collapsed) => {
                const next = new Set(collapsed)
                next.delete(sectionId)
                return next
            })
            requestAnimationFrame(() => {
                document.getElementById(`stage-section-${sectionId}`)?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                })
            })
        },
        [sectionProgressMap]
    )

    const onScrollActiveSection = useCallback((sectionId) => {
        setActiveSectionId(sectionId)
    }, [])

    useStageSectionScrollSync({
        enabled: Boolean((editingEventId || isAddingRecord) && stageVisibleSections.length),
        sectionIds: stageVisibleSections.map((s) => s.id),
        activeSectionId,
        onActiveSectionChange: onScrollActiveSection,
        scrollRootRef: stageFormScrollRef,
    })

    const toggleSectionCollapsed = useCallback((sectionId) => {
        setCollapsedSectionIds((prev) => {
            const next = new Set(prev)
            if (next.has(sectionId)) next.delete(sectionId)
            else next.add(sectionId)
            return next
        })
    }, [])

    const jumpToMissingField = useCallback(
        (item) => {
            setCompleteChecklistOpen(false)
            selectStageSection(item.sectionId)
            invalidFieldBaselineRef.current = formValues[item.deId] ?? ''
            setInvalidHighlightFieldId(item.deId)
            scrollToInvalidField('de', item.deId)
        },
        [formValues, selectStageSection, scrollToInvalidField]
    )

    const showAllMedicineSlots = useCallback(() => {
        if (medicineSlotMax < 1) return
        manualMedicineRowsRef.current = medicineSlotMax
        setManualMedicineRows(medicineSlotMax)
    }, [medicineSlotMax])

    const addAnotherMedicine = useCallback(() => {
        const next = Math.min(Math.max(manualMedicineRowsRef.current, 1) + 1, medicineSlotMax)
        manualMedicineRowsRef.current = next
        setManualMedicineRows(next)
        requestAnimationFrame(() => {
            const stage = metadata?.stages?.find((s) => s.id === activeTab)
            const sectionSlot = buildMedicineSectionSlotIndex(
                stage?.sections,
                medicineSlots,
                medicineDeToSlot
            )
            const targetSection = stage?.sections?.find(
                (sec) => sectionSlot.get(sec.id) === next
            )
            if (targetSection?.id) {
                selectStageSection(targetSection.id)
            }
        })
    }, [
        medicineSlotMax,
        metadata?.stages,
        activeTab,
        medicineSlots,
        medicineDeToSlot,
        selectStageSection,
    ])

    const removeMedicineAtSlot = useCallback(
        (slotIndex) => {
            const slot = medicineSlots.find((s) => s.index === slotIndex)
            if (!slot || !canRemoveMedicineSlot(medicineSlots, slotIndex, formValues)) return
            const ids = getMedicineSlotDeIds(slot)
            setFormValues((prev) => {
                const next = { ...prev }
                for (const id of ids) {
                    next[id] = ''
                }
                const collapsed = computeMedicineSectionUnlockCap(
                    medicineSlots,
                    next,
                    1,
                    medicineSlotMax,
                    mergeSaveDe,
                    medicineSlotCapContext
                )
                manualMedicineRowsRef.current = collapsed
                setManualMedicineRows(collapsed)
                return next
            })
        },
        [medicineSlots, formValues, medicineSlotMax, mergeSaveDe, medicineSlotCapContext]
    )

    const collectVisibleDataElements = useCallback(() => {
        const out = []
        const sections = activeStage?.sections || []
        const isUnlockedAfterSectionGate = (section, deId) => {
            const gateDeId = section.dataElementIds[0]
            if (!gateDeId || deId === gateDeId) return true
            const gde = mergeSaveDe(gateDeId)
            if (!gde || !sectionResolvesHeaderBooleanGate(section, gde)) return true
            return isSectionGateOpen(gde, formValues[gateDeId])
        }
        if (sections.length > 0) {
            sections.forEach((section) => {
                if (!isMedicineSectionVisible(section.id)) return
                section.dataElementIds.forEach((id) => {
                    if (shouldOmitStageField(id)) return
                    if (!isUnlockedAfterSectionGate(section, id)) return
                    const de = mergeSaveDe(id)
                    if (de) out.push(de)
                })
            })
        } else if (activeStage?.dataElements) {
            activeStage.dataElements.forEach((de) => {
                if (!shouldOmitStageField(de.id))
                    out.push(mergeSaveDe(de.id) || de)
            })
        }
        return out
    }, [activeStage, isMedicineSectionVisible, formValues, mergeSaveDe, shouldOmitStageField])

    const validateVisibleStageFields = useCallback(() => {
        const visibleDEs = collectVisibleDataElements()
        for (const de of visibleDEs) {
            const resolvedVal = clearedFieldIds.current.has(de.id)
                ? ''
                : resolveStageFieldFormValue(de.id, formValues, selectedEvent?.dataValues)
            const err = validateFieldValue(resolvedVal, {
                mandatory: Boolean(de.compulsory) || mandatoryFieldSetHas(mandatoryFieldIds, de.id),
                pattern: de.pattern,
                valueType: de.valueType,
                name: de.displayName || de.name,
            })
            if (err) {
                invalidFieldBaselineRef.current = resolvedVal ?? ''
                setInvalidHighlightFieldId(de.id)
                scrollToInvalidField('de', de.id)
                setMessage({ type: 'error', text: err })
                return err
            }
        }
        return null
    }, [collectVisibleDataElements, formValues, mandatoryFieldIds, scrollToInvalidField, selectedEvent?.dataValues])


    const applyRuleFailure = useCallback(
        (errors, messagePrefix) => {
            if (!errors?.length) return false
            const withField = errors.find((r) => r.fieldId)
            const fid = withField?.fieldId
            if (fid) {
                invalidFieldBaselineRef.current = formValues[fid] ?? ''
                setInvalidHighlightFieldId(fid)
                scrollToInvalidField('de', fid)
            }
            const text = errors.map((r) => r.text).filter(Boolean).join(' · ')
            setMessage({
                type: 'error',
                text: messagePrefix ? `${messagePrefix}: ${text}` : text,
            })
            return true
        },
        [formValues, scrollToInvalidField]
    )

    const activeStageDeIds = useMemo(
        () =>
            collectStageDataElementIds({
                sections: activeStage?.sections,
                dataElements: activeStage?.dataElements,
            }),
        [activeStage?.sections, activeStage?.dataElements]
    )

    const evaluateRulesForEventStatus = useCallback(
        (status) => {
            if (!metadata?.rules?.length || !metadata?.ruleVariables?.length) {
                return { ruleErrors: [], ruleWarnings: [] }
            }
            let valuesForRules = ruleFormValues
            if (
                status === 'COMPLETED' &&
                activeTab !== 'PROGRAM'
            ) {
                const base =
                    hasStiMedicineSlots && medicineSlots.length
                        ? sanitizeMedicineSlotFormValues(
                              medicineSlots,
                              formValues,
                              mergeSaveDe
                          )
                        : formValues
                valuesForRules = {
                    ...ruleFormValues,
                    ...augmentFormValuesForOmittedCompulsory(base, {
                        shouldOmitStageField,
                        mergeStageDe: mergeSaveDe,
                        stageDataElementIds: activeStageDeIds,
                        mandatoryFieldIds,
                        medicineDeToSlot,
                    }),
                }
            }
            return evaluateRules({
                rules: metadata.rules,
                variables: metadata.ruleVariables,
                formValues: valuesForRules,
                programStageId: activeTab !== 'PROGRAM' ? activeTab : null,
                sectionIdToProgramStageId: metadata.sectionIdToProgramStageId || null,
                dataElements: metadata.dataElements || null,
                attributes: metadata.attributes || null,
                ruleVarContext: { ...ruleVarContext, eventStatusOverride: status },
                dhis2Context,
            })
        },
        [
            metadata,
            ruleFormValues,
            activeTab,
            ruleVarContext,
            dhis2Context,
            hasStiMedicineSlots,
            medicineSlots,
            formValues,
            mergeSaveDe,
            shouldOmitStageField,
            activeStageDeIds,
            mandatoryFieldIds,
            medicineDeToSlot,
        ]
    )

    const buildEventDataValues = useCallback(
        (options = {}) => {
            const { formValuesOverride, ...payloadOptions } = options
            const sourceValues = formValuesOverride ?? formValues
            const valuesForSave =
                hasStiMedicineSlots && medicineSlots.length
                    ? sanitizeMedicineSlotFormValues(medicineSlots, sourceValues, mergeSaveDe)
                    : sourceValues
            const dataValues = buildEventDataValuesPayload({
                formValues: valuesForSave,
                existingDataValues: selectedEvent?.dataValues || [],
                shouldOmitStageField,
                mergeStageDe: mergeSaveDe,
                stageDataElementIds: activeStageDeIds,
                mandatoryFieldIds,
                medicineDeToSlot,
                ...payloadOptions,
            })
            return dataValues
        },
        [
            eventStatus,
            formValues,
            hasStiMedicineSlots,
            medicineSlots,
            selectedEvent?.dataValues,
            shouldOmitStageField,
            mergeSaveDe,
            activeStageDeIds,
            mandatoryFieldIds,
            medicineDeToSlot,
        ]
    )

    const trackerEventMutationBase = useCallback(
        () => ({
            engine,
            eventId: editingEventId,
            enrollmentId: enrollment.enrollment,
            orgUnit: context.orgUnit,
            program: context.program,
            stage: activeTab,
            date: eventDate || selectedEvent?.occurredAt || selectedEvent?.eventDate || new Date().toISOString().slice(0, 10),
        }),
        [
            engine,
            editingEventId,
            enrollment?.enrollment,
            context.orgUnit,
            context.program,
            activeTab,
            eventDate,
            selectedEvent?.occurredAt,
            selectedEvent?.eventDate,
        ]
    )

    const legacyEventMutationBase = useCallback(
        () => ({
            ...trackerEventMutationBase(),
            trackedEntity: tei?.trackedEntity || tei?.trackedEntityInstance,
        }),
        [trackerEventMutationBase, tei?.trackedEntity, tei?.trackedEntityInstance]
    )

    /** Persist stage edits via tracker import (omitted medicine rows are cleared explicitly). */
    const persistStageEventDataValues = useCallback(async () => {
        const dataValues = buildEventDataValues()
        await updateEvent({
            ...trackerEventMutationBase(),
            dataValues,
            status: eventStatus,
        })
        return dataValues
    }, [buildEventDataValues, trackerEventMutationBase, eventStatus])

    const refreshTeiAfterEventChange = useCallback(async () => {
        const freshTei = await fetchTei({
            engine,
            id: tei.trackedEntity,
            programId: context.program,
            fresh: true,
        })
        if (freshTei) {
            setTei(freshTei)
        }
        return freshTei
    }, [engine, tei.trackedEntity, context.program])

    const proceedCompleteVisit = useCallback(async () => {
        setCompleteWarningModalOpen(false)
        const open = normalizeLoadedEventStatus(eventStatus)
        if (OPEN_TRACKER_EVENT_STATUSES.has(open)) {
            incompleteEventStatusRef.current = open
        }

        if (!enrollment) return

        try {
            setSaving(true)
            setMessage(null)
            const valuesForComplete =
                hasStiMedicineSlots && medicineSlots.length
                    ? sanitizeMedicineSlotFormValues(medicineSlots, formValues, mergeSaveDe)
                    : formValues
            const dataValues = buildEventDataValues({
                formValuesOverride: valuesForComplete,
                fillOmittedCompulsory: true,
            })

            let savedEventId = editingEventId
            if (editingEventId) {
                await updateEvent({
                    ...trackerEventMutationBase(),
                    dataValues,
                    status: 'COMPLETED',
                })
            } else {
                const created = await createEvent({
                    engine,
                    enrollmentId: enrollment.enrollment,
                    orgUnit: context.orgUnit,
                    program: context.program,
                    stage: activeTab,
                    dataValues,
                    date: eventDate || new Date().toISOString().slice(0, 10),
                    status: 'COMPLETED',
                })
                savedEventId =
                    extractTrackerMutationReference(created, 'EVENT') || savedEventId
            }

            clearCurrentDraft()
            setEventStatus('COMPLETED')
            const freshTei = await refreshTeiAfterEventChange()
            const freshEnrollment =
                freshTei?.enrollments?.find((e) => e.enrollment === enrollment.enrollment) ||
                freshTei?.enrollments?.find((e) => e.program === context.program)
            if (!savedEventId && freshEnrollment) {
                const stageEvents = (freshEnrollment.events || []).filter(
                    (e) => e.programStage === activeTab
                )
                if (stageEvents.length) {
                    savedEventId = [...stageEvents].sort((a, b) => {
                        const ta = new Date(a.occurredAt || a.eventDate || 0).getTime()
                        const tb = new Date(b.occurredAt || b.eventDate || 0).getTime()
                        if (tb !== ta) return tb - ta
                        return String(b.event || '').localeCompare(String(a.event || ''))
                    })[0]?.event
                }
            }
            if (savedEventId) {
                setLastUpdatedEventId(savedEventId)
                setTimeout(() => setLastUpdatedEventId(null), 8000)
            }
            setEditingEventId(null)
            setIsAddingRecord(false)
            setMessage({ type: 'success', text: i18n.t('Visit completed successfully') })
            setTimeout(() => setMessage(null), 3000)
        } catch (error) {
            console.error('Failed to complete visit', error)
            setMessage({
                type: 'error',
                text: formatTrackerMutateError(
                    error,
                    i18n.t(
                        'Could not complete visit. Fill required fields in open sections, save, then complete.'
                    )
                ),
            })
            setTimeout(() => setMessage(null), 5000)
        } finally {
            setSaving(false)
        }
    }, [
        eventStatus,
        eventDate,
        editingEventId,
        enrollment,
        hasStiMedicineSlots,
        medicineSlots,
        mergeSaveDe,
        formValues,
        trackerEventMutationBase,
        buildEventDataValues,
        engine,
        context.orgUnit,
        context.program,
        activeTab,
        clearCurrentDraft,
        refreshTeiAfterEventChange,
    ])

    const handleCompleteToggle = useCallback(async () => {
        if (!enrollment || activeTab === 'PROGRAM') return
        if (!editingEventId) {
            setMessage({
                type: 'error',
                text: i18n.t('Please save record before completing'),
            })
            setTimeout(() => setMessage(null), 3000)
            return
        }

        if (eventStatus === 'COMPLETED') {
            try {
                setSaving(true)
                setMessage(null)
                const nextStatus = incompleteEventStatusRef.current || 'VISITED'
                const valuesForSave =
                    hasStiMedicineSlots && medicineSlots.length
                        ? sanitizeMedicineSlotFormValues(medicineSlots, formValues, mergeSaveDe)
                        : formValues
                const collapsed = computeMedicineSectionUnlockCap(
                    valuesForSave,
                    medicineSlots,
                    medicineSlotMax,
                    medicineSlotCapContext
                )
                manualMedicineRowsRef.current = collapsed
                setManualMedicineRows(collapsed)
                lastSanitizedMedicineEventRef.current = null
                const reopenDataValues = buildEventDataValues({ formValuesOverride: valuesForSave })
                await updateEvent({
                    ...trackerEventMutationBase(),
                    status: nextStatus,
                    dataValues: reopenDataValues,
                })
                setEventStatus(nextStatus)
                await refreshTeiAfterEventChange()
            } catch (error) {
                console.error('Failed to mark visit incomplete', error)
                setMessage({
                    type: 'error',
                    text: formatTrackerMutateError(error, i18n.t('Failed to update visit status'), {
                        completedEventHint: true,
                    }),
                })
                setTimeout(() => setMessage(null), 5000)
            } finally {
                setSaving(false)
            }
            return
        }

        const missing = listMissingStageFields({
            sections: activeStage?.sections || [],
            mergeStageDe: mergeSaveDe,
            formValues,
            mandatoryFieldIds,
            shouldOmitStageField,
            isMedicineSectionVisible,
            isSectionBodyUnlocked,
        })
        if (missing.length > 0) {
            setMissingForComplete(missing)
            setCompleteChecklistOpen(true)
            return
        }

        const fieldErr = validateVisibleStageFields()
        if (fieldErr) return

        const asComplete = evaluateRulesForEventStatus('COMPLETED')
        if (applyRuleFailure(
            errorsBlockingComplete(
                (asComplete.ruleErrors || []).filter((r) => !/\bPPW\b/i.test(String(r.text || '')))
            ),
            i18n.t('Cannot complete visit')
        )) {
            return
        }

        const completeWarnings = warningsOnComplete(asComplete.ruleWarnings)
        if (completeWarnings.length > 0) {
            const warnText = completeWarnings.map((w) => w.text).filter(Boolean).join('\n')
            setCompleteWarningText(warnText)
            setCompleteWarningModalOpen(true)
            return
        }

        await proceedCompleteVisit()
    }, [
        enrollment,
        activeTab,
        eventStatus,
        hasStiMedicineSlots,
        medicineSlots,
        formValues,
        mergeSaveDe,
        medicineSlotMax,
        medicineSlotCapContext,
        buildEventDataValues,
        trackerEventMutationBase,
        refreshTeiAfterEventChange,
        activeStage?.sections,
        mandatoryFieldIds,
        shouldOmitStageField,
        isMedicineSectionVisible,
        isSectionBodyUnlocked,
        validateVisibleStageFields,
        evaluateRulesForEventStatus,
        applyRuleFailure,
        proceedCompleteVisit,
        editingEventId,
    ])

    const handleSave = async () => {
        if (!enrollment || activeTab === 'PROGRAM') return

        if (isVisitFormLocked(eventStatus, eventDate, isDataEntryExperience)) {
            setMessage({
                type: 'error',
                text: i18n.t(
                    'This visit is complete — mark it incomplete before saving. Use the status button in the toolbar.'
                ),
            })
            setTimeout(() => setMessage(null), 5000)
            return
        }

        if (enrollmentDateStr && eventDate && eventDate < enrollmentDateStr) {
            setMessage({
                type: 'error',
                text: i18n.t(
                    'ថ្ងៃ ខែ ឆ្នាំ មកពិនិត្យ មិនអាចតូចជាងថ្ងៃចុះឈ្មោះទេ ({{date}})',
                    { date: enrollmentDateStr }
                ),
            })
            setTimeout(() => setMessage(null), 5000)
            return
        }

        try {
            setSaving(true)
            setMessage(null)
            setInvalidHighlightFieldId(null)
            invalidFieldBaselineRef.current = null

            const fieldErr = validateVisibleStageFields()
            if (fieldErr) {
                setSaving(false)
                return
            }

            // PPW (Partner of Pregnant Women) is valid for male patients — suppress incorrect server-side SHOWERROR.
            const saveRuleErrors = errorsBlockingSave(
                ruleErrors.filter((r) => !/\bPPW\b/i.test(String(r.text || ''))),
                eventStatus
            )
            if (applyRuleFailure(saveRuleErrors)) {
                setSaving(false)
                return
            }

            let savedEventId = editingEventId
            const valuesForSave =
                hasStiMedicineSlots && medicineSlots.length
                    ? sanitizeMedicineSlotFormValues(medicineSlots, formValues, mergeSaveDe)
                    : formValues
            if (valuesForSave !== formValues) {
                setFormValues(valuesForSave)
            }
            const isCompleting = String(eventStatus || '').toUpperCase() === 'COMPLETED'
            const dataValues = buildEventDataValues({
                formValuesOverride: valuesForSave,
                fillOmittedCompulsory: isCompleting,
            })
            if (editingEventId) {
                await updateEvent({
                    ...trackerEventMutationBase(),
                    dataValues,
                    status: eventStatus,
                })
            } else {
                const created = await createEvent({
                    engine,
                    enrollmentId: enrollment.enrollment,
                    orgUnit: context.orgUnit,
                    program: context.program,
                    stage: activeTab,
                    dataValues,
                    date: eventDate || new Date().toISOString().slice(0, 10),
                    status: eventStatus,
                })
                savedEventId =
                    extractTrackerMutationReference(created, 'EVENT') || savedEventId
            }

            clearCurrentDraft()
            setMessage({ type: 'success', text: i18n.t('Changes saved successfully') })
            setTimeout(() => setMessage(null), 3000)

            const freshTei = await refreshTeiAfterEventChange()
            const freshEnrollment =
                freshTei?.enrollments?.find((e) => e.enrollment === enrollment.enrollment) ||
                freshTei?.enrollments?.find((e) => e.program === context.program)
            if (!savedEventId && freshEnrollment) {
                const stageEvents = (freshEnrollment.events || []).filter(
                    (e) => e.programStage === activeTab
                )
                if (stageEvents.length) {
                    savedEventId = [...stageEvents].sort((a, b) => {
                        const ta = new Date(a.occurredAt || a.eventDate || 0).getTime()
                        const tb = new Date(b.occurredAt || b.eventDate || 0).getTime()
                        if (tb !== ta) return tb - ta
                        return String(b.event || '').localeCompare(String(a.event || ''))
                    })[0]?.event
                }
            }
            if (savedEventId) {
                setLastUpdatedEventId(savedEventId)
                setTimeout(() => setLastUpdatedEventId(null), 8000)
                setEditingEventId(savedEventId)
                setIsAddingRecord(false)
            }
            return true
        } catch (error) {
            console.error('Failed to save data', error)
            setMessage({
                type: 'error',
                text: formatTrackerMutateError(error, i18n.t('Failed to save changes')),
            })
            setTimeout(() => setMessage(null), 5000)
            return false
        } finally {
            setSaving(false)
        }
    }

    const visibleRuleErrors = useMemo(
        () =>
            ruleErrors.filter(
                (r) =>
                    (r.kind !== 'complete' || String(eventStatus).toUpperCase() === 'COMPLETED') &&
                    // PPW is valid for male patients — suppress incorrect server-side SHOWERROR
                    !/\bPPW\b/i.test(String(r.text || ''))
            ),
        [ruleErrors, eventStatus]
    )

    const visibleRuleWarnings = useMemo(
        () =>
            ruleWarnings.filter(
                (r) => r.kind !== 'complete' || String(eventStatus).toUpperCase() === 'COMPLETED'
            ),
        [ruleWarnings, eventStatus]
    )

    const assignedKey = useMemo(() => JSON.stringify(assignedValues), [assignedValues])

    useEffect(() => {
        if (assignedKey === '{}') return
        const parsed = JSON.parse(assignedKey)

        if (activeTab === 'PROGRAM') {
            const attrIds = new Set((metadata?.attributes || []).map((a) => a.id).filter(Boolean))
            const teaEntries = Object.entries(parsed).filter(([k]) => attrIds.has(k))
            if (teaEntries.length === 0) return
            if (editingProfile) {
                setProfileAttrValues((prev) =>
                    applyRuleAssignedValues(prev, Object.fromEntries(teaEntries), {
                        attributeIds: attrIds,
                    })
                )
                return
            }
            setTei((prev) => {
                if (!prev?.attributes) return prev
                let changed = false
                const nextAttrs = prev.attributes.map((entry) => {
                    const id = trackedEntityAttributeIdFromEntry(entry)
                    if (!id || !Object.prototype.hasOwnProperty.call(parsed, id)) return entry
                    const nv = parsed[id]
                    if (String(entry.value ?? '') === String(nv ?? '')) return entry
                    changed = true
                    return { ...entry, value: nv }
                })
                return changed ? { ...prev, attributes: nextAttrs } : prev
            })
            return
        }

        if (!editingEventId && !isAddingRecord) return

        const attrIds = new Set((metadata?.attributes || []).map((a) => a.id).filter(Boolean))
        const deMap = metadata?.dataElements || {}

        const teaEntries = Object.entries(parsed).filter(([k]) => attrIds.has(k))
        if (teaEntries.length > 0) {
            setTei((prev) => {
                if (!prev?.attributes) return prev
                let changed = false
                const nextAttrs = prev.attributes.map((entry) => {
                    const id = trackedEntityAttributeIdFromEntry(entry)
                    if (!id || !Object.prototype.hasOwnProperty.call(parsed, id)) return entry
                    const nv = parsed[id]
                    if (String(entry.value ?? '') === String(nv ?? '')) return entry
                    changed = true
                    return { ...entry, value: nv }
                })
                return changed ? { ...prev, attributes: nextAttrs } : prev
            })
        }

        setFormValues((prev) =>
            applyRuleAssignedValues(prev, parsed, {
                dataElements: deMap,
                attributeIds: attrIds,
            })
        )
    }, [assignedKey, activeTab, editingEventId, isAddingRecord, editingProfile, metadata?.attributes, metadata?.dataElements])

    const prevHiddenFieldsRef = useRef(new Set())
    const prevUiLanguageRef = useRef(i18n.language)

    useEffect(() => {
        if (activeTab === 'PROGRAM') return
        if (!editingEventId && !isAddingRecord) return

        const languageChanged = prevUiLanguageRef.current !== i18n.language
        prevUiLanguageRef.current = i18n.language
        const prevHidden = prevHiddenFieldsRef.current
        prevHiddenFieldsRef.current = new Set(hiddenFields)

        const deMap = metadata?.dataElements || {}
        setFormValues((prev) => {
            let next = null
            for (const id of hiddenFields) {
                if (!deMap[id]) continue
                if (sectionGateDeIds.has(id)) continue
                if (languageChanged) continue
                if (prevHidden.has(id)) continue
                const cur = prev[id]
                if (cur !== '' && cur != null) {
                    if (!next) next = { ...prev }
                    next[id] = ''
                }
            }
            return next || prev
        })
    }, [
        hiddenFieldsKey,
        activeTab,
        editingEventId,
        isAddingRecord,
        metadata?.dataElements,
        i18n.language,
        sectionGateDeIds,
    ])

    const programStages = useMemo(() => {
        if (!metadata?.stages) return []
        return metadata.stages.filter((s) => !hiddenProgramStages.has(s.id))
    }, [metadata, hiddenProgramStages])

    const initialStageProcessedTeiIdRef = useRef(null)

    useEffect(() => {
        if (!metadata || !programStages.length) return
        const teiId =
            initialTei?.trackedEntity ||
            initialTei?.trackedEntityInstance ||
            (typeof initialTei === 'string' ? initialTei : initialTei?.id)
        if (initialTei?.initialStageId && initialStageProcessedTeiIdRef.current !== `${teiId}:${initialTei.initialStageId}`) {
            initialStageProcessedTeiIdRef.current = `${teiId}:${initialTei.initialStageId}`
            setActiveTab(initialTei.initialStageId)
            if (initialTei.selectedEventId) {
                setEditingEventId(initialTei.selectedEventId)
                setExpandedEventIds(new Set([initialTei.selectedEventId]))
            }
        } else if (initialTei?.goToFirstStage && initialStageProcessedTeiIdRef.current !== teiId) {
            initialStageProcessedTeiIdRef.current = teiId
            const firstStage = programStages[0]
            if (firstStage) {
                setActiveTab(firstStage.id)
                const dateToSet =
                    initialTei?.registrationDate ||
                    enrollmentDateStr ||
                    new Date().toISOString().slice(0, 10)
                setEventDate(dateToSet)
                setFormValues({})
                setIsAddingRecord(true)
            }
        }
    }, [metadata, programStages, initialTei, enrollmentDateStr])

    const nextProgramStage = useMemo(
        () => getNextProgramStage(activeTab !== 'PROGRAM' ? activeTab : null, programStages),
        [activeTab, programStages]
    )

    const handleSaveAndNext = async () => {
        if (!nextProgramStage) return
        const ok = await handleSave()
        if (ok) {
            setActiveTab(nextProgramStage.id)
            startAddNewRecord()
        }
    }

    useEffect(() => {
        if (activeTab === 'PROGRAM') return
        const stillVisible = programStages.some((s) => s.id === activeTab)
        if (!stillVisible) {
            setActiveTab('PROGRAM')
            setEditingEventId(null)
            setIsAddingRecord(false)
        }
    }, [activeTab, programStages])

    const filteredEvents = useMemo(() => {
        if (activeTab === 'PROGRAM') return events
        return events.filter(e => e.programStage === activeTab)
    }, [events, activeTab])

    /** Same scope as registration: program Maintenance sections, minus program-rule hidden attributes. */
    const visibleProfileAttributes = useMemo(() => {
        if (!metadata?.attributes?.length) return []
        const allAttrs = metadata.attributes
        const byId = new Map(allAttrs.map((a) => [a.id, a]))
        const ps = metadata.programSections
        if (!ps?.length) {
            return allAttrs.filter((a) => !hiddenFields.has(a.id))
        }
        const out = []
        for (const s of ps) {
            const ids = s.trackedEntityAttributeIds || []
            for (const id of ids) {
                if (hiddenFields.has(id)) continue
                const a = byId.get(id)
                if (a) out.push(a)
            }
        }
        return out
    }, [metadata, hiddenFields])

    const profilePageTitle = useMemo(() => {
        if (!tei) return i18n.t('Patient Profile')
        for (const attr of visibleProfileAttributes) {
            const val = getAttributeValue(tei, attr.id)
            if (val && val !== '-') return String(val)
        }
        const id = tei.trackedEntity || tei.trackedEntityInstance
        return id ? String(id) : i18n.t('Patient Profile')
    }, [tei, visibleProfileAttributes])

    const profileAttributeIds = useMemo(
        () => new Set((metadata?.attributes || []).map((a) => a.id).filter(Boolean)),
        [metadata?.attributes]
    )

    const isSuppressedRuleWarning = (r) => {
        const text = String(r?.text || '').trim()
        if (!text) return true
        const lower = text.toLowerCase()
        if (lower.includes('uuic wrong')) return true
        if (text.includes('មានកត្តាប្រព្រឹត្តប្រឈម')) return true
        if (text.includes('បើ មាន(បាទ/ចាស') || text.includes('បើ មាន(បាទ/ចាស )')) return true
        return false
    }

    const profileRuleErrors = useMemo(
        () =>
            ruleErrors.filter(
                (r) =>
                    (!r.fieldId || profileAttributeIds.has(r.fieldId)) &&
                    !String(r.text || '').toLowerCase().includes('uuic wrong') &&
                    // PPW is valid for male patients — suppress incorrect server-side SHOWERROR
                    !/\bPPW\b/i.test(String(r.text || ''))
            ),
        [ruleErrors, profileAttributeIds]
    )

    const profileRuleWarnings = useMemo(
        () => ruleWarnings.filter((r) => (!r.fieldId || profileAttributeIds.has(r.fieldId)) && !isSuppressedRuleWarning(r)),
        [ruleWarnings, profileAttributeIds]
    )

    const displayedRuleErrors = (activeTab === 'PROGRAM' && editingProfile ? profileRuleErrors : visibleRuleErrors).filter(
        (r) => !String(r.text || '').toLowerCase().includes('uuic wrong')
    )
    const displayedRuleWarnings = (activeTab === 'PROGRAM' && editingProfile ? profileRuleWarnings : visibleRuleWarnings).filter(
        (r) => !isSuppressedRuleWarning(r)
    )

    const handleStartEditProfile = () => {
        if (profileExpired) {
            setMessage({
                type: 'error',
                text: i18n.t('This profile record is older than 2 weeks and can no longer be edited.'),
            })
            setTimeout(() => setMessage(null), 5000)
            return
        }
        if (!metadata?.attributes?.length) return
        const ids = metadata.attributes.map((a) => a.id).filter(Boolean)
        setProfileAttrValues(profileAttributeValuesFromTei(tei, ids))
        setInvalidProfileAttrHighlightId(null)
        invalidProfileAttrBaselineRef.current = null
        setEditingProfile(true)
        setMessage(null)
    }

    const handleCancelEditProfile = () => {
        setEditingProfile(false)
        setProfileAttrValues({})
        setInvalidProfileAttrHighlightId(null)
        invalidProfileAttrBaselineRef.current = null
        setMessage(null)
    }

    const handleSaveProfile = async () => {
        const teiId = tei?.trackedEntity || tei?.trackedEntityInstance
        if (!teiId || !metadata) return
        if (profileExpired) {
            setMessage({
                type: 'error',
                text: i18n.t('This profile record is older than 2 weeks and can no longer be edited.'),
            })
            setTimeout(() => setMessage(null), 5000)
            return
        }

        try {
            setSaving(true)
            setMessage(null)
            setInvalidProfileAttrHighlightId(null)
            invalidProfileAttrBaselineRef.current = null

            for (const attr of visibleProfileAttributes) {
                const err = validateFieldValue(profileAttrValues[attr.id], {
                    mandatory: Boolean(attr.mandatory) || mandatoryFieldSetHas(mandatoryFieldIds, attr.id),
                    pattern: attr.pattern,
                    valueType: attr.valueType,
                    name: attr.name,
                })
                if (err) {
                    invalidProfileAttrBaselineRef.current = profileAttrValues[attr.id] ?? ''
                    setInvalidProfileAttrHighlightId(attr.id)
                    setMessage({ type: 'error', text: err })
                    setSaving(false)
                    scrollToInvalidField('attr', attr.id)
                    return
                }
            }

            if (profileRuleErrors.length > 0) {
                const withField = profileRuleErrors.find((r) => r.fieldId)
                const fid = withField?.fieldId
                if (fid) {
                    invalidProfileAttrBaselineRef.current = profileAttrValues[fid] ?? ''
                    setInvalidProfileAttrHighlightId(fid)
                }
                setMessage({
                    type: 'error',
                    text: profileRuleErrors.map((r) => r.text).filter(Boolean).join(' · '),
                })
                setSaving(false)
                if (fid) scrollToInvalidField('attr', fid)
                return
            }

            const attributes = buildTrackedEntityAttributesPayload(
                profileAttrValues,
                visibleProfileAttributes,
                hiddenFields,
                mandatoryFieldIds,
                profileAttributeIds
            )

            await updateTrackedEntity({
                engine,
                trackedEntityId: teiId,
                orgUnit: enrollment?.orgUnit || tei?.orgUnit || context.orgUnit,
                trackedEntityType:
                    tei?.trackedEntityType || metadata?.trackedEntityType || context.trackedEntityType,
                attributes,
            })

            const freshTei = await fetchTei({
                engine,
                id: teiId,
                programId: context.program,
                fresh: true,
            })
            if (freshTei) setTei(freshTei)

            setEditingProfile(false)
            setProfileAttrValues({})
            setMessage({ type: 'success', text: i18n.t('Changes saved successfully') })
            setTimeout(() => setMessage(null), 3000)
            onUpdateSuccess?.(teiId, { keepDetail: true, tei: freshTei })
        } catch (error) {
            console.error('Failed to save profile', error)
            setMessage({
                type: 'error',
                text: formatTrackerMutateError(error, i18n.t('Failed to save changes')),
            })
            setTimeout(() => setMessage(null), 5000)
        } finally {
            setSaving(false)
        }
    }

    const deleteTeiModal =
        deleteTeiModalOpen && typeof document !== 'undefined'
            ? createPortal(
                  <div
                      className="modal-backdrop fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[4px]"
                      onClick={closeDeleteTeiModal}
                      role="presentation"
                  >
                      <div
                          className="modal-panel w-full max-w-md rounded-3xl border border-white/20 bg-white shadow-2xl overflow-hidden dark:border-zinc-800 dark:bg-zinc-900"
                          onClick={(e) => e.stopPropagation()}
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="delete-tei-modal-title"
                          aria-describedby="delete-tei-modal-desc"
                      >
                          <div className="relative border-b border-slate-100 bg-slate-50/50 px-6 pb-4 pt-6 dark:border-zinc-800 dark:bg-zinc-900/80">
                              <div className="mb-1 flex items-center gap-3">
                                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-white shadow-md shadow-red-900/20">
                                      <Trash2 className="h-5 w-5" strokeWidth={2} aria-hidden />
                                  </div>
                                  <h2
                                      id="delete-tei-modal-title"
                                      className="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100"
                                  >
                                      {i18n.t('Delete profile')}
                                  </h2>
                              </div>
                              <p
                                  id="delete-tei-modal-desc"
                                  className="pl-[52px] text-[13px] font-medium leading-relaxed text-slate-600 dark:text-zinc-400"
                              >
                                  {i18n.t(
                                      'Delete this person from the system? Enrollments and events will be removed if your account is allowed to do so. This cannot be undone.'
                                  )}
                              </p>
                          </div>
                          <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
                              <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-9 border-slate-200 px-4 dark:border-zinc-700 dark:text-zinc-300"
                                  disabled={deletingTei}
                                  onClick={closeDeleteTeiModal}
                              >
                                  {i18n.t('Cancel')}
                              </Button>
                              <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  className="h-9 gap-2 border-0 bg-red-600 px-4 font-semibold text-white shadow-sm hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:opacity-60"
                                  disabled={deletingTei}
                                  onClick={confirmDeleteTrackedEntity}
                              >
                                  {deletingTei ? (
                                      <>
                                          <Spinner className="h-3.5 w-3.5 border-white/30 border-t-white" />
                                          {i18n.t('Deleting...')}
                                      </>
                                  ) : (
                                      i18n.t('Delete')
                                  )}
                              </Button>
                          </div>
                      </div>
                  </div>,
                  document.body
              )
            : null

    const eventCreationDateStr = useMemo(() => {
        const raw = getEventCreationDate(selectedEvent)
        if (!raw) return eventDate || '-'
        try {
            return new Date(raw).toISOString().slice(0, 10)
        } catch {
            return String(raw).slice(0, 10)
        }
    }, [selectedEvent, eventDate])

    const eventExpiryDateStr = useMemo(() => {
        const raw = getEventCreationDate(selectedEvent)
        if (!raw) return '-'
        try {
            const d = new Date(raw)
            d.setDate(d.getDate() + 14)
            return d.toISOString().slice(0, 10)
        } catch {
            return '-'
        }
    }, [selectedEvent])

    const deleteEventModal =
        deleteEventModalOpen && typeof document !== 'undefined'
            ? createPortal(
                  <div
                      className="modal-backdrop fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[4px]"
                      onClick={() => setDeleteEventModalOpen(false)}
                      role="presentation"
                  >
                      <div
                          className="modal-panel w-full max-w-lg rounded-3xl border border-white/20 bg-white shadow-2xl overflow-hidden dark:border-zinc-800 dark:bg-zinc-900"
                          onClick={(e) => e.stopPropagation()}
                          role="dialog"
                          aria-modal="true"
                      >
                          {/* Header */}
                          <div className="relative border-b border-slate-100 bg-slate-50/70 px-6 pb-4 pt-6 dark:border-zinc-800 dark:bg-zinc-900/80">
                              <div className="flex items-center gap-3">
                                  <div
                                      className={cn(
                                          'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-md',
                                          eventDeletePermission.canDelete
                                              ? 'bg-red-600 shadow-red-900/20'
                                              : 'bg-amber-500 shadow-amber-900/20'
                                      )}
                                  >
                                      {eventDeletePermission.canDelete ? (
                                          <Trash2 className="h-5 w-5" strokeWidth={2.2} aria-hidden />
                                      ) : (
                                          <ShieldAlert className="h-5 w-5" strokeWidth={2.2} aria-hidden />
                                      )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                                              {eventDeletePermission.canDelete
                                                  ? i18n.t('Delete Record')
                                                  : i18n.t('Cannot Delete Record')}
                                          </h2>
                                          {selectedEvent?.event && (
                                              <span className="rounded-md bg-slate-200/70 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700 dark:bg-zinc-800 dark:text-zinc-300">
                                                  #{selectedEvent.event.slice(-6)}
                                              </span>
                                          )}
                                      </div>
                                      <p className="text-[13px] text-slate-500 dark:text-zinc-400">
                                          {eventDeletePermission.canDelete
                                              ? i18n.t('Are you sure you want to delete this record?')
                                              : i18n.t('This record exceeds the 2-week deletion limit.')}
                                      </p>
                                  </div>
                              </div>
                          </div>

                          {/* Body */}
                          <div className="space-y-4 px-6 py-5">
                              {/* Countdown Insight Card */}
                              {eventDeletePermission.reason === 'WITHIN_2_WEEKS' && (
                                  <div className="overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 via-teal-50/40 to-emerald-50/60 p-4 dark:border-emerald-900/40 dark:from-emerald-950/40 dark:to-emerald-950/20">
                                      <div className="flex items-start justify-between gap-2 mb-3">
                                          <div className="flex items-center gap-2">
                                              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-900/20">
                                                  <Timer className="h-4 w-4" />
                                              </div>
                                              <div>
                                                  <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                                                      {i18n.t('Countdown (2-Week Limit)')}
                                                  </div>
                                                  <div className="text-xs text-emerald-700/80 dark:text-emerald-400">
                                                      {i18n.t('Allowed for Tracker Capture role')}
                                                  </div>
                                              </div>
                                          </div>
                                          <div className="text-right">
                                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-sm font-bold text-white shadow-sm">
                                                  {i18n.t('Remaining')}: {eventDeletePermission.daysRemaining} {i18n.t('Day(s)')}
                                              </span>
                                          </div>
                                      </div>

                                      {/* Progress / Timeline Bar */}
                                      <div className="space-y-1.5">
                                          <div className="flex items-center justify-between text-[11px] font-medium text-emerald-900 dark:text-emerald-300">
                                              <span>{i18n.t('Day')} {eventDeletePermission.ageInDays} / 14</span>
                                              <span>{Math.round(((14 - (eventDeletePermission.daysRemaining || 0)) / 14) * 100)}% {i18n.t('Elapsed')}</span>
                                          </div>
                                          <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-200/70 dark:bg-emerald-900/60">
                                              <div
                                                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500"
                                                  style={{
                                                      width: `${Math.min(100, Math.max(8, Math.round(((14 - (eventDeletePermission.daysRemaining || 0)) / 14) * 100)))}%`,
                                                  }}
                                              />
                                          </div>
                                          <div className="flex justify-between text-[10px] text-emerald-700/70 dark:text-emerald-400/80">
                                              <span>{i18n.t('Created')}: {eventCreationDateStr}</span>
                                              <span>{i18n.t('Expires')}: {eventExpiryDateStr}</span>
                                          </div>
                                      </div>
                                  </div>
                              )}

                              {/* Expired Warning Banner */}
                              {!eventDeletePermission.canDelete && (
                                  <div className="overflow-hidden rounded-2xl border border-red-200 bg-red-50/90 p-4 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                                      <div className="flex items-start gap-3">
                                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white shadow-sm shadow-red-900/20 mt-0.5">
                                              <AlertTriangle className="h-4 w-4" />
                                          </div>
                                          <div className="space-y-1">
                                              <div className="flex items-center gap-2">
                                                  <span className="text-sm font-bold text-red-800 dark:text-red-200">
                                                      {i18n.t('Exceeded 2-Week Window')} ({eventDeletePermission.ageInDays} {i18n.t('days ago')})
                                                  </span>
                                              </div>
                                              <p className="text-xs leading-relaxed text-red-700 dark:text-red-300">
                                                  {i18n.t(
                                                      'This record was created {{days}} days ago. Tracker Capture role can only delete records within 14 days of creation. Please contact a System Administrator if deletion is required.',
                                                      { days: eventDeletePermission.ageInDays }
                                                  )}
                                              </p>
                                          </div>
                                      </div>
                                  </div>
                              )}

                              {/* Admin Badge */}
                              {eventDeletePermission.reason === 'ADMIN' && (
                                  <div className="flex items-center justify-between rounded-2xl border border-blue-200/80 bg-blue-50/80 p-3.5 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
                                      <span className="flex items-center gap-2 font-medium">
                                          <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                          {i18n.t('Administrator Permission')}:
                                      </span>
                                      <span className="font-semibold text-blue-700 dark:text-blue-300">
                                          {i18n.t('No time limit')} ({eventDeletePermission.ageInDays} {i18n.t('days ago')})
                                      </span>
                                  </div>
                              )}

                              {/* Metadata summary list */}
                              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 text-xs text-slate-600 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400 space-y-2">
                                  <div className="flex items-center justify-between">
                                      <span className="flex items-center gap-1.5 font-medium text-slate-500 dark:text-zinc-400">
                                          <Calendar className="h-3.5 w-3.5" />
                                          {i18n.t('Created Date')}:
                                      </span>
                                      <span className="font-semibold text-slate-800 dark:text-zinc-200">
                                          {eventCreationDateStr}
                                      </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                      <span className="flex items-center gap-1.5 font-medium text-slate-500 dark:text-zinc-400">
                                          <Clock className="h-3.5 w-3.5" />
                                          {i18n.t('Days Since Creation')}:
                                      </span>
                                      <span className="font-semibold text-slate-800 dark:text-zinc-200">
                                          {eventDeletePermission.ageInDays === 0
                                              ? i18n.t('Created today (0 days)')
                                              : `${eventDeletePermission.ageInDays} ${i18n.t('day(s) ago')}`}
                                      </span>
                                  </div>
                              </div>
                          </div>

                          {/* Footer */}
                          <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
                              <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-9 border-slate-200 px-4 dark:border-zinc-700 dark:text-zinc-300"
                                  disabled={saving}
                                  onClick={() => setDeleteEventModalOpen(false)}
                              >
                                  {eventDeletePermission.canDelete ? i18n.t('Cancel') : i18n.t('Close')}
                              </Button>
                              {eventDeletePermission.canDelete && (
                                  <Button
                                      type="button"
                                      variant="destructive"
                                      size="sm"
                                      className="h-9 gap-2 border-0 bg-red-600 px-4 font-semibold text-white shadow-sm hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:opacity-60"
                                      disabled={saving}
                                      onClick={confirmDeleteEvent}
                                  >
                                      {saving ? (
                                          <>
                                              <Spinner className="h-3.5 w-3.5 border-white/30 border-t-white" />
                                              {i18n.t('Deleting...')}
                                          </>
                                      ) : (
                                          i18n.t('OK')
                                      )}
                                  </Button>
                              )}
                          </div>
                      </div>
                  </div>,
                  document.body
              )
            : null

    const completeWarningModal =
        completeWarningModalOpen && typeof document !== 'undefined'
            ? createPortal(
                  <div
                      className="modal-backdrop fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[4px]"
                      onClick={() => setCompleteWarningModalOpen(false)}
                      role="presentation"
                  >
                      <div
                          className="modal-panel w-full max-w-md rounded-3xl border border-white/20 bg-white shadow-2xl overflow-hidden dark:border-zinc-800 dark:bg-zinc-900"
                          onClick={(e) => e.stopPropagation()}
                          role="dialog"
                          aria-modal="true"
                      >
                          <div className="relative border-b border-slate-100 bg-slate-50/50 px-6 pb-4 pt-6 dark:border-zinc-800 dark:bg-zinc-900/80">
                              <div className="mb-1 flex items-center gap-3">
                                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md shadow-amber-900/20">
                                      <AlertTriangle className="h-5 w-5" strokeWidth={2} aria-hidden />
                                  </div>
                                  <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                                      {i18n.t('There are validation warnings')}
                                  </h2>
                              </div>
                              <div className="pl-[52px] pr-2 text-[13px] font-medium leading-relaxed text-slate-600 dark:text-zinc-300 whitespace-pre-line">
                                  {completeWarningText}
                              </div>
                              <p className="pl-[52px] pt-3 text-[13px] font-bold text-slate-800 dark:text-zinc-200">
                                  {i18n.t('Complete anyway?')}
                              </p>
                          </div>
                          <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
                              <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-9 border-slate-200 px-4 dark:border-zinc-700 dark:text-zinc-300"
                                  disabled={saving}
                                  onClick={() => setCompleteWarningModalOpen(false)}
                              >
                                  {i18n.t('Cancel')}
                              </Button>
                              <Button
                                  type="button"
                                  variant="default"
                                  size="sm"
                                  className="h-9 gap-2 border-0 bg-emerald-600 px-4 font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-60"
                                  disabled={saving}
                                  onClick={proceedCompleteVisit}
                              >
                                  {saving ? (
                                      <>
                                          <Spinner className="h-3.5 w-3.5 border-white/30 border-t-white" />
                                          {i18n.t('Saving...')}
                                      </>
                                  ) : (
                                      i18n.t('OK')
                                  )}
                              </Button>
                          </div>
                      </div>
                  </div>,
                  document.body
              )
            : null

    return (
        <>
        <ProgramRulesReferencePanel
            open={programRulesPanelOpen}
            onClose={() => setProgramRulesPanelOpen(false)}
            metadata={metadata}
            programId={context.program}
        />
        <div className={cn('relative flex min-h-0 flex-1 flex-col overflow-hidden', PAGE_LAYOUT.stack)}>
            {message && (
                <div className={`fixed top-12 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl shadow-slate-900/10 animate-in slide-in-from-top-4 fade-in duration-300 border ${message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${message.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                        {message.type === 'success' ? <CheckIcon className="w-5 h-5" /> : <Cross2Icon className="w-5 h-5" />}
                    </div>
                    <div className="flex flex-col justify-center pr-4">
                        <span className={FORM.toastTitle}>{message.type === 'success' ? i18n.t('Success') : i18n.t('Error')}</span>
                        <span className={FORM.toastBody}>{message.text}</span>
                    </div>
                </div>
            )}

            <div className="flex shrink-0 flex-col">
                <ProfileDetailHeader
                    pageTitle={profilePageTitle}
                    onBack={onBack}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    programStages={programStages}
                    events={events}
                    sidebarOpen={sidebarOpen}
                    onToggleSidebar={() => setSidebarOpen((v) => !v)}
                    metadataLoading={loading}
                    metadata={metadata}
                    onOpenProgramRules={() => setProgramRulesPanelOpen(true)}
                    onPrintSummary={() => setPrintModalOpen(true)}
                    editingEventId={editingEventId}
                    eventDate={eventDate}
                    isAddingRecord={isAddingRecord}
                    eventStatus={eventStatus}
                    saving={saving}
                    onCompleteToggle={handleCompleteToggle}
                    onCancelEdit={() => {
                        if (isAddingRecord) {
                            clearCurrentDraft()
                        }
                        setDraftRestoredNotice(false)
                        setEditingEventId(null)
                        setIsAddingRecord(false)
                    }}
                    onDelete={handleDelete}
                    onSave={handleSave}
                    onAddRecord={startAddNewRecord}
                    editingProfile={editingProfile}
                    deletingTei={deletingTei}
                    deleteTeiModalOpen={deleteTeiModalOpen}
                    profileLoading={loading}
                    onStartEditProfile={handleStartEditProfile}
                    onCancelEditProfile={handleCancelEditProfile}
                    onSaveProfile={handleSaveProfile}
                    onDeleteProfile={openDeleteTeiModal}
                    isDataEntryExperience={isDataEntryExperience}
                    profileExpired={profileExpired}
                    selectedEvent={selectedEvent}
                />

                <ProfileRuleAlerts errors={displayedRuleErrors} warnings={displayedRuleWarnings} />
            </div>

            <div className="flex min-h-0 flex-1 flex-row overflow-hidden gap-3">
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div
                        className={cn(
                        PAGE_LAYOUT.contentCard,
                        loading
                            ? 'overflow-hidden'
                            : activeTab === 'PROGRAM'
                              ? 'flex min-h-0 flex-1 flex-col overflow-hidden pb-[max(0.5rem,env(safe-area-inset-bottom))] md:pb-0'
                              : 'flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5 pb-28 custom-scrollbar sm:p-3 md:p-4 md:pb-4'
                    )}
                >
                {loading ? (
                    <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-slate-50/50 dark:bg-zinc-950/50">
                        <Spinner />
                        <span className={cn('mt-4 animate-pulse', FORM.loadingText)}>
                            {i18n.t('Fetching Patient Profile...')}
                        </span>
                    </div>
                ) : activeTab === 'PROGRAM' ? (
                    <div className="app-form-surface flex min-h-0 flex-1 flex-col">
                        <ProfileSummaryCard
                            embedded
                            className="min-h-0 flex-1"
                            context={context}
                            metadata={metadata}
                            tei={tei}
                            enrollment={enrollment}
                            visibleProfileAttributes={visibleProfileAttributes}
                            editingProfile={editingProfile}
                            onStartEditProfile={handleStartEditProfile}
                            onSaveProfile={handleSaveProfile}
                            onCancelEditProfile={handleCancelEditProfile}
                            saving={saving}
                            profileAttrValues={profileAttrValues}
                            setProfileAttrValues={setProfileAttrValues}
                            hiddenFields={hiddenFields}
                            mandatoryFieldIds={mandatoryFieldIds}
                            hiddenOptionsByField={hiddenOptionsByField}
                            invalidProfileAttrHighlightId={invalidProfileAttrHighlightId}
                            setInvalidProfileAttrHighlightId={setInvalidProfileAttrHighlightId}
                            invalidProfileAttrBaselineRef={invalidProfileAttrBaselineRef}
                            getAttributeValue={getAttributeValue}
                            isAdmin={Boolean(isSuperuser && !isDataEntryExperience)}
                            isSuperuser={Boolean(isSuperuser && !isDataEntryExperience)}
                            isDataEntryExperience={isDataEntryExperience}
                            profileExpired={profileExpired}
                        />
                        {enrollment?.notes?.length > 0 ? (
                            <div
                                className={cn(
                                    'mb-0 mt-3 flex shrink-0 flex-col gap-2 rounded-lg border border-slate-200/90 app-surface dark:border-[color:var(--app-border)]',
                                    PAGE_LAYOUT.insetNotice,
                                    'md:mt-4'
                                )}
                            >
                                <h3 className={FORM.sectionBarTitle}>{i18n.t('Entry Comments')}</h3>
                                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
                                    {enrollment.notes.map((note, i) => (
                                        <div
                                            key={i}
                                            className="flex flex-col gap-1.5 rounded-lg border border-slate-200/90 bg-slate-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-900/50"
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium text-[var(--app-header-bar-bg)]">{note.storedBy}</span>
                                                <span className="text-sm font-normal app-text-meta">
                                                    {note.storedDate?.split('T')[0]}
                                                </span>
                                            </div>
                                            <p className="text-sm font-normal leading-relaxed italic app-text-label">
                                                "{note.value}"
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>
                ) : (
                    <div className="flex flex-1 min-h-0 flex-col gap-3">
                        {(() => {
                            const currentEventObj = isAddingRecord ? null : (selectedEvent || { status: eventStatus, eventDate })
                            const visitLocked = isVisitFormLocked(currentEventObj, isDataEntryExperience)
                            const lockReason = getVisitFormLockReason(currentEventObj, isDataEntryExperience)
                            const showLockBanner = Boolean(editingEventId && visitLocked)
                            const showDraftBanner = Boolean(!visitLocked && draftRestoredNotice)

                            if (!showLockBanner && !showDraftBanner) return null

                            if (showLockBanner) {
                                return (
                                    <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200/90 bg-emerald-50 px-3.5 py-2 text-xs leading-snug text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                                        <span className="font-medium">
                                            {lockReason === 'EXPIRED'
                                                ? i18n.t('This event is older than 2 weeks and can no longer be edited.')
                                                : i18n.t('This visit is complete. Use the status button in the toolbar to mark it incomplete before editing.')}
                                        </span>
                                    </div>
                                )
                            }

                            return (
                                <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200/90 bg-amber-50/90 px-3.5 py-2 text-xs text-amber-900 shadow-2xs dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
                                    <span className="font-medium">{i18n.t('Restored unsaved draft data')}</span>
                                    <button
                                        type="button"
                                        className="font-bold text-amber-800 underline hover:text-amber-950 dark:text-amber-300 dark:hover:text-white shrink-0 ml-auto"
                                        onClick={handleDiscardDraft}
                                    >
                                        {i18n.t('Discard draft')}
                                    </button>
                                </div>
                            )
                        })()}

                        {/* Event List or Detail Form */}
                        {(editingEventId || isAddingRecord) ? (
                            <div
                                ref={stageFormScrollRef}
                                className={cn(
                                    'app-form-surface flex flex-col gap-1.5 animate-in fade-in slide-in-from-right-4 duration-300 pb-20 md:pb-2 [overflow-anchor:auto]',
                                    isPaperFormStage(activeTab) && 'paper-form-ui w-full max-w-none'
                                )}
                            >
                                {(() => {
                                    const activeStage = programStages.find((s) => s.id === activeTab)
                                    const sections = activeStage?.sections || []
                                    const isPaperFormActive = isPaperFormStage(activeTab)
                                    const paperFormOpts = { medicineDeToSlot, medicineSlots }
                                    const mergeStageDe = (deId) => mergeSaveDe(deId)
                                    const visibleSections = stageVisibleSections
                                        .map((s) => sections.find((sec) => sec.id === s.id))
                                        .filter(Boolean)
                                    const currentEventObj = isAddingRecord ? null : (selectedEvent || { status: eventStatus, eventDate })
                                    const stageFormReadOnly = isVisitFormLocked(currentEventObj, isDataEntryExperience)
                                    const sectionCardClass = stageFormReadOnly
                                        ? FORM.visitCompleteSectionCard
                                        : FORM.sectionCardShell
                                    const sectionHeaderClass = stageFormReadOnly
                                        ? FORM.visitCompleteSectionHeaderBar
                                        : FORM.sectionHeaderBar
                                    const sectionGridClass = stageFormReadOnly
                                        ? FORM.visitCompleteSectionBodyGrid
                                        : FORM.sectionBodyGrid
                                    const fieldRowClass = stageFormReadOnly
                                        ? FORM.visitCompleteFieldRow
                                        : FORM.fieldRow
                                    const renderField = (
                                        de,
                                        fieldLayout = 'default',
                                        inMedicineGrid = false,
                                        inPaperSection = false,
                                        sectionGateOpen = false,
                                        paperSingleColumn = false
                                    ) => {
                                        const val = clearedFieldIds.current.has(de.id)
                                            ? ''
                                            : resolveStageFieldFormValue(
                                                  de.id,
                                                  formValues,
                                                  selectedEvent?.dataValues
                                              )
                                        const readOnlyDisplayText = (raw, deMeta = de) => {
                                            const text = formatEventDataValueForDisplay(
                                                raw,
                                                mergeSaveDe(deMeta.id) || deMeta
                                            )
                                            return text || '—'
                                        }
                                        const inPaperGrid =
                                            fieldLayout === 'toggle-row' ||
                                            fieldLayout === 'inline-row' ||
                                            fieldLayout === 'pill-below-title' ||
                                            fieldLayout === 'questionnaire-row'
                                        const textControlClass = inMedicineGrid
                                            ? formControlMedicineClasses()
                                            : inPaperGrid && isPaperInlineTextField(de)
                                              ? formControlPaperInlineClasses()
                                              : inPaperGrid
                                                ? formControlPaperClasses()
                                                : formControlClasses()

                                        if (de.valueType === 'BOOLEAN') {
                                            return (
                                                <BooleanValueControl
                                                    de={de}
                                                    value={val}
                                                    mandatory={Boolean(de.compulsory) || mandatoryFieldSetHas(mandatoryFieldIds, de.id)}
                                                    readOnly={stageFormReadOnly}
                                                    disabled={stageFormReadOnly}
                                                    fieldLayout={fieldLayout}
                                                    inPaperSection={inPaperSection}
                                                    gateOpen={sectionGateOpen}
                                                    allowDeselect={!stageFormReadOnly}
                                                    onChange={(next) => {
                                                        if (!next || String(next).trim() === '') {
                                                            clearedFieldIds.current.add(de.id)
                                                        } else {
                                                            clearedFieldIds.current.delete(de.id)
                                                        }
                                                        setFormValues((prev) => ({ ...prev, [de.id]: next }))
                                                    }}
                                                />
                                            )
                                        }

                                        if (de.valueType === 'TRUE_ONLY') {
                                            return (
                                                <BooleanValueControl
                                                    de={de}
                                                    value={val}
                                                    mandatory={Boolean(de.compulsory) || mandatoryFieldSetHas(mandatoryFieldIds, de.id)}
                                                    readOnly={stageFormReadOnly}
                                                    disabled={stageFormReadOnly}
                                                    fieldLayout={fieldLayout}
                                                    inPaperSection={inPaperSection}
                                                    gateOpen={sectionGateOpen}
                                                    allowDeselect={!stageFormReadOnly}
                                                    onChange={(next) => {
                                                        if (!next || String(next).trim() === '') {
                                                            clearedFieldIds.current.add(de.id)
                                                        } else {
                                                            clearedFieldIds.current.delete(de.id)
                                                        }
                                                        setFormValues((prev) => ({ ...prev, [de.id]: next }))
                                                    }}
                                                />
                                            )
                                        }

                                        if (de.valueType === 'DATE') {
                                            if (stageFormReadOnly) {
                                                return (
                                                    <div className={cn(FORM.readOnlyValue, 'flex min-h-10 items-center')}>
                                                        {readOnlyDisplayText(val, de)}
                                                    </div>
                                                )
                                            }
                                            const isAppt = isAppointmentDateField(de)
                                            return (
                                                <DatePicker
                                                    date={val}
                                                    setDate={(next) =>
                                                        setFormValues((prev) => ({ ...prev, [de.id]: next }))
                                                    }
                                                    placeholder={i18n.t('Pick a date')}
                                                    disabled={stageFormReadOnly}
                                                    showExternalClear={fieldLayout !== 'inline-row'}
                                                    minDate={isAppt ? (eventDate || enrollmentDateStr) : enrollmentDateStr}
                                                    disableFuture={!isAppt}
                                                />
                                            )
                                        }

                                        const mergedDe = resolveMedicineFieldDeForUi(mergeSaveDe(de.id) || de, {
                                            stageDataElements: activeStage?.dataElements,
                                            resolveDe: (id) => mergeSaveDe(id),
                                        })
                                        const deOptions = mergedDe?.optionSet?.options
                                        if (Array.isArray(deOptions) && deOptions.length > 0) {
                                            const hiddenOpt = hiddenOptionsByField?.[de.id]
                                            return (
                                                <OptionSetValueControl
                                                    de={mergedDe}
                                                    value={val}
                                                    readOnly={stageFormReadOnly}
                                                    disabled={stageFormReadOnly}
                                                    fieldLayout={fieldLayout}
                                                    inMedicineGrid={inMedicineGrid}
                                                    inPaperSection={inPaperSection}
                                                    paperSingleColumn={paperSingleColumn}
                                                    gateOpen={sectionGateOpen}
                                                    allowDeselect={!stageFormReadOnly}
                                                    selectClassName={
                                                        inMedicineGrid
                                                            ? formControlMedicineClasses()
                                                            : undefined
                                                    }
                                                    onChange={(next) => {
                                                        if (!next || String(next).trim() === '') {
                                                            clearedFieldIds.current.add(de.id)
                                                        } else {
                                                            clearedFieldIds.current.delete(de.id)
                                                        }
                                                        setFormValues((prev) => ({
                                                            ...prev,
                                                            [de.id]: next,
                                                        }))
                                                    }}
                                                    hiddenOptionIds={hiddenOpt}
                                                    hiddenOptionCodes={hiddenOpt}
                                                />
                                            )
                                        }

                                        if (isPartnerSmhCodeStageField(de)) {
                                            if (stageFormReadOnly) {
                                                return (
                                                    <div className={cn(FORM.readOnlyValue, 'flex min-h-10 items-center')}>
                                                        {readOnlyDisplayText(val, de)}
                                                    </div>
                                                )
                                            }
                                            return (
                                                <PartnerSmhCodeSearchField
                                                    value={val}
                                                    onChange={(next) =>
                                                        setFormValues((prev) => ({
                                                            ...prev,
                                                            [de.id]: next,
                                                        }))
                                                    }
                                                    disabled={stageFormReadOnly}
                                                    context={context}
                                                    metadata={metadata}
                                                    programStageId={
                                                        activeTab !== 'PROGRAM' ? activeTab : null
                                                    }
                                                    ruleVarContext={ruleVarContext}
                                                    currentTrackedEntityId={
                                                        tei?.trackedEntity || tei?.trackedEntityInstance
                                                    }
                                                />
                                            )
                                        }

                                        const inputType = getInputTypeForValueType(de.valueType)
                                        const htmlPattern = patternForHtmlInput(de.pattern)
                                        if (stageFormReadOnly) {
                                            return (
                                                <div className={cn(FORM.readOnlyValue, 'flex min-h-10 items-center')}>
                                                    {readOnlyDisplayText(val, de)}
                                                </div>
                                            )
                                        }
                                        return (
                                            <Input
                                                value={val || ''}
                                                onChange={(e) => setFormValues((prev) => ({ ...prev, [de.id]: e.target.value }))}
                                                type={inputType}
                                                pattern={htmlPattern}
                                                title={htmlPattern ? i18n.t('Must match program format') : undefined}
                                                className={textControlClass}
                                                placeholder="..."
                                                disabled={stageFormReadOnly}
                                            />
                                        )
                                    }

                                    const rowLayoutForDe = (de, inPaperSection, counsellingSection = false) => {
                                        if (isPaperFormActive && inPaperSection) {
                                            return paperFormRowLayoutForDe(de, { counsellingSection })
                                        }
                                        if (isPaperChecklistMultiField(de)) return 'toggle-panel'
                                        if (!inPaperSection) return 'default'
                                        if (counsellingSection && isCounsellingAdviceYesNoField(de)) {
                                            return 'inline-row'
                                        }
                                        if (isPartnerSmhCodeStageField(de)) return 'partner-smh-search'
                                        if (fieldUsesPillBelowTitleLayout(de, { paperSection: inPaperSection })) {
                                            return 'pill-below-title'
                                        }
                                        if (
                                            fieldUsesToggleRowLayout(de, {
                                                paperSection: true,
                                                counsellingYesNoList: counsellingSection,
                                            })
                                        ) {
                                            return 'toggle-row'
                                        }
                                        return 'inline-row'
                                    }

                                    const renderFieldRow = (
                                        de,
                                        {
                                            inPaperSection = false,
                                            inMedicineGrid = false,
                                            paperSingleColumn = false,
                                            stackCheckboxRows = false,
                                            counsellingSection = false,
                                            labelParts = null,
                                            hideLabel = false,
                                            questionIndex = null,
                                        } = {}
                                    ) => {
                                        const isInvalid = invalidHighlightFieldId === de.id
                                        const resolvedLabelParts =
                                            labelParts ?? stageFieldLayoutParts(de)
                                        const displayLabelRaw = resolveStageFieldDisplayLabel(
                                            de,
                                            resolvedLabelParts
                                        )
                                        const displayLabel =
                                            isPaperFormActive &&
                                            inPaperSection &&
                                            paperFormQuestionIndex(de, questionIndex)
                                                ? stripLeadingListIndex(displayLabelRaw) ||
                                                  displayLabelRaw
                                                : displayLabelRaw
                                        const mergedForLayout = mergeSaveDe(de.id) || de
                                        let rowLayout = inMedicineGrid
                                            ? 'default'
                                            : rowLayoutForDe(
                                                  mergedForLayout,
                                                  inPaperSection,
                                                  counsellingSection
                                              )
                                        if (
                                            !inMedicineGrid &&
                                            fieldUsesPillBelowTitleLayout(mergedForLayout, {
                                                paperSection: inPaperSection,
                                            })
                                        ) {
                                            rowLayout = 'pill-below-title'
                                        } else if (
                                            inPaperSection &&
                                            !isPaperFormActive &&
                                            (mergedForLayout?.optionSet?.options?.length || 0) >= 3 &&
                                            rowLayout === 'inline-row'
                                        ) {
                                            rowLayout = 'default'
                                        }
                                        if (
                                            inPaperSection &&
                                            de.valueType === 'DATE' &&
                                            rowLayout === 'inline-row'
                                        ) {
                                            rowLayout = 'default'
                                        }
                                        if (
                                            inPaperSection &&
                                            de.valueType === 'LONG_TEXT' &&
                                            rowLayout === 'inline-row'
                                        ) {
                                            rowLayout = 'default'
                                        }
                                        const useChoiceGrid =
                                            isWideStageChoiceField(de) &&
                                            rowLayout === 'default' &&
                                            !inMedicineGrid
                                        const paperChoiceSpansTwoCols =
                                            inPaperSection && useChoiceGrid
                                        const resolvedLayout = useChoiceGrid ? 'toggle-panel' : rowLayout
                                        const controlLayout = useChoiceGrid
                                            ? 'default'
                                            : resolvedLayout === 'toggle-panel'
                                              ? 'toggle-row'
                                              : resolvedLayout
                                        const active =
                                            rowLayout === 'toggle-row' &&
                                            isToggleFieldActive(de, formValues)
                                        return (
                                            <StageFieldRow
                                                key={de.id}
                                                de={de}
                                                displayLabel={displayLabel}
                                                hideLabel={hideLabel}
                                                mandatoryFieldIds={mandatoryFieldIds}
                                                isInvalid={isInvalid}
                                                active={active}
                                                isWide={useChoiceGrid}
                                                layout={resolvedLayout}
                                                questionNo={
                                                    isPaperFormActive && inPaperSection
                                                        ? paperFormQuestionIndex(de, questionIndex)
                                                        : null
                                                }
                                                rowClassName={cn(
                                                    rowLayout === 'default' &&
                                                        (inMedicineGrid
                                                            ? FORM.medicineGridFieldRow
                                                            : fieldRowClass),
                                                    rowLayout === 'inline-row' &&
                                                        FORM.symptomFullWidthCell,
                                                    stackCheckboxRows &&
                                                        inPaperSection &&
                                                        (rowLayout === 'toggle-row' ||
                                                            rowLayout === 'inline-row') &&
                                                        FORM.paperCheckboxFullRow,
                                                    rowLayout === 'pill-below-title' &&
                                                        cn(
                                                            FORM.symptomFullWidthCell,
                                                            FORM.pillBelowTitleRow,
                                                            !inPaperSection && 'col-span-full w-full'
                                                        ),
                                                    rowLayout === 'partner-smh-search' &&
                                                        'col-span-2 w-full max-[400px]:col-span-1',
                                                    paperChoiceSpansTwoCols &&
                                                        'col-span-2 w-full max-[400px]:col-span-1'
                                                )}
                                                rowInnerClassName={
                                                    inMedicineGrid ? FORM.medicineGridFieldRowInner : undefined
                                                }
                                            >
                                                {renderField(
                                                    de,
                                                    controlLayout,
                                                    inMedicineGrid,
                                                    inPaperSection,
                                                    false,
                                                    paperSingleColumn
                                                )}
                                            </StageFieldRow>
                                        )
                                    }
                                    if (visibleSections.length > 0) {
                                        const buildMedicineSectionNode = (section) => {
                                            const gate = resolveStageSectionGate(section, {
                                                mergeStageDe,
                                                formValues,
                                                shouldOmitStageField,
                                            })
                                            const {
                                                gateDeId: gateId,
                                                gateDe,
                                                hasBooleanGate,
                                                gateOpen,
                                                bodyDeIds,
                                            } = gate
                                            const isMedicineTableSection =
                                                hasStiMedicineSlots &&
                                                isMedicineTreatmentSection(section, {
                                                    medicineDeToSlot,
                                                    medicineSlots,
                                                    mergeStageDe,
                                                })
                                            const bodyIds = bodyDeIds
                                            const counsellingSection = isCounsellingAdviceSection(section)
                                            const sectionBodyFields = resolveStageSectionBodyFields(
                                                section,
                                                {
                                                    mergeStageDe,
                                                    shouldOmitStageField,
                                                    gateDeId: gateId,
                                                    hasBooleanGate,
                                                    gateOpen,
                                                    formValues,
                                                    eventDataValues: stageFormReadOnly
                                                        ? selectedEvent?.dataValues
                                                        : null,
                                                }
                                            )
                                            if (sectionBodyFields.length === 0 && !hasBooleanGate) {
                                                return null
                                            }
                                            const inPaperSection =
                                                !isMedicineTableSection &&
                                                sectionUsesPaperGrid(
                                                    bodyIds,
                                                    mergeStageDe,
                                                    activeTab,
                                                    section,
                                                    paperFormOpts
                                                )
                                            const stackCheckboxRows =
                                                inPaperSection &&
                                                sectionUsesLabTestChecklistLayout(bodyIds, mergeStageDe)
                                            let paperGridKey = resolveSectionPaperGridClass(
                                                bodyIds,
                                                mergeStageDe,
                                                {
                                                    singleColumnFallback: sectionGridClass,
                                                    sectionName: section.name,
                                                    programStageId: activeTab,
                                                    section,
                                                    paperFormOpts,
                                                }
                                            )
                                            if (stackCheckboxRows) {
                                                paperGridKey = 'symptomToggleGridSingle'
                                            }
                                            const paperSingleColumn =
                                                inPaperSection &&
                                                (paperGridKey === 'symptomToggleGridSingle' ||
                                                    stackCheckboxRows)
                                            const bodyGridClass =
                                                paperGridKey === 'paperQuestionnaireList'
                                                    ? FORM.paperQuestionnaireList
                                                    : paperGridKey === 'paperFormGridSingle'
                                                      ? FORM.paperFormGridSingle
                                                      : paperGridKey === 'paperFormGrid'
                                                        ? FORM.paperFormGrid
                                                        : paperGridKey === 'symptomToggleGridSingle'
                                                          ? FORM.symptomToggleGridSingle
                                                          : paperGridKey === 'symptomToggleGrid'
                                                            ? FORM.symptomToggleGrid
                                                            : paperGridKey
                                            const paperSelectedCount = inPaperSection
                                                ? countPaperSectionSelected(bodyIds, mergeStageDe, formValues)
                                                : 0
                                            const sectionFieldCount = hasBooleanGate ? bodyIds.length + 1 : bodyIds.length
                                            const riskQuestionnaire =
                                                isPaperFormActive && isRiskQuestionnaireStage(activeTab)
                                            const paperMedicineSection =
                                                isPaperFormActive && isMedicineTableSection
                                            const sectionCardClassResolved = riskQuestionnaire
                                                ? cn(FORM.paperFormSectionCard, 'mb-0')
                                                : paperMedicineSection
                                                  ? cn(FORM.paperFormSectionCard, FORM.paperMedicineBlock)
                                                  : isPaperFormActive && inPaperSection
                                                    ? cn(FORM.paperFormSectionCard, sectionCardClass)
                                                    : sectionCardClass
                                            const sectionHeaderClassResolved = riskQuestionnaire
                                                ? FORM.paperFormSectionHeader
                                                : paperMedicineSection
                                                  ? 'paper-section-heading'
                                                  : isPaperFormActive && inPaperSection
                                                    ? FORM.paperFormSectionHeader
                                                    : sectionHeaderClass
                                            const progress =
                                                sectionProgressMap.get(section.id) || {
                                                    status: 'empty',
                                                    requiredRemaining: 0,
                                                }
                                            const medicineSlotForSection =
                                                medicineSectionSlotIndex.get(section.id) ?? null
                                            const showRemoveMedicineForSection =
                                                isMedicineTableSection &&
                                                !stageFormReadOnly &&
                                                medicineSlotForSection != null &&
                                                canRemoveMedicineSlot(
                                                    medicineSlots,
                                                    medicineSlotForSection,
                                                    formValues
                                                )
                                            const showAddMedicineForSection =
                                                isMedicineTableSection &&
                                                showAddMedicineControl &&
                                                isMedicineAddButtonSection(
                                                    section.id,
                                                    medicineSectionSlotIndex,
                                                    effectiveMedicineSlotCap
                                                ) &&
                                                !stageFormReadOnly
                                            return (
                                                <StageFormSection
                                                    key={section.id}
                                                    section={section}
                                                    progressStatus={progress.status}
                                                    requiredRemaining={progress.requiredRemaining}
                                                    collapsible={false}
                                                    collapsed={false}
                                                    isActive={false}
                                                    inPaperSection={inPaperSection}
                                                    paperFormMode={
                                                        isPaperFormActive &&
                                                        (inPaperSection || isMedicineTableSection)
                                                    }
                                                    paperSelectedCount={paperSelectedCount}
                                                    sectionFieldCount={sectionFieldCount}
                                                    sectionCardClass={sectionCardClassResolved}
                                                    sectionHeaderClass={sectionHeaderClassResolved}
                                                    hasBooleanGate={hasBooleanGate}
                                                    gateDe={gateDe}
                                                    gateOpen={gateOpen}
                                                    headerActions={
                                                        showRemoveMedicineForSection ? (
                                                            <RemoveMedicineButton
                                                                slotIndex={medicineSlotForSection}
                                                                paperFormMode={paperMedicineSection}
                                                                onClick={() =>
                                                                    removeMedicineAtSlot(
                                                                        medicineSlotForSection
                                                                    )
                                                                }
                                                            />
                                                        ) : null
                                                    }
                                                    renderGateControl={() =>
                                                        renderField(
                                                            gateDe,
                                                            'header-inline',
                                                            false,
                                                            false,
                                                            gateOpen
                                                        )
                                                    }
                                                    renderBody={() =>
                                                        hasBooleanGate &&
                                                        !gateOpen &&
                                                        sectionBodyFields.length === 0
                                                            ? null
                                                            : sectionBodyFields.length > 0 ||
                                                                bodyIds.length > 0 ? (
                                                                  <div
                                                                      key={`${section.id}-body-${gateOpen ? 'open' : 'shut'}`}
                                                                      className={cn(
                                                                          isMedicineTableSection &&
                                                                              medicineSlotMax >= 1
                                                                              ? FORM.medicineSectionBodyGrid
                                                                              : bodyGridClass,
                                                                          'duration-300 ease-out animate-in fade-in slide-in-from-top-1'
                                                                      )}
                                                                      role={
                                                                          isMedicineTableSection ? 'group' : undefined
                                                                      }
                                                                      aria-label={
                                                                          isMedicineTableSection
                                                                              ? i18n.t(
                                                                                    'Medicine rows ({{count}} slots)',
                                                                                    { count: medicineSlotMax }
                                                                                )
                                                                              : undefined
                                                                      }
                                                                  >
                                                                      {sectionBodyFields.map((de) =>
                                                                          renderFieldRow(de, {
                                                                              inPaperSection: false,
                                                                              inMedicineGrid: true,
                                                                              counsellingSection,
                                                                              labelParts:
                                                                                  stageFieldLayoutParts(de),
                                                                          })
                                                                      )}
                                                                  </div>
                                                              ) : null
                                                    }
                                                    footer={
                                                        showAddMedicineForSection ? (
                                                            <AddMedicineButtonFooter
                                                                paperFormMode={paperMedicineSection}
                                                            >
                                                                <div className="flex flex-wrap items-center justify-end gap-3">
                                                                    <ShowAllMedicineButton
                                                                        current={effectiveMedicineSlotCap}
                                                                        max={medicineSlotMax}
                                                                        paperFormMode={paperMedicineSection}
                                                                        onClick={showAllMedicineSlots}
                                                                    />
                                                                    <AddMedicineButton
                                                                        current={effectiveMedicineSlotCap}
                                                                        max={medicineSlotMax}
                                                                        paperFormMode={paperMedicineSection}
                                                                        onClick={addAnotherMedicine}
                                                                    />
                                                                </div>
                                                            </AddMedicineButtonFooter>
                                                        ) : null
                                                    }
                                                />
                                            )
                                        }

                                        const partnerSmhProps = {
                                            context,
                                            metadata,
                                            programStageId: activeTab !== 'PROGRAM' ? activeTab : null,
                                            ruleVarContext,
                                            currentTrackedEntityId:
                                                tei?.trackedEntity || tei?.trackedEntityInstance,
                                        }

                                        return (
                                            <StageFormErrorBoundary>
                                                <PaperStageForm
                                                    activeStage={activeStage}
                                                    programStageId={activeTab}
                                                    visibleSections={visibleSections}
                                                    formValues={formValues}
                                                    setFormValues={setFormValues}
                                                    eventDateProps={{
                                                        eventDate,
                                                        setEventDate,
                                                        minDate: enrollmentDateStr,
                                                    }}
                                                    minDate={enrollmentDateStr}
                                                    enrollmentDate={enrollmentDateStr}
                                                    mergeStageDe={mergeStageDe}
                                                    shouldOmitStageField={shouldOmitStageField}
                                                    mandatoryFieldIds={mandatoryFieldIds}
                                                    hiddenOptionsByField={hiddenOptionsByField}
                                                    assignedValues={assignedValues}
                                                    readOnly={stageFormReadOnly}
                                                    invalidHighlightFieldId={invalidHighlightFieldId}
                                                    eventDataValues={selectedEvent?.dataValues}
                                                    eventId={selectedEvent?.event || selectedEvent?.id || editingEventId}
                                                    partnerSmhProps={partnerSmhProps}
                                                    programRules={metadata?.rules}
                                                    programRuleVariables={metadata?.ruleVariables}
                                                    clearedFieldIds={clearedFieldIds}
                                                documentTitle={
                                                    stiClinicalPaperFormActive
                                                        ? stiPaperFormTitle
                                                        : null
                                                }
                                                documentSubtitle={
                                                    isRiskQuestionnaireStage(activeTab)
                                                        ? i18n.t(
                                                              'Community-based HIV prevention — risk assessment questionnaire'
                                                          )
                                                        : stiClinicalPaperFormActive
                                                          ? stiPatientSex
                                                              ? null
                                                              : i18n.t(
                                                                    'Set client sex on profile to show male or female form'
                                                                )
                                                          : null
                                                }
                                                renderSection={({ section }) => {
                                                    const isMedicineTableSection =
                                                        hasStiMedicineSlots &&
                                                        isMedicineTreatmentSection(section, {
                                                            medicineDeToSlot,
                                                            medicineSlots,
                                                            mergeStageDe,
                                                        })
                                                    if (!isMedicineTableSection) return null
                                                    return buildMedicineSectionNode(section)
                                                }}
                                            />
                                            </StageFormErrorBoundary>
                                        )
                                    }

                                    const flatDeIds =
                                        activeStage?.dataElements
                                            ?.filter((de) => !shouldOmitStageField(de.id))
                                            .map((de) => de.id) ?? []
                                    const flatHasMedicineFields =
                                        hasStiMedicineSlots &&
                                        (activeStage?.dataElements?.some((de) =>
                                            medicineDeToSlot.has(de.id)
                                        ) ??
                                            false)
                                    const showAddMedicineFlat =
                                        flatHasMedicineFields && showAddMedicineControl && !stageFormReadOnly

                                    if (flatHasMedicineFields) {
                                        const paperMedicineFlat = isPaperFormActive
                                        return (
                                            <div
                                                className={cn(
                                                    paperMedicineFlat
                                                        ? cn(FORM.paperFormSectionCard, FORM.paperMedicineBlock)
                                                        : sectionCardClass,
                                                    'overflow-hidden'
                                                )}
                                            >
                                                <div
                                                    className={
                                                        paperMedicineFlat
                                                            ? 'paper-section-heading'
                                                            : sectionHeaderClass
                                                    }
                                                >
                                                    <p
                                                        className={
                                                            paperMedicineFlat ? undefined : FORM.sectionBarTitle
                                                        }
                                                    >
                                                        {decodeBasicHtmlEntities(activeStage?.name || '') ||
                                                            i18n.t('Clinical Record')}
                                                    </p>
                                                </div>
                                                <div
                                                    className={
                                                        paperMedicineFlat
                                                            ? FORM.paperMedicineBody
                                                            : FORM.medicineSectionBodyGrid
                                                    }
                                                >
                                                    {activeStage?.dataElements
                                                        ?.filter((de) => !shouldOmitStageField(de.id))
                                                        .map((de) => {
                                                            const merged = mergeStageDe(de.id)
                                                            if (!merged) return null
                                                            return renderFieldRow(merged, {
                                                                inPaperSection: false,
                                                                inMedicineGrid: true,
                                                            })
                                                        })}
                                                </div>
                                                {showAddMedicineFlat ? (
                                                    <AddMedicineButtonFooter paperFormMode={paperMedicineFlat}>
                                                        <div className="flex flex-wrap items-center justify-end gap-3">
                                                            <ShowAllMedicineButton
                                                                current={effectiveMedicineSlotCap}
                                                                max={medicineSlotMax}
                                                                paperFormMode={paperMedicineFlat}
                                                                onClick={showAllMedicineSlots}
                                                            />
                                                            <AddMedicineButton
                                                                current={effectiveMedicineSlotCap}
                                                                max={medicineSlotMax}
                                                                paperFormMode={paperMedicineFlat}
                                                                onClick={addAnotherMedicine}
                                                            />
                                                        </div>
                                                    </AddMedicineButtonFooter>
                                                ) : null}
                                            </div>
                                        )
                                    }

                                    return (
                                        <StageFormErrorBoundary>
                                        <PaperStageForm
                                            activeStage={activeStage}
                                            programStageId={activeTab}
                                            visibleSections={[
                                                {
                                                    id: '__flat__',
                                                    name:
                                                        activeStage?.displayName ||
                                                        activeStage?.name ||
                                                        i18n.t('Clinical Record'),
                                                    dataElementIds: flatDeIds,
                                                },
                                            ]}
                                            formValues={formValues}
                                            setFormValues={setFormValues}
                                            mergeStageDe={mergeStageDe}
                                            shouldOmitStageField={shouldOmitStageField}
                                            mandatoryFieldIds={mandatoryFieldIds}
                                            hiddenOptionsByField={hiddenOptionsByField}
                                            assignedValues={assignedValues}
                                            readOnly={stageFormReadOnly}
                                            invalidHighlightFieldId={invalidHighlightFieldId}
                                            eventDataValues={selectedEvent?.dataValues}
                                            eventId={selectedEvent?.event || selectedEvent?.id || editingEventId}
                                            documentTitle={
                                                stiClinicalPaperFormActive
                                                    ? stiPaperFormTitle
                                                    : null
                                            }
                                            documentSubtitle={
                                                stiClinicalPaperFormActive && !stiPatientSex
                                                    ? i18n.t(
                                                          'Set client sex on profile to show male or female form'
                                                      )
                                                    : null
                                            }
                                            partnerSmhProps={{
                                                context,
                                                metadata,
                                                programStageId:
                                                    activeTab !== 'PROGRAM' ? activeTab : null,
                                                ruleVarContext,
                                                currentTrackedEntityId:
                                                    tei?.trackedEntity ||
                                                    tei?.trackedEntityInstance,
                                            }}
                                            programRules={metadata?.rules}
                                            programRuleVariables={metadata?.ruleVariables}
                                            useGlobalQuestionNumbers={false}
                                            eventDateProps={{
                                                eventDate,
                                                setEventDate,
                                                minDate: enrollmentDateStr,
                                            }}
                                            minDate={enrollmentDateStr}
                                            enrollmentDate={enrollmentDateStr}
                                        />
                                        </StageFormErrorBoundary>
                                    )
                                })()}

                            </div>
                        ) : (
                            <div className="animate-in fade-in slide-in-from-left-4 duration-300 flex-1 flex flex-col min-h-0">
                                <ProfileEventTimeline
                                    events={filteredEvents}
                                    lastUpdatedEventId={lastUpdatedEventId}
                                    expandedEventIds={expandedEventIds}
                                    onToggleExpand={toggleEventExpansion}
                                    onEditEvent={setEditingEventId}
                                    stagesMap={stagesMap}
                                    metadata={metadata}
                                    onAddRecord={startAddNewRecord}
                                />
                            </div>
                        )}
                    </div>
                )}
                </div>
            </div>

            {programStages.length > 5 && (
                <StageNavigationSidebar
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                    programStages={programStages}
                    events={events}
                    activeTab={activeTab}
                    onSelectStage={(stageId) => {
                        setActiveTab(stageId)
                        if (stageId !== 'PROGRAM') {
                            startAddNewRecord()
                        }
                        if (typeof window !== 'undefined' && window.innerWidth < 1536) {
                            setSidebarOpen(false)
                        }
                    }}
                    isDataEntryExperience={isDataEntryExperience}
                />
            )}
            </div>
        </div>
        <CompleteVisitChecklistModal
            open={completeChecklistOpen}
            missing={missingForComplete}
            onClose={() => setCompleteChecklistOpen(false)}
            onJumpToField={jumpToMissingField}
        />

        {deleteTeiModal}
        {deleteEventModal}
        {completeWarningModal}

        <PatientSummaryPrintModal
            open={printModalOpen}
            onClose={() => setPrintModalOpen(false)}
            tei={tei}
            program={metadata || context?.program}
            programMetadata={metadata}
            attributesMap={metadata?.dataElements || {}}
            events={events}
            orgUnitId={context?.orgUnit || tei?.orgUnit || tei?.enrollments?.[0]?.orgUnit || ''}
            orgUnitName={
                tei?.enrollments?.[0]?.orgUnitName ||
                events?.[0]?.orgUnitName ||
                metadata?.organisationUnits?.find((o) => o.id === (tei?.orgUnit || context?.orgUnit))?.displayName ||
                metadata?.organisationUnits?.find((o) => o.id === (tei?.orgUnit || context?.orgUnit))?.name ||
                context?.orgUnitName ||
                tei?.orgUnitName ||
                ''
            }
        />

        <RegistrationDateModal
            open={isEventDateModalOpen}
            onClose={() => setIsEventDateModalOpen(false)}
            onConfirm={handleConfirmNewRecordDate}
            title={i18n.language?.startsWith?.('en') ? 'New Record Date' : 'កាលបរិច្ឆេទកំណត់ត្រាថ្មី'}
            subtitle={
                activeStage?.displayName || activeStage?.name
                    ? `${activeStage.displayName || activeStage.name}`
                    : (i18n.language?.startsWith?.('en') ? 'Select entry date' : 'ជ្រើសរើសកាលបរិច្ឆេទសម្រាប់កំណត់ត្រាថ្មី')
            }
            minDate={enrollmentDateStr}
            confirmText={i18n.language?.startsWith?.('en') ? 'Proceed to Entry' : 'បន្តទៅកាន់ការបំពេញទម្រង់'}
        />
        </>
    )
}
