/** Shared admin UI tokens — dark mode via semantic classes + zinc surfaces. */

export const ADMIN = {
    pageTitle: 'text-lg font-bold tracking-tight app-text-title md:text-xl',
    pageSubtitle: 'text-sm leading-snug app-text-meta',

    /** Main list / table panel */
    contentShell:
        'flex min-h-0 flex-1 flex-col overflow-hidden app-card shadow-sm dark:shadow-none',

    /** Filter row under page title */
    toolbarShell:
        'flex flex-wrap items-center gap-1.5 app-card p-1.5 md:gap-2 md:p-2 dark:shadow-none',

    panelTitle: 'text-sm font-semibold app-text-title',
    panelHint: 'mt-1 mb-3 text-sm leading-snug app-text-meta',
    sectionPad: 'px-3 py-3 md:px-4 md:py-4',
    editorPad: 'px-2.5 py-2 md:px-3 md:py-2.5',
    monoField:
        'w-full rounded-lg border border-slate-200/90 bg-white px-3 py-2 font-mono text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-[var(--app-header-bar-bg)] focus:outline-none focus:ring-1 focus:ring-[var(--app-header-bar-bg)] dark:border-[color:var(--app-border)] dark:bg-[var(--app-input-bg)] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:shadow-none',

    listSidebarHeader:
        'border-b border-slate-200/90 px-3 py-2 text-sm font-semibold app-text-title dark:border-[color:var(--app-border)]',

    tableThead: 'sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm dark:bg-zinc-950/95',
    tableHeaderRow: 'border-b border-slate-200/90 dark:border-[color:var(--app-border)]',
    tableHeaderCell:
        'px-3 py-2 text-sm font-semibold leading-snug text-slate-800 md:px-4 md:py-2.5 dark:text-zinc-200',
    tableBody: 'divide-y divide-slate-100 dark:divide-[color:var(--app-border)]',
    tableRow:
        'cursor-pointer transition-colors hover:bg-app-tint-8 dark:hover:bg-zinc-900/80',
    tableCell: 'px-3 py-2 text-sm text-slate-800 md:px-4 dark:text-zinc-200',
    tableCellPrimary: 'font-semibold app-text-title',
    tableCellMeta: 'mt-0.5 font-mono text-xs app-text-meta',
    tableCellMuted: 'text-slate-400 dark:text-zinc-500',

    control: 'app-filter-control',
    controlMono: 'app-filter-control font-mono',
    searchInput:
        'h-9 w-full min-w-[10rem] rounded-lg border-slate-200/90 bg-white pl-9 pr-2.5 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 dark:border-[color:var(--app-border)] dark:bg-[var(--app-input-bg)] dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:shadow-none',
    iconBtn:
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-600 shadow-sm transition-colors hover:bg-slate-50 dark:border-[color:var(--app-border)] dark:bg-[var(--app-input-bg)] dark:text-zinc-300 dark:shadow-none dark:hover:bg-zinc-900 dark:hover:text-zinc-100',

    chip:
        'rounded-md bg-slate-100 px-2.5 py-1.5 font-mono text-sm text-slate-700 transition-colors hover:bg-app-tint-8 hover:text-app-primary dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800',

    emptyText: 'p-6 text-center text-sm app-text-meta',
    errorText: 'p-4 text-center text-sm text-red-600 dark:text-red-400',

    editorSection:
        'rounded-lg border border-slate-200/90 bg-white p-3 dark:border-[color:var(--app-border)] dark:bg-zinc-950',
    editorHeader:
        'sticky top-0 z-20 shrink-0 border-b border-slate-200/90 bg-white shadow-sm dark:border-[color:var(--app-border)] dark:bg-zinc-950 dark:shadow-none',

    editorSidebar:
        'flex min-h-0 w-full shrink-0 flex-col border-b border-slate-200/90 bg-white md:border-b-0 md:border-r dark:border-[color:var(--app-border)] dark:bg-zinc-950',
    editorMain:
        'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-zinc-950',
    listDivide: 'divide-y divide-slate-100 dark:divide-[color:var(--app-border)]',
    listItem:
        'w-full px-3 py-2.5 text-left transition-colors border-l-2',
    listItemActive:
        'border-[var(--app-header-bar-bg)] bg-app-tint-8 pl-[10px] dark:bg-zinc-900/80',
    listItemIdle:
        'border-transparent hover:bg-slate-50 dark:hover:bg-zinc-900',
    sheet:
        'border-l border-slate-200/90 bg-white shadow-2xl dark:border-[color:var(--app-border)] dark:bg-zinc-950',
}
