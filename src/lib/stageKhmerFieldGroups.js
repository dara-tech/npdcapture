/**
 * Paper-form grouping inside a program stage section.
 *
 * - Section title (ក-, ខ-, គ-) = major block — shown in section header only.
 * - Inside the section: numbered children ១, ២, ៣ (from "១.…", "ខ - ២.…", etc.).
 * - Letter bands (ក / ខ / គ) inside the body only when multiple letters appear
 *   in field labels (e.g. HIV history: never / <6mo / >6mo in one section).
 */

const LETTER_RE = /^([\u1780-\u17A2])\s*[-–—]\s*(.+)$/u
const SUBGROUP_RE = /^([\u1780-\u17A2])\s*[-–—]\s*([១២៣៤៥៦៧៨៩]|[0-9]+)\s*[\.\-–—]?\s*(.*)$/u
/** `1.`, `1.1`, `១.` prefixes; also `1Urethral` when DHIS2 omits the dot. */
const NUMBERED_RE =
    /^([១២៣៤៥៦៧៨៩]|[0-9]+(?:\.[0-9]+)?)(?:\s*[\.\-–—]\s*|\s+|(?=[A-Za-z\u1780-\u17A2]))(.+)$/u

export function khmerLetterFromTitle(title) {
    const t = String(title || '').trim()
    const m = t.match(/^([\u1780-\u17A2])\s*[-–—]/u)
    return m ? m[1] : null
}

/** @returns {{ kind: 'letter'|'subgroup'|'numbered', letter?: string, childNum?: string, title: string } | null} */
export function khmerFieldLabelParts(name) {
    const label = String(name || '').trim()
    if (!label) return null

    let m = label.match(SUBGROUP_RE)
    if (m) {
        return {
            kind: 'subgroup',
            letter: m[1],
            childNum: m[2],
            title: (m[3] || label).trim(),
        }
    }

    m = label.match(LETTER_RE)
    if (m) {
        const rest = m[2].trim()
        if (!/^([១២៣៤៥៦៧៨៩]|[0-9]+)\s*[\.\-–—]/u.test(rest)) {
            return { kind: 'letter', letter: m[1], title: rest }
        }
    }

    m = label.match(NUMBERED_RE)
    if (m) {
        return { kind: 'numbered', childNum: m[1], title: (m[2] || label).trim() }
    }

    return null
}

export function stageFieldLayoutLabel(de) {
    if (!de) return ''
    return String(de.systemName || de.displayName || de.name || '').trim()
}

export function stageFieldDisplayLabelSource(de) {
    if (!de) return ''
    return String(de.displayName || de.name || '').trim()
}

/** Prefer localized label for display; systemName only for letter/numbered headers. */
export function stageFieldLayoutParts(de) {
    const localized = stageFieldDisplayLabelSource(de)
    const localizedParts = khmerFieldLabelParts(localized)
    const structural = khmerFieldLabelParts(stageFieldLayoutLabel(de))

    if (/[\u1780-\u17FF]/.test(localized)) {
        if (structural?.childNum) {
            return {
                kind: 'numbered',
                childNum: structural.childNum,
                title: localized,
            }
        }
        return localizedParts
    }

    if (localizedParts) return localizedParts
    if (!structural || structural.kind === 'subgroup') return null
    return structural
}

export function khmerFieldDisplayLabel(de, parts) {
    const localized = String(de?.displayName || de?.name || '').trim()
    if (/[\u1780-\u17FF]/.test(localized)) {
        const localizedParts = khmerFieldLabelParts(localized)
        if (localizedParts?.title) return localizedParts.title
        return localized
    }
    const localizedParts = khmerFieldLabelParts(localized)
    if (localizedParts?.title) return localizedParts.title
    if (parts?.title) return parts.title.trim()
    return localized || de?.name || ''
}

function scanSectionLabels(bodyDeIds, mergeStageDe) {
    const lettersInFields = new Set()
    let subgroupCount = 0
    let numberedCount = 0

    for (const deId of bodyDeIds || []) {
        const de = mergeStageDe(deId)
        const parts = khmerFieldLabelParts(de?.displayName || de?.name)
        if (!parts) continue
        if (parts.kind === 'letter') lettersInFields.add(parts.letter)
        if (parts.kind === 'subgroup') {
            lettersInFields.add(parts.letter)
            subgroupCount += 1
        }
        if (parts.kind === 'numbered') numberedCount += 1
    }

    return { lettersInFields, subgroupCount, numberedCount }
}

/**
 * Letter bands inside the body only when field labels define multiple letters,
 * or a single letter that is not already the section title letter.
 */
export function shouldUseLetterGroupsInBody(lettersInFields, sectionLetter) {
    if (lettersInFields.size >= 2) return true
    if (lettersInFields.size === 1) {
        const only = [...lettersInFields][0]
        if (!sectionLetter) return true
        return only !== sectionLetter
    }
    return false
}

