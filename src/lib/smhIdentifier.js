import { searchTrackedEntities } from '../services/trackerApi'

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Resolve the tracked entity attribute used for SMH identifiers (display name "SMH" or shortName SMH).
 */
export const findSmhTrackedEntityAttributeId = (attributes) => {
    if (!attributes?.length) return null
    const match = attributes.find((a) => {
        const blobs = [a.systemName, a.shortName, a.name, a.displayName]
            .filter(Boolean)
            .map((s) => String(s).trim().toUpperCase())
        return blobs.some((b) => b === 'SMH' || b.includes('SMH'))
    })
    return match?.id ?? null
}

/**
 * Resolve the tracked entity attribute used for PrEP Code identifiers (e.g. "PrEP Code", "លេខកូដប្រីព").
 */
export const findPrepTrackedEntityAttributeId = (attributes) => {
    if (!attributes?.length) return null
    const match = attributes.find((a) => {
        if (a?.id === 'D7xpPXd6yMl') return false
        const blobs = [a.systemName, a.shortName, a.name, a.displayName]
            .filter(Boolean)
            .map((s) => String(s).trim().toUpperCase())
        if (blobs.some((b) => b.includes('MODALITY') || b.includes('ប្រភេទ'))) return false
        return blobs.some(
            (b) =>
                b === 'PREP CODE' ||
                b === 'PREPCODE' ||
                b.includes('PREP CODE') ||
                b.includes('លេខកូដប្រីព') ||
                b === 'PREP CODE-ORIGINAL'
        )
    })
    return match?.id ?? null
}

/**
 * Resolve either SMH or PrEP Code attribute ID.
 */
export const findPrimaryTrackedEntityAttributeId = (attributes) => {
    return (
        findSmhTrackedEntityAttributeId(attributes) ||
        findPrepTrackedEntityAttributeId(attributes)
    )
}

/**
 * Production SMH pattern: `SMH` + organisation unit `code` + `-` + 6-digit sequence (000001…).
 *
 * @param {string} orgUnitCode — organisation unit `code` from DHIS2 (e.g. "2101", "9999")
 * @param {number} sequence — 0..999999 (autofill uses 1..999999 so the first client at a site is …-000001)
 * @returns {string} e.g. SMH2101-000001, SMH9999-000004
 */
export const formatSmhValue = (orgUnitCode, sequence) => {
    const code = String(orgUnitCode || '').trim()
    const s = Number(sequence)
    const n = Number.isFinite(s)
        ? Math.min(999999, Math.max(0, Math.floor(s)))
        : 1
    return `SMH${code}-${String(n).padStart(6, '0')}`
}

/**
 * Production PrEP Code pattern: `Pr` + organisation unit `code` + sequence (total 11 chars, e.g. Pr120200001).
 *
 * @param {string} orgUnitCode — organisation unit `code` from DHIS2 (e.g. "1202", "2101")
 * @param {number} sequence — sequence number (e.g. 1 -> "00001")
 * @returns {string} e.g. Pr120200001
 */
export const formatPrepValue = (orgUnitCode, sequence) => {
    const code = String(orgUnitCode || '').trim()
    const seqLen = Math.max(1, 9 - code.length) // 11 chars: 'Pr' (2) + code + seq
    const s = Number(sequence)
    const n = Number.isFinite(s) ? Math.max(1, Math.floor(s)) : 1
    return `Pr${code}${String(n).padStart(seqLen, '0')}`
}

/** @returns {number|null} sequence suffix when value matches SMH code patterns */
export const parseSmhSequence = (value, orgUnitCode) => {
    if (!value || typeof value !== 'string') return null
    const str = value.trim()
    const code = String(orgUnitCode || '').trim()

    // 1. If orgUnitCode is provided, strictly match SMH{code}-###### or SMH-{code}-###### or {code}-######
    if (code) {
        const reExact = new RegExp(`^(?:SMH[-_]?)?${escapeRegex(code)}[-_]?(\\d{1,6})$`, 'i')
        const m = str.match(reExact)
        if (m) {
            const seq = parseInt(m[1], 10)
            if (Number.isFinite(seq) && seq > 0 && seq < 1000000) return seq
        }
        return null
    }

    // 2. Generic SMH format if no orgUnitCode provided
    const reGeneric = /^SMH.*?[-\s_]?(\d{1,6})$/i
    const mGeneric = str.match(reGeneric)
    if (mGeneric) {
        const seq = parseInt(mGeneric[1], 10)
        if (Number.isFinite(seq) && seq > 0 && seq < 1000000) return seq
    }

    return null
}

