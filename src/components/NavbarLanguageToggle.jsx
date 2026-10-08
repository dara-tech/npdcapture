import React, { useEffect, useState } from 'react'
import i18n from '@dhis2/d2-i18n'
import { Maximize2, Minimize2 } from 'lucide-react'
import { useAppLocale } from '../hooks/useAppLocale'
import { cn } from '../lib/utils'

export function NavbarLanguageToggle({ className }) {
    const { currentCode, setLocale, saving } = useAppLocale()
    const isKhmer = currentCode === 'km'
    const [isFullscreen, setIsFullscreen] = useState(false)

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(Boolean(document.fullscreenElement || document.webkitFullscreenElement))
        }
        document.addEventListener('fullscreenchange', handleFullscreenChange)
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange)
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
        }
    }, [])

    const toggleFullscreen = async () => {
        try {
            if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                if (document.documentElement.requestFullscreen) {
                    await document.documentElement.requestFullscreen()
                } else if (document.documentElement.webkitRequestFullscreen) {
                    await document.documentElement.webkitRequestFullscreen()
                }
            } else {
                if (document.exitFullscreen) {
                    await document.exitFullscreen()
                } else if (document.webkitExitFullscreen) {
                    await document.webkitExitFullscreen()
                }
            }
        } catch (err) {
            console.warn('Fullscreen error:', err)
        }
    }

    return (
        <div
            className={cn(
                'no-print print:hidden fixed top-0 right-[98px] sm:right-[136px] md:right-[144px] h-[48px] z-30 flex items-center gap-1 sm:gap-1.5 select-none pointer-events-auto',
                className
            )}
        >
            {/* Fullscreen Toggle Button - Hidden on mobile viewports */}
            <button
                type="button"
                onClick={toggleFullscreen}
                className="hidden sm:inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/40 text-white/80 backdrop-blur-md border border-white/15 shadow-inner transition-all duration-200 hover:bg-white/20 hover:text-white focus:outline-none"
                title={isFullscreen ? i18n.t('Exit Fullscreen') : i18n.t('Full Screen')}
                aria-label={isFullscreen ? 'Exit Fullscreen' : 'Full Screen'}
            >
                {isFullscreen ? (
                    <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                    <Maximize2 className="h-3.5 w-3.5" />
                )}
            </button>

            {/* Language Selector */}
            <div
                role="group"
                aria-label="Language Selector"
                className="inline-flex items-center gap-0.5 rounded-full bg-slate-900/40 p-0.5 backdrop-blur-md border border-white/15 shadow-inner transition-all duration-200"
            >
                {/* Khmer Button */}
                <button
                    type="button"
                    onClick={() => !isKhmer && !saving && setLocale('km')}
                    disabled={saving}
                    className={cn(
                        'relative inline-flex items-center justify-center rounded-full px-2 sm:px-2.5 py-0.5 text-[11px] sm:text-[11.5px] font-bold transition-all duration-150 focus:outline-none',
                        isKhmer
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-white/80 hover:text-white hover:bg-white/10'
                    )}
                    title="ភាសាខ្មែរ (Khmer)"
                    aria-pressed={isKhmer}
                >
                    ខ្មែរ
                </button>

                {/* English Button */}
                <button
                    type="button"
                    onClick={() => isKhmer && !saving && setLocale('en')}
                    disabled={saving}
                    className={cn(
                        'relative inline-flex items-center justify-center rounded-full px-2 sm:px-2.5 py-0.5 text-[11px] sm:text-[11.5px] font-bold transition-all duration-150 focus:outline-none',
                        !isKhmer
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-white/80 hover:text-white hover:bg-white/10'
                    )}
                    title="English"
                    aria-pressed={!isKhmer}
                >
                    EN
                </button>
            </div>
        </div>
    )
}
