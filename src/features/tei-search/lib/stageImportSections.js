/** Program stage sections → data elements for import (full form, section order). */

import { khmerFieldLabelParts } from '../../../lib/stageKhmerFieldGroups'
import { normalizeImportHeaderKey as normalizeImportHeader } from './importHeaderNormalize'

export { normalizeImportHeaderKey as normalizeImportHeader } from './importHeaderNormalize'

const sectionSort = (a, b) => {
    const sa = Number(a?.sortOrder)
    const sb = Number(b?.sortOrder)
    const na = Number.isFinite(sa) ? sa : 9999
    const nb = Number.isFinite(sb) ? sb : 9999
    if (na !== nb) return na - nb
    return String(a?.id || '').localeCompare(String(b?.id || ''))
}

const DASH_SPLIT_RE = /\s*[-–—]\s*/
const NUMBERED_QUESTION_START = /^([០-៩]+|[0-9]+(?:\.[0-9]+)?)\s*[\.\-–—]/

/** Remove program stage / form title repeated in DHIS2 labels. */
export const stripStageTitleFromLabel = (label, stage) => {
    let text = String(label || '').trim()
    if (!text || !stage) return text

    const titles = [stage.displayName, stage.name, stage.shortName].filter(Boolean)

    for (const title of titles) {
        if (!title || !text.includes(title)) continue
        text = text.replace(title, '')
    }

    return text.replace(/^[\s\-—–]+/, '').replace(/[\s\-—–]+$/, '').trim()
}

const looksLikeFullFormPath = (text, stage) => {
    const s = String(text || '').trim()
    if (!s) return false
    const segments = s.split(DASH_SPLIT_RE).map((p) => p.trim()).filter(Boolean)
    if (segments.length >= 3 && NUMBERED_QUESTION_START.test(segments[segments.length - 1])) {
        return true
    }
    for (const title of [stage?.displayName, stage?.name, stage?.shortName].filter(Boolean)) {
        if (s.includes(title) && s.length > title.length + 24) return true
    }
    return false
}

/**
 * Import CSV header: question / field text only (no form title, no section name).
 * DHIS2 often stores "Form Khmer - Form English - ១. Question" on each DE.
 */
export const importDeColumnHeader = (de, stage) => {
    if (!de) return ''

    const shortCandidates = [de.systemName, de.shortName, de.code]
        .map((v) => String(v || '').trim())
        .filter(Boolean)

    for (const candidate of shortCandidates) {
        if (!looksLikeFullFormPath(candidate, stage)) return candidate
    }

    let label = String(de.displayName || de.name || de.id || '').trim()
    if (!label) return ''

    label = stripStageTitleFromLabel(label, stage)

    const segments = label.split(DASH_SPLIT_RE).map((p) => p.trim()).filter(Boolean)
    if (segments.length >= 2) {
        for (let i = segments.length - 1; i >= 0; i -= 1) {
            if (NUMBERED_QUESTION_START.test(segments[i])) {
                return segments.slice(i).join(' — ')
            }
        }
    }

    const parts = khmerFieldLabelParts(label)
    if (parts?.childNum) {
        const title = String(parts.title || '').trim()
        if (title && NUMBERED_QUESTION_START.test(title)) return title
        if (title) return `${parts.childNum}. ${title}`
    }
    if (parts?.title) return parts.title

    return label
}

export const shortSectionLabel = (section, stage) => {
    const raw =
        section?.displayName || section?.name || section?.formName || section?.id || ''
    return stripStageTitleFromLabel(raw, stage) || String(raw).trim()
}

const rawDeLabel = (de) => String(de?.displayName || de?.name || de?.shortName || de?.id || '').trim()

export const getStageSections = (stage) => {
    const sections = (stage?.programStageSections || []).slice().sort(sectionSort)
    return sections
        .map((section) => {
            const dataElementIds = (section.dataElements || [])
                .map((de) => de?.id)
                .filter(Boolean)
            if (!dataElementIds.length) return null
            const name =
                section.displayName ||
                section.name ||
                section.formName ||
                section.id
            return {
                id: section.id,
                name,
                shortName: shortSectionLabel(
                    { displayName: name, name, formName: section.formName },
                    stage
                ),
                sortOrder: section.sortOrder,
                dataElementIds,
            }
        })
        .filter(Boolean)
}

const stageDeById = (stage) => {
    const byId = new Map()
    for (const psde of stage?.programStageDataElements || []) {
        const de = psde?.dataElement
        if (de?.id) byId.set(de.id, de)
    }
    return byId
}

/**
 * All DEs in program stage sections, in section order (form layout).
 * Excludes DEs not assigned to any section.
 */
export const getStageFormColumnsForImport = (stage) => {
    if (!stage) return []

    const byId = stageDeById(stage)
    const sections = getStageSections(stage)

    if (!sections.length) {
        return [...byId.values()].map((de) => ({
            de,
            sectionId: null,
            sectionName: '',
            columnHeader: importDeColumnHeader(de, stage),
        }))
    }

    const columns = []
    const seen = new Set()

    for (const section of sections) {
        for (const deId of section.dataElementIds) {
            if (seen.has(deId)) continue
            const de = byId.get(deId)
            if (!de) continue
            seen.add(deId)
            columns.push({
                de,
                sectionId: section.id,
                sectionName: section.shortName || section.name,
                columnHeader: importDeColumnHeader(de, stage),
            })
        }
    }

    return columns
}

export const buildSectionedDeHeaderMap = (stage) => {
    const map = new Map()
    const sections = getStageSections(stage)

    const register = (header, deId) => {
        const key = normalizeImportHeader(header)
        if (key && !map.has(key)) map.set(key, deId)
    }

    for (const col of getStageFormColumnsForImport(stage)) {
        const deId = col.de.id
        register(col.columnHeader, deId)
        register(rawDeLabel(col.de), deId)
        register(importDeColumnHeader(col.de, null), deId)

        const section = sections.find((s) => s.id === col.sectionId)
        if (section) {
            register(`${section.name} — ${rawDeLabel(col.de)}`, deId)
            register(section.name, deId)
            register(shortSectionLabel({ name: section.name }, stage), deId)
        }
    }
    return map
}

export const getSectionedDeHeaderKeys = (stage) => new Set(buildSectionedDeHeaderMap(stage).keys())

export const getStageDataElementsForImport = (stage, sectionId = null) => {
    if (!stage) return []
    if (sectionId) {
        const section = getStageSections(stage).find((s) => s.id === sectionId)
        const byId = stageDeById(stage)
        if (!section) return []
        return section.dataElementIds.map((id) => byId.get(id)).filter(Boolean)
    }
    return getStageFormColumnsForImport(stage).map((c) => c.de)
}

export const buildDeHeaderMapForElements = (dataElements = []) => {
    const map = new Map()
    for (const de of dataElements) {
        if (!de?.id) continue
        const labels = [
            de.id,
            de.name,
            de.displayName,
            de.shortName,
            de.code,
            importDeColumnHeader(de, null),
        ].filter(Boolean)
        for (const label of labels) {
            const key = normalizeImportHeader(label)
            if (key && !map.has(key)) map.set(key, de.id)
        }
    }
    return map
}
