import React from 'react'
import { CheckIcon } from '@radix-ui/react-icons'
import i18n from '@dhis2/d2-i18n'
import { Button } from '../../../components/ui/button'
import { MODAL } from '../../../lib/overlayUi'
import { cn } from '../../../lib/utils'
import { isImportOptionalToggleAttribute } from '../lib/importProfileAttributes'

const ToggleRow = ({ id, label, checked, onToggle, hint }) => (
    <div className={MODAL.listRow}>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <div className="min-w-0">
                <span
                    className={cn(
                        'block truncate text-[12px] font-semibold tracking-tight',
                        checked ? 'text-slate-900' : 'text-slate-600'
                    )}
                >
                    {label}
                </span>
                {hint ? (
                    <span className="mt-0.5 block text-[10px] font-medium text-slate-500">{hint}</span>
                ) : null}
            </div>
            <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                aria-label={label}
                onClick={() => onToggle(id)}
                className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border-2 transition-all',
                    checked
                        ? 'border-[var(--app-header-bar-bg)] bg-[var(--app-header-bar-bg)] ring-4 ring-[rgba(44,102,147,0.15)]'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-zinc-700 dark:bg-zinc-900'
                )}
            >
                {checked ? <CheckIcon className="h-3.5 w-3.5 text-white" /> : null}
            </button>
        </div>
    </div>
)

export const ImportTemplateFieldsPicker = ({
    programAttributes = [],
    stageColumns = [],
    selectedAttributeIds = [],
    selectedDataElementIds = [],
    onToggleAttribute,
    onToggleDataElement,
    onSelectAllAttributes,
    onClearAttributes,
    onSelectAllDataElements,
    onClearDataElements,
    showProfile = true,
    showStageFields = false,
    disabled = false,
}) => {
    const attrCount = selectedAttributeIds.length
    const deCount = selectedDataElementIds.length

    return (
        <div className="rounded-lg border border-slate-200/90 bg-white dark:border-[color:var(--app-border)] dark:bg-zinc-950/40">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 dark:border-[color:var(--app-border)]">
                <p className="text-xs font-semibold app-text-title">
                    {i18n.t('Template columns')}
                </p>
                <p className="text-[11px] app-text-meta">
                    {showStageFields
                        ? i18n.t('{{profile}} profile · {{stage}} visit', {
                              profile: attrCount,
                              stage: deCount,
                          })
                        : i18n.t('{{count}} selected', { count: attrCount })}
                </p>
            </div>

            <div className={cn(MODAL.scrollList, 'max-h-[220px]')}>
                {showProfile && programAttributes.length > 0 ? (
                    <>
                        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-slate-50/95 px-3 py-1.5 dark:bg-zinc-900/95">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--app-header-bar-bg)]">
                                {i18n.t('Profile attributes')}
                            </span>
                            <div className="flex gap-1">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-[10px]"
                                    disabled={disabled}
                                    onClick={onSelectAllAttributes}
                                >
                                    {i18n.t('All')}
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-[10px]"
                                    disabled={disabled}
                                    onClick={onClearAttributes}
                                >
                                    {i18n.t('None')}
                                </Button>
                            </div>
                        </div>
                        {programAttributes.map((attr) => {
                            const label = attr.displayName || attr.name || attr.id
                            const checked = selectedAttributeIds.includes(attr.id)
                            const isToggle = isImportOptionalToggleAttribute(attr)
                            return (
                                <ToggleRow
                                    key={attr.id}
                                    id={attr.id}
                                    label={label}
                                    checked={checked}
                                    onToggle={onToggleAttribute}
                                    hint={
                                        isToggle
                                            ? i18n.t('Yes/No — optional in file (default No)')
                                            : attr.mandatory
                                              ? i18n.t('Required')
                                              : undefined
                                    }
                                />
                            )
                        })}
                    </>
                ) : null}

                {showStageFields && stageColumns.length > 0 ? (
                    <>
                        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/95 px-3 py-1.5 dark:border-[color:var(--app-border)] dark:bg-zinc-900/95">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-600">
                                {i18n.t('Visit form fields')}
                            </span>
                            <div className="flex gap-1">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-[10px]"
                                    disabled={disabled}
                                    onClick={onSelectAllDataElements}
                                >
                                    {i18n.t('All')}
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-[10px]"
                                    disabled={disabled}
                                    onClick={onClearDataElements}
                                >
                                    {i18n.t('None')}
                                </Button>
                            </div>
                        </div>
                        {stageColumns.map((col) => (
                            <ToggleRow
                                key={col.de.id}
                                id={col.de.id}
                                label={col.columnHeader}
                                checked={selectedDataElementIds.includes(col.de.id)}
                                onToggle={onToggleDataElement}
                            />
                        ))}
                    </>
                ) : null}

                {!programAttributes.length && !stageColumns.length ? (
                    <p className="px-3 py-4 text-center text-xs app-text-meta">
                        {i18n.t('No fields available for this import type.')}
                    </p>
                ) : null}
            </div>
        </div>
    )
}
