/**
 * U-UIC auto-generation (NPDB-style): last-name (2) + first-name (2) + sex digit + DD + MM + YY,
 * concatenated with no spaces, e.g. "ពហមល1301286".
 *
 * Khmer names: take ordered Khmer consonants (U+1780–U+17A2); if ≥3 consonants use 1st and 3rd,
 * else use 1st and 2nd; if only one consonant, second slot is ASCII `0`.
 */

const KHMER_CONSONANT = /[\u1780-\u17A2]/g

/** NFKC folds fullwidth Latin (common in DHIS2 display names) for reliable substring matches. */
const normKey = (s) =>
    String(s || '')
        .normalize('NFKC')
        .normalize('NFC')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()

const compactLabel = (s) => normKey(s).replace(/[\s._-]/g, '')

/** Labels used for heuristics: Maintenance `systemName` + shortName + translated `name` (see `normalizeProgramMetadata`). */
const labelParts = (a) => [a?.systemName, a?.shortName, a?.name].filter(Boolean)

const normKeyJoin = (a) => normKey(labelParts(a).join(' '))

/**
 * Display name clearly indicates a date-of-birth field (not the UUIC code attribute).
 * Prevents false UUIC match when shortName is wrongly "uuic" on a DOB TEA (seen on STI programs).
 */
const looksLikeDobTitleWithoutUuic = (a) => {
    return labelParts(a).some((raw) => {
        const n = normKey(raw)
        if (n.includes('uuic') || n.includes('u-uic')) return false
        return (
            n.includes('date of birth') ||
            n.includes('birth date') ||
            n.includes('dateofbirth') ||
            (n.includes('sti') && (n.includes('birth') || /\bdob\b/.test(n))) ||
            n.includes('birthday') ||
            n.includes('birth day') ||
            n.includes('ថ្ងៃខែឆ្នាំកំណើត') ||
            n.includes('ថ្ងៃកំណើត')
        )
    })
}

/** @param {{ id: string, name?: string, systemName?: string|null, shortName?: string|null, mandatory?: boolean }} a */
const attributeLooksLikeUuic = (a) => {
    const short = normKey(a.shortName || '')
    if (
        short === 'uuic' ||
        short === 'u-uic' ||
        short.includes('uuic') ||
        short.includes('u-uic')
    ) {
        return true
    }
    for (const raw of labelParts(a)) {
        const name = normKey(raw)
        if (
            name === 'u-uis' ||
            name === 'u-uic' ||
            name === 'uuic' ||
            name.includes('u-uic') ||
            name.includes('uuic') ||
            compactLabel(raw).includes('uuic')
        ) {
            return true
        }
    }
    return false
}

/**
 * When Maintenance uses program sections, only attributes listed on a section appear on the form.
 * Some programs still carry a legacy UUIC TEA that matches the same heuristics but is not on any
 * section — `attributes.find` would pick that id and the visible UUIC row would stay empty.
 */
const idsPlacedOnRegistrationSections = (programSections) => {
    const ids = new Set()
    for (const s of programSections || []) {
        for (const id of s.trackedEntityAttributeIds || []) {
            if (id) ids.add(id)
        }
    }
    return ids
}

/** @param {{ id: string, name?: string, systemName?: string|null, shortName?: string|null, mandatory?: boolean }} a */
const tieBreakScoreUuic = (a) => {
    let sc = 0
    const joined = normKeyJoin(a)
    const displayName = normKey(a.name)
    const short = normKey(a.shortName || '')
    if (short === 'uuic' || short === 'u-uic') sc += 320
    if (displayName.includes('លេខកូដ') && (joined.includes('uuic') || joined.includes('u-uic'))) sc += 550
    if (joined.includes('uuic') || joined.includes('u-uic')) sc += 200
    for (const raw of labelParts(a)) {
        if (compactLabel(raw).includes('uuic')) {
            sc += 120
            break
        }
    }
    if (a.mandatory) sc += 15
    return sc
}

/**
 * @param {Array<{ id: string, name?: string, systemName?: string|null, shortName?: string|null, mandatory?: boolean }>} attributes
 * @param {{ programSections?: { trackedEntityAttributeIds?: string[] }[], hiddenAttributeIds?: Set<string> }} [layoutHint]
 */
