import React, { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { KeyboardIcon, DeleteIcon, X, Check } from 'lucide-react'
import { cn } from '../../lib/utils'

const CONSONANTS = [
    'ក', 'ខ', 'គ', 'ឃ', 'ង',
    'ច', 'ឆ', 'ជ', 'ឈ', 'ញ',
    'ដ', 'ឋ', 'ឌ', 'ឍ', 'ណ',
    'ត', 'ថ', 'ទ', 'ធ', 'ន',
    'ប', 'ផ', 'ព', 'ភ', 'ម',
    'យ', 'រ', 'ល', 'វ', 'ស',
    'ហ', 'ឡ', 'អ',
]

const VOWELS = [
    'ា', 'ិ', 'ី', 'ឹ', 'ឺ', 'ុ', 'ូ', 'ួ',
    'ើ', 'ឿ', 'ៀ', 'េ', 'ែ', 'ៃ', 'ោ', 'ៅ',
]

const INDEPENDENT_VOWELS = [
    'ឰ', 'ឱ', 'ឳ', 'ឩ', 'ឫ', 'ឬ', 'ឭ', 'ឮ',
]

const DIACRITICS = [
    '្', 'ំ', 'ះ', 'ៈ', '៉', '៊', '់', '៌', '៍', '៎', '៏', '័',
]

const KHMER_SYMBOLS = ['៛', '។', '៕', 'ៗ', '៘', '៖', '–', '?']

const NUMBERS_KH = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩']
const NUMBERS_EN = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

const COMBINING_MARKS = [
    'ា', 'ិ', 'ី', 'ឹ', 'ឺ', 'ុ', 'ូ', 'ួ', 'ើ', 'ឿ', 'ៀ', 'េ', 'ែ', 'ៃ', 'ោ', 'ៅ',
    '្', 'ំ', 'ះ', 'ៈ', '៉', '៊', '់', '៌', '៍', '៎', '៏', '័',
]

function useIsMobile(breakpoint = 640) {
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
    )

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < breakpoint)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [breakpoint])

    return isMobile
}

