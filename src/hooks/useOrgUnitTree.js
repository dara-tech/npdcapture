import { useMemo, useState } from 'react'

/** Label shown in UI; DHIS2 returns translated text in `displayName` when `locale` + `translate` are set. */
export const orgUnitLabel = (ou) =>
    (ou?.displayName && String(ou.displayName).trim()) || ou?.name || ''

export const buildTree = (orgUnits) => {
    const map = new Map()
    for (const ou of orgUnits) {
        map.set(ou.id, { ...ou, children: [] })
    }
    const roots = []
    for (const ou of orgUnits) {
        const node = map.get(ou.id)
        const parentId = ou.parent?.id
        if (parentId && map.has(parentId)) {
            map.get(parentId).children.push(node)
        } else {
            roots.push(node)
        }
    }
    return roots.sort((a, b) => orgUnitLabel(a).localeCompare(orgUnitLabel(b)))
}

export const getAncestorIds = (orgUnits, targetId) => {
    if (!targetId) return []
    const byId = new Map(orgUnits.map((ou) => [ou.id, ou]))
    const ancestors = []
    let current = byId.get(targetId)
    while (current?.parent?.id && byId.has(current.parent.id)) {
        ancestors.push(current.parent.id)
        current = byId.get(current.parent.id)
    }
    return ancestors
}

export const filterTree = (nodes, query) => {
    if (!query) {
        return nodes
    }
    const lower = query.toLowerCase()
    const next = []
    for (const node of nodes) {
        const childMatches = filterTree(node.children || [], query)
        const label = orgUnitLabel(node).toLowerCase()
        const selfMatch = label.includes(lower)
        if (selfMatch || childMatches.length) {
            next.push({ ...node, children: childMatches })
        }
    }
    return next
}

export const findById = (nodes, id) => {
    for (const node of nodes) {
        if (node.id === id) return node
        const child = findById(node.children || [], id)
        if (child) return child
    }
    return null
}

export const getOrgUnitPathLabel = (orgUnits, selectedOrg) => {
    if (!selectedOrg?.path) {
        return ''
    }
    const byId = new Map(orgUnits.map((ou) => [ou.id, orgUnitLabel(ou)]))
    return selectedOrg.path
        .split('/')
        .filter(Boolean)
        .map((id) => byId.get(id) || id)
        .join(' / ')
}

export const useOrgUnitTree = (orgUnits, selectedId) => {
    const [orgSearch, setOrgSearch] = useState('')
    const [expanded, setExpanded] = useState(new Set())

    const treeRoots = useMemo(() => buildTree(orgUnits), [orgUnits])
    const filteredRoots = useMemo(() => filterTree(treeRoots, orgSearch), [treeRoots, orgSearch])
    const selectedOrg = useMemo(() => findById(treeRoots, selectedId), [treeRoots, selectedId])
    
    const selectedOrgPathLabel = useMemo(
        () => getOrgUnitPathLabel(orgUnits, selectedOrg),
        [orgUnits, selectedOrg]
    )

    const toggle = (id) => {
        setExpanded((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const expandToId = (id) => {
        setExpanded(new Set(getAncestorIds(orgUnits, id)))
    }

    return {
        treeRoots,
        filteredRoots,
        selectedOrg,
        selectedOrgPathLabel,
        orgSearch,
        setOrgSearch,
        expanded,
        toggle,
        expandToId,
    }
}
