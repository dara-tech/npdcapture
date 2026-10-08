import React, { useState, useMemo } from 'react'
import i18n from '@dhis2/d2-i18n'
import {
    Copy,
    Check,
    Pencil,
    Clock,
    Building2,
    Calendar,
    User,
    CheckCircle2,
    ShieldAlert,
    Save,
    X,
} from 'lucide-react'
import { cn } from '../../../lib/utils'
import { formatProfileAttributeDisplayValue } from '../../../lib/profileAttributeForm'
import { completedYearsFromDobIso, attributeIsDatePickerDob } from '../../../lib/ageDobFromAge'
import { DatePicker } from '../../../components/ui/date-picker'
import { KhmerVirtualKeyboard } from '../../../components/ui/khmer-virtual-keyboard'
import { getInputTypeForValueType } from '../../../lib/fieldValidation'

function CopyableBadge({ value }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = (e) => {
        e.stopPropagation()
        if (!value) return
        navigator.clipboard.writeText(String(value).trim())
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    return (
        <button
            type="button"
            onClick={handleCopy}
            title={copied ? i18n.t('Copied!') : i18n.t('Copy to clipboard')}
            className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-[12px] font-semibold transition-all active:scale-95 cursor-pointer',
                copied
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 border border-slate-200/90 dark:border-zinc-700 hover:bg-slate-200/70 dark:hover:bg-zinc-700'
            )}
        >
            <span>{value}</span>
            {copied ? (
                <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
            ) : (
                <Copy className="h-3 w-3 text-slate-400 dark:text-zinc-400" />
            )}
        </button>
    )
}

