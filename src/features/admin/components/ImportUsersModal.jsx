import React, { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import i18n from '@dhis2/d2-i18n'
import { Cross2Icon } from '@radix-ui/react-icons'
import { Upload } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Spinner } from '../../../components/ui/spinner'
import { cn } from '../../../lib/utils'
import {
    IMPORT_USER_ACTION,
    importUsersFromCsv,
} from '../lib/importUsersFromCsv'
import { parseUsersImportFile } from '../lib/parseUsersCsv'
import { downloadUsersImportWorkbook } from '../lib/usersImportWorkbook'

export const ImportUsersModal = ({ open, engine, onClose, onImported }) => {
    const inputRef = useRef(null)
    const [importAction, setImportAction] = useState(IMPORT_USER_ACTION.create)
    const [parsedRows, setParsedRows] = useState([])
    const [parseErrors, setParseErrors] = useState([])
    const [fileName, setFileName] = useState('')
    const [importing, setImporting] = useState(false)
    const [progress, setProgress] = useState({ done: 0, total: 0 })
    const [results, setResults] = useState(null)
    const [downloadingGuide, setDownloadingGuide] = useState(false)

    const isDeleteMode = importAction === IMPORT_USER_ACTION.disable
    const isEnableMode = importAction === IMPORT_USER_ACTION.enable
    const isUsernameOnlyMode = isDeleteMode || isEnableMode

    if (!open || typeof document === 'undefined') return null

    const reset = () => {
        setParsedRows([])
        setParseErrors([])
        setFileName('')
        setResults(null)
        setProgress({ done: 0, total: 0 })
        if (inputRef.current) inputRef.current.value = ''
    }

    const handleClose = () => {
        if (importing) return
        reset()
        onClose()
    }

    const handleActionChange = (action) => {
        if (action === importAction) return
        setImportAction(action)
        reset()
    }

    const handleFile = async (file) => {
        if (!file) return
        setResults(null)
        setFileName(file.name)
        const { rows, errors } = await parseUsersImportFile(file)
        setParsedRows(rows)
        setParseErrors(errors)
    }

    const handleDownloadGuide = async () => {
        if (downloadingGuide || !engine) return
        setDownloadingGuide(true)
        try {
            await downloadUsersImportWorkbook({ engine })
        } catch {
            setParseErrors([
                i18n.t('Could not build import guide. Check your connection and try again.'),
            ])
        } finally {
            setDownloadingGuide(false)
        }
    }

    const handleImport = async () => {
        if (!parsedRows.length || importing) return
        setImporting(true)
        setResults(null)
        try {
            const summary = await importUsersFromCsv({
                engine,
                rows: parsedRows,
                action: importAction,
                onProgress: (done, total) => setProgress({ done, total }),
            })
            setResults(summary)
            const changed =
                (summary.created ?? 0) > 0 ||
                (summary.disabled ?? 0) > 0 ||
                (summary.enabled ?? 0) > 0
            if (changed) {
                await onImported?.()
            }
        } finally {
            setImporting(false)
        }
    }

    const successCount = isDeleteMode
        ? (results?.disabled ?? 0)
        : isEnableMode
          ? (results?.enabled ?? 0)
          : (results?.created ?? 0)
    const failCount = results?.failed ?? 0

    return createPortal(
        <div
            className="modal-backdrop fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
            onClick={handleClose}
        >
            <div
                className="modal-panel flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="import-users-title"
            >
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--app-header-bar-bg)] text-white">
                            <Upload className="h-4 w-4" />
                        </div>
                        <h2
                            id="import-users-title"
                            className="text-base font-bold text-slate-900 md:text-lg"
                        >
                            {i18n.t('Import users')}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={importing}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        aria-label={i18n.t('Close')}
                    >
                        <Cross2Icon className="h-4 w-4" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-auto px-5 py-4 space-y-4">
                    <div className="flex rounded-xl border border-slate-200/90 bg-slate-50/80 p-1">
                        {[
                            {
                                action: IMPORT_USER_ACTION.create,
                                label: i18n.t('Create'),
                                activeClass:
                                    'bg-white text-[var(--app-header-bar-bg)] shadow-sm',
                            },
                            {
                                action: IMPORT_USER_ACTION.disable,
                                label: i18n.t('Delete'),
                                activeClass: 'bg-white text-red-700 shadow-sm',
                            },
                            {
                                action: IMPORT_USER_ACTION.enable,
                                label: i18n.t('Enable'),
                                activeClass: 'bg-white text-emerald-700 shadow-sm',
                            },
                        ].map(({ action, label, activeClass }) => (
                            <button
                                key={action}
                                type="button"
                                disabled={importing}
                                onClick={() => handleActionChange(action)}
                                className={cn(
                                    'flex-1 rounded-lg px-2 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors sm:text-xs',
                                    importAction === action
                                        ? activeClass
                                        : 'text-slate-500 hover:text-slate-700'
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <p className="text-sm text-slate-600 leading-relaxed">
                        {isDeleteMode
                            ? i18n.t(
                                  'Upload a file with one username per row (Users sheet). Matching accounts will be disabled in DHIS2 — same as delete in user management.'
                              )
                            : isEnableMode
                              ? i18n.t(
                                    'Upload a file with one username per row. Disabled accounts will be re-enabled (restored to active).'
                                )
                              : i18n.t(
                                    'Download the Excel guide first. Fill the Users sheet only — copy role, group, and organisation unit names from the other sheets. Import the same .xlsx file or export the Users sheet as CSV.'
                                )}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 text-xs"
                            onClick={handleDownloadGuide}
                            disabled={importing || downloadingGuide}
                        >
                            {downloadingGuide ? (
                                <>
                                    <Spinner className="mr-1.5 h-3.5 w-3.5 border-slate-200 border-t-[var(--app-header-bar-bg)]" />
                                    {i18n.t('Preparing…')}
                                </>
                            ) : (
                                i18n.t('Download import guide (.xlsx)')
                            )}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 text-xs"
                            onClick={() => inputRef.current?.click()}
                            disabled={importing}
                        >
                            {i18n.t('Choose file')}
                        </Button>
                        {fileName ? (
                            <span className="text-xs font-medium text-slate-500 truncate max-w-[12rem]">
                                {fileName}
                            </span>
                        ) : null}
                        <input
                            ref={inputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            className="hidden"
                            onChange={(e) => handleFile(e.target.files?.[0])}
                        />
                    </div>

                    {parseErrors.length > 0 ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                            {parseErrors.map((msg) => (
                                <p key={msg}>{msg}</p>
                            ))}
                        </div>
                    ) : null}

                    {parsedRows.length > 0 && !results ? (
                        <div className="rounded-lg border border-slate-200/90 overflow-hidden">
                            <p
                                className={cn(
                                    'border-b px-3 py-2 text-xs font-semibold',
                                    isDeleteMode
                                        ? 'border-red-100 bg-red-50 text-red-900'
                                        : isEnableMode
                                          ? 'border-emerald-100 bg-emerald-50 text-emerald-900'
                                          : 'border-slate-100 bg-slate-50 text-slate-700'
                                )}
                            >
                                {isDeleteMode
                                    ? i18n.t('{{count}} users ready to delete', {
                                          count: parsedRows.length,
                                      })
                                    : isEnableMode
                                      ? i18n.t('{{count}} users ready to enable', {
                                            count: parsedRows.length,
                                        })
                                      : i18n.t('{{count}} users ready to import', {
                                            count: parsedRows.length,
                                        })}
                            </p>
                            <div className="max-h-48 overflow-auto custom-scrollbar">
                                <table className="w-full text-left text-xs">
                                    <thead className="sticky top-0 bg-white text-slate-500">
                                        <tr>
                                            <th className="px-3 py-2 font-medium">#</th>
                                            <th className="px-3 py-2 font-medium">
                                                {i18n.t('Username')}
                                            </th>
                                            {!isUsernameOnlyMode ? (
                                                <>
                                                    <th className="px-3 py-2 font-medium">
                                                        {i18n.t('Name')}
                                                    </th>
                                                    <th className="px-3 py-2 font-medium">
                                                        {i18n.t('Roles')}
                                                    </th>
                                                </>
                                            ) : null}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {parsedRows.slice(0, 8).map((row) => (
                                            <tr key={row.line}>
                                                <td className="px-3 py-2 text-slate-400">
                                                    {row.line}
                                                </td>
                                                <td className="px-3 py-2 font-medium text-slate-800">
                                                    {row.username}
                                                </td>
                                                {!isUsernameOnlyMode ? (
                                                    <>
                                                        <td className="px-3 py-2 text-slate-600">
                                                            {[row.firstName, row.surname]
                                                                .filter(Boolean)
                                                                .join(' ') || '—'}
                                                        </td>
                                                        <td className="px-3 py-2 text-slate-500 truncate max-w-[8rem]">
                                                            {row.roleNames.join('; ') || '—'}
                                                        </td>
                                                    </>
                                                ) : null}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {parsedRows.length > 8 ? (
                                <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-400">
                                    {i18n.t('…and {{count}} more', {
                                        count: parsedRows.length - 8,
                                    })}
                                </p>
                            ) : null}
                        </div>
                    ) : null}

                    {importing ? (
                        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                            <Spinner className="h-5 w-5 border-slate-200 border-t-[var(--app-header-bar-bg)]" />
                            <span className="text-sm text-slate-600">
                                {isDeleteMode
                                    ? i18n.t('Deleting {{done}} of {{total}}…', {
                                          done: progress.done,
                                          total: progress.total,
                                      })
                                    : isEnableMode
                                      ? i18n.t('Enabling {{done}} of {{total}}…', {
                                            done: progress.done,
                                            total: progress.total,
                                        })
                                      : i18n.t('Importing {{done}} of {{total}}…', {
                                            done: progress.done,
                                            total: progress.total,
                                        })}
                            </span>
                        </div>
                    ) : null}

                    {results ? (
                        <div className="space-y-2">
                            <div
                                className={cn(
                                    'rounded-lg border px-3 py-2 text-sm font-medium',
                                    failCount === 0
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                                        : 'border-slate-200 bg-slate-50 text-slate-800'
                                )}
                            >
                                {isDeleteMode
                                    ? i18n.t('Deleted {{deleted}}, failed {{failed}}', {
                                          deleted: successCount,
                                          failed: failCount,
                                      })
                                    : isEnableMode
                                      ? i18n.t('Enabled {{enabled}}, failed {{failed}}', {
                                            enabled: successCount,
                                            failed: failCount,
                                        })
                                      : i18n.t('Created {{created}}, failed {{failed}}', {
                                            created: successCount,
                                            failed: failCount,
                                        })}
                            </div>
                            {failCount > 0 ? (
                                <div className="max-h-40 overflow-auto rounded-lg border border-red-200/80 bg-red-50/50 custom-scrollbar">
                                    <ul className="divide-y divide-red-100 text-xs">
                                        {results.results
                                            .filter((r) => !r.ok)
                                            .map((r) => (
                                                <li
                                                    key={`${r.line}-${r.username}`}
                                                    className="px-3 py-2 text-red-900"
                                                >
                                                    <span className="font-semibold">
                                                        {i18n.t('Row {{line}}', { line: r.line })}
                                                        {r.username
                                                            ? ` (${r.username})`
                                                            : ''}
                                                        :
                                                    </span>{' '}
                                                    {r.error}
                                                </li>
                                            ))}
                                    </ul>
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-4">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleClose}
                        disabled={importing}
                    >
                        {results ? i18n.t('Close') : i18n.t('Cancel')}
                    </Button>
                    {!results ? (
                        <Button
                            type="button"
                            size="sm"
                            className={cn(
                                isDeleteMode
                                    ? 'bg-red-700 text-white hover:bg-red-800'
                                    : isEnableMode
                                      ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                                      : 'bg-[var(--app-header-bar-bg)] text-white hover:bg-[var(--app-header-bar-bg-hover)]'
                            )}
                            disabled={!parsedRows.length || importing || parseErrors.length > 0}
                            onClick={handleImport}
                        >
                            {isDeleteMode
                                ? i18n.t('Delete {{count}} users', {
                                      count: parsedRows.length,
                                  })
                                : isEnableMode
                                  ? i18n.t('Enable {{count}} users', {
                                        count: parsedRows.length,
                                    })
                                  : i18n.t('Import {{count}} users', {
                                        count: parsedRows.length,
                                    })}
                        </Button>
                    ) : null}
                </div>
            </div>
        </div>,
        document.body
    )
}
