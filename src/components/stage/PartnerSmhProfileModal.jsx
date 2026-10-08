import React, { useMemo } from 'react'
import { createPortal } from 'react-dom'
import i18n from '@dhis2/d2-i18n'
import { User } from 'lucide-react'
import { Button } from '../ui/button'
import { FORM } from '../../lib/formUi'
import { MixedScriptText } from '../ui/MixedScriptText'
import {
    formatProfileAttributeDisplayValue,
    resolveVisibleProfileAttributesForTei,
} from '../../lib/profileAttributeForm'
import { findSmhTrackedEntityAttributeId } from '../../lib/smhIdentifier'
import { trackedEntityAttributeIdFromEntry } from '../../utils/trackerMappers'
import { cn } from '../../lib/utils'

function getAttributeValue(tei, attributeId) {
    if (!tei?.attributes) return '-'
    const attr = tei.attributes.find((a) => trackedEntityAttributeIdFromEntry(a) === attributeId)
    return attr?.value ?? '-'
}

/**
 * Read-only partner profile preview after SMH code lookup.
 */
export function PartnerSmhProfileModal({
    open,
    tei,
    onClose,
    metadata = null,
    programStageId = null,
    ruleVarContext = null,
}) {
    const visibleProfileAttributes = useMemo(() => {
        if (!tei || !metadata) return []
        return resolveVisibleProfileAttributesForTei(metadata, tei, {
            programStageId,
            ruleVarContext,
        })
    }, [tei, metadata, programStageId, ruleVarContext])

    const smhAttributeId = useMemo(
        () => findSmhTrackedEntityAttributeId(visibleProfileAttributes),
        [visibleProfileAttributes]
    )

    const smhCode = smhAttributeId ? getAttributeValue(tei, smhAttributeId) : null

    const displayName = useMemo(() => {
        for (const attr of visibleProfileAttributes) {
            const n = String(attr.name || '').toLowerCase()
            if (n.includes('name') || n.includes('ឈ្មោះ')) {
                const v = getAttributeValue(tei, attr.id)
                if (v && v !== '-') return String(v)
            }
        }
        for (const attr of visibleProfileAttributes) {
            const v = getAttributeValue(tei, attr.id)
            if (v && v !== '-' && attr.id !== smhAttributeId) return String(v)
        }
        return tei?.trackedEntity || ''
    }, [tei, visibleProfileAttributes, smhAttributeId])

    if (!open || !tei || typeof document === 'undefined') return null

    return createPortal(
        <div
            className="modal-backdrop fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[4px]"
            onClick={onClose}
            role="presentation"
        >
            <div
                className="modal-panel flex max-h-[min(90vh,680px)] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="partner-smh-profile-title"
            >
                <div className="shrink-0 border-b border-slate-100 bg-slate-50/80 px-6 pb-4 pt-6">
                    <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--app-header-bar-bg)] text-white shadow-md shadow-slate-900/10">
                            <User className="h-5 w-5" strokeWidth={2} aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2
                                id="partner-smh-profile-title"
                                className="text-lg font-bold tracking-tight text-slate-900"
                            >
                                {i18n.t('Partner profile')}
                            </h2>
                            {displayName ? (
                                <p className="mt-0.5 truncate text-sm font-medium text-slate-700">
                                    {displayName}
                                </p>
                            ) : null}
                            {smhCode && smhCode !== '-' ? (
                                <p className="mt-0.5 text-xs font-medium tabular-nums text-slate-500">
                                    {smhCode}
                                </p>
                            ) : null}
                        </div>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar bg-slate-100/80 p-px">
                    <div className={FORM.partnerProfileModalGrid}>
                        {visibleProfileAttributes.map((attr) => {
                            const raw = getAttributeValue(tei, attr.id)
                            const val = formatProfileAttributeDisplayValue(
                                attr,
                                raw === '-' ? '' : raw
                            )
                            return (
                                <div key={attr.id} className={FORM.partnerProfileModalCell}>
                                    <div className={FORM.partnerProfileModalCellInner}>
                                        <span className={FORM.partnerProfileModalLabel}>
                                            {attr.name || attr.id}
                                        </span>
                                        <MixedScriptText
                                            value={val}
                                            className={FORM.partnerProfileModalValue}
                                            emptyClassName={cn(
                                                FORM.partnerProfileModalValue,
                                                'text-slate-300'
                                            )}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="shrink-0 border-t border-slate-100 bg-slate-50/80 px-6 py-4">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-10 w-full rounded-md border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                        onClick={onClose}
                    >
                        {i18n.t('Close')}
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    )
}
