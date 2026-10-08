import { useState, useMemo, useEffect } from 'react'
import { useDataEngine } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { fetchProgramMetadata } from '../../../services/trackerApi'

/**
 * Manages the unified column pool (Tracked Entity Attributes + Data Elements),
 * draft/visible column selection, drag-and-drop reordering, and metadata loading.
 */
export const useColumnConfig = (context) => {
    const engine = useDataEngine()

    const [programAttributes, setProgramAttributes] = useState([])
    const [dataElementsMap, setDataElementsMap] = useState({})
    const [dataElementMetaMap, setDataElementMetaMap] = useState({})
    const [stagesMap, setStagesMap] = useState({})

    // Unified column pool: { id, name, type: 'attr' | 'de' }
    const [configColumns, setConfigColumns] = useState([])
    const [originalConfigColumns, setOriginalConfigColumns] = useState([])
    const [originalAttributes, setOriginalAttributes] = useState([])

    // Which column ids are checked (applied to table)
    const [visibleAttributeIds, setVisibleAttributeIds] = useState([])
    // Draft selection in the modal (not yet applied)
    const [draftAttributeIds, setDraftAttributeIds] = useState([])

    // Download export selections
    const [downloadAttributeIds, setDownloadAttributeIds] = useState([])

    // Drag-and-drop state
    const [draggedIndex, setDraggedIndex] = useState(null)

    // ── Load metadata whenever program changes ────────────────────────────────
    useEffect(() => {
        const load = async () => {
            if (!context.program) {
                setProgramAttributes([])
                setVisibleAttributeIds([])
                setConfigColumns([])
                return
            }
            try {
                const metadata = await fetchProgramMetadata({ engine, programId: context.program })

                const attributes =
                    metadata?.programTrackedEntityAttributes
                        ?.map((item) => item?.trackedEntityAttribute)
                        ?.filter((item) => item?.id) || []

                const deMap = {}
                const deMetaMap = {}
                const stMap = {}
                const deList = []
                metadata?.programStages?.forEach(stage => {
                    stMap[stage.id] = stage.displayName || stage.name
                    stage.programStageDataElements?.forEach(psde => {
                        if (psde.dataElement && !deMap[psde.dataElement.id]) {
                            const core = psde.dataElement
                            deMap[core.id] = core.displayName || core.name
                            deMetaMap[core.id] = {
                                id: core.id,
                                name: core.name,
                                displayName: core.displayName || core.name,
                                valueType: core.valueType,
                                optionSet: core.optionSet,
                            }
                            deList.push({
                                id: core.id,
                                name: core.displayName || core.name,
                                type: 'de',
                            })
                        }
                    })
                })

                setDataElementsMap(deMap)
                setDataElementMetaMap(deMetaMap)
                setStagesMap(stMap)

                const sortedAttributes = [...attributes].sort((a, b) => {
                    const nameA = String(a.displayName || a.name || a.shortName || a.systemName || '').toUpperCase()
                    const nameB = String(b.displayName || b.name || b.shortName || b.systemName || '').toUpperCase()
                    const isPmrsA = nameA.includes('PMRS')
                    const isPmrsB = nameB.includes('PMRS')
                    if (isPmrsA && !isPmrsB) return -1
                    if (!isPmrsA && isPmrsB) return 1
                    return 0
                })

                const attrCols = sortedAttributes.map((a) => ({
                    id: a.id,
                    name: a.displayName || a.name || a.id,
                    type: 'attr',
                }))
                const allCols = [...attrCols, ...deList]
                setConfigColumns(allCols)
                setOriginalConfigColumns(allCols)

                setProgramAttributes(sortedAttributes)
                setOriginalAttributes([...sortedAttributes])

                const defaultVisible = sortedAttributes.slice(0, 6).map(a => a.id)
                setVisibleAttributeIds(defaultVisible)
                setDraftAttributeIds(defaultVisible)
                setDownloadAttributeIds(defaultVisible)
            } catch {
                setProgramAttributes([])
                setVisibleAttributeIds([])
                setConfigColumns([])
            }
        }
        load()
    }, [context.program, engine, i18n.language])

    // ── Derived ───────────────────────────────────────────────────────────────
    const visibleAttributes = useMemo(
        () => programAttributes.filter(a => visibleAttributeIds.includes(a.id)),
        [programAttributes, visibleAttributeIds]
    )

    /** Columns actually shown in the table (in order, filtered by draftAttributeIds) */
    const visibleColumns = useMemo(
        () => configColumns.filter(col => draftAttributeIds.includes(col.id)),
        [configColumns, draftAttributeIds]
    )

    // ── Column toggle ─────────────────────────────────────────────────────────
    const toggleDraftAttribute = (id) => {
        setDraftAttributeIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    // ── Drag & drop ───────────────────────────────────────────────────────────
    const handleDragStart = (index) => setDraggedIndex(index)

    const handleDragOver = (e, index) => {
        e.preventDefault()
        if (draggedIndex === null || draggedIndex === index) return
        const next = [...configColumns]
        const item = next[draggedIndex]
        next.splice(draggedIndex, 1)
        next.splice(index, 0, item)
        setConfigColumns(next)
        setDraggedIndex(index)
    }

    const handleDragEnd = () => setDraggedIndex(null)

    // ── Reset ─────────────────────────────────────────────────────────────────
    const handleResetColumns = () => {
        const defaultVisible = originalAttributes.slice(0, 6).map(a => a.id)
        setConfigColumns([...originalConfigColumns])
        setDraftAttributeIds(defaultVisible)
    }

    return {
        // Metadata
        programAttributes,
        dataElementsMap,
        dataElementMetaMap,
        stagesMap,
        // Column pool
        configColumns,
        visibleAttributeIds,
        setVisibleAttributeIds,
        draftAttributeIds,
        setDraftAttributeIds,
        downloadAttributeIds,
        setDownloadAttributeIds,
        // Derived
        visibleAttributes,
        visibleColumns,
        // Handlers
        toggleDraftAttribute,
        handleDragStart,
        handleDragOver,
        handleDragEnd,
        handleResetColumns,
        draggedIndex,
    }
}
