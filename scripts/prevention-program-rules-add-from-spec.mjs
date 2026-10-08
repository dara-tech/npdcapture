#!/usr/bin/env node
/**
 * Add missing Prevention program rules from prevention-program-rules-spec.json.
 * Only program gmO3xUubvMb — does not delete or change other programs.
 *
 *   node scripts/prevention-program-rules-add-from-spec.mjs
 *   node scripts/prevention-program-rules-add-from-spec.mjs --execute
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SPEC_PATH = join(__dirname, 'prevention-program-rules-spec.json')
const PROGRAM_ID = 'gmO3xUubvMb'

const base = (process.env.DHIS2_URL || 'http://localhost:8080').replace(/\/$/, '')
const user = process.env.DHIS2_USER || 'sovandara'
const pass = process.env.DHIS2_PASS || ''
const auth = Buffer.from(`${user}:${pass}`).toString('base64')
const execute = process.argv.includes('--execute')

const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf8'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const refId = (ref) => {
    if (ref == null) return ''
    if (typeof ref === 'string') return ref
    return ref?.id ? String(ref.id) : ''
}

async function api(method, path, body) {
    const res = await fetch(`${base}${path}`, {
        method,
        headers: {
            Authorization: `Basic ${auth}`,
            Accept: 'application/json',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    let data = null
    if (text) {
        try {
            data = JSON.parse(text)
        } catch {
            data = text
        }
    }
    if (!res.ok) {
        throw new Error(
            `${method} ${path} → ${res.status}: ${typeof data === 'string' ? data.slice(0, 280) : JSON.stringify(data).slice(0, 280)}`
        )
    }
    return data
}

function buildVariablePayload(v) {
    const row = {
        name: v.name,
        programRuleVariableSourceType: v.sourceType,
        program: { id: PROGRAM_ID },
    }
    if (v.dataElementId) row.dataElement = { id: v.dataElementId }
    if (v.trackedEntityAttributeId) {
        row.trackedEntityAttribute = { id: v.trackedEntityAttributeId }
    }
    if (v.programStageId) row.programStage = { id: v.programStageId }
    return row
}

function buildAction(a, ruleId) {
    const row = { programRuleActionType: a.type, programRule: { id: ruleId } }
    if (a.data != null && String(a.data).trim() !== '') row.data = a.data
    if (a.dataElementId) row.dataElement = { id: a.dataElementId }
    if (a.trackedEntityAttributeId) {
        row.trackedEntityAttribute = { id: a.trackedEntityAttributeId }
    }
    if (a.programStageId) row.programStage = { id: a.programStageId }
    if (a.programStageSectionId) {
        row.programStageSection = { id: a.programStageSectionId }
    }
    if (a.optionId) row.option = { id: a.optionId }
    return row
}

function buildRuleShell(rule) {
    const row = {
        name: rule.name,
        condition: rule.condition,
        priority: Number(rule.priority) || 1,
        program: { id: PROGRAM_ID },
    }
    if (rule.programStageId) row.programStage = { id: rule.programStageId }
    return row
}

const allRules = (
    await api(
        'GET',
        '/api/programRules?fields=id,name,program[id]&paging=false'
    )
).programRules || []
const prevRules = allRules.filter((r) => refId(r.program) === PROGRAM_ID)
const existingNames = new Set(prevRules.map((r) => r.name))

const allVars = (
    await api(
        'GET',
        '/api/programRuleVariables?fields=id,name,program[id]&paging=false'
    )
).programRuleVariables || []
const prevVars = allVars.filter((v) => refId(v.program) === PROGRAM_ID)
const existingVarNames = new Set(prevVars.map((v) => v.name))

const toAddRules = (spec.rules || []).filter((r) => !existingNames.has(r.name))
const toAddVars = (spec.variables || []).filter((v) => !existingVarNames.has(v.name))

console.log('Add Prevention rules from spec')
console.log('============================')
console.log(`Server: ${base}`)
console.log(`Program: ${PROGRAM_ID} only`)
console.log(`Mode: ${execute ? 'EXECUTE' : 'DRY-RUN'}`)
console.log(`Prevention rules now: ${prevRules.length}`)
console.log(`Will add rules: ${toAddRules.length}`)
for (const r of toAddRules) console.log(`  + ${r.name}`)
console.log(`Will add variables: ${toAddVars.length}`)
for (const v of toAddVars) console.log(`  + ${v.name}`)

if (!execute) {
    console.log('\nPass --execute to create.')
    process.exit(0)
}

for (const v of toAddVars) {
    try {
        await api('POST', '/api/programRuleVariables', buildVariablePayload(v))
        console.log(`var OK ${v.name}`)
    } catch (e) {
        console.log(`var SKIP ${v.name}: ${e.message.slice(0, 80)}`)
    }
    await sleep(25)
}

let ok = 0
let fail = 0
for (const rule of toAddRules) {
    try {
        const created = await api('POST', '/api/programRules', buildRuleShell(rule))
        const ruleId = created?.response?.uid
        if (!ruleId) throw new Error('no uid')
        for (const a of rule.actions || []) {
            await api('POST', '/api/programRuleActions', buildAction(a, ruleId))
            await sleep(20)
        }
        console.log(`rule OK ${rule.name}`)
        ok += 1
    } catch (e) {
        console.log(`rule SKIP ${rule.name}: ${e.message.slice(0, 100)}`)
        fail += 1
    }
    await sleep(35)
}

const after = (
    await api(
        'GET',
        `/api/programRules?program=${PROGRAM_ID}&fields=id,name,program[id]&paging=false`
    )
).programRules || []
const afterPrev = after.filter((r) => refId(r.program) === PROGRAM_ID)
console.log('')
console.log(`Done. Added ${ok} rules (${fail} failed). Prevention rules now: ${afterPrev.length}`)
