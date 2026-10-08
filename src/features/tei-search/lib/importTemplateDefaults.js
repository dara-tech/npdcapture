import { isImportOptionalToggleAttribute } from './importProfileAttributes'
import { getStageFormColumnsForImport } from './stageImportSections'

/** Profile columns included in a new template by default (Yes/No fields off unless selected). */
export const defaultTemplateAttributeIds = (programAttributes = []) =>
    (programAttributes || [])
        .filter((a) => a?.id && !isImportOptionalToggleAttribute(a))
        .map((a) => a.id)

export const defaultTemplateDataElementIds = (stage) =>
    getStageFormColumnsForImport(stage).map((col) => col.de.id)
