import React, { useMemo } from 'react'
import { CalendarIcon } from '@radix-ui/react-icons'
import { DatePicker } from '../ui/date-picker'
import i18n from '@dhis2/d2-i18n'
import { decodeBasicHtmlEntities } from '../../lib/utils'
import {
    resolveStageSectionBodyFields,
    resolveStageSectionGate,
} from '../../lib/stageFieldLayout'
import { paperFormQuestionIndex } from '../../lib/paperFormRowLayout'
import { buildPaperSectionItems } from '../../lib/paperFormBuildItems'
import { usePaperSectionTableLayout } from '../../lib/paperFormLayout'
import { isRiskQuestionnaireStage } from '../../lib/paperFormStages'
import {
    isKhmerLabelText,
    resolveStageFieldDisplayLabel,
    stripLeadingListIndex,
    translateStageLabelKey,
} from '../../lib/stageFieldLabelI18n'
import {
    stageFieldDisplayLabelSource,
    stageFieldLayoutLabel,
    stageFieldLayoutParts,
} from '../../lib/stageKhmerFieldGroups'
import { resolveStageFieldFormValue } from '../../lib/eventDataValues'
import { RISK_RESULT_DE_ID } from '../../lib/riskPaperFormGroups'
import { mandatoryFieldSetHas } from '../../lib/paperFormSafety'
import { normalizeBooleanFieldValue } from '../../lib/paperFormBoolean'
import { buildGateToDependentFieldsMap } from '../../lib/trackerProgramRuleFieldUi'
import { PaperFormDocument } from './PaperFormDocument'
import { PaperFormField } from './PaperFormField'
import { PaperFormQuestion } from './PaperFormQuestion'
import { PaperFormBooleanCheck } from './PaperFormControls'

function renderSectionHeading(label, id) {
    if (!label) return null
    const slashParts = label.split('/')
    let primary = slashParts[0].trim()
    const secondary = slashParts.length > 1 ? slashParts.slice(1).join('/').trim() : null

    // Normalize prefix like "ក-", "ខ-" to natural Khmer section format "ក. "
    primary = primary.replace(/^([ក-អ0-9A-Z]+)\s*[-–—]\s*/, '$1. ')

    return (
        <div key={`sec-h-${id}`} className="paper-section-heading">
            <div className="flex flex-col gap-0.5">
                <h3 className="paper-section-heading-primary">{primary}</h3>
                {secondary ? (
                    <span className="paper-section-heading-secondary">{secondary}</span>
                ) : null}
            </div>
        </div>
    )
}

function paperLabelsForDe(de, questionIndex) {
    if (!de) return { title: '', subtitle: null, number: null }
    const parts = stageFieldLayoutParts(de)
    const raw = resolveStageFieldDisplayLabel(de, parts)
    const numbered = paperFormQuestionIndex(de, questionIndex)
    const title = numbered ? stripLeadingListIndex(raw) || raw : raw
    const localized = stageFieldDisplayLabelSource(de)
    const system = stripLeadingListIndex(stageFieldLayoutLabel(de))
    let subtitle = null
    if (isKhmerLabelText(localized) && system && !isKhmerLabelText(system)) {
        const translated = translateStageLabelKey(system)
        if (translated && translated !== system) subtitle = translated
    }
    return { title, subtitle, number: numbered }
}

function PaperStageField({
    de,
    formValues,
    setFormValues,
    mandatoryFieldIds,
    hiddenOptionsByField,
    assignedValues,
    readOnly,
    eventDataValues,
    partnerSmhProps,
    clearedFieldIds = null,
    eventDate = null,
    eventId = null,
}) {
    const val = (clearedFieldIds && clearedFieldIds.current?.has(de.id))
        ? ''
        : resolveStageFieldFormValue(de.id, formValues, eventDataValues)
    const hiddenOpt = hiddenOptionsByField?.[de.id]
    return (
        <PaperFormField
            de={de}
            value={val}
            onChange={(next) => {
                if (clearedFieldIds) {
                    if (!next || String(next).trim() === '') {
                        clearedFieldIds.current.add(de.id)
                    } else {
                        clearedFieldIds.current.delete(de.id)
                    }
                }
                setFormValues((prev) => ({ ...prev, [de.id]: next }))
            }}
            disabled={readOnly}
            readOnly={readOnly}
            mandatory={Boolean(de.compulsory) || mandatoryFieldSetHas(mandatoryFieldIds, de.id)}
            hiddenOptionIds={hiddenOpt}
            hiddenOptionCodes={hiddenOpt}
            partnerSmhProps={partnerSmhProps}
            eventDate={eventDate}
            eventId={eventId}
        />
    )
}

