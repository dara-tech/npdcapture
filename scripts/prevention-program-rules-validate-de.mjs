#!/usr/bin/env node
/**
 * Validate Prevention program rules/variables against data elements on each stage.
 * Run before creating or importing rules.
 *
 *   DHIS2_URL=http://localhost:8080 DHIS2_USER=… DHIS2_PASS=… \
 *     node scripts/prevention-program-rules-validate-de.mjs
 */

const PROGRAM_ID = 'gmO3xUubvMb'
const STAGES = {
    preventionForm: 'mX4OjpyZw3A',
    riskAssessment: 'hqJKFmOU6s7',
}

const base = (process.env.DHIS2_URL || 'http://localhost:8080').replace(/\/$/, '')
const user = process.env.DHIS2_USER || 'sovandara'
const pass = process.env.DHIS2_PASS || ''
const auth = Buffer.from(`${user}:${pass}`).toString('base64')
const h = { Authorization: `Basic ${auth}`, Accept: 'application/json' }

const refId = (ref) =>
    ref == null ? '' : typeof ref === 'string' ? ref : ref?.id ? String(ref.id) : ''

async function get(path) {
    const res = await fetch(`${base}${path}`, { headers: h })
    if (!res.ok) throw new Error(`${res.status} ${path}`)
    return res.json()
}

const stageDe = {}
for (const [key, stageId] of Object.entries(STAGES)) {
    const st = await get(
        `/api/programStages/${stageId}?fields=displayName,programStageDataElements[dataElement[id,name]]`
    )
    stageDe[stageId] = new Map(
        (st.programStageDataElements || []).map((x) => [
            x.dataElement.id,
            x.dataElement.name || x.dataElement.id,
        ])
    )
    console.log(
        `${st.displayName || key} (${stageId}): ${stageDe[stageId].size} data elements`
    )
}

const allDe = new Set()
for (const m of Object.values(stageDe)) {
    for (const id of m.keys()) allDe.add(id)
}

function onStage(deId, ruleStageId) {
    if (!deId) return { ok: true, note: 'no DE' }
    if (ruleStageId && stageDe[ruleStageId]?.has(deId)) {
        return { ok: true, note: ruleStageId }
    }
    if (allDe.has(deId)) {
        return { ok: true, note: 'other stage in program' }
    }
    return { ok: false, note: 'NOT ON PROGRAM STAGES' }
}

const rules = (await get(
    '/api/programRules?fields=id,name,program[id],programStage[id],programRuleActions[programRuleActionType,dataElement[id,name]]&paging=false'
)).programRules.filter((r) => refId(r.program) === PROGRAM_ID)

const vars = (await get(
    '/api/programRuleVariables?fields=id,name,program[id],programStage[id],dataElement[id,name]&paging=false'
)).programRuleVariables.filter((v) => refId(v.program) === PROGRAM_ID)

console.log(`\nPrevention rules: ${rules.length}`)
let ruleBad = 0
for (const r of rules.sort((a, b) => a.name.localeCompare(b.name))) {
    const ruleStage = refId(r.programStage)
    const bad = []
    for (const a of r.programRuleActions || []) {
        const deId = refId(a.dataElement)
        if (!deId) continue
        const check = onStage(deId, ruleStage)
        if (!check.ok) {
            bad.push(`${a.programRuleActionType} → ${deId} (${a.dataElement?.name})`)
        }
    }
    if (bad.length) {
        ruleBad += 1
        console.log(`  ✗ ${r.name}`)
        bad.forEach((b) => console.log(`      ${b}`))
    } else {
        const n = (r.programRuleActions || []).length
        console.log(`  ✓ ${r.name} (${n} actions)`)
    }
}

console.log(`\nPrevention variables (DE only): ${vars.filter((v) => v.dataElement).length}`)
let varBad = 0
for (const v of vars.sort((a, b) => a.name.localeCompare(b.name))) {
    const deId = refId(v.dataElement)
    if (!deId) continue
    const check = onStage(deId, refId(v.programStage))
    if (!check.ok) {
        varBad += 1
        console.log(`  ✗ ${v.name} → ${deId} (${v.dataElement?.name})`)
    }
}

console.log('\n---')
console.log(
    ruleBad || varBad
        ? `Issues: ${ruleBad} rule(s), ${varBad} variable(s) reference DEs not on Prevention stages. Fix form or update rules before they will work in Capture.`
        : 'All rule/variable data elements exist on program stages.'
)
