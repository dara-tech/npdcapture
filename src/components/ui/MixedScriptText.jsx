import React from 'react'
import { cn } from '../../lib/utils'

const KHMER_CHAR_RE = /[\u1780-\u17FF\u17B6-\u17C6]/

function classifyChar(ch) {
    if (KHMER_CHAR_RE.test(ch)) return 'khmer'
    if (/[0-9]/.test(ch)) return 'digit'
    return 'latin'
}

export function splitMixedScriptRuns(text) {
    const s = String(text ?? '')
    if (!s) return []
    const runs = []
    let i = 0
    while (i < s.length) {
        const type = classifyChar(s[i])
        let j = i + 1
        while (j < s.length && classifyChar(s[j]) === type) j++
        runs.push({ type, text: s.slice(i, j) })
        i = j
    }
    return runs
}

export function needsMixedScriptRendering(text) {
    const s = String(text ?? '')
    return KHMER_CHAR_RE.test(s) && (/[0-9]/.test(s) || /[A-Za-z]/.test(s))
}

/**
 * Renders Khmer mixed with Latin letters or digits at a consistent visual size.
 */
export function MixedScriptText({ value, className, emptyClassName }) {
    const s =
        value === null || value === undefined || String(value).trim() === ''
            ? '-'
            : String(value)

    if (s === '-') {
        return <span className={cn('capture-font', emptyClassName || className)}>{s}</span>
    }

    if (!needsMixedScriptRendering(s)) {
        return <span className={cn('capture-font', className)}>{s}</span>
    }

    const runs = splitMixedScriptRuns(s)

    return (
        <span className={cn('mixed-script-text capture-font', className)}>
            {runs.map((run, idx) => (
                <span
                    key={`${idx}-${run.type}`}
                    className={
                        run.type === 'khmer'
                            ? 'mixed-script-khmer'
                            : run.type === 'digit'
                              ? 'mixed-script-digits'
                              : undefined
                    }
                >
                    {run.text}
                </span>
            ))}
        </span>
    )
}
