import { userDisplayLabel } from '../../../lib/userForm'

export const userInitials = (user) => {
    const label = userDisplayLabel(user)
    const parts = label.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
        return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
    }
    return label.slice(0, 2).toUpperCase() || '?'
}

export const joinMetaNames = (items, maxVisible = 1) => {
    const names = (items || [])
        .map((i) => i?.displayName || i?.name)
        .filter(Boolean)
    if (!names.length) return '—'
    if (names.length <= maxVisible) return names.join(', ')
    const shown = names.slice(0, maxVisible).join(', ')
    return `${shown} +${names.length - maxVisible}`
}

export const formatLastLogin = (user) => {
    const raw = user?.userCredentials?.lastLogin
    if (!raw) return '—'
    try {
        return new Date(raw).toLocaleString()
    } catch {
        return String(raw)
    }
}

export const avatarTone = (seed) => {
    const tones = [
        'bg-sky-100 text-sky-700',
        'bg-violet-100 text-violet-700',
        'bg-emerald-100 text-emerald-700',
        'bg-amber-100 text-amber-800',
        'bg-rose-100 text-rose-700',
    ]
    const n = String(seed || '')
        .split('')
        .reduce((a, c) => a + c.charCodeAt(0), 0)
    return tones[n % tones.length]
}
