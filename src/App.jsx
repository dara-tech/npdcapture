import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import i18n from '@dhis2/d2-i18n'
import { useDataEngine } from '@dhis2/app-runtime'
import { RecordsToolbar } from './features/records/RecordsToolbar'
import { TeiSearchPanel } from './features/tei-search/TeiSearchPanel'
import { Spinner } from './components/ui/spinner'
import './locales/index.js'
import './index.css'
import { ComponentInstanceIcon } from '@radix-ui/react-icons'
import { ClipboardList } from 'lucide-react'
import { EmptyWelcomeState } from './components/EmptyWelcomeState'
import { I18nLocaleSync } from './components/I18nLocaleSync'
import { AppSidebar } from './components/AppSidebar'
import { useCaptureAdmin } from './hooks/useCaptureAdmin'
import { useI18nLanguage } from './hooks/useI18nLanguage'
import { useAppointments } from './hooks/useAppointments'
import { cn } from './lib/utils'
import { initTheme } from './lib/theme'
import { ThemeProvider } from './components/ThemeProvider'
import { NavbarLanguageToggle } from './components/NavbarLanguageToggle'
initTheme()

const ProfileDetail = lazy(() =>
    import('./features/profile/ProfileDetail').then((module) => ({
        default: module.ProfileDetail,
    }))
)

const RegistrationPanel = lazy(() =>
    import('./features/profile/RegistrationPanel').then((module) => ({
        default: module.RegistrationPanel,
    }))
)

import { RegistrationDateModal } from './components/RegistrationDateModal'

const AppointmentsModal = lazy(() =>
    import('./components/AppointmentsModal').then((module) => ({
        default: module.AppointmentsModal,
    }))
)

const UserManagementPage = lazy(() =>
    import('./features/admin/UserManagementPage').then((module) => ({
        default: module.UserManagementPage,
    }))
)

const TrashPage = lazy(() =>
    import('./features/trash/TrashPage').then((module) => ({
        default: module.TrashPage,
    }))
)

const RegistrationDashboard = lazy(() =>
    import('./features/dashboard/RegistrationDashboard').then((module) => ({
        default: module.RegistrationDashboard,
    }))
)

const MonthlyReportPage = lazy(() =>
    import('./features/monthly-report/MonthlyReportPage').then((module) => ({
        default: module.MonthlyReportPage,
    }))
)

const MonthlyReportModal = lazy(() =>
    import('./features/monthly-report/components/MonthlyReportModal').then((module) => ({
        default: module.MonthlyReportModal,
    }))
)

const ProfileDetailFallback = () => (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-slate-50/50 dark:bg-black">
        <Spinner />
        <span className="mt-4 animate-pulse text-sm font-normal app-text-meta">
            {i18n.t('Fetching Patient Profile...')}
        </span>
    </div>
)

