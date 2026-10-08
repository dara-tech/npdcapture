/** Shared overlay surfaces (modals, sheets) — flat, compact, Claude-like. */

export const MODAL = {
    backdrop:
        'modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-3 backdrop-blur-[2px] dark:bg-black/80',
    panel:
        'modal-panel w-full overflow-hidden rounded-[var(--app-radius)] border border-[color:var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] shadow-none dark:border-zinc-800 dark:bg-black dark:text-zinc-50',
    panelLg:
        'modal-panel w-full max-w-md overflow-hidden rounded-[var(--app-radius)] border border-[color:var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] shadow-none dark:border-zinc-800 dark:bg-black dark:text-zinc-50',
    panelMd:
        'modal-panel w-full max-w-sm overflow-hidden rounded-[var(--app-radius)] border border-[color:var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] shadow-none dark:border-zinc-800 dark:bg-black dark:text-zinc-50',
    panel3xl:
        'modal-panel w-full max-w-3xl overflow-hidden rounded-[var(--app-radius)] border border-[color:var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)] shadow-none dark:border-zinc-800 dark:bg-black dark:text-zinc-50',
    header:
        'relative border-b border-[color:var(--app-border)] px-4 pb-3 pt-4 dark:border-zinc-800 dark:bg-black',
    headerPlain:
        'relative border-b border-[color:var(--app-border)] px-4 pb-3 pt-4 dark:border-zinc-800 dark:bg-black',
    body: 'px-4 pb-3 text-[13px] app-text-label',
    footer:
        'flex items-center justify-between gap-2 border-t border-[color:var(--app-border)] px-4 py-3 dark:border-zinc-800 dark:bg-black',
    footerEnd: 'flex justify-end gap-2 border-t border-[color:var(--app-border)] px-4 py-3 dark:border-zinc-800 dark:bg-black',
    scrollList:
        'max-h-[min(52vh,320px)] overflow-auto rounded-[var(--app-radius)] border border-[color:var(--app-border)] bg-[var(--app-surface)] custom-scrollbar dark:border-zinc-800 dark:bg-black',
    closeBtn:
        'absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md app-text-meta transition-colors hover:bg-stone-100/90 hover:app-text-title dark:hover:bg-zinc-900',
    segmentTrack:
        'flex items-center gap-1 rounded-lg border border-[color:var(--app-border)] bg-stone-50/80 p-0.5 dark:border-zinc-800 dark:bg-black',
    segmentActive:
        'app-surface text-[var(--app-header-bar-bg)] border border-[color:var(--app-border)] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50',
    segmentIdle: 'app-text-meta hover:app-text-title',
    listRow: 'group flex items-center gap-2 px-2.5 py-1.5 transition-colors hover:bg-stone-50/80 dark:hover:bg-zinc-900/80',
}

export const POPOVER = {
    content:
        'z-[300] w-72 rounded-[var(--app-radius)] border border-[color:var(--app-border)] bg-[var(--app-surface)] p-0 text-[var(--app-text)] shadow-none outline-none dark:border-zinc-800 dark:bg-black dark:text-zinc-50',
}
