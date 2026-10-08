#!/usr/bin/env node
/**
 * Restore program rules + variables from backup JSON onto LOCAL (or any) DHIS2.
 *
 * Each row is restored to its **original program** from the backup (not all forced
 * onto Prevention). This matches production layout.
 *
 * Backups (refresh from production — read-only GET):
 *   node scripts/prevention-program-rules-export-backup.mjs
 *   DHIS2_URL=https://npd.nchads.gov.kh …
 *
 * Restore localhost:
 *   DHIS2_URL=http://localhost:8080 … \
 *     node scripts/prevention-program-rules-restore.mjs --all --execute
 */

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PREVENTION_PROGRAM_ID = 'gmO3xUubvMb'
const VARS_BACKUP = join(__dirname, 'prevention-program-rules-backup-variables.json')
const RULES_BACKUP_DEFAULT = join(__dirname, 'prevention-program-rules-backup-rules.json')

const base = (process.env.DHIS2_URL || 'http://localhost:8080').replace(/\/$/, '')
const user = process.env.DHIS2_USER || 'sovandara'
const pass = process.env.DHIS2_PASS || ''
const auth = Buffer.from(`${user}:${pass}`).toString('base64')
const execute = process.argv.includes('--execute')
const variablesOnly = process.argv.includes('--variables-only')
const restoreAll = process.argv.includes('--all')

const rulesBackupArg = process.argv.includes('--rules-backup')
    ? process.argv[process.argv.indexOf('--rules-backup') + 1]
    : RULES_BACKUP_DEFAULT

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
            `${method} ${path} → ${res.status}: ${typeof data === 'string' ? data.slice(0, 300) : JSON.stringify(data).slice(0, 300)}`
        )
    }
    return data
}

async function fetchInstanceRules() {
    const payload = await api(
        'GET',
        '/api/programRules?fields=id,name,program[id]&paging=false'
    )
    return payload.programRules || []
}

async function fetchInstanceVariables() {
    const payload = await api(
        'GET',
        '/api/programRuleVariables?fields=id,name,program[id]&paging=false'
    )
    return payload.programRuleVariables || []
}

function countByProgram(rows) {
    const m = new Map()
    for (const r of rows) {
        const pid = refId(r.program) || '(none)'
        m.set(pid, (m.get(pid) || 0) + 1)
    }
    return m
}

/** TEI_ATTRIBUTE rows in backup often omit attribute id — map by variable name. */
const TEI_ATTRIBUTE_IDS_BY_VAR_NAME = {
    'Attribute last modality': 'Ct64gKSOpVQ',
    'GIS PA Hotspot Name': 'UD1QRHQ7dSO',
    'Pre hiv result status-TEI': 'T6sqn5XfL2z',
    'PrEP Code': 'flOX4pbhnUD',
    'PrEP dob': 'FmWxUZurqA8',
    'PrEP Modalities Attribute': 'Ct64gKSOpVQ',
    'PrEP sex': 'BR1fUe7Nx8V',
    'PrEP TEI attr OW': 'xwo90QYmCea',
    'PrEP UUIC': 'e5FXJFKQyuB',
    'PrEP Year DOB': 'FmWxUZurqA8',
    'Prev KP Type': 'tMRHTqExwBW',
    'STI_Attribute_Sex': 'BR1fUe7Nx8V',
    'STI_PMRS': 'SVJcO7Bczcj',
    'STI UUIC': 'e5FXJFKQyuB',
}

const DATA_ELEMENT_IDS_BY_VAR_NAME = {
    'STI_1 Medicine': 'TRVMSFH513F',
}

function variableFromBackup(v) {
    const programId = refId(v.program)
    if (!programId) throw new Error(`variable "${v.name}" missing program`)
    const row = {
        name: v.name,
        programRuleVariableSourceType: v.programRuleVariableSourceType,
        program: { id: programId },
    }
    const deId = v.dataElement?.id || DATA_ELEMENT_IDS_BY_VAR_NAME[v.name]
    if (deId) row.dataElement = { id: deId }
    const teaId =
        v.trackedEntityAttribute?.id ||
        v.attribute?.id ||
        TEI_ATTRIBUTE_IDS_BY_VAR_NAME[v.name]
    if (teaId) row.trackedEntityAttribute = { id: teaId }
    if (v.programStage?.id) row.programStage = { id: v.programStage.id }
    return row
}

function actionFromBackup(a) {
    const row = { programRuleActionType: a.programRuleActionType }
    if (a.data != null && String(a.data).trim() !== '') row.data = a.data
    if (a.content) row.content = a.content
    if (a.dataElement?.id) row.dataElement = { id: a.dataElement.id }
    if (a.trackedEntityAttribute?.id) {
        row.trackedEntityAttribute = { id: a.trackedEntityAttribute.id }
    }
    if (a.programStage?.id) row.programStage = { id: a.programStage.id }
    if (a.programStageSection?.id) {
        row.programStageSection = { id: a.programStageSection.id }
    }
    if (a.option?.id) row.option = { id: a.option.id }
    return row
}

