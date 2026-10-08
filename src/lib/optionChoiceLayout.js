import { cn } from './utils'
import { FORM } from './formUi'

/** Where option pills are rendered — drives responsive grid, never squeezed flex rows. */
export const OPTION_CHOICE_CONTEXT = {
    BODY: 'body',
    PAPER_INLINE: 'paper-inline',
    PAPER_TOGGLE: 'paper-toggle',
    /** Title on top, pills in one horizontal row below (3-option paper fields). */
    PAPER_BELOW_TITLE: 'paper-below-title',
    /** Narrow medicine column: horizontal scroll, equal-height pills. */
    MEDICINE_GRID: 'medicine-grid',
    /** Risk screening: horizontal answer boxes under the question. */
    QUESTIONNAIRE: 'questionnaire',
}

function gridColsForCount(count, { paperCompact = false } = {}) {
    if (count <= 1) return 'grid-cols-1'
    if (count === 2) return 'grid-cols-2'
    if (count === 3) {
        return paperCompact ? 'grid-cols-3 grid-flow-col grid-rows-1' : 'grid-cols-3 max-[520px]:grid-cols-2'
    }
    if (count === 4) return 'grid-cols-2'
    return 'grid-cols-2 lg:grid-cols-3'
}

/** Pill sizing inside one-row layouts. */
export function optionChoicePillClass(index, count, layoutContext) {
    if (layoutContext === OPTION_CHOICE_CONTEXT.QUESTIONNAIRE) {
        return 'shrink-0'
    }
    if (
        layoutContext === OPTION_CHOICE_CONTEXT.PAPER_BELOW_TITLE ||
        layoutContext === OPTION_CHOICE_CONTEXT.MEDICINE_GRID
    ) {
        return layoutContext === OPTION_CHOICE_CONTEXT.MEDICINE_GRID
            ? 'min-w-[2.75rem] shrink-0 lg:min-w-[3rem]'
            : 'w-full min-w-0 lg:flex-1'
    }
    const paperSide =
        layoutContext === OPTION_CHOICE_CONTEXT.PAPER_INLINE ||
        layoutContext === OPTION_CHOICE_CONTEXT.PAPER_TOGGLE
    if (paperSide && count >= 3) {
        return 'min-w-0 flex-1'
    }
    return undefined
}

/**
 * CSS grid for pill radios — avoids broken horizontal flex in narrow paper cells.
 */
export function resolveOptionChoiceGroupClass({
    count,
    layoutContext = OPTION_CHOICE_CONTEXT.BODY,
    twoColumn = false,
    gap,
}) {
    const n = Math.max(1, count || 1)
    const gapClass = gap || (layoutContext === OPTION_CHOICE_CONTEXT.BODY ? 'gap-1.5' : 'gap-1')
    const paperInline = layoutContext === OPTION_CHOICE_CONTEXT.PAPER_INLINE
    const paperToggle = layoutContext === OPTION_CHOICE_CONTEXT.PAPER_TOGGLE
    const paperBelowTitle = layoutContext === OPTION_CHOICE_CONTEXT.PAPER_BELOW_TITLE

    if (layoutContext === OPTION_CHOICE_CONTEXT.QUESTIONNAIRE) {
        return cn('flex w-full min-w-0 flex-wrap items-stretch', gapClass)
    }

    if (layoutContext === OPTION_CHOICE_CONTEXT.MEDICINE_GRID) {
        if (n >= 2) {
            return cn(FORM.optionPillsOneRowScroll, gapClass)
        }
        return cn(
            'grid w-full min-w-0 items-stretch',
            gapClass,
            FORM.roundedChoiceGrid,
            'grid-cols-1'
        )
    }

    if (paperBelowTitle || ((paperToggle || paperInline) && n >= 3)) {
        return cn(FORM.optionPillsOneRow, gapClass)
    }

    if (paperToggle || paperInline) {
        return cn(
            'grid w-full min-w-0 items-stretch',
            gapClass,
            FORM.roundedChoiceGrid,
            gridColsForCount(n, { paperCompact: true })
        )
    }

    if (twoColumn && n >= 3) {
        return cn('grid w-full min-w-0 items-stretch', gapClass, FORM.roundedChoiceGrid, 'grid-cols-2')
    }

    return cn(
        'grid w-full min-w-0 items-stretch',
        gapClass,
        FORM.roundedChoiceGrid,
        gridColsForCount(n)
    )
}

export function optionChoiceContextFromFieldLayout(fieldLayout) {
    if (fieldLayout === 'questionnaire-row') return OPTION_CHOICE_CONTEXT.QUESTIONNAIRE
    if (fieldLayout === 'pill-below-title') return OPTION_CHOICE_CONTEXT.PAPER_BELOW_TITLE
    if (fieldLayout === 'toggle-row') return OPTION_CHOICE_CONTEXT.PAPER_TOGGLE
    if (fieldLayout === 'inline-row') return OPTION_CHOICE_CONTEXT.PAPER_INLINE
    return OPTION_CHOICE_CONTEXT.BODY
}
