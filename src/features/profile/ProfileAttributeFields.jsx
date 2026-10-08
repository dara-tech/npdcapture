import React, { useEffect, useMemo, useRef } from 'react'
import { useDataEngine } from '@dhis2/app-runtime'
import { fetchOrganisationUnit } from '../../services/trackerApi'
import {
    findSmhTrackedEntityAttributeId,
    findPrepTrackedEntityAttributeId,
    formatSmhValue,
    formatPrepValue,
    fetchNextSmhSequence,
    fetchNextPrepSequence,
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
import { PaperRegistrationForm } from '../../components/paper-form/PaperRegistrationForm'
import i18n from '@dhis2/d2-i18n'
import {
    buildProfileAttributeSections,
    groupProfileAttributesForDisplay,
} from './profileAttributeLayout'
import { useCaptureAdmin } from '../../hooks/useCaptureAdmin'

/**
 * Tracked-entity attributes — paper form (registration, profile view, profile edit).
 */
export function ProfileAttributeFields({
    context,
    metadata,
    attributes,
    formValues,
    setFormValues,
    hiddenFields = new Set(),
    mandatoryFieldIds,
    hiddenOptionsByField,
    invalidAttrHighlightId,
    setInvalidAttrHighlightId,
    invalidAttrBaselineRef,
    /** Skip SMH sequence autofill (profile update when SMH already set). */
    allowSmhAutofill = false,
    readOnly = false,
    /** Lock core identity fields (sex, age/dob, name, generate code) when editing existing client profile. */
    lockIdentityFields = true,
    isAdmin = false,
    isSuperuser = false,
}) {
    const engine = useDataEngine()
    const { isSuperuser: isSuperuserFromHook, isDataEntryExperience, authorities } = useCaptureAdmin()
    // Admin is only true when user has superuser authorities AND is not in Tracker Capture / data entry experience
    const effectiveIsAdmin = Boolean(
        (isAdmin || isSuperuser || isSuperuserFromHook || authorities?.includes?.('ALL')) &&
        !isDataEntryExperience
    )
    const smhAutofillContextRef = useRef({ program: null, orgUnit: null })
    const prepAutofillContextRef = useRef({ program: null, orgUnit: null })

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

    useEffect(() => {
        if (
            readOnly ||
            !allowSmhAutofill ||
            !metadata ||
            !context?.orgUnit ||
            !context?.program ||
            !smhAttributeId ||
            smhHiddenByRules
        ) {
            return
        }

        let cancelled = false
        const { program, orgUnit } = context

        const run = async () => {
            try {
                const code = await getCachedOrgUnitCode(engine, orgUnit)
                if (!code) return
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
                    if (prev[smhAttributeId]) return prev
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
        allowSmhAutofill,
        metadata,
        context?.orgUnit,
        context?.program,
        context?.trackedEntityType,
        engine,
        smhAttributeId,
        smhHiddenByRules,
        setFormValues,
    ])

    useEffect(() => {
        if (
            readOnly ||
            !allowSmhAutofill ||
            !metadata ||
            !context?.orgUnit ||
            !context?.program ||
            !prepAttributeId ||
            prepHiddenByRules
        ) {
            return
        }

        let cancelled = false
        const { program, orgUnit } = context

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
                    if (prev[prepAttributeId]) return prev
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
        allowSmhAutofill,
        metadata,
        context?.orgUnit,
        context?.program,
        engine,
        prepAttributeId,
        prepHiddenByRules,
        setFormValues,
    ])

    const uuicLast = uuicFieldIds.lastName != null ? formValues[uuicFieldIds.lastName] ?? '' : ''
    const uuicFirst = uuicFieldIds.firstName != null ? formValues[uuicFieldIds.firstName] ?? '' : ''
    const uuicSex = uuicFieldIds.sex != null ? formValues[uuicFieldIds.sex] ?? '' : ''
    const uuicDob = dobFieldIdForAge != null ? formValues[dobFieldIdForAge] ?? '' : ''

    useEffect(() => {
        if (readOnly || lockIdentityFields || !metadata || !uuicAttributeId || uuicHiddenByRules) return
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
            if (prev[uuicAttributeId] === next) return prev
            return { ...prev, [uuicAttributeId]: next }
        })
    }, [
        metadata,
        uuicAttributeId,
        uuicHiddenByRules,
        uuicFieldIds,
        dobFieldIdForAge,
        uuicLast,
        uuicFirst,
        uuicSex,
        uuicDob,
        sexAttributeMeta,
        setFormValues,
    ])

    useEffect(() => {
        if (readOnly) return
        const id = invalidAttrHighlightId
        if (!id) return
        const baseline = invalidAttrBaselineRef?.current
        if (String(formValues[id] ?? '') !== String(baseline ?? '')) {
            setInvalidAttrHighlightId?.(null)
            if (invalidAttrBaselineRef) invalidAttrBaselineRef.current = null
        }
    }, [formValues, invalidAttrHighlightId, setInvalidAttrHighlightId, invalidAttrBaselineRef])

    const sectionsLayout = useMemo(
        () => buildProfileAttributeSections(metadata, hiddenFields),
        [metadata, hiddenFields]
    )

    const layoutRows = useMemo(
        () =>
            sectionsLayout.mode === 'flat'
                ? groupProfileAttributesForDisplay(attributes, uuicFieldIds, {
                      ageFieldId,
                      dobFieldId: dobFieldIdForAge,
                  })
                : null,
        [sectionsLayout.mode, attributes, uuicFieldIds, ageFieldId, dobFieldIdForAge]
    )

    const pairedAgeDobActive =
        Boolean(dobFieldIdForAge) &&
        !dobForAgeHiddenByRules

    const sexAttributeIds = useMemo(() => {
        const set = new Set()
        if (uuicFieldIds.sex) set.add(uuicFieldIds.sex)
        for (const a of attributes || []) {
            const hay = [a?.systemName, a?.shortName, a?.name, a?.displayName].filter(Boolean).join(' ').toLowerCase()
            // In Khmer, 'ប្រភេទ' means type/kind/modality (e.g. ប្រភេទប្រើប្រាស់ប្រីព, ប្រភេទក្រុមគោលដៅ) and contains 'ភេទ'.
            // Remove 'ប្រភេទ' to avoid falsely identifying modality or category fields as sex fields.
            const withoutTypes = hay.replace(/ប្រភេទ/g, '')
            if (
                withoutTypes.includes('sex') ||
                withoutTypes.includes('gender') ||
                withoutTypes.includes('ភេទ')
            ) {
                set.add(a.id)
            }
        }
        return set
    }, [uuicFieldIds.sex, attributes])

    const ageDobAttributeIds = useMemo(() => {
        const set = new Set()
        if (ageFieldId) set.add(ageFieldId)
        if (dobFieldIdForAge) set.add(dobFieldIdForAge)
        if (uuicFieldIds.dob) set.add(uuicFieldIds.dob)
        for (const a of attributes || []) {
            if (a?.valueType === 'AGE' || attributeIsDatePickerDob(a)) {
                set.add(a.id)
                continue
            }
            const hay = [a?.systemName, a?.shortName, a?.name, a?.displayName].filter(Boolean).join(' ').toLowerCase()
            if (
                hay.includes('age') ||
                hay.includes('អាយុ') ||
                hay.includes('birth') ||
                hay.includes('dob') ||
                hay.includes('កំណើត')
            ) {
                set.add(a.id)
            }
        }
        return set
    }, [ageFieldId, dobFieldIdForAge, uuicFieldIds.dob, attributes])

    const nameAttributeIds = useMemo(() => {
        const set = new Set()
        if (uuicFieldIds.firstName) set.add(uuicFieldIds.firstName)
        if (uuicFieldIds.lastName) set.add(uuicFieldIds.lastName)
        for (const a of attributes || []) {
            const hay = [a?.systemName, a?.shortName, a?.name, a?.displayName].filter(Boolean).join(' ').toLowerCase()
            if (
                hay.includes('first name') ||
                hay.includes('firstname') ||
                hay.includes('last name') ||
                hay.includes('lastname') ||
                hay.includes('given name') ||
                hay.includes('surname') ||
                hay.includes('family name') ||
                hay.includes('នាមខ្លួន') ||
                hay.includes('គោត្តនាម') ||
                hay.includes('នាមត្រកូល') ||
                hay.includes('ឈ្មោះត្រកូល') ||
                hay.includes('ឈ្មោះខ្លួន')
            ) {
                set.add(a.id)
            }
        }
        return set
    }, [uuicFieldIds.firstName, uuicFieldIds.lastName, attributes])

    const generatedCodeAttributeIds = useMemo(() => {
        const set = new Set()
        if (smhAttributeId) set.add(smhAttributeId)
        if (prepAttributeId) set.add(prepAttributeId)
        if (uuicAttributeId) set.add(uuicAttributeId)
        for (const a of attributes || []) {
            if (a?.id === 'D7xpPXd6yMl') continue
            if (a?.generated || a?.pattern) {
                set.add(a.id)
                continue
            }
            const hay = [a?.systemName, a?.shortName, a?.name, a?.displayName].filter(Boolean).join(' ').toLowerCase()
            if (
                hay.includes('uuic') ||
                hay.includes('u-uic') ||
                hay.includes('smh') ||
                hay.includes('prep code') ||
                hay.includes('art code') ||
                hay.includes('hotspot code') ||
                hay.includes('systemid')
            ) {
                set.add(a.id)
            }
        }
        return set
    }, [smhAttributeId, prepAttributeId, uuicAttributeId, attributes])

    const kpAttributeIds = useMemo(() => {
        const set = new Set()
        for (const a of attributes || []) {
            if (a?.id === 'tMRHTqExwBW') {
                set.add(a.id)
                continue
            }
            const hay = [a?.systemName, a?.shortName, a?.name, a?.displayName].filter(Boolean).join(' ').toLowerCase()
            if (
                hay.includes('kp type') ||
                hay.includes('target pop') ||
                hay.includes('key population') ||
                hay.includes('population type') ||
                hay.includes('client type') ||
                hay.includes('patient type') ||
                hay.includes('ប្រភេទក្រុមគោលដៅ') ||
                hay.includes('ក្រុមគោលដៅ') ||
                hay.includes('ក្រុមប្រឈម') ||
                hay.includes('ប្រភេទអតិថិជន') ||
                hay.includes('ប្រភេទអ្នកជំងឺ')
            ) {
                set.add(a.id)
            }
        }
        return set
    }, [attributes])

    const lockedAttributeIds = useMemo(() => {
        // Base locked attributes: generated codes (UUIC, SMH, PrEP Code, etc.) must NEVER be editable, even for super admin
        const baseLockedCodes = new Set(
            [
                smhAttributeId && !smhHiddenByRules ? smhAttributeId : null,
                prepAttributeId && !prepHiddenByRules ? prepAttributeId : null,
                uuicAttributeId && !uuicHiddenByRules ? uuicAttributeId : null,
                ...generatedCodeAttributeIds,
            ].filter(Boolean)
        )

        // Super Admin (non-data-entry): can update all profile fields EXCEPT generated codes
        if (effectiveIsAdmin) {
            baseLockedCodes.delete('D7xpPXd6yMl')
            return baseLockedCodes
        }

        // Tracker Capture / Data Entry experience:
        // Lock generated codes, sex, age/dob, name, and client/KP type (ប្រភេទក្រុមគោលដៅ / ប្រភេទអតិថិជន)
        const locked = new Set(baseLockedCodes)

        for (const id of sexAttributeIds) locked.add(id)
        for (const id of ageDobAttributeIds) locked.add(id)
        for (const id of nameAttributeIds) locked.add(id)
        for (const id of kpAttributeIds) locked.add(id)

        // Ensure PrEP Modality and selectable modality fields remain editable
        for (const a of attributes || []) {
            const hay = [a?.systemName, a?.shortName, a?.name, a?.displayName].filter(Boolean).join(' ').toLowerCase()
            if (a?.id === 'D7xpPXd6yMl' || hay.includes('modality') || hay.includes('ប្រើប្រាស់ប្រីព')) {
                locked.delete(a.id)
            }
        }
        locked.delete('D7xpPXd6yMl')

        return locked
    }, [
        effectiveIsAdmin,
        smhAttributeId,
        smhHiddenByRules,
        prepAttributeId,
        prepHiddenByRules,
        uuicAttributeId,
        uuicHiddenByRules,
        sexAttributeIds,
        ageDobAttributeIds,
        nameAttributeIds,
        generatedCodeAttributeIds,
        kpAttributeIds,
        attributes,
    ])

    return (
        <PaperRegistrationForm
            title={null}
            sections={sectionsLayout.mode === 'sections' ? sectionsLayout.sections : []}
            attributes={
                sectionsLayout.mode === 'flat' ? sectionsLayout.flatAttributes : null
            }
            layoutRows={layoutRows}
            nameIds={uuicFieldIds}
            documentSubtitle={null}
            formValues={formValues}
            setFormValues={setFormValues}
            mandatoryFieldIds={mandatoryFieldIds}
            hiddenOptionsByField={hiddenOptionsByField}
            invalidAttrHighlightId={invalidAttrHighlightId}
            ageFieldId={ageFieldId}
            dobFieldId={dobFieldIdForAge}
            ageDobPair={
                pairedAgeDobActive
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
                                  const next = { ...prev, [dobFieldIdForAge]: iso || '' }
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
            disabledAttributeIds={readOnly ? null : lockedAttributeIds}
            readOnly={readOnly}
            showTableHeaders={false}
        />
    )
}
