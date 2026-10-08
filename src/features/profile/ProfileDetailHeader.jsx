import React from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeftIcon } from '@radix-ui/react-icons'
import { Save, Trash2, Plus, CheckCircle2, Circle, X, Pencil, Printer, Layers } from 'lucide-react'
import i18n from '@dhis2/d2-i18n'
import { Button } from '../../components/ui/button'
import { Spinner } from '../../components/ui/spinner'
import { cn } from '../../lib/utils'
import { FORM } from '../../lib/formUi'
import { PAGE_LAYOUT } from '../tei-search/teiListUi'
import { isVisitFormLocked, getVisitFormLockReason } from '../../lib/eventCompletion'

import { getShortStageLabel, groupStagesForWorkflow } from './lib/stageWorkflowGroups'

const stageBarIconBtn =
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200/90 app-surface app-text-label transition-colors outline-none hover:bg-stone-50/80 disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-zinc-800 cursor-pointer shadow-2xs'

const stageBarIconBtnPrimary =
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--app-header-bar-bg)] bg-[var(--app-header-bar-bg)] text-white transition-colors outline-none hover:opacity-90 disabled:pointer-events-none disabled:opacity-40 cursor-pointer shadow-2xs'

const inactiveTabClass =
    'border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'

/**
 * Profile chrome aligned with Records / User Management: title row + white toolbar card (tabs + actions).
 */