const App = () => {
    const language = useI18nLanguage()
    const engine = useDataEngine()

    const {
        isSuperuser,
        isUserAdmin,
        canEditUsers,
        showAdminNavigation: canShowAdminNavigation,
        isDataEntryExperience,
        loading: adminAuthLoading,
    } = useCaptureAdmin()
    const [appSection, setAppSection] = useState('records')
    const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
    const [context, setContext] = useState({
        orgUnit: '',
        program: '',
        trackedEntityType: '',
    })
    const [selectedTei, setSelectedTei] = useState(null)
    const [detailTei, setDetailTei] = useState(null)
    const [registrationMode, setRegistrationMode] = useState(false)
    const [isRegistrationDateModalOpen, setIsRegistrationDateModalOpen] = useState(false)
    const [registrationDate, setRegistrationDate] = useState('')
    const [lastUpdatedTeiId, setLastUpdatedTeiId] = useState(null)
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
    const [isAppointmentsModalOpen, setIsAppointmentsModalOpen] = useState(false)
    const [showDownloadModal, setShowDownloadModal] = useState(false)
    const [showImportModal, setShowImportModal] = useState(false)
    const [showColumnsModal, setShowColumnsModal] = useState(false)
    const [isMonthlyReportModalOpen, setIsMonthlyReportModalOpen] = useState(false)
    const [viewMode, setViewMode] = useState('ENROLLMENTS')

    useEffect(() => {
        if (context?.viewMode && context.viewMode !== viewMode) {
            setViewMode(context.viewMode)
        }
    }, [context?.viewMode, viewMode])

    const handleOpenRegister = () => {
        setIsRegistrationDateModalOpen(true)
    }

    const handleConfirmRegistrationDate = (date) => {
        setRegistrationDate(date)
        setIsRegistrationDateModalOpen(false)
        setRegistrationMode(true)
    }

    const {
        todayAppointments,
        missedAppointments,
        todayCount: todayAppointmentsCount,
        missedCount: missedAppointmentsCount,
    } = useAppointments({ engine, context })

    const handleUpdateSuccess = (id, options = {}) => {
        setLastUpdatedTeiId(id)
        setRegistrationMode(false)
        if (options.tei) {
            setDetailTei(options.tei)
        } else if (!options.keepDetail) {
            setDetailTei(null)
        }
        setTimeout(() => setLastUpdatedTeiId(null), 10000)
    }

    const handleRegisterSuccess = (id, options = {}) => {
        setLastUpdatedTeiId(id)
        setRegistrationMode(false)
        if (id) {
            setDetailTei({
                trackedEntity: id,
                goToFirstStage: true,
                registrationDate: options.registrationDate || registrationDate,
            })
        } else {
            setDetailTei(null)
        }
        setTimeout(() => setLastUpdatedTeiId(null), 10000)
    }

    const handleTeiDeleted = (id) => {
        setLastUpdatedTeiId(id)
        setSelectedTei(null)
        setDetailTei(null)
        setTimeout(() => setLastUpdatedTeiId(null), 10000)
    }

    const canSearch = useMemo(
        () => Boolean(context.orgUnit && context.program && context.trackedEntityType),
        [context]
    )

    const showSidebar = canShowAdminNavigation && !adminAuthLoading
    const canOpenUsers = isUserAdmin

    const handleAppSectionChange = (section) => {
        if (section === 'users' && !canOpenUsers) return
        if (section === 'trash') {
            setAppSection('trash')
            setDetailTei(null)
            setRegistrationMode(false)
            setSelectedTei(null)
            return
        }
        setAppSection(section)
        if (section === 'users' || section === 'trash' || section === 'dashboard' || section === 'monthly-report') {
            setDetailTei(null)
            setRegistrationMode(false)
            setSelectedTei(null)
        }
    }

    useEffect(() => {
        if (!showSidebar) {
            if (appSection === 'users') {
                setAppSection('records')
            }
            return
        }
        if (appSection === 'users' && !canOpenUsers) {
            setAppSection('records')
        }
    }, [showSidebar, appSection, canOpenUsers, isUserAdmin])

    return (
        <ThemeProvider>
        <I18nLocaleSync>
        <NavbarLanguageToggle />
        <main
            className="flex h-[calc(100vh-48px)] flex-col overflow-hidden app-page-bg md:app-page-bg bg-white dark:bg-black"
            data-ui-locale={language}
        >

            <div
                className={cn(
                    'flex min-h-0 min-w-0 flex-1 overflow-hidden',
                    showSidebar ? 'gap-1.5 p-1.5 md:gap-2 md:p-2' : 'p-0 sm:p-1 md:p-2.5'
                )}
            >
                {showSidebar ? (
                    <AppSidebar
                        collapsed={sidebarCollapsed}
                        onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
                        activeSection={appSection}
                        onSectionChange={handleAppSectionChange}
                        isSuperuser={isSuperuser}
                        isUserAdmin={isUserAdmin}
                    />
                ) : null}

                <div
                    className={cn(
                        'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
                        showSidebar &&
                            'pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0'
                    )}
                >

                    <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col overflow-hidden">
                        {appSection === 'trash' ? (
                            <Suspense fallback={<ProfileDetailFallback />}>
                                <TrashPage
                                    context={context}
                                    setContext={setContext}
                                    onBack={
                                        showSidebar
                                            ? undefined
                                            : () => setAppSection('records')
                                    }
                                />
                            </Suspense>
                        ) : appSection === 'dashboard' ? (
                            <Suspense fallback={<ProfileDetailFallback />}>
                                <RegistrationDashboard
                                    context={context}
                                    setContext={setContext}
                                />
                            </Suspense>
                        ) : appSection === 'monthly-report' ? (
                            <Suspense fallback={<ProfileDetailFallback />}>
                                <MonthlyReportPage
                                    context={context}
                                    setContext={setContext}
                                    viewMode={viewMode}
                                    onSelectTei={(tei) => {
                                        setAppSection('records')
                                        setDetailTei(tei)
                                    }}
                                />
                            </Suspense>
                        ) : appSection === 'users' && isUserAdmin ? (
                            <Suspense fallback={<ProfileDetailFallback />}>
                                <UserManagementPage canEdit={canEditUsers} />
                            </Suspense>
                        ) : (
                            <section className="flex min-h-0 flex-1 flex-col overflow-hidden gap-0 md:gap-1.5">
                                {!detailTei && !registrationMode ? (
                                    <div className="shrink-0">
                                        <RecordsToolbar
                                            context={context}
                                            dataEntryMode={isDataEntryExperience}
                                            onChange={(next) => {
                                                setContext(next)
                                                setSelectedTei(null)
                                                setDetailTei(null)
                                            }}
                                            onSearchClick={() => setIsSearchModalOpen(true)}
                                            onAppointmentsClick={() => setIsAppointmentsModalOpen(true)}
                                            todayAppointmentsCount={todayAppointmentsCount}
                                            missedAppointmentsCount={missedAppointmentsCount}
                                            onMonthlyReportClick={() => setIsMonthlyReportModalOpen(true)}
                                            onImportClick={() => setShowImportModal(true)}
                                            onExportClick={() => setShowDownloadModal(true)}
                                            onConfigClick={() => setShowColumnsModal(true)}
                                            onRegisterClick={handleOpenRegister}
                                            onTrashClick={
                                                showSidebar
                                                    ? () => handleAppSectionChange('trash')
                                                    : undefined
                                            }
                                            viewMode={viewMode}
                                            onToggleViewMode={() =>
                                                setViewMode((v) =>
                                                    v === 'ENROLLMENTS' ? 'EVENTS' : 'ENROLLMENTS'
                                                )
                                            }
                                        />
                                    </div>
                                ) : null}

                                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                                {!canSearch ? (
                                    <EmptyWelcomeState context={context} mode="capture" />
                                ) : registrationMode ? (
                                    <Suspense fallback={<ProfileDetailFallback />}>
                                        <RegistrationPanel
                                            context={context}
                                            registrationDate={registrationDate}
                                            onBack={() => setRegistrationMode(false)}
                                            onRegisterSuccess={handleRegisterSuccess}
                                        />
                                    </Suspense>
                                ) : detailTei ? (
                                    <Suspense fallback={<ProfileDetailFallback />}>
                                        <ProfileDetail
                                            context={context}
                                            tei={detailTei}
                                            onBack={() => setDetailTei(null)}
                                            onUpdateSuccess={handleUpdateSuccess}
                                            onTeiDeleted={handleTeiDeleted}
                                        />
                                    </Suspense>
                                ) : (
                                    <TeiSearchPanel
                                        context={context}
                                        selectedTei={selectedTei}
                                        lastUpdatedTeiId={lastUpdatedTeiId}
                                        onSelectTei={setSelectedTei}
                                        onOpenDetail={setDetailTei}
                                        onRegisterNew={handleOpenRegister}
                                        isSearchModalOpen={isSearchModalOpen}
                                        onCloseSearchModal={() => setIsSearchModalOpen(false)}
                                        showDownloadModal={showDownloadModal}
                                        setShowDownloadModal={setShowDownloadModal}
                                        showImportModal={showImportModal}
                                        setShowImportModal={setShowImportModal}
                                        onImportSuccess={handleUpdateSuccess}
                                        showColumnsModal={showColumnsModal}
                                        setShowColumnsModal={setShowColumnsModal}
                                        viewMode={viewMode}
                                        onToggleViewMode={() =>
                                            setViewMode((v) =>
                                                v === 'ENROLLMENTS' ? 'EVENTS' : 'ENROLLMENTS'
                                            )
                                        }
                                        isSuperuser={isSuperuser}
                                    />
                                )}
                                </div>
                            </section>
                        )}
                    </div>
                </div>
            </div>

            {isAppointmentsModalOpen && (
                <Suspense fallback={null}>
                    <AppointmentsModal
                        open={isAppointmentsModalOpen}
                        onClose={() => setIsAppointmentsModalOpen(false)}
                        todayAppointments={todayAppointments}
                        missedAppointments={missedAppointments}
                        onOpenDetail={(targetTei) => {
                            setIsAppointmentsModalOpen(false)
                            setDetailTei(targetTei)
                        }}
                    />
                </Suspense>
            )}

            <RegistrationDateModal
                open={isRegistrationDateModalOpen}
                onClose={() => setIsRegistrationDateModalOpen(false)}
                onConfirm={handleConfirmRegistrationDate}
                initialDate={registrationDate}
            />

            {isMonthlyReportModalOpen && (
                <Suspense fallback={null}>
                    <MonthlyReportModal
                        open={isMonthlyReportModalOpen}
                        isOpen={isMonthlyReportModalOpen}
                        onClose={() => setIsMonthlyReportModalOpen(false)}
                        context={context}
                        setContext={setContext}
                        viewMode={viewMode}
                        onSelectTei={(tei) => {
                            setIsMonthlyReportModalOpen(false)
                            setAppSection('records')
                            setDetailTei(tei)
                        }}
                    />
                </Suspense>
            )}
        </main>
        </I18nLocaleSync>
        </ThemeProvider>
    )
}

export default App
