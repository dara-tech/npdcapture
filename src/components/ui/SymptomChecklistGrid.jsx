import React from 'react'
import { FORM } from '../../lib/formUi'
import { resolveStageOptionDisplayLabel } from '../../lib/stageFieldLabelI18n'
import { cn } from '../../lib/utils'
import { PaperCheckbox } from './PaperCheckbox'

/**
 * Paper-form checklist: label | checkbox per row.
 * @param {boolean} [singleColumn] — lab site list (one column); default is 2-col symptom grid.
 */
export function SymptomChecklistGrid({
    options,
    isSelected,
    onToggle,
    disabled,
    idPrefix,
    singleColumn = false,
}) {
    if (!options?.length) return null

    return (
        <div
            className={singleColumn ? FORM.symptomChecklistGridSingle : FORM.symptomChecklistGrid}
            role="group"
        >
            {options.map((opt) => {
                const code = opt.code ?? opt.id
                const checkboxId = `${idPrefix}-cb-${code}`
                const selected = isSelected(opt)
                const label = resolveStageOptionDisplayLabel(opt)
                return (
                    <label
                        key={code}
                        htmlFor={checkboxId}
                        className={cn(
                            FORM.symptomChecklistCell,
                            selected && FORM.symptomChecklistCellActive
                        )}
                    >
                        <span className={FORM.symptomChecklistLabel} title={label}>
                            {label}
                        </span>
                        <span className={FORM.symptomChecklistCheckboxCol}>
                            <PaperCheckbox
                                id={checkboxId}
                                disabled={disabled}
                                checked={selected}
                                aria-label={label}
                                onCheckedChange={() => onToggle(code)}
                            />
                        </span>
                    </label>
                )
            })}
        </div>
    )
}
