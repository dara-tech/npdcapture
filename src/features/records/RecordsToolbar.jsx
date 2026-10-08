import React from 'react'
import i18n from '@dhis2/d2-i18n'
import { TrackerContextSelector } from '../context/TrackerContextSelector'
import { PAGE_LAYOUT } from '../tei-search/teiListUi'
import { cn } from '../../lib/utils'
import { useI18nLanguage } from '../../hooks/useI18nLanguage'

export const RecordsToolbar = ({ onTrashClick, dataEntryMode = false, ...props }) => {
    useI18nLanguage()

    return (
    <div className={PAGE_LAYOUT.stack}>
        <div className={cn(PAGE_LAYOUT.toolbarCard, 'custom-scrollbar overflow-visible md:overflow-x-auto')}>
            <TrackerContextSelector
                layout={dataEntryMode ? 'default' : 'admin'}
                showImportExport={!dataEntryMode}
                showViewModeToggle={!dataEntryMode}
                showColumnConfig={!dataEntryMode}
                {...props}
            />
        </div>
    </div>
    )
}
