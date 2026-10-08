import React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { CheckIcon, ChevronDownIcon } from '@radix-ui/react-icons'
import { UI } from 'react-day-picker'
import { cn } from '../../lib/utils'

/**
 * react-day-picker passes a native-style API (onChange + e.target.value).
 * Radix Select portals above the date popover so month/year lists are usable.
 */
export function DayPickerCaptionSelect({
    className,
    value,
    onChange,
    disabled,
    children,
    'aria-label': ariaLabel,
    style,
}) {
    const items = React.useMemo(
        () =>
            React.Children.toArray(children)
                .filter(React.isValidElement)
                .map((child) => ({
                    value: String(child.props.value),
                    label: child.props.children,
                    disabled: Boolean(child.props.disabled),
                })),
        [children]
    )

    const strVal = value !== undefined && value !== null ? String(value) : ''

    const handleChange = (v) => {
        onChange?.({ target: { value: v } })
    }

    const selected = items.find((i) => i.value === strVal)

    return (
        <span className="inline-flex min-w-0" style={style}>
            <SelectPrimitive.Root value={strVal} onValueChange={handleChange} disabled={disabled}>
                <SelectPrimitive.Trigger
                    type="button"
                    aria-label={ariaLabel}
                    className={cn(
                        'inline-flex h-10 max-w-[10.5rem] min-w-[4.75rem] shrink-0 items-center justify-between gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-800 shadow-sm outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[rgba(44,102,147,0.35)] disabled:cursor-not-allowed disabled:opacity-50',
                        className
                    )}
                >
                    <span className="min-w-0 truncate text-left">{selected?.label ?? '—'}</span>
                    <SelectPrimitive.Icon className="shrink-0 text-slate-500" aria-hidden>
                        <ChevronDownIcon className="h-3.5 w-3.5" />
                    </SelectPrimitive.Icon>
                </SelectPrimitive.Trigger>
                <SelectPrimitive.Portal>
                    <SelectPrimitive.Content
                        position="popper"
                        sideOffset={6}
                        collisionPadding={8}
                        className={cn(
                            'z-[400] max-h-[min(18rem,calc(100vh-3rem))] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl',
                            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
                        )}
                    >
                        <SelectPrimitive.Viewport className="max-h-[inherit] overflow-y-auto p-1.5">
                            {items.map((item) => (
                                <SelectPrimitive.Item
                                    key={item.value}
                                    value={item.value}
                                    disabled={item.disabled}
                                    className={cn(
                                        'relative flex cursor-default select-none items-center rounded-lg py-2 pl-8 pr-3 text-sm outline-none',
                                        'data-[disabled]:pointer-events-none data-[disabled]:opacity-35',
                                        'data-[highlighted]:bg-[rgba(44,102,147,0.1)] data-[highlighted]:text-[var(--app-header-bar-bg)]'
                                    )}
                                >
                                    <SelectPrimitive.ItemIndicator className="absolute left-2 flex text-[var(--app-header-bar-bg)]">
                                        <CheckIcon className="h-3.5 w-3.5" />
                                    </SelectPrimitive.ItemIndicator>
                                    <SelectPrimitive.ItemText>{item.label}</SelectPrimitive.ItemText>
                                </SelectPrimitive.Item>
                            ))}
                        </SelectPrimitive.Viewport>
                    </SelectPrimitive.Content>
                </SelectPrimitive.Portal>
            </SelectPrimitive.Root>
        </span>
    )
}

/** Drop-in replacement for react-day-picker Dropdown: no duplicate caption + chevron row. */
export function DayPickerDropdown({ options, className, components, classNames, style, ...selectProps }) {
    const cssClassSelect = [classNames?.[UI.Dropdown], className].filter(Boolean).join(' ')
    return (
        <span
            data-disabled={selectProps.disabled ? 'true' : undefined}
            className={classNames?.[UI.DropdownRoot]}
            style={style}
        >
            <components.Select className={cssClassSelect} {...selectProps}>
                {options?.map(({ value, label, disabled }) => (
                    <components.Option key={value} value={value} disabled={disabled}>
                        {label}
                    </components.Option>
                ))}
            </components.Select>
        </span>
    )
}
