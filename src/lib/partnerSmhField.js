const norm = (s) =>
    String(s || '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/\s+/g, ' ')

/**
 * Program-stage DE for entering a partner's SMH code (linked patient lookup).
 * Matches labels like "លេខកូដ SMH ដៃគូ" / "Partner SMH code".
 */
export function isPartnerSmhCodeStageField(de) {
    if (!de) return false
    if (de.valueType !== 'TEXT' && de.valueType !== 'NUMBER') return false
    const joined = norm([de.name, de.displayName, de.shortName].filter(Boolean).join(' '))
    const hasSmh = joined.includes('smh')
    const hasPartner =
        joined.includes('partner') ||
        joined.includes('ដៃគូ') ||
        joined.includes('couple') ||
        joined.includes('spouse')
    if (hasSmh && hasPartner) return true
    return joined.includes('smh partner') || joined.includes('partner smh')
}
