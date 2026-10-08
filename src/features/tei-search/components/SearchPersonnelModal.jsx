import React, { useState, useEffect } from 'react'
import i18n from '@dhis2/d2-i18n'
import { Cross2Icon, MagnifyingGlassIcon, TrashIcon } from '@radix-ui/react-icons'
import { QrCode } from 'lucide-react'
import { Input } from '../../../components/ui/input'
import { Button } from '../../../components/ui/button'
import { Select } from '../../../components/ui/select'
import { DatePicker } from '../../../components/ui/date-picker'
import { QrSearchScannerModal } from './QrSearchScannerModal'
import { cn } from '../../../lib/utils'

export const SearchPersonnelModal = ({
    open,
    onClose,
    filters = [],
    setFilters,
    clearFilters,
    searchValue = '',
    setSearchValue,
    runSearch,
    programAttributes = [],
}) => {
    // Local state to allow quick editing before submitting
    const [localSearch, setLocalSearch] = useState(searchValue)
    const [localAttrValues, setLocalAttrValues] = useState({})
    const [scannerOpen, setScannerOpen] = useState(false)

    // Sync from parent state whenever modal opens
    useEffect(() => {
        if (open) {
            setLocalSearch(searchValue || '')
            const map = {}
            for (const f of filters) {
                if (f.attributeId && f.value != null) {
                    map[f.attributeId] = f.value
                }
            }
            setLocalAttrValues(map)
        }
    }, [open, searchValue, filters])

    if (!open) return null

    const handleAttrChange = (attrId, val) => {
        setLocalAttrValues((prev) => ({
            ...prev,
            [attrId]: val,
        }))
    }

    const activeFilterCount =
        Object.values(localAttrValues).filter((v) => v != null && String(v).trim() !== '').length +
        (localSearch.trim() ? 1 : 0)

    const handleApply = () => {
        const nextFilters = Object.entries(localAttrValues)
            .filter(([k, v]) => v != null && String(v).trim() !== '')
            .map(([attrId, val]) => ({
                id: attrId,
                attributeId: attrId,
                value: String(val).trim(),
            }))

        setSearchValue?.(localSearch)
        if (setFilters) {
            setFilters(nextFilters)
        }
        runSearch?.(1, undefined, null, nextFilters, { overrideValue: localSearch })
        onClose?.()
    }

    const handleClearAll = () => {
        setLocalSearch('')
        setLocalAttrValues({})
        setSearchValue?.('')
        clearFilters?.()
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            handleApply()
        }
    }

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center animate-in fade-in duration-200 p-4">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={onClose} />

            <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-2xl relative animate-in zoom-in-95 slide-in-from-bottom-6 duration-200 border border-slate-200/80 dark:border-zinc-800 flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
                {/* Modal Header */}
                <div className="px-6 pt-5 pb-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/50 shrink-0">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base md:text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                                {i18n.t('Advanced Search')}
                            </h3>
                            {activeFilterCount > 0 && (
                                <span className="inline-flex items-center rounded-full bg-app-tint-10 px-2 py-0.5 text-[10px] font-bold text-app-primary">
                                    {activeFilterCount} {i18n.t('active')}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                            {i18n.t('Filter across all program attributes directly or enter global keywords.')}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                        title={i18n.t('Close')}
                    >
                        <Cross2Icon className="w-4 h-4" />
                    </button>
                </div>

                {/* Modal Body: Scrollable fields */}
                <div className="p-6 flex flex-col gap-5 overflow-y-auto custom-scrollbar flex-1">
                    {/* Global Keyword Search */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider px-0.5">
                            {i18n.t('Global Search')}
                        </label>
                        <div className="relative group">
                            <Input
                                placeholder={i18n.t('Search across all fields (name, code, phone, notes)...')}
                                value={localSearch}
                                onChange={(e) => setLocalSearch(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className="h-10 pl-10 pr-28 bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700 rounded-xl focus:bg-white dark:focus:bg-zinc-800 text-xs font-semibold"
                            />
                            <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-app-primary transition-colors">
                                <MagnifyingGlassIcon className="w-4 h-4" />
                            </div>
                            <button
                                type="button"
                                onClick={() => setScannerOpen(true)}
                                className="absolute inset-y-1.5 right-1.5 px-2.5 flex items-center gap-1.5 bg-slate-100 hover:bg-app-tint-10 hover:text-app-primary dark:bg-zinc-700 dark:hover:bg-zinc-600 text-slate-600 dark:text-zinc-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                                title={i18n.t('Scan QR / Barcode')}
                            >
                                <QrCode className="h-3.5 w-3.5" />
                                <span>{i18n.t('Scan')}</span>
                            </button>
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3 py-0.5">
                        <div className="h-px flex-1 bg-slate-100 dark:bg-zinc-800" />
                        <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                            {i18n.t('Filter by Attributes')} ({programAttributes.length})
                        </span>
                        <div className="h-px flex-1 bg-slate-100 dark:bg-zinc-800" />
                    </div>

                    {/* All Program Attributes in 2-Column Grid */}
                    {programAttributes.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-400 dark:text-zinc-500">
                            {i18n.t('No attributes available for this program.')}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            {programAttributes.map((attr) => {
                                const currentVal = localAttrValues[attr.id] ?? ''
                                const hasOptionSet = Boolean(attr.optionSet?.options?.length)

                                const optionItems = hasOptionSet
                                    ? [
                                          { value: '', label: `-- ${i18n.t('Any')} --` },
                                          ...attr.optionSet.options.map((opt) => ({
                                              value: opt.code || opt.id,
                                              label: opt.name || opt.displayName || opt.code,
                                          })),
                                      ]
                                    : null

                                return (
                                    <div
                                        key={attr.id}
                                        className={cn(
                                            'flex flex-col gap-1.5 p-2.5 rounded-xl border transition-all',
                                            currentVal
                                                ? 'bg-app-tint-10/40 border-app-primary/30 dark:bg-zinc-800/80 dark:border-app-primary/40'
                                                : 'bg-slate-50/50 dark:bg-zinc-800/30 border-slate-200/60 dark:border-zinc-800/80'
                                        )}
                                    >
                                        <div className="flex items-center justify-between">
                                            <label
                                                htmlFor={`attr-${attr.id}`}
                                                className="text-[11px] font-bold text-slate-700 dark:text-zinc-200 truncate"
                                                title={attr.displayName || attr.name}
                                            >
                                                {attr.displayName || attr.name}
                                            </label>
                                            {currentVal && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleAttrChange(attr.id, '')}
                                                    className="text-[10px] text-slate-400 hover:text-red-500 font-semibold transition-colors"
                                                    title={i18n.t('Clear this field')}
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>

                                        {optionItems ? (
                                            <Select
                                                value={currentVal}
                                                onValueChange={(val) => handleAttrChange(attr.id, val)}
                                                options={optionItems}
                                                className="h-8.5 bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 rounded-lg text-xs"
                                                placeholder={i18n.t('Select...')}
                                            />
                                        ) : attr.valueType === 'DATE' ? (
                                            <DatePicker
                                                date={currentVal}
                                                setDate={(val) => handleAttrChange(attr.id, val || '')}
                                                className="h-8.5 bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 rounded-lg text-xs"
                                                placeholder={i18n.t('Pick date...')}
                                            />
                                        ) : attr.valueType === 'BOOLEAN' || attr.valueType === 'TRUE_ONLY' ? (
                                            <Select
                                                value={currentVal}
                                                onValueChange={(val) => handleAttrChange(attr.id, val)}
                                                options={[
                                                    { value: '', label: `-- ${i18n.t('Any')} --` },
                                                    { value: 'true', label: i18n.t('Yes') },
                                                    { value: 'false', label: i18n.t('No') },
                                                ]}
                                                className="h-8.5 bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 rounded-lg text-xs"
                                                placeholder={i18n.t('Any')}
                                            />
                                        ) : (
                                            <Input
                                                id={`attr-${attr.id}`}
                                                type={
                                                    attr.valueType === 'NUMBER' || attr.valueType === 'INTEGER'
                                                        ? 'number'
                                                        : 'text'
                                                }
                                                placeholder={i18n.t('Enter value...')}
                                                value={currentVal}
                                                onChange={(e) => handleAttrChange(attr.id, e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                className="h-8.5 bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-medium"
                                            />
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="flex justify-between items-center bg-slate-50/80 dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 px-6 py-3.5 shrink-0">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={handleClearAll}
                        disabled={activeFilterCount === 0}
                        className="text-xs font-bold text-red-500 hover:text-red-600 dark:hover:bg-red-950/20 px-3 h-8 disabled:opacity-40"
                    >
                        <TrashIcon className="w-3.5 h-3.5 mr-1" />
                        {i18n.t('Clear All')}
                    </Button>

                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            className="text-xs font-medium text-slate-600 dark:text-zinc-400 px-4 h-8"
                        >
                            {i18n.t('Cancel')}
                        </Button>
                        <Button
                            type="button"
                            onClick={handleApply}
                            className="text-xs font-bold px-5 h-8 bg-app-primary hover:bg-app-primary/90 text-white rounded-lg transition-all shadow-xs"
                        >
                            <MagnifyingGlassIcon className="w-3.5 h-3.5 mr-1.5" />
                            {i18n.t('Apply Search')} {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
                        </Button>
                    </div>
                </div>
            </div>

            <QrSearchScannerModal
                open={scannerOpen}
                onClose={() => setScannerOpen(false)}
                onScanSuccess={(scannedCode) => {
                    const code = String(scannedCode || '').trim()
                    setLocalSearch(code)
                    setSearchValue?.(code)
                    runSearch?.(1, undefined, null, null, { overrideValue: code })
                    onClose?.()
                }}
            />
        </div>
    )
}
