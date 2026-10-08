#!/usr/bin/env node
/**
 * Audit Prevention program rules/variables on a DHIS2 instance.
 *
 * Usage:
 *   DHIS2_URL=http://localhost:8080 DHIS2_USER=sovandara DHIS2_PASS='Mpi@2023' \
 *     node scripts/prevention-program-rules-audit.mjs
 *
 * Optional: --json ./prevention-rules-audit.json
 */

import { writeFileSync } from 'node:fs'

const PREVENTION_PROGRAM_ID = 'gmO3xUubvMb'
const EXCLUDED_RULE = [/^(PrEP)/, /^STI/, /^Kit_/, /^GIS /]
const EXCLUDED_VAR = [/^PrEP /, /^STI_/, /^Kit_/, /^GIS /]

const url = process.env.DHIS2_URL || 'http://localhost:8080'
const user = process.env.DHIS2_USER || 'sovandara'
const pass = process.env.DHIS2_PASS || ''
const auth = Buffer.from(`${user}:${pass}`).toString('base64')

async function get(path) {
    const res = await fetch(`${url}${path}`, {
        headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
    })
    if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText} ${path}`)
    }
    return res.json()
}

function excluded(name, patterns) {
    return patterns.some((re) => re.test(String(name || '')))
}

function extractVars(rules) {
    const names = new Set()
    for (const r of rules) {
        const c = String(r.condition || '')
        for (const m of c.matchAll(/#\{([^}]+)\}/g)) names.add(m[1].trim())
        for (const m of c.matchAll(/A\{([^}]+)\}/g)) names.add(m[1].trim())
    }
    return names
}

const jsonOut = process.argv.includes('--json')
    ? process.argv[process.argv.indexOf('--json') + 1]
    : null

const [prog, rulesPayload, varsPayload] = await Promise.all([
    get(
        `/api/programs/${PREVENTION_PROGRAM_ID}?fields=id,name,displayName,programStages[id,displayName]`
    ),
    get(
        `/api/programRules?program=${PREVENTION_PROGRAM_ID}&fields=id,name,condition,programStage[id]&paging=false`
    ),
    get(
        `/api/programRuleVariables?program=${PREVENTION_PROGRAM_ID}&fields=id,name,programRuleVariableSourceType,dataElement[id],trackedEntityAttribute[id],programStage[id]&paging=false`
    ),
])

const allRules = rulesPayload.programRules || []
const allVars = varsPayload.programRuleVariables || []

const keepRules = allRules.filter((r) => !excluded(r.name, EXCLUDED_RULE))
const dropRules = allRules.filter((r) => excluded(r.name, EXCLUDED_RULE))
const usedVarNames = extractVars(keepRules)

const keepVars = allVars.filter((v) => {
    if (excluded(v.name, EXCLUDED_VAR)) return false
    if (usedVarNames.has(v.name)) return true
    if (String(v.name).startsWith('Risk_')) return true
    if (v.programRuleVariableSourceType === 'TEI_ATTRIBUTE') return true
    return false
})
const dropVars = allVars.filter((v) => !keepVars.includes(v))

const report = {
    program: {
        id: prog.id,
        name: prog.name,
        displayName: prog.displayName,
        stages: (prog.programStages || []).map((s) => ({
            id: s.id,
            displayName: s.displayName,
        })),
    },
    summary: {
        rulesTotal: allRules.length,
        rulesKeep: keepRules.length,
        rulesDrop: dropRules.length,
        variablesTotal: allVars.length,
        variablesKeep: keepVars.length,
        variablesDrop: dropVars.length,
    },
    keepRules: keepRules.map((r) => ({ id: r.id, name: r.name })),
    dropRulesByPrefix: {
        PrEP: dropRules.filter((r) => /^PrEP/.test(r.name)).length,
        STI: dropRules.filter((r) => /^STI/.test(r.name)).length,
        Kit: dropRules.filter((r) => /^Kit_/.test(r.name)).length,
        GIS: dropRules.filter((r) => /^GIS /.test(r.name)).length,
    },
    dropRuleSamples: dropRules.slice(0, 15).map((r) => r.name),
    keepVariableNames: keepVars.map((v) => v.name).sort(),
    orphanVariableNames: dropVars.map((v) => v.name).sort(),
}

console.log('Prevention program rules audit')
console.log('==========================')
console.log(`${report.program.displayName} (${report.program.id})`)
console.log(`Stages: ${report.program.stages.map((s) => s.displayName).join(', ')}`)
console.log('')
console.log(`Rules:   keep ${report.summary.rulesKeep} / drop ${report.summary.rulesDrop} (of ${report.summary.rulesTotal})`)
console.log(`         PrEP ${report.dropRulesByPrefix.PrEP}, STI ${report.dropRulesByPrefix.STI}, Kit ${report.dropRulesByPrefix.Kit}, GIS ${report.dropRulesByPrefix.GIS}`)
console.log(`Variables: keep ${report.summary.variablesKeep} / drop ${report.summary.variablesDrop} (of ${report.summary.variablesTotal})`)
console.log('')
console.log('Keep rules:')
for (const r of report.keepRules) {
    console.log(`  • ${r.name}`)
}
console.log('')
console.log('Capture now loads only keep rules/variables for this program id.')
console.log('To clean DHIS2: see capture/docs/prevention-program-rules-cleanup.md')

if (jsonOut) {
    writeFileSync(jsonOut, JSON.stringify(report, null, 2))
    console.log(`\nWrote ${jsonOut}`)
}