export const findUuicTrackedEntityAttributeId = (attributes, layoutHint) => {
    if (!attributes?.length) return null
    let candidates = attributes.filter(attributeLooksLikeUuic)
    const withoutDobMislabel = candidates.filter((a) => !looksLikeDobTitleWithoutUuic(a))
    if (withoutDobMislabel.length > 0) candidates = withoutDobMislabel
    const hidden = layoutHint?.hiddenAttributeIds
    if (hidden && typeof hidden.has === 'function' && hidden.size > 0) {
        const notHidden = candidates.filter((a) => !hidden.has(a.id))
        if (notHidden.length > 0) candidates = notHidden
    }
    if (candidates.length === 0) return null
    if (candidates.length === 1) return candidates[0].id

    const inForm = idsPlacedOnRegistrationSections(layoutHint?.programSections)
    let pool = [...candidates]
    if (inForm.size > 0) {
        const onForm = pool.filter((a) => inForm.has(a.id))
        if (onForm.length > 0) pool = onForm
    }

    const order = new Map(attributes.map((attr, i) => [attr.id, i]))
    pool.sort((a, b) => {
        const d = tieBreakScoreUuic(b) - tieBreakScoreUuic(a)
        if (d !== 0) return d
        return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
    })
    return pool[0]?.id ?? null
}

/**
 * Resolve source TE attribute ids for U-UIC (by display/short name heuristics).
 * @param {Array<{ id: string, name?: string, systemName?: string|null, shortName?: string|null, mandatory?: boolean }>} attributes
 * @param {{ programSections?: { trackedEntityAttributeIds?: string[] }[], hiddenAttributeIds?: Set<string> }} [layoutHint] — `programSections` disambiguates duplicate UUIC TEAs; `hiddenAttributeIds` drops rule-hidden duplicates (same TEA can be hidden in one program only).
 * @returns {{ lastName: string|null, firstName: string|null, sex: string|null, dob: string|null, uuic: string|null }}
 */
export const resolveUuicSourceAttributeIds = (attributes, layoutHint) => {
    if (!attributes?.length) {
        return { lastName: null, firstName: null, sex: null, dob: null, uuic: null }
    }

    const score = (attr, needles) => {
        const hay = normKeyJoin(attr)
        let best = 0
        for (const needle of needles) {
            const nd = normKey(needle)
            if (!nd) continue
            if (hay === nd) best = Math.max(best, 100)
            else if (hay.includes(nd)) best = Math.max(best, 50 + nd.length)
        }
        return best
    }

    const pick = (needles, excludeIds) => {
        let bestId = null
        let bestScore = 0
        for (const attr of attributes) {
            if (excludeIds.has(attr.id)) continue
            const s = score(attr, needles)
            if (s > bestScore) {
                bestScore = s
                bestId = attr.id
            }
        }
        return bestScore > 0 ? bestId : null
    }

    const used = new Set()

    const lastName = pick(
        [
            'last name',
            'lastname',
            'surname',
            'family name',
            'គោត្តនាម',
            'នាមត្រកូល',
            'ឈ្មោះត្រកូល',
            'ត្រកូល',
        ],
        used
    )
    if (lastName) used.add(lastName)

    const firstName = pick(
        ['first name', 'firstname', 'given name', 'នាមខ្លួន', 'នាម', 'ឈ្មោះខ្លួន', 'ខ្លួន'],
        used
    )
    if (firstName) used.add(firstName)

    const sex = pick(
        ['sex', 'gender', 'ភេទ', 'ភេទពីកំណើត', 'sex at birth', 'birth sex', 'natal sex'],
        used
    )
    if (sex) used.add(sex)

    const stiDobNeedles = [
        'sti date of birth',
        'sti dob',
        'date of birth (sti)',
        'birth date (sti)',
        'dob (sti)',
        'stibirth',
    ]
    let dob = pick(stiDobNeedles, used)
    if (!dob) {
        dob = pick(
            [
                'date of birth',
                'birth date',
                'dateofbirth',
                'dob',
                'birthday',
                'birth day',
                'ថ្ងៃខែឆ្នាំកំណើត',
                'ថ្ងៃកំណើត',
            ],
            used
        )
    }
    if (dob) used.add(dob)

    return {
        lastName,
        firstName,
        sex,
        dob,
        uuic: findUuicTrackedEntityAttributeId(attributes, layoutHint),
    }
}

const hasKhmer = (s) => /[\u1780-\u17FF]/.test(String(s || ''))

/** Pull Khmer consonant letters in storage order; then pick two per NPDB diagram. Single consonant → second slot is ASCII `0` (not a duplicate letter). */
export const twoCharsFromKhmerName = (name) => {
    const raw = String(name || '').normalize('NFC')
    const consonants = raw.match(KHMER_CONSONANT) || []
    let a
    let b
    if (consonants.length >= 3) {
        a = consonants[0]
        b = consonants[2]
    } else if (consonants.length === 2) {
        a = consonants[0]
        b = consonants[1]
    } else if (consonants.length === 1) {
        a = consonants[0]
        b = '0'
    } else {
        a = ' '
        b = ' '
    }
    return `${a}${b}`
}

