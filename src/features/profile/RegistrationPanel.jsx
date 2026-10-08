import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useDataEngine } from '@dhis2/app-runtime'
import {
    fetchProgramMetadata,
    registerTei,
    formatTrackerMutateError,
    extractTrackerMutationReference,
    isRegistrationRuleEngineDeError,
} from '../../services/trackerApi'
import { normalizeProgramMetadata } from '../../services/metadataService'
import {
    findSmhTrackedEntityAttributeId,
    findPrepTrackedEntityAttributeId,
    formatSmhValue,
    formatPrepValue,
    fetchNextSmhSequence,
    fetchNextPrepSequence,
    isValidSmhForOrgUnit,
    getCachedOrgUnitCode,
} from '../../lib/smhIdentifier'
import { formatUuic, resolveUuicSourceAttributeIds } from '../../lib/uuic'
import {
    dobIsoFromCompletedAgeYears,
    completedYearsFromDobIso,
    findAgeAttributeId,
    findDobAttributeId,
    attributeIsDatePickerDob,
} from '../../lib/ageDobFromAge'
import { Spinner } from '../../components/ui/spinner'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Select } from '../../components/ui/select'
import { PaperRegistrationForm } from '../../components/paper-form/PaperRegistrationForm'
import { buildProfileAttributeSections } from './profileAttributeLayout'
import { StageFormErrorBoundary } from '../../components/paper-form/StageFormErrorBoundary'
import { applyRuleAssignedValues } from '../../lib/programRuleFormSync'
import { mandatoryFieldSetHas } from '../../lib/paperFormSafety'
import { useRestoreScrollOnFormUpdate } from '../../hooks/useRestoreScrollOnFormUpdate'
import { attributeOptionSetUiVariant, profileOptionFieldSpansFullRow } from '../../lib/stageFieldRender'
import { DatePicker } from '../../components/ui/date-picker'
import { AgeBirthDateComposite } from '../../components/ui/age-birth-date-composite'
import { KhmerVirtualKeyboard } from '../../components/ui/khmer-virtual-keyboard'
import { BooleanCheckboxField, TrueOnlyCheckboxField } from '../../components/ui/boolean-fields'
import { ChevronLeftIcon, CheckIcon, Cross2Icon, PersonIcon } from '@radix-ui/react-icons'
import { AlertCircle, AlertTriangle, Badge } from 'lucide-react'
import { useProgramRules } from '../../hooks/useProgramRules'
import { getInputTypeForValueType, validateFieldValue, patternForHtmlInput } from '../../lib/fieldValidation'
import { FORM, captureFieldDomId, formControlClasses } from '../../lib/formUi'
import { cn } from '../../lib/utils'
import { ProgramRulesReferencePanel, ProgramRulesPanelTrigger } from '../program-rules/ProgramRulesReferencePanel'
import { ProfileRuleAlerts } from './ProfileRuleAlerts'
import { useDuplicateDetector } from './hooks/useDuplicateDetector'
import i18n from '@dhis2/d2-i18n'

/** Trailing colons sometimes appear in locale strings (Latin, fullwidth, Khmer ៖). */
const trimTrailingLabelColons = (value) =>
    String(value ?? '')
        .replace(/[\s\u00A0]*[:：\u17D6]+\s*$/u, '')
        .trimEnd()

