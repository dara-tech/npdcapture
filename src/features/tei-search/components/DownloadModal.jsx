import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckIcon, DownloadIcon } from '@radix-ui/react-icons'
import { Button } from '../../../components/ui/button'
import { Spinner } from '../../../components/ui/spinner'
import { searchTrackedEntities } from '../../../services/trackerApi'
import { getAttributeValue } from '../helpers'
import { MODAL } from '../../../lib/overlayUi'
import { cn } from '../../../lib/utils'

export const DownloadModal = ({
    open,
    onClose,
    programAttributes,
    downloadAttributeIds,
    setDownloadAttributeIds,
    engine,
    context,
    filters,
    searchValue,
    sortConfig,
    pager,
}) => {
    const [downloadFormat, setDownloadFormat] = useState('CSV')
    const [exporting, setExporting] = useState(false)

    if (typeof document === 'undefined' || !open) return null

    const handleDownload = async () => {
        try {
            setExporting(true)
            const { instances } = await searchTrackedEntities({
                engine,
                orgUnit: context.orgUnit,
                program: context.program,
                filters,
                value: searchValue,
                paging: false,
                order: `${sortConfig.columnId}:${sortConfig.direction}`,
            })
            const attrs = programAttributes.filter(a => downloadAttributeIds.includes(a.id))
            let content = ''
            let fileName = `personnel_export_${new Date().toISOString().split('T')[0]}`

            if (downloadFormat === 'CSV') {
                const header = attrs.map(a => `"${(a.name || a.id).replace(/"/g, '""')}"`).join(',')
                const rows = instances.map(tei =>
                    attrs.map(a => `"${getAttributeValue(tei, a.id).replace(/"/g, '""')}"`).join(',')
                )
                content = [header, ...rows].join('\n')
                fileName += '.csv'
            } else {
                content = JSON.stringify(
                    instances.map(tei => {
                        const obj = { id: tei.trackedEntity }
                        attrs.forEach(a => { obj[a.name || a.id] = getAttributeValue(tei, a.id) })
                        return obj
                    }),
                    null, 2
                )
                fileName += '.json'
            }

            const blob = new Blob([content], { type: downloadFormat === 'CSV' ? 'text/csv' : 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = fileName
            document.body.appendChild(a); a.click(); document.body.removeChild(a)
            URL.revokeObjectURL(url)
            onClose()
        } catch (e) {
            console.error('Export failed', e)
        } finally {
            setExporting(false)
        }
    }

    return createPortal(
        <div className={MODAL.backdrop} onClick={onClose}>
            <div className={cn(MODAL.panelMd, 'max-w-md')} onClick={e => e.stopPropagation()}>
                <div className={MODAL.header}>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--app-header-bar-bg)] text-white shadow-lg shadow-[0_4px_12px_rgba(44,102,147,0.3)]">
                            <DownloadIcon className="w-4 h-4" />
                        </div>
                        <h3 className="text-lg font-bold tracking-tight text-slate-900">Export Records</h3>
                    </div>
                    <p className="text-[12px] font-medium text-slate-500 pl-10">Configure your export format and fields.</p>
                </div>

                {/* Body */}
                <div className="px-6 pb-2">
                    <div className={cn(MODAL.segmentTrack, 'mb-6')}>
                        {['CSV', 'JSON'].map(fmt => (
                            <button
                                key={fmt}
                                onClick={() => setDownloadFormat(fmt)}
                                className={`flex-1 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                                    downloadFormat === fmt ? MODAL.segmentActive : MODAL.segmentIdle
                                }`}
                            >
                                {fmt} Format
                            </button>
                        ))}
                    </div>
                    <div className={cn(MODAL.scrollList, 'max-h-[300px]')}>
                        {programAttributes.map(attribute => {
                            const checked = downloadAttributeIds.includes(attribute.id)
                            return (
                                <div
                                    key={attribute.id}
                                    className={MODAL.listRow}
                                >
                                    <div className="flex-1 flex items-center justify-between">
                                        <span className={`text-[12px] font-semibold tracking-tight ${checked ? 'text-slate-900' : 'text-slate-600'}`}>
                                            {attribute.name || attribute.id}
                                        </span>
                                        <div
                                            onClick={() => setDownloadAttributeIds(prev =>
                                                prev.includes(attribute.id) ? prev.filter(id => id !== attribute.id) : [...prev, attribute.id]
                                            )}
                                            className={`flex h-5 w-5 items-center justify-center rounded-lg border-2 transition-all cursor-pointer ${
                                                checked ? 'bg-[var(--app-header-bar-bg)] border-[var(--app-header-bar-bg)] ring-4 ring-[rgba(44,102,147,0.15)] shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600'
                                            }`}
                                        >
                                            {checked && <CheckIcon className="w-3.5 h-3.5 text-white" />}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className={cn(MODAL.footerEnd, 'mt-4')}>
                    <Button type="button" variant="ghost" onClick={onClose} className="text-xs font-bold text-slate-500 px-4 h-8">Cancel</Button>
                    <Button
                        type="button"
                        variant="primary"
                        className="text-xs font-bold px-6 h-8 shadow-md shadow-[0_4px_12px_rgba(44,102,147,0.25)] bg-[var(--app-header-bar-bg)] hover:bg-[var(--app-header-bar-bg-hover)] rounded-lg text-white disabled:opacity-70 flex items-center gap-2"
                        onClick={handleDownload}
                        disabled={downloadAttributeIds.length === 0 || exporting}
                    >
                        {exporting ? (
                            <><Spinner className="w-3 h-3 border-white/30 border-t-white" /> Preparing Export...</>
                        ) : (
                            `Export ${pager.total} Records`
                        )}
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    )
}
