import React from 'react'
import i18n from '@dhis2/d2-i18n'
import { useAppLocale } from '../hooks/useAppLocale'
import { cn } from '../lib/utils'
import khEnIcon from '../assets/Kh_En_icon.png'
import enKhIcon from '../assets/En_Kh_icon.png'

export const SidebarLocaleSwitcher = ({ collapsed = false, layout = 'desktop' }) => {
    const { currentCode, current, setLocale, saving } = useAppLocale()
    const isKm = currentCode === 'km'

    const handleToggle = async () => {
        if (saving) return
        const nextLang = isKm ? 'en' : 'km'
        await setLocale(nextLang)
    }

    const title = isKm
        ? 'ប្តូរទៅភាសាអង់គ្លេស / Switch to English'
        : 'Switch to Khmer / ប្តូរទៅភាសាខ្មែរ'

    const triggerLabel = current.nativeLabel
    const shortCode = currentCode.toUpperCase()

    const triggerClassName =
        layout === 'mobile'
            ? 'flex min-h-[52px] w-[4.25rem] shrink-0 flex-col items-center justify-center gap-1 border-l border-slate-200/80 dark:border-[color:var(--app-border)] px-1 py-2 text-slate-400 transition-colors active:text-slate-600'
            : cn(
                  'group flex w-full items-center rounded-lg text-slate-500 transition-colors hover:text-slate-800 dark:hover:text-zinc-200',
                  collapsed ? 'justify-center p-1.5' : 'gap-2 px-1.5 py-1'
              )

    return (
        <button
            type="button"
            onClick={handleToggle}
            className={triggerClassName}
            title={title}
            aria-label={title}
            disabled={saving}
        >
            <span
                className={cn(
                    'flex shrink-0 items-center justify-center rounded-lg transition-colors',
                    layout === 'mobile' ? 'h-8 w-8' : collapsed ? 'h-8 w-8' : 'h-7 w-7',
                    layout === 'mobile'
                        ? 'bg-transparent'
                        : 'group-hover:bg-slate-100/90 dark:group-hover:bg-zinc-900'
                )}
            >
                <img
                    src={isKm ? khEnIcon : enKhIcon}
                    alt={title}
                    className={cn(
                        'object-contain drop-shadow-2xs select-none transition-transform duration-200 group-hover:scale-110 active:scale-95',
                        layout === 'mobile'
                            ? 'h-[20px] w-auto max-h-[20px]'
                            : 'h-[18px] w-auto max-h-[18px]'
                    )}
                    draggable="false"
                />
            </span>
            {layout === 'mobile' ? (
                <span className="max-w-full truncate text-[10px] font-medium leading-none">
                    {shortCode}
                </span>
            ) : !collapsed ? (
                <span className="truncate text-[13px] font-medium">{triggerLabel}</span>
            ) : null}
        </button>
    )
}