function PaperStageQuestionRow({
    de,
    questionIndex,
    formValues,
    setFormValues,
    mandatoryFieldIds,
    hiddenOptionsByField,
    assignedValues,
    readOnly,
    invalidHighlightFieldId,
    eventDataValues,
    partnerSmhProps,
    highlightResultDeId = null,
    layout = 'stack',
    clearedFieldIds = null,
    eventDate = null,
    eventId = null,
}) {
    const { title, subtitle, number } = paperLabelsForDe(de, questionIndex)
    const isResult = Boolean(highlightResultDeId) && de.id === highlightResultDeId
    const required = Boolean(de.compulsory) || mandatoryFieldSetHas(mandatoryFieldIds, de.id)
    const invalid = invalidHighlightFieldId === de.id

    return (
        <PaperFormQuestion
            de={de}
            layout={layout}
            number={isResult ? '—' : number}
            title={title}
            subtitle={subtitle}
            required={required}
            invalid={invalid}
            isResult={isResult}
        >
            <PaperStageField
                de={de}
                formValues={formValues}
                setFormValues={setFormValues}
                mandatoryFieldIds={mandatoryFieldIds}
                hiddenOptionsByField={hiddenOptionsByField}
                assignedValues={assignedValues}
                readOnly={readOnly}
                eventDataValues={eventDataValues}
                partnerSmhProps={partnerSmhProps}
                clearedFieldIds={clearedFieldIds}
                eventDate={eventDate}
                eventId={eventId}
            />
        </PaperFormQuestion>
    )
}

/**
 * Unified paper questionnaire UI for all program stage forms.
 * Optional renderSection override for medicine grids and other special layouts.
 */
