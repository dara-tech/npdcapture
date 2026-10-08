import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import i18n from '@dhis2/d2-i18n'
import { useDataEngine } from '@dhis2/app-runtime'
import { fetchOrgUnits, fetchProgramMetadata, fetchPrograms } from '../../services/trackerApi'
import { normalizeProgramMetadata } from '../../services/metadataService'
import { Select } from '../../components/ui/select'
import { useOrgUnitTree } from '../../hooks/useOrgUnitTree'
import { OrgUnitSelect } from './OrgUnitSelect'
import { PeriodSelectModal } from '../../components/PeriodSelectModal'
import { cn } from '../../lib/utils'
import {
    MagnifyingGlassIcon,
    DownloadIcon,
    UploadIcon,
    MixerHorizontalIcon,
    PlusIcon,
    ListBulletIcon,
    ComponentInstanceIcon,
} from '@radix-ui/react-icons'
import { Bell, FileSpreadsheet } from 'lucide-react'

const isProgramAvailableForOrgUnit = (program, selectedOrgPath) => {
    if (!program || !selectedOrgPath) {
        return false
    }
    const assignedOrgUnits = program.organisationUnits || []
    if (!assignedOrgUnits.length) {
        return false
    }
    return assignedOrgUnits.some((ou) => {
        const path = ou.path || ''
        return path && (selectedOrgPath.startsWith(path) || path.startsWith(selectedOrgPath))
    })
}

const filterSelectClass =
    'app-filter-control rounded-full text-[12.5px] font-semibold'

const orgFilterButtonClass =
    'app-filter-control flex items-center px-3 text-left rounded-full text-[12.5px] font-semibold'

const EMPTY_PERIOD_KEYS = []

