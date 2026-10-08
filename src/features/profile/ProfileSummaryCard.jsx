import React, { useMemo } from 'react'
import i18n from '@dhis2/d2-i18n'
import { Calendar, Building2, CheckCircle2, Clock, Pencil } from 'lucide-react'
import { FORM } from '../../lib/formUi'
import { cn } from '../../lib/utils'
import { ProfileAttributeFields } from './ProfileAttributeFields'
import { MobileProfileView } from './components/MobileProfileView'
import { isProfileExpired } from '../../lib/eventCompletion'

export function ProfileSummaryCard({
    embedded = false,
    className,
    context,
    metadata,
    tei,
    enrollment,
    visibleProfileAttributes,
    editingProfile,
    onStartEditProfile,
    onSaveProfile,
    onCancelEditProfile,
    profileAttrValues,
    setProfileAttrValues,
    hiddenFields,
    mandatoryFieldIds,
    hiddenOptionsByField,
    invalidProfileAttrHighlightId,
    setInvalidProfileAttrHighlightId,
    invalidProfileAttrBaselineRef,
    getAttributeValue,
    isAdmin = false,
    isSuperuser = false,
    isDataEntryExperience = false,
    profileExpired: profileExpiredProp = undefined,
    saving = false,
}) {
    const profileDisplayValues = useMemo(() => {
        const out = {}
        for (const attr of visibleProfileAttributes) {
            const raw = getAttributeValue(tei, attr.id)
            out[attr.id] = raw === '-' ? '' : raw
        }
        return out
    }, [tei, visibleProfileAttributes, getAttributeValue])

    const orgUnitName = useMemo(() => {
        if (enrollment?.orgUnitName) return enrollment.orgUnitName
        const ou = metadata?.organisationUnits?.find((o) => o.id === context?.orgUnit)
        return ou?.displayName || ou?.name || ''
    }, [enrollment, metadata, context])

    const enrolledDate = useMemo(() => {
        const d = enrollment?.enrolledAt || enrollment?.enrollmentDate || tei?.created
        if (!d) return ''
        return d.split('T')[0]
    }, [enrollment, tei])

    const profileExpired = useMemo(() => {
        if (typeof profileExpiredProp === 'boolean') return profileExpiredProp
        return isProfileExpired(enrollment, tei, isDataEntryExperience && !isAdmin && !isSuperuser)
    }, [profileExpiredProp, enrollment, tei, isDataEntryExperience, isAdmin, isSuperuser])

    const isActive = enrollment?.status === 'ACTIVE' || !enrollment?.status

    return (
        <section
            className={cn(
                embedded ? 'flex min-h-0 flex-1 flex-col overflow-y-auto custom-scrollbar' : FORM.sectionCardShell,
                className
            )}
        >
            {/* Desktop View (hidden on mobile, paper form layout on md+) */}
            <div className="hidden md:flex md:flex-col md:min-h-0 md:flex-1">
                {/* Clinical Profile Summary Top Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/90 bg-slate-50/90 px-3.5 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/90 md:px-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className={cn(FORM.sectionBarTitle, 'text-[13px] font-bold text-slate-800 dark:text-zinc-100')}>
                            {i18n.t('Profile Records')}
                        </h3>

                        {/* Status Badge */}
                        <span
                            className={cn(
                                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide shadow-2xs',
                                isActive
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
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

                        {/* Org Unit Badge */}
                        {orgUnitName ? (
                            <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-white dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-700 shadow-2xs">
                                <Building2 className="h-3 w-3 text-slate-400" />
                                <span className="truncate max-w-[140px]">{orgUnitName}</span>
                            </span>
                        ) : null}

                        {/* Enrollment Date */}
                        {enrolledDate ? (
                            <span className="hidden md:inline-flex items-center gap-1 rounded-md bg-white dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-700 shadow-2xs">
                                <Calendar className="h-3 w-3 text-slate-400" />
                                <span>{enrolledDate}</span>
                            </span>
                        ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-md bg-slate-200/70 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:text-zinc-300">
                            {visibleProfileAttributes.length} {i18n.t('Fields')}
                        </span>
                        {!editingProfile && onStartEditProfile && !profileExpired ? (
                            <button
                                type="button"
                                onClick={onStartEditProfile}
                                className="inline-flex items-center gap-1 rounded-md bg-white dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-zinc-200 border border-slate-200/80 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors shadow-2xs cursor-pointer"
                                title={i18n.t('Edit profile')}
                            >
                                <Pencil className="h-3 w-3 text-slate-500 dark:text-zinc-400" />
                                <span>{i18n.t('Edit')}</span>
                            </button>
                        ) : !editingProfile && profileExpired ? (
                            <span
                                className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800 shadow-2xs select-none"
                                title={i18n.t('This profile record is older than 2 weeks and can no longer be edited.')}
                            >
                                <Clock className="h-3 w-3 text-amber-500" />
                                <span>{i18n.t('Locked (>14d)')}</span>
                            </span>
                        ) : null}
                    </div>
                </div>

                <div
                    className={cn(
                        FORM.profileSectionBody,
                        'paper-form-ui w-full max-w-none px-4 pt-4 pb-4 md:px-5 md:pt-4.5 md:pb-6 custom-scrollbar'
                    )}
                >
                    <ProfileAttributeFields
                        context={context}
                        metadata={metadata}
                        attributes={visibleProfileAttributes}
                        formValues={editingProfile ? profileAttrValues : profileDisplayValues}
                        setFormValues={setProfileAttrValues}
                        hiddenFields={hiddenFields}
                        mandatoryFieldIds={mandatoryFieldIds}
                        hiddenOptionsByField={hiddenOptionsByField}
                        invalidAttrHighlightId={invalidProfileAttrHighlightId}
                        setInvalidAttrHighlightId={setInvalidProfileAttrHighlightId}
                        invalidAttrBaselineRef={invalidProfileAttrBaselineRef}
                        allowSmhAutofill={false}
                        readOnly={!editingProfile || profileExpired}
                        lockIdentityFields={!isAdmin && !isSuperuser}
                        isAdmin={isAdmin}
                        isSuperuser={isSuperuser}
                    />
                </div>
            </div>

            {/* Native Mobile View (visible only on mobile screen < md) */}
            <div className="block md:hidden w-full">
                <MobileProfileView
                    tei={tei}
                    enrollment={enrollment}
                    metadata={metadata}
                    context={context}
                    visibleProfileAttributes={visibleProfileAttributes}
                    formValues={editingProfile ? profileAttrValues : profileDisplayValues}
                    setFormValues={setProfileAttrValues}
                    editingProfile={editingProfile}
                    onStartEditProfile={onStartEditProfile}
                    onSaveProfile={onSaveProfile}
                    onCancelEditProfile={onCancelEditProfile}
                    profileExpired={profileExpired}
                    mandatoryFieldIds={mandatoryFieldIds}
                    hiddenOptionsByField={hiddenOptionsByField}
                    isAdmin={isAdmin}
                    isSuperuser={isSuperuser}
                    isDataEntryExperience={isDataEntryExperience}
                    saving={saving}
                />
            </div>
        </section>
    )
}
