import React, { useId, useMemo, useState } from 'react'
import { ChevronDownIcon, CheckIcon } from '@radix-ui/react-icons'
import i18n from '@dhis2/d2-i18n'
import { cn } from '../../lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './command'

/**
 * Searchable select (shadcn-style combobox): Radix Popover + cmdk Command.
 * Same API as before: `value`, `onValueChange`, `options`, `placeholder`, `disabled`, `className`.
 */
export const Select = ({
    className,
    value,
    onValueChange,
    placeholder = 'Select...',
    options = [],
    disabled = false,
    searchPlaceholder,
    onSearchChange,
    id,
    triggerId,
    ...props
}) => {
    const [open, setOpen] = useState(false)
    const listboxId = useId()
    const buttonId = triggerId || id

    const selected = useMemo(
        () => options.find((o) => String(o.value) === String(value ?? '')),
        [options, value]
    )

    const displayLabel = selected?.label
    const showPlaceholder = displayLabel == null || displayLabel === ''

    return (
        <Popover open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
            <PopoverTrigger asChild>
                <button
                    id={buttonId}
                    type="button"
                    role="combobox"
                    aria-expanded={open}
                    aria-controls={listboxId}
                    disabled={disabled}
                    className={cn(
                        'app-filter-control flex h-8 min-h-8 w-full items-center justify-between rounded-md border border-[color:var(--app-border)] bg-white px-2.5 py-1 text-[13px] font-normal app-text-title transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-black',
                        'focus:border-[var(--app-header-bar-bg)] focus:ring-1 focus:ring-[rgba(44,102,147,0.2)]',
                        className
                    )}
                >
                    <span className="min-w-0 flex-1 truncate pr-2 text-left">
                        {showPlaceholder ? (
                            <span className="text-slate-400">{placeholder}</span>
                        ) : (
                            displayLabel
                        )}
                    </span>
                    <ChevronDownIcon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                </button>
            </PopoverTrigger>
            <PopoverContent
                id={listboxId}
                align="start"
                className="z-[300] w-[var(--radix-popover-trigger-width)] min-w-[12rem] max-w-[min(100vw-2rem,32rem)] p-0"
                onCloseAutoFocus={(e) => e.preventDefault()}
            >
                <Command
                    shouldFilter
                    label={i18n.t('Search options')}
                    className="rounded-lg border-0 shadow-none"
                >
                    <CommandInput
                        placeholder={searchPlaceholder ?? i18n.t('Search…')}
                        onValueChange={(v) => onSearchChange?.(v)}
                    />
                    <CommandList>
                        <CommandEmpty>{i18n.t('No results found.')}</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => {
                                const strVal = String(option.value)
                                const rawLabel =
                                    typeof option.label === 'string' || typeof option.label === 'number'
                                        ? String(option.label).trim()
                                        : ''
                                const labelText = rawLabel || strVal
                                const isSelected = String(value ?? '') === strVal
                                return (
                                    <CommandItem
                                        key={strVal}
                                        value={labelText}
                                        keywords={[labelText, strVal]}
                                        onSelect={() => {
                                            onValueChange(option.value)
                                            setOpen(false)
                                        }}
                                    >
                                        <CheckIcon
                                            className={cn('h-4 w-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')}
                                            aria-hidden
                                        />
                                        <span className="min-w-0 flex-1 whitespace-normal break-words text-left leading-snug">
                                            {option.label}
                                        </span>
                                    </CommandItem>
                                )
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