function ensureNumberedGroup(blocks, childNum, headerDe) {
    const key = String(childNum)
    let g = blocks.find((b) => b.type === 'numbered' && b.childNum === key)
    if (!g) {
        g = { type: 'numbered', childNum: key, title: null, headerDe: null, children: [] }
        blocks.push(g)
    }
    if (headerDe) {
        g.headerDe = headerDe
        const parts = khmerFieldLabelParts(headerDe.displayName || headerDe.name)
        if (parts?.title) g.title = parts.title
    }
    return g
}

function ensureLetterGroup(blocks, letter, headerDe) {
    let g = blocks.find((b) => b.type === 'letterChoice' && b.letter === letter)
    if (!g) {
        g = {
            type: 'letterChoice',
            letter,
            title: null,
            headerDe: null,
            subgroups: [],
            trailing: [],
        }
        blocks.push(g)
    }
    if (headerDe && !g.headerDe) {
        g.headerDe = headerDe
        const parts = khmerFieldLabelParts(headerDe.displayName || headerDe.name)
        if (parts?.title) g.title = parts.title
    }
    return g
}

function ensureLetterSubgroup(letterGroup, childNum, headerDe) {
    const key = String(childNum)
    let sub = letterGroup.subgroups.find((s) => s.childNum === key)
    if (!sub) {
        sub = { childNum: key, title: null, headerDe: null, children: [] }
        letterGroup.subgroups.push(sub)
    }
    if (headerDe) {
        sub.headerDe = headerDe
        const parts = khmerFieldLabelParts(headerDe.displayName || headerDe.name)
        if (parts?.title) sub.title = parts.title
    }
    return sub
}

/**
 * @param {string[]} bodyDeIds
 * @param {(id: string) => object|undefined} mergeStageDe
 * @param {{ sectionName?: string }} [opts]
 */
export function buildKhmerPaperFieldLayout(bodyDeIds, mergeStageDe, opts = {}) {
    const sectionLetter = khmerLetterFromTitle(opts.sectionName)
    const { lettersInFields, subgroupCount, numberedCount } = scanSectionLabels(
        bodyDeIds,
        mergeStageDe
    )
    const useLetterGroups = shouldUseLetterGroupsInBody(lettersInFields, sectionLetter)
    const useNumberGroups = subgroupCount >= 1 || numberedCount >= 1

    const blocks = []
    let activeNumbered = null
    let activeLetter = null
    let activeLetterSub = null

    const closeNumbered = () => {
        activeNumbered = null
    }
    const closeLetterSub = () => {
        activeLetterSub = null
    }

    const openNumbered = (childNum, headerDe) => {
        closeNumbered()
        closeLetterSub()
        activeNumbered = ensureNumberedGroup(blocks, childNum, headerDe)
        return activeNumbered
    }

    for (const deId of bodyDeIds || []) {
        const de = mergeStageDe(deId)
        if (!de) continue
        const parts = khmerFieldLabelParts(de.displayName || de.name)

        if (parts?.kind === 'letter' && useLetterGroups) {
            closeNumbered()
            closeLetterSub()
            activeLetter = parts.letter
            ensureLetterGroup(blocks, parts.letter, de)
            activeLetterSub = null
            continue
        }

        if (parts?.kind === 'subgroup') {
            const sameAsSection = sectionLetter && parts.letter === sectionLetter
            if (useLetterGroups && !sameAsSection) {
                closeNumbered()
                activeLetter = parts.letter
                const lg = ensureLetterGroup(blocks, parts.letter)
                activeLetterSub = ensureLetterSubgroup(lg, parts.childNum, de)
            } else {
                openNumbered(parts.childNum, de)
            }
            continue
        }

        if (parts?.kind === 'numbered') {
            if (useLetterGroups && activeLetter) {
                closeNumbered()
                const lg = ensureLetterGroup(blocks, activeLetter)
                activeLetterSub = ensureLetterSubgroup(lg, parts.childNum, de)
            } else {
                openNumbered(parts.childNum, de)
            }
            continue
        }

        if (activeNumbered) {
            activeNumbered.children.push(de)
        } else if (useLetterGroups && activeLetterSub) {
            activeLetterSub.children.push(de)
        } else if (useLetterGroups && activeLetter) {
            const lg = blocks.find((b) => b.type === 'letterChoice' && b.letter === activeLetter)
            if (lg) lg.trailing.push(de)
            else blocks.push({ type: 'field', de })
        } else {
            closeNumbered()
            closeLetterSub()
            activeLetter = null
            blocks.push({ type: 'field', de })
        }
    }

    const numberedBlocks = blocks.filter((b) => b.type === 'numbered').length
    const letterBlocks = blocks.filter((b) => b.type === 'letterChoice').length
    const useGroupedLayout =
        (useNumberGroups && (numberedBlocks >= 1 || subgroupCount >= 1)) ||
        (useLetterGroups && letterBlocks >= 1)

    return {
        useGroupedLayout,
        useLetterGroups,
        sectionLetter,
        blocks,
    }
}

export function sectionUsesKhmerLetterGroups(bodyDeIds, mergeStageDe, sectionName) {
    const layout = buildKhmerPaperFieldLayout(bodyDeIds, mergeStageDe, { sectionName })
    return layout.useGroupedLayout
}
