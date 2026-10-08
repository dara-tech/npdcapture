import React, { useEffect, useState } from 'react'
import i18n from '@dhis2/d2-i18n'
import { createPortal } from 'react-dom'
import { useDataEngine } from '@dhis2/app-runtime'
import { ChevronDown, ChevronRight, Search, X } from 'lucide-react'
import { fetchOrgUnits } from '../../services/trackerApi'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { useOrgUnitTree, findById, orgUnitLabel } from '../../hooks/useOrgUnitTree'
import { cn } from '../../lib/utils'

const INDENT_PX = 18

const OrgUnitNode = ({ node, selectedId, expanded, toggle, onPick, depth = 0 }) => {
    const hasChildren = (node.children || []).length > 0
    const isExpanded = expanded.has(node.id)
    const isSelected = selectedId === node.id

    return (
        <div className="select-none">
            <div
                className={cn(
                    'group flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-[13px] transition-colors',
                    isSelected
                        ? 'bg-sky-50 font-semibold text-[var(--app-header-bar-bg)] dark:bg-sky-950/50 dark:text-sky-300'
                        : 'text-slate-700 hover:bg-slate-100/80 dark:text-zinc-300 dark:hover:bg-zinc-800/70'
                )}
                style={{ paddingLeft: `${depth * INDENT_PX + 8}px` }}
                onClick={() => onPick(node.id)}
            >
                {hasChildren ? (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            toggle(node.id)
                        }}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-200/70 hover:text-slate-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-200 transition-colors"
                        aria-label={isExpanded ? i18n.t('Collapse') : i18n.t('Expand')}
                    >
                        <ChevronRight
                            className={cn(
                                'h-3.5 w-3.5 transition-transform duration-150',
                                isExpanded && 'rotate-90 text-slate-600 dark:text-zinc-300'
                            )}
                        />
                    </button>
                ) : (
                    <span className="w-5 shrink-0" />
                )}

                <span className="truncate flex-1 font-sans">{orgUnitLabel(node)}</span>
            </div>

            {hasChildren && isExpanded ? (
                <div role="group" className="mt-0.5 space-y-0.5">
                    {(node.children || []).map((child) => (
                        <OrgUnitNode
                            key={child.id}
                            node={child}
                            selectedId={selectedId}
                            expanded={expanded}
                            toggle={toggle}
                            onPick={onPick}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    )
}

const defaultButtonClass =
    'app-filter-control flex h-8 min-w-0 items-center rounded-[var(--app-radius)] px-2.5 text-left md:px-3 lg:w-72'

export const OrgUnitSelect = ({
    value = '',
    onChange,
    orgUnits: orgUnitsProp,
    disabled = false,
    allowEmpty = false,
    emptyLabel,
    buttonClassName = defaultButtonClass,
    id = 'org-unit-select-trigger',
    buttonId,
}) => {
    const engine = useDataEngine()
    const [orgUnitsLocal, setOrgUnitsLocal] = useState([])
    const [orgModalOpen, setOrgModalOpen] = useState(false)
    const [orgDraft, setOrgDraft] = useState('')

    useEffect(() => {
        const handleOpen = () => {
            if (!disabled) {
                setOrgModalOpen(true)
                setOrgDraft(value || '')
            }
        }
        window.addEventListener('d2:open-org-unit-modal', handleOpen)
        return () => window.removeEventListener('d2:open-org-unit-modal', handleOpen)
    }, [disabled, value])

    const orgUnits = orgUnitsProp ?? orgUnitsLocal
    const resolvedEmptyLabel = emptyLabel ?? i18n.t('Org')

    const {
        filteredRoots,
        selectedOrg,
        orgSearch,
        setOrgSearch,
        expanded,
        toggle,
        expandToId,
    } = useOrgUnitTree(orgUnits, value)

    useEffect(() => {
        if (orgUnitsProp || !engine) return
        let cancelled = false
        ;(async () => {
            try {
                const list = await fetchOrgUnits({ engine })
                if (!cancelled) setOrgUnitsLocal(list)
            } catch {
                if (!cancelled) setOrgUnitsLocal([])
            }
        })()
        return () => {
            cancelled = true
        }
    }, [engine, orgUnitsProp])

    const closeOrgModal = () => {
        setOrgModalOpen(false)
        setOrgSearch('')
    }

    const openOrgModal = () => {
        setOrgModalOpen(true)
        setOrgDraft(value || '')
        expandToId(value)
    }

    useEffect(() => {
        if (!orgModalOpen) return undefined
        const onKeyDown = (event) => {
            if (event.key === 'Escape') closeOrgModal()
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [orgModalOpen])

    const displayLabel = selectedOrg ? orgUnitLabel(selectedOrg) : resolvedEmptyLabel

    const orgUnitModal = orgModalOpen ? (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/75 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150 font-sans"
            onClick={closeOrgModal}
        >
            <div
                className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
                onClick={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={i18n.t('Select organisation unit')}
            >
                {/* Header: Clean & Minimal without heavy icon badge */}
                <div className="relative flex items-center justify-between border-b border-slate-100 dark:border-zinc-800/80 px-5 py-4">
                    <div className="flex flex-col gap-0.5 pr-8">
                        <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 m-0 leading-snug">
                            {i18n.t('Select Site')}
                        </h3>
                        <p className="text-[12.5px] text-slate-500 dark:text-zinc-400 m-0 leading-tight">
                            {i18n.t('Choose an organization unit to begin.')}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={closeOrgModal}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                        aria-label={i18n.t('Close')}
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="px-5 pt-3 pb-2">
                    <div className="relative flex items-center">
                        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 z-10" />
                        <Input
                            value={orgSearch}
                            onChange={(e) => setOrgSearch(e.target.value)}
                            placeholder={i18n.t('Filter sites...')}
                            style={{ paddingLeft: '34px' }}
                            className="h-9 pr-8 rounded-xl border-slate-200 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-800/40 text-[13px] transition-all focus:bg-white dark:focus:bg-zinc-800 focus:border-[var(--app-header-bar-bg)] focus:ring-2 focus:ring-[var(--app-header-bar-bg)]/20"
                        />
                        {orgSearch ? (
                            <button
                                type="button"
                                onClick={() => setOrgSearch('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-zinc-700 transition-colors z-10"
                                aria-label="Clear search"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        ) : null}
                    </div>
                </div>

                {/* Tree Scroll List */}
                <div className="px-5 pb-3">
                    <div className="min-h-[200px] max-h-[340px] overflow-auto rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-950/40 p-1.5 custom-scrollbar">
                        {filteredRoots.length ? (
                            <div className="space-y-0.5">
                                {filteredRoots.map((node) => (
                                    <OrgUnitNode
                                        key={node.id}
                                        node={node}
                                        selectedId={orgDraft}
                                        expanded={expanded}
                                        toggle={toggle}
                                        onPick={setOrgDraft}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                <p className="text-[13px] text-slate-500 dark:text-zinc-400 m-0">
                                    {i18n.t('No sites match.')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer: Clean & Simple */}
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 dark:border-zinc-800/80 bg-slate-50/60 dark:bg-zinc-900/80 px-5 py-3">
                    <div className="min-w-0 flex-1">
                        {orgDraft ? (
                            <p className="truncate text-xs text-slate-600 dark:text-zinc-300 m-0">
                                <span className="font-medium text-slate-500 dark:text-zinc-400">
                                    {i18n.t('Draft:')}{' '}
                                </span>
                                <span className="font-semibold text-sky-700 dark:text-sky-300">
                                    {orgUnitLabel(findById(orgUnits, orgDraft))}
                                </span>
                            </p>
                        ) : (
                            <span className="text-xs text-slate-400 dark:text-zinc-500 italic">
                                {i18n.t('Select a target site for data capture.')}
                            </span>
                        )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        {allowEmpty ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-xs text-slate-600 dark:text-zinc-300"
                                onClick={() => {
                                    onChange('')
                                    closeOrgModal()
                                }}
                            >
                                {i18n.t('All sites')}
                            </Button>
                        ) : null}
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={closeOrgModal}
                            className="text-xs text-slate-600 dark:text-zinc-300"
                        >
                            {i18n.t('Cancel')}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            className="rounded-lg bg-[var(--app-header-bar-bg)] px-4 text-xs font-semibold text-white hover:bg-[var(--app-header-bar-bg-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            disabled={!orgDraft && !allowEmpty}
                            onClick={() => {
                                if (orgDraft) onChange(orgDraft)
                                closeOrgModal()
                            }}
                        >
                            {i18n.t('Apply Selection')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    ) : null

    return (
        <>
            <button
                type="button"
                id={buttonId || id}
                className={cn(
                    'app-filter-control flex h-8 min-h-8 items-center justify-between rounded-md border border-[color:var(--app-border)] bg-white px-2.5 py-1 text-[13px] font-normal app-text-title transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-black',
                    buttonClassName,
                    disabled && 'cursor-not-allowed opacity-30 grayscale'
                )}
                onClick={() => !disabled && openOrgModal()}
                disabled={disabled}
                title={displayLabel}
            >
                <span className="truncate pr-2 text-[13px] font-normal app-text-title">
                    {displayLabel}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            </button>
            {typeof document !== 'undefined' ? createPortal(orgUnitModal, document.body) : null}
        </>
    )
}
