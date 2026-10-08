/**
 * Optional allowlist from app config (`indicatorProgramIds`: comma-separated UIDs).
 */
export const parseIndicatorProgramAllowlist = (raw) => {
    if (!raw || typeof raw !== 'string') return []
    return raw
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
}

export const filterIndicatorPrograms = (programs, allowlist) => {
    if (!Array.isArray(programs)) return []
    if (!allowlist?.length) return programs
    const allowed = new Set(allowlist)
    return programs.filter((p) => p?.id && allowed.has(p.id))
}
