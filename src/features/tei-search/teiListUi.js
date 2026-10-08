/**
 * Shared worklist / results table tokens (clinical blue + neutral slate).
 * Uses `--app-header-bar-*` from index.css — do not hard-code rgba(44,102,147,…).
 */

/** Page chrome shared by Records toolbar, TEI list shell, and Profile detail. */
export const PAGE_LAYOUT = {
    stack: 'flex flex-col gap-0 md:gap-1.5',
    toolbarCard:
        'w-full p-2 bg-white dark:bg-black border-b border-slate-200/80 dark:border-zinc-800 md:app-card md:border md:rounded-[var(--app-radius)] md:shadow-2xs md:bg-slate-50/95',
    contentCard:
        'flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-black md:app-card md:border md:rounded-[var(--app-radius)]',
    insetBar: 'px-4 py-1.5 md:px-3',
    insetCell: 'px-4 py-1.5 md:px-3',
    insetNotice: 'mx-4 px-3 py-1.5 md:mx-3',
}

export const TEI_LIST = {
    shell: 'relative flex min-h-0 flex-1 flex-col overflow-hidden',

    scrollBody:
        'min-h-0 flex-1 overflow-y-auto overflow-x-auto custom-scrollbar pb-28 md:pb-0 overscroll-contain transform-gpu',

    tableThead: 'sticky top-0 z-10 bg-slate-100/95 border-b border-slate-200 dark:border-zinc-800 backdrop-blur-sm dark:bg-black/95',
    tableHeaderRow: 'border-b border-slate-200/90 dark:border-[color:var(--app-border)]',
    /** Match toolbar Select: text-sm font-semibold text-slate-800 */
    tableHeaderCell:
        'px-2.5 py-1.5 text-[12.5px] font-bold leading-snug text-slate-700 dark:text-zinc-200 md:px-3 whitespace-nowrap',

    tableRow:
        'group relative cursor-pointer border-b border-[color:var(--app-border)] transition-colors last:border-0 hover:bg-stone-50/80 dark:hover:bg-zinc-900/60',
    tableRowHighlight: 'bg-app-tint-8 ring-1 ring-inset ring-app-tint-20',

    tableCell:
        'px-2.5 py-1 text-[13px] font-normal app-text-label transition-colors group-hover:app-text-title md:px-3 whitespace-nowrap',
    tableCellMeta:
        'px-2.5 py-1 text-[13px] font-normal app-text-meta whitespace-nowrap md:px-3',

    eventCountBadge:
        'inline-flex min-w-[24px] cursor-pointer items-center justify-center rounded-full bg-app-tint-10 px-2 py-0.5 text-xs font-semibold text-app-primary transition-colors hover:bg-app-tint-16',

    statusCompleteDot:
        'h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_6px_rgb(16_185_129/0.35)]',
    statusActiveDot:
        'h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--app-header-bar-bg)] shadow-[0_0_6px_rgb(var(--app-header-bar-rgb)/0.35)]',
    statusDotLg: 'h-2 w-2',
    statusCompleteText: 'text-[13px] font-medium text-emerald-700',
    statusActiveText: 'text-[13px] font-medium text-app-primary',

    /** Stage / program labels in events view — same size as table body (not 11px uppercase). */
    tableCellStage: 'text-[13px] font-normal leading-snug text-slate-700 dark:text-zinc-300',

    /** One rounded panel; flat rows inside (no per-item cards). */
    mobileList:
        'divide-y divide-slate-100/80 dark:divide-[color:var(--app-border)] md:hidden',

    mobileRow:
        'flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-slate-50/90 dark:active:bg-zinc-900 sm:gap-3 sm:px-4',
    mobileRowHighlight: 'bg-app-tint-8',

    mobileTitle: 'truncate text-[14px] font-semibold app-text-title tracking-tight',
    mobileSubtitle: 'truncate text-[13px] font-normal app-text-meta',
    mobileMeta: 'text-[11px] font-medium app-text-meta',

    mobileChevron:
        'flex h-8 w-8 shrink-0 items-center justify-center text-slate-400',

    iconButton:
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200/90 bg-slate-50 text-slate-500 transition-colors hover:bg-app-tint-10 hover:text-app-primary dark:border-zinc-800 dark:bg-black dark:text-zinc-400',

    emptyTitle: 'text-sm font-semibold app-text-title',
    emptyBody: 'mt-1 text-xs app-text-meta',

    footer:
        'z-30 flex shrink-0 flex-row items-center justify-between gap-1 sm:gap-2 border-t border-[color:var(--app-border)] app-surface px-2 sm:px-3 py-2 sm:py-1 dark:border-[color:var(--app-border)] md:relative md:z-auto md:py-2 pb-[max(0.625rem,env(safe-area-inset-bottom))]',
    footerPagination: 'flex shrink-0 items-center gap-0.5 sm:gap-1.5 md:gap-4',
    mobileLoadMore: 'flex items-center justify-center py-3 md:mx-4 md:hidden',
    footerMeta: 'truncate text-[10px] sm:text-[11px] md:text-xs font-medium app-text-meta',
    footerMetaStrong: 'font-semibold text-slate-800 dark:text-slate-200',

    loadingOverlay:
        'absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-[3px] transition-all duration-200 dark:bg-black/75',
    loadingPanel:
        'flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white/95 px-5 py-3.5 shadow-xl shadow-slate-900/5 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95',
    loadingText: 'text-[13.5px] font-semibold text-slate-800 dark:text-zinc-100 tracking-tight',

    checkbox: 'app-checkbox',

    bulkSelectionBar:
        'mx-3 mt-2 sm:mt-2.5 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200/90 bg-slate-50/90 px-3 py-2.5 dark:border-zinc-800 dark:bg-black sm:px-4 md:mx-4',
    bulkSelectionCount: 'text-sm font-semibold text-slate-800 dark:text-slate-200',

    filterClearAll:
        'text-[10px] font-black uppercase tracking-widest px-2 py-1 text-app-primary transition-colors hover:text-[var(--app-header-bar-bg-hover)]',
}
