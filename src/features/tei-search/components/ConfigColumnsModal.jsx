import React from 'react'
import { createPortal } from 'react-dom'
import { CheckIcon, GearIcon, Cross2Icon } from '@radix-ui/react-icons'
import { Button } from '../../../components/ui/button'
import { getColumnHeaderLabel } from '../helpers'

const DragHandle = () => (
    <svg width="14" height="14" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 3.5C5 3.77614 4.77614 4 4.5 4C4.22386 4 4 3.77614 4 3.5C4 3.22386 4.22386 3 4.5 3C4.77614 3 5 3.22386 5 3.5ZM5 7.5C5 7.77614 4.77614 8 4.5 8C4.22386 8 4 7.77614 4 7.5C4 7.22386 4.22386 7 4.5 7C4.77614 7 5 7.22386 5 7.5ZM5 11.5C5 11.77614 4.77614 12 4.5 12C4.22386 12 4 11.77614 4 11.5C4 11.22386 4.22386 11 4.5 11C4.77614 11 5 11.22386 5 11.5ZM11 3.5C11 3.77614 10.7761 4 10.5 4C10.2239 4 10 3.77614 10 3.5C10 3.22386 10.2239 3 10.5 3C10.7761 3 11 3.22386 11 3.5ZM11 7.5C11 7.77614 10.7761 8 10.5 8C10.2239 8 10 7.77614 10 7.5C10 7.22386 10.2239 7 10.5 7C10.7761 7 11 7.22386 11 7.5ZM11 11.5C11 11.77614 10.7761 12 10.5 12C10.2239 12 10 11.77614 10 11.5C10 11.22386 10.2239 11 10.5 11C10.7761 11 11 11.22386 11 11.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
    </svg>
)

const ColumnRow = ({ col, index, checked, isDragging, onToggle, onDragStart, onDragOver, onDragEnd, draggingClassName, checkClass }) => (
    <div
        draggable
        onDragStart={() => onDragStart(index)}
        onDragOver={(e) => onDragOver(e, index)}
        onDragEnd={onDragEnd}
        className={`group flex items-center gap-3 px-3 py-2.5 transition-all cursor-move border border-transparent ${isDragging ? draggingClassName : 'hover:bg-slate-50/80'}`}
    >
        <div className="flex items-center justify-center text-slate-300 group-hover:text-slate-400 shrink-0">
            <DragHandle />
        </div>
        <div className="flex-1 flex items-center justify-between pointer-events-none min-w-0">
            <div className="flex items-center gap-2 min-w-0">
                <span className={`text-[13px] font-semibold tracking-tight truncate ${checked ? 'text-slate-900' : 'text-slate-500'}`}>
                    {getColumnHeaderLabel(col)}
                </span>
                {col.type === 'de' && (
                    <span className="shrink-0 text-[8px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100">DE</span>
                )}
            </div>
            <div
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(col.id) }}
                className={`pointer-events-auto ml-2 shrink-0 flex h-5 w-5 items-center justify-center rounded-lg border-2 transition-all cursor-pointer ${
                    checked ? `${checkClass} ring-4 ring-offset-0 shadow-sm` : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
            >
                {checked && <CheckIcon className="w-3.5 h-3.5 text-white" />}
            </div>
        </div>
    </div>
)

export const ConfigColumnsModal = ({
    open,
    onClose,
    configColumns,
    draftAttributeIds,
    draggedIndex,
    toggleDraftAttribute,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleResetColumns,
    setVisibleAttributeIds,
}) => {
    if (typeof document === 'undefined' || !open) return null

    const attrCols = configColumns.filter(c => c.type === 'attr')
    const deCols = configColumns.filter(c => c.type === 'de')

    return createPortal(
        <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[4px]" onClick={onClose}>
            <div className="modal-panel w-full max-w-md rounded-3xl border border-white/20 bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
                {/* Header */}
                <div className="relative px-6 pt-6 pb-4 bg-slate-50/50 border-b border-slate-100">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--app-header-bar-bg)] text-white shadow-lg shadow-[0_4px_12px_rgba(44,102,147,0.3)]">
                            <GearIcon className="w-4 h-4" />
                        </div>
                        <h3 className="text-lg font-bold tracking-tight text-slate-900">Configure Columns</h3>
                    </div>
                    <p className="text-[12px] font-medium text-slate-500 pl-10">Select &amp; reorder columns to display in your list.</p>
                    <button onClick={onClose} className="absolute top-6 right-6 h-7 w-7 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all">
                        <Cross2Icon className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 pb-4">
                    <div className="max-h-[380px] overflow-auto border border-slate-100 shadow-inner custom-scrollbar rounded-xl">
                        {/* Attributes */}
                        {attrCols.length > 0 && (
                            <>
                                <div className="sticky top-0 z-10 px-3 py-1.5 bg-slate-50 border-b border-slate-100">
                                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--app-header-bar-bg)]">Person Attributes</span>
                                </div>
                                {attrCols.map(col => {
                                    const index = configColumns.indexOf(col)
                                    return (
                                        <ColumnRow
                                            key={col.id}
                                            col={col}
                                            index={index}
                                            checked={draftAttributeIds.includes(col.id)}
                                            isDragging={draggedIndex === index}
                                            onToggle={toggleDraftAttribute}
                                            onDragStart={handleDragStart}
                                            onDragOver={handleDragOver}
                                            onDragEnd={handleDragEnd}
                                            draggingClassName="opacity-40 bg-[rgba(44,102,147,0.08)] border-dashed border-[rgba(44,102,147,0.35)]"
                                            checkClass="bg-[var(--app-header-bar-bg)] border-[var(--app-header-bar-bg)] ring-[rgba(44,102,147,0.15)]"
                                        />
                                    )
                                })}
                            </>
                        )}
                        {/* Data Elements */}
                        {deCols.length > 0 && (
                            <>
                                <div className="sticky top-0 z-10 px-3 py-1.5 bg-slate-50 border-b border-slate-100 border-t border-t-slate-100 mt-1">
                                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-600">Data Elements (latest event value)</span>
                                </div>
                                {deCols.map(col => {
                                    const index = configColumns.indexOf(col)
                                    return (
                                        <ColumnRow
                                            key={col.id}
                                            col={col}
                                            index={index}
                                            checked={draftAttributeIds.includes(col.id)}
                                            isDragging={draggedIndex === index}
                                            onToggle={toggleDraftAttribute}
                                            onDragStart={handleDragStart}
                                            onDragOver={handleDragOver}
                                            onDragEnd={handleDragEnd}
                                            draggingClassName="opacity-40 bg-emerald-50 border-dashed border-emerald-200"
                                            checkClass="bg-emerald-600 border-emerald-600 ring-emerald-600/5"
                                        />
                                    )
                                })}
                            </>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between bg-slate-50/80 border-t border-slate-100 px-6 py-4">
                    <Button type="button" variant="ghost" className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors" onClick={handleResetColumns}>
                        Reset to Default
                    </Button>
                    <div className="flex gap-2">
                        <Button type="button" variant="ghost" onClick={onClose} className="text-xs font-bold text-slate-500 px-4 h-8">Cancel</Button>
                        <Button
                            type="button"
                            variant="primary"
                            className="text-xs font-bold px-6 h-8 shadow-md shadow-[0_4px_12px_rgba(44,102,147,0.25)] bg-[var(--app-header-bar-bg)] hover:bg-[var(--app-header-bar-bg-hover)] rounded-lg text-white"
                            onClick={() => { setVisibleAttributeIds(draftAttributeIds); onClose() }}
                        >
                            Apply Changes
                        </Button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}
