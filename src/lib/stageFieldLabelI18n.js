import i18n from '@dhis2/d2-i18n'
import { booleanOptionDisplayLabel } from './paperFormBoolean'
import { isPartnerSmhCodeStageField } from './partnerSmhField'
import {
    khmerFieldLabelParts,
    stageFieldDisplayLabelSource,
    stageFieldLayoutLabel,
} from './stageKhmerFieldGroups'

const KHMER_RE = /[\u1780-\u17FF]/
const LEADING_INDEX_RE = /^([១២៣៤៥៦៧៨៩]|[0-9]+(?:\.[0-9]+)?)\s*[\.\-–—]?\s*/u

/** Strip list index prefix from DHIS2 names but preserve x.y formats like 6.1Diagnosis */
export function stripLeadingListIndex(text) {
    const str = String(text || '').trim()
    if (/^[0-9]+\.[0-9]+/.test(str)) {
        return str
    }
    return str.replace(LEADING_INDEX_RE, '').trim()
}

export function isKhmerLabelText(text) {
    return KHMER_RE.test(String(text || ''))
}

/** Translate a stable English maintenance label when a catalog entry exists. */
export function translateStageLabelKey(key) {
    const k = String(key || '').trim()
    if (!k) return k
    const translated = i18n.t(k)
    return translated !== k ? translated : k
}

/**
 * Row label for program-stage DEs: Khmer from API, English via i18n catalog, never English
 * structural title when API already returned Khmer.
 */
export function resolveStageFieldDisplayLabel(de, parts = null) {
    if (!de) return ''
    if (isPartnerSmhCodeStageField(de)) {
        return i18n.t('Partner SMH code')
    }

    const localized = String(stageFieldDisplayLabelSource(de) || '').trim()
    if (isKhmerLabelText(localized)) {
        return localized
    }

    const fromParts = String(parts?.title || '').trim()
    const strippedLocalized = stripLeadingListIndex(localized)
    const system = stripLeadingListIndex(stageFieldLayoutLabel(de))

    for (const key of [fromParts, strippedLocalized, system]) {
        if (!key) continue
        const translated = translateStageLabelKey(key)
        if (translated !== key) return translated
    }

    return fromParts || strippedLocalized || localized || de.name || ''
}

/** Option / checklist cell label. */
export function resolveStageOptionDisplayLabel(opt) {
    if (!opt) return ''
    const boolLabel = booleanOptionDisplayLabel(opt)
    if (boolLabel) return boolLabel
    const name = String(
        opt.displayName || opt.name || opt.systemName || opt.code || opt.id || ''
    ).trim()
    if (!name) return ''
    if (isKhmerLabelText(name)) return name
    const stripped = stripLeadingListIndex(name)
    const translated = translateStageLabelKey(stripped)
    return translated !== stripped ? translated : name
}

export { khmerFieldLabelParts }
