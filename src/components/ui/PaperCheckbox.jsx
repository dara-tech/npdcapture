import React from 'react'
import { FORM } from '../../lib/formUi'
import { cn } from '../../lib/utils'

/**
 * Square checkbox like the paper STI form (□), sized for touch on mobile.
 */
export function PaperCheckbox({
    id,
    checked,
    onCheckedChange,
    disabled = false,
    className,
    'aria-label': ariaLabel,
}) {
    return (
        <input
            type="checkbox"
            id={id}
            checked={Boolean(checked)}
            disabled={disabled}
            aria-label={ariaLabel}
            onChange={(e) => onCheckedChange?.(e.target.checked)}
            onClick={(e) => e.stopPropagation()}
            className={cn(FORM.paperCheckbox, className)}
        />
    )
}
