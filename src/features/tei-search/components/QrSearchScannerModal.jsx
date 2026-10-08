import React, { useState, useEffect, useRef } from 'react'
import i18n from '@dhis2/d2-i18n'
import { Cross2Icon } from '@radix-ui/react-icons'
import {
    Camera,
    Check,
    ClipboardPaste,
    Image as ImageIcon,
    Loader2,
    QrCode,
    RefreshCw,
    VideoOff,
} from 'lucide-react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { cn } from '../../../lib/utils'

// Helper: Test Native BarcodeDetector on a canvas or ImageBitmap
async function testWithBarcodeDetector(source) {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
            const detector = new window.BarcodeDetector({
                formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'data_matrix', 'pdf417'],
            })
            const results = await detector.detect(source)
            if (results && results.length > 0 && results[0].rawValue) {
                return String(results[0].rawValue).trim()
            }
        } catch (e) {
            // Silently continue
        }
    }
    return null
}

// Universal Multi-Pass QR / Barcode Decoder from File or Blob
async function decodeQrBlob(blob, tempContainerId) {
    if (!blob) return null

    // 1. Try Browser Native BarcodeDetector on raw ImageBitmap
    try {
        if (typeof createImageBitmap === 'function') {
            const imgBitmap = await createImageBitmap(blob)
            const bdResult = await testWithBarcodeDetector(imgBitmap)
            if (bdResult) return bdResult
        }
    } catch (e) {}

    // 2. Load image onto canvas to create padded & preprocessed variations
    const img = await new Promise((resolve, reject) => {
        const image = new Image()
        const url = URL.createObjectURL(blob)
        image.onload = () => {
            URL.revokeObjectURL(url)
            resolve(image)
        }
        image.onerror = () => {
            URL.revokeObjectURL(url)
            reject(new Error('Failed to load image'))
        }
        image.src = url
    }).catch(() => null)

    if (!img) return null

    // Helper to convert canvas to File
    const canvasToFile = (canvas, filename = 'scan.png') => {
        return new Promise((resolve) => {
            canvas.toBlob((b) => {
                if (b) resolve(new File([b], filename, { type: 'image/png' }))
                else resolve(null)
            }, 'image/png')
        })
    }

    // Variation 1: Padded with generous white Quiet Zone (essential for tight screenshots)
    const padding = Math.max(40, Math.floor(Math.min(img.width, img.height) * 0.2))
    const paddedCanvas = document.createElement('canvas')
    paddedCanvas.width = img.width + padding * 2
    paddedCanvas.height = img.height + padding * 2
    const ctx1 = paddedCanvas.getContext('2d')
    ctx1.fillStyle = '#FFFFFF'
    ctx1.fillRect(0, 0, paddedCanvas.width, paddedCanvas.height)
    ctx1.drawImage(img, padding, padding)

    const paddedBdResult = await testWithBarcodeDetector(paddedCanvas)
    if (paddedBdResult) return paddedBdResult

    // Variation 2: Inset-Crop (5%) with white padding (strips outer black box lines/borders)
    const insetX = Math.floor(img.width * 0.05)
    const insetY = Math.floor(img.height * 0.05)
    const insetW = Math.max(10, img.width - insetX * 2)
    const insetH = Math.max(10, img.height - insetY * 2)
    const insetCanvas = document.createElement('canvas')
    insetCanvas.width = insetW + padding * 2
    insetCanvas.height = insetH + padding * 2
    const ctx2 = insetCanvas.getContext('2d')
    ctx2.fillStyle = '#FFFFFF'
    ctx2.fillRect(0, 0, insetCanvas.width, insetCanvas.height)
    ctx2.drawImage(img, insetX, insetY, insetW, insetH, padding, padding, insetW, insetH)

    const insetBdResult = await testWithBarcodeDetector(insetCanvas)
    if (insetBdResult) return insetBdResult

    // Variation 3: High contrast thresholding on padded canvas
    const contrastCanvas = document.createElement('canvas')
    contrastCanvas.width = paddedCanvas.width
    contrastCanvas.height = paddedCanvas.height
    const ctx3 = contrastCanvas.getContext('2d')
    ctx3.drawImage(paddedCanvas, 0, 0)
    try {
        const imgData = ctx3.getImageData(0, 0, contrastCanvas.width, contrastCanvas.height)
        const d = imgData.data
        for (let i = 0; i < d.length; i += 4) {
            const avg = (d[i] + d[i + 1] + d[i + 2]) / 3
            const val = avg > 140 ? 255 : 0
            d[i] = val
            d[i + 1] = val
            d[i + 2] = val
        }
        ctx3.putImageData(imgData, 0, 0)
    } catch (e) {}

    const contrastBdResult = await testWithBarcodeDetector(contrastCanvas)
    if (contrastBdResult) return contrastBdResult

    // Convert variations to Files to run Html5Qrcode.scanFile
    const originalFile = blob instanceof File ? blob : new File([blob], 'orig.png', { type: blob.type || 'image/png' })
    const paddedFile = await canvasToFile(paddedCanvas, 'padded.png')
    const insetFile = await canvasToFile(insetCanvas, 'inset.png')
    const contrastFile = await canvasToFile(contrastCanvas, 'contrast.png')

    const testFiles = [paddedFile, originalFile, insetFile, contrastFile].filter(Boolean)

    // Run Html5Qrcode on the dedicated temporary container element
    const containerEl = document.getElementById(tempContainerId)
    if (containerEl) {
        let tempScanner = null
        try {
            tempScanner = new Html5Qrcode(tempContainerId, { verbose: false })
            for (const fileToTest of testFiles) {
                try {
                    const res = await tempScanner.scanFile(fileToTest, false)
                    if (res && String(res).trim()) {
                        return String(res).trim()
                    }
                } catch (err) {
                    // Keep testing next variation
                }
            }
        } catch (e) {
            console.warn('Html5Qrcode temp scanner error:', e)
        } finally {
            if (tempScanner) {
                try {
                    await tempScanner.clear()
                } catch (e) {}
            }
        }
    }

    return null
}

