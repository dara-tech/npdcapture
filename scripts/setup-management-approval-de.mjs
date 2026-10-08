#!/usr/bin/env node
/**
 * Create Management approval status/comment DEs on DHIS2 and link to program stages.
 *
 *   DHIS2_URL=http://localhost:8080 DHIS2_USER=sovandara DHIS2_PASS='…' \
 *     node scripts/setup-management-approval-de.mjs
 */
const baseUrl = (process.env.DHIS2_URL || 'http://localhost:8080').replace(/\/$/, '')
const user = process.env.DHIS2_USER || 'sovandara'
const pass = process.env.DHIS2_PASS || process.env.DHIS2_PASSWORD || ''

if (!pass) {
    console.error('Set DHIS2_PASS')
    process.exit(1)
}

const auth = Buffer.from(`${user}:${pass}`).toString('base64')
const headers = { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` }

const STAGES = [
    { id: 'oj7dKrmA8eg', name: 'STI Diagnosis & Treatment' },
    { id: 'mX4OjpyZw3A', name: 'Prevention Form' },
    { id: 'hqJKFmOU6s7', name: 'Risk Behavior Screening Tool' },
]

async function request(method, path, body) {
    const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body != null ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    let json
    try {
        json = JSON.parse(text)
    } catch {
        json = { raw: text }
    }
    if (!res.ok) {
        throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 300)}`)
    }
    return json
}

async function ensureOptionSet() {
    const existing = await request(
        'GET',
        '/api/optionSets?filter=name:eq:Management%20approval%20status&fields=id,name&paging=false'
    )
    const hit = existing.optionSets?.[0]
    if (hit?.id) {
        console.log('Option set exists:', hit.id)
        return hit.id
    }
    const created = await request('POST', '/api/optionSets', {
        name: 'Management approval status',
        shortName: 'Mgmt approval',
        valueType: 'TEXT',
    })
    const osId = created.response.uid
    for (const [code, name, sortOrder] of [
        ['DRAFT', 'Draft', 1],
        ['PENDING', 'Pending approval', 2],
        ['APPROVED', 'Approved', 3],
        ['REJECTED', 'Rejected', 4],
    ]) {
        await request('POST', '/api/options', {
            name,
            code,
            sortOrder,
            optionSet: { id: osId },
        })
    }
    console.log('Created option set:', osId)
    return osId
}

async function ensureDataElement(name, payload) {
    const q = encodeURIComponent(name)
    const existing = await request(
        'GET',
        `/api/dataElements?filter=name:eq:${q}&fields=id,name&paging=false`
    )
    const hit = existing.dataElements?.[0]
    if (hit?.id) {
        console.log('Data element exists:', hit.name, hit.id)
        return hit.id
    }
    const created = await request('POST', '/api/dataElements', payload)
    const id = created.response.uid
    console.log('Created data element:', name, id)
    return id
}

async function linkPreventionStage(stageId, statusDeId, commentDeId) {
    const stage = await request(
        'GET',
        `/api/programStages/${stageId}?fields=id,name,program[id],programStageDataElements[id,sortOrder,dataElement[id]]`
    )
    const programId = stage.program.id
    const psdes = stage.programStageDataElements || []
    const have = new Set(psdes.map((p) => p.dataElement?.id).filter(Boolean))
    let maxSort = Math.max(0, ...psdes.map((p) => p.sortOrder || 0))
    const additions = []
    for (const deId of [statusDeId, commentDeId]) {
        if (!have.has(deId)) {
            maxSort += 5
            additions.push({
                dataElement: { id: deId },
                sortOrder: maxSort,
                compulsory: false,
                displayInReports: deId === statusDeId,
            })
        }
    }
    if (!additions.length) {
        console.log('Stage already linked:', stageId)
        return
    }
    await request('PUT', `/api/programStages/${stageId}`, {
        id: stageId,
        name: stage.name,
        program: { id: programId },
        programStageDataElements: [
            ...psdes.map((p) => ({
                id: p.id,
                sortOrder: p.sortOrder,
                dataElement: { id: p.dataElement.id },
            })),
            ...additions,
        ],
    })
    console.log('Linked programStageDataElements on', stageId)
}

async function linkProgramStageDataElements(stageId, statusDeId, commentDeId) {
    try {
        await linkPreventionStage(stageId, statusDeId, commentDeId)
        return true
    } catch (error) {
        console.warn(`programStageDataElements PUT failed for ${stageId}:`, error.message)
        return false
    }
}

async function linkSectionStage(stageId, statusDeId, commentDeId) {
    const sections = await request(
        'GET',
        `/api/programStages/${stageId}/programStageSections?fields=id,name,dataElements[id]&paging=false`
    )
    const list = sections.programStageSections || []
    const hasBoth = list.some((s) => {
        const ids = new Set((s.dataElements || []).map((d) => d.id))
        return ids.has(statusDeId) && ids.has(commentDeId)
    })
    if (hasBoth) {
        console.log('Stage section already has approval DEs:', stageId)
        return
    }
    const created = await request('POST', '/api/programStageSections', {
        name: 'Management approval',
        displayName: 'Management approval',
        sortOrder: 99,
        programStage: { id: stageId },
        dataElements: [{ id: statusDeId }, { id: commentDeId }],
    })
    console.log('Created section on', stageId, created.response.uid)
}

const osId = await ensureOptionSet()
const statusDeId = await ensureDataElement('Management approval status', {
    name: 'Management approval status',
    shortName: 'Mgmt approval',
    displayName: 'Management approval status',
    valueType: 'TEXT',
    domainType: 'TRACKER',
    aggregationType: 'NONE',
    optionSet: { id: osId },
})
const commentDeId = await ensureDataElement('Management approval comment', {
    name: 'Management approval comment',
    shortName: 'Mgmt appr cmt',
    displayName: 'Management approval comment',
    valueType: 'LONG_TEXT',
    domainType: 'TRACKER',
    aggregationType: 'NONE',
})

for (const stage of STAGES) {
    const linked = await linkProgramStageDataElements(stage.id, statusDeId, commentDeId)
    if (!linked) {
        await linkSectionStage(stage.id, statusDeId, commentDeId)
        console.warn(
            `\nStage ${stage.id} (${stage.name}): approval DEs may only be in a section.` +
                ' Tracker updates require programStageDataElements — link via Maintenance' +
                ' or run SQL against programstagedataelement, then POST /api/maintenance/cacheClear.'
        )
    }
}

console.log('\nCapture app settings:')
console.log('  approvalStatusDataElementId:', statusDeId)
console.log('  approvalCommentDataElementId:', commentDeId)
