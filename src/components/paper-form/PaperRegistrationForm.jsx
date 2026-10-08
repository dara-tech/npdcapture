import React from 'react'
import i18n from '@dhis2/d2-i18n'
import { cn } from '../../lib/utils'
import { groupProfileAttributesForDisplay } from '../../features/profile/profileAttributeLayout'
import { PaperFormDocument } from './PaperFormDocument'
import { PaperFormQuestion } from './PaperFormQuestion'
import { PaperAttributeField } from './PaperAttributeField'
import { mandatoryFieldSetHas } from '../../lib/paperFormSafety'

function ProfileAttributeTable({ children, showTableHeaders = false }) {
    return (
        <div className="paper-section-table-wrap">
            <table
                className={cn(
                    'paper-section-table',
                    'paper-profile-table',
                    !showTableHeaders && 'paper-section-table--no-head'
                )}
            >
                <colgroup>
                    <col style={{ width: '36px', minWidth: '36px', maxWidth: '36px' }} />
                    <col style={{ width: 'calc((100% - 36px) / 2)' }} />
                    <col style={{ width: 'calc((100% - 36px) / 2)' }} />
                </colgroup>
                {showTableHeaders ? (
                    <thead>
                        <tr>
                            <th scope="col" className="paper-table-th-num">
                                #
                            </th>
                            <th scope="col" className="paper-table-th-q">
                                {i18n.t('Question')}
                            </th>
                            <th scope="col" className="paper-table-th-a">
                                {i18n.t('Answer')}
                            </th>
                        </tr>
                    </thead>
                ) : null}
                <tbody>{children}</tbody>
            </table>
        </div>
    )
}

/**
 * Registration / profile attributes — same # | Question | Answer table as clinical forms.
 */
export function PaperRegistrationForm({
    title,
    sections = [],
    /** Flat attribute list (registration or profile) */
    attributes = null,
    /** Pre-grouped rows from groupProfileAttributesForDisplay */
    layoutRows = null,
    nameIds = {},
    formValues,
    setFormValues,
    mandatoryFieldIds,
    hiddenOptionsByField,
    invalidAttrHighlightId,
    ageDobPair = null,
    ageFieldId = null,
    dobFieldId = null,
    disabledAttributeIds = null,
    readOnly = false,
    documentSubtitle = null,
    /** Clinical forms use Question/Answer headers; profile omits them. */
    showTableHeaders = false,
}) {
    let rowIndex = 0
    const locked = disabledAttributeIds instanceof Set ? disabledAttributeIds : new Set()
    const layoutOpts = { ageFieldId, dobFieldId }

    const renderAttr = (attr) => {
        if (!attr) return null
        
        // Render the Age/DOB composite on the age field (if it exists). 
        // If it doesn't exist, render it on the DOB field!
        // We can just say: if this is the age field, OR if this is the DOB field, render it here.
        // Wait, if BOTH exist, we want to render it on the age field, and skip the DOB field.
        const isAgeRow = ageDobPair && (attr.id === ageFieldId || (!ageFieldId && attr.id === dobFieldId))
        if (ageDobPair && attr.id === dobFieldId && ageFieldId) return null
        
        rowIndex += 1
        const val = formValues[attr.id] ?? ''
        const hiddenOpt = hiddenOptionsByField?.[attr.id]
        const required =
            !readOnly &&
            (Boolean(attr.mandatory) || mandatoryFieldSetHas(mandatoryFieldIds, attr.id))
        const invalid = !readOnly && invalidAttrHighlightId === attr.id
        const disabled = readOnly || locked.has(attr.id)

        return (
            <PaperFormQuestion
                key={attr.id}
                layout="table"
                de={attr}
                fieldScope="attr"
                number={rowIndex}
                title={attr.name}
                required={required}
                invalid={invalid}
            >
                <PaperAttributeField
                    attr={attr}
                    value={val}
                    readOnly={readOnly}
                    onChange={
                        readOnly
                            ? undefined
                            : (next) =>
                                  setFormValues((prev) => ({ ...prev, [attr.id]: next }))
                    }
                    mandatory={required}
                    disabled={disabled}
                    hiddenOptionIds={hiddenOpt}
                    hiddenOptionCodes={hiddenOpt}
                    ageDobPair={isAgeRow ? ageDobPair : null}
                    isNameField={attr.id === nameIds.firstName || attr.id === nameIds.lastName}
                />
            </PaperFormQuestion>
        )
    }

    const layoutRowsToTableRows = (rows) => {
        if (!rows?.length) return null
        const tableRows = []
        for (const row of rows) {
            if (row.kind === 'clientName') {
                for (const attr of row.attrs) {
                    const node = renderAttr(attr)
                    if (node) tableRows.push(node)
                }
                continue
            }
            if (row.kind === 'pair') {
                for (const attr of row.attrs) {
                    const node = renderAttr(attr)
                    if (node) tableRows.push(node)
                }
                continue
            }
            if (row.kind === 'full' && row.attr) {
                const node = renderAttr(row.attr)
                if (node) tableRows.push(node)
            }
        }
        return tableRows.length ? tableRows : null
    }

    const renderLayoutRows = (rows) => {
        const tableRows = layoutRowsToTableRows(rows)
        if (!tableRows) return null
        return (
            <ProfileAttributeTable showTableHeaders={showTableHeaders}>
                {tableRows}
            </ProfileAttributeTable>
        )
    }

    const body =
        sections.length > 0
            ? sections.map((section) => {
                  const sectionRows = groupProfileAttributesForDisplay(
                      section.attributes,
                      nameIds,
                      layoutOpts
                  )
                  const table = renderLayoutRows(sectionRows)
                  if (!table) return null
                  return (
                      <section
                          key={section.id}
                          className="paper-section-block paper-profile-section"
                      >
                          {section.title ? (
                              <h3 className="paper-section-heading">{section.title}</h3>
                          ) : null}
                          {section.description ? (
                              <p className="paper-section-desc">{section.description}</p>
                          ) : null}
                          {table}
                      </section>
                  )
              })
            : (() => {
                  const table = renderLayoutRows(
                      layoutRows ??
                          groupProfileAttributesForDisplay(
                              attributes || [],
                              nameIds,
                              layoutOpts
                          )
                  )
                  if (!table) return null
                  return (
                      <section className="paper-section-block paper-profile-section">
                          {table}
                      </section>
                  )
              })()

    const subtitle =
        documentSubtitle ??
        (sections.length > 0
            ? i18n.t('Grouped by program section')
            : i18n.t('Client registration form'))

    return (
        <PaperFormDocument title={title} subtitle={subtitle} className="mt-0 sm:mt-2 mb-0 sm:mb-2">
            {body}
        </PaperFormDocument>
    )
}
