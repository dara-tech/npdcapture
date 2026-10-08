import { useCallback, useEffect, useMemo, useState } from 'react'

const loadStored = (storageKey, defaultVisibleIds, allColumnIds) => {
    if (!storageKey || typeof localStorage === 'undefined') {
        return { visibleIds: defaultVisibleIds, order: allColumnIds }
    }
    try {
        const raw = localStorage.getItem(storageKey)
        if (!raw) return { visibleIds: defaultVisibleIds, order: allColumnIds }
        const parsed = JSON.parse(raw)
        const visibleIds = Array.isArray(parsed?.visibleIds)
            ? parsed.visibleIds.filter((id) => allColumnIds.includes(id))
            : defaultVisibleIds
        const order = Array.isArray(parsed?.order)
            ? [
                  ...parsed.order.filter((id) => allColumnIds.includes(id)),
                  ...allColumnIds.filter((id) => !parsed.order.includes(id)),
              ]
            : allColumnIds
        return {
            visibleIds: visibleIds.length ? visibleIds : defaultVisibleIds,
            order,
        }
    } catch {
        return { visibleIds: defaultVisibleIds, order: allColumnIds }
    }
}

const orderColumns = (columns, order) => {
    const byId = new Map(columns.map((c) => [c.id, c]))
    return order.map((id) => byId.get(id)).filter(Boolean)
}

/**
 * Reusable column visibility + order state (record list & user management).
 */
export function useListColumnConfig({
    columns,
    defaultVisibleIds,
    storageKey = '',
}) {
    const allColumnIds = useMemo(() => columns.map((c) => c.id), [columns])

    const [configColumns, setConfigColumns] = useState(() => columns)
    const [visibleIds, setVisibleIds] = useState(() =>
        loadStored(storageKey, defaultVisibleIds, allColumnIds).visibleIds
    )
    const [draftVisibleIds, setDraftVisibleIds] = useState(visibleIds)
    const [draggedIndex, setDraggedIndex] = useState(null)
    const [modalOpen, setModalOpen] = useState(false)

    useEffect(() => {
        const { order } = loadStored(storageKey, defaultVisibleIds, allColumnIds)
        setConfigColumns(orderColumns(columns, order))
    }, [columns, defaultVisibleIds, storageKey, allColumnIds])

    const visibleColumns = useMemo(
        () => configColumns.filter((col) => visibleIds.includes(col.id)),
        [configColumns, visibleIds]
    )

    const persist = useCallback(
        (nextVisibleIds, nextColumns) => {
            if (!storageKey || typeof localStorage === 'undefined') return
            try {
                localStorage.setItem(
                    storageKey,
                    JSON.stringify({
                        visibleIds: nextVisibleIds,
                        order: nextColumns.map((c) => c.id),
                    })
                )
            } catch {
                /* ignore */
            }
        },
        [storageKey]
    )

    const openColumnsModal = useCallback(() => {
        setDraftVisibleIds(visibleIds)
        setModalOpen(true)
    }, [visibleIds])

    const closeColumnsModal = useCallback(() => {
        setModalOpen(false)
        setDraftVisibleIds(visibleIds)
        setDraggedIndex(null)
    }, [visibleIds])

    const toggleDraftColumn = useCallback((id) => {
        setDraftVisibleIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        )
    }, [])

    const handleDragStart = useCallback((index) => {
        setDraggedIndex(index)
    }, [])

    const handleDragOver = useCallback(
        (e, index) => {
            e.preventDefault()
            if (draggedIndex === null || draggedIndex === index) return
            setConfigColumns((prev) => {
                const next = [...prev]
                const item = next[draggedIndex]
                next.splice(draggedIndex, 1)
                next.splice(index, 0, item)
                return next
            })
            setDraggedIndex(index)
        },
        [draggedIndex]
    )

    const handleDragEnd = useCallback(() => {
        setDraggedIndex(null)
    }, [])

    const handleResetColumns = useCallback(() => {
        setConfigColumns(columns)
        setDraftVisibleIds(defaultVisibleIds)
    }, [columns, defaultVisibleIds])

    const applyColumnChanges = useCallback(() => {
        setVisibleIds(draftVisibleIds)
        persist(draftVisibleIds, configColumns)
        setModalOpen(false)
        setDraggedIndex(null)
    }, [draftVisibleIds, configColumns, persist])

    const isColumnVisible = useCallback(
        (id) => visibleIds.includes(id),
        [visibleIds]
    )

    return {
        configColumns,
        visibleColumns,
        visibleIds,
        draftVisibleIds,
        draggedIndex,
        modalOpen,
        openColumnsModal,
        closeColumnsModal,
        toggleDraftColumn,
        handleDragStart,
        handleDragOver,
        handleDragEnd,
        handleResetColumns,
        applyColumnChanges,
        isColumnVisible,
    }
}