/** @returns {number|null} sequence suffix when value matches PrEP code patterns */
export const parsePrepSequence = (value, orgUnitCode) => {
    if (!value || typeof value !== 'string') return null
    const str = value.trim()
    const code = String(orgUnitCode || '').trim()

    // 1. If orgUnitCode is provided: strictly match Pr{code}##### or PrEP{code}##### or Pt{code}#####
    if (code) {
        const reExact = new RegExp(`^(?:Pr|PrEP|prep|Pt|pt)?${escapeRegex(code)}[-_]?(\\d{1,6})$`, 'i')
        const m = str.match(reExact)
        if (m) {
            const seq = parseInt(m[1], 10)
            if (Number.isFinite(seq) && seq > 0 && seq < 1000000) return seq
        }
        return null
    }

    // 2. Generic Pr/PrEP format if no orgUnitCode provided
    const reGeneric = /^(?:Pr|PrEP|prep|Pt|pt)?\D*(\d{1,6})$/i
    const mGeneric = str.match(reGeneric)
    if (mGeneric) {
        const seq = parseInt(mGeneric[1], 10)
        if (Number.isFinite(seq) && seq > 0 && seq < 1000000) return seq
    }

    return null
}

export const isValidSmhForOrgUnit = (value, orgUnitCode) =>
    parseSmhSequence(value, orgUnitCode) != null

export const isValidPrepForOrgUnit = (value, orgUnitCode) =>
    parsePrepSequence(value, orgUnitCode) != null

/**
 * Highest numeric suffix among values; -1 if none parsed.
 */
export const maxSmhSequenceFromValues = (values, orgUnitCode) => {
    let max = -1
    for (const v of values) {
        const n = parseSmhSequence(v, orgUnitCode)
        if (n != null && n > max) max = n
    }
    return max
}

export const maxPrepSequenceFromValues = (values, orgUnitCode) => {
    let max = -1
    for (const v of values) {
        const n = parsePrepSequence(v, orgUnitCode)
        if (n != null && n > max) max = n
    }
    return max
}

const ouCodeCache = new Map()

export const getCachedOrgUnitCode = async (engine, orgUnitId) => {
    if (!orgUnitId) return ''
    if (ouCodeCache.has(orgUnitId)) return ouCodeCache.get(orgUnitId)
    try {
        const res = await engine.query({
            ou: {
                resource: `organisationUnits/${orgUnitId}`,
                params: { fields: ['id', 'code'] },
            },
        })
        const code = res?.ou?.code != null ? String(res.ou.code).trim() : ''
        ouCodeCache.set(orgUnitId, code)
        return code
    } catch {
        return ''
    }
}

/**
 * Next sequence number (latest + 1) for SMH{code}-###### in this program + org unit.
 * Scoped to the active program enrollment so it matches the program client sequence.
 *
 * Strategy to avoid duplicates:
 * 1. Filter by the SMH attribute prefix `SMH{code}-` to get all matching TEIs (paged, up to 500).
 * 2. Find the highest sequence number among them.
 * 3. Return highestSeq + 1.
 */
