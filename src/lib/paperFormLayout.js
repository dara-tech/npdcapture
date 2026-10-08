import { resolveStageOptionDisplayLabel } from './stageFieldLabelI18n'

/** @typedef {'inline' | 'stack' | 'two-column' | 'four-column'} PaperOptionLayout */

function optionLabels(options) {
    return options.map((o) => String(resolveStageOptionDisplayLabel(o) || ''))
}

function labelsAreShort(labels) {
    if (!labels.length) return false
    const maxLen = Math.max(...labels.map((l) => l.length), 0)
    return maxLen <= 12
}

/** Yes / No / — only: keep ○ on one row, not a 4-col grid. */
function isYesNoLike(options) {
    if (options.length > 4) return false
    const codes = options.map((o) =>
        String(o.code ?? o.value ?? '')
            .toLowerCase()
            .trim()
    )
    if (codes.includes('true') && codes.includes('false')) return true
    return options.length <= 2
}

/** Short labels (e.g. VCCT, ART, PCR) — 4 columns on paper forms only if truly short. */
function labelsFitFourColumns(labels) {
    const n = labels.length
    if (n < 4 || !labelsAreShort(labels)) return false
    const maxLen = Math.max(...labels.map((l) => l.length), 0)
    return maxLen <= 10
}

function isMultiVariant(variant) {
    return variant === 'VERTICAL_MULTI' || variant === 'HORIZONTAL_MULTI'
}

/**
 * Paper form: Yes/No inline; short lists in 4 cols; longer in 2 cols.
 * @param {object[]} options
 * @param {{ minTwoColumn?: number, variant?: string }} [opts]
 * @returns {PaperOptionLayout}
 */
export function resolvePaperRadioLayout(options = [], { minTwoColumn = 5, variant = null } = {}) {
    const count = options.length
    if (count === 0) return 'stack'

    const labels = optionLabels(options)
    const maxLen = Math.max(...labels.map((l) => l.length), 0)
    const multi = isMultiVariant(variant)

    if (isYesNoLike(options)) {
        return 'inline'
    }

    if (labelsFitFourColumns(labels)) {
        return 'four-column'
    }

    if (multi && count >= 3 && labelsAreShort(labels)) {
        return 'four-column'
    }

    if (!multi && count <= 4 && labelsAreShort(labels)) {
        return 'inline'
    }

    if (variant === 'HORIZONTAL_RADIO' && count >= 3) {
        return 'two-column'
    }

    if (count >= minTwoColumn) {
        return labelsAreShort(labels) && maxLen <= 12 ? 'four-column' : 'two-column'
    }

    if (count >= 4 && maxLen > 12) {
        return 'two-column'
    }

    return 'stack'
}

/** All paper stage forms: # | question | answer table (one row per item). */
export function usePaperSectionTableLayout(programStageId) {
    return Boolean(programStageId)
}
