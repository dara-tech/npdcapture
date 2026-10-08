/**
 * Profile tab layout: client name on one row; pair short fields so the 2-col grid has no empty halves.
 */

import { decodeBasicHtmlEntities } from '../../lib/utils'
import { profileOptionFieldSpansFullRow } from '../../lib/stageFieldRender'

/**
 * Program Maintenance sections → paper form blocks (registration + profile).
 * @param {object} metadata
 * @param {Set<string>} [hiddenFields]
 * @returns {{ mode: 'sections'|'flat', sections: Array<{id:string,title:string,description:string|null,attributes:object[]}>, flatAttributes: object[] }}
 */
export function buildProfileAttributeSections(metadata, hiddenFields = new Set()) {
    const allAttrs = metadata?.attributes || []
    if (!allAttrs.length) {
        return { mode: 'flat', sections: [], flatAttributes: [] }
    }

    const byId = new Map(allAttrs.map((a) => [a.id, a]))
    const visible = allAttrs.filter((a) => !hiddenFields.has(a.id))
    const ps = metadata?.programSections

    if (!ps?.length) {
        return { mode: 'flat', sections: [], flatAttributes: visible }
    }

    const sections = []
    for (const s of ps) {
        const attrs = (s.trackedEntityAttributeIds || [])
            .map((id) => byId.get(id))
            .filter(Boolean)
            .filter((a) => !hiddenFields.has(a.id))
        if (!attrs.length) continue
        sections.push({
            id: s.id,
            title: decodeBasicHtmlEntities(s.name || s.formName || ''),
            description: s.description
                ? decodeBasicHtmlEntities(s.description)
                : null,
            attributes: attrs,
        })
    }

    return {
        mode: sections.length ? 'sections' : 'flat',
        sections,
        flatAttributes: sections.length ? [] : visible,
    }
}

function profileAttributeSpansFullWidth(attr, { ageFieldId, dobFieldId } = {}) {
    if (!attr) return true
    if (dobFieldId && attr.id === dobFieldId) return false
    if (ageFieldId && attr.id === ageFieldId) return true
    if (profileOptionFieldSpansFullRow(attr)) return true
    return false
}

/**
 * @param {Array<{ id: string }>} attributes
 * @param {{ firstName?: string|null, lastName?: string|null }} nameIds
 * @param {{ ageFieldId?: string|null, dobFieldId?: string|null }} layoutOpts
 * @returns {Array<
 *   | { kind: 'clientName', attrs: object[] }
 *   | { kind: 'pair', attrs: [object, object] }
 *   | { kind: 'full', attr: object }
 * >}
 */
export function groupProfileAttributesForDisplay(attributes, nameIds = {}, layoutOpts = {}) {
    if (!attributes?.length) return []

    const { ageFieldId = null, dobFieldId = null } = layoutOpts
    const firstId = nameIds.firstName || null
    const lastId = nameIds.lastName || null
    const byId = new Map(attributes.map((a) => [a.id, a]))
    const first = firstId ? byId.get(firstId) : null
    const last = lastId ? byId.get(lastId) : null
    const namePairIds = first && last ? new Set([firstId, lastId]) : new Set()

    const linear = []
    let nameEmitted = false

    for (const attr of attributes) {
        if (dobFieldId && attr.id === dobFieldId && ageFieldId) continue
        if (namePairIds.has(attr.id)) {
            if (!nameEmitted) {
                const nameAttrs = last && first ? [last, first] : attributes.filter((a) => namePairIds.has(a.id))
                linear.push({
                    kind: 'clientName',
                    attrs: nameAttrs,
                })
                nameEmitted = true
            }
            continue
        }
        linear.push({ kind: 'single', attr })
    }

    const out = []
    for (let i = 0; i < linear.length; i += 1) {
        const row = linear[i]
        if (row.kind === 'clientName') {
            out.push(row)
            continue
        }

        const attr = row.attr
        if (profileAttributeSpansFullWidth(attr, layoutOpts)) {
            out.push({ kind: 'full', attr })
            continue
        }

        const next = linear[i + 1]
        if (
            next?.kind === 'single' &&
            !profileAttributeSpansFullWidth(next.attr, layoutOpts)
        ) {
            out.push({ kind: 'pair', attrs: [attr, next.attr] })
            i += 1
            continue
        }

        out.push({ kind: 'full', attr })
    }

    return out
}
