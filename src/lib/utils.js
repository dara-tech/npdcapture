import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs) => twMerge(clsx(inputs))

/** DHIS2 / API strings sometimes ship with literal entities (e.g. `&amp;`). */
export function decodeBasicHtmlEntities(text) {
    if (text == null) return text
    if (typeof text !== 'string') return text
    return text
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#0*39;/g, "'")
        .replace(/&apos;/gi, "'")
}
