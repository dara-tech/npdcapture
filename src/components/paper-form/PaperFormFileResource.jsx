import React, { useState, useEffect, useRef } from 'react'
import i18n from '@dhis2/d2-i18n'
import { useConfig } from '@dhis2/app-runtime'
import {
    Upload,
    FileText,
    Image as ImageIcon,
    Download,
    Trash2,
    Eye,
    X,
    Loader2,
    AlertCircle,
} from 'lucide-react'
import { cn } from '../../lib/utils'

function formatBytes(bytes) {
    if (!bytes || isNaN(bytes)) return ''
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
}

export function PaperFormFileResource({
    value,
    onChange,
    disabled = false,
    readOnly = false,
    de = null,
    attr = null,
    eventId = null,
    teiId = null,
    domain = 'DATA_VALUE',
}) {
    const config = useConfig()
    const baseUrl = config?.baseUrl || process.env.REACT_APP_DHIS2_BASE_URL || ''
    const fileInputRef = useRef(null)

    const isImage =
        de?.valueType === 'IMAGE' ||
        attr?.valueType === 'IMAGE' ||
        de?.name?.toLowerCase()?.includes('photo') ||
        attr?.name?.toLowerCase()?.includes('photo')

    const [fileMeta, setFileMeta] = useState(null)
    const [imageBlobUrl, setImageBlobUrl] = useState('')
    const [fileBlob, setFileBlob] = useState(null)
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState('')
    const [previewOpen, setPreviewOpen] = useState(false)

    // Load file metadata & binary blob from DHIS2
    useEffect(() => {
        if (!value || String(value).trim() === '') {
            setFileMeta(null)
            setImageBlobUrl('')
            setFileBlob(null)
            setLoading(false)
            return
        }

        let isCancelled = false
        const loadFileData = async () => {
            setLoading(true)
            setError('')
            try {
                // 1. Fetch file resource metadata
                try {
                    const metaRes = await fetch(`${baseUrl}/api/fileResources/${value}`, {
                        credentials: 'include',
                    })
                    if (metaRes.ok) {
                        const meta = await metaRes.json()
                        if (!isCancelled) setFileMeta(meta)
                    }
                } catch (metaErr) {
                    console.warn('Could not fetch file metadata:', metaErr)
                }

                // 2. Fetch binary file data using all possible DHIS2 endpoints in priority order
                const candidateUrls = []
                if (eventId && de?.id) {
                    candidateUrls.push(`${baseUrl}/api/events/files?eventUid=${eventId}&dataElementUid=${de.id}`)
                    candidateUrls.push(`${baseUrl}/api/tracker/events/${eventId}/dataValues/${de.id}/file`)
                    candidateUrls.push(`${baseUrl}/api/40/tracker/events/${eventId}/dataValues/${de.id}/file`)
                }
                if (teiId && attr?.id) {
                    candidateUrls.push(`${baseUrl}/api/trackedEntityInstances/${teiId}/${attr.id}/image`)
                    candidateUrls.push(`${baseUrl}/api/tracker/trackedEntities/${teiId}/attributes/${attr.id}/file`)
                }
                candidateUrls.push(`${baseUrl}/api/fileResources/${value}/data`)
                candidateUrls.push(`${baseUrl}/api/40/fileResources/${value}/data`)

                let loadedBlob = null
                for (const url of candidateUrls) {
                    if (isCancelled) break
                    try {
                        const res = await fetch(url, { credentials: 'include' })
                        if (res.ok && res.status === 200) {
                            const cType = (res.headers.get('content-type') || '').toLowerCase()
                            // Ensure it's not a JSON error response masquerading as 200
                            if (!cType.includes('application/json')) {
                                const blob = await res.blob()
                                if (blob.size > 250) { // Valid file, not tiny error payload
                                    loadedBlob = blob
                                    break
                                }
                            }
                        }
                    } catch (e) {
                        // try next candidate url
                    }
                }

                if (loadedBlob && !isCancelled) {
                    setFileBlob(loadedBlob)
                    const blobUrl = URL.createObjectURL(loadedBlob)
                    setImageBlobUrl(blobUrl)
                }
            } catch (err) {
                console.error('Failed to load file resource:', err)
            } finally {
                if (!isCancelled) setLoading(false)
            }
        }

        loadFileData()
        return () => {
            isCancelled = true
        }
    }, [value, baseUrl, eventId, teiId, de?.id, attr?.id, isImage])

    // Cleanup blob URL
    useEffect(() => {
        return () => {
            if (imageBlobUrl) {
                URL.revokeObjectURL(imageBlobUrl)
            }
        }
    }, [imageBlobUrl])

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        setError('')
        try {
            const formData = new FormData()
            formData.append(
                'domain',
                domain || (attr ? 'TRACKED_ENTITY_ATTRIBUTE' : 'DATA_VALUE')
            )
            formData.append('file', file)

            const res = await fetch(`${baseUrl}/api/fileResources`, {
                method: 'POST',
                body: formData,
                credentials: 'include',
            })

            if (!res.ok) {
                throw new Error(`Upload failed (${res.status})`)
            }

            const json = await res.json()
            const newId = json?.response?.fileResource?.id || json?.id

            if (newId) {
                setFileMeta({
                    name: file.name,
                    displayName: file.name,
                    contentType: file.type,
                    contentLength: file.size,
                })
                setFileBlob(file)
                const localUrl = URL.createObjectURL(file)
                setImageBlobUrl(localUrl)
                onChange?.(newId)
            } else {
                throw new Error('No file resource ID returned')
            }
        } catch (err) {
            console.error('Upload failed:', err)
            setError(i18n.t('Failed to upload file'))
        } finally {
            setUploading(false)
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    const handleDownload = async (e) => {
        e.stopPropagation()
        const defaultName = fileMeta?.name || fileMeta?.displayName || `file-${value}${isImage ? '.jpg' : ''}`

        if (imageBlobUrl || fileBlob) {
            const blobToUse = fileBlob || (await (await fetch(imageBlobUrl)).blob())
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blobToUse)
            a.download = defaultName
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            setTimeout(() => URL.revokeObjectURL(a.href), 1500)
            return
        }

        // If blob not in memory yet, fetch via candidates and download
        try {
            const candidateUrls = []
            if (eventId && de?.id) {
                candidateUrls.push(`${baseUrl}/api/events/files?eventUid=${eventId}&dataElementUid=${de.id}`)
                candidateUrls.push(`${baseUrl}/api/tracker/events/${eventId}/dataValues/${de.id}/file`)
            }
            if (teiId && attr?.id) {
                candidateUrls.push(`${baseUrl}/api/trackedEntityInstances/${teiId}/${attr.id}/image`)
            }
            candidateUrls.push(`${baseUrl}/api/fileResources/${value}/data`)

            for (const url of candidateUrls) {
                try {
                    const res = await fetch(url, { credentials: 'include' })
                    if (res.ok) {
                        const cType = (res.headers.get('content-type') || '').toLowerCase()
                        if (!cType.includes('application/json')) {
                            const blob = await res.blob()
                            if (blob.size > 250) {
                                const downloadUrl = URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = downloadUrl
                                a.download = defaultName
                                document.body.appendChild(a)
                                a.click()
                                document.body.removeChild(a)
                                setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500)
                                return
                            }
                        }
                    }
                } catch (e) {
                    // try next
                }
            }
            // fallback
            window.open(`${baseUrl}/api/fileResources/${value}/data`, '_blank')
        } catch (err) {
            console.error('Download error:', err)
            window.open(`${baseUrl}/api/fileResources/${value}/data`, '_blank')
        }
    }

    const isExistingFile = Boolean(value && String(value).trim())
    const fileName =
        fileMeta?.displayName ||
        fileMeta?.name ||
        (isExistingFile ? (isImage ? i18n.t('Attached Image') : i18n.t('Attached File')) : '')
    const fileSize = formatBytes(fileMeta?.contentLength || fileBlob?.size)
    const isImageFile =
        Boolean(imageBlobUrl) ||
        fileMeta?.contentType?.startsWith('image/') ||
        isImage

    return (
        <div className="flex flex-col gap-1.5 w-full">
            <input
                ref={fileInputRef}
                type="file"
                accept={isImage ? 'image/*' : undefined}
                className="hidden"
                disabled={disabled || readOnly || uploading}
                onChange={handleFileChange}
            />

            {isExistingFile ? (
                <div className="flex items-center justify-between gap-3 p-2 sm:p-2.5 rounded-xl border border-slate-200/90 bg-white/90 dark:border-zinc-700/80 dark:bg-zinc-850/80 shadow-2xs group transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {loading ? (
                            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                            </div>
                        ) : isImageFile && imageBlobUrl ? (
                            <button
                                type="button"
                                onClick={() => setPreviewOpen(true)}
                                className="relative w-11 h-11 rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-700 shrink-0 group/img cursor-pointer focus:outline-hidden"
                                title={i18n.t('Click to enlarge')}
                            >
                                <img
                                    src={imageBlobUrl}
                                    alt={fileName}
                                    className="w-full h-full object-cover group-hover/img:scale-105 transition-transform"
                                />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                                    <Eye className="w-3.5 h-3.5 text-white" />
                                </div>
                            </button>
                        ) : (
                            <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
                                <FileText className="w-5 h-5" />
                            </div>
                        )}

                        <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-xs sm:text-sm font-medium text-slate-800 dark:text-zinc-200 truncate">
                                {fileName}
                            </span>
                            {fileSize && (
                                <span className="text-[11px] text-slate-400 dark:text-zinc-400 font-mono">
                                    {fileSize}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                        {isImageFile && imageBlobUrl && (
                            <button
                                type="button"
                                onClick={() => setPreviewOpen(true)}
                                className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                                title={i18n.t('Preview')}
                            >
                                <Eye className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleDownload}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#2d6693] bg-[#2d6693]/10 hover:bg-[#2d6693]/20 border border-[#2d6693]/20 rounded-lg transition-colors cursor-pointer"
                            title={i18n.t('Download')}
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{i18n.t('Download')}</span>
                        </button>
                        {!readOnly && !disabled && (
                            <button
                                type="button"
                                onClick={() => onChange?.('')}
                                className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                title={i18n.t('Remove')}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            ) : readOnly || disabled ? (
                <span className="text-slate-400 dark:text-zinc-500 font-normal select-none italic text-xs sm:text-sm">
                    {i18n.t('No file attached')}
                </span>
            ) : (
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className={cn(
                            'inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-900/50 hover:bg-slate-100/80 dark:hover:bg-zinc-800/80 hover:border-[#2d6693] dark:hover:border-[#2d6693] text-xs font-medium text-slate-700 dark:text-zinc-300 hover:text-[#2d6693] transition-all cursor-pointer shadow-2xs',
                            uploading && 'opacity-60 cursor-not-allowed'
                        )}
                    >
                        {uploading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin text-[#2d6693]" />
                                <span>{i18n.t('Uploading...')}</span>
                            </>
                        ) : (
                            <>
                                {isImage ? (
                                    <ImageIcon className="w-4 h-4 text-slate-500" />
                                ) : (
                                    <Upload className="w-4 h-4 text-slate-500" />
                                )}
                                <span>{isImage ? i18n.t('Upload Image') : i18n.t('Upload File')}</span>
                            </>
                        )}
                    </button>
                </div>
            )}

            {error && <span className="text-xs text-rose-500 font-medium">{error}</span>}

            {/* Modal Image Lightbox */}
            {previewOpen && imageBlobUrl && (
                <div
                    role="dialog"
                    aria-modal="true"
                    className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-200"
                    onClick={() => setPreviewOpen(false)}
                >
                    <div
                        className="relative max-w-3xl max-h-[85vh] flex flex-col items-center bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-zinc-800"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between w-full px-4 py-3 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-850">
                            <span className="text-sm font-semibold text-slate-800 dark:text-zinc-100 truncate pr-4">
                                {fileName}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleDownload}
                                    className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-lg hover:bg-slate-200/60 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                                    title={i18n.t('Download')}
                                >
                                    <Download className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPreviewOpen(false)}
                                    className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 rounded-lg hover:bg-slate-200/60 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                                    aria-label="Close"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="p-2 overflow-auto max-h-[calc(85vh-60px)] flex items-center justify-center bg-slate-950/5 dark:bg-black/40">
                            <img
                                src={imageBlobUrl}
                                alt={fileName}
                                className="max-w-full max-h-[70vh] object-contain rounded-lg"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