export function KhmerVirtualKeyboard({ onInsert, onBackspace, className, onlyNumbers = false }) {
    const [open, setOpen] = useState(false)
    const [tab, setTab] = useState('consonants')
    const [numMode, setNumMode] = useState('en') // 'en' | 'kh'
    const isMobile = useIsMobile()

    const triggerHaptic = useCallback(() => {
        try {
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(8)
            }
        } catch (_) {}
    }, [])

    const insert = useCallback((char) => {
        triggerHaptic()
        if (onInsert) onInsert(char)
    }, [onInsert, triggerHaptic])

    const handleBackspace = useCallback(() => {
        triggerHaptic()
        if (onBackspace) onBackspace()
    }, [onBackspace, triggerHaptic])

    // Prevent focus steal when pressing buttons so the input retains focus
    const preventFocusSteal = (e) => {
        e.preventDefault()
    }

    /* -------------------------------------------------------------------------- */
    /* KEYBOARD KEY BUTTON COMPONENT                                              */
    /* -------------------------------------------------------------------------- */
    const KeyButton = ({ char, isCombining = false, sublabel, className: customClass, onClick }) => (
        <button
            type="button"
            onMouseDown={preventFocusSteal}
            onTouchStart={triggerHaptic}
            onClick={(e) => {
                e.preventDefault()
                if (onClick) {
                    onClick()
                } else if (char) {
                    insert(char)
                }
            }}
            className={cn(
                'relative flex items-center justify-center rounded-md bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 select-none cursor-pointer',
                'shadow-[0_1px_0_rgba(0,0,0,0.14)] dark:shadow-[0_1px_0_rgba(0,0,0,0.4)] border-b border-slate-300/60 dark:border-b-zinc-950',
                'active:scale-92 active:translate-y-0.5 active:bg-slate-100 dark:active:bg-zinc-700 transition-all duration-75',
                customClass
            )}
        >
            {isCombining && <span className="opacity-35 text-[11px] mr-[-0.15em]">◌</span>}
            <span>{char}</span>
            {sublabel && (
                <span className="absolute bottom-0.5 text-[8px] font-normal opacity-50 leading-none">
                    {sublabel}
                </span>
            )}
        </button>
    )

    /* -------------------------------------------------------------------------- */
    /* NUMERIC KEYPAD VIEW (for onlyNumbers or Numbers tab)                       */
    /* -------------------------------------------------------------------------- */
    const renderNumberGrid = (mobileLayout = false) => {
        const numList = numMode === 'kh' ? NUMBERS_KH : NUMBERS_EN
        const keys = [
            numList[1], numList[2], numList[3],
            numList[4], numList[5], numList[6],
            numList[7], numList[8], numList[9],
        ]

        return (
            <div className="flex flex-col gap-1 p-1.5">
                <div className="flex items-center justify-between px-1 mb-0.5">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                        {numMode === 'kh' ? 'លេខខ្មែរ (Khmer)' : 'លេខអារ៉ាប់ (Arabic)'}
                    </span>
                    <button
                        type="button"
                        onMouseDown={preventFocusSteal}
                        onClick={() => setNumMode((m) => (m === 'kh' ? 'en' : 'kh'))}
                        className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-200/80 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-300 transition-colors"
                    >
                        {numMode === 'kh' ? '123' : '១២៣'}
                    </button>
                </div>

                <div className="grid grid-cols-3 gap-1">
                    {keys.map((k) => (
                        <KeyButton
                            key={k}
                            char={k}
                            className={mobileLayout ? 'h-[38px] text-[15px] font-semibold' : 'h-8 text-sm font-semibold'}
                        />
                    ))}
                    <KeyButton
                        char="."
                        className={mobileLayout ? 'h-[38px] text-[15px] font-semibold' : 'h-8 text-sm font-semibold'}
                    />
                    <KeyButton
                        char={numList[0]}
                        className={mobileLayout ? 'h-[38px] text-[15px] font-semibold' : 'h-8 text-sm font-semibold'}
                    />
                    <button
                        type="button"
                        onMouseDown={preventFocusSteal}
                        onClick={(e) => {
                            e.preventDefault()
                            handleBackspace()
                        }}
                        className={cn(
                            'flex items-center justify-center rounded-md bg-slate-200/90 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 select-none cursor-pointer',
                            'shadow-[0_1px_0_rgba(0,0,0,0.14)] dark:shadow-[0_1px_0_rgba(0,0,0,0.4)] border-b border-slate-300/60 dark:border-b-zinc-950',
                            'active:scale-92 active:translate-y-0.5 active:bg-red-500 active:text-white transition-all duration-75',
                            mobileLayout ? 'h-[38px]' : 'h-8'
                        )}
                        aria-label="Backspace"
                    >
                        <DeleteIcon className="h-4 w-4" />
                    </button>
                </div>
            </div>
        )
    }

    /* -------------------------------------------------------------------------- */
    /* FULL KHMER KEYBOARD GRID VIEW                                              */
    /* -------------------------------------------------------------------------- */
    const renderFullKeyboard = (mobileLayout = false) => {
        const keyHeight = mobileLayout ? 'h-[33px]' : 'h-[30px]'
        const keyText = mobileLayout ? 'text-[13px] font-medium' : 'text-[12.5px] font-medium'

        return (
            <div className="flex flex-col">
                {/* Scrollable Keys Area */}
                <div className="p-1 max-h-[38vh] sm:max-h-none overflow-y-auto custom-scrollbar">
                    {tab === 'consonants' && (
                        <div className={cn('grid gap-0.5 sm:gap-1', mobileLayout ? 'grid-cols-7' : 'grid-cols-6')}>
                            {CONSONANTS.map((c) => (
                                <KeyButton
                                    key={c}
                                    char={c}
                                    className={cn(keyHeight, keyText)}
                                />
                            ))}
                        </div>
                    )}

                    {tab === 'vowels' && (
                        <div className="flex flex-col gap-1.5">
                            <div>
                                <span className="block px-1 pb-0.5 text-[10px] font-semibold text-slate-400 dark:text-zinc-500">
                                    ស្រៈនិស្ស័យ (Dependent)
                                </span>
                                <div className={cn('grid gap-0.5 sm:gap-1', mobileLayout ? 'grid-cols-6' : 'grid-cols-5')}>
                                    {VOWELS.map((v) => (
                                        <KeyButton
                                            key={v}
                                            char={v}
                                            isCombining={true}
                                            className={cn(keyHeight, keyText)}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div>
                                <span className="block px-1 pb-0.5 text-[10px] font-semibold text-slate-400 dark:text-zinc-500">
                                    ស្រៈពេញតួ (Independent)
                                </span>
                                <div className={cn('grid gap-0.5 sm:gap-1', mobileLayout ? 'grid-cols-6' : 'grid-cols-4')}>
                                    {INDEPENDENT_VOWELS.map((iv) => (
                                        <KeyButton
                                            key={iv}
                                            char={iv}
                                            className={cn(keyHeight, keyText)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === 'marks' && (
                        <div className="flex flex-col gap-1.5">
                            <div>
                                <span className="block px-1 pb-0.5 text-[10px] font-semibold text-slate-400 dark:text-zinc-500">
                                    វណ្ណយុត្តិ និងសញ្ញា (Marks & Diacritics)
                                </span>
                                <div className={cn('grid gap-0.5 sm:gap-1', mobileLayout ? 'grid-cols-6' : 'grid-cols-5')}>
                                    {DIACRITICS.map((d) => (
                                        <KeyButton
                                            key={d}
                                            char={d}
                                            isCombining={COMBINING_MARKS.includes(d)}
                                            className={cn(keyHeight, keyText)}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div>
                                <span className="block px-1 pb-0.5 text-[10px] font-semibold text-slate-400 dark:text-zinc-500">
                                    សញ្ញាវណ្ណយុត្តិ (Punctuation)
                                </span>
                                <div className={cn('grid gap-0.5 sm:gap-1', mobileLayout ? 'grid-cols-6' : 'grid-cols-4')}>
                                    {KHMER_SYMBOLS.map((s) => (
                                        <KeyButton
                                            key={s}
                                            char={s}
                                            className={cn(keyHeight, keyText)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === 'numbers' && renderNumberGrid(mobileLayout)}
                </div>

                {/* Bottom Action Row (Space, Subscript, Backspace, Close) */}
                <div className="flex items-center gap-1 p-1.5 pt-1 border-t border-slate-200/70 dark:border-zinc-800 bg-slate-200/40 dark:bg-zinc-900/60">
                    {/* Dedicated Subscript (ជើង ្) Key */}
                    <button
                        type="button"
                        onMouseDown={preventFocusSteal}
                        onClick={(e) => {
                            e.preventDefault()
                            insert('្')
                        }}
                        className={cn(
                            'flex flex-col items-center justify-center rounded-md px-2 font-bold select-none cursor-pointer',
                            'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900',
                            'shadow-[0_1px_0_rgba(0,0,0,0.1)] active:scale-95 active:bg-blue-100 transition-all duration-75',
                            mobileLayout ? 'h-[34px] min-w-[2.75rem]' : 'h-[30px] min-w-[2.5rem]'
                        )}
                        title="ជើងព្យញ្ជនៈ (Subscript mark)"
                    >
                        <span className="text-[13px] leading-none">◌្</span>
                        <span className="text-[8px] font-medium leading-none opacity-80 mt-0.5">ជើង</span>
                    </button>

                    {/* Spacebar */}
                    <button
                        type="button"
                        onMouseDown={preventFocusSteal}
                        onClick={(e) => {
                            e.preventDefault()
                            insert(' ')
                        }}
                        className={cn(
                            'flex-1 flex items-center justify-center rounded-md bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-medium text-[11px] select-none cursor-pointer',
                            'shadow-[0_1px_0_rgba(0,0,0,0.14)] dark:shadow-[0_1px_0_rgba(0,0,0,0.4)] border-b border-slate-300/60 dark:border-b-zinc-950',
                            'active:scale-95 active:bg-slate-100 dark:active:bg-zinc-700 transition-all duration-75',
                            mobileLayout ? 'h-[34px]' : 'h-[30px]'
                        )}
                    >
                        ដកឃ្លា (Space)
                    </button>

                    {/* Backspace */}
                    <button
                        type="button"
                        onMouseDown={preventFocusSteal}
                        onClick={(e) => {
                            e.preventDefault()
                            handleBackspace()
                        }}
                        className={cn(
                            'flex items-center justify-center rounded-md bg-slate-200/90 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 select-none cursor-pointer',
                            'shadow-[0_1px_0_rgba(0,0,0,0.14)] dark:shadow-[0_1px_0_rgba(0,0,0,0.4)] border-b border-slate-300/60 dark:border-b-zinc-950',
                            'active:scale-95 active:bg-red-500 active:text-white transition-all duration-75',
                            mobileLayout ? 'h-[34px] min-w-[2.75rem]' : 'h-[30px] min-w-[2.5rem]'
                        )}
                        aria-label="Backspace"
                    >
                        <DeleteIcon className="h-4 w-4" />
                    </button>
                </div>
            </div>
        )
    }

    /* -------------------------------------------------------------------------- */
    /* 1. MOBILE BOTTOM SHEET RENDER                                             */
    /* -------------------------------------------------------------------------- */
    if (isMobile) {
        return (
            <>
                {/* Trigger Button */}
                <button
                    type="button"
                    onMouseDown={preventFocusSteal}
                    onClick={(e) => {
                        e.preventDefault()
                        setOpen((v) => !v)
                    }}
                    className={cn(
                        'flex h-full w-8 items-center justify-center text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors cursor-pointer',
                        open && 'text-blue-600 dark:text-blue-400',
                        className
                    )}
                    aria-label="Open Khmer Virtual Keyboard"
                    tabIndex={-1}
                >
                    <KeyboardIcon className="h-4 w-4" />
                </button>

                {/* Mobile Bottom Docked Sheet Portal */}
                {open &&
                    typeof document !== 'undefined' &&
                    createPortal(
                        <div className="no-print fixed inset-0 z-[1000] flex flex-col justify-end pointer-events-auto">
                            {/* Backdrop Tap-to-Dismiss */}
                            <div
                                className="fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity animate-in fade-in-0"
                                onClick={() => setOpen(false)}
                            />

                            {/* Docked Keyboard Bottom Sheet */}
                            <div className="relative z-10 flex flex-col w-full bg-slate-100/95 dark:bg-zinc-950/95 backdrop-blur-2xl border-t border-slate-200/80 dark:border-zinc-800 shadow-[0_-8px_30px_rgba(0,0,0,0.2)] rounded-t-xl pb-[calc(0.4rem+env(safe-area-inset-bottom))] transition-all animate-in slide-in-from-bottom duration-200">
                                {/* iOS Drag Handle Bar */}
                                <div className="w-8 h-1 rounded-full bg-slate-300 dark:bg-zinc-700 mx-auto my-1" />

                                {/* Header with Segmented Tabs & Done Button */}
                                <div className="flex items-center justify-between px-2.5 py-0.5 border-b border-slate-200/70 dark:border-zinc-800/80">
                                    {!onlyNumbers ? (
                                        <div
                                            role="tablist"
                                            className="inline-flex items-center p-0.5 rounded-md bg-slate-200/80 dark:bg-zinc-800/90 text-[11px]"
                                        >
                                            {[
                                                { id: 'consonants', label: 'ព្យញ្ជនៈ' },
                                                { id: 'vowels', label: 'ស្រៈ' },
                                                { id: 'marks', label: 'ផ្សេងៗ' },
                                                { id: 'numbers', label: 'លេខ' },
                                            ].map((t) => (
                                                <button
                                                    key={t.id}
                                                    type="button"
                                                    onMouseDown={preventFocusSteal}
                                                    onClick={() => setTab(t.id)}
                                                    className={cn(
                                                        'px-2 py-0.5 rounded font-medium transition-all duration-150',
                                                        tab === t.id
                                                            ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-white font-bold shadow-xs'
                                                            : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                                                    )}
                                                >
                                                    {t.label}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300">
                                            ក្តារចុចលេខ (Number Keyboard)
                                        </span>
                                    )}

                                    {/* Done / Close Button */}
                                    <button
                                        type="button"
                                        onClick={() => setOpen(false)}
                                        className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-600 active:bg-blue-700 text-white text-[11px] font-semibold shadow-xs transition-all"
                                    >
                                        <Check className="h-3 w-3" />
                                        <span>រួចរាល់</span>
                                    </button>
                                </div>

                                {/* Content Grid */}
                                {onlyNumbers ? renderNumberGrid(true) : renderFullKeyboard(true)}
                            </div>
                        </div>,
                        document.body
                    )}
            </>
        )
    }

    /* -------------------------------------------------------------------------- */
    /* 2. DESKTOP POPOVER RENDER                                                  */
    /* -------------------------------------------------------------------------- */
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    onMouseDown={preventFocusSteal}
                    className={cn(
                        'flex h-full w-8 items-center justify-center text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors cursor-pointer',
                        open && 'text-blue-600 dark:text-blue-400',
                        className
                    )}
                    aria-label="Open Khmer Virtual Keyboard"
                    tabIndex={-1}
                >
                    <KeyboardIcon className="h-4 w-4" />
                </button>
            </PopoverTrigger>

            <PopoverContent
                className={cn(
                    'p-0 shadow-2xl border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-950 z-[1000] outline-none',
                    onlyNumbers ? 'w-[11.5rem]' : 'w-[19rem]'
                )}
                align="end"
                sideOffset={6}
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                {/* Desktop Header */}
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 px-2 py-1.5 bg-slate-100 dark:bg-zinc-900 rounded-t-xl">
                    {!onlyNumbers ? (
                        <div className="flex items-center gap-1">
                            {[
                                { id: 'consonants', label: 'ព្យញ្ជនៈ' },
                                { id: 'vowels', label: 'ស្រៈ' },
                                { id: 'marks', label: 'ផ្សេងៗ' },
                                { id: 'numbers', label: 'លេខ' },
                            ].map((t) => (
                                <button
                                    key={t.id}
                                    type="button"
                                    onMouseDown={preventFocusSteal}
                                    onClick={() => setTab(t.id)}
                                    className={cn(
                                        'px-2 py-0.5 text-xs rounded transition-all',
                                        tab === t.id
                                            ? 'bg-white dark:bg-zinc-800 text-blue-700 dark:text-blue-400 font-bold shadow-xs'
                                            : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                                    )}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                            ក្តារចុចលេខ
                        </span>
                    )}

                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 p-0.5 rounded cursor-pointer transition-colors"
                        aria-label="Close"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>

                {/* Content */}
                {onlyNumbers ? renderNumberGrid(false) : renderFullKeyboard(false)}
            </PopoverContent>
        </Popover>
    )
}
