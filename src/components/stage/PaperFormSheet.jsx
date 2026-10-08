import React from 'react'
import i18n from '@dhis2/d2-i18n'
import { FORM } from '../../lib/formUi'
import { cn } from '../../lib/utils'

/**
 * Outer “printed form” frame for Prevention / Risk Assessment stages.
 */
export function PaperFormSheet({ className, stageLabel, children }) {
    return (
        <div className={cn(FORM.paperFormSheet, 'app-form-surface', className)}>
            {stageLabel ? <div className={FORM.paperFormSheetTitle}>{stageLabel}</div> : null}
            <div className="flex flex-col">{children}</div>
        </div>
    )
}

export function paperFormSheetTitle(stage) {
    return stage?.displayName || stage?.name || i18n.t('Questionnaire')
}
