import React from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import i18n from '@dhis2/d2-i18n'
import { FORM } from '../../lib/formUi'
import { formatSectionHeaderDisplay } from '../../lib/stageSectionProgress'
import { cn, decodeBasicHtmlEntities } from '../../lib/utils'

const stopHeaderToggle = (event) => {
    event.stopPropagation()
}

/**
 * One program stage section. Default: always open, simple title (no step chrome).
 */
export function StageFormSection({
    section,
    progressStatus = 'empty',
    requiredRemaining = 0,
    collapsed = false,
    onToggleCollapse,
    collapsible = false,
    isActive = false,
    inPaperSection = false,
    paperFormMode = false,
    paperSelectedCount = 0,
    sectionCardClass,
    sectionHeaderClass,
    hasBooleanGate,
    gateDe,
    gateOpen,
    renderGateControl,
    renderBody,
    footer,
    headerActions,
}) {
    const header = formatSectionHeaderDisplay(section.name)
    const isCollapsed = collapsible && collapsed
    const showBodyContent = !isCollapsed && (!hasBooleanGate || gateOpen)
    const showGateInHeader = Boolean(hasBooleanGate && gateDe)
    const fullTitle = decodeBasicHtmlEntities(header.fullTitle || section.name)
    const tooltipTitle =
        fullTitle.length > 60 ? fullTitle : undefined

    const showRequiredHint = requiredRemaining > 0
    const showSelectedHint =
        inPaperSection && paperSelectedCount > 0 && !showRequiredHint

    /** Long titles: keep ទេ / បាទ on one row below the title, not stacked in a side column. */
    const gateBelowTitle =
        showGateInHeader &&
        (fullTitle.length > 42 ||
            String(header.displayTitle || header.primary || '').length > 42)

    const titleText = (
        <>
            <p
                className={cn(
                    paperFormMode ? FORM.paperFormSectionTitle : FORM.sectionBarTitle,
                    'leading-snug [overflow-wrap:anywhere]'
                )}
            >
                {decodeBasicHtmlEntities(
                    header.displayTitle || header.fullTitle || header.primary
                )}
            </p>
            {showRequiredHint ? (
                <p className="mt-0.5 text-xs font-medium text-amber-700">
                    {i18n.t('{{count}} required left', { count: requiredRemaining })}
                </p>
            ) : showSelectedHint ? (
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                    {i18n.t('{{count}} selected', { count: paperSelectedCount })}
                </p>
            ) : null}
        </>
    )

    const gateShell = showGateInHeader ? (
        <div
            className={cn(
                gateBelowTitle
                    ? cn(
                          FORM.sectionHeaderGate,
                          'w-full basis-full border-l-0 sm:border-l-0'
                      )
                    : 'flex shrink-0 items-center self-center border-0 px-0 py-0',
                !gateBelowTitle && gateOpen && FORM.sectionHeaderGateOpen,
                !gateBelowTitle && !gateOpen && FORM.sectionHeaderGateLocked,
                gateBelowTitle && !gateOpen && FORM.sectionHeaderGateLocked,
                gateBelowTitle && gateOpen && FORM.sectionHeaderGateOpen,
                progressStatus === 'complete' && FORM.sectionHeaderGateComplete
            )}
            role="group"
            aria-label={gateDe.displayName || gateDe.name}
            onClick={stopHeaderToggle}
            onPointerDown={stopHeaderToggle}
            onKeyDown={stopHeaderToggle}
        >
            {renderGateControl()}
        </div>
    ) : null

    const headerRowInner = (
        <div
            className={cn(
                'flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2',
                gateBelowTitle && 'w-full basis-full'
            )}
        >
            <div className="min-w-0 max-w-full">{titleText}</div>
            {!gateBelowTitle ? gateShell : null}
        </div>
    )

    return (
        <div
            id={`stage-section-${section.id}`}
            className={cn(
                sectionCardClass,
                'scroll-mt-28 overflow-hidden',
                paperFormMode && 'paper-form-ui'
            )}
        >
            <div
                className={cn(
                    sectionHeaderClass,
                    'flex flex-wrap items-start gap-2'
                )}
            >
                {collapsible ? (
                    <button
                        type="button"
                        className={cn(
                            'flex min-w-0 flex-1 cursor-pointer items-start gap-2 text-left transition-colors hover:bg-slate-50/90 dark:hover:bg-zinc-800/80',
                            gateBelowTitle && 'w-full basis-full'
                        )}
                        onClick={onToggleCollapse}
                        aria-expanded={!isCollapsed}
                        aria-label={fullTitle}
                        title={tooltipTitle}
                    >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center text-slate-400">
                            {isCollapsed ? (
                                <ChevronRight className="h-5 w-5" strokeWidth={2} aria-hidden />
                            ) : (
                                <ChevronDown className="h-5 w-5" strokeWidth={2} aria-hidden />
                            )}
                        </span>
                        {headerRowInner}
                    </button>
                ) : (
                    <div
                        className={cn(
                            'flex min-w-0 flex-1 flex-wrap items-start gap-2',
                            gateBelowTitle && 'w-full'
                        )}
                        title={tooltipTitle}
                    >
                        {headerRowInner}
                    </div>
                )}

                {gateBelowTitle ? gateShell : null}

                {headerActions ? (
                    <div
                        className="flex shrink-0 items-center self-center px-3 sm:px-4"
                        onClick={stopHeaderToggle}
                        onPointerDown={stopHeaderToggle}
                        onKeyDown={stopHeaderToggle}
                    >
                        {headerActions}
                    </div>
                ) : null}
            </div>

            {showBodyContent ? renderBody() : null}

            {!isCollapsed ? footer : null}
        </div>
    )
}
