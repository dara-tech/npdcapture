import React, { useEffect, useMemo, useState } from 'react'
import { useDataEngine } from '@dhis2/app-runtime'
import { fetchOrgUnits } from '../../services/trackerApi'
import { buildTree, orgUnitLabel } from '../../hooks/useOrgUnitTree'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Alert } from '../../components/ui/alert'
import { Spinner } from '../../components/ui/spinner'
import { Button } from '../../components/ui/button'

const findNodeByName = (nodes, matcher) => {
    for (const node of nodes) {
        if (matcher(node)) {
            return node
        }
        const child = findNodeByName(node.children || [], matcher)
        if (child) {
            return child
        }
    }
    return null
}

const TreeNode = ({ node, selectedId, expanded, toggle, onSelect, depth = 0 }) => {
    const hasChildren = node.children?.length > 0
    const isExpanded = expanded.has(node.id)

    return (
        <div className="select-none">
            <div
                className={`flex items-center gap-1 rounded px-1 py-0.5 text-sm ${
                    selectedId === node.id ? 'bg-slate-200 font-medium text-slate-900' : 'text-slate-700 hover:bg-slate-100'
                }`}
                style={{ paddingLeft: `${depth * 12 + 4}px` }}
            >
                {hasChildren ? (
                    <button
                        type="button"
                        className="w-4 text-xs text-slate-500"
                        onClick={() => toggle(node.id)}
                    >
                        {isExpanded ? '▾' : '▸'}
                    </button>
                ) : (
                    <span className="w-4 text-slate-300">•</span>
                )}
                <button type="button" className="flex-1 text-left" onClick={() => onSelect(node.id)}>
                    {orgUnitLabel(node)}
                </button>
            </div>
            {hasChildren && isExpanded ? (
                <div className="mt-0.5">
                    {node.children
                        .sort((a, b) => orgUnitLabel(a).localeCompare(orgUnitLabel(b)))
                        .map((child) => (
                            <TreeNode
                                key={child.id}
                                node={child}
                                selectedId={selectedId}
                                expanded={expanded}
                                toggle={toggle}
                                onSelect={onSelect}
                                depth={depth + 1}
                            />
                        ))}
                </div>
            ) : null}
        </div>
    )
}

export const OrgUnitTreePanel = ({ context, onChange }) => {
    const engine = useDataEngine()
    const [orgUnits, setOrgUnits] = useState([])
    const [expanded, setExpanded] = useState(new Set())
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        const run = async () => {
            try {
                setLoading(true)
                const units = await fetchOrgUnits({ engine })
                setOrgUnits(units)
                const roots = buildTree(units)
                const level1Root = findNodeByName(roots, (node) => (node.level || 0) === 1)
                const defaultOrgUnitId = level1Root?.id || roots[0]?.id || units[0]?.id
                if (defaultOrgUnitId && !context.orgUnit) {
                    onChange({ ...context, orgUnit: defaultOrgUnitId })
                }
            } catch (e) {
                setError(e.message || 'Failed to load organisation units')
            } finally {
                setLoading(false)
            }
        }
        run()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [engine])

    const treeRoots = useMemo(() => buildTree(orgUnits), [orgUnits])
    const level1Root = useMemo(
        () => findNodeByName(treeRoots, (node) => (node.level || 0) === 1),
        [treeRoots]
    )
    const displayRoots = level1Root ? [{ ...level1Root, children: [] }] : treeRoots

    const toggle = (id) => {
        setExpanded((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    return (
        <Card className="h-full">
            <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Organisation Units</CardTitle>
                <Button size="sm" variant="ghost" onClick={() => setExpanded(new Set(orgUnits.map((o) => o.id)))}>
                    Expand all
                </Button>
            </CardHeader>
            <CardContent className="max-h-[70vh] overflow-auto">
                {loading ? <Spinner /> : null}
                {error ? <Alert variant="destructive" title="Org unit load failed">{error}</Alert> : null}
                {!loading && !error ? (
                    <div className="space-y-0.5">
                        {displayRoots.map((root) => (
                            <TreeNode
                                key={root.id}
                                node={root}
                                selectedId={context.orgUnit}
                                expanded={expanded}
                                toggle={toggle}
                                onSelect={(orgUnit) => onChange({ ...context, orgUnit })}
                            />
                        ))}
                    </div>
                ) : null}
            </CardContent>
        </Card>
    )
}
