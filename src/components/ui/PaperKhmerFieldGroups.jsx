import React from 'react'
import { FORM } from '../../lib/formUi'
import { khmerFieldLabelParts } from '../../lib/stageKhmerFieldGroups'
import { cn } from '../../lib/utils'

function NumberedGroupBlock({
    group,
    bodyGridClass,
    inPaperSection,
    renderFieldRow,
    indent = true,
}) {
    return (
        <div className={cn(FORM.khmerSubgroup, indent && FORM.khmerSubgroupIndented)}>
            <div className={FORM.khmerSubgroupHeader}>
                <span className={FORM.khmerChildBadge} aria-hidden>
                    {group.childNum}
                </span>
                {group.title ? (
                    <span className={FORM.khmerSubgroupTitle}>{group.title}</span>
                ) : null}
            </div>
            <div className={cn(bodyGridClass, FORM.khmerSubgroupBody)}>
                {group.headerDe
                    ? renderFieldRow(group.headerDe, {
                          inPaperSection,
                          labelParts: khmerFieldLabelParts(
                              group.headerDe.displayName || group.headerDe.name
                          ),
                      })
                    : null}
                {group.children.map((de) =>
                    renderFieldRow(de, { inPaperSection, labelParts: null })
                )}
            </div>
        </div>
    )
}

/**
 * Paper layout: ១ / ២ / ៣ sub-blocks; ក / ខ / គ as inline choice rows (badge + label + □).
 */
export function PaperKhmerFieldGroups({
    layout,
    renderFieldRow,
    bodyGridClass,
    inPaperSection = false,
}) {
    if (!layout?.useGroupedLayout || !layout.blocks?.length) return null

    return (
        <div className={FORM.khmerGroupedSection}>
            {layout.blocks.map((block) => {
                if (block.type === 'field') {
                    return (
                        <div key={block.de.id} className={FORM.khmerGroupedLoose}>
                            {renderFieldRow(block.de, { inPaperSection, labelParts: null })}
                        </div>
                    )
                }

                if (block.type === 'numbered') {
                    return (
                        <NumberedGroupBlock
                            key={`num-${block.childNum}`}
                            group={block}
                            bodyGridClass={bodyGridClass}
                            inPaperSection={inPaperSection}
                            renderFieldRow={renderFieldRow}
                            indent={false}
                        />
                    )
                }

                if (block.type !== 'letterChoice') return null

                return (
                    <div
                        key={`letter-${block.letter}`}
                        className={FORM.paperLetterChoiceBlock}
                        aria-label={block.letter}
                    >
                        {block.headerDe ? (
                            <div className={bodyGridClass}>
                                {renderFieldRow(block.headerDe, {
                                    inPaperSection,
                                    prefixBadge: block.letter,
                                    labelParts: khmerFieldLabelParts(
                                        block.headerDe.displayName || block.headerDe.name
                                    ),
                                })}
                            </div>
                        ) : null}
                        {block.subgroups.map((sub) => (
                            <NumberedGroupBlock
                                key={`${block.letter}-${sub.childNum}`}
                                group={sub}
                                bodyGridClass={bodyGridClass}
                                inPaperSection={inPaperSection}
                                renderFieldRow={renderFieldRow}
                                indent
                            />
                        ))}
                        {block.trailing.length > 0 ? (
                            <div className={cn(bodyGridClass, FORM.paperLetterChoiceFollow)}>
                                {block.trailing.map((de) =>
                                    renderFieldRow(de, { inPaperSection, labelParts: null })
                                )}
                            </div>
                        ) : null}
                    </div>
                )
            })}
        </div>
    )
}
