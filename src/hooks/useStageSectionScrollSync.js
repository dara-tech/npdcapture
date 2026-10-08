import { useEffect, useRef } from 'react'

/**
 * Keep activeSectionId in sync with scroll position (stage section cards).
 */
export function useStageSectionScrollSync({
    enabled,
    sectionIds,
    activeSectionId,
    onActiveSectionChange,
    scrollRootRef,
}) {
    const observerRef = useRef(null)
    const fromScrollRef = useRef(false)

    useEffect(() => {
        if (!enabled || !sectionIds?.length) return undefined

        const root = scrollRootRef?.current || null
        const elements = sectionIds
            .map((id) => document.getElementById(`stage-section-${id}`))
            .filter(Boolean)
        if (!elements.length) return undefined

        observerRef.current?.disconnect()

        const ratios = new Map()
        observerRef.current = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    const id = entry.target.id?.replace(/^stage-section-/, '')
                    if (!id) continue
                    ratios.set(id, entry.intersectionRatio)
                }
                let bestId = null
                let bestRatio = 0
                for (const [id, ratio] of ratios) {
                    if (ratio > bestRatio) {
                        bestRatio = ratio
                        bestId = id
                    }
                }
                if (bestId && bestId !== activeSectionId && bestRatio >= 0.15) {
                    fromScrollRef.current = true
                    onActiveSectionChange?.(bestId)
                }
            },
            {
                root,
                rootMargin: '-20% 0px -55% 0px',
                threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
            }
        )

        for (const el of elements) observerRef.current.observe(el)

        return () => observerRef.current?.disconnect()
    }, [enabled, sectionIds, activeSectionId, onActiveSectionChange, scrollRootRef])

    return { fromScrollRef }
}
