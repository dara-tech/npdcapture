#!/usr/bin/env node
/**
 * Export full Prevention program rules + variables (for backup / restore).
 *
 *   DHIS2_URL=https://your-server DHIS2_USER=… DHIS2_PASS=… \
 *     node scripts/prevention-program-rules-export-backup.mjs
 *
 * Writes:
 *   scripts/prevention-program-rules-backup-rules.json
 *   scripts/prevention-program-rules-backup-variables.json
 */

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROGRAM_ID = 'gmO3xUubvMb'
const base = (process.env.DHIS2_URL || 'http://localhost:8080').replace(/\/$/, '')
const user = process.env.DHIS2_USER || 'sovandara'
const pass = process.env.DHIS2_PASS || ''
const auth = Buffer.from(`${user}:${pass}`).toString('base64')
const h = { Authorization: `Basic ${auth}`, Accept: 'application/json' }

const ruleFields = [
    'id,name,displayName,condition,priority,description',
    'program[id,displayName]',
    'programStage[id]',
    'programRuleActions[id,programRuleActionType,data,content,location',
    'dataElement[id],trackedEntityAttribute[id],programStage[id]',
    'programStageSection[id],option[id],optionGroup[id]]',
].join(',')

const varFields = [
    'id,name,displayName,description',
    'program[id,displayName]',
    'programRuleVariableSourceType',
    'dataElement[id],trackedEntityAttribute[id],attribute[id],programStage[id]',
].join(',')

async function get(path) {
    const res = await fetch(`${base}${path}`, { headers: h })
    if (!res.ok) throw new Error(`${res.status} ${path}`)
    return res.json()
}

/** Export entire instance; filter by program.id in backup (API ?program= is unreliable). */
const [rulesPayload, varsPayload] = await Promise.all([
    get(`/api/programRules?fields=${encodeURIComponent(ruleFields)}&paging=false`),
    get(`/api/programRuleVariables?fields=${encodeURIComponent(varFields)}&paging=false`),
])

const rulesOut = join(__dirname, 'prevention-program-rules-backup-rules.json')
const varsOut = join(__dirname, 'prevention-program-rules-backup-variables.json')

writeFileSync(rulesOut, JSON.stringify({ programRules: rulesPayload.programRules || [] }, null, 2))
writeFileSync(varsOut, JSON.stringify({ programRuleVariables: varsPayload.programRuleVariables || [] }, null, 2))

console.log(`Exported ${(rulesPayload.programRules || []).length} rules → ${rulesOut}`)
console.log(`Exported ${(varsPayload.programRuleVariables || []).length} variables → ${varsOut}`)