function ruleShellFromBackup(r) {
    const programId = refId(r.program)
    if (!programId) throw new Error(`rule "${r.name}" missing program`)
    const row = {
        name: r.name,
        condition: r.condition || '',
        priority: Number(r.priority) || 1,
        program: { id: programId },
    }
    if (r.programStage?.id) row.programStage = { id: r.programStage.id }
    return row
}

const restoreVariables = variablesOnly || restoreAll
const restoreRules =
    restoreAll || (!variablesOnly && existsSync(rulesBackupArg))

let backupVars = []
let backupRules = []

if (restoreVariables) {
    if (!existsSync(VARS_BACKUP)) {
        console.error(`Missing variables backup: ${VARS_BACKUP}`)
        process.exit(1)
    }
    backupVars = JSON.parse(readFileSync(VARS_BACKUP, 'utf8')).programRuleVariables || []
}

if (restoreRules) {
    if (!existsSync(rulesBackupArg)) {
        console.error(`Missing rules backup: ${rulesBackupArg}`)
        if (!restoreVariables) process.exit(1)
    } else {
        backupRules = JSON.parse(readFileSync(rulesBackupArg, 'utf8')).programRules || []
    }
}

console.log('Program rules RESTORE (each row → its program from backup)')
console.log('============================================================')
console.log(`Target server: ${base}`)
console.log(`Mode: ${execute ? 'EXECUTE' : 'DRY-RUN'}`)
console.log(`Backup rules: ${backupRules.length}, variables: ${backupVars.length}`)
console.log(
    `Prevention program (${PREVENTION_PROGRAM_ID}) in backup: ` +
        `${backupRules.filter((r) => refId(r.program) === PREVENTION_PROGRAM_ID).length} rules, ` +
        `${backupVars.filter((v) => refId(v.program) === PREVENTION_PROGRAM_ID).length} variables`
)
console.log('')

const existingRules = await fetchInstanceRules()
const existingVars = await fetchInstanceVariables()
console.log(`Current instance: ${existingRules.length} rules, ${existingVars.length} variables`)

if (!execute) {
    console.log('\nPass --execute to apply (deletes ALL instance rules/vars first, then recreates).')
    process.exit(0)
}

if (restoreRules && backupRules.length) {
    console.log(`Deleting ${existingRules.length} existing rules…`)
    for (const r of existingRules) {
        await api('DELETE', `/api/programRules/${r.id}`)
        await sleep(15)
    }
}

if (restoreVariables && backupVars.length) {
    const varsNow = await fetchInstanceVariables()
    console.log(`Deleting ${varsNow.length} existing variables…`)
    for (const v of varsNow) {
        await api('DELETE', `/api/programRuleVariables/${v.id}`)
        await sleep(12)
    }
    console.log(`Creating ${backupVars.length} variables…`)
    let ok = 0
    let fail = 0
    for (const v of backupVars) {
        try {
            await api('POST', '/api/programRuleVariables', variableFromBackup(v))
            ok += 1
        } catch (e) {
            fail += 1
            console.log(`  skip var "${v.name}": ${e.message.slice(0, 100)}`)
        }
        await sleep(22)
    }
    console.log(`  variables: ${ok} created, ${fail} skipped`)
}

if (restoreRules && backupRules.length) {
    console.log(`Creating ${backupRules.length} rules…`)
    let ok = 0
    let fail = 0
    for (const r of backupRules) {
        try {
            const created = await api('POST', '/api/programRules', ruleShellFromBackup(r))
            const ruleId = created?.response?.uid
            if (!ruleId) throw new Error('no uid')
            for (const a of r.programRuleActions || []) {
                await api('POST', '/api/programRuleActions', {
                    ...actionFromBackup(a),
                    programRule: { id: ruleId },
                })
                await sleep(18)
            }
            ok += 1
        } catch (e) {
            fail += 1
            console.log(`  skip rule "${r.name}": ${e.message.slice(0, 100)}`)
        }
        await sleep(35)
    }
    console.log(`  rules: ${ok} created, ${fail} skipped`)
}

const afterRules = await fetchInstanceRules()
const afterVars = await fetchInstanceVariables()
const prevRules = afterRules.filter(
    (r) => refId(r.program) === PREVENTION_PROGRAM_ID
).length
const prevVars = afterVars.filter(
    (v) => refId(v.program) === PREVENTION_PROGRAM_ID
).length

console.log('')
console.log(`Done. Instance: ${afterRules.length} rules, ${afterVars.length} variables`)
console.log(`Prevention program only: ${prevRules} rules, ${prevVars} variables`)
console.log('Rules by program id:')
for (const [pid, n] of countByProgram(afterRules)) {
    console.log(`  ${n}  ${pid}`)
}
