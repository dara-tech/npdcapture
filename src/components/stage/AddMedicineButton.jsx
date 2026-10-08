import React from 'react'
import i18n from '@dhis2/d2-i18n'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '../ui/button'
import { FORM } from '../../lib/formUi'
import { cn } from '../../lib/utils'

/**
 * Footer row for the medicine section — add-slot control aligned right.
 */
export function AddMedicineButtonFooter({ children, className, paperFormMode = false }) {
    return (
        <div
            className={cn(
                paperFormMode ? FORM.paperMedicineAddFooter : FORM.medicineAddFooter,
                className
            )}
        >
            {children}
        </div>
    )
}

/**
 * Translated control to unlock the next medicine column (STI treatment section).
 */
export function ShowAllMedicineButton({
    current,
    max,
    onClick,
    disabled = false,
    className,
    paperFormMode = false,
}) {
    if (current >= max) return null
    const label = i18n.t('Show all medicines')

    if (paperFormMode) {
        return (
            <button
                type="button"
                disabled={disabled}
                onClick={onClick}
                className={cn('paper-medicine-action-link', className)}
                aria-label={label}
            >
                {label}
            </button>
        )
    }

    return (
        <Button
            type="button"
            variant="default"
            size="sm"
            disabled={disabled}
            onClick={onClick}
            className={cn('h-auto min-h-9 px-3.5 py-1.5 text-xs font-bold bg-[var(--app-header-bar-bg)] text-white hover:opacity-90 shadow-sm', className)}
            aria-label={label}
        >
            {label}
        </Button>
    )
}

export function RemoveMedicineButton({
    slotIndex,
    onClick,
    disabled = false,
    className,
    paperFormMode = false,
}) {
    const label = i18n.t('Remove medicine {{index}}', { index: slotIndex })

    if (paperFormMode) {
        return (
            <button
                type="button"
                disabled={disabled}
                onClick={onClick}
                className={cn('paper-medicine-action-link paper-medicine-action-link--remove', className)}
                aria-label={label}
            >
                {i18n.t('Remove')}
            </button>
        )
    }

    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={onClick}
            className={cn(
                'h-auto min-h-9 gap-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 hover:text-rose-800',
                className
            )}
            aria-label={label}
        >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700">
                <Trash2 className="h-4 w-4" strokeWidth={2.25} aria-hidden />
            </span>
            <span>{i18n.t('Remove')}</span>
        </Button>
    )
}

export function AddMedicineButton({
    current,
    max,
    onClick,
    disabled = false,
    className,
    paperFormMode = false,
}) {
    const label = i18n.t('Add another medicine')
    const countLabel = i18n.t('{{current}} of {{max}}', { current, max })

    if (paperFormMode) {
        return (
            <button
                type="button"
                disabled={disabled}
                onClick={onClick}
                className={cn('paper-medicine-add-link', className)}
                aria-label={i18n.t('Add another medicine ({{current}} of {{max}})', { current, max })}
            >
                <span className="paper-medicine-add-link-label">{label}</span>
                <span className="paper-medicine-add-link-meta">{countLabel}</span>
            </button>
        )
    }

    return (
        <Button
            type="button"
            variant="default"
            size="sm"
            disabled={disabled}
            onClick={onClick}
            className={cn('h-auto min-h-9 gap-2.5 px-3.5 py-1.5 bg-[var(--app-header-bar-bg)] text-white hover:opacity-90 shadow-sm', className)}
            aria-label={i18n.t('Add another medicine ({{current}} of {{max}})', { current, max })}
        >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-white" aria-hidden>
                <Plus className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            <span className="flex min-w-0 flex-col items-start text-left leading-snug">
                <span className="text-xs font-bold text-white">{label}</span>
                <span className="text-[11px] font-medium text-white/80">{countLabel}</span>
            </span>
        </Button>
    )
}