export const fetchNextSmhSequence = async ({
    engine,
    program,
    orgUnit,
    orgUnitCode,
    smhAttributeId,
}) => {
    const code = String(orgUnitCode || '').trim()
    if (!smhAttributeId || !program || !orgUnit) {
        return 1
    }

    try {
        let highestSeq = -1
        const extractFromInstances = (instances) => {
            for (const inst of instances || []) {
                const attrs = inst.attributes || []
                const row = attrs.find(
                    (a) => a.attribute === smhAttributeId || a.id === smhAttributeId
                )
                if (row?.value) {
                    const seq = parseSmhSequence(row.value, code)
                    if (seq != null && seq > 0 && seq > highestSeq) {
                        highestSeq = seq
                    }
                }
            }
        }

        // Strategy 1: Filter by SMH attribute value (e.g. SMH9999-) to fetch ALL matching records
        // Use up to 5 pages of 100 to handle facilities with many clients.
        const smhPrefix = code ? `SMH${code}-` : 'SMH'
        try {
            for (let page = 1; page <= 5; page++) {
                const { instances, pager: pg } = await searchTrackedEntities({
                    engine,
                    orgUnit,
                    program,
                    order: 'createdAt:desc',
                    page,
                    pageSize: 100,
                    paging: true,
                    ouMode: 'DESCENDANTS',
                    // Filter by the SMH attribute prefix to find only matching records
                    filters: smhAttributeId ? [{ attributeId: smhAttributeId, operator: 'like', value: smhPrefix }] : [],
                })
                extractFromInstances(instances)
                // Stop if no more pages
                if (!pg || page >= (pg.pageCount || 1)) break
            }
        } catch {
            // Filter query may fail if attribute isn't indexed — fall through to full scan
        }

        // Strategy 2: If filter didn't yield results, fall back to scanning recent 200 TEIs
        if (highestSeq <= 0) {
            for (let page = 1; page <= 4; page++) {
                const { instances, pager: pg } = await searchTrackedEntities({
                    engine,
                    orgUnit,
                    program,
                    order: 'createdAt:desc',
                    page,
                    pageSize: 50,
                    paging: true,
                    ouMode: 'SELECTED',
                })
                extractFromInstances(instances)
                if (!pg || page >= (pg.pageCount || 1)) break
            }
        }

        // Strategy 3: Also check descendants for completeness (handles multi-org unit setups)
        if (highestSeq <= 0) {
            const { instances: descInstances } = await searchTrackedEntities({
                engine,
                orgUnit,
                program,
                order: 'createdAt:desc',
                page: 1,
                pageSize: 100,
                paging: true,
                ouMode: 'DESCENDANTS',
            })
            extractFromInstances(descInstances)
        }

        if (highestSeq > 0) {
            return highestSeq + 1
        }

        return 1
    } catch (e) {
        console.warn('Error fetching next SMH sequence:', e)
        return 1
    }
}

/**
 * Next sequence number (latest + 1) for Pr{code}##### in this program + org unit.
 * Scoped to the active program enrollment so it matches the program client sequence.
 */
export const fetchNextPrepSequence = async ({
    engine,
    program,
    orgUnit,
    orgUnitCode,
    prepAttributeId,
}) => {
    const code = String(orgUnitCode || '').trim()
    if (!prepAttributeId || !program || !orgUnit) {
        return 1
    }

    try {
        let highestSeq = -1
        const extractFromInstances = (instances) => {
            for (const inst of instances || []) {
                const attrs = inst.attributes || []
                const row = attrs.find(
                    (a) => a.attribute === prepAttributeId || a.id === prepAttributeId
                )
                if (row?.value) {
                    const seq = parsePrepSequence(row.value, code)
                    if (seq != null && seq > 0 && seq > highestSeq) {
                        highestSeq = seq
                    }
                }
            }
        }

        // Query recent TEIs enrolled in this program + orgUnit (SELECTED)
        const { instances } = await searchTrackedEntities({
            engine,
            orgUnit,
            program,
            order: 'createdAt:desc',
            page: 1,
            pageSize: 50,
            paging: true,
            ouMode: 'SELECTED',
        })
        extractFromInstances(instances)

        // Fallback: check recent descendants in this program
        if (highestSeq <= 0) {
            const { instances: descInstances } = await searchTrackedEntities({
                engine,
                orgUnit,
                program,
                order: 'createdAt:desc',
                page: 1,
                pageSize: 50,
                paging: true,
                ouMode: 'DESCENDANTS',
            })
            extractFromInstances(descInstances)
        }

        if (highestSeq > 0) {
            return highestSeq + 1
        }

        return 1
    } catch (e) {
        console.warn('Error fetching next PrEP sequence:', e)
        return 1
    }
}
