import { cn } from './utils'

/** Fixed control column in paper / checklist rows (checkbox, short input). */
export const FORM_CHECKBOX_COL = '2rem'

/** Label | control split in paper inline rows (percentages). */
export const FORM_PAPER_LABEL_COL = 'minmax(0,42%)'
export const FORM_PAPER_CONTROL_COL = 'minmax(0,58%)'

/** 2-col paper/symptom grid cell — grows with control content (no vertical centering clip). */
const PAPER_GRID_CELL_BASE =
    'min-h-[1.875rem] app-paper-cell px-2 py-0.5 sm:px-2.5 sm:py-1'
const PAPER_GRID_CELL_ROW = `${PAPER_GRID_CELL_BASE} flex items-center`
const PAPER_GRID_CELL_GRID = `${PAPER_GRID_CELL_BASE} grid items-center`

/**
 * Shared form typography (profile, stage, registration).
 * Field labels + values + controls: text-sm (14px). Section chrome may use text-xs meta.
 */
export const FORM = {
    /** Base body text inside form fields. */
    formText: 'text-[13px] leading-snug',
    pageTitle: 'text-base font-semibold tracking-tight app-text-title md:text-lg',
    pageSubtitle: 'text-[13px] font-normal leading-snug app-text-meta',
    sectionBarTitle: 'text-[13px] font-medium app-text-title leading-snug',
    sectionBarMeta: 'text-xs font-medium tabular-nums app-text-meta',
    /** Field label (profile, stage DE, checklist / paper grid rows). */
    formLabel: 'text-[13px] font-medium leading-snug app-text-label',
    /** Read-only or displayed value — same size as inputs, normal weight. */
    formValue: 'text-[13px] font-normal leading-snug app-text-title',
    fieldRequiredMark: 'text-[13px] font-semibold text-red-500',
    /** Section card + header (profile + stage). */
    sectionCardShell: 'app-card',
    paperSectionCardShell: 'app-card',
    paperFormSheet:
        'mx-auto w-full max-w-6xl border border-stone-400/80 bg-[var(--app-surface)] dark:border-zinc-800 dark:bg-black',
    paperFormSheetTitle:
        'paper-form-sheet-title border-b border-stone-300/80 px-4 py-3 text-center dark:border-zinc-800 dark:bg-black',
    paperFormSectionCard: 'overflow-hidden border-0 bg-transparent',
    paperFormSectionHeader:
        'paper-form-section-header border-b border-stone-200/90 bg-stone-50/60 dark:border-zinc-800 dark:bg-black',
    paperFormSectionTitle: 'paper-form-section-title [overflow-wrap:anywhere]',
    paperFormQuestionNo:
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-stone-400/90 bg-stone-100 text-xs font-bold tabular-nums text-stone-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100',
    /** Risk Q1–Q12: one column, numbered rows */
    paperQuestionnaireList: 'flex flex-col divide-y divide-stone-300/80',
    paperQuestionRow: 'flex gap-3 px-4 py-2.5',
    paperQuestionBody: 'min-w-0 flex-1',
    paperQuestionLabel:
        'paper-form-question-label leading-snug app-text-label [overflow-wrap:anywhere]',
    paperQuestionOptions: 'mt-2 min-w-0',
    paperChoiceButton:
        'inline-flex min-h-8 shrink-0 cursor-pointer select-none items-center justify-center rounded-xl border border-stone-300 bg-white px-3 py-1 text-[12px] font-medium leading-snug app-text-label shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all duration-150 ease-out hover:border-stone-400 hover:bg-stone-50 active:scale-[0.985] transform-gpu dark:border-zinc-800 dark:bg-black dark:hover:bg-zinc-900',
    paperChoiceButtonSelected:
        'border-[var(--app-header-bar-bg)] bg-[var(--app-header-bar-bg)] text-white shadow-sm font-semibold hover:border-[var(--app-header-bar-bg)] hover:bg-[var(--app-header-bar-bg)]',
    paperFormGrid:
        'paper-form-grid grid grid-cols-1 lg:grid-cols-2 border border-stone-300/80 dark:border-zinc-800',
    paperFormGridSingle:
        'paper-form-grid grid grid-cols-1 border border-stone-300/80 dark:border-zinc-800',
    sectionHeaderBar:
        'app-section-header flex flex-wrap items-center justify-between gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5',
    paperSectionHeaderBar:
        'app-section-header flex flex-wrap items-center justify-between gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5',
    sectionHeaderPrimary: 'text-sm font-semibold leading-snug app-text-title',
    sectionHeaderButton: 'px-2.5 py-2 sm:px-3',
    sectionHeaderBadge:
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--app-header-bar-bg)] app-surface text-xs font-semibold text-[var(--app-header-bar-bg)]',
    sectionHeaderEnglish: 'mt-0.5 text-xs font-normal leading-snug app-text-meta',
    /** Gate row: beside title when room; full width below title when title wraps. */
    sectionHeaderGate:
        'flex flex-col items-stretch justify-center border-t border-[color:var(--app-border)] px-2.5 py-1.5 transition-colors dark:border-zinc-800 sm:border-l sm:border-t-0 sm:px-2.5 sm:py-1.5',
    sectionHeaderGateLocked: 'bg-slate-50/70 dark:bg-black',
    sectionHeaderGateOpen: 'bg-[rgba(44,102,147,0.06)]',
    sectionHeaderGateComplete: 'border-l-[rgba(44,102,147,0.22)]',
    /** Yes/No (or options) beside section title — separate pills with gap, not one joined control. */
    sectionHeaderGateSegments:
        'flex w-full flex-wrap items-stretch justify-start gap-2',
    sectionHeaderGateSegmentsOpen: '',
    sectionHeaderGateSegmentsStacked: 'flex-row flex-wrap items-stretch gap-2',
    sectionHeaderGateSegment:
        'min-h-8 min-w-[3rem] shrink-0 rounded-xl border border-[color:var(--app-border)] app-surface px-3 py-1 text-center text-[13px] font-medium leading-snug app-text-label shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all duration-150 ease-out hover:border-stone-300 hover:bg-stone-50/80 active:scale-[0.97] transform-gpu dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50 [overflow-wrap:anywhere]',
    sectionHeaderGateSegmentStacked:
        'w-full flex-none whitespace-normal px-3 py-1.5 text-left',
    sectionHeaderGateSegmentSelected:
        'border-[var(--app-header-bar-bg)] bg-[var(--app-header-bar-bg)] text-white shadow-sm font-semibold hover:border-[var(--app-header-bar-bg)] hover:bg-[var(--app-header-bar-bg)]',
    gateHeaderChoice:
        'inline-flex min-h-0 cursor-pointer items-center gap-2.5 rounded-md px-0.5 py-0.5',
    /** Section gate: rounded pill with □ + បាទ/ចាស only (no separate No button). */
    sectionHeaderGateYesPill:
        'inline-flex min-h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-[color:var(--app-border)] app-surface px-2.5 py-1 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all duration-150 ease-out hover:border-stone-300 hover:bg-stone-50/80 active:scale-[0.97] transform-gpu dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900 focus-within:outline-none focus-within:ring-4 focus-within:ring-sky-500/20',
    sectionHeaderGateYesPillChecked:
        'border-[rgba(44,102,147,0.32)] bg-[rgba(44,102,147,0.07)]',
    gateHeaderYesLabel: 'text-sm font-medium leading-snug text-slate-700 dark:text-zinc-200',
    sectionHeaderSubline: 'mt-0.5 text-xs font-medium leading-snug app-text-meta',
    sectionGateBandCompact: 'border-b border-slate-100/90 px-3 py-2 sm:px-4',
    sectionGateLockedHint:
        'flex items-start gap-2 rounded-lg border border-amber-200/80 bg-amber-50/90 px-2.5 py-2 text-xs leading-snug text-amber-950',
    profileSectionHeaderBar:
        'app-section-header flex shrink-0 flex-wrap items-center justify-between gap-1 px-2.5 py-1.5 md:px-3',
    profileSectionHeaderActions: 'flex flex-wrap items-center gap-2',
    /** Profile card field grid — scrolls inside section while header stays visible. */
    profileSectionBody: 'min-h-0 flex-1 overflow-y-auto custom-scrollbar',
    /** Profile tab: two columns on md+, label | value per cell. */
    profileAttributeGrid: 'grid grid-cols-1 gap-px bg-[color:var(--app-border)] md:grid-cols-2',
    profileAttributeRow:
        'group app-field-row px-2 py-1 sm:px-2.5 sm:py-1.5',
    /** Single field uses full grid width when the other column would be empty. */
    profileAttributeRowFull: 'md:col-span-2',
    profileFieldRowInner:
        'grid w-full grid-cols-1 items-start gap-1 sm:grid-cols-[minmax(0,38%)_minmax(0,62%)] sm:items-center sm:gap-x-3 sm:gap-y-0',
    profileAttributeLabelCol: 'min-w-0 shrink-0 sm:pt-0',
    profileAttributeValueCol: 'min-w-0 w-full [&_input]:shadow-none [&_button]:shadow-none',
    /** Full-width row: first + last name side by side. */
    profileClientNameRow:
        'group app-field-row px-2 py-1 sm:px-2.5 sm:py-1.5 md:col-span-2',
    profileClientNamePairGrid: 'grid grid-cols-1 gap-1 sm:grid-cols-2 sm:gap-2',
    profileClientNameCell:
        'grid min-w-0 grid-cols-1 items-start gap-1 sm:grid-cols-[minmax(0,38%)_minmax(0,62%)] sm:items-center sm:gap-x-2',
    /** Aliases — use formLabel / formValue in new code. */
    readOnlyLabel: 'text-sm font-medium leading-snug app-text-label',
    readOnlyValue: 'text-sm font-normal leading-snug app-text-title',
    fieldLabel: 'text-sm font-medium leading-snug app-text-label',
    /** First-row gate (BOOLEAN / TRUE_ONLY): subtle band, same horizontal padding as body. */
    sectionGateBand: 'border-b border-[color:var(--app-border)] bg-stone-50/50 px-2 py-1 sm:px-2.5 sm:py-1.5 dark:bg-zinc-900/40',
    sectionBodyHint:
        'mx-2 mb-2 flex items-start gap-2 rounded-md border border-amber-200/80 bg-amber-50/60 px-2.5 py-1.5 text-xs font-normal leading-snug text-amber-950 sm:mx-2.5',
    /** Option radios / checkboxes — no extra box around controls. */
    controlChoiceShell: 'flex w-full flex-col gap-1',
    /** Rounded pill radio (native input hidden). */
    roundedChoiceButton:
        'flex h-full min-h-8 min-w-0 w-full cursor-pointer select-none items-center justify-start rounded-xl border border-[color:var(--app-border)] app-surface px-2.5 py-1 text-left text-[13px] font-medium leading-snug app-text-label shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all duration-150 ease-out hover:border-stone-300 hover:bg-stone-50/80 active:scale-[0.985] transform-gpu dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-500/20 dark:focus-visible:ring-sky-400/25 sm:px-2.5',
    roundedChoiceButtonLabel:
        'block w-full min-w-0 text-left text-[13px] leading-snug line-clamp-2 [overflow-wrap:anywhere] [word-break:break-word]',
    /** Narrow medicine column: single-line label (no per-character wrap). */
    roundedChoiceButtonLabelMedicine:
        'block max-w-full truncate text-left text-xs font-medium leading-none whitespace-nowrap sm:text-sm',
    roundedChoiceGrid: 'grid w-full min-w-0 auto-rows-[minmax(2rem,auto)] items-stretch',
    /** Pills: stack on phone/tablet/md; one row from lg+ (test type, risk behavior, etc.). */
    optionPillsOneRow:
        'flex w-full min-w-0 flex-col gap-1 lg:flex-row lg:flex-nowrap lg:items-stretch',
    /** Horizontal scroll only when needed on larger narrow viewports. */
    optionPillsOneRowScroll:
        'flex w-full min-w-0 flex-row flex-nowrap items-stretch gap-1 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]',
    roundedChoiceButtonSelected:
        'border-[var(--app-header-bar-bg)] bg-[var(--app-header-bar-bg)] text-white shadow-sm font-semibold hover:border-[var(--app-header-bar-bg)] hover:bg-[var(--app-header-bar-bg)]',
    sectionBodyGrid: 'flex flex-col divide-y divide-[color:var(--app-border)]',
    /** Symptom / checklist sections: 2 columns like paper form sections 1–2. */
    symptomToggleGrid:
        'grid grid-cols-1 gap-px bg-[color:var(--app-border)] lg:grid-cols-2',
    /** Lab other-tests (PCR + site checkboxes): always one column. */
    symptomToggleGridSingle: 'grid grid-cols-1 gap-px bg-[color:var(--app-border)]',
    /** Square checkbox like the paper form (□), right side of checklist row. */
    paperCheckbox:
        'h-4 w-4 shrink-0 cursor-pointer rounded-[2px] border border-stone-400 app-surface accent-[var(--app-header-bar-bg)] focus:outline-none focus:ring-1 focus:ring-[rgba(44,102,147,0.35)] disabled:cursor-not-allowed disabled:opacity-50',
    /** Shared padding for 2-col paper/symptom cells (label + control). */
    paperGridCellRow: PAPER_GRID_CELL_ROW,
    /** One checklist cell: Khmer label left, checkbox right (paper row). */
    toggleFieldRow: `${PAPER_GRID_CELL_BASE} flex w-full items-start cursor-pointer transition-colors hover:bg-slate-50/80 active:bg-slate-100/90 dark:hover:bg-zinc-900/80 dark:active:bg-zinc-900`,
    toggleFieldRowActive:
        'bg-app-tint-8 border-l-2 border-l-[var(--app-header-bar-bg)]',
    /** Label | fixed-width checkbox column so every row aligns on the right. */
    toggleFieldRowInner:
        'grid w-full min-w-0 grid-cols-1 items-center gap-y-1 lg:grid-cols-[minmax(0,1fr)_2rem] lg:gap-x-2 lg:gap-y-0',
    toggleFieldLabel: 'min-w-0 text-[13px] font-medium leading-snug app-text-label line-clamp-2',
    toggleFieldCheckboxCol: 'flex h-full w-full items-center justify-end',
    /** Text/date fields in paper grid — same row height, hover, and padding as toggle rows. */
    inlineFieldRow: `${PAPER_GRID_CELL_BASE} w-full transition-colors hover:bg-slate-50/80 focus-within:bg-slate-50/50 dark:hover:bg-zinc-900/80 dark:focus-within:bg-zinc-900/50`,
    fieldRowInlineInner:
        'grid w-full min-w-0 grid-cols-1 items-center gap-y-1 lg:grid-cols-[minmax(0,1fr)_2rem] lg:gap-x-2 lg:gap-y-0',
    /** Label | option pills (2-col grid inside control — no overlapping flex). */
    fieldRowInlineInnerOptions:
        'grid w-full min-w-0 grid-cols-1 items-center gap-y-1 lg:grid-cols-[minmax(0,42%)_minmax(0,58%)] lg:gap-x-2 lg:gap-y-0',
    fieldRowInlineInnerWideControl:
        'grid w-full min-w-0 grid-cols-1 items-center gap-y-1 lg:grid-cols-[minmax(0,42%)_minmax(0,58%)] lg:gap-x-2 lg:gap-y-0',
    fieldRowInlineOptionControl: 'relative z-0 min-w-0 w-full self-stretch',
    toggleFieldRowInnerOptions:
        'grid w-full min-w-0 grid-cols-1 items-center gap-y-1 lg:grid-cols-[minmax(0,42%)_minmax(0,58%)] lg:gap-x-2 lg:gap-y-0',
    toggleFieldOptionControl: 'relative z-0 min-w-0 w-full self-stretch',
    /** Text/code in paper cell — same right column width as checkboxes, slightly wider for typing. */
    fieldRowInlineInnerText:
        'grid w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(5.5rem,7.5rem)] items-center gap-x-2',
    fieldRowInlineTextControl: 'flex w-full min-w-0 items-center justify-end',
    fieldRowInlineControl:
        'flex min-w-0 w-full max-w-full shrink-0 items-center justify-start text-[13px] lg:max-w-[7.5rem] lg:justify-end [&_button]:h-8 [&_button]:text-[13px] [&_input]:h-8 [&_input]:min-h-8 [&_input]:text-[13px]',
    /** Inline paper row: enough width for dd/MM/yyyy + calendar + chevron. */
    fieldRowInlineDateControl:
        'flex min-w-[12.5rem] flex-1 shrink-0 items-stretch sm:min-w-[13.5rem] [&_button]:h-8 [&_button]:min-h-8 [&_button]:text-[13px]',
    /** Multi-option DE: options in 2-col grid (paper section 2); 1 col on phones. */
    symptomChecklistGrid: 'grid w-full grid-cols-1 gap-px bg-[color:var(--app-border)] lg:grid-cols-2',
    /** Lab site checkboxes: one column (label | □ per row). */
    symptomChecklistGridSingle: 'grid w-full grid-cols-1 gap-px bg-[color:var(--app-border)]',
    symptomChecklistCell: `${PAPER_GRID_CELL_GRID} w-full cursor-pointer grid-cols-[minmax(0,1fr)_2rem] gap-x-2 transition-colors hover:bg-stone-50/80 dark:hover:bg-zinc-900/80`,
    symptomChecklistCellActive: 'bg-app-tint-8',
    symptomChecklistLabel: 'min-w-0 text-[13px] font-medium leading-snug app-text-label line-clamp-2',
    symptomChecklistCheckboxCol: 'flex w-full items-center justify-end',
    /** Full-width row inside a 2-col symptom section (dates, text, etc.). */
    symptomFullWidthCell: 'w-full app-paper-cell',
    /** 3-option field: title then one row of pills (full width in paper / lab grid). */
    pillBelowTitleRow: `${PAPER_GRID_CELL_BASE} w-full [grid-column:1/-1]`,
    /** Checkbox row under test-type pills — always full width (one column of sites). */
    paperCheckboxFullRow: 'w-full app-paper-cell [grid-column:1/-1]',
    pillBelowTitleInner: 'flex w-full min-w-0 flex-col gap-1',
    pillBelowTitleLabelRow: 'flex min-w-0 items-start gap-2',
    pillBelowTitleControl: 'w-full min-w-0 [&_[role=radiogroup]]:w-full',
    /** Partner SMH code: label in front, full-width search control (spans 2 cols). */
    partnerSmhSearchRow: `${PAPER_GRID_CELL_BASE} col-span-2 flex w-full flex-col gap-1 sm:grid sm:grid-cols-[minmax(0,38%)_minmax(0,62%)] sm:items-center sm:gap-x-2`,
    partnerSmhSearchLabel: 'shrink-0 text-[13px] font-medium leading-snug app-text-label',
    partnerSmhSearchControl: 'min-w-0 w-full flex-1',
    /** Partner profile modal — same 2-col grid as profile tab, compact cells. */
    partnerProfileModalGrid: 'grid grid-cols-1 gap-px sm:grid-cols-2',
    partnerProfileModalCell: 'app-paper-cell px-2.5 py-2 sm:px-3 sm:py-2.5',
    partnerProfileModalCellInner:
        'flex min-w-0 items-start gap-2 sm:gap-3',
    partnerProfileModalLabel: 'min-w-0 shrink-0 text-sm font-medium leading-snug app-text-label sm:w-[42%] sm:max-w-[9rem]',
    partnerProfileModalValue: 'min-w-0 flex-1 break-words text-sm font-normal leading-snug app-text-title',
    /** Paper form: ក / ខ groups with nested ១ / ២ children. */
    khmerGroupedSection: 'flex flex-col gap-0',
    khmerGroupedLoose: 'border-b border-slate-200/80 app-paper-cell dark:border-zinc-800',
    khmerLetterGroup:
        'border-b border-slate-200/90 app-paper-cell last:border-b-0 dark:border-zinc-800',
    khmerLetterGroupHeader:
        'flex items-center gap-2 border-b border-[color:var(--app-border)] bg-app-tint-5 px-2 py-1 sm:px-2.5 sm:py-1.5',
    khmerLetterGroupHeaderRow: 'border-b border-slate-100/90',
    khmerLetterBadge:
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border-2 border-[var(--app-header-bar-bg)] app-surface text-base font-bold text-[var(--app-header-bar-bg)]',
    khmerLetterBadgeMuted:
        'flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-300 bg-slate-50 text-sm font-semibold text-slate-600 dark:border-zinc-800 dark:bg-black dark:text-zinc-300',
    khmerLetterGroupTitle: 'min-w-0 flex-1 text-xs font-semibold leading-snug text-slate-700 dark:text-zinc-200',
    khmerSubgroup: 'border-b border-slate-100/90 last:border-b-0',
    khmerSubgroupHeader:
        'flex flex-wrap items-center gap-1.5 border-b border-[color:var(--app-border)] bg-stone-50/80 px-2 py-1 pl-4 sm:pl-5 dark:bg-zinc-900/50',
    khmerSubgroupTitle: 'min-w-0 flex-1 text-sm font-medium leading-snug app-text-label',
    khmerChildBadge:
        'flex h-7 min-w-[1.75rem] shrink-0 items-center justify-center rounded-md border border-slate-300 app-surface px-1.5 text-sm font-bold tabular-nums text-slate-800 dark:border-zinc-800 dark:text-zinc-100',
    khmerSubgroupBody: 'pl-0 sm:pl-1',
    khmerSubgroupIndented: 'border-l-2 border-slate-200/90 ml-2 sm:ml-3',
    /** ក / ខ / គ option row block (paper sections 5–6). */
    paperLetterChoiceBlock: 'border-b border-slate-200/80 app-paper-cell dark:border-zinc-800',
    paperLetterChoiceFollow:
        'border-t border-slate-100/90 bg-slate-50/40 dark:border-zinc-800 dark:bg-black',
    /** Inline ក / ខ / គ prefix inside a checklist row. */
    khmerInlinePrefix:
        'flex h-7 w-7 shrink-0 items-center justify-center rounded border-2 border-[var(--app-header-bar-bg)] app-surface text-sm font-bold text-[var(--app-header-bar-bg)]',
    /** Medicine slot: stack through md; 5 equal columns from lg+. */
    medicineSectionBodyGrid:
        'grid w-full min-w-0 grid-cols-1 divide-y divide-slate-100 border-t border-slate-100 dark:divide-zinc-800 dark:border-zinc-800 lg:grid-cols-5 lg:divide-x lg:divide-y-0',
    /** One medicine column — same width as siblings (min-w-0 stops label overflow). */
    medicineGridFieldRow:
        'group flex h-full min-w-0 flex-col px-2 py-1 transition-colors focus-within:bg-stone-50/50 dark:focus-within:bg-zinc-900/50 lg:px-2 lg:py-1.5',
    medicineGridFieldRowInner:
        'flex w-full min-w-0 flex-col gap-2 [&_button]:w-full [&_span]:min-w-0',
    medicineGridFieldLabel:
        'line-clamp-2 min-w-0 text-sm font-medium leading-snug app-text-label [overflow-wrap:anywhere]',
    medicineAddFooter:
        'flex justify-end border-t border-[color:var(--app-border)] app-surface px-2 py-1.5 sm:px-2.5',
    medicineAddButton:
        'h-auto min-h-8 gap-2 rounded-md border border-[var(--app-header-bar-bg)]/35 app-surface py-1 pl-1.5 pr-3 transition-colors hover:border-[var(--app-header-bar-bg)] hover:bg-app-tint-5 focus-visible:ring-1 focus-visible:ring-[rgba(44,102,147,0.35)] disabled:pointer-events-none disabled:opacity-50',
    medicineAddButtonIcon:
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--app-header-bar-bg)] text-white',
    medicineAddButtonMeta: 'text-xs font-medium tabular-nums app-text-meta',
    /** Medicine block inside .paper-doc — no app card chrome */
    paperMedicineBlock: 'paper-medicine-block',
    paperMedicineBody: 'paper-medicine-fields',
    paperMedicineAddFooter: 'paper-medicine-add-footer',
    /** One field: label on top, control below (profile + stage). */
    fieldRow:
        'group app-field-row px-2 py-1 sm:px-2.5 sm:py-1.5',
    fieldRowInner: 'grid w-full grid-cols-1 gap-1 sm:grid-cols-1 sm:gap-1.5 [&_button]:shadow-none [&_input]:shadow-none',
    /** Client-side validation failed for this row (scroll target + red tint). */
    fieldRowInvalid:
        'bg-rose-50/95 ring-2 ring-inset ring-red-300/80 hover:bg-rose-50/95 focus-within:bg-rose-50/95',
    hint: 'text-sm font-normal app-text-meta text-center max-w-md leading-relaxed px-4',
    loadingText: 'text-sm font-normal app-text-meta',
    toastTitle: 'text-sm font-semibold leading-snug mb-0.5',
    toastBody: 'text-sm font-normal leading-snug opacity-90',
    toolbarPrimary:
        'h-8 rounded-md px-3 text-[13px] font-medium transition-colors disabled:opacity-50',
    toolbarSecondary:
        'h-8 rounded-md px-3 text-[13px] font-medium border border-[color:var(--app-border)] app-surface app-text-label hover:bg-stone-50/80 transition-colors dark:hover:bg-zinc-800',
    tab: 'box-border inline-flex h-7 max-h-7 items-center justify-center rounded-md border px-2 text-xs font-medium leading-none transition-colors md:h-8 md:max-h-8 md:px-2.5 md:text-[13px]',
    /** Completed visit — subtle banner only; sections stay normal white cards. */
    visitCompleteBanner:
        'rounded-lg border border-emerald-200/90 bg-emerald-50 px-4 py-2.5 text-sm leading-snug text-emerald-900',
    visitCompleteFormShell: '',
    visitCompleteStepNav: 'rounded-lg border border-slate-200/90 bg-slate-50 px-2 py-2 dark:border-zinc-800 dark:bg-black',
    visitCompleteSectionCard: 'rounded-lg border border-slate-200/90 app-surface dark:border-zinc-800',
    visitCompleteSectionHeaderBar:
        'app-section-header flex flex-wrap items-center justify-between gap-1.5 px-3 py-2',
    visitCompleteSectionGateBand: 'border-b border-slate-100 bg-slate-50/50 dark:border-zinc-800 dark:bg-black px-3 py-2',
    visitCompleteSectionBodyGrid: 'flex flex-col divide-y divide-slate-100 dark:divide-zinc-800',
    visitCompleteFieldRow:
        'group bg-slate-50/80 px-3 py-2.5 transition-colors hover:bg-slate-50 dark:bg-zinc-950 dark:hover:bg-zinc-900',
    stageFormStickyActions:
        'sticky bottom-0 z-30 -mx-2.5 -mb-2.5 sm:-mx-3 sm:-mb-3 mt-4 border-t border-slate-200/80 bg-white/85 px-3.5 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl shadow-[0_-8px_20px_rgba(0,0,0,0.06)] dark:border-zinc-800/80 dark:bg-zinc-950/85 md:hidden',
}