export function QrSearchScannerModal({ open, onClose, onScanSuccess }) {
    const [manualCode, setManualCode] = useState('')
    const [cameraError, setCameraError] = useState('')
    const [cameraFacing, setCameraFacing] = useState('environment') // 'environment' (back) | 'user' (front)
    const [lastDetected, setLastDetected] = useState('')
    const [isScanning, setIsScanning] = useState(false)
    const [isProcessingFile, setIsProcessingFile] = useState(false)

    const scannerRef = useRef(null)
    const fileInputRef = useRef(null)
    const containerId = 'qr-search-reader-canvas'
    const tempContainerId = 'qr-file-scan-temp-container'

    // Cleanly stop scanner
    const stopScanner = async () => {
        if (scannerRef.current) {
            try {
                if (scannerRef.current.isScanning) {
                    await scannerRef.current.stop()
                }
                await scannerRef.current.clear()
            } catch (err) {
                console.warn('Error stopping scanner:', err)
            } finally {
                scannerRef.current = null
                setIsScanning(false)
            }
        }
    }

    // Start scanner using html5-qrcode
    const startScanner = async () => {
        await stopScanner()
        setCameraError('')
        setLastDetected('')

        // Give DOM 100ms to render the container div
        setTimeout(async () => {
            const containerEl = document.getElementById(containerId)
            if (!containerEl) return

            try {
                const scanner = new Html5Qrcode(containerId, {
                    verbose: false,
                    formatsToSupport: [
                        Html5QrcodeSupportedFormats.QR_CODE,
                        Html5QrcodeSupportedFormats.CODE_128,
                        Html5QrcodeSupportedFormats.CODE_39,
                        Html5QrcodeSupportedFormats.EAN_13,
                        Html5QrcodeSupportedFormats.EAN_8,
                        Html5QrcodeSupportedFormats.UPC_A,
                        Html5QrcodeSupportedFormats.UPC_E,
                        Html5QrcodeSupportedFormats.DATA_MATRIX,
                    ],
                })

                scannerRef.current = scanner

                await scanner.start(
                    { facingMode: cameraFacing },
                    {
                        fps: 15,
                        qrbox: (viewfinderWidth, viewfinderHeight) => {
                            const minEdge = Math.min(viewfinderWidth, viewfinderHeight)
                            const edge = Math.floor(minEdge * 0.7)
                            return { width: Math.max(180, edge), height: Math.max(180, edge) }
                        },
                        aspectRatio: 1.333,
                    },
                    (decodedText) => {
                        handleSuccess(decodedText)
                    },
                    () => {
                        // Frame scan failures are expected, keep silent
                    }
                )

                setIsScanning(true)
            } catch (err) {
                console.warn('Camera stream error:', err)
                setCameraError(
                    err?.message ||
                        i18n.t('Failed to access camera. Please check camera permissions.')
                )
                setIsScanning(false)
            }
        }, 120)
    }

    const handleSuccess = (code) => {
        const cleaned = String(code || '').trim()
        if (!cleaned) return
        setLastDetected(cleaned)
        if (navigator.vibrate) {
            navigator.vibrate(100)
        }
        setTimeout(async () => {
            await stopScanner()
            onScanSuccess?.(cleaned)
            onClose?.()
        }, 350)
    }

    const handleManualSubmit = (e) => {
        e?.preventDefault()
        if (manualCode.trim()) {
            handleSuccess(manualCode.trim())
        }
    }

    const processBlobForQr = async (blob) => {
        if (!blob) return
        setIsProcessingFile(true)
        setCameraError('')
        try {
            const result = await decodeQrBlob(blob, tempContainerId)
            if (result) {
                handleSuccess(result)
            } else {
                setCameraError(i18n.t('No QR code or barcode found in image. Please try another image.'))
            }
        } catch (err) {
            console.warn('File decode error:', err)
            setCameraError(i18n.t('No QR code or barcode found in image. Please try another image.'))
        } finally {
            setIsProcessingFile(false)
        }
    }

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        await processBlobForQr(file)
        if (e.target) e.target.value = ''
    }

    // Read clipboard image or text
    const handlePasteFromClipboard = async () => {
        try {
            setCameraError('')
            setIsProcessingFile(true)

            // 1. Try reading clipboard items (images)
            if (navigator.clipboard?.read) {
                const clipboardItems = await navigator.clipboard.read()
                for (const item of clipboardItems) {
                    for (const type of item.types) {
                        if (type.startsWith('image/')) {
                            const blob = await item.getType(type)
                            if (blob) {
                                const result = await decodeQrBlob(blob, tempContainerId)
                                if (result) {
                                    handleSuccess(result)
                                    return
                                }
                            }
                        }
                    }
                }
            }

            // 2. Try reading clipboard text (code/UUIC/SMH)
            if (navigator.clipboard?.readText) {
                const text = await navigator.clipboard.readText()
                if (text && text.trim()) {
                    handleSuccess(text.trim())
                    return
                }
            }

            setCameraError(i18n.t('Clipboard is empty or contains no QR image / code.'))
        } catch (err) {
            console.warn('Clipboard read error:', err)
            setCameraError(i18n.t('Clipboard permission not granted. Use Ctrl+V or upload an image.'))
        } finally {
            setIsProcessingFile(false)
        }
    }

    // Global Paste Listener (Ctrl+V / Cmd+V)
    useEffect(() => {
        if (!open) return

        const handleWindowPaste = async (e) => {
            const items = e.clipboardData?.items || []
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile()
                    if (file) {
                        e.preventDefault()
                        await processBlobForQr(file)
                        return
                    }
                }
            }

            const text = e.clipboardData?.getData('text')
            if (text && text.trim()) {
                e.preventDefault()
                handleSuccess(text.trim())
            }
        }

        window.addEventListener('paste', handleWindowPaste)
        return () => {
            window.removeEventListener('paste', handleWindowPaste)
        }
    }, [open])

    // Lifecycle
    useEffect(() => {
        if (open) {
            startScanner()
        } else {
            stopScanner()
            setLastDetected('')
            setManualCode('')
            setCameraError('')
            setIsProcessingFile(false)
        }
        return () => {
            stopScanner()
        }
    }, [open, cameraFacing])

    if (!open) return null

    return (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            {/* Hidden independent container for background image/clipboard decoding */}
            <div id={tempContainerId} className="hidden" style={{ display: 'none' }} />

            <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-zinc-800 animate-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/50 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-app-tint-10 text-app-primary">
                            <QrCode className="h-4 w-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                                {i18n.t('Scan Client Card')}
                            </h3>
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                                {i18n.t('Scan QR code, upload image, or paste clipboard')}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-slate-700 dark:text-zinc-400 transition-colors cursor-pointer"
                    >
                        <Cross2Icon className="w-4 h-4" />
                    </button>
                </div>

                {/* Viewfinder Camera Area */}
                <div className="relative bg-slate-950 aspect-4/3 flex items-center justify-center overflow-hidden">
                    {/* HTML5 QR Container */}
                    <div
                        id={containerId}
                        className={cn(
                            'w-full h-full object-cover [&_video]:w-full [&_video]:h-full [&_video]:object-cover',
                            cameraError && 'hidden'
                        )}
                    />

                    {/* Processing overlay for file/clipboard decode */}
                    {isProcessingFile && (
                        <div className="absolute inset-0 z-20 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-2">
                            <Loader2 className="h-8 w-8 animate-spin text-app-primary" />
                            <span className="text-xs font-semibold">{i18n.t('Decoding QR Code...')}</span>
                        </div>
                    )}

                    {cameraError ? (
                        <div className="p-6 text-center text-slate-400 flex flex-col items-center gap-2">
                            <VideoOff className="h-10 w-10 text-slate-500" />
                            <span className="text-xs max-w-xs">{cameraError}</span>
                            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={startScanner}
                                    className="text-xs"
                                >
                                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                                    {i18n.t('Retry Camera')}
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-xs"
                                >
                                    <ImageIcon className="h-3.5 w-3.5 mr-1" />
                                    {i18n.t('Upload Image')}
                                </Button>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={handlePasteFromClipboard}
                                    className="text-xs"
                                >
                                    <ClipboardPaste className="h-3.5 w-3.5 mr-1" />
                                    {i18n.t('Paste Clipboard')}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Success Overlay when detected */}
                            {lastDetected && (
                                <div className="absolute inset-0 z-10 bg-emerald-600/60 backdrop-blur-xs flex flex-col items-center justify-center text-white font-bold text-sm gap-2 animate-in zoom-in-95">
                                    <div className="h-12 w-12 rounded-full bg-white text-emerald-600 flex items-center justify-center shadow-lg">
                                        <Check className="h-7 w-7 stroke-[3]" />
                                    </div>
                                    <span>{i18n.t('Scanned Successfully!')}</span>
                                    <span className="text-xs font-mono font-normal opacity-90">
                                        {lastDetected}
                                    </span>
                                </div>
                            )}

                            {/* Floating Controls (Paste Clipboard, Upload Image, Flip Camera) */}
                            <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={handlePasteFromClipboard}
                                    className="h-8 px-2.5 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center gap-1.5 hover:bg-black/80 transition-all cursor-pointer shadow-md text-xs font-medium"
                                    title={i18n.t('Paste from Clipboard (Ctrl+V)')}
                                >
                                    <ClipboardPaste className="h-3.5 w-3.5" />
                                    <span>{i18n.t('Paste')}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="h-8 px-2.5 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center gap-1.5 hover:bg-black/80 transition-all cursor-pointer shadow-md text-xs font-medium"
                                    title={i18n.t('Upload Image')}
                                >
                                    <ImageIcon className="h-3.5 w-3.5" />
                                    <span>{i18n.t('Upload')}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setCameraFacing((f) =>
                                             f === 'environment' ? 'user' : 'environment'
                                        )
                                    }
                                    className="h-8 w-8 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/80 transition-all cursor-pointer shadow-md"
                                    title={i18n.t('Switch Camera')}
                                >
                                    <RefreshCw className="h-4 w-4" />
                                </button>
                            </div>
                        </>
                    )}

                    {/* Hidden file input for QR image upload */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                </div>

                {/* Manual Barcode / Code Entry Fallback */}
                <div className="p-4 bg-slate-50 dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800">
                    <form onSubmit={handleManualSubmit} className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Input
                                placeholder={i18n.t('Or enter code / scan via USB...')}
                                value={manualCode}
                                onChange={(e) => setManualCode(e.target.value)}
                                className="h-9 bg-white dark:bg-zinc-800 text-xs font-semibold pl-8"
                            />
                            <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none text-slate-400">
                                <QrCode className="h-4 w-4" />
                            </div>
                        </div>
                        <Button
                            type="submit"
                            disabled={!manualCode.trim()}
                            className="h-9 px-4 text-xs font-bold bg-app-primary text-white hover:bg-app-primary/90 cursor-pointer"
                        >
                            {i18n.t('Search')}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    )
}
