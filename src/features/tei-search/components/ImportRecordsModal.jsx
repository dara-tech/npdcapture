import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import i18n from '@dhis2/d2-i18n'
import { Cross2Icon, GearIcon, UploadIcon } from '@radix-ui/react-icons'
import { FileSpreadsheet, FileText, Upload } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Spinner } from '../../../components/ui/spinner'
import { MODAL } from '../../../lib/overlayUi'
import { cn } from '../../../lib/utils'
import { parseRecordsImportFile } from '../lib/parseRecordsImport'
import { importRecords } from '../lib/importRecords'
import { downloadRecordsImportTemplate } from '../lib/recordsImportTemplate'
import { parseStageRecordsImportFile } from '../lib/parseStageRecordsImport'
import { importStageRecords } from '../lib/importStageRecords'
import { downloadStageImportTemplate } from '../lib/stageRecordsImportTemplate'
import { parseCombinedRecordsImportFile } from '../lib/parseCombinedRecordsImport'
import { importProfileWithStageRecords } from '../lib/importProfileWithStageRecords'
import { downloadCombinedImportTemplate } from '../lib/combinedRecordsImportTemplate'
import {
    downloadCombinedImportExcel,
    downloadPersonnelImportExcel,
    downloadStageImportExcel,
} from '../lib/importTemplateExcel'
import { getStageFormColumnsForImport } from '../lib/stageImportSections'
import {
    defaultTemplateAttributeIds,
    defaultTemplateDataElementIds,
} from '../lib/importTemplateDefaults'
import { ImportTemplateFieldsPicker } from './ImportTemplateFieldsPicker'
import { Select } from '../../../components/ui/select'
import {
    DEFAULT_SKIP_ROWS_AFTER_HEADER,
    normalizeSkipRowsAfterHeader,
} from '../lib/importRowSkip'

const IMPORT_MODES = {
    personnel: 'personnel',
    stages: 'stages',
    profileWithStage: 'profileWithStage',
}

const ACCEPT_IMPORT_FILES =
    '.csv,.json,.xlsx,.xls,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const IconToolButton = ({
    label,
    onClick,
    disabled = false,
    active = false,
    children,
}) => (
    <button
        type="button"
        title={label}
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
            active
                ? 'border-[var(--app-header-bar-bg)] bg-[rgba(44,102,147,0.12)] text-[var(--app-header-bar-bg)]'
                : 'border-slate-200/90 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-[color:var(--app-border)] dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800',
            disabled && 'pointer-events-none'
        )}
    >
        {children}
    </button>
)

const TemplateDownloadButton = ({
    label,
    onClick,
    disabled = false,
    loading = false,
    children,
}) => (
    <button
        type="button"
        disabled={disabled || loading}
        onClick={onClick}
        className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
            'border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40',
            'dark:border-[color:var(--app-border)] dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'
        )}
    >
        {loading ? (
            <Spinner className="h-4 w-4 border-slate-200 border-t-[var(--app-header-bar-bg)]" />
        ) : (
            children
        )}
        <span>{label}</span>
    </button>
)