/** Latin (or mixed): first two letters A–Z; one letter only → second slot is `0`. */
export const twoCharsFromLatinName = (name) => {
    const letters = String(name || '')
        .normalize('NFC')
        .match(/[A-Za-z]/g)
    const a = (letters?.[0] || ' ').toUpperCase()
    const b =
        letters?.[1] != null
            ? letters[1].toUpperCase()
            : letters?.[0] != null
              ? '0'
              : ' '
    return `${a}${b}`
}

export const twoCharsFromPersonName = (name) =>
    hasKhmer(name) ? twoCharsFromKhmerName(name) : twoCharsFromLatinName(name)

/**
 * @param {string} raw — stored form value (option code, option id, text, etc.)
 * @param {{ valueType?: string, optionSet?: { options?: { id?: string, code?: string, name?: string }[] } }|null} sexAttr
 */
export const sexToUuicDigit = (raw, sexAttr) => {
    if (raw === '' || raw == null) return ''

    const rawStr = String(raw).normalize('NFKC').trim()

    if (sexAttr?.valueType === 'BOOLEAN') {
        const lower = rawStr.toLowerCase()
        if (raw === true || lower === 'true') return '1'
        if (raw === false || lower === 'false') return '2'
    }

    const opt = sexAttr?.optionSet?.options?.find(
        (o) =>
            String(o.code ?? '') === rawStr ||
            String(o.id ?? '') === rawStr ||
            normKey(o.name || '') === normKey(rawStr)
    )
    const label = normKey(opt?.name || '')
    const codeK = normKey(opt?.code || '')
    if (label.includes('ស្រី') || label.includes('female') || label === 'f') return '2'
    if (label.includes('ប្រុស') || label.includes('male') || label === 'm') return '1'
    if (codeK === 'f' || codeK === 'female' || codeK === '2' || codeK.startsWith('female')) return '2'
    if (codeK === 'm' || codeK === 'male' || codeK === '1' || codeK.startsWith('male')) return '1'

    const s = rawStr.normalize('NFC')
    const lower = s.toLowerCase()

    if (s.includes('ស្រី')) return '2'
    if (s.includes('ប្រុស')) return '1'
    if (lower === 'female' || lower === 'f' || lower === '2') return '2'
    if (lower === 'male' || lower === 'm' || lower === '1') return '1'

    return ''
}

const pad2 = (n) => String(Math.min(99, Math.max(0, n))).padStart(2, '0')

/** @returns {{ dd: string, mm: string, yy: string }|null} */
export const parseDobParts = (dob) => {
    if (dob == null || dob === '') return null
    const s = String(dob).trim()
    let d
    let m
    let y

    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (iso) {
        y = parseInt(iso[1], 10)
        m = parseInt(iso[2], 10)
        d = parseInt(iso[3], 10)
    } else {
        const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
        if (slash) {
            d = parseInt(slash[1], 10)
            m = parseInt(slash[2], 10)
            y = parseInt(slash[3], 10)
        } else {
            const dash = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/)
            if (dash) {
                d = parseInt(dash[1], 10)
                m = parseInt(dash[2], 10)
                y = parseInt(dash[3], 10)
            } else {
                const d2 = new Date(s)
                if (!Number.isNaN(d2.getTime())) {
                    y = d2.getFullYear()
                    m = d2.getMonth() + 1
                    d = d2.getDate()
                }
            }
        }
    }

    if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y)) return null
    return { dd: pad2(d), mm: pad2(m), yy: String(y).slice(-2) }
}

/**
 * @param {{ lastName?: string, firstName?: string, sex?: string, dob?: string, sexAttribute?: object|null }} parts
 * @returns {string} — continuous code (no spaces); empty string if required parts missing
 */
export const formatUuic = ({ lastName, firstName, sex, dob, sexAttribute = null }) => {
    const ln = twoCharsFromPersonName(lastName)
    const fn = twoCharsFromPersonName(firstName)
    const digit = sexToUuicDigit(sex, sexAttribute)
    const dateParts = parseDobParts(dob)

    if (!dateParts || !digit) {
        return ''
    }

    return `${ln.slice(0, 2)}${fn.slice(0, 2)}${digit}${dateParts.dd}${dateParts.mm}${dateParts.yy}`
}
