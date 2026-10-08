import React from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle } from 'lucide-react'
import i18n from '@dhis2/d2-i18n'
import { Button } from '../ui/button'
import { decodeBasicHtmlEntities } from '../../lib/utils'

export function CompleteVisitChecklistModal({
    open,
    missing = [],
    onClose,
    onJumpToField,
}) {
    if (!open || typeof document === 'undefined') return null

    return createPortal(
        <div
            className="modal-backdrop fixed inset-0 z-[120] flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-[4px] sm:items-center sm:p-4"
            onClick={onClose}
            role="presentation"
        >
            <div
                className="modal-panel flex max-h-[min(85vh,32rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/20 bg-white shadow-2xl sm:rounded-3xl"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="complete-checklist-title"
            >
                <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                            <AlertCircle className="h-5 w-5" strokeWidth={2} aria-hidden />
                        </div>
                        <div>
                            <h2
                                id="complete-checklist-title"
                                className="text-base font-bold text-slate-900 sm:text-lg"
                            >
                                {i18n.t('Required fields missing')}
                            </h2>
                            <p className="mt-1 text-sm text-slate-600">
                                {i18n.t('Complete these before marking the visit done.')}
                            </p>
                        </div>
                    </div>
                </div>
                <ol className="flex-1 overflow-y-auto px-5 py-3 custom-scrollbar">
                    {missing.map((item) => (
                        <li
                            key={`${item.sectionId}-${item.deId}`}
                            className="border-b border-slate-100 py-2.5 last:border-0"
                        >
                            <button
                                type="button"
                                className="w-full text-left text-sm text-[var(--app-header-bar-bg)] hover:underline"
                                onClick={() => onJumpToField?.(item)}
                            >
                                <span className="block text-xs font-medium text-slate-500">
                                    {decodeBasicHtmlEntities(item.sectionName)}
                                </span>
                                <span className="font-medium text-slate-800">
                                    {decodeBasicHtmlEntities(item.label)}
                                </span>
                            </button>
                        </li>
                    ))}
                </ol>
                <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3">
                    <Button type="button" variant="outline" size="sm" onClick={onClose}>
                        {i18n.t('Close')}
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    )
}
