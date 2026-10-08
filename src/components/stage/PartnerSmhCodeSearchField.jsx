import React, { useCallback, useMemo, useState } from 'react'
import i18n from '@dhis2/d2-i18n'
import { Search } from 'lucide-react'
import { useDataEngine } from '@dhis2/app-runtime'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Spinner } from '../ui/spinner'
import { formControlPaperSearchClasses } from '../../lib/formUi'
import { findSmhTrackedEntityAttributeId } from '../../lib/smhIdentifier'
import { fetchTei, searchTrackedEntities } from '../../services/trackerApi'
import { cn } from '../../lib/utils'
import { PartnerSmhProfileModal } from './PartnerSmhProfileModal'

/**
 * Partner SMH code: full-width input + search; opens profile modal when a TEI is found.
 */
export function PartnerSmhCodeSearchField({
    value,
    onChange,
    disabled = false,
    context,
    metadata,
    programStageId = null,
    ruleVarContext = null,
    currentTrackedEntityId = null,
}) {
    const engine = useDataEngine()
    const [searching, setSearching] = useState(false)
    const [error, setError] = useState('')
    const [foundTei, setFoundTei] = useState(null)
    const [profileOpen, setProfileOpen] = useState(false)

    const smhAttributeId = useMemo(
        () => findSmhTrackedEntityAttributeId(metadata?.attributes),
        [metadata?.attributes]
    )

    const runSearch = useCallback(async () => {
        const query = String(value ?? '').trim()
        if (!query) {
            setError(i18n.t('Enter an SMH code to search'))
            return
        }
        if (!smhAttributeId) {
            setError(i18n.t('SMH attribute is not configured for this program'))
            return
        }
        if (!context?.orgUnit || !context?.program) {
            setError(i18n.t('Organisation unit and program are required for search.'))
            return
        }

        setSearching(true)
        setError('')
        try {
            const { instances } = await searchTrackedEntities({
                engine,
                orgUnit: context.orgUnit,
                program: context.program,
                filters: [{ attributeId: smhAttributeId, value: query, operator: 'eq' }],
                page: 1,
                pageSize: 10,
                paging: true,
                ouMode: 'ACCESSIBLE',
            })

            const list = (instances || []).filter((row) => {
                const id = row.trackedEntity || row.trackedEntityInstance
                return id && id !== currentTrackedEntityId
            })
            const hit = list[0]
            if (!hit) {
                setError(i18n.t('No patient found for this SMH code'))
                setFoundTei(null)
                return
            }

            const teiId = hit.trackedEntity || hit.trackedEntityInstance
            const full = await fetchTei({
                engine,
                id: teiId,
                programId: context.program,
                fresh: true,
            })
            setFoundTei(full)
            setProfileOpen(true)
        } catch (e) {
            console.warn('Partner SMH search failed', e)
            setError(e?.message || i18n.t('Search failed'))
        } finally {
            setSearching(false)
        }
    }, [
        value,
        smhAttributeId,
        context?.orgUnit,
        context?.program,
        engine,
        currentTrackedEntityId,
    ])

    return (
        <>
            <div className="flex w-full min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-stretch sm:gap-2">
                <Input
                    value={value || ''}
                    onChange={(e) => {
                        setError('')
                        onChange?.(e.target.value)
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault()
                            runSearch()
                        }
                    }}
                    disabled={disabled || searching}
                    placeholder={i18n.t('SMH code…')}
                    className={cn(formControlPaperSearchClasses(), 'sm:flex-1')}
                    aria-label={i18n.t('Partner SMH code')}
                />
                <Button
                    type="button"
                    size="sm"
                    disabled={disabled || searching}
                    onClick={runSearch}
                    className="h-9 w-full shrink-0 gap-1.5 rounded-md bg-[var(--app-header-bar-bg)] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[var(--app-header-bar-bg)]/90 focus-visible:ring-2 focus-visible:ring-[rgba(44,102,147,0.35)] focus-visible:ring-offset-2 sm:w-auto"
                >
                    {searching ? (
                        <Spinner className="h-4 w-4 border-white/30 border-t-white" />
                    ) : (
                        <Search className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                    )}
                    {searching ? i18n.t('Searching...') : i18n.t('Search')}
                </Button>
            </div>
            {error ? (
                <p className="text-xs font-medium text-red-600" role="alert">
                    {error}
                </p>
            ) : null}
            <PartnerSmhProfileModal
                open={profileOpen}
                tei={foundTei}
                onClose={() => setProfileOpen(false)}
                metadata={metadata}
                programStageId={programStageId}
                ruleVarContext={ruleVarContext}
            />
        </>
    )
}
