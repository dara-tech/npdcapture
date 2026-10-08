import React from 'react'
import { createPortal } from 'react-dom'
import { CheckIcon, Cross2Icon, GearIcon } from '@radix-ui/react-icons'
import i18n from '@dhis2/d2-i18n'
import { Button } from './ui/button'
import { MODAL } from '../lib/overlayUi'
import { cn } from '../lib/utils'

const DragHandle = () => (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
            d="M5 3.5C5 3.77614 4.77614 4 4.5 4C4.22386 4 4 3.77614 4 3.5C4 3.22386 4.22386 3 4.5 3C4.77614 3 5 3.22386 5 3.5ZM5 7.5C5 7.77614 4.77614 8 4.5 8C4.22386 8 4 7.77614 4 7.5C4 7.22386 4.22386 7 4.5 7C4.77614 7 5 7.22386 5 7.5ZM5 11.5C5 11.77614 4.77614 12 4.5 12C4.22386 12 4 11.77614 4 11.5C4 11.22386 4.22386 11 4.5 11C4.77614 11 5 11.22386 5 11.5ZM11 3.5C11 3.77614 10.7761 4 10.5 4C10.2239 4 10 3.77614 10 3.5C10 3.22386 10.2239 3 10.5 3C10.7761 3 11 3.22386 11 3.5ZM11 7.5C11 7.77614 10.7761 8 10.5 8C10.2239 8 10 7.77614 10 7.5C10 7.22386 10.2239 7 10.5 7C10.7761 7 11 7.22386 11 7.5ZM11 11.5C11 11.77614 10.7761 12 10.5 12C10.2239 12 10 11.77614 10 11.5C10 11.22386 10.2239 11 10.5 11C10.7761 11 11 11.22386 11 11.5Z"
            fill="currentColor"
            fillRule="evenodd"
            clipRule="evenodd"
        />
    </svg>
)

const ColumnRow = ({
    col,
    index,
    checked,
    isDragging,
    onToggle,
    onDragStart,
    onDragOver,
    onDragEnd,
}) => (
    <div
        draggable
        onDragStart={() => onDragStart(index)}
        onDragOver={(e) => onDragOver(e, index)}
        onDragEnd={onDragEnd}
        className={`group flex cursor-move items-center gap-3 border border-transparent px-3 py-2.5 transition-all ${
            isDragging
                ? 'border-dashed border-[rgba(44,102,147,0.35)] bg-[rgba(44,102,147,0.08)] opacity-40'
                : 'hover:bg-slate-50/80 dark:hover:bg-zinc-900'
        }`}
    >
        <div className="flex shrink-0 items-center justify-center text-slate-300 group-hover:text-slate-400">
            <DragHandle />
        </div>
        <div className="pointer-events-none flex min-w-0 flex-1 items-center justify-between">
            <span
                className={`truncate text-[13px] font-semibold tracking-tight ${
                    checked ? 'text-slate-900 dark:text-zinc-50' : 'text-slate-500 dark:text-zinc-400'
                }`}
            >
                {col.label}
            </span>
            <div
                onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onToggle(col.id)
                }}
                className={`pointer-events-auto ml-2 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 transition-all ${
                    checked
                        ? 'border-[var(--app-header-bar-bg)] bg-[var(--app-header-bar-bg)] shadow-sm ring-4 ring-[rgba(44,102,147,0.15)] ring-offset-0'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600'
                }`}
            >
                {checked ? <CheckIcon className="h-3.5 w-3.5 text-white" /> : null}
            </div>
        </div>
    </div>
)

/** Shared configure-columns modal (record list pattern). */
export const ConfigColumnsListModal = ({
    open,
    onClose,
    configColumns,
    draftVisibleIds,
    draggedIndex,
    toggleDraftColumn,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleResetColumns,
    onApply,
    description,
}) => {
    if (typeof document === 'undefined' || !open) return null

    return createPortal(
        <div className={MODAL.backdrop} onClick={onClose}>
            <div
                className={cn(MODAL.panelMd, 'max-w-md')}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
            >
                <div className={MODAL.header}>
                    <div className="mb-1 flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--app-header-bar-bg)] text-white shadow-lg shadow-[0_4px_12px_rgba(44,102,147,0.3)]">
                            <GearIcon className="h-4 w-4" />
                        </div>
                        <h3 className="text-lg font-bold tracking-tight text-slate-900">
                            {i18n.t('Configure Columns')}
                        </h3>
                    </div>
                    <p className="pl-10 text-[12px] font-medium text-slate-500">
                        {description ||
                            i18n.t('Select and reorder columns to display in your list.')}
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        className={MODAL.closeBtn}
                        aria-label={i18n.t('Close')}
                    >
                        <Cross2Icon className="h-4 w-4" />
                    </button>
                </div>

                <div className="px-6 pb-4">
                    <div className={MODAL.scrollList}>
                        {configColumns.map((col, index) => (
                            <ColumnRow
                                key={col.id}
                                col={col}
                                index={index}
                                checked={draftVisibleIds.includes(col.id)}
                                isDragging={draggedIndex === index}
                                onToggle={toggleDraftColumn}
                                onDragStart={handleDragStart}
                                onDragOver={handleDragOver}
                                onDragEnd={handleDragEnd}
                            />
                        ))}
                    </div>
                </div>

                <div className={MODAL.footer}>
                    <Button
                        type="button"
                        variant="ghost"
                        className="text-xs font-bold text-slate-400 transition-colors hover:text-red-500"
                        onClick={handleResetColumns}
                    >
                        {i18n.t('Reset to Default')}
                    </Button>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            className="h-8 px-4 text-xs font-bold text-slate-500"
                        >
                            {i18n.t('Cancel')}
                        </Button>
                        <Button
                            type="button"
                            variant="primary"
                            className="h-8 rounded-lg bg-[var(--app-header-bar-bg)] px-6 text-xs font-bold text-white shadow-md shadow-[0_4px_12px_rgba(44,102,147,0.25)] hover:bg-[var(--app-header-bar-bg-hover)]"
                            onClick={onApply}
                        >
                            {i18n.t('Apply Changes')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}