export function MobileProfileView({
    tei,
    enrollment,
    metadata,
    context,
    visibleProfileAttributes = [],
    formValues = {},
    setFormValues,
    editingProfile = false,
    onStartEditProfile,
    onSaveProfile,
    onCancelEditProfile,
    profileExpired = false,
    mandatoryFieldIds,
    hiddenOptionsByField,
    lockedAttributeIds = new Set(),
    saving = false,
}) {
    // 1. Identify key fields (names, DOB, age, IDs)
    const {
        lastNameAttr,
        firstNameAttr,
        dobAttr,
        ageAttr,
        sexAttr,
        idAttributes,
        personalAttributes,
        otherAttributes,
    } = useMemo(() => {
        let last = null
        let first = null
        let dob = null
        let age = null
        let sex = null

        const ids = []
        const personal = []
        const others = []

        for (const attr of visibleProfileAttributes) {
            const nameLower = (attr?.name || attr?.displayName || '').toLowerCase()
            const isId =
                nameLower.includes('pmrs') ||
                nameLower.includes('uuic') ||
                nameLower.includes('smh') ||
                nameLower.includes('id poor') ||
                nameLower.includes('poor') ||
                nameLower.includes('nssf') ||
                nameLower.includes('លេខកូដ')

            const isLastName = nameLower.includes('នាមត្រកូល') || nameLower.includes('last')
            const isFirstName = nameLower.includes('នាមខ្លួន') || nameLower.includes('first')
            const isDob = attributeIsDatePickerDob(attr) || nameLower.includes('dob') || nameLower.includes('កំណើត')
            const isAge = nameLower.includes('age') || nameLower.includes('អាយុ')
            const isSex = nameLower.includes('sex') || nameLower.includes('gender') || nameLower.includes('ភេទ')

            if (isLastName) last = attr
            if (isFirstName) first = attr
            if (isDob) dob = attr
            if (isAge) age = attr
            if (isSex) sex = attr

            if (isId) {
                ids.push(attr)
            } else if (isLastName || isFirstName || isDob || isAge || isSex || nameLower.includes('phone') || nameLower.includes('ទូរស័ព្ទ')) {
                personal.push(attr)
            } else {
                others.push(attr)
            }
        }

        return {
            lastNameAttr: last,
            firstNameAttr: first,
            dobAttr: dob,
            ageAttr: age,
            sexAttr: sex,
            idAttributes: ids,
            personalAttributes: personal,
            otherAttributes: others,
        }
    }, [visibleProfileAttributes])

    // Patient display details
    const lastName = lastNameAttr ? (formValues[lastNameAttr.id] || '') : ''
    const firstName = firstNameAttr ? (formValues[firstNameAttr.id] || '') : ''
    const fullName = [lastName, firstName].filter(Boolean).join(' ')

    const sexVal = sexAttr ? (formValues[sexAttr.id] || '') : ''
    const dobVal = dobAttr ? (formValues[dobAttr.id] || '') : ''
    const ageVal = useMemo(() => {
        if (ageAttr && formValues[ageAttr.id]) return formValues[ageAttr.id]
        if (dobVal) return completedYearsFromDobIso(dobVal)
        return ''
    }, [ageAttr, formValues, dobVal])

    const pmrsVal = useMemo(() => {
        const pmrsAttr = visibleProfileAttributes.find((a) =>
            (a.name || '').toLowerCase().includes('pmrs')
        )
        return pmrsAttr ? formValues[pmrsAttr.id] : null
    }, [visibleProfileAttributes, formValues])

    const orgUnitName = useMemo(() => {
        if (enrollment?.orgUnitName) return enrollment.orgUnitName
        const ou = metadata?.organisationUnits?.find((o) => o.id === context?.orgUnit)
        return ou?.displayName || ou?.name || ''
    }, [enrollment, metadata, context])

    const isActive = enrollment?.status === 'ACTIVE' || !enrollment?.status
    const eventsCount = enrollment?.events?.length ?? 0

    // Avatar initials
    const initials = useMemo(() => {
        if (lastName || firstName) {
            return `${lastName?.[0] || ''}${firstName?.[0] || ''}`
        }
        if (fullName) return fullName.slice(0, 2)
        return ''
    }, [lastName, firstName, fullName])

    const handleFieldChange = (attrId, val) => {
        if (!setFormValues) return
        setFormValues((prev) => ({
            ...prev,
            [attrId]: val,
        }))
    }

    const renderAttributeRow = (attr) => {
        const rawVal = formValues[attr.id]
        const displayVal = formatProfileAttributeDisplayValue(attr, rawVal)
        const nameLower = (attr?.name || attr?.displayName || '').toLowerCase()
        const isId =
            nameLower.includes('pmrs') ||
            nameLower.includes('uuic') ||
            nameLower.includes('smh') ||
            nameLower.includes('លេខកូដ')

        const isNameField = attr.id === firstNameAttr?.id || attr.id === lastNameAttr?.id
        const isPhoneField = nameLower.includes('phone') || nameLower.includes('ទូរស័ព្ទ')
        const isLocked = lockedAttributeIds.has(attr.id)
        const isMandatory = mandatoryFieldIds?.has?.(attr.id) || Boolean(attr.mandatory)
        const opts = (attr?.optionSet?.options || []).filter(Boolean)

        // Read-only presentation
        if (!editingProfile) {
            // Age & DOB composite display
            if (attr.id === dobAttr?.id && ageVal) {
                return (
                    <div
                        key={attr.id}
                        className="flex items-center justify-between px-4 py-3 min-h-[46px] gap-3"
                    >
                        <span className="text-[13px] font-medium text-slate-500 dark:text-zinc-400">
                            {attr.name}
                        </span>
                        <div className="flex items-center gap-1.5 text-right">
                            <span className="text-[13.5px] font-semibold text-slate-900 dark:text-zinc-100">
                                {displayVal && displayVal !== '-' ? displayVal : '—'}
                            </span>
                            {ageVal ? (
                                <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-700">
                                    {i18n.t('Age')}: {ageVal}
                                </span>
                            ) : null}
                        </div>
                    </div>
                )
            }

            return (
                <div
                    key={attr.id}
                    className="flex items-center justify-between px-4 py-3 min-h-[46px] gap-3"
                >
                    <span className="text-[13px] font-medium text-slate-500 dark:text-zinc-400">
                        {attr.name}
                    </span>
                    <div className="text-right">
                        {isId && displayVal && displayVal !== '-' ? (
                            <CopyableBadge value={displayVal} />
                        ) : displayVal && displayVal !== '-' ? (
                            <span className="text-[13.5px] font-semibold text-slate-900 dark:text-zinc-100">
                                {displayVal}
                            </span>
                        ) : (
                            <span className="text-slate-300 dark:text-zinc-600 font-normal select-none">
                                —
                            </span>
                        )}
                    </div>
                </div>
            )
        }

        // Edit presentation
        return (
            <div
                key={attr.id}
                className="flex flex-col gap-1 px-4 py-2.5 border-b border-slate-100 dark:border-zinc-800/60 last:border-none"
            >
                <label className="text-[12.5px] font-medium text-slate-600 dark:text-zinc-300">
                    {attr.name}
                    {isMandatory && <span className="ml-1 text-red-500 font-bold">*</span>}
                </label>
                {isLocked ? (
                    <div className="text-[13px] font-semibold text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 select-all">
                        {displayVal || '—'}
                    </div>
                ) : opts.length > 0 ? (
                    <select
                        value={rawVal ?? ''}
                        onChange={(e) => handleFieldChange(attr.id, e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-slate-900 dark:text-zinc-100 font-medium focus:border-blue-500 focus:outline-none"
                    >
                        <option value="">{i18n.t('Select...')}</option>
                        {opts.map((opt) => (
                            <option key={opt.code || opt.id} value={opt.code || opt.id}>
                                {opt.displayName || opt.name}
                            </option>
                        ))}
                    </select>
                ) : attributeIsDatePickerDob(attr) || attr.valueType === 'DATE' ? (
                    <DatePicker
                        date={rawVal}
                        setDate={(d) => handleFieldChange(attr.id, d)}
                        placeholder="dd/MM/yyyy"
                    />
                ) : isNameField ? (
                    <div className="relative w-full">
                        <input
                            type="text"
                            value={rawVal ?? ''}
                            onChange={(e) =>
                                handleFieldChange(
                                    attr.id,
                                    e.target.value.replace(/[^\u1780-\u17FF\s]/g, '')
                                )
                            }
                            className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 pr-10 text-sm text-slate-900 dark:text-zinc-100 font-medium focus:border-blue-500 focus:outline-none"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <KhmerVirtualKeyboard
                                onInsert={(c) => handleFieldChange(attr.id, (rawVal || '') + c)}
                                onBackspace={() =>
                                    handleFieldChange(attr.id, (rawVal || '').slice(0, -1))
                                }
                            />
                        </div>
                    </div>
                ) : (
                    <input
                        type={isPhoneField ? 'tel' : getInputTypeForValueType(attr.valueType)}
                        value={rawVal ?? ''}
                        onChange={(e) =>
                            handleFieldChange(
                                attr.id,
                                isPhoneField
                                    ? e.target.value.replace(/[^\d+]/g, '')
                                    : e.target.value
                            )
                        }
                        className="w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-slate-900 dark:text-zinc-100 font-medium focus:border-blue-500 focus:outline-none"
                    />
                )}
            </div>
        )
    }

    return (
        <div className="flex flex-col w-full pb-8 select-text">
            {/* 1. Native Hero Patient Header */}
            <div className="bg-white dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 px-4 pt-3 pb-3.5 mb-2.5">
                <div className="flex items-center gap-3">
                    {/* Patient Avatar Circle - perfectly round, never squished */}
                    <div className="h-12 w-12 aspect-square rounded-full shrink-0 flex items-center justify-center bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-base shadow-sm ring-2 ring-blue-100 dark:ring-blue-900/40">
                        {initials ? initials : <User className="h-5 w-5 text-white" />}
                    </div>

                    {/* Patient Details */}
                    <div className="flex flex-col min-w-0 flex-1">
                        <h2 className="text-[16.5px] font-bold text-slate-900 dark:text-zinc-100 truncate tracking-tight">
                            {fullName || pmrsVal || i18n.t('Patient Profile')}
                        </h2>

                        {/* Clean Single Subtitle Line */}
                        <p className="text-[12.5px] text-slate-500 dark:text-zinc-400 font-medium truncate mt-0.5">
                            {[
                                sexVal || null,
                                ageVal ? `${ageVal} ${i18n.t('yrs')}` : null,
                                pmrsVal ? `PMRS: ${pmrsVal}` : null,
                            ]
                                .filter(Boolean)
                                .join(' · ') || i18n.t('Client Record')}
                        </p>

                        {/* Status Pills */}
                        <div className="flex items-center gap-1.5 mt-1.5">
                            <span
                                className={cn(
                                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                                    isActive
                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                        : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700'
                                )}
                            >
                                <span
                                    className={cn(
                                        'h-1.5 w-1.5 rounded-full',
                                        isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                                    )}
                                />
                                {isActive ? i18n.t('Active') : i18n.t('Completed')}
                            </span>

                            <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-zinc-400 border border-slate-200/80 dark:border-zinc-700">
                                {eventsCount} {i18n.t('Visits')}
                            </span>

                            {profileExpired ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800 px-2 py-0.5 text-[11px] font-semibold">
                                    <Clock className="h-3 w-3 text-amber-500" />
                                    <span>{i18n.t('Locked (>14d)')}</span>
                                </span>
                            ) : null}
                        </div>
                    </div>
                </div>

                {orgUnitName ? (
                    <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800/80 text-[11.5px] text-slate-400 dark:text-zinc-500 font-medium">
                        <Building2 className="h-3 w-3 text-slate-400" />
                        <span className="truncate">{orgUnitName}</span>
                    </div>
                ) : null}
            </div>

            {/* 2. Grouped Inset Cards */}
            <div className="flex flex-col gap-3.5 px-3.5 pb-6">
                {/* Section 1: Identifiers */}
                {idAttributes.length > 0 && (
                    <div>
                        <div className="px-1.5 pb-1 text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                            {i18n.t('Identifiers')}
                        </div>
                        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/70 dark:border-zinc-800 shadow-2xs overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800/60">
                            {idAttributes.map(renderAttributeRow)}
                        </div>
                    </div>
                )}

                {/* Section 2: Personal Information */}
                {personalAttributes.length > 0 && (
                    <div>
                        <div className="px-1.5 pb-1 text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                            {i18n.t('Personal Information')}
                        </div>
                        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/70 dark:border-zinc-800 shadow-2xs overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800/60">
                            {personalAttributes.map(renderAttributeRow)}
                        </div>
                    </div>
                )}

                {/* Section 3: Additional Details */}
                {otherAttributes.length > 0 && (
                    <div>
                        <div className="px-1.5 pb-1 text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                            {i18n.t('Additional Information')}
                        </div>
                        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/70 dark:border-zinc-800 shadow-2xs overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800/60">
                            {otherAttributes.map(renderAttributeRow)}
                        </div>
                    </div>
                )}
            </div>

            {/* 3. Floating Bottom Action Bar for Edit Mode */}
            {editingProfile && (
                <div className="sticky bottom-0 left-0 right-0 z-20 mt-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur border-t border-slate-200 dark:border-zinc-800 p-3 flex items-center justify-end gap-2 shadow-lg">
                    {onCancelEditProfile && (
                        <button
                            type="button"
                            onClick={onCancelEditProfile}
                            disabled={saving}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-zinc-200 active:scale-98 transition-all"
                        >
                            <X className="h-4 w-4" />
                            <span>{i18n.t('Cancel')}</span>
                        </button>
                    )}
                    {onSaveProfile && (
                        <button
                            type="button"
                            onClick={onSaveProfile}
                            disabled={saving}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-blue-700 active:scale-98 transition-all shadow-md shadow-blue-500/20"
                        >
                            <Save className="h-4 w-4" />
                            <span>{saving ? i18n.t('Saving...') : i18n.t('Save Profile')}</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