export function PaperStageForm({
    activeStage,
    programStageId,
    visibleSections,
    formValues,
    setFormValues,
    mergeStageDe,
    shouldOmitStageField,
    mandatoryFieldIds,
    hiddenOptionsByField,
    assignedValues,
    readOnly,
    invalidHighlightFieldId,
    eventDataValues,
    partnerSmhProps = null,
    renderSection = null,
    documentTitle = null,
    documentSubtitle = null,
    useGlobalQuestionNumbers = null,
    programRules = null,
    programRuleVariables = null,
    eventDateProps = null,
    clearedFieldIds = null,
    eventId = null,
    minDate = null,
    enrollmentDate = null,
}) {
    const globalNumbers =
        useGlobalQuestionNumbers ?? isRiskQuestionnaireStage(programStageId)
    const sectionTableLayout = usePaperSectionTableLayout(programStageId)
    const questionLayout = sectionTableLayout ? 'table' : 'stack'
    const resultHighlightDeId = isRiskQuestionnaireStage(programStageId) ? RISK_RESULT_DE_ID : null

    const gateToChildren = useMemo(
        () => buildGateToDependentFieldsMap(programRules, programRuleVariables),
        [programRules, programRuleVariables]
    )

    const sectionBlocks = useMemo(() => {
        const blocks = []
        for (const section of visibleSections) {
            const gate = resolveStageSectionGate(section, {
                mergeStageDe,
                formValues,
                shouldOmitStageField,
            })
            const { gateDeId, gateDe, hasBooleanGate, gateOpen, bodyDeIds } = gate
            const bodyFields = resolveStageSectionBodyFields(section, {
                mergeStageDe,
                shouldOmitStageField,
                gateDeId,
                hasBooleanGate,
                gateOpen,
                formValues,
                eventDataValues: readOnly ? eventDataValues : null,
            })
            const sectionLabel = decodeBasicHtmlEntities(
                section?.displayName || section?.name || ''
            )
            const hasSectionShell =
                bodyFields.length > 0 ||
                (hasBooleanGate && gateDe) ||
                Boolean(String(sectionLabel || '').trim())

            if (!hasSectionShell) continue
            blocks.push({
                section,
                gate,
                gateDe,
                hasBooleanGate,
                bodyDeIds,
                bodyFields,
                items: buildPaperSectionItems(bodyFields, {
                    programStageId,
                    bodyDeIds,
                    mergeStageDe,
                    useTableLayout: sectionTableLayout,
                    gateToChildren,
                }),
            })
        }
        return blocks
    }, [
        visibleSections,
        mergeStageDe,
        shouldOmitStageField,
        formValues,
        readOnly,
        eventDataValues,
        programStageId,
        sectionTableLayout,
        gateToChildren,
    ])

    const stageTitle = decodeBasicHtmlEntities(
        activeStage?.displayName || activeStage?.name || i18n.t('Clinical form')
    )

    let questionCounter = 0
    const bodyNodes = []

    const pushSectionRows = (sectionId, heading, rows) => {
        if (!rows.length && !heading) return
        if (sectionTableLayout) {
            bodyNodes.push(
                <section key={`sec-block-${sectionId}`} className="paper-section-block paper-stage-section">
                    {heading}
                    <div className="paper-section-table-wrap">
                        <table className="paper-section-table paper-stage-table paper-section-table--no-head">
                            <colgroup>
                                <col style={{ width: '36px', minWidth: '36px', maxWidth: '36px' }} />
                                <col style={{ width: '40%' }} />
                                <col style={{ width: 'auto' }} />
                            </colgroup>
                            <tbody>{rows}</tbody>
                        </table>
                    </div>
                </section>
            )
            return
        }
        if (heading) bodyNodes.push(heading)
        for (const row of rows) bodyNodes.push(row)
    }

    for (const block of sectionBlocks) {
        const { section, gate, gateDe, hasBooleanGate, bodyDeIds, bodyFields, items } = block
        const sectionRows = []

        const override = renderSection?.({
            section,
            gate,
            bodyDeIds,
            bodyFields,
            questionCounter,
            bumpQuestionCounter: (n = 1) => {
                questionCounter += n
            },
        })
        if (override != null) {
            bodyNodes.push(override)
            continue
        }

        const sectionLabel = decodeBasicHtmlEntities(
            section?.displayName || section?.name || ''
        )
        const hideHeading =
            sectionBlocks.length === 1 &&
            /risk|screening|questionnaire|ប្រឈម|prevention|បង្ការ/i.test(sectionLabel)
        const showSectionHeading = sectionBlocks.length > 1 && sectionLabel && !hideHeading
        const heading = showSectionHeading
            ? renderSectionHeading(sectionLabel, section.id)
            : null

        if (hasBooleanGate && gateDe) {
            if (globalNumbers) questionCounter += 1
            sectionRows.push(
                <PaperStageQuestionRow
                    key={gateDe.id}
                    layout={questionLayout}
                    de={gateDe}
                    questionIndex={globalNumbers ? questionCounter : null}
                    formValues={formValues}
                    setFormValues={setFormValues}
                    mandatoryFieldIds={mandatoryFieldIds}
                    hiddenOptionsByField={hiddenOptionsByField}
                    assignedValues={assignedValues}
                    readOnly={readOnly}
                    invalidHighlightFieldId={invalidHighlightFieldId}
                    eventDataValues={eventDataValues}
                    partnerSmhProps={partnerSmhProps}
                    highlightResultDeId={resultHighlightDeId}
                    clearedFieldIds={clearedFieldIds}
                    eventId={eventId}
                />
            )
        }

        for (const item of items) {
            if (item.type === 'checklist' && item.useFieldLabels) {
                const fields = (item.fields || []).filter(Boolean)
                if (!fields.length) continue

                if (sectionTableLayout) {
                    for (const de of fields) {
                        if (globalNumbers) questionCounter += 1
                        sectionRows.push(
                            <PaperStageQuestionRow
                                key={de.id}
                                layout={questionLayout}
                                de={de}
                                questionIndex={globalNumbers ? questionCounter : null}
                                formValues={formValues}
                                setFormValues={setFormValues}
                                mandatoryFieldIds={mandatoryFieldIds}
                                hiddenOptionsByField={hiddenOptionsByField}
                                assignedValues={assignedValues}
                                readOnly={readOnly}
                                invalidHighlightFieldId={invalidHighlightFieldId}
                                eventDataValues={eventDataValues}
                                partnerSmhProps={partnerSmhProps}
                                highlightResultDeId={resultHighlightDeId}
                                clearedFieldIds={clearedFieldIds}
                                eventId={eventId}
                            />
                        )
                    }
                    continue
                }

                const layoutClass =
                    item.layout === 'two-column'
                        ? 'paper-answers-two-col paper-checklist-labeled'
                        : 'paper-answers-four-col paper-checklist-labeled'
                const checklistBody = (
                    <div className={layoutClass} role="group">
                        {fields.map((de) => (
                            <PaperFormBooleanCheck
                                key={de.id}
                                id={`paper-cb-${de.id}`}
                                label={stripLeadingListIndex(
                                    resolveStageFieldDisplayLabel(de, stageFieldLayoutParts(de))
                                )}
                                checked={
                                    String(
                                        resolveStageFieldFormValue(
                                            de.id,
                                            formValues,
                                            eventDataValues
                                        )
                                    ).toLowerCase() === 'true'
                                }
                                disabled={readOnly}
                                onChange={(on) =>
                                    setFormValues((prev) => ({
                                        ...prev,
                                        [de.id]: normalizeBooleanFieldValue(on ? 'true' : '', {
                                            mandatory:
                                                Boolean(de.compulsory) ||
                                                mandatoryFieldSetHas(mandatoryFieldIds, de.id),
                                        }),
                                    }))
                                }
                            />
                        ))}
                    </div>
                )
                sectionRows.push(
                    <div key={`checklist-${fields.map((f) => f.id).join('-')}`}>
                        {checklistBody}
                    </div>
                )
                continue
            }

            if (item.type === 'group' || item.type === 'checklist') {
                const fields = (item.fields || []).filter(Boolean)
                if (!fields.length) continue
                const number = item.number ?? null
                const title =
                    item.type === 'group' && item.title
                        ? i18n.t(item.title)
                        : item.type === 'checklist' && sectionLabel
                          ? sectionLabel
                          : stripLeadingListIndex(
                                resolveStageFieldDisplayLabel(
                                    fields[0],
                                    stageFieldLayoutParts(fields[0])
                                )
                            ) || fields[0]?.name || ''
                if (globalNumbers && item.type === 'checklist') {
                    questionCounter += 1
                }
                const groupAnswerClass = sectionTableLayout
                    ? item.layout === 'two-column'
                        ? 'paper-answers-two-col paper-checklist-labeled'
                        : 'paper-answers-four-col paper-checklist-labeled'
                    : 'paper-answers-stack'

                sectionRows.push(
                    <PaperFormQuestion
                        key={`${item.type}-${fields.map((f) => f.id).join('-')}`}
                        layout={questionLayout}
                        de={fields[0]}
                        number={
                            item.type === 'group'
                                ? number
                                : globalNumbers
                                  ? String(questionCounter)
                                  : null
                        }
                        title={title}
                        required={fields.some(
                            (f) =>
                                Boolean(f.compulsory) || mandatoryFieldSetHas(mandatoryFieldIds, f.id)
                        )}
                        invalid={fields.some((f) => invalidHighlightFieldId === f.id)}
                        indentAnswers={!sectionTableLayout}
                    >
                        <div className={groupAnswerClass}>
                            {fields.map((de) => (
                                <PaperFormBooleanCheck
                                    key={de.id}
                                    id={`paper-cb-${de.id}`}
                                    label={stripLeadingListIndex(
                                        resolveStageFieldDisplayLabel(
                                            de,
                                            stageFieldLayoutParts(de)
                                        )
                                    )}
                                    checked={
                                        String(
                                            resolveStageFieldFormValue(
                                                de.id,
                                                formValues,
                                                eventDataValues
                                            )
                                        ).toLowerCase() === 'true'
                                    }
                                    disabled={readOnly}
                                    onChange={(on) =>
                                        setFormValues((prev) => ({
                                            ...prev,
                                            [de.id]: normalizeBooleanFieldValue(on ? 'true' : '', {
                                                mandatory:
                                                    Boolean(de.compulsory) ||
                                                    mandatoryFieldSetHas(mandatoryFieldIds, de.id),
                                            }),
                                        }))
                                    }
                                />
                            ))}
                        </div>
                    </PaperFormQuestion>
                )
                continue
            }

            if (!item.de?.id) continue

            if (globalNumbers) questionCounter += 1
            sectionRows.push(
                <PaperStageQuestionRow
                    key={item.de.id}
                    layout={questionLayout}
                    de={item.de}
                    questionIndex={globalNumbers ? questionCounter : null}
                    formValues={formValues}
                    setFormValues={setFormValues}
                    mandatoryFieldIds={mandatoryFieldIds}
                    hiddenOptionsByField={hiddenOptionsByField}
                    assignedValues={assignedValues}
                    readOnly={readOnly}
                    invalidHighlightFieldId={invalidHighlightFieldId}
                    eventDataValues={eventDataValues}
                    partnerSmhProps={partnerSmhProps}
                    highlightResultDeId={resultHighlightDeId}
                    clearedFieldIds={clearedFieldIds}
                    eventDate={eventDateProps?.eventDate}
                    eventId={eventId}
                />
            )
        }

        pushSectionRows(section.id, heading, sectionRows)
    }

    const title = documentTitle != null && String(documentTitle).trim() !== '' ? documentTitle : stageTitle

    return (
        <PaperFormDocument title={title} subtitle={documentSubtitle} className="mt-1 sm:mt-2 mb-2">
            {eventDateProps ? (
                <div className="mb-3 border-b-0 pb-0 md:mb-4 md:border-b md:border-stone-200 md:pb-3.5 dark:md:border-zinc-800">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/85 bg-white px-3.5 py-2.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900/90 sm:px-4">
                        <div className="flex items-center gap-2.5 text-[13px] font-semibold text-slate-800 dark:text-zinc-200">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--app-header-bar-bg)]/10 text-[var(--app-header-bar-bg)] dark:bg-sky-950/70 dark:text-sky-300">
                                <CalendarIcon className="h-4 w-4" />
                            </div>
                            <span>{i18n.t('ថ្ងៃ ខែ ឆ្នាំ មកពិនិត្យ')}</span>
                            <span className="text-red-500">*</span>
                        </div>
                        <div className="w-52 max-w-full">
                            {readOnly ? (
                                <div className="text-[13px] font-medium text-slate-800 dark:text-zinc-200">
                                    {eventDateProps.eventDate || '-'}
                                </div>
                            ) : (
                                <DatePicker
                                    date={eventDateProps.eventDate}
                                    setDate={(d) => {
                                        if (d) eventDateProps.setEventDate(d)
                                    }}
                                    placeholder={i18n.t('Pick date')}
                                    disabled={readOnly}
                                    showExternalClear={false}
                                    disableFuture={true}
                                    minDate={eventDateProps?.minDate || minDate || enrollmentDate}
                                />
                            )}
                        </div>
                    </div>
                </div>
            ) : null}
            {bodyNodes}
        </PaperFormDocument>
    )
}

/** @deprecated Use PaperStageForm */
export const RiskPaperStageForm = PaperStageForm