/**
 * Stable DOM id for validated form rows (scroll + error highlight).
 * @param {'de'|'attr'} scope — program stage data element vs registration attribute
 * @param {string} id
 */
export function captureFieldDomId(scope, id) {
    return `capture-field-${scope}-${id}`
}

/** Full-width fields: same height, radius, type scale as Input/Select defaults. */
export function formControlClasses(className) {
    return cn(
        'h-8 min-h-8 w-full rounded-md border border-[color:var(--app-border)] bg-white px-2 text-[13px] font-normal app-text-title shadow-none',
        'placeholder:app-text-meta focus:border-[var(--app-header-bar-bg)] focus:ring-1 focus:ring-[rgba(44,102,147,0.2)] focus:outline-none',
        'dark:border-zinc-800 dark:bg-black dark:focus:bg-black',
        'transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        className
    )
}

/** Compact inputs inside paper/symptom 2-col grid cells. */
export function formControlPaperClasses(className) {
    return formControlClasses(
        cn('h-8 min-h-8 shadow-none', className)
    )
}

/** Inline paper cell: compact, right-aligned, matches checkbox border weight. */
/** Partner SMH search input — full width, rounded-md. */
export function formControlPaperSearchClasses(className) {
    return formControlClasses(className)
}

export function formControlPaperInlineClasses(className) {
    return cn(
        'h-8 min-h-8 w-full max-w-full rounded-[3px] border border-stone-400 app-surface px-2 text-left text-[13px] font-normal app-text-title lg:max-w-[7.5rem] lg:text-right',
        'placeholder:app-text-meta focus:border-[var(--app-header-bar-bg)] focus:outline-none focus:ring-1 focus:ring-[rgba(44,102,147,0.2)] shadow-none',
        'dark:border-zinc-800',
        'transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        className
    )
}

/** Medicine slot selects — flat, no extra shadow layer. */
export function formControlMedicineClasses(className) {
    return formControlClasses(
        cn(
            'h-8 min-h-8 border-[color:var(--app-border)] bg-[var(--app-surface)] shadow-none hover:bg-[var(--app-surface)] focus:bg-[var(--app-surface)]',
            className
        )
    )
}