export const RegistrationPanel = ({
    context,
    registrationDate,
    onBack,
    onRegisterSuccess,
}) => {
    const engine = useDataEngine()
    const [metadata, setMetadata] = useState(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState(null)
    const [formValues, setFormValues] = useState({})
    const [invalidAttrHighlightId, setInvalidAttrHighlightId] = useState(null)
    const invalidAttrBaselineRef = useRef(null)
    const registrationScrollRef = useRef(null)
    const [programRulesPanelOpen, setProgramRulesPanelOpen] = useState(false)

    const {
        hiddenFields,
        mandatoryFieldIds,
        ruleWarnings,
        ruleErrors,
        assignedValues,
        hiddenOptionsByField,
    } = useProgramRules(metadata, formValues)

    const assignedKey = useMemo(() => JSON.stringify(assignedValues), [assignedValues])

    // PPW (Partner of Pregnant Women) is valid for male patients — suppress any server-side rule
    // that incorrectly fires a SHOWERROR when PPW is selected.
    const isPpwError = (r) => /\bPPW\b/i.test(String(r.text || ''))
    const displayedRuleErrors = useMemo(
        () => ruleErrors.filter((r) => !/uuic/i.test(String(r.text || '')) && !isPpwError(r)),
        [ruleErrors]
    )
    //Display rule warning...

    const displayedRuleWarnings = useMemo(
        () =>
            ruleWarnings.filter((r) => {
                const text = String(r?.text || '')
                if (/uuic/i.test(text)) return false
                if (text.includes('មានកត្តាប្រព្រឹត្តប្រឈម')) return false
                if (text.includes('បើ មាន(បាទ/ចាស') || text.includes('បើ មាន(បាទ/ចាស )')) return false
                return true
            }),
        [ruleWarnings]
    )
  //warining rule condition blocking 
    const { potentialDuplicates, checking: checkingDuplicates } = useDuplicateDetector({
        engine,
        context,
        formValues,
        programAttributes: metadata?.attributes || [],
    })

    const registrationAttributeIds = useMemo(
        () => new Set((metadata?.attributes || []).map((a) => a.id).filter(Boolean)),
        [metadata?.attributes]
    )

    useEffect(() => {
        if (assignedKey === '{}') return
        const parsed = JSON.parse(assignedKey)
        setFormValues((prev) =>
            applyRuleAssignedValues(prev, parsed, { attributeIds: registrationAttributeIds })
        )
    }, [assignedKey, registrationAttributeIds])

    // Auto-clear options that become hidden by program rules (e.g. sex changed from Female to Male)
    useEffect(() => {
        if (!hiddenOptionsByField || Object.keys(hiddenOptionsByField).length === 0) return
        setFormValues((prev) => {
            let changed = false
            const next = { ...prev }
            for (const [attrId, hiddenSet] of Object.entries(hiddenOptionsByField)) {
                if (!hiddenSet || hiddenSet.size === 0) continue
                const val = next[attrId]
                if (val && (hiddenSet.has(val) || hiddenSet.has(String(val)))) {
                    next[attrId] = ''
                    changed = true
                }
            }
            return changed ? next : prev
        })
    }, [hiddenOptionsByField])

    useRestoreScrollOnFormUpdate(registrationScrollRef, JSON.stringify(formValues), true)

    useEffect(() => {
        const id = invalidAttrHighlightId
        if (!id) return
        const baseline = invalidAttrBaselineRef.current
        if (String(formValues[id] ?? '') !== String(baseline ?? '')) {
            setInvalidAttrHighlightId(null)
            invalidAttrBaselineRef.current = null
        }
    }, [formValues, invalidAttrHighlightId])

    const smhAttributeId = useMemo(
        () => findSmhTrackedEntityAttributeId(metadata?.attributes),
        [metadata]
    )
    const smhHiddenByRules = Boolean(smhAttributeId && hiddenFields.has(smhAttributeId))

    const prepAttributeId = useMemo(
        () => findPrepTrackedEntityAttributeId(metadata?.attributes),
        [metadata]
    )
    const prepHiddenByRules = Boolean(prepAttributeId && hiddenFields.has(prepAttributeId))

    const uuicFieldIds = useMemo(
        () =>
            resolveUuicSourceAttributeIds(metadata?.attributes, {
                programSections: metadata?.programSections,
                hiddenAttributeIds: hiddenFields,
            }),
        [metadata, hiddenFields]
    )
    const uuicAttributeId = uuicFieldIds.uuic
    const sexAttributeMeta = useMemo(
        () => metadata?.attributes?.find((a) => a.id === uuicFieldIds.sex) || null,
        [metadata, uuicFieldIds.sex]
    )
    const uuicHiddenByRules = Boolean(uuicAttributeId && hiddenFields.has(uuicAttributeId))

    const ageFieldId = useMemo(() => findAgeAttributeId(metadata?.attributes), [metadata])
    const dobFieldIdForAge = useMemo(
        () => uuicFieldIds.dob ?? findDobAttributeId(metadata?.attributes),
        [metadata, uuicFieldIds.dob]
    )
    const ageHiddenByRules = Boolean(ageFieldId && hiddenFields.has(ageFieldId))
    const dobForAgeHiddenByRules = Boolean(dobFieldIdForAge && hiddenFields.has(dobFieldIdForAge))

    const smhAutofillContextRef = useRef({ program: null, orgUnit: null })
    const prepAutofillContextRef = useRef({ program: null, orgUnit: null })
    /** Organisation unit `code` used for the current SMH prefix (SMH{code}-######). */
    const smhOrgUnitCodeRef = useRef('')

    useEffect(() => {
        if (
            !metadata ||
            !context.orgUnit ||
            !context.program ||
            loading ||
            !smhAttributeId ||
            smhHiddenByRules
        ) {
            return
        }

        let cancelled = false
        const program = context.program
        const orgUnit = context.orgUnit

        const run = async () => {
            try {
                const code = await getCachedOrgUnitCode(engine, orgUnit)
                if (!code) {
                    smhOrgUnitCodeRef.current = ''
                    console.warn('SMH autofill skipped: organisation unit has no code set in DHIS2')
                    return
                }
                smhOrgUnitCodeRef.current = code
                const nextSeq = await fetchNextSmhSequence({
                    engine,
                    program,
                    trackedEntityType: context?.trackedEntityType || metadata?.trackedEntityType?.id,
                    orgUnit,
                    orgUnitCode: code,
                    smhAttributeId,
                })
                if (cancelled) return
                const smh = formatSmhValue(code, nextSeq)
                setFormValues((prev) => {
                    const sameContext =
                        smhAutofillContextRef.current.program === program &&
                        smhAutofillContextRef.current.orgUnit === orgUnit
                    if (sameContext && prev[smhAttributeId]) {
                        return prev
                    }
                    smhAutofillContextRef.current = { program, orgUnit }
                    return { ...prev, [smhAttributeId]: smh }
                })
            } catch (e) {
                console.warn('SMH autofill failed', e)
            }
        }
        run()
        return () => {
            cancelled = true
        }
    }, [
        metadata,
        context.orgUnit,
        context.program,
        engine,
        loading,
        smhAttributeId,
        smhHiddenByRules,
    ])

    useEffect(() => {
        if (
            !metadata ||
            !context.orgUnit ||
            !context.program ||
            loading ||
            !prepAttributeId ||
            prepHiddenByRules
        ) {
            return
        }

        let cancelled = false
        const program = context.program
        const orgUnit = context.orgUnit

        const run = async () => {
            try {
                const code = await getCachedOrgUnitCode(engine, orgUnit)
                if (!code) return
                const nextSeq = await fetchNextPrepSequence({
                    engine,
                    program,
                    trackedEntityType: context?.trackedEntityType || metadata?.trackedEntityType?.id,
                    orgUnit,
                    orgUnitCode: code,
                    prepAttributeId,
                })
                if (cancelled) return
                const prepVal = formatPrepValue(code, nextSeq)
                setFormValues((prev) => {
                    const sameContext =
                        prepAutofillContextRef.current.program === program &&
                        prepAutofillContextRef.current.orgUnit === orgUnit
                    if (sameContext && prev[prepAttributeId]) {
                        return prev
                    }
                    prepAutofillContextRef.current = { program, orgUnit }
                    return { ...prev, [prepAttributeId]: prepVal }
                })
            } catch (e) {
                console.warn('PrEP code autofill failed', e)
            }
        }
        run()
        return () => {
            cancelled = true
        }
    }, [
        metadata,
        context.orgUnit,
        context.program,
        engine,
        loading,
        prepAttributeId,
        prepHiddenByRules,
    ])

    const uuicLast = uuicFieldIds.lastName != null ? formValues[uuicFieldIds.lastName] ?? '' : ''
    const uuicFirst = uuicFieldIds.firstName != null ? formValues[uuicFieldIds.firstName] ?? '' : ''
    const uuicSex = uuicFieldIds.sex != null ? formValues[uuicFieldIds.sex] ?? '' : ''
    // Same key as AgeBirthDateComposite / DatePicker DOB (`uuic` resolver can miss dob when another pick consumed the attribute).
    const uuicDob = dobFieldIdForAge != null ? formValues[dobFieldIdForAge] ?? '' : ''

    useEffect(() => {
        if (!metadata || !uuicAttributeId || uuicHiddenByRules) {
            return
        }
        if (!uuicFieldIds.lastName || !uuicFieldIds.firstName || !uuicFieldIds.sex || !dobFieldIdForAge) {
            return
        }

        const next = formatUuic({
            lastName: uuicLast,
            firstName: uuicFirst,
            sex: uuicSex,
            dob: uuicDob,
            sexAttribute: sexAttributeMeta,
        })

        setFormValues((prev) => {
            if (prev[uuicAttributeId] === next) {
                return prev
            }
            return { ...prev, [uuicAttributeId]: next }
        })
    }, [
        metadata,
        uuicAttributeId,
        uuicHiddenByRules,
        uuicFieldIds.lastName,
        uuicFieldIds.firstName,
        uuicFieldIds.sex,
        dobFieldIdForAge,
        uuicLast,
        uuicFirst,
        uuicSex,
        uuicDob,
        sexAttributeMeta,
    ])

    useEffect(() => {
        const loadMetadata = async () => {
            try {
                setLoading(true)
                const programData = await fetchProgramMetadata({ engine, programId: context.program })
                setMetadata(normalizeProgramMetadata(programData))
            } catch (error) {
                console.error("Failed to load program metadata", error)
                setMessage({ type: 'error', text: i18n.t('Failed to load registration fields') })
            } finally {
                setLoading(false)
            }
        }
        loadMetadata()
    }, [engine, context.program, i18n.language])

    /** Maintenance "SECTION" registration layout, or flat list when no programSections.
     *  Attributes not assigned to any section are omitted when the program uses sections. */
    const registrationLayout = useMemo(() => {
        const built = buildProfileAttributeSections(metadata, hiddenFields)
        const visibleCount =
            built.mode === 'sections'
                ? built.sections.reduce((n, sec) => n + sec.attributes.length, 0)
                : built.flatAttributes.length
        return {
            mode: built.mode,
            sections: built.sections,
            visibleAttributes: built.flatAttributes,
            visibleCount,
        }
    }, [metadata, hiddenFields, i18n.language])

    const handleSave = async () => {
        const scrollToInvalidAttr = (attrId) => {
            const domId = captureFieldDomId('attr', attrId)
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const el = document.getElementById(domId)
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    el?.querySelector(
                        'input:not([type="hidden"]), select, textarea, button, [role="combobox"]'
                    )?.focus?.({ preventScroll: true })
                })
            })
        }

        try {
            setSaving(true)
            setMessage(null)
            setInvalidAttrHighlightId(null)
            invalidAttrBaselineRef.current = null

            const seen = new Set()
            const visibleAttrs =
                registrationLayout.mode === 'sections'
                    ? registrationLayout.sections.flatMap((s) => s.attributes).filter((a) => {
                          if (seen.has(a.id)) return false
                          seen.add(a.id)
                          return true
                      })
                    : registrationLayout.visibleAttributes

            for (const attr of visibleAttrs) {
                const isAutoSmh =
                    Boolean(smhAttributeId) &&
                    attr.id === smhAttributeId &&
                    !smhHiddenByRules
                const err = validateFieldValue(formValues[attr.id], {
                    mandatory: Boolean(attr.mandatory) || mandatoryFieldSetHas(mandatoryFieldIds, attr.id),
                    // DHIS2 Java regex patterns often fail in JS; SMH is validated below.
                    pattern: isAutoSmh ? null : attr.pattern,
                    valueType: attr.valueType,
                    name: attr.name,
                })
                if (!err && isAutoSmh) {
                    const smhVal = formValues[attr.id]
                    const ouCode = smhOrgUnitCodeRef.current
                    if (!ouCode) {
                        invalidAttrBaselineRef.current = smhVal ?? ''
                        setInvalidAttrHighlightId(attr.id)
                        setMessage({
                            type: 'error',
                            text: i18n.t(
                                'Organisation unit must have a code in DHIS2 to generate SMH (SMH + unit code + sequence).'
                            ),
                        })
                        setSaving(false)
                        scrollToInvalidAttr(attr.id)
                        return
                    }
                    if (smhVal && !isValidSmhForOrgUnit(smhVal, ouCode)) {
                        invalidAttrBaselineRef.current = smhVal ?? ''
                        setInvalidAttrHighlightId(attr.id)
                        setMessage({
                            type: 'error',
                            text: i18n.t(
                                'SMH code must match SMH{{unitCode}}-###### (6-digit sequence).',
                                { unitCode: ouCode }
                            ),
                        })
                        setSaving(false)
                        scrollToInvalidAttr(attr.id)
                        return
                    }
                }
                if (err) {
                    invalidAttrBaselineRef.current = formValues[attr.id] ?? ''
                    setInvalidAttrHighlightId(attr.id)
                    setMessage({ type: 'error', text: err })
                    setSaving(false)
                    scrollToInvalidAttr(attr.id)
                    return
                }
            }

            // Filter out PPW errors — PPW is valid for male patients (Partner of Pregnant Women).
            const saveRuleErrors = ruleErrors.filter((r) => !isPpwError(r))
            if (saveRuleErrors.length > 0) {
                const withField = saveRuleErrors.find((r) => r.fieldId)
                const fid = withField?.fieldId
                if (fid) {
                    invalidAttrBaselineRef.current = formValues[fid] ?? ''
                    setInvalidAttrHighlightId(fid)
                }
                setMessage({ type: 'error', text: saveRuleErrors.map((r) => r.text).filter(Boolean).join(' · ') })
                setSaving(false)
                if (fid) scrollToInvalidAttr(fid)
                return
            }

            const validAttributeIds = new Set((metadata?.attributes || []).map((a) => a.id).filter(Boolean))
            const attrMap = new Map()
            for (const [id, value] of Object.entries(formValues)) {
                if (hiddenFields.has(id) || id === '__pseudo_age__') continue
                if (!validAttributeIds.has(id)) continue
                if (value !== '' && value !== null && value !== undefined) {
                    attrMap.set(id, String(value))
                }
            }

            if (smhAttributeId && !hiddenFields.has(smhAttributeId) && context.orgUnit) {
                try {
                    const code = await getCachedOrgUnitCode(engine, context.orgUnit)
                    if (code) {
                        smhOrgUnitCodeRef.current = code
                        const nextSeq = await fetchNextSmhSequence({
                            engine,
                            program: context.program,
                            trackedEntityType: context.trackedEntityType || metadata?.trackedEntityType?.id,
                            orgUnit: context.orgUnit,
                            orgUnitCode: code,
                            smhAttributeId,
                        })
                        attrMap.set(smhAttributeId, formatSmhValue(code, nextSeq))
                    }
                } catch (e) {
                    console.warn('SMH refresh before registration failed', e)
                }
            }

            if (prepAttributeId && !hiddenFields.has(prepAttributeId) && context.orgUnit && !formValues[prepAttributeId]) {
                try {
                    const code = await getCachedOrgUnitCode(engine, context.orgUnit)
                    if (code) {
                        const nextSeq = await fetchNextPrepSequence({
                            engine,
                            program: context.program,
                            trackedEntityType: context.trackedEntityType || metadata?.trackedEntityType?.id,
                            orgUnit: context.orgUnit,
                            orgUnitCode: code,
                            prepAttributeId,
                        })
                        attrMap.set(prepAttributeId, formatPrepValue(code, nextSeq))
                    }
                } catch (e) {
                    console.warn('PrEP code refresh before registration failed', e)
                }
            }
            for (const attr of visibleAttrs) {
                if (attr.valueType === 'BOOLEAN' && (attr.mandatory || mandatoryFieldSetHas(mandatoryFieldIds, attr.id)) && !attrMap.has(attr.id)) {
                    attrMap.set(attr.id, 'false')
                }
            }
            const attributes = [...attrMap.entries()].map(([attribute, value]) => ({
                attribute,
                value,
            }))

            const response = await registerTei({
                engine,
                orgUnit: context.orgUnit,
                program: context.program,
                trackedEntityType: context.trackedEntityType,
                attributes,
                enrollmentDate: registrationDate,
                incidentDate: registrationDate,
            })

            const teiId =
                extractTrackerMutationReference(response, 'TRACKED_ENTITY') ||
                response?.bundleReport?.typeReports?.[0]?.objectReports?.[0]?.uid ||
                response?.response?.importSummaries?.[0]?.reference

            setMessage({ type: 'success', text: i18n.t('Registration successful') })
            setTimeout(() => {
                onRegisterSuccess?.(teiId, { registrationDate })
            }, 1000)
        } catch (error) {
            console.error("Registration failed", error)
            let text = formatTrackerMutateError(error, i18n.t('Registration failed'))
            if (isRegistrationRuleEngineDeError(error)) {
                text = `${text} ${i18n.t(
                    'This usually means an old app build is installed, or the server used the legacy registration API. Reinstall the latest Capture app zip and ensure POST /api/tracker is allowed for your user.'
                )}`
            }
            setMessage({ type: 'error', text })
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-24 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 h-full">
                <Spinner />
                <span className={cn('mt-4 animate-pulse', FORM.loadingText)}>{i18n.t('Preparing Registration Form...')}</span>
            </div>
        )
    }

    const renderAttributeRow = (attr) => {
        const pairedAgeDobActive =
            Boolean(dobFieldIdForAge) &&
            !dobForAgeHiddenByRules

        const val = formValues[attr.id] || ''
        const autoLocked =
            (Boolean(smhAttributeId) && attr.id === smhAttributeId && !smhHiddenByRules) ||
            (Boolean(uuicAttributeId) && attr.id === uuicAttributeId && !uuicHiddenByRules)

        const renderField = () => {
            if (pairedAgeDobActive && attr.id === ageFieldId) {
                return null // Rendered alongside dobFieldIdForAge
            }

            if (pairedAgeDobActive && attr.id === dobFieldIdForAge) {
                return (
                    <AgeBirthDateComposite
                        ageValue={formValues[ageFieldId ?? '__pseudo_age__'] ?? ''}
                        dobIso={formValues[dobFieldIdForAge] ?? ''}
                        disabled={autoLocked}
                        onAgeChange={(raw) => {
                            setFormValues((prev) => {
                                const next = { ...prev, [ageFieldId ?? '__pseudo_age__']: raw }
                                const iso = dobIsoFromCompletedAgeYears(raw)
                                if (iso) next[dobFieldIdForAge] = iso
                                return next
                            })
                        }}
                        onDobChange={(iso) => {
                            setFormValues((prev) => {
                                const next = { ...prev, [dobFieldIdForAge]: iso || '' }
                                if (iso) {
                                    const y = completedYearsFromDobIso(iso)
                                    if (y !== '') next[ageFieldId ?? '__pseudo_age__'] = y
                                } else {
                                    next[ageFieldId ?? '__pseudo_age__'] = ''
                                }
                                return next
                            })
                        }}
                    />
                )
            }

            if (attr.valueType === 'BOOLEAN') {
                return (
                    <BooleanCheckboxField
                        value={val}
                        mandatory={Boolean(attr.mandatory) || mandatoryFieldSetHas(mandatoryFieldIds, attr.id)}
                        disabled={autoLocked}
                        onChange={(next) =>
                            setFormValues((prev) => ({
                                ...prev,
                                [attr.id]: next,
                            }))
                        }
                    />
                )
            }

            if (attr.valueType === 'TRUE_ONLY') {
                return (
                    <TrueOnlyCheckboxField
                        value={val}
                        disabled={autoLocked}
                        onChange={(next) =>
                            setFormValues((prev) => ({
                                ...prev,
                                [attr.id]: next,
                            }))
                        }
                    />
                )
            }

            if (attributeIsDatePickerDob(attr)) {
                return (
                    <DatePicker
                        date={val}
                        setDate={(next) => setFormValues((prev) => ({ ...prev, [attr.id]: next }))}
                        placeholder={i18n.t('Pick a date')}
                        disabled={autoLocked}
                    />
                )
            }

            const optionItems = attr.optionSet?.options
            if (Array.isArray(optionItems) && optionItems.length > 0) {
                const hiddenOpt = hiddenOptionsByField?.[attr.id]
                const visibleOpts = optionItems.filter((opt) => {
                    if (!opt) return false
                    const id = String(opt.id || '')
                    const code = String(opt.code || '').trim()
                    const codeUpper = code.toUpperCase()
                    if (hiddenOpt?.has?.(id) || hiddenOpt?.has?.(code) || hiddenOpt?.has?.(codeUpper)) return false
                    return true
                })
                const variant = attributeOptionSetUiVariant(attr)
                if (variant === 'VERTICAL_RADIO' || variant === 'HORIZONTAL_RADIO') {
                    return (
                        <OptionSetPillGroup
                            name={`reg-attr-${attr.id}`}
                            value={val}
                            options={visibleOpts}
                            disabled={autoLocked}
                            allowClear={false}
                            aria-label={attr.name}
                            onChange={(next) =>
                                setFormValues((prev) => ({ ...prev, [attr.id]: next }))
                            }
                        />
                    )
                }
                return (
                    <Select
                        value={val}
                        onValueChange={(next) =>
                            setFormValues((prev) => ({ ...prev, [attr.id]: next === '__EMPTY__' ? '' : next }))
                        }
                        options={[
                            { value: '__EMPTY__', label: i18n.t('Select...') },
                            ...visibleOpts.map((opt) => ({
                                value: opt.code || opt.id,
                                label: opt.name,
                            })),
                        ]}
                        className={formControlClasses()}
                        disabled={autoLocked}
                    />
                )
            }

            const inputType = getInputTypeForValueType(attr.valueType)
            const htmlPattern = patternForHtmlInput(attr.pattern)
            
            const isNameField = attr.id === uuicFieldIds.firstName || attr.id === uuicFieldIds.lastName
            
            const handleChange = (e) => {
                let nextVal = e.target.value
                if (isNameField) {
                    // Only allow Khmer characters, whitespace, and basic punctuation
                    nextVal = nextVal.replace(/[^\u1780-\u17FF\s]/g, '')
                }
                setFormValues((prev) => ({ ...prev, [attr.id]: nextVal }))
            }

            return (
                <Input
                    value={val}
                    onChange={handleChange}
                    type={inputType}
                    pattern={htmlPattern}
                    title={htmlPattern ? i18n.t('Must match program format') : undefined}
                    className={formControlClasses()}
                    placeholder="..."
                    disabled={autoLocked}
                    rightElement={
                        isNameField ? (
                            <KhmerVirtualKeyboard 
                                onInsert={(char) => {
                                    setFormValues((prev) => ({ ...prev, [attr.id]: (prev[attr.id] || '') + char }))
                                }}
                                onBackspace={() => {
                                    setFormValues((prev) => {
                                        const current = prev[attr.id] || ''
                                        return { ...prev, [attr.id]: current.slice(0, -1) }
                                    })
                                }}
                            />
                        ) : null
                    }
                />
            )
        }

        const isInvalid = invalidAttrHighlightId === attr.id
        const pairedTall = pairedAgeDobActive && attr.id === ageFieldId
        const wideOptionRow = profileOptionFieldSpansFullRow(attr)
        return (
            <div
                key={attr.id}
                id={captureFieldDomId('attr', attr.id)}
                aria-invalid={isInvalid}
                className={cn(
                    FORM.profileAttributeRow,
                    pairedTall && 'min-h-[120px] py-4 md:col-span-2',
                    wideOptionRow && 'md:col-span-2',
                    isInvalid && FORM.fieldRowInvalid,
                    isInvalid && 'ring-1 ring-red-300/80'
                )}
                title={autoLocked ? i18n.t('This value is assigned automatically') : undefined}
            >
                <div
                    className={cn(
                        FORM.profileFieldRowInner,
                        wideOptionRow && 'flex-col items-stretch gap-2 sm:flex-col'
                    )}
                >
                    <div
                        className={cn(
                            FORM.profileAttributeLabelCol,
                            FORM.fieldLabel,
                            'flex min-w-0 items-start gap-1',
                            wideOptionRow && 'w-full sm:w-full sm:max-w-none'
                        )}
                    >
                        <span className="line-clamp-3 min-w-0 flex-1" title={attr.name}>
                            {attr.name}
                        </span>
                        {attr.mandatory || mandatoryFieldSetHas(mandatoryFieldIds, attr.id) ? (
                            <span className={FORM.fieldRequiredMark} aria-hidden>
                                *
                            </span>
                        ) : null}
                    </div>
                    <div
                        className={cn(
                            FORM.profileAttributeValueCol,
                            pairedTall && 'min-h-[5rem]',
                            wideOptionRow && 'w-full min-w-0 flex-1'
                        )}
                    >
                        {renderField()}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <>
            <ProgramRulesReferencePanel
                open={programRulesPanelOpen}
                onClose={() => setProgramRulesPanelOpen(false)}
                metadata={metadata}
                programId={context.program}
            />
            <div className="flex flex-col h-full bg-transparent overflow-hidden relative min-h-0">
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

            {/* Header - Solid frosted glass sticky toolbar */}
            <div className="flex items-center justify-between px-3 md:px-6 py-2 bg-slate-50/95 dark:bg-black/95 backdrop-blur-md border-b border-slate-200/80 dark:border-zinc-800 sticky top-0 z-30 shrink-0 gap-2">
                {/* Left: Back + Title + Date Badge */}
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <Button 
                        variant="outline" 
                        size="icon"
                        className="h-8 w-8 shrink-0 rounded-lg p-0 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors shadow-2xs" 
                        onClick={onBack}
                        aria-label={i18n.t('Back')}
                    >
                        <ChevronLeftIcon className="w-4 h-4" />
                    </Button>
                    
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100 tracking-tight truncate">
                            {trimTrailingLabelColons(i18n.t('Registration'))}
                        </span>
                        {registrationDate && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#2d6693]/10 text-[#2d6693] border border-[#2d6693]/20 shrink-0">
                                <span className="text-[10px] font-normal text-slate-500">
                                    {i18n.language?.startsWith?.('en') ? 'Date' : 'កាលបរិច្ឆេទ'}:
                                </span>
                                <span>{registrationDate}</span>
                            </span>
                        )}
                    </div>
                </div>
                
                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <Button 
                        variant="ghost" 
                        size="sm"
                        className="h-8 px-2.5 sm:px-3 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                        onClick={onBack}
                        disabled={saving}
                    >
                        {i18n.t('Cancel')}
                    </Button>
                    <Button 
                        size="sm"
                        className="h-8 px-3 sm:px-4 text-xs font-bold bg-[var(--app-header-bar-bg)] text-white hover:bg-[var(--app-header-bar-bg-hover)] shadow-2xs rounded-lg active:scale-95 transition-all"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? i18n.t('Saving...') : i18n.t('Register')}
                    </Button>
                </div>
            </div>

            <ProfileRuleAlerts errors={displayedRuleErrors} warnings={displayedRuleWarnings} />

            {potentialDuplicates.length > 0 && (
                <div className="shrink-0 space-y-2 border-b border-slate-100 bg-slate-50/50 px-4 py-3 md:px-8">
                    <div
                        className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50/95 p-3.5 text-xs text-amber-950 shadow-xs"
                        role="alert"
                    >
                        <div className="flex items-center gap-2 font-bold text-amber-900">
                            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                            <span>
                                {i18n.t('Possible Duplicate Records Found ({{count}} matching clients)', {
                                    count: potentialDuplicates.length,
                                })}
                            </span>
                        </div>
                        <div className="space-y-1.5 pl-6">
                            {potentialDuplicates.map((dupTei) => {
                                const dupAttrs = dupTei.attributes || []
                                const dupName =
                                    dupAttrs
                                        .map((a) => a.value)
                                        .slice(0, 3)
                                        .join(' ') || dupTei.id
                                return (
                                    <div
                                        key={dupTei.id || dupTei.trackedEntityInstance}
                                        className="flex items-center justify-between bg-white/90 border border-amber-200/80 rounded-lg px-3 py-1.5 text-xs"
                                    >
                                        <span className="font-semibold text-slate-900">{dupName}</span>
                                        <span className="font-mono text-[11px] text-slate-500">
                                            {dupTei.id || dupTei.trackedEntityInstance}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Form Content — same scroll rhythm + width as ProfileDetail PROGRAM tab */}
            <div
                ref={registrationScrollRef}
                className="app-form-surface flex-1 overflow-y-auto custom-scrollbar flex flex-col min-h-0 bg-transparent p-3 md:p-4 pt-3 gap-3 md:gap-4 [overflow-anchor:auto]"
            >
                <div className="flex flex-col gap-3 md:gap-4">
                    <StageFormErrorBoundary>
                    <PaperRegistrationForm
                        title={null}
                        sections={
                            registrationLayout.mode === 'sections'
                                ? registrationLayout.sections
                                : []
                        }
                        attributes={
                            registrationLayout.mode === 'flat'
                                ? registrationLayout.visibleAttributes
                                : null
                        }
                        nameIds={uuicFieldIds}
                        formValues={formValues}
                        setFormValues={setFormValues}
                        mandatoryFieldIds={mandatoryFieldIds}
                        hiddenOptionsByField={hiddenOptionsByField}
                        invalidAttrHighlightId={invalidAttrHighlightId}
                        ageFieldId={ageFieldId}
                        dobFieldId={dobFieldIdForAge}
                        ageDobPair={
                            dobFieldIdForAge &&
                            !dobForAgeHiddenByRules
                                ? {
                                      ageValue: formValues[ageFieldId ?? '__pseudo_age__'] ?? '',
                                      dobValue: formValues[dobFieldIdForAge] ?? '',
                                      onAgeChange: (raw) => {
                                          setFormValues((prev) => {
                                              const next = { ...prev, [ageFieldId ?? '__pseudo_age__']: raw }
                                              const iso = dobIsoFromCompletedAgeYears(raw)
                                              if (iso) next[dobFieldIdForAge] = iso
                                              return next
                                          })
                                      },
                                      onDobChange: (iso) => {
                                          setFormValues((prev) => {
                                              const next = {
                                                  ...prev,
                                                  [dobFieldIdForAge]: iso || '',
                                              }
                                              if (iso) {
                                                  const y = completedYearsFromDobIso(iso)
                                                  if (y !== '') next[ageFieldId ?? '__pseudo_age__'] = y
                                              } else {
                                                  next[ageFieldId ?? '__pseudo_age__'] = ''
                                              }
                                              return next
                                          })
                                      },
                                  }
                                : null
                        }
                        disabledAttributeIds={
                            new Set(
                                [
                                    smhAttributeId && !smhHiddenByRules ? smhAttributeId : null,
                                    prepAttributeId && !prepHiddenByRules ? prepAttributeId : null,
                                    uuicAttributeId && !uuicHiddenByRules ? uuicAttributeId : null,
                                ]
                                    .filter(Boolean)
                                    .filter((id) => id !== 'D7xpPXd6yMl')
                            )
                        }
                    />
                    </StageFormErrorBoundary>

                    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-slate-200 bg-white/50 py-10 opacity-40">
                         <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
                            <PersonIcon className="w-6 h-6" />
                         </div>
                         <p className={FORM.hint}>{i18n.t('Verify personnel details before registration')}</p>
                    </div>
                </div>
            </div>
        </div>
        </>
    )
}