export function ProfileDetailHeader({
    pageTitle,
    onBack,
    activeTab,
    onTabChange,
    programStages = [],
    events = [],
    sidebarOpen = false,
    onToggleSidebar,
    metadataLoading,
    metadata,
    onOpenProgramRules,
    onPrintSummary,
    editingEventId,
    eventDate,
    isAddingRecord,
    eventStatus,
    saving,
    onCompleteToggle,
    onCancelEdit,
    onDelete,
    onSave,
    onAddRecord,
    editingProfile = false,
    deletingTei = false,
    deleteTeiModalOpen = false,
    profileLoading = false,
    onStartEditProfile,
    onCancelEditProfile,
    onSaveProfile,
    onDeleteProfile,
    isDataEntryExperience,
    profileExpired = false,
    selectedEvent = null,
}) {
    const isStageTab = activeTab !== 'PROGRAM'
    const isProfileTab = !isStageTab
    const isEditing = Boolean(editingEventId || isAddingRecord)
    const eventObj = isAddingRecord ? null : (selectedEvent || { status: eventStatus, eventDate })
    const visitLocked = isVisitFormLocked(eventObj, isDataEntryExperience)
    const lockReason = getVisitFormLockReason(eventObj, isDataEntryExperience)
    const profileActionsDisabled =
        deletingTei || saving || profileLoading || deleteTeiModalOpen

    const hasManyStages = programStages.length > 5

    const stageStatusMap = React.useMemo(() => {
        const map = new Map()
        for (const stage of programStages) {
            const stEvents = (events || []).filter((e) => (e.programStage || e.stage) === stage.id)
            const hasCompleted = stEvents.some(
                (e) => String(e.status || '').toUpperCase() === 'COMPLETED'
            )
            const hasActive = stEvents.some(
                (e) => String(e.status || '').toUpperCase() === 'ACTIVE'
            )
            map.set(stage.id, {
                count: stEvents.length,
                status: hasCompleted ? 'COMPLETED' : hasActive ? 'ACTIVE' : 'EMPTY',
            })
        }
        return map
    }, [programStages, events])

    // When there are > 5 stages, only display the most relevant tabs horizontally (Profile + Active Stage + Sidebar toggle)
    const visibleTabs = React.useMemo(() => {
        if (!hasManyStages) return programStages
        // Find active stage
        const activeStage = programStages.find((s) => s.id === activeTab)
        if (!activeStage) {
            // In Profile tab: show first 3 stages
            return programStages.slice(0, 3)
        }
        // In a stage tab: show active stage and its neighboring stages
        const idx = programStages.findIndex((s) => s.id === activeTab)
        const start = Math.max(0, idx - 1)
        const end = Math.min(programStages.length, start + 3)
        return programStages.slice(start, end)
    }, [hasManyStages, programStages, activeTab])

    return (
        <div className={PAGE_LAYOUT.stack}>
            <div className="flex min-w-0 items-center gap-2 px-3 py-1 md:px-0 md:py-0">
                <Button
                    type="button"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 rounded-md p-0 app-text-meta transition-colors hover:bg-stone-100/90 hover:app-text-title dark:hover:bg-zinc-800"
                    onClick={onBack}
                    aria-label={i18n.t('Back')}
                >
                    <ChevronLeftIcon className="h-5 w-5" />
                </Button>
                <h1 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight app-text-title md:text-lg">
                    {pageTitle || i18n.t('Patient Profile')}
                </h1>
            </div>

            <div
                className={cn(
                    PAGE_LAYOUT.toolbarCard,
                    'flex items-center justify-between gap-2 md:gap-3'
                )}
            >
                <div className="tab-strip-scroll flex min-h-8 min-w-0 flex-1 items-center gap-1.5 overflow-x-auto overscroll-x-contain py-0.5 custom-scrollbar-hide">
                    <button
                        type="button"
                        onClick={() => onTabChange('PROGRAM')}
                        className={cn(
                            FORM.tab,
                            'shrink-0 truncate whitespace-nowrap rounded-full px-3 py-1 text-xs transition-all',
                            activeTab === 'PROGRAM'
                                ? 'border-[var(--app-header-bar-bg)] bg-[var(--app-header-bar-bg)] text-white font-semibold shadow-xs'
                                : inactiveTabClass
                        )}
                    >
                        {i18n.t('Profile')}
                    </button>

                    {visibleTabs.map((stage) => {
                        const stInfo = stageStatusMap.get(stage.id)
                        const shortLabel = getShortStageLabel(stage.displayName || stage.name)
                        const isActive = activeTab === stage.id

                        return (
                            <button
                                type="button"
                                key={stage.id}
                                title={stage.displayName || stage.name}
                                onClick={() => onTabChange(stage.id)}
                                className={cn(
                                    FORM.tab,
                                    'shrink-0 flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs transition-all',
                                    isActive
                                        ? 'border-[var(--app-header-bar-bg)] bg-[var(--app-header-bar-bg)] text-white font-semibold shadow-xs'
                                        : inactiveTabClass
                                )}
                            >
                                <span
                                    className={cn(
                                        'h-2 w-2 rounded-full shrink-0 transition-opacity',
                                        stInfo?.status === 'COMPLETED'
                                            ? 'bg-emerald-500 ring-2 ring-emerald-300 dark:ring-emerald-700'
                                            : stInfo?.status === 'ACTIVE'
                                              ? 'bg-amber-500 ring-2 ring-amber-300 dark:ring-amber-700'
                                              : isActive
                                                ? 'bg-white/60'
                                                : 'bg-slate-300 dark:bg-zinc-600'
                                    )}
                                    title={
                                        stInfo?.status === 'COMPLETED'
                                            ? i18n.t('Completed event recorded')
                                            : stInfo?.status === 'ACTIVE'
                                              ? i18n.t('In-progress event recorded')
                                              : i18n.t('No events recorded yet')
                                    }
                                />
                                <span>{shortLabel}</span>
                            </button>
                        )
                    })}

                    {hasManyStages && onToggleSidebar && (
                        <button
                            type="button"
                            onClick={onToggleSidebar}
                            className={cn(
                                FORM.tab,
                                'shrink-0 flex items-center gap-1.5 px-2.5 font-bold transition-all',
                                sidebarOpen
                                    ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/60 dark:border-blue-700 dark:text-blue-200'
                                    : 'bg-slate-100 dark:bg-zinc-800 border-slate-200/90 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-200/70'
                            )}
                            title={i18n.t('View all {{count}} stages & forms in sidebar', {
                                count: programStages.length,
                            })}
                        >
                            <Layers className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            <span>{i18n.t('All Forms ({{count}})', { count: programStages.length })}</span>
                        </button>
                    )}
                </div>

                <div className="flex items-center justify-end gap-1.5 shrink-0 pl-1.5 md:border-l md:border-slate-200/90 md:pl-3 dark:md:border-zinc-700">
                    {isProfileTab ? (
                        <div
                            className="flex flex-1 items-center justify-end gap-1 md:flex-none md:gap-1.5"
                            role="toolbar"
                        >
                            {/* Print Health Card & Summary is accessible to all roles including Tracker Capture / Data Entry */}
                            {!editingProfile && (
                                <button
                                    type="button"
                                    className={stageBarIconBtn}
                                    title={i18n.t('Print Health Card & Summary')}
                                    aria-label={i18n.t('Print Health Card & Summary')}
                                    onClick={onPrintSummary}
                                >
                                    <Printer className="h-5 w-5" strokeWidth={2} aria-hidden />
                                </button>
                            )}

                            {editingProfile ? (
                                <>
                                    <button
                                        type="button"
                                        className={stageBarIconBtn}
                                        title={i18n.t('Cancel')}
                                        aria-label={i18n.t('Cancel')}
                                        onClick={onCancelEditProfile}
                                        disabled={profileActionsDisabled}
                                    >
                                        <X className="h-5 w-5" strokeWidth={2} aria-hidden />
                                    </button>
                                    <button
                                        type="button"
                                        className={stageBarIconBtnPrimary}
                                        onClick={onSaveProfile}
                                        disabled={profileActionsDisabled}
                                        title={saving ? i18n.t('Saving...') : i18n.t('Save profile')}
                                        aria-label={saving ? i18n.t('Saving...') : i18n.t('Save profile')}
                                    >
                                        {saving ? (
                                            <Spinner className="h-5 w-5 border-slate-400 border-t-white" />
                                        ) : (
                                            <Save className="h-5 w-5" strokeWidth={2} aria-hidden />
                                        )}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        className={cn(
                                            stageBarIconBtn,
                                            profileExpired && 'opacity-40 cursor-not-allowed'
                                        )}
                                        title={
                                            profileExpired
                                                ? i18n.t('This profile record is older than 2 weeks and can no longer be edited.')
                                                : i18n.t('Edit profile')
                                        }
                                        aria-label={
                                            profileExpired
                                                ? i18n.t('This profile record is older than 2 weeks and can no longer be edited.')
                                                : i18n.t('Edit profile')
                                        }
                                        onClick={onStartEditProfile}
                                        disabled={profileActionsDisabled || profileExpired}
                                    >
                                        <Pencil className="h-5 w-5" strokeWidth={2} aria-hidden />
                                    </button>
                                    {!isDataEntryExperience && (
                                        <button
                                            type="button"
                                            className={cn(
                                                stageBarIconBtn,
                                                'border-red-200/90 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40'
                                            )}
                                            title={i18n.t('Delete profile')}
                                            aria-label={i18n.t('Delete profile')}
                                            onClick={onDeleteProfile}
                                            disabled={profileActionsDisabled || editingProfile}
                                        >
                                            <Trash2 className="h-5 w-5" strokeWidth={2} aria-hidden />
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    ) : isStageTab ? (
                        <div
                            className="flex flex-1 items-center justify-end gap-1 md:flex-none md:gap-1.5"
                            role="toolbar"
                        >
                            {isEditing ? (
                                <>
                                    <button
                                        type="button"
                                        className={cn(
                                            stageBarIconBtn,
                                            'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 dark:border-emerald-600 dark:bg-emerald-600 dark:text-white dark:hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-600'
                                        )}
                                        title={
                                            lockReason === 'EXPIRED'
                                                ? i18n.t('This event is older than 2 weeks and can no longer be edited.')
                                                : !editingEventId
                                                  ? i18n.t('Please save record before completing')
                                                  : eventStatus === 'COMPLETED'
                                                    ? i18n.t('Completed')
                                                    : i18n.t('Mark Complete')
                                        }
                                        aria-label={
                                            lockReason === 'EXPIRED'
                                                ? i18n.t('This event is older than 2 weeks and can no longer be edited.')
                                                : !editingEventId
                                                  ? i18n.t('Please save record before completing')
                                                  : eventStatus === 'COMPLETED'
                                                    ? i18n.t('Completed')
                                                    : i18n.t('Mark Complete')
                                        }
                                        aria-pressed={eventStatus === 'COMPLETED'}
                                        disabled={!editingEventId || lockReason === 'EXPIRED' || saving}
                                        onClick={(e) => {
                                            e.preventDefault()
                                            onCompleteToggle?.()
                                        }}
                                    >
                                        {eventStatus === 'COMPLETED' ? (
                                            <CheckCircle2 className="h-5 w-5 text-white" strokeWidth={2} aria-hidden />
                                        ) : (
                                            <Circle className="h-5 w-5 text-white" strokeWidth={2} aria-hidden />
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        className={stageBarIconBtn}
                                        title={i18n.t('Cancel')}
                                        aria-label={i18n.t('Cancel')}
                                        onClick={onCancelEdit}
                                    >
                                        <X className="h-5 w-5" strokeWidth={2} aria-hidden />
                                    </button>
                                    {editingEventId ? (
                                        <button
                                            type="button"
                                            className={cn(
                                                stageBarIconBtn,
                                                'border-red-200/90 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40 disabled:opacity-30 disabled:cursor-not-allowed'
                                            )}
                                            title={
                                                lockReason === 'EXPIRED'
                                                    ? i18n.t('This event is older than 2 weeks and can no longer be edited.')
                                                    : i18n.t('Delete')
                                            }
                                            aria-label={
                                                lockReason === 'EXPIRED'
                                                    ? i18n.t('This event is older than 2 weeks and can no longer be edited.')
                                                    : i18n.t('Delete')
                                            }
                                            onClick={onDelete}
                                            disabled={saving || lockReason === 'EXPIRED'}
                                        >
                                            <Trash2 className="h-5 w-5" strokeWidth={2} aria-hidden />
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        className={stageBarIconBtnPrimary}
                                        onClick={onSave}
                                        disabled={saving || visitLocked}
                                        title={
                                            lockReason === 'EXPIRED'
                                                ? i18n.t('This event is older than 2 weeks and can no longer be edited.')
                                                : visitLocked
                                                  ? i18n.t(
                                                        'This visit is complete — mark it incomplete before saving. Use the status button in the toolbar.'
                                                    )
                                                  : saving
                                                    ? i18n.t('Saving...')
                                                    : i18n.t('Save Entry')
                                        }
                                        aria-label={
                                            lockReason === 'EXPIRED'
                                                ? i18n.t('This event is older than 2 weeks and can no longer be edited.')
                                                : visitLocked
                                                  ? i18n.t(
                                                        'This visit is complete — mark it incomplete before saving. Use the status button in the toolbar.'
                                                    )
                                                  : saving
                                                    ? i18n.t('Saving...')
                                                    : i18n.t('Save Entry')
                                        }
                                    >
                                        {saving ? (
                                            <Spinner className="h-5 w-5 border-slate-400 border-t-white" />
                                        ) : (
                                            <Save className="h-5 w-5" strokeWidth={2} aria-hidden />
                                        )}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        className={stageBarIconBtn}
                                        title={i18n.t('Print Health Card & Summary')}
                                        aria-label={i18n.t('Print Health Card & Summary')}
                                        onClick={onPrintSummary}
                                    >
                                        <Printer className="h-5 w-5" strokeWidth={2} aria-hidden />
                                    </button>
                                    <button
                                        type="button"
                                        className={cn(stageBarIconBtnPrimary, 'md:h-10 md:w-10')}
                                        title={i18n.t('Add New Entry')}
                                        aria-label={i18n.t('Add New Entry')}
                                        onClick={onAddRecord}
                                    >
                                        <Plus className="h-5 w-5" strokeWidth={2} aria-hidden />
                                    </button>
                                    {onAddRecord && typeof document !== 'undefined'
                                        ? createPortal(
                                              <button
                                                  type="button"
                                                  onClick={onAddRecord}
                                                  aria-label={i18n.t('Add New Entry')}
                                                  title={i18n.t('Add New Entry')}
                                                  className={cn(
                                                      'fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] right-4 z-[35] md:hidden',
                                                      'flex h-12 w-12 items-center justify-center rounded-full',
                                                      'bg-[var(--app-header-bar-bg)] text-white shadow-xl shadow-slate-900/30',
                                                      'border-2 border-white/50 active:scale-90 transition-all duration-150 cursor-pointer pointer-events-auto'
                                                  )}
                                              >
                                                  <Plus className="h-6 w-6 stroke-[2.5]" />
                                              </button>,
                                              document.body
                                          )
                                        : null}
                                </>
                            )}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    )
}
