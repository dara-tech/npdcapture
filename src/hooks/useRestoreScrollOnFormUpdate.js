import { useLayoutEffect, useRef } from 'react'

/**
 * Keep the stage form scroll position when form state changes (rules show/hide fields,
 * gate sections open, etc.) so the page does not jump upward on each click.
 * @param {React.RefObject<HTMLElement>} scrollRef
 * @param {unknown} layoutVersion — change when layout may reflow (e.g. formValues, hiddenFieldsKey)
 * @param {boolean} [enabled]
 */
export function useRestoreScrollOnFormUpdate(scrollRef, layoutVersion, enabled = true) {
    const prevVersionRef = useRef(layoutVersion)
    const scrollTopRef = useRef(0)
    const shouldRestoreRef = useRef(false)

    if (enabled && layoutVersion !== prevVersionRef.current) {
        const el = scrollRef?.current
        if (el) scrollTopRef.current = el.scrollTop
        prevVersionRef.current = layoutVersion
        shouldRestoreRef.current = true
    }

    useLayoutEffect(() => {
        if (!enabled || !shouldRestoreRef.current) return
        shouldRestoreRef.current = false
        const el = scrollRef?.current
        if (el) el.scrollTop = scrollTopRef.current
    }, [layoutVersion, enabled, scrollRef])
}
