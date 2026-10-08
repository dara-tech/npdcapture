import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useConfig } from '@dhis2/app-runtime'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { cn, decodeBasicHtmlEntities } from '../../lib/utils'
import i18n from '@dhis2/d2-i18n'
import { BookOpen, ChevronDown, ChevronUp, ExternalLink, Search, X, AlertTriangle, Info } from 'lucide-react'
import { getUnsupportedProgramRuleActionsSummary, getProgramRulesClientParityNotes } from '../../services/ruleEngine'
import {
    ruleHasDataElementAction,
    summarizeProgramRuleAction,
} from '../../lib/programRuleDisplay'

const PARITY_NOTES = getProgramRulesClientParityNotes()

const stageNameById = (stages, id) => {
    if (!id || !stages?.length) return ''
    const s = stages.find((x) => x.id === id)
    return s ? decodeBasicHtmlEntities(s.name) : id
}

/**
 * Full-screen reference: all program rules (and variables) with search + link to Maintenance.
 */
export const ProgramRulesReferencePanel = ({ open, onClose, metadata, programId }) => {
    const { baseUrl: configBaseUrl } = useConfig()
    const [search, setSearch] = useState('')
    const [tab, setTab] = useState('rules')
    const [rulesScope, setRulesScope] = useState('all')
    const [expanded, setExpanded] = useState(() => new Set())

    const baseUrl = String(configBaseUrl || '').replace(/\/$/, '')
    const maintenanceProgramHref =
        programId && baseUrl ? `${baseUrl}/dhis-web-maintenance/index.html#/programs/program/${programId}` : null

    const rules = metadata?.rules || []
    const variables = metadata?.ruleVariables || []
    const stages = metadata?.stages || []
    const programTitle = metadata?.name ? decodeBasicHtmlEntities(metadata.name) : programId || ''

    useEffect(() => {
        if (!open) return
        const t = setTimeout(() => {
            document.getElementById('program-rules-search-input')?.focus?.()
        }, 50)
        return () => clearTimeout(t)
    }, [open])

    useEffect(() => {
        if (!open) {
            setSearch('')
            setTab('rules')
            setRulesScope('all')
            setExpanded(new Set())
        }
    }, [open])

    useEffect(() => {
        if (!open) return
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [open, onClose])

    const q = search.trim().toLowerCase()
    const matches = (s) => !q || String(s ?? '').toLowerCase().includes(q)

    const deRulesCount = useMemo(
        () => rules.filter((r) => ruleHasDataElementAction(r, metadata)).length,
        [rules, metadata]
    )

    const scopedRules = useMemo(() => {
        if (rulesScope !== 'de') return rules
        return rules.filter((r) => ruleHasDataElementAction(r, metadata))
    }, [rules, rulesScope, metadata])

    const filteredRules = useMemo(() => {
        const list = [...scopedRules]
        if (!q) return list.sort(ruleSort)
        return list
            .filter((r) => {
                const blob = [
                    r?.id,
                    r?.name,
                    r?.condition,
                    r?.priority,
                    r?.programStage?.id,
                    ...(r?.programRuleActions || []).map((a) =>
                        summarizeProgramRuleAction(a, metadata)
                    ),
                ]
                    .filter(Boolean)
                    .join('\n')
                return matches(blob)
            })
            .sort(ruleSort)
    }, [scopedRules, q, metadata])

    const filteredVariables = useMemo(() => {
        const list = [...variables]
        if (!q) return list.sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
        return list
            .filter((v) => {
                const blob = [
                    v?.id,
                    v?.name,
                    v?.programRuleVariableSourceType,
                    v?.dataElement?.id,
                    v?.trackedEntityAttribute?.id,
                    v?.programStage?.id,
                ]
                    .filter(Boolean)
                    .join('\n')
                return matches(blob)
            })
            .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
    }, [variables, q])

    const unsupportedActionEntries = useMemo(() => {
        const m = getUnsupportedProgramRuleActionsSummary(metadata?.rules || [])
        return Object.entries(m).sort((a, b) => b[1] - a[1])
    }, [metadata?.rules])

    const toggleExpanded = (id) => {
        setExpanded((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    if (!open || typeof document === 'undefined') return null

    return createPortal(
        <div
            className="fixed inset-0 z-[200] flex justify-end bg-slate-900/40 backdrop-blur-[2px]"
            role="presentation"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose?.()
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="program-rules-panel-title"
                className="flex h-full w-full max-w-lg flex-col border-l border-slate-200/90 bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 md:px-5">
                    <div className="min-w-0">
                        <h2 id="program-rules-panel-title" className="text-base font-semibold tracking-tight text-slate-900">
                            {i18n.t('Program rules')}
                        </h2>
                        <p className="mt-0.5 truncate text-xs font-medium text-slate-500" title={programTitle}>
                            {programTitle}
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        {maintenanceProgramHref ? (
                            <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2 text-xs" asChild>
                                <a href={maintenanceProgramHref} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                                    {i18n.t('Maintenance')}
                                </a>
                            </Button>
                        ) : null}
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 rounded-lg text-slate-500"
                            onClick={onClose}
                            aria-label={i18n.t('Close')}
                        >
                            <X className="h-4 w-4" aria-hidden />
                        </Button>
                    </div>
                </div>

                <div className="flex shrink-0 gap-1 border-b border-slate-100 px-3 py-2 md:px-4">
                    <button
                        type="button"
                        onClick={() => setTab('rules')}
                        className={cn(
                            'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                            tab === 'rules' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                        )}
                    >
                        {i18n.t('Rules')} ({filteredRules.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setTab('variables')}
                        className={cn(
                            'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                            tab === 'variables' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                        )}
                    >
                        {i18n.t('Variables')} ({filteredVariables.length})
                    </button>
                </div>

                {tab === 'rules' ? (
                    <div className="flex shrink-0 gap-1 border-b border-slate-100 px-3 py-1.5 md:px-4">
                        <button
                            type="button"
                            onClick={() => setRulesScope('all')}
                            className={cn(
                                'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
                                rulesScope === 'all'
                                    ? 'bg-slate-200 text-slate-900'
                                    : 'text-slate-600 hover:bg-slate-100'
                            )}
                        >
                            {i18n.t('All rules')} ({rules.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setRulesScope('de')}
                            className={cn(
                                'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
                                rulesScope === 'de'
                                    ? 'bg-slate-200 text-slate-900'
                                    : 'text-slate-600 hover:bg-slate-100'
                            )}
                        >
                            {i18n.t('Data element rules')} ({deRulesCount})
                        </button>
                    </div>
                ) : null}

                <div className="shrink-0 border-b border-slate-100 px-3 py-2 md:px-4">
                    <div className="relative">
                        <Search
                            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                            aria-hidden
                        />
                        <Input
                            id="program-rules-search-input"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={i18n.t('Search name, id, condition, actions…')}
                            className="h-9 border-slate-200 pl-8 text-sm"
                            aria-label={i18n.t('Search program rules')}
                        />
                    </div>
                </div>

                {unsupportedActionEntries.length > 0 ? (
                    <div className="shrink-0 border-b border-amber-200/90 bg-amber-50/90 px-3 py-2.5 md:px-4">
                        <div className="flex gap-2">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
                            <div className="min-w-0 text-[11px] leading-snug text-amber-950">
                                <p className="font-semibold text-amber-900">{i18n.t('Actions in Maintenance not executed here')}</p>
                                <p className="mt-0.5 text-amber-800/90">
                                    {i18n.t(
                                        'These program rule actions exist in your program but this app does not apply them yet (DHIS2 server or full Capture still can).'
                                    )}
                                </p>
                                <ul className="mt-1.5 list-inside list-disc font-mono text-[10px] text-amber-950/90">
                                    {unsupportedActionEntries.map(([type, n]) => (
                                        <li key={type}>
                                            {type} ({n})
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                ) : null}

                <details className="group shrink-0 border-b border-slate-100 bg-slate-50/60 px-3 py-2 md:px-4">
                    <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-slate-700 marker:content-none [&::-webkit-details-marker]:hidden">
                        <Info className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                        <span>{i18n.t('Parity with Program Rule Maintenance')}</span>
                        <ChevronDown className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden />
                    </summary>
                    <div className="mt-2 space-y-3 border-t border-slate-100/80 pt-2 pb-1 text-[11px] leading-relaxed text-slate-600">
                        <div>
                            <p className="font-semibold text-slate-700">{i18n.t('Actions implemented in this app')}</p>
                            <p className="mt-0.5 font-mono text-[10px] text-slate-500">{PARITY_NOTES.actionsImplemented.join(', ')}</p>
                        </div>
                        <div>
                            <p className="font-semibold text-slate-700">{i18n.t('Actions only in Maintenance / server (not here)')}</p>
                            <p className="mt-0.5 font-mono text-[10px] text-slate-500">{PARITY_NOTES.actionsNotImplemented.join(', ')}</p>
                        </div>
                        <div>
                            <p className="font-semibold text-slate-700">{i18n.t('Conditions (legacy evaluator)')}</p>
                            <ul className="mt-0.5 list-inside list-disc text-slate-600">
                                {PARITY_NOTES.conditionsPartial.map((line, i) => (
                                    <li key={`c-${i}`}>{line}</li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <p className="font-semibold text-slate-700">{i18n.t('Program rule variables')}</p>
                            <ul className="mt-0.5 list-inside list-disc text-slate-600">
                                {PARITY_NOTES.variablesPartial.map((line, i) => (
                                    <li key={`v-${i}`}>{line}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </details>

                <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar px-3 py-3 md:px-4">
                    {tab === 'rules' ? (
                        filteredRules.length === 0 ? (
                            <p className="px-1 py-6 text-center text-sm text-slate-500">{i18n.t('No rules match your search.')}</p>
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {filteredRules.map((r, idx) => {
                                    const id = r?.id || r?.uid || r?.name || `rule-${idx}`
                                    const isOpen = expanded.has(id)
                                    const stageLabel = stageNameById(stages, r?.programStage?.id)
                                    return (
                                        <li
                                            key={id}
                                            className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50/40 shadow-sm"
                                        >
                                            <button
                                                type="button"
                                                className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
                                                onClick={() => toggleExpanded(id)}
                                                aria-expanded={isOpen}
                                            >
                                                <span className="mt-0.5 shrink-0 text-slate-400">
                                                    {isOpen ? (
                                                        <ChevronUp className="h-4 w-4" aria-hidden />
                                                    ) : (
                                                        <ChevronDown className="h-4 w-4" aria-hidden />
                                                    )}
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-sm font-semibold text-slate-900">
                                                        {decodeBasicHtmlEntities(r?.name || r?.id || i18n.t('Unnamed rule'))}
                                                    </span>
                                                    <span className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-slate-500">
                                                        {r?.priority != null && Number.isFinite(Number(r.priority)) ? (
                                                            <span>
                                                                {i18n.t('Priority')}: {r.priority}
                                                            </span>
                                                        ) : null}
                                                        {stageLabel ? (
                                                            <span>
                                                                {i18n.t('Stage')}: {stageLabel}
                                                            </span>
                                                        ) : null}
                                                        <span className="font-mono text-[10px] text-slate-400">{r?.id}</span>
                                                    </span>
                                                </span>
                                            </button>
                                            {isOpen ? (
                                                <div className="space-y-2 border-t border-slate-100/80 bg-white px-3 py-3">
                                                    <div>
                                                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                                            {i18n.t('Condition')}
                                                        </div>
                                                        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-100 bg-slate-50 p-2 font-mono text-[11px] leading-relaxed text-slate-800">
                                                            {r?.condition || '—'}
                                                        </pre>
                                                    </div>
                                                    <div>
                                                        <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                                            {i18n.t('Actions')}
                                                        </div>
                                                        <ul className="space-y-1.5">
                                                            {(r?.programRuleActions || []).map((a, i) => (
                                                                <li
                                                                    key={a?.id || i}
                                                                    className="rounded-md border border-slate-100 bg-slate-50/80 px-2 py-1.5 font-mono text-[11px] text-slate-700"
                                                                >
                                                                    {summarizeProgramRuleAction(a, metadata)}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </li>
                                    )
                                })}
                            </ul>
                        )
                    ) : filteredVariables.length === 0 ? (
                        <p className="px-1 py-6 text-center text-sm text-slate-500">{i18n.t('No variables match your search.')}</p>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {filteredVariables.map((v) => {
                                const vid = v?.id || v?.name
                                return (
                                    <li
                                        key={vid}
                                        className="rounded-xl border border-slate-100 bg-slate-50/40 px-3 py-2.5 shadow-sm"
                                    >
                                        <div className="text-sm font-semibold text-slate-900">
                                            {decodeBasicHtmlEntities(v?.name || vid)}
                                        </div>
                                        <div className="mt-1 space-y-0.5 text-[11px] text-slate-600">
                                            <div>
                                                <span className="font-medium text-slate-500">{i18n.t('Source')}: </span>
                                                {v?.programRuleVariableSourceType || '—'}
                                            </div>
                                            {v?.dataElement?.id ? (
                                                <div className="font-mono text-[10px] text-slate-500">DE {v.dataElement.id}</div>
                                            ) : null}
                                            {v?.trackedEntityAttribute?.id ? (
                                                <div className="font-mono text-[10px] text-slate-500">
                                                    TEA {v.trackedEntityAttribute.id}
                                                </div>
                                            ) : null}
                                            {v?.programStage?.id ? (
                                                <div>
                                                    {i18n.t('Stage')}: {stageNameById(stages, v.programStage.id)}
                                                </div>
                                            ) : null}
                                            <div className="font-mono text-[10px] text-slate-400">{v?.id}</div>
                                        </div>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>

                <div className="shrink-0 border-t border-slate-100 bg-slate-50/50 px-4 py-2.5 text-[11px] leading-snug text-slate-500">
                    {i18n.t('Press Esc to close. Rules follow server configuration; editing is in Maintenance.')}
                </div>
            </div>
        </div>,
        document.body
    )
}

function ruleSort(a, b) {
    const pa = Number(a?.priority)
    const pb = Number(b?.priority)
    const na = Number.isFinite(pa) ? pa : 999999
    const nb = Number.isFinite(pb) ? pb : 999999
    if (na !== nb) return na - nb
    return String(a?.name || a?.id || '').localeCompare(String(b?.name || b?.id || ''))
}

/** Icon-only trigger for toolbars (matches ProfileDetail stage bar sizing). */
export const ProgramRulesPanelTrigger = ({ onClick, disabled, className }) => (
    <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        title={i18n.t('Browse program rules')}
        aria-label={i18n.t('Browse program rules')}
        className={cn(
            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[color:var(--app-border)] app-surface app-text-label transition-colors outline-none hover:bg-stone-50/80 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-zinc-800',
            className
        )}
    >
        <BookOpen className="h-5 w-5" strokeWidth={2} aria-hidden />
    </button>
)