export const TrackerContextSelector = ({
    context,
    onChange,
    onSearchClick,
    onAppointmentsClick,
    todayAppointmentsCount = 0,
    missedAppointmentsCount = 0,
    onExportClick,
    onImportClick,
    onConfigClick,
    onRegisterClick,
    onMonthlyReportClick,
    onToggleViewMode,
    viewMode = 'ENROLLMENTS',
    layout = 'default',
    disabled = false,
    showRecordActions = true,
    showSearch = true,
    showAppointments = true,
    showMonthlyReport = true,
    showImportExport = true,
    showViewModeToggle = true,
    showColumnConfig = true,
    showRegister = true,
    allowedPeriodKinds = null,
}) => {
    const isAdminLayout = layout === 'admin'
    const engine = useDataEngine()
    const [orgUnits, setOrgUnits] = useState([])
    const [programs, setPrograms] = useState([])
    const [metadataByProgram, setMetadataByProgram] = useState({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // Keep a ref to the latest context so effects can read it without adding
    // context to their dependency arrays (which causes infinite loops).
    const contextRef = useRef(context)
    useEffect(() => { contextRef.current = context })

    // Keep a ref to the latest onChange so effects can call it without
    // adding onChange to their dependency arrays.
    const onChangeRef = useRef(onChange)
    useEffect(() => { onChangeRef.current = onChange })

    const { selectedOrg } = useOrgUnitTree(orgUnits, context.orgUnit)

    const selectedPeriodKeys = useMemo(() => {
        if (context.periodKeys && Array.isArray(context.periodKeys)) return context.periodKeys
        if (context.period) return [context.period]
        return EMPTY_PERIOD_KEYS
    }, [context.periodKeys, context.period])

    useEffect(() => {
        const run = async () => {
            try {
                setLoading(true)
                const [orgUnitList, programList] = await Promise.all([
                    fetchOrgUnits({ engine }),
                    fetchPrograms({ engine }),
                ])
                setOrgUnits(orgUnitList)
                setPrograms(programList)
                // Use ref so we don't need context in deps (avoids loop)
                const ctx = contextRef.current
                const cb = onChangeRef.current
                if (!ctx.orgUnit && orgUnitList[0]?.id) {
                    const firstOu = orgUnitList[0]
                    cb({
                        ...ctx,
                        orgUnit: firstOu.id,
                        orgUnitName: firstOu?.displayName || firstOu?.name || '',
                    })
                } else if (ctx.orgUnit && !ctx.orgUnitName) {
                    const currentOu = orgUnitList.find((o) => o.id === ctx.orgUnit)
                    if (currentOu) {
                        cb({
                            ...ctx,
                            orgUnitName: currentOu?.displayName || currentOu?.name || '',
                        })
                    }
                }
            } catch (e) {
                setError(e.message || i18n.t('Failed to load setup metadata'))
            } finally {
                setLoading(false)
            }
        }
        run()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [engine, i18n.language])

    const handleProgramChange = (programId) => {
        if (!programId) {
            onChange({
                ...context,
                program: '',
                trackedEntityType: '',
            })
            return
        }

        // 1. Immediately resolve trackedEntityType from already loaded programs list (instant, 0ms)
        const foundProgram = programs.find((p) => p.id === programId)
        const trackedEntityType =
            foundProgram?.trackedEntityType?.id ||
            metadataByProgram[programId]?.trackedEntityType ||
            ''

        // 2. Immediately notify parent context so the UI reflects selection instantly with zero lag
        onChange({
            ...context,
            program: programId,
            trackedEntityType,
        })

        // 3. Pre-load full program metadata in the background if not cached yet (non-blocking)
        if (!metadataByProgram[programId]) {
            fetchProgramMetadata({ engine, programId })
                .then((program) => {
                    const normalized = normalizeProgramMetadata(program)
                    setMetadataByProgram((prev) => ({ ...prev, [programId]: normalized }))
                    const currentCtx = contextRef.current
                    if (
                        currentCtx?.program === programId &&
                        !currentCtx?.trackedEntityType &&
                        normalized?.trackedEntityType
                    ) {
                        onChangeRef.current({
                            ...currentCtx,
                            trackedEntityType: normalized.trackedEntityType,
                        })
                    }
                })
                .catch((e) => {
                    console.warn('Program metadata background fetch warning:', e)
                })
        }
    }

    useEffect(() => {
        if (!context.program || metadataByProgram[context.program]) return undefined
        let cancelled = false
        const run = async () => {
            try {
                const program = await fetchProgramMetadata({ engine, programId: context.program })
                if (cancelled) return
                const normalized = normalizeProgramMetadata(program)
                setMetadataByProgram((prev) => ({ ...prev, [context.program]: normalized }))
                const currentCtx = contextRef.current
                if (
                    currentCtx?.program === context.program &&
                    !currentCtx?.trackedEntityType &&
                    normalized?.trackedEntityType
                ) {
                    onChangeRef.current({
                        ...currentCtx,
                        trackedEntityType: normalized.trackedEntityType,
                    })
                }
            } catch {
                /* ignore */
            }
        }
        run()
        return () => {
            cancelled = true
        }
    }, [i18n.language, context.program, engine, metadataByProgram])
    
    const availablePrograms = useMemo(
        () => programs.filter((program) => isProgramAvailableForOrgUnit(program, selectedOrg?.path)),
        [programs, selectedOrg]
    )

    useEffect(() => {
        if (loading || !programs.length) {
            return
        }
        // Read latest values via ref to avoid context object in deps (prevents loop)
        const ctx = contextRef.current
        if (!ctx.program) {
            return
        }
        const isStillValid = availablePrograms.some((program) => program.id === ctx.program)
        if (!isStillValid) {
            onChangeRef.current({
                ...ctx,
                program: '',
                trackedEntityType: '',
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [availablePrograms, loading, programs.length])

    const hasPeriodSelected = Boolean(
        context.period ||
        context.periodKeys?.length ||
        context.customPeriodRange
    )
    const actionsReady = !disabled && context.orgUnit && context.program
    const reportReady = actionsReady && hasPeriodSelected
    const iconBtnBase =
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors cursor-pointer'
    const iconBtnSecondary = cn(
        iconBtnBase,
        'border-[color:var(--app-border)] app-surface app-text-meta hover:bg-stone-50/80 hover:app-text-title disabled:cursor-not-allowed disabled:opacity-30',
        'dark:border-[color:var(--app-border)] dark:bg-[var(--app-input-bg)] dark:text-zinc-400 dark:shadow-none dark:hover:border-[color:var(--app-border-strong)] dark:hover:text-zinc-100'
    )
    const iconBtnPrimary = cn(
        iconBtnBase,
        'border-0 bg-[var(--app-header-bar-bg)] text-white shadow-none hover:bg-[var(--app-header-bar-bg-hover)] disabled:cursor-not-allowed disabled:opacity-40'
    )

    const adminIconBtnBase =
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[color:var(--app-border)] app-surface app-text-meta transition-colors hover:bg-stone-50/80 hover:app-text-title disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-zinc-800 cursor-pointer'
    const adminIconBtnPrimary = cn(
        adminIconBtnBase,
        'border-[var(--app-header-bar-bg)] bg-[var(--app-header-bar-bg)] text-white hover:border-[var(--app-header-bar-bg-hover)] hover:bg-[var(--app-header-bar-bg-hover)] hover:text-white disabled:opacity-40'
    )

    if (loading) {
        return (
            <div className="flex w-full items-center justify-between gap-1.5 min-h-[32px] animate-pulse">
                {/* Scrollable Selectors Skeleton on Left */}
                <div className="flex flex-1 min-w-0 items-center gap-1.5 overflow-hidden">
                    <div className="h-8 min-w-[130px] md:w-72 lg:w-72 shrink-0 md:shrink rounded-[var(--app-radius)] bg-slate-100 dark:bg-zinc-800/80 border border-slate-200/60 dark:border-zinc-800 flex items-center px-3">
                        <div className="h-3 w-20 rounded bg-slate-200/80 dark:bg-zinc-700/80" />
                    </div>

                    <div className="h-8 min-w-[130px] md:w-64 lg:w-64 shrink-0 md:shrink rounded-[var(--app-radius)] bg-slate-100 dark:bg-zinc-800/80 border border-slate-200/60 dark:border-zinc-800 flex items-center px-3">
                        <div className="h-3 w-20 rounded bg-slate-200/80 dark:bg-zinc-700/80" />
                    </div>

                    <div className="h-8 min-w-[125px] md:w-56 lg:w-60 shrink-0 md:shrink rounded-[var(--app-radius)] bg-slate-100 dark:bg-zinc-800/80 border border-slate-200/60 dark:border-zinc-800 flex items-center px-3">
                        <div className="h-3 w-16 rounded bg-slate-200/80 dark:bg-zinc-700/80" />
                    </div>
                </div>

                {/* Fixed Search / Actions Skeleton on Right */}
                <div className="flex shrink-0 items-center gap-1.5 pl-1">
                    {showSearch ? <div className="h-8 w-8 shrink-0 rounded-md bg-slate-100 dark:bg-zinc-800/80" /> : null}
                    {showRecordActions ? (
                        <div className="hidden md:flex items-center gap-1.5">
                            {showImportExport ? (
                                <>
                                    <div className="h-8 w-8 rounded-md bg-slate-100 dark:bg-zinc-800/80" />
                                    <div className="h-8 w-8 rounded-md bg-slate-100 dark:bg-zinc-800/80" />
                                </>
                            ) : null}
                            {showViewModeToggle ? <div className="h-8 w-8 rounded-md bg-slate-100 dark:bg-zinc-800/80" /> : null}
                            {showColumnConfig ? <div className="h-8 w-8 rounded-md bg-slate-100 dark:bg-zinc-800/80" /> : null}
                            {showRegister ? <div className="h-8 w-8 rounded-md bg-slate-100 dark:bg-zinc-800/80" /> : null}
                        </div>
                    ) : null}
                </div>
            </div>
        )
    }

    if (isAdminLayout) {
        return (
            <div className="flex w-full flex-wrap items-center gap-1.5 md:flex-nowrap md:justify-between">
                {/* Org Unit Selector */}
                <div className="w-[calc(50%-0.25rem)] md:w-auto md:shrink-0">
                    <OrgUnitSelect
                        id="org-unit-select-trigger"
                        orgUnits={orgUnits}
                        value={context.orgUnit}
                        onChange={(orgUnit) => onChange({ ...context, orgUnit })}
                        disabled={disabled}
                        emptyLabel={i18n.t('Org')}
                        buttonClassName={cn(
                            orgFilterButtonClass,
                            'h-8 w-full md:w-[9rem] shrink-0 text-xs font-semibold',
                            disabled ? 'cursor-not-allowed opacity-30 grayscale' : ''
                        )}
                    />
                </div>

                {/* Program Selector */}
                <div className="w-[calc(50%-0.25rem)] md:w-auto md:shrink-0">
                    <Select
                        id="program-select-trigger"
                        disabled={disabled}
                        value={context.program}
                        onValueChange={(value) => handleProgramChange(value)}
                        placeholder={i18n.t('Program')}
                        className={cn(
                            filterSelectClass,
                            'h-8 w-full min-w-0 md:w-[11rem] md:min-w-[8.5rem] shrink-0 text-xs font-semibold'
                        )}
                        options={availablePrograms.map((program) => ({
                            value: program.id,
                            label: program.displayName || program.name,
                        }))}
                    />
                </div>

                {/* Period Selector Modal */}
                <div className="shrink-0">
                    <PeriodSelectModal
                        value={selectedPeriodKeys}
                        onChange={(keys) => onChange({ ...context, periodKeys: keys, period: keys[0] || '' })}
                        customValue={context.customPeriodRange || null}
                        onCustomRange={(range) => onChange({ ...context, customPeriodRange: range, period: 'custom' })}
                        disabled={disabled || !context.program}
                        buttonClassName="h-8 w-8 px-0 justify-center md:w-[11rem] md:px-2.5 md:justify-between shrink-0"
                        allowedPeriodKinds={allowedPeriodKinds}
                        isEventView={(context?.viewMode || viewMode) === 'EVENTS'}
                        onToggleEventView={
                            onToggleViewMode ||
                            ((val) =>
                                onChange({
                                    ...context,
                                    viewMode:
                                        val !== undefined
                                            ? val
                                                ? 'EVENTS'
                                                : 'ENROLLMENTS'
                                            : (context?.viewMode || viewMode) === 'EVENTS'
                                              ? 'ENROLLMENTS'
                                              : 'EVENTS',
                                }))
                        }
                    />
                </div>

                {/* View Mode Toggle */}
                {showViewModeToggle ? (
                    <label
                        className={cn(
                            'flex h-8 items-center gap-1.5 rounded-[var(--app-radius)] border px-2.5 text-[12px] font-semibold cursor-pointer select-none transition-all shrink-0',
                            (context?.viewMode || viewMode) === 'EVENTS'
                                ? 'border-blue-500/80 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:border-blue-700 dark:text-blue-200 shadow-2xs'
                                : 'border-[color:var(--app-border)] bg-white text-slate-600 hover:bg-slate-50 dark:bg-black dark:text-zinc-400'
                        )}
                        title={i18n.t('Show all events with all enrollment attributes')}
                    >
                        <input
                            type="checkbox"
                            checked={(context?.viewMode || viewMode) === 'EVENTS'}
                            onChange={
                                onToggleViewMode ||
                                (() =>
                                    onChange({
                                        ...context,
                                        viewMode:
                                            (context?.viewMode || viewMode) === 'EVENTS'
                                                ? 'ENROLLMENTS'
                                                : 'EVENTS',
                                    }))
                            }
                            disabled={!actionsReady}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="whitespace-nowrap">{i18n.t('ព្រឹត្តិការណ៍ (Event)')}</span>
                    </label>
                ) : null}

                {/* Fixed Search Button & Action Buttons on Right */}
                {showRecordActions ? (
                    <div className="ml-auto flex shrink-0 items-center gap-1.5 md:ml-0 md:pl-1.5">
                        {showSearch && onSearchClick ? (
                            <button
                                type="button"
                                onClick={onSearchClick}
                                disabled={!actionsReady}
                                className={adminIconBtnPrimary}
                                title={i18n.t('Search')}
                            >
                                <MagnifyingGlassIcon className="h-4 w-4 shrink-0" aria-hidden />
                            </button>
                        ) : null}
                        {showAppointments && onAppointmentsClick ? (
                            <button
                                type="button"
                                onClick={onAppointmentsClick}
                                disabled={!actionsReady}
                                className={cn(
                                    adminIconBtnBase,
                                    'relative flex items-center justify-center'
                                )}
                                title={i18n.t('Appointments ({{today}} Today, {{missed}} Missed)', {
                                    today: todayAppointmentsCount,
                                    missed: missedAppointmentsCount,
                                })}
                            >
                                <Bell className="h-4 w-4 shrink-0" aria-hidden />
                                {todayAppointmentsCount > 0 || missedAppointmentsCount > 0 ? (
                                    <span
                                        className={cn(
                                            'absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-extrabold text-white shadow-2xs',
                                            missedAppointmentsCount > 0 ? 'bg-red-500' : 'bg-emerald-500'
                                        )}
                                    >
                                        {todayAppointmentsCount + missedAppointmentsCount > 99
                                            ? '99+'
                                            : todayAppointmentsCount + missedAppointmentsCount}
                                    </span>
                                ) : null}
                            </button>
                        ) : null}
                        {showMonthlyReport && onMonthlyReportClick ? (
                            <button
                                type="button"
                                onClick={onMonthlyReportClick}
                                disabled={!reportReady}
                                className={cn(
                                    adminIconBtnBase,
                                    'hidden md:flex items-center justify-center',
                                    reportReady && 'text-sky-600 dark:text-sky-400 font-medium'
                                )}
                                title={
                                    reportReady
                                        ? i18n.t('Monthly Report')
                                        : i18n.t('Select a period to view Monthly Report')
                                }
                            >
                                <FileSpreadsheet className="h-4 w-4 shrink-0" aria-hidden />
                            </button>
                        ) : null}
                        {showImportExport ? (
                            <div className="hidden md:flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={onImportClick}
                                    disabled={!actionsReady}
                                    className={adminIconBtnBase}
                                    title={i18n.t('Import records')}
                                >
                                    <UploadIcon className="h-4 w-4 shrink-0" aria-hidden />
                                </button>
                                <button
                                    type="button"
                                    onClick={onExportClick}
                                    disabled={!actionsReady}
                                    className={adminIconBtnBase}
                                    title={i18n.t('Export')}
                                >
                                    <DownloadIcon className="h-4 w-4 shrink-0" aria-hidden />
                                </button>
                            </div>
                        ) : null}
                        {showViewModeToggle ? (
                            <button
                                type="button"
                                onClick={onToggleViewMode}
                                disabled={!actionsReady}
                                className={cn(adminIconBtnBase, 'hidden md:flex')}
                                title={
                                    viewMode === 'ENROLLMENTS'
                                        ? i18n.t('Switch to Event View')
                                        : i18n.t('Switch to Personnel View')
                                }
                            >
                                {viewMode === 'ENROLLMENTS' ? (
                                    <ListBulletIcon className="h-4 w-4 shrink-0" aria-hidden />
                                ) : (
                                    <ComponentInstanceIcon className="h-4 w-4 shrink-0" aria-hidden />
                                )}
                            </button>
                        ) : null}
                        {showColumnConfig ? (
                            <button
                                type="button"
                                onClick={onConfigClick}
                                disabled={!actionsReady}
                                className={cn(adminIconBtnBase, 'hidden md:flex')}
                                title={i18n.t('Configure')}
                            >
                                <MixerHorizontalIcon className="h-4 w-4 shrink-0" aria-hidden />
                            </button>
                        ) : null}
                        {showRegister && onRegisterClick ? (
                            <>
                                {/* Desktop inline button */}
                                <button
                                    type="button"
                                    onClick={onRegisterClick}
                                    disabled={!actionsReady}
                                    className={cn(adminIconBtnPrimary, 'hidden md:flex')}
                                    title={i18n.t('Register')}
                                >
                                    <PlusIcon className="h-4 w-4 shrink-0" aria-hidden />
                                </button>

                                {/* Sticky Floating Action Button (FAB) on Mobile */}
                                {typeof document !== 'undefined'
                                    ? createPortal(
                                          <button
                                              type="button"
                                              onClick={onRegisterClick}
                                              disabled={!actionsReady}
                                              aria-label={i18n.t('Register')}
                                              title={i18n.t('Register')}
                                              className={cn(
                                                  'fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] right-3.5 z-[35] md:hidden',
                                                  'flex h-9 items-center justify-center gap-1.5 rounded-full px-3.5',
                                                  'bg-[var(--app-header-bar-bg)] text-white',
                                                  'shadow-lg shadow-black/15 border border-white/20',
                                                  'active:scale-95 transition-all duration-150 cursor-pointer pointer-events-auto select-none',
                                                  'disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none'
                                              )}
                                          >
                                              <PlusIcon className="h-4 w-4 shrink-0" strokeWidth={2} />
                                              <span className="text-[12px] font-semibold tracking-tight">{i18n.t('ចុះឈ្មោះ')}</span>
                                          </button>,
                                          document.body
                                      )
                                    : null}
                            </>
                        ) : null}
                    </div>
                ) : null}
                {error ? (
                    <span className="shrink-0 text-xs font-medium text-red-600">
                        {i18n.t('Load Error')}
                    </span>
                ) : null}
            </div>
        )
    }

    return (
        <div className="flex w-full flex-wrap items-center gap-1.5 md:flex-nowrap md:justify-between">
            {/* Site / Org Unit Selector */}
            <div className="w-[calc(50%-0.25rem)] md:w-auto md:min-w-[130px] md:flex-[1.2] shrink-0">
                <OrgUnitSelect
                    orgUnits={orgUnits}
                    value={context.orgUnit}
                    onChange={(orgUnit) => {
                        const match = orgUnits.find((o) => o.id === orgUnit)
                        onChange({
                            ...context,
                            orgUnit,
                            orgUnitName: match?.displayName || match?.name || '',
                        })
                    }}
                    disabled={disabled}
                    emptyLabel={i18n.t('Site')}
                    id="org-unit-select-trigger"
                    buttonClassName={cn(
                        'app-filter-control flex h-8 w-full items-center justify-between rounded-[var(--app-radius)] px-2.5 text-left text-xs font-semibold',
                        disabled
                            ? 'cursor-not-allowed opacity-30 grayscale'
                            : 'active:scale-[0.98]'
                    )}
                />
            </div>

            {/* Program Selector */}
            <div className="w-[calc(50%-0.25rem)] md:w-auto md:min-w-[130px] md:flex-1 shrink-0">
                <Select
                    id="program-select-trigger"
                    disabled={disabled}
                    value={context.program}
                    onValueChange={(value) => handleProgramChange(value)}
                    placeholder={i18n.t('Program')}
                    className="app-filter-control h-8 min-w-0 w-full rounded-[var(--app-radius)] px-2.5 text-xs font-semibold md:px-3"
                    options={availablePrograms.map((program) => ({
                        value: program.id,
                        label: program.displayName || program.name,
                    }))}
                />
            </div>

            {/* Period Selector */}
            <div className="shrink-0 md:min-w-[125px] md:flex-1">
                <PeriodSelectModal
                    value={selectedPeriodKeys}
                    onChange={(keys) => onChange({ ...context, periodKeys: keys, period: keys[0] || '' })}
                    customValue={context.customPeriodRange || null}
                    onCustomRange={(range) => onChange({ ...context, customPeriodRange: range, period: 'custom' })}
                    disabled={disabled || !context.program}
                    buttonClassName="h-8 px-2.5 text-xs font-semibold justify-center md:w-full"
                    allowedPeriodKinds={allowedPeriodKinds}
                    isEventView={(context?.viewMode || viewMode) === 'EVENTS'}
                    onToggleEventView={
                        onToggleViewMode ||
                        ((val) =>
                            onChange({
                                ...context,
                                viewMode:
                                    val !== undefined
                                        ? val
                                            ? 'EVENTS'
                                            : 'ENROLLMENTS'
                                        : (context?.viewMode || viewMode) === 'EVENTS'
                                          ? 'ENROLLMENTS'
                                          : 'EVENTS',
                            }))
                    }
                />
            </div>

            {/* Event View Checkbox Toggle */}
            {showViewModeToggle ? (
                <div className="shrink-0">
                    <label
                        className={cn(
                            'app-filter-control flex h-8 items-center gap-1.5 rounded-[var(--app-radius)] border px-2.5 text-[12px] font-semibold cursor-pointer select-none transition-all',
                            (context?.viewMode || viewMode) === 'EVENTS'
                                ? 'border-blue-500/80 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:border-blue-700 dark:text-blue-200 shadow-2xs'
                                : 'border-[color:var(--app-border)] bg-white text-slate-600 hover:bg-slate-50 dark:bg-black dark:text-zinc-400'
                        )}
                        title={i18n.t('Show all events with all enrollment attributes')}
                    >
                        <input
                            type="checkbox"
                            checked={(context?.viewMode || viewMode) === 'EVENTS'}
                            onChange={
                                onToggleViewMode ||
                                (() =>
                                    onChange({
                                        ...context,
                                        viewMode:
                                            (context?.viewMode || viewMode) === 'EVENTS'
                                                ? 'ENROLLMENTS'
                                                : 'EVENTS',
                                    }))
                            }
                            disabled={!actionsReady}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="whitespace-nowrap">{i18n.t('ព្រឹត្តិការណ៍ (Event)')}</span>
                    </label>
                </div>
            ) : null}

            {/* Right: Fixed Search Button & Action Controls (Never scrolls away) */}
            {showRecordActions ? (
                <div className="ml-auto flex shrink-0 items-center gap-1.5 md:ml-0 md:pl-1.5">
                    {/* Fixed Search Button */}
                    {showSearch && onSearchClick ? (
                        <button
                            type="button"
                            onClick={onSearchClick}
                            disabled={!actionsReady}
                            className={iconBtnPrimary}
                            title={i18n.t('Search')}
                        >
                            <MagnifyingGlassIcon className="h-4 w-4" />
                        </button>
                    ) : null}

                    {/* Appointments / Notification Button */}
                    {showAppointments && onAppointmentsClick ? (
                        <button
                            type="button"
                            onClick={onAppointmentsClick}
                            disabled={!actionsReady}
                            className={cn(
                                iconBtnSecondary,
                                'relative flex items-center justify-center'
                            )}
                            title={i18n.t('Appointments ({{today}} Today, {{missed}} Missed)', {
                                today: todayAppointmentsCount,
                                missed: missedAppointmentsCount,
                            })}
                        >
                            <Bell className="h-4 w-4" />
                            {todayAppointmentsCount > 0 || missedAppointmentsCount > 0 ? (
                                <span
                                    className={cn(
                                        'absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-extrabold text-white shadow-2xs',
                                        missedAppointmentsCount > 0 ? 'bg-red-500' : 'bg-emerald-500'
                                    )}
                                >
                                    {todayAppointmentsCount + missedAppointmentsCount > 99
                                        ? '99+'
                                        : todayAppointmentsCount + missedAppointmentsCount}
                                </span>
                            ) : null}
                        </button>
                    ) : null}

                    {/* Secondary Desktop Actions */}
                    <div className="hidden md:flex items-center gap-1.5">
                        <div className="h-8 w-px bg-slate-100 dark:bg-zinc-800" />
                        {showMonthlyReport && onMonthlyReportClick ? (
                            <button
                                type="button"
                                onClick={onMonthlyReportClick}
                                disabled={!reportReady}
                                className={cn(
                                    iconBtnSecondary,
                                    'flex items-center justify-center',
                                    reportReady && 'text-sky-600 dark:text-sky-400 font-medium'
                                )}
                                title={
                                    reportReady
                                        ? i18n.t('Monthly Report')
                                        : i18n.t('Select a period to view Monthly Report')
                                }
                            >
                                <FileSpreadsheet className="h-4 w-4" />
                            </button>
                        ) : null}
                        {showImportExport ? (
                            <>
                                <button
                                    type="button"
                                    onClick={onImportClick}
                                    disabled={!actionsReady}
                                    className={iconBtnSecondary}
                                    title={i18n.t('Import records')}
                                >
                                    <UploadIcon className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={onExportClick}
                                    disabled={!actionsReady}
                                    className={iconBtnSecondary}
                                    title={i18n.t('Export')}
                                >
                                    <DownloadIcon className="h-4 w-4" />
                                </button>
                            </>
                        ) : null}
                        {showViewModeToggle ? (
                            <button
                                type="button"
                                onClick={onToggleViewMode}
                                disabled={!actionsReady}
                                className={iconBtnSecondary}
                                title={
                                    viewMode === 'ENROLLMENTS'
                                        ? i18n.t('Switch to Event View')
                                        : i18n.t('Switch to Personnel View')
                                }
                            >
                                <ListBulletIcon className="h-4 w-4" />
                            </button>
                        ) : null}
                        {showColumnConfig ? (
                            <button
                                type="button"
                                onClick={onConfigClick}
                                disabled={!actionsReady}
                                className={iconBtnSecondary}
                                title={i18n.t('Configure')}
                            >
                                <MixerHorizontalIcon className="h-4 w-4" />
                            </button>
                        ) : null}
                        {showRegister && onRegisterClick ? (
                            <button
                                type="button"
                                onClick={onRegisterClick}
                                disabled={!actionsReady}
                                className={cn(iconBtnPrimary, 'ml-0.5')}
                                title={i18n.t('Register')}
                            >
                                <PlusIcon className="h-4 w-4" />
                            </button>
                        ) : null}
                    </div>

                    {/* Sticky Floating Action Button (FAB) on Mobile */}
                    {showRegister && onRegisterClick && typeof document !== 'undefined'
                        ? createPortal(
                              <button
                                  type="button"
                                  onClick={onRegisterClick}
                                  disabled={!actionsReady}
                                  aria-label={i18n.t('Register')}
                                  title={i18n.t('Register')}
                                  className={cn(
                                      'fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] right-3.5 z-[35] md:hidden',
                                      'flex h-9 items-center justify-center gap-1.5 rounded-full px-3.5',
                                      'bg-[var(--app-header-bar-bg)] text-white',
                                      'shadow-lg shadow-black/15 border border-white/20',
                                      'active:scale-95 transition-all duration-150 cursor-pointer pointer-events-auto select-none',
                                      'disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none'
                                  )}
                              >
                                  <PlusIcon className="h-4 w-4 shrink-0" strokeWidth={2} />
                                  <span className="text-[12px] font-semibold tracking-tight">{i18n.t('ចុះឈ្មោះ')}</span>
                              </button>,
                              document.body
                          )
                        : null}
                </div>
            ) : null}

            {error && (
                <div className="flex items-center gap-2 text-red-500 bg-red-50/50 px-2 py-1 rounded-lg border border-red-100 backdrop-blur-sm self-center">
                    <span className="label-uppercase text-red-400">{i18n.t('Load Error')}</span>
                </div>
            )}
        </div>
    )
}
