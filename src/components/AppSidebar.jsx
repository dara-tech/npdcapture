import React from 'react'
import i18n from '@dhis2/d2-i18n'
import {
    FileSpreadsheet,
    LayoutDashboard,
    LineChart,
    PanelLeftClose,
    PanelLeftOpen,
    Table,
    Trash2,
    Users,
} from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { useI18nLanguage } from '../hooks/useI18nLanguage'
import { cn } from '../lib/utils'

const ALL_NAV_ITEMS = [
    {
        id: 'records',
        labelKey: 'Records',
        Icon: Table,
        requires: () => true,
    },
    {
        id: 'dashboard',
        labelKey: 'Dashboard',
        shortLabelKey: 'Dashboard',
        Icon: LayoutDashboard,
        requires: () => true,
    },
    {
        id: 'monthly-report',
        labelKey: 'Monthly Report',
        shortLabelKey: 'Monthly Report',
        Icon: FileSpreadsheet,
        requires: () => true,
    },
    {
        id: 'trash',
        labelKey: 'Trash',
        shortLabelKey: 'Trash',
        Icon: Trash2,
        requires: () => true,
    },
    {
        id: 'indicators',
        labelKey: 'Indicator management',
        shortLabelKey: 'Indicators',
        Icon: LineChart,
        requires: ({ isIndicatorAdmin }) => isIndicatorAdmin,
    },
    {
        id: 'users',
        labelKey: 'User Management',
        shortLabelKey: 'User',
        Icon: Users,
        requires: ({ isUserAdmin }) => isUserAdmin,
    },
]

const NavItem = ({ labelKey, shortLabelKey, Icon, active, collapsed, onClick, layout }) => {
    const label = i18n.t(shortLabelKey || labelKey)
    const title = i18n.t(labelKey)

    if (layout === 'mobile') {
        return (
            <button
                type="button"
                onClick={onClick}
                aria-current={active ? 'page' : undefined}
                className={cn(
                    'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 px-1 pt-2 pb-1 transition-all duration-150',
                    active ? 'text-[var(--app-header-bar-bg)]' : 'text-slate-400 active:text-slate-600 dark:text-zinc-500 dark:active:text-zinc-300'
                )}
            >
                <span
                    className={cn(
                        'flex h-7 w-14 items-center justify-center rounded-full transition-all duration-200',
                        active ? 'bg-[var(--app-header-bar-bg)]/12 dark:bg-[var(--app-header-bar-bg)]/20' : 'bg-transparent'
                    )}
                >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.25 : 2} aria-hidden />
                </span>
                <span className="max-w-full truncate text-[10px] font-semibold leading-none tracking-tight">
                    {label}
                </span>
            </button>
        )
    }

    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            aria-current={active ? 'page' : undefined}
            className={cn(
                'group flex w-full items-center rounded-lg transition-colors',
                collapsed ? 'justify-center p-1.5' : 'gap-2 px-1.5 py-1',
                active ? 'text-app-primary' : 'text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            )}
        >
            <span
                className={cn(
                    'flex shrink-0 items-center justify-center rounded-lg transition-colors',
                    collapsed ? 'h-8 w-8' : 'h-7 w-7',
                    active
                        ? 'bg-app-tint-10'
                        : 'group-hover:bg-slate-100/90 dark:group-hover:bg-zinc-900'
                )}
            >
                <Icon className="h-4 w-4" strokeWidth={active ? 2.25 : 2} aria-hidden />
            </span>
            {!collapsed && (
                <span className="truncate text-[13px] font-medium">{label}</span>
            )}
        </button>
    )
}

/** Admin sidebar for capture management sections (records, programs, indicators, users). */
export const AppSidebar = ({
    collapsed,
    onToggleCollapsed,
    activeSection,
    onSectionChange,
    isSuperuser = false,
    isUserAdmin = false,
    isIndicatorAdmin = false,
}) => {
    useI18nLanguage()

    const navItems = ALL_NAV_ITEMS.filter((item) =>
        item.requires({ isSuperuser, isUserAdmin, isIndicatorAdmin })
    )

    if (!navItems.length) return null

    const renderNav = (layout) =>
        navItems.map(({ id, labelKey, shortLabelKey, Icon }) => (
            <NavItem
                key={`${layout}-${id}`}
                labelKey={labelKey}
                shortLabelKey={shortLabelKey}
                Icon={Icon}
                active={activeSection === id}
                collapsed={layout === 'desktop' ? collapsed : false}
                layout={layout}
                onClick={() => onSectionChange(id)}
            />
        ))

    return (
        <>
            <aside
                className={cn(
                    'hidden shrink-0 flex-col self-stretch rounded-[var(--app-radius)] border border-[color:var(--app-border)] app-surface transition-[width] duration-200 ease-out md:flex',
                    collapsed ? 'w-11 p-1' : 'w-40 p-1.5'
                )}
            >
                <nav className="flex flex-1 flex-col gap-1" aria-label={i18n.t('Admin')}>
                    {renderNav('desktop')}
                </nav>

                <div className="mt-auto flex flex-col gap-1.5">
                    <div className="border-t border-slate-200/50 pt-2 dark:border-[color:var(--app-border)]">
                        <ThemeToggle collapsed={collapsed} layout="desktop" />
                    </div>

                    <div className="border-t border-slate-200/50 pt-2 dark:border-[color:var(--app-border)]">
                        <button
                            type="button"
                            onClick={onToggleCollapsed}
                            className={cn(
                                'flex h-8 w-full items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100/90 hover:text-slate-700 dark:hover:bg-zinc-900 dark:hover:text-zinc-200',
                                !collapsed && 'justify-start gap-1.5 px-1.5'
                            )}
                            title={collapsed ? i18n.t('Expand') : i18n.t('Collapse')}
                            aria-label={collapsed ? i18n.t('Expand') : i18n.t('Collapse')}
                        >
                            {collapsed ? (
                                <PanelLeftOpen className="h-4 w-4" strokeWidth={2} />
                            ) : (
                                <>
                                    <PanelLeftClose className="h-4 w-4 shrink-0" strokeWidth={2} />
                                    <span className="truncate text-xs font-medium text-slate-500">
                                        {i18n.t('Collapse')}
                                    </span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </aside>

            <nav
                className="fixed inset-x-0 bottom-0 z-50 flex border-t border-slate-200/60 bg-white/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] dark:border-zinc-800/60 dark:bg-zinc-950/95 md:hidden"
                style={{ boxShadow: '0 -1px 0 0 rgba(0,0,0,0.05), 0 -4px 16px rgba(0,0,0,0.04)' }}
                aria-label={i18n.t('Admin')}
            >
                {renderNav('mobile')}
            </nav>
        </>
    )
}
