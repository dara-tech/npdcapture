#!/usr/bin/env node
/**
 * Remove PrEP/STI/Kit/GIS rules (and optionally variables) from Prevention program ONLY.
 *
 * Scopes every API call to program gmO3xUubvMb — does not touch other programs.
 *
 * Usage (localhost):
 *   DHIS2_URL=http://localhost:8080 DHIS2_USER=sovandara DHIS2_PASS='…' \
 *     node scripts/prevention-program-rules-prune.mjs
 *
 *   node scripts/prevention-program-rules-prune.mjs --execute --confirm
 *   node scripts/prevention-program-rules-prune.mjs --execute --confirm --variables
 */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PREVENTION_PROGRAM_ID = 'gmO3xUubvMb'
const EXCLUDED_RULE = [/^(PrEP)/, /^STI/, /^Kit_/, /^GIS /]
const EXCLUDED_VAR = [/^PrEP /, /^STI_/, /^Kit_/, /^GIS /]

const base = (process.env.DHIS2_URL || 'http://localhost:8080').replace(/\/$/, '')
const user = process.env.DHIS2_USER || 'sovandara'
const pass = process.env.DHIS2_PASS || ''
const auth = Buffer.from(`${user}:${pass}`).toString('base64')
const execute =
    process.argv.includes('--execute') && process.argv.includes('--confirm')
const pruneVariables = process.argv.includes('--variables')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function api(method, path) {
    const res = await fetch(`${base}${path}`, {
        method,
        headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
    })
    if (!res.ok) {
        const t = await res.text()
        throw new Error(`${method} ${path} → ${res.status}: ${t.slice(0, 200)}`)
    }
    if (method === 'DELETE') return null
    const text = await res.text()
    return text ? JSON.parse(text) : null
}

function excluded(name, patterns) {
    return patterns.some((re) => re.test(String(name || '')))
}

/** Do NOT trust ?program= filter alone — verify program.id on each row (DHIS2 can return all rules). */
async function fetchAllRulesWithProgram() {
    const payload = await api(
        'GET',
        '/api/programRules?fields=id,name,program[id,displayName]&paging=false'
    )
    return payload.programRules || []
}

function rulesActuallyOnProgram(allRules, programId) {
    return allRules.filter((r) => {
        const pid = r.program?.id || r.program
        return String(pid) === programId
    })
}

async function fetchPreventionVariables() {
    const payload = await api(
        'GET',
        `/api/programRuleVariables?program=${PREVENTION_PROGRAM_ID}&fields=id,name,program[id]&paging=false`
    )
    const rows = payload.programRuleVariables || []
    return rows.filter(
        (v) => String(v.program?.id || v.program) === PREVENTION_PROGRAM_ID
    )
}

console.log('Prevention program rule PRUNE (other programs untouched)')
console.log('========================================================')
console.log(`Target program only: ${PREVENTION_PROGRAM_ID}`)
console.log(`Server: ${base}`)
console.log(`Mode: ${execute ? 'EXECUTE' : 'DRY-RUN'}`)
console.log('')

const instanceRules = await fetchAllRulesWithProgram()
const preventionRules = rulesActuallyOnProgram(
    instanceRules,
    PREVENTION_PROGRAM_ID
)
const otherProgramRules = instanceRules.filter(
    (r) => String(r.program?.id || r.program) !== PREVENTION_PROGRAM_ID
)

const toDropRules = preventionRules.filter((r) => excluded(r.name, EXCLUDED_RULE))
const toKeepRules = preventionRules.filter((r) => !excluded(r.name, EXCLUDED_RULE))

console.log(`Instance total rules: ${instanceRules.length}`)
console.log(`Actually on Prevention (${PREVENTION_PROGRAM_ID}): ${preventionRules.length}`)
console.log(`On other programs (will NOT touch): ${otherProgramRules.length}`)
console.log(`  will DELETE: ${toDropRules.length} (PrEP/STI/Kit/GIS)`)
console.log(`  will KEEP:   ${toKeepRules.length}`)
console.log('Keep:')
for (const r of toKeepRules) {
    console.log(`  • ${r.name}`)
}

let toDropVars = []
if (pruneVariables) {
    const allVars = await fetchPreventionVariables()
    toDropVars = allVars.filter((v) => excluded(v.name, EXCLUDED_VAR))
    const toKeepVars = allVars.length - toDropVars.length
    console.log('')
    console.log(`Prevention variables: ${allVars.length} total`)
    console.log(`  will DELETE: ${toDropVars.length}`)
    console.log(`  will KEEP:   ${toKeepVars}`)
}

if (otherProgramRules.length) {
    const byOther = new Map()
    for (const r of otherProgramRules) {
        const pid = String(r.program?.id || r.program || '?')
        const pname = r.program?.displayName || pid
        byOther.set(pid, { name: pname, count: (byOther.get(pid)?.count || 0) + 1 })
    }
    console.log('')
    console.log('Other programs (these rules will NOT be deleted):')
    for (const { name, count } of byOther.values()) {
        console.log(`  • ${name}: ${count}`)
    }
}

if (!execute) {
    console.log('\nPass --execute --confirm to delete.')
    process.exit(0)
}

console.log('\nDeleting rules from Prevention only…')
let deleted = 0
for (const r of toDropRules) {
    const pid = String(r.program?.id || r.program)
    if (pid !== PREVENTION_PROGRAM_ID) {
        console.log(`  skip (wrong program): ${r.name}`)
        continue
    }
    await api('DELETE', `/api/programRules/${r.id}`)
    deleted += 1
    if (deleted % 25 === 0) await sleep(40)
}
console.log(`  deleted ${deleted} rules`)

if (pruneVariables && toDropVars.length) {
    console.log('Deleting variables from Prevention only…')
    let dv = 0
    for (const v of toDropVars) {
        await api('DELETE', `/api/programRuleVariables/${v.id}`)
        dv += 1
        if (dv % 25 === 0) await sleep(30)
    }
    console.log(`  deleted ${dv} variables`)
}

const afterAll = await fetchAllRulesWithProgram()
const afterPrev = rulesActuallyOnProgram(afterAll, PREVENTION_PROGRAM_ID)
const afterOther = afterAll.length - afterPrev.length
console.log('')
console.log(`Prevention rules now: ${afterPrev.length}`)
console.log(`Other programs rules now: ${afterOther} (unchanged if was 0)`)
console.log(`Instance total rules now: ${afterAll.length}`)