export const ImportRecordsModal = ({
    open,
    onClose,
    engine,
    context,
    programAttributes = [],
    programStages = [],
    onImported,
    isSuperuser = false,
}) => {
    const inputRef = useRef(null)
    const lastFileRef = useRef(null)
    const [importMode, setImportMode] = useState(IMPORT_MODES.personnel)
    const [parsedRows, setParsedRows] = useState([])
    const [parseErrors, setParseErrors] = useState([])
    const [parseWarnings, setParseWarnings] = useState([])
    const [fileName, setFileName] = useState('')
    const [importing, setImporting] = useState(false)
    const [progress, setProgress] = useState({ done: 0, total: 0 })
    const [results, setResults] = useState(null)
    const [selectedStageId, setSelectedStageId] = useState('')
    const [templateAttrIds, setTemplateAttrIds] = useState([])
    const [templateDeIds, setTemplateDeIds] = useState([])
    const [downloadingExcel, setDownloadingExcel] = useState(false)
    const [showTemplateColumns, setShowTemplateColumns] = useState(false)
    const [parsingFile, setParsingFile] = useState(false)
    const [dragOver, setDragOver] = useState(false)
    const [skipRowsAfterHeader, setSkipRowsAfterHeader] = useState(
        DEFAULT_SKIP_ROWS_AFTER_HEADER
    )

    const sortedStages = useMemo(
        () =>
            [...(programStages || [])].sort(
                (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
            ),
        [programStages]
    )

    const stageOptions = useMemo(
        () =>
            sortedStages.map((s) => ({
                value: s.id,
                label: s.displayName || s.name || s.id,
            })),
        [sortedStages]
    )

    const selectedStage = useMemo(
        () => sortedStages.find((s) => s.id === selectedStageId) || null,
        [sortedStages, selectedStageId]
    )

    const stageColumns = useMemo(
        () => (selectedStage ? getStageFormColumnsForImport(selectedStage) : []),
        [selectedStage]
    )

    useEffect(() => {
        if (!sortedStages.length) {
            setSelectedStageId('')
            return
        }
        setSelectedStageId((prev) =>
            prev && sortedStages.some((s) => s.id === prev)
                ? prev
                : sortedStages[0].id
        )
    }, [sortedStages])

    useEffect(() => {
        if (!open) return
        setTemplateAttrIds(defaultTemplateAttributeIds(programAttributes))
        setSkipRowsAfterHeader(DEFAULT_SKIP_ROWS_AFTER_HEADER)
    }, [open, programAttributes])

    useEffect(() => {
        if (!selectedStage) {
            setTemplateDeIds([])
            return
        }
        setTemplateDeIds(defaultTemplateDataElementIds(selectedStage))
    }, [selectedStageId, selectedStage])

    const isStageMode = importMode === IMPORT_MODES.stages
    const isCombinedMode = importMode === IMPORT_MODES.profileWithStage
    const needsStagePick = isStageMode || isCombinedMode
    const needsTrackedEntityType =
        importMode === IMPORT_MODES.personnel ||
        importMode === IMPORT_MODES.profileWithStage

    const importBlockedReason = useMemo(() => {
        if (importing) return null
        if (!parsedRows.length) {
            return i18n.t('Choose a file with at least one data row below the header.')
        }
        if (!context?.orgUnit) {
            return i18n.t('Select an organisation unit in the main page filters.')
        }
        if (!context?.program) {
            return i18n.t('Select a program in the main page filters.')
        }
        if (needsTrackedEntityType && !context?.trackedEntityType) {
            return i18n.t(
                'This program has no tracked entity type. Re-select the program in the filters.'
            )
        }
        if (needsStagePick && !selectedStageId) {
            return i18n.t('Select a program stage above.')
        }
        return null
    }, [
        importing,
        parsedRows.length,
        context?.orgUnit,
        context?.program,
        context?.trackedEntityType,
        needsTrackedEntityType,
        needsStagePick,
        selectedStageId,
    ])

    const canImport = !importBlockedReason

    useEffect(() => {
        if (!open || !importing) return undefined
        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
            }
        }
        window.addEventListener('keydown', onKeyDown, true)
        return () => window.removeEventListener('keydown', onKeyDown, true)
    }, [open, importing])

    const reset = () => {
        lastFileRef.current = null
        setParsedRows([])
        setParseErrors([])
        setParseWarnings([])
        setFileName('')
        setResults(null)
        setProgress({ done: 0, total: 0 })
        setShowTemplateColumns(false)
        setSkipRowsAfterHeader(DEFAULT_SKIP_ROWS_AFTER_HEADER)
        if (inputRef.current) inputRef.current.value = ''
    }

    const handleClose = () => {
        if (importing) return
        reset()
        onClose()
    }

    const handleModeChange = (mode) => {
        if (mode === importMode) return
        setImportMode(mode)
        setTemplateAttrIds(defaultTemplateAttributeIds(programAttributes))
        if (selectedStage) {
            setTemplateDeIds(defaultTemplateDataElementIds(selectedStage))
        }
        reset()
    }

    const parseOptions = {
        programAttributes,
        programStages,
        defaultStageId: selectedStageId || undefined,
        attributeIds: templateAttrIds,
        dataElementIds: templateDeIds,
        skipRowsAfterHeader: normalizeSkipRowsAfterHeader(skipRowsAfterHeader),
    }

    const clearParsedFile = () => {
        lastFileRef.current = null
        setParsedRows([])
        setParseErrors([])
        setParseWarnings([])
        setResults(null)
        setFileName('')
        if (inputRef.current) inputRef.current.value = ''
    }

    const handleStageChange = (stageId) => {
        setSelectedStageId(stageId)
        if (fileName) clearParsedFile()
    }

    const parseImportFile = async (file) => {
        const mode = importMode
        const { rows, errors, warnings } =
            mode === IMPORT_MODES.profileWithStage
                ? await parseCombinedRecordsImportFile(file, parseOptions)
                : mode === IMPORT_MODES.stages
                  ? await parseStageRecordsImportFile(file, parseOptions)
                  : await parseRecordsImportFile(file, programAttributes, parseOptions)

        setParsedRows(rows)
        setParseErrors(errors)
        setParseWarnings(warnings || [])

        if (!rows.length && !errors.length) {
            setParseErrors([
                i18n.t(
                    'No rows found in this file. Use the downloaded template, add data under the header row, and include eventDate for visits.'
                ),
            ])
        } else if (
            !rows.length &&
            errors.length > 0 &&
            mode === IMPORT_MODES.profileWithStage
        ) {
            setParseErrors((prev) => [
                i18n.t(
                    'No importable rows. Add data from row 3 onward (row 2 is the example), include profile fields and eventDate for visits, or re-download the template.'
                ),
                ...prev,
            ])
        }
    }

    const handleFile = async (file) => {
        if (!file || importing) return
        lastFileRef.current = file
        setResults(null)
        setParsingFile(true)
        setFileName(file.name)

        try {
            await parseImportFile(file)
        } finally {
            setParsingFile(false)
            setDragOver(false)
        }
    }

    useEffect(() => {
        const file = lastFileRef.current
        if (!open || !file || !fileName || importing || parsingFile) return undefined

        let cancelled = false
        ;(async () => {
            setParsingFile(true)
            try {
                await parseImportFile(file)
            } finally {
                if (!cancelled) setParsingFile(false)
            }
        })()

        return () => {
            cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- re-parse when skip count changes
    }, [skipRowsAfterHeader])

    const onFileInputChange = (e) => {
        handleFile(e.target.files?.[0])
        e.target.value = ''
    }

    const onDropFile = (e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragOver(false)
        if (importing || parsingFile) return
        const file = e.dataTransfer.files?.[0]
        if (file) handleFile(file)
    }

    const toggleTemplateAttr = (id) => {
        setTemplateAttrIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        )
    }

    const toggleTemplateDe = (id) => {
        setTemplateDeIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        )
    }

    const handleDownloadTemplate = () => {
        if (isCombinedMode) {
            downloadCombinedImportTemplate({
                programAttributes,
                programStages,
                stageId: selectedStageId,
                attributeIds: templateAttrIds,
                dataElementIds: templateDeIds,
            })
        } else if (isStageMode) {
            downloadStageImportTemplate({
                programStages,
                programAttributes,
                stageId: selectedStageId,
                dataElementIds: templateDeIds,
            })
        } else {
            downloadRecordsImportTemplate({
                programAttributes,
                attributeIds: templateAttrIds,
            })
        }
    }

    const handleDownloadExcelTemplate = async () => {
        setDownloadingExcel(true)
        try {
            if (isCombinedMode) {
                await downloadCombinedImportExcel({
                    programAttributes,
                    programStages,
                    stageId: selectedStageId,
                    attributeIds: templateAttrIds,
                    dataElementIds: templateDeIds,
                })
            } else if (isStageMode) {
                await downloadStageImportExcel({
                    programStages,
                    programAttributes,
                    stageId: selectedStageId,
                    dataElementIds: templateDeIds,
                })
            } else {
                await downloadPersonnelImportExcel({
                    programAttributes,
                    attributeIds: templateAttrIds,
                })
            }
        } finally {
            setDownloadingExcel(false)
        }
    }

    const templateDownloadDisabled =
        importing ||
        (isCombinedMode
            ? !programStages.length ||
              !programAttributes.length ||
              !selectedStageId ||
              templateAttrIds.length === 0 ||
              templateDeIds.length === 0
            : isStageMode
              ? !programStages.length ||
                !selectedStageId ||
                templateDeIds.length === 0
              : !programAttributes.length || templateAttrIds.length === 0)

    const handleImport = async () => {
        if (!canImport || importing) return
        setImporting(true)
        setResults(null)
        try {
            const summary = isCombinedMode
                ? await importProfileWithStageRecords({
                      engine,
                      context,
                      rows: parsedRows,
                      programAttributes,
                      programStages,
                      onProgress: (done, total) => setProgress({ done, total }),
                  })
                : isStageMode
                  ? await importStageRecords({
                        engine,
                        context,
                        rows: parsedRows,
                        programAttributes,
                        programStages,
                        onProgress: (done, total) => setProgress({ done, total }),
                    })
                  : await importRecords({
                        engine,
                        context,
                        rows: parsedRows,
                        programAttributes,
                        onProgress: (done, total) => setProgress({ done, total }),
                    })
            setResults(summary)
            if (summary.created > 0) {
                await onImported?.()
            }
        } finally {
            setImporting(false)
        }
    }

    const modeHint = i18n.t('Download template · fill from row 3 · import file below')

    const importProgressPct =
        progress.total > 0 ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0

    const templateSettingsButton = isSuperuser ? (
        <IconToolButton
            label={i18n.t('Template column settings')}
            active={showTemplateColumns}
            disabled={importing || parsingFile}
            onClick={() => setShowTemplateColumns((v) => !v)}
        >
            <GearIcon className="h-4 w-4" />
        </IconToolButton>
    ) : null

    if (!open || typeof document === 'undefined') return null

    return createPortal(
        <div
            className={MODAL.backdrop}
            onClick={importing ? undefined : handleClose}
        >
            <div
                className={cn(MODAL.panelLg, 'flex max-h-[90vh] max-w-xl flex-col')}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="import-records-title"
            >
                <div className={cn(MODAL.header, 'shrink-0 py-4')}>
                    <div className="absolute right-6 top-6 flex items-center gap-1.5">
                        {templateSettingsButton}
                        <button
                            type="button"
                            onClick={handleClose}
                            disabled={importing}
                            className={cn(
                                MODAL.closeBtn,
                                'static right-auto top-auto shrink-0'
                            )}
                            aria-label={i18n.t('Close')}
                        >
                            <Cross2Icon className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="flex items-center gap-3 pr-20">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--app-header-bar-bg)] text-white">
                            <UploadIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2
                                id="import-records-title"
                                className="text-base font-bold tracking-tight app-text-title md:text-lg"
                            >
                                {i18n.t('Import records')}
                            </h2>
                            <p className="mt-0.5 text-xs app-text-meta">{modeHint}</p>
                        </div>
                    </div>
                </div>

                {importing ? (
                    <div
                        className="shrink-0 border-b border-[var(--app-header-bar-bg)]/30 bg-[rgba(44,102,147,0.08)] px-5 py-2.5 dark:bg-[rgba(44,102,147,0.15)]"
                        role="status"
                        aria-live="polite"
                    >
                        <div className="flex items-center justify-between gap-3 text-xs font-semibold text-[var(--app-header-bar-bg)]">
                            <span className="flex items-center gap-2">
                                <Spinner className="h-3.5 w-3.5 border-slate-200 border-t-[var(--app-header-bar-bg)]" />
                                {i18n.t('Import in progress — please wait')}
                            </span>
                            <span>
                                {progress.done}/{progress.total} ({importProgressPct}%)
                            </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-zinc-700">
                            <div
                                className="h-full rounded-full bg-[var(--app-header-bar-bg)] transition-[width] duration-300 ease-out"
                                style={{ width: `${importProgressPct}%` }}
                            />
                        </div>
                    </div>
                ) : null}

                <div className="min-h-0 flex-1 space-y-3 overflow-auto px-5 py-3">
                    <div className={cn(MODAL.segmentTrack, 'w-full')}>
                        {[
                            IMPORT_MODES.personnel,
                            IMPORT_MODES.profileWithStage,
                            IMPORT_MODES.stages,
                        ].map((mode) => (
                            <button
                                key={mode}
                                type="button"
                                disabled={importing}
                                onClick={() => handleModeChange(mode)}
                                className={cn(
                                    'flex-1 rounded-xl px-1 py-1.5 text-[10px] font-bold uppercase leading-tight tracking-wide transition-all sm:text-[11px]',
                                    importMode === mode
                                        ? MODAL.segmentActive
                                        : MODAL.segmentIdle
                                )}
                            >
                                {mode === IMPORT_MODES.personnel
                                    ? i18n.t('Personnel')
                                    : mode === IMPORT_MODES.profileWithStage
                                      ? i18n.t('Profile + stage')
                                      : i18n.t('Stage only')}
                            </button>
                        ))}
                    </div>

                    {needsStagePick ? (
                        <div className="space-y-1.5">
                            <label
                                htmlFor="import-stage-select"
                                className="text-xs font-semibold app-text-label"
                            >
                                {i18n.t('Program stage')}
                            </label>
                            <div className="flex items-center gap-2">
                                {sortedStages.length > 1 ? (
                                    <Select
                                        id="import-stage-select"
                                        className="min-w-0 flex-1"
                                        value={selectedStageId}
                                        onValueChange={handleStageChange}
                                        options={stageOptions}
                                        placeholder={i18n.t('Select stage')}
                                        disabled={importing || parsingFile}
                                    />
                                ) : selectedStage ? (
                                    <span className="min-w-0 flex-1 truncate text-sm font-medium app-text-title">
                                        {selectedStage.displayName ||
                                            selectedStage.name ||
                                            selectedStage.id}
                                    </span>
                                ) : (
                                    <span className="flex-1 text-xs text-amber-700 dark:text-amber-300">
                                        {i18n.t('This program has no stages configured.')}
                                    </span>
                                )}
                            </div>
                        </div>
                    ) : null}

                    {isSuperuser && showTemplateColumns ? (
                        <ImportTemplateFieldsPicker
                            programAttributes={programAttributes}
                            stageColumns={stageColumns}
                            selectedAttributeIds={templateAttrIds}
                            selectedDataElementIds={templateDeIds}
                            onToggleAttribute={toggleTemplateAttr}
                            onToggleDataElement={toggleTemplateDe}
                            onSelectAllAttributes={() =>
                                setTemplateAttrIds(
                                    programAttributes.map((a) => a.id).filter(Boolean)
                                )
                            }
                            onClearAttributes={() => setTemplateAttrIds([])}
                            onSelectAllDataElements={() =>
                                setTemplateDeIds(stageColumns.map((c) => c.de.id))
                            }
                            onClearDataElements={() => setTemplateDeIds([])}
                            showProfile={!isStageMode}
                            showStageFields={needsStagePick && Boolean(selectedStage)}
                            disabled={importing}
                        />
                    ) : null}

                    <div className="rounded-xl border border-slate-200/90 bg-slate-50/40 p-3 dark:border-[color:var(--app-border)] dark:bg-zinc-900/30">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                            {i18n.t('Step 1 — Download template')}
                        </p>
                        <div className="mt-2 flex gap-2">
                            <TemplateDownloadButton
                                label={i18n.t('Excel (.xlsx)')}
                                disabled={
                                    templateDownloadDisabled || downloadingExcel || importing
                                }
                                loading={downloadingExcel}
                                onClick={handleDownloadExcelTemplate}
                            >
                                <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600" />
                            </TemplateDownloadButton>
                            <TemplateDownloadButton
                                label={i18n.t('CSV')}
                                disabled={templateDownloadDisabled || importing}
                                onClick={handleDownloadTemplate}
                            >
                                <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                            </TemplateDownloadButton>
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200/90 bg-white p-3 dark:border-[color:var(--app-border)] dark:bg-zinc-950">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                            {i18n.t('Step 2 — Import file')}
                        </p>
                        <div
                            role="button"
                            tabIndex={importing || parsingFile ? -1 : 0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    inputRef.current?.click()
                                }
                            }}
                            onDragEnter={(e) => {
                                e.preventDefault()
                                if (!importing && !parsingFile) setDragOver(true)
                            }}
                            onDragOver={(e) => {
                                e.preventDefault()
                                if (!importing && !parsingFile) setDragOver(true)
                            }}
                            onDragLeave={(e) => {
                                e.preventDefault()
                                if (e.currentTarget === e.target) setDragOver(false)
                            }}
                            onDrop={onDropFile}
                            onClick={() => {
                                if (!importing && !parsingFile) inputRef.current?.click()
                            }}
                            className={cn(
                                'mt-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors',
                                importing || parsingFile
                                    ? 'cursor-not-allowed opacity-60'
                                    : 'cursor-pointer',
                                dragOver
                                    ? 'border-[var(--app-header-bar-bg)] bg-[rgba(44,102,147,0.08)]'
                                    : 'border-slate-200/90 bg-slate-50/40 hover:border-slate-300 hover:bg-slate-50/70 dark:border-[color:var(--app-border)] dark:bg-zinc-900/40 dark:hover:bg-zinc-900/60'
                            )}
                        >
                            {parsingFile ? (
                                <div className="flex flex-col items-center gap-2">
                                    <Spinner className="h-6 w-6 border-slate-200 border-t-[var(--app-header-bar-bg)]" />
                                    <p className="text-sm font-medium app-text-title">
                                        {i18n.t('Reading file…')}
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm dark:bg-zinc-800">
                                        <Upload className="h-6 w-6 text-[var(--app-header-bar-bg)]" />
                                    </div>
                                    <p className="mt-3 text-sm font-semibold app-text-title">
                                        {i18n.t('Drop file here or click to browse')}
                                    </p>
                                    <p className="mt-1 text-xs app-text-meta">
                                        {fileName
                                            ? fileName
                                            : i18n.t('CSV, Excel (.xlsx), or JSON')}
                                    </p>
                                </>
                            )}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
                            <label
                                htmlFor="import-skip-rows"
                                className="font-medium app-text-label"
                            >
                                {i18n.t('Skip rows after header')}
                            </label>
                            <input
                                id="import-skip-rows"
                                type="number"
                                min={0}
                                max={20}
                                step={1}
                                disabled={importing || parsingFile}
                                value={skipRowsAfterHeader}
                                onChange={(e) =>
                                    setSkipRowsAfterHeader(
                                        normalizeSkipRowsAfterHeader(e.target.value)
                                    )
                                }
                                className={cn(
                                    'h-8 w-16 rounded-lg border px-2 text-center text-sm tabular-nums',
                                    'border-slate-200/90 bg-white app-text-title',
                                    'dark:border-[color:var(--app-border)] dark:bg-zinc-900',
                                    'disabled:opacity-50'
                                )}
                            />
                            <span className="app-text-meta">
                                {i18n.t(
                                    '(default {{count}} = template example row)',
                                    { count: DEFAULT_SKIP_ROWS_AFTER_HEADER }
                                )}
                            </span>
                        </div>
                        <p className="mt-2 text-center text-[11px] leading-relaxed app-text-meta">
                            {i18n.t(
                                'Row 2 is an example — add your data from row 3, or increase skip rows if your file has extra header lines. Empty Yes/No = No (ទេ). Excel template uses Khmer OS font.'
                            )}
                        </p>
                    </div>
                    <input
                        ref={inputRef}
                        type="file"
                        accept={ACCEPT_IMPORT_FILES}
                        className="sr-only"
                        tabIndex={-1}
                        onChange={onFileInputChange}
                    />

                    {parseErrors.length > 0 ? (
                        <div className="rounded-lg border border-red-200/90 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100">
                            {parseErrors.map((msg) => (
                                <p key={msg}>{msg}</p>
                            ))}
                        </div>
                    ) : null}

                    {parseWarnings.length > 0 ? (
                        <div className="rounded-lg border border-amber-200/90 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
                            {parseWarnings.map((msg) => (
                                <p key={msg}>{msg}</p>
                            ))}
                        </div>
                    ) : null}

                    {parsedRows.length > 0 && !results ? (
                        <div className="overflow-hidden rounded-lg border border-slate-200/90 dark:border-[color:var(--app-border)]">
                            <p className="border-b border-slate-100 bg-slate-50/80 px-3 py-2 text-xs font-semibold app-text-title dark:border-[color:var(--app-border)] dark:bg-zinc-900/50">
                                {isCombinedMode
                                    ? i18n.t('{{count}} profile + stage rows ready', {
                                          count: parsedRows.length,
                                      })
                                    : isStageMode
                                      ? i18n.t('{{count}} visits ready to import', {
                                            count: parsedRows.length,
                                        })
                                      : i18n.t('{{count}} records ready to import', {
                                            count: parsedRows.length,
                                        })}
                            </p>
                            <div className="max-h-40 overflow-auto custom-scrollbar text-xs">
                                <table className="w-full text-left">
                                    <thead className="sticky top-0 bg-white text-slate-500 dark:bg-zinc-950">
                                        <tr>
                                            <th className="px-3 py-1.5 font-medium">#</th>
                                            <th className="px-3 py-1.5 font-medium">
                                                {isCombinedMode
                                                    ? i18n.t('Row summary')
                                                    : isStageMode
                                                      ? i18n.t('Visit')
                                                      : i18n.t('Attributes')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-[color:var(--app-border)]">
                                        {parsedRows.slice(0, 6).map((row) => (
                                            <tr key={row.line}>
                                                <td className="px-3 py-1.5 text-slate-400">
                                                    {row.line}
                                                </td>
                                                <td className="px-3 py-1.5 app-text-meta">
                                                    {isCombinedMode ? (
                                                        <>
                                                            {row.attributes?.length || 0}{' '}
                                                            {i18n.t('profile')}{' '}
                                                            {row.hasVisit
                                                                ? `· ${row.stageLabel} · ${row.eventDate}`
                                                                : ''}
                                                        </>
                                                    ) : isStageMode ? (
                                                        <>
                                                            {row.stageLabel} · {row.eventDate}
                                                            {row.dataValues?.length
                                                                ? ` · ${row.dataValues.length} ${i18n.t('field(s)')}`
                                                                : ''}
                                                        </>
                                                    ) : (
                                                        <>
                                                            {row.attributes.length}{' '}
                                                            {i18n.t('field(s)')}
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {parsedRows.length > 6 ? (
                                    <p className="px-3 py-2 text-xs app-text-meta">
                                        {i18n.t('…and {{count}} more', {
                                            count: parsedRows.length - 6,
                                        })}
                                    </p>
                                ) : null}
                            </div>
                        </div>
                    ) : null}

                    {results ? (
                        <div
                            className={cn(
                                'rounded-lg border px-3 py-2 text-sm',
                                results.failed > 0
                                    ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100'
                                    : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100'
                            )}
                        >
                            <p className="font-semibold">
                                {isCombinedMode && results.personnelCreated != null
                                    ? i18n.t(
                                          '{{registered}} registered, {{visits}} visits, {{failed}} failed',
                                          {
                                              registered: results.personnelCreated,
                                              visits: results.visitsCreated ?? 0,
                                              failed: results.failed,
                                          }
                                      )
                                    : i18n.t('{{created}} created, {{failed}} failed', {
                                          created: results.created,
                                          failed: results.failed,
                                      })}
                            </p>
                            {results.warnings?.length > 0 ? (
                                <ul className="mt-2 max-h-24 list-disc space-y-1 overflow-auto pl-4 text-xs">
                                    {results.warnings.slice(0, 8).map((msg) => (
                                        <li key={msg}>{msg}</li>
                                    ))}
                                </ul>
                            ) : null}
                            {results.errors?.length > 0 ? (
                                <ul className="mt-2 max-h-32 list-disc space-y-1 overflow-auto pl-4 text-xs">
                                    {results.errors.slice(0, 12).map((err) => (
                                        <li key={`${err.line}-${err.message}`}>
                                            {i18n.t('Row {{line}} — {{message}}', {
                                                line: err.line,
                                                message: err.message,
                                            })}
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                        </div>
                    ) : null}

                </div>

                <div className="shrink-0 space-y-2 border-t border-slate-100 px-5 py-3 dark:border-[color:var(--app-border)]">
                    {importBlockedReason && fileName ? (
                        <p className="text-xs text-amber-800 dark:text-amber-200">
                            {importBlockedReason}
                        </p>
                    ) : null}
                    <div className={cn(MODAL.footerEnd)}>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={handleClose}
                            disabled={importing}
                            title={
                                importing
                                    ? i18n.t('Import in progress — please wait')
                                    : undefined
                            }
                        >
                            {importing
                                ? i18n.t('Please wait…')
                                : results
                                  ? i18n.t('Close')
                                  : i18n.t('Cancel')}
                        </Button>
                        {parsedRows.length > 0 ? (
                            <Button
                                type="button"
                                size="sm"
                                className="h-8 bg-[var(--app-header-bar-bg)] text-white hover:bg-[var(--app-header-bar-bg-hover)] disabled:opacity-50"
                                disabled={!canImport || importing}
                                onClick={handleImport}
                            >
                                {importing
                                    ? i18n.t('Importing…')
                                    : results?.failed
                                      ? isCombinedMode
                                          ? i18n.t('Retry import ({{count}} rows)', {
                                                count: parsedRows.length,
                                            })
                                          : isStageMode
                                            ? i18n.t('Retry import ({{count}} visits)', {
                                                  count: parsedRows.length,
                                              })
                                            : i18n.t('Retry import ({{count}} records)', {
                                                  count: parsedRows.length,
                                              })
                                      : isCombinedMode
                                        ? i18n.t('Import {{count}} rows', {
                                              count: parsedRows.length,
                                          })
                                        : isStageMode
                                          ? i18n.t('Import {{count}} visits', {
                                                count: parsedRows.length,
                                            })
                                          : i18n.t('Import {{count}} records', {
                                                count: parsedRows.length,
                                            })}
                            </Button>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}
