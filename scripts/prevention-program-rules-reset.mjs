#!/usr/bin/env node
/**
 * Reset Prevention program rules + variables from scripts/prevention-program-rules-spec.json
 *
 * Deletes ALL existing rules/variables on the program, then recreates the clean set (15 rules, 23 variables).
 *
 * Usage:
 *   DHIS2_URL=http://localhost:8080 DHIS2_USER=sovandara DHIS2_PASS='…' \
 *     node scripts/prevention-program-rules-reset.mjs          # dry-run
 *
 *   DHIS2_URL=http://localhost:8080 DHIS2_USER=sovandara DHIS2_PASS='…' \
 *     node scripts/prevention-program-rules-reset.mjs --execute
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SPEC_PATH = join(__dirname, 'prevention-program-rules-spec.json')

const base = (process.env.DHIS2_URL || 'http://localhost:8080').replace(/\/$/, '')
const user = process.env.DHIS2_USER || 'sovandara'
const pass = process.env.DHIS2_PASS || ''
const auth = Buffer.from(`${user}:${pass}`).toString('base64')
const execute =
    process.argv.includes('--execute') &&
    process.argv.includes('--confirm-delete')

const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf8'))
const programId = spec.programId

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
            `${method} ${path} → ${res.status}: ${typeof data === 'string' ? data.slice(0, 300) : JSON.stringify(data).slice(0, 300)}`
        )
    }
    return data
}

async function fetchAllRules() {
    const payload = await api(
        'GET',
        `/api/programRules?program=${programId}&fields=id,name&paging=false`
    )
    return payload.programRules || []
}

async function fetchAllVariables() {
    const payload = await api(
        'GET',
        `/api/programRuleVariables?program=${programId}&fields=id,name&paging=false`
    )
    return payload.programRuleVariables || []
}

function buildVariablePayload(v) {
    const row = {
        name: v.name,
        programRuleVariableSourceType: v.sourceType,
        program: { id: programId },
    }
    if (v.dataElementId) row.dataElement = { id: v.dataElementId }
    if (v.trackedEntityAttributeId) {
        row.trackedEntityAttribute = { id: v.trackedEntityAttributeId }
    }
    if (v.programStageId) row.programStage = { id: v.programStageId }
    return row
}

function buildActionPayload(a) {
    const row = { programRuleActionType: a.type }
    if (a.data != null && a.data !== '') row.data = a.data
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

function buildRulePayload(rule) {
    const payload = {
        name: rule.name,
        condition: rule.condition,
        priority: Number(rule.priority) || 1,
        program: { id: programId },
    }
    if (rule.programStageId) {
        payload.programStage = { id: rule.programStageId }
    }
    return payload
}

function buildActionPayloadForRule(ruleId, a) {
    return {
        ...buildActionPayload(a),
        programRule: { id: ruleId },
    }
}

// Dedupe variables by name
const variablesByName = new Map()
for (const v of spec.variables || []) {
    if (!variablesByName.has(v.name)) variablesByName.set(v.name, v)
}
const variables = [...variablesByName.values()]
const rules = spec.rules || []

console.log('Prevention program rules RESET')
console.log('==============================')
console.log(`Program: ${programId}`)
console.log(`Spec: ${variables.length} variables, ${rules.length} rules`)
console.log(`Mode: ${execute ? 'EXECUTE (destructive)' : 'DRY-RUN'}`)
console.log('')

const existingRules = await fetchAllRules()
const existingVars = await fetchAllVariables()

console.log(`Existing on server: ${existingRules.length} rules, ${existingVars.length} variables`)
console.log(`Will delete: all ${existingRules.length} rules, all ${existingVars.length} variables`)
console.log(`Will create: ${variables.length} variables, ${rules.length} rules`)
console.log('')

if (!execute) {
    console.log('Pass --execute --confirm-delete to apply changes.')
    process.exit(0)
}

console.log('Deleting rules…')
let deletedRules = 0
for (const r of existingRules) {
    await api('DELETE', `/api/programRules/${r.id}`)
    deletedRules += 1
    if (deletedRules % 20 === 0) await sleep(50)
}
console.log(`  deleted ${deletedRules} rules`)

console.log('Deleting variables…')
let deletedVars = 0
for (const v of existingVars) {
    await api('DELETE', `/api/programRuleVariables/${v.id}`)
    deletedVars += 1
    if (deletedVars % 20 === 0) await sleep(50)
}
console.log(`  deleted ${deletedVars} variables`)

console.log('Creating variables…')
let createdVars = 0
for (const v of variables) {
    await api('POST', '/api/programRuleVariables', buildVariablePayload(v))
    createdVars += 1
    await sleep(30)
}
console.log(`  created ${createdVars} variables`)

console.log('Creating rules (shell + actions)…')
let createdRules = 0
let createdActions = 0
for (const rule of rules) {
    const created = await api('POST', '/api/programRules', buildRulePayload(rule))
    const ruleId = created?.response?.uid
    if (!ruleId) {
        throw new Error(`No uid returned for rule "${rule.name}"`)
    }
    createdRules += 1
    for (const a of rule.actions || []) {
        await api(
            'POST',
            '/api/programRuleActions',
            buildActionPayloadForRule(ruleId, a)
        )
        createdActions += 1
        await sleep(30)
    }
    await sleep(40)
}
console.log(`  created ${createdRules} rules, ${createdActions} actions`)

const afterRules = await fetchAllRules()
const afterVars = await fetchAllVariables()
console.log('')
console.log('Done.')
console.log(`Server now: ${afterRules.length} rules, ${afterVars.length} variables`)
console.log('Re-open Capture and test Prevention Form + Risk assessment tabs.')
