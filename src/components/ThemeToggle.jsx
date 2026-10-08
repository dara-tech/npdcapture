import React from 'react'
import i18n from '@dhis2/d2-i18n'
import { Moon, Sun } from 'lucide-react'
import { cn } from '../lib/utils'
import { useTheme } from './ThemeProvider'

/** Single light/dark toggle — use in AppSidebar only. */
export const ThemeToggle = ({ collapsed = false, layout = 'desktop', className }) => {
    const { resolved, toggleTheme } = useTheme()
    const isDark = resolved === 'dark'
    const Icon = isDark ? Moon : Sun
    const label = isDark ? i18n.t('Dark mode') : i18n.t('Light mode')

    if (layout === 'mobile') {
        return (
            <button
                type="button"
                onClick={toggleTheme}
                className={cn(
                    'flex min-h-[52px] w-[4.25rem] shrink-0 flex-col items-center justify-center gap-1 border-l border-slate-200/80 px-1 py-2 text-slate-400 transition-colors active:text-slate-600 dark:border-zinc-800 dark:text-zinc-500 dark:active:text-zinc-200',
                    className
                )}
                title={isDark ? i18n.t('Switch to light mode') : i18n.t('Switch to dark mode')}
                aria-label={isDark ? i18n.t('Switch to light mode') : i18n.t('Switch to dark mode')}
            >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-transparent">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                </span>
                <span className="max-w-full truncate text-[10px] font-medium leading-none">
                    {isDark ? i18n.t('Dark') : i18n.t('Light')}
                </span>
            </button>
        )
    }

    return (
        <button
            type="button"
            onClick={toggleTheme}
            title={isDark ? i18n.t('Switch to light mode') : i18n.t('Switch to dark mode')}
            aria-label={isDark ? i18n.t('Switch to light mode') : i18n.t('Switch to dark mode')}
            className={cn(
                'group flex w-full items-center rounded-lg text-slate-500 transition-colors hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100',
                collapsed ? 'justify-center p-1.5' : 'gap-2 px-1.5 py-1',
                className
            )}
        >
            <span
                className={cn(
                    'flex shrink-0 items-center justify-center rounded-lg transition-colors group-hover:bg-slate-100/90 dark:group-hover:bg-zinc-800',
                    collapsed ? 'h-8 w-8' : 'h-7 w-7'
                )}
            >
                <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
            </span>
            {!collapsed && (
                <span className="truncate text-[13px] font-medium">{label}</span>
            )}
        </button>
    )
}
