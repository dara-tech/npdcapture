/**
 * Runs program rules through @dhis2/rule-engine (same core as DHIS2 Capture / Android)
 * when enrollment + TEI context is available. Returns null to fall back to legacy JS rules.
 */
import {
    RuleEngineJs,
    RuleEngineContextJs,
    RuleJs,
    RuleActionJs,
    RuleVariableJs,
    RuleVariableType,
    RuleEnrollmentJs,
    RuleEventJs,
    RuleSupplementaryDataJs,
    RuleEventStatus,
    RuleLocalDate,
    ItemValueType,
    Option,
} from '@dhis2/rule-engine'

const emptyEffects = () => ({
    hiddenFields: new Set(),
    assignedValues: {},
    hiddenProgramStages: new Set(),
    hiddenSectionIds: new Set(),
    mandatoryFieldIds: new Set(),
    ruleWarnings: [],
    ruleErrors: [],
    hiddenOptionsByField: {},
})

const idFromMetadataRef = (ref) => {
    if (ref == null) return null
    if (typeof ref === 'string') return ref
    if (typeof ref === 'object' && ref.id) return String(ref.id)
    return null
}

const programStageRefId = (entity) => {
    if (!entity || typeof entity !== 'object') return null
    const flat = entity.programStageId
    if (flat != null && flat !== '') return String(flat)
    return idFromMetadataRef(entity.programStage)
}

const normalizeApiActionType = (raw) => {
    let t = String(raw ?? '')
        .trim()
        .toUpperCase()
        .replace(/-/g, '_')
    if (t === 'HIDE_FIELD') return 'HIDEFIELD'
    if (t === 'HIDE_SECTION') return 'HIDESECTION'
    if (t === 'HIDE_PROGRAM_STAGE') return 'HIDEPROGRAMSTAGE'
    if (t === 'SET_MANDATORY_FIELD') return 'SETMANDATORYFIELD'
    if (t === 'MANDATORYFIELD') return 'SETMANDATORYFIELD'
    if (t === 'SHOW_WARNING') return 'SHOWWARNING'
    if (t === 'SHOW_ERROR') return 'SHOWERROR'
    if (t === 'WARNING_ON_COMPLETE') return 'WARNINGONCOMPLETE'
    if (t === 'ERROR_ON_COMPLETE') return 'ERRORONCOMPLETE'
    if (t === 'HIDE_OPTION') return 'HIDEOPTION'
    if (t === 'ASSIGN_VALUE') return 'ASSIGN'
    return t
}

const normalizeVariableSourceType = (raw) => {
    if (raw == null || raw === '') return null
    let s = String(raw).trim().replace(/-/g, '_')
    s = s.replace(/TRACKED_ENTITY_ATTRIBUTE/gi, 'TEI_ATTRIBUTE')
    s = s.replace(/DATA_ELEMENT/gi, 'DATAELEMENT')
    const key = s.toLowerCase()
    const fromSnake = {
        dataelement_newest_event_program_stage: 'DATAELEMENT_NEWEST_EVENT_PROGRAM_STAGE',
        dataelement_newest_event_program: 'DATAELEMENT_NEWEST_EVENT_PROGRAM',
        dataelement_current_event: 'DATAELEMENT_CURRENT_EVENT',
        dataelement_previous_event: 'DATAELEMENT_PREVIOUS_EVENT',
        calculated_value: 'CALCULATED_VALUE',
        tei_attribute: 'TEI_ATTRIBUTE',
    }[key]
    if (fromSnake) return fromSnake
    const up = s.toUpperCase()
    if (
        [
            'DATAELEMENT_NEWEST_EVENT_PROGRAM_STAGE',
            'DATAELEMENT_NEWEST_EVENT_PROGRAM',
            'DATAELEMENT_CURRENT_EVENT',
            'DATAELEMENT_PREVIOUS_EVENT',
            'CALCULATED_VALUE',
            'TEI_ATTRIBUTE',
        ].includes(up)
    ) {
        return up
    }
    return null
}

const ruleVariableTypeFromApi = (src) => {
    const s = normalizeVariableSourceType(src)
    switch (s) {
        case 'DATAELEMENT_NEWEST_EVENT_PROGRAM_STAGE':
            return RuleVariableType.DATAELEMENT_NEWEST_EVENT_PROGRAM_STAGE
        case 'DATAELEMENT_NEWEST_EVENT_PROGRAM':
            return RuleVariableType.DATAELEMENT_NEWEST_EVENT_PROGRAM
        case 'DATAELEMENT_CURRENT_EVENT':
            return RuleVariableType.DATAELEMENT_CURRENT_EVENT
        case 'DATAELEMENT_PREVIOUS_EVENT':
            return RuleVariableType.DATAELEMENT_PREVIOUS_EVENT
        case 'CALCULATED_VALUE':
            return RuleVariableType.CALCULATED_VALUE
        case 'TEI_ATTRIBUTE':
            return RuleVariableType.TEI_ATTRIBUTE
        default:
            return null
    }
}

const mapItemValueType = (vt) => {
    const u = String(vt || 'TEXT').toUpperCase()
    if (
        [
            'INTEGER',
            'NUMBER',
            'PERCENTAGE',
            'INTEGER_POSITIVE',
            'INTEGER_NEGATIVE',
            'INTEGER_ZERO_OR_POSITIVE',
            'UNIT_INTERVAL',
        ].includes(u)
    ) {
        return ItemValueType.NUMBER
    }
    if (u === 'BOOLEAN' || u === 'TRUE_ONLY') return ItemValueType.BOOLEAN
    if (u === 'DATE' || u === 'DATETIME') return ItemValueType.DATE
    return ItemValueType.TEXT
}

const parseRuleLocalDate = (raw) => {
    if (!raw) return RuleLocalDate.currentDate()
    const s = String(raw).trim().split('T')[0]
    try {
        return RuleLocalDate.parse(s)
    } catch {
        return RuleLocalDate.currentDate()
    }
}

const mapEnrollmentStatus = (s) => String(s || 'ACTIVE').toUpperCase()

const mapEventStatus = (s) => {
    const u = String(s || 'ACTIVE').toUpperCase()
    if (u === 'COMPLETED') return RuleEventStatus.COMPLETED
    if (u === 'SCHEDULE') return RuleEventStatus.SCHEDULE
    if (u === 'SKIPPED') return RuleEventStatus.SKIPPED
    if (u === 'VISITED') return RuleEventStatus.VISITED
    if (u === 'OVERDUE') return RuleEventStatus.OVERDUE
    return RuleEventStatus.ACTIVE
}

const optionsFromOptionSet = (opts) => {
    if (!Array.isArray(opts) || !opts.length) return []
    return opts.map((o) => new Option(String(o.name ?? o.displayName ?? o.code ?? o.id ?? ''), String(o.code ?? o.id ?? o.name ?? '')))
}

const fieldMetaForVariable = (v, typeMeta) => {
    const deId = idFromMetadataRef(v.dataElement)
    const teaId = idFromMetadataRef(v.trackedEntityAttribute)
    if (deId && typeMeta?.dataElements?.[deId]) {
        return { field: deId, itemType: mapItemValueType(typeMeta.dataElements[deId].valueType), options: optionsFromOptionSet(typeMeta.dataElements[deId].optionSet?.options) }
    }
    if (deId) {
        const vt = v.valueType || typeMeta?.dataElements?.[deId]?.valueType || 'TEXT'
        return { field: deId, itemType: mapItemValueType(vt), options: [] }
    }
    if (teaId) {
        const a = typeMeta?.attributes?.find((x) => x.id === teaId)
        return { field: teaId, itemType: mapItemValueType(a?.valueType), options: optionsFromOptionSet(a?.optionSet?.options) }
    }
    return { field: '', itemType: ItemValueType.TEXT, options: [] }
}

const mapApiProgramRuleVariableToJs = (v, typeMeta) => {
    const st = ruleVariableTypeFromApi(v.programRuleVariableSourceType)
    if (!st) return null
    const { field, itemType, options } = fieldMetaForVariable(v, typeMeta)
    if (!field) return null
    const varName =
        (v.name != null && String(v.name).trim()) || (v.displayName != null && String(v.displayName).trim()) || ''
    if (!varName) return null
    return new RuleVariableJs(
        st,
        varName,
        Boolean(v.useCodeForOptionSet),
        options,
        field,
        itemType,
        programStageRefId(v)
    )
}

const buildActionValuesMap = (action, type) => {
    const m = new Map()
    const deId = idFromMetadataRef(action.dataElement)
    const teaId = idFromMetadataRef(action.trackedEntityAttribute)
    const secId = idFromMetadataRef(action.programStageSection)
    const stageId = programStageRefId(action)
    const optId = idFromMetadataRef(action.option)

    if (type === 'HIDEFIELD') {
        if (deId) {
            m.set('field', deId)
            m.set('attributeType', 'DATA_ELEMENT')
        } else if (teaId) {
            m.set('field', teaId)
            m.set('attributeType', 'TRACKED_ENTITY_ATTRIBUTE')
        }
        return m
    }
    if (type === 'HIDESECTION' && secId) {
        m.set('field', secId)
        m.set('attributeType', 'UNKNOWN')
        return m
    }
    if (type === 'HIDEPROGRAMSTAGE' && stageId) {
        m.set('field', stageId)
        m.set('attributeType', 'UNKNOWN')
        return m
    }
    const optCode = action.option?.code != null ? String(action.option.code) : null

    if (type === 'HIDEOPTION' && (deId || teaId) && (optId || optCode)) {
        m.set('field', deId || teaId)
        m.set('attributeType', deId ? 'DATA_ELEMENT' : 'TRACKED_ENTITY_ATTRIBUTE')
        m.set('option', optId || optCode)
        return m
    }
    if (type === 'SETMANDATORYFIELD') {
        if (deId) {
            m.set('field', deId)
            m.set('attributeType', 'DATA_ELEMENT')
        } else if (teaId) {
            m.set('field', teaId)
            m.set('attributeType', 'TRACKED_ENTITY_ATTRIBUTE')
        }
        return m
    }
    if (type === 'SHOWWARNING' || type === 'WARNINGONCOMPLETE' || type === 'SHOWERROR' || type === 'ERRORONCOMPLETE') {
        if (deId) {
            m.set('field', deId)
            m.set('attributeType', 'DATA_ELEMENT')
        } else if (teaId) {
            m.set('field', teaId)
            m.set('attributeType', 'TRACKED_ENTITY_ATTRIBUTE')
        }
        const text = action.content || ''
        m.set('content', text)
        return m
    }
    if (type === 'ASSIGN') {
        if (deId) {
            m.set('field', deId)
            m.set('attributeType', 'DATA_ELEMENT')
        } else if (teaId) {
            m.set('field', teaId)
            m.set('attributeType', 'TRACKED_ENTITY_ATTRIBUTE')
        }
        return m
    }
    return m
}

const mapApiProgramRuleActionToJs = (action) => {
    const type = normalizeApiActionType(action.programRuleActionType)
    const values = buildActionValuesMap(action, type)
    if (!values.size && type !== 'ASSIGN' && type !== 'SHOWWARNING' && type !== 'WARNINGONCOMPLETE' && type !== 'SHOWERROR' && type !== 'ERRORONCOMPLETE') {
        return null
    }
    const priority = Number.isFinite(Number(action.priority)) ? Number(action.priority) : null
    return new RuleActionJs(action.data ?? null, type, values, priority)
}

const filterRulesForStage = (rules, programStageId) => {
    if (!programStageId) return rules || []
    return (rules || []).filter((r) => {
        const rs = programStageRefId(r)
        return !rs || rs === programStageId
    })
}

/** TEAs and DEs share one `formValues` map in Capture; RuleEventJs must only receive real data element ids. */
const overlayDataElementValuesOnly = (formValues, dataElements) => {
    if (!formValues || typeof formValues !== 'object') return {}
    const deMap = dataElements && typeof dataElements === 'object' ? dataElements : null
    if (!deMap) return {}
    const out = {}
    for (const [k, v] of Object.entries(formValues)) {
        if (Object.prototype.hasOwnProperty.call(deMap, k)) out[k] = v
    }
    return out
}

const teiAttributesToArray = (tei) => {
    const out = []
    for (const a of tei?.attributes || []) {
        const id = a?.attribute || a?.trackedEntityAttribute?.id || (typeof a?.trackedEntityAttribute === 'string' ? a.trackedEntityAttribute : '')
        if (id) out.push({ trackedEntityAttribute: id, value: a.value ?? '' })
    }
    return out
}

const mergeAttributeValuesForEngine = (tei, formValues, attributeDefs) => {
    const map = {}
    for (const row of teiAttributesToArray(tei)) {
        map[row.trackedEntityAttribute] = row.value ?? ''
    }
    const attrIds = new Set((attributeDefs || []).map((a) => a.id).filter(Boolean))
    if (formValues && typeof formValues === 'object') {
        for (const [k, v] of Object.entries(formValues)) {
            if (attrIds.size && !attrIds.has(k)) continue
            if (!attrIds.size && !Object.prototype.hasOwnProperty.call(map, k)) continue
            map[k] = v ?? ''
        }
    }
    return Object.entries(map).map(([trackedEntityAttribute, value]) => ({ trackedEntityAttribute, value }))
}

const buildEnrollmentJs = (enrollment, tei, programName, formValues, attributeDefs) => {
    const inc = enrollment.incidentDate || enrollment.enrolledAt || enrollment.occurredAt
    const enr = enrollment.enrolledAt || enrollment.enrollmentDate || enrollment.occurredAt
    return new RuleEnrollmentJs(
        enrollment.enrollment,
        programName || '',
        parseRuleLocalDate(inc),
        parseRuleLocalDate(enr),
        mapEnrollmentStatus(enrollment.status),
        enrollment.orgUnit || '',
        enrollment.organisationUnitCode || null,
        mergeAttributeValuesForEngine(tei, formValues, attributeDefs)
    )
}

const eventToDataValuesArray = (event, overlay) => {
    const byDe = {}
    for (const dv of event?.dataValues || []) {
        if (dv?.dataElement) byDe[dv.dataElement] = dv.value ?? ''
    }
    if (overlay && typeof overlay === 'object') {
        for (const [k, v] of Object.entries(overlay)) {
            byDe[k] = v
        }
    }
    return Object.entries(byDe).map(([dataElement, value]) => ({ dataElement, value: value ?? '' }))
}

const buildEventJs = (event, stageName, dataValueOverlay) => {
    const day = event?.occurredAt || event?.eventDate || event?.createdAt || event?.created
    const created = event?.createdAt || event?.created || event?.lastUpdated || day
    return new RuleEventJs(
        event.event,
        event.programStage,
        stageName || '',
        mapEventStatus(event.status),
        parseRuleLocalDate(day),
        parseRuleLocalDate(created),
        null,
        event?.dueDate ? parseRuleLocalDate(event.dueDate) : null,
        event?.completedAt || event?.completedDate ? parseRuleLocalDate(event.completedAt || event.completedDate) : null,
        event.orgUnit || event.organisationUnit || '',
        event.organisationUnitCode || null,
        eventToDataValuesArray(event, dataValueOverlay)
    )
}

const mergeEffectsFromDhis2 = (effectsArr) => {
    const out = emptyEffects()

    for (const eff of effectsArr || []) {
        const act = eff.ruleAction
        if (!act) continue

        const type = normalizeApiActionType(act.type)
        const field = act.values?.get?.('field')
        const attrType = act.values?.get?.('attributeType')
        const content = act.values?.get?.('content')
        const opt = act.values?.get?.('option')

        if (type === 'HIDEFIELD' && field) {
            out.hiddenFields.add(field)
        } else if (type === 'HIDESECTION' && field) {
            out.hiddenSectionIds.add(field)
        } else if (type === 'HIDEPROGRAMSTAGE' && field) {
            out.hiddenProgramStages.add(field)
        } else if (type === 'SETMANDATORYFIELD' && field) {
            out.mandatoryFieldIds.add(field)
        } else if (type === 'ASSIGN' && field) {
            const resolved = eff.data != null ? String(eff.data) : ''
            out.assignedValues[field] = resolved
        } else if (type === 'SHOWWARNING' || type === 'WARNINGONCOMPLETE') {
            const strContent = String(content || '')
            const isStaticTip =
                strContent.includes('មានកត្តាប្រព្រឹត្តប្រឈម') ||
                strContent.includes('បើ មាន(បាទ/ចាស')
            if (content && !isStaticTip)
                out.ruleWarnings.push({
                    text: String(content),
                    fieldId: field && (attrType === 'DATA_ELEMENT' || attrType === 'TRACKED_ENTITY_ATTRIBUTE') ? field : undefined,
                })
        } else if (type === 'SHOWERROR' || type === 'ERRORONCOMPLETE') {
            if (content) out.ruleErrors.push({ text: String(content), fieldId: field })
        } else if (type === 'HIDEOPTION' && field && opt) {
            if (!out.hiddenOptionsByField[field]) out.hiddenOptionsByField[field] = new Set()
            out.hiddenOptionsByField[field].add(String(opt))
            // When female rule hides male options (MEN/MSM), also hide PPW (Partner of Pregnant Women) and PW (Pregnant Women)
            if (String(opt) === 'MEN' || String(opt) === 'kh97GX5bWlD' || String(opt) === 'MSM' || String(opt) === 'jCKuO78o3g0') {
                out.hiddenOptionsByField[field].add('PPW')
                out.hiddenOptionsByField[field].add('ARL8Z19H2kd')
                out.hiddenOptionsByField[field].add('PW')
                out.hiddenOptionsByField[field].add('blIxIScSfiF')
            }
        }
    }

    return out
}

/**
 * @returns {ReturnType<emptyEffects>|null} null → caller uses legacy evaluator
 */
export const tryEvaluateRulesWithDhis2 = ({
    rules,
    variables,
    formValues,
    programStageId = null,
    dataElements = null,
    attributes = null,
    ruleVarContext = null,
    dhis2Context = null,
}) => {
    if (!dhis2Context?.enrollment || !dhis2Context?.tei) return null
    if (!rules?.length || !variables?.length) return null

    const typeMeta = { dataElements: dataElements || undefined, attributes: attributes || undefined }
    const programName = dhis2Context.programName || ''
    const deOverlay = overlayDataElementValuesOnly(formValues, dataElements || {})

    const ruleVariablesJs = []
    for (const v of variables) {
        const rv = mapApiProgramRuleVariableToJs(v, typeMeta)
        if (rv) ruleVariablesJs.push(rv)
    }

    const filteredRules = filterRulesForStage(rules, programStageId)
    const rulesJs = []
    for (const r of filteredRules) {
        const actionsJs = []
        for (const a of r.programRuleActions || []) {
            const aj = mapApiProgramRuleActionToJs(a)
            if (aj) actionsJs.push(aj)
        }
        rulesJs.push(
            new RuleJs(
                r.condition || '',
                actionsJs,
                r.id || r.uid || '',
                r.name || null,
                programStageRefId(r),
                Number.isFinite(Number(r.priority)) ? Number(r.priority) : null
            )
        )
    }

    if (!rulesJs.length) return null

    const supplementary = new RuleSupplementaryDataJs([], [], new Map())
    const executionContext = new RuleEngineContextJs(rulesJs, ruleVariablesJs, supplementary, new Map())
    const engine = new RuleEngineJs(false)
    const enrollmentJs = buildEnrollmentJs(dhis2Context.enrollment, dhis2Context.tei, programName, formValues, attributes)

    const events = dhis2Context.enrollment.events || []
    const currentEventId = ruleVarContext?.currentEventId || null
    const draft = Boolean(ruleVarContext?.evaluatingDraftEvent)
    const stageId = programStageId || ruleVarContext?.currentProgramStageId

    try {
        if (!programStageId) {
            const otherEvents = events
                .filter((e) => e?.event)
                .map((e) => buildEventJs(e, '', null))
            const out = engine.evaluateEnrollment(enrollmentJs, otherEvents, executionContext)
            return mergeEffectsFromDhis2(out)
        }

        let targetEvent
        if (currentEventId) {
            const ev = events.find((e) => e.event === currentEventId)
            if (!ev) return null
            const stOvr = ruleVarContext?.eventStatusOverride
            const evForRules =
                stOvr != null && String(stOvr).trim() !== ''
                    ? { ...ev, status: String(stOvr).trim() }
                    : ev
            targetEvent = buildEventJs(evForRules, '', deOverlay)
        } else if (draft && stageId) {
            const syntheticId = `draft-${stageId}-${dhis2Context.enrollment.enrollment}`
            targetEvent = new RuleEventJs(
                syntheticId,
                stageId,
                '',
                RuleEventStatus.ACTIVE,
                RuleLocalDate.currentDate(),
                RuleLocalDate.currentDate(),
                null,
                null,
                null,
                dhis2Context.enrollment.orgUnit || '',
                null,
                Object.entries(deOverlay).map(([dataElement, value]) => ({ dataElement, value: value ?? '' }))
            )
        } else if (stageId) {
            // Stage tab with no event in edit mode (timeline / list): still run event-scoped rules using
            // merged formValues (e.g. newest event in stage + TEI) — same inputs as legacy; without this branch
            // the DHIS2 engine returned null and many HIDEFIELD rules never applied.
            const syntheticId = `stage-list-${stageId}-${dhis2Context.enrollment.enrollment}`
            const snapStatus = ruleVarContext?.snapshotEventStatus
            const snapDay = ruleVarContext?.snapshotEventOccurredAt
            const snapDue = ruleVarContext?.snapshotEventDueDate
            const snapCompleted = ruleVarContext?.snapshotEventCompletedAt
            const dayLd = snapDay ? parseRuleLocalDate(snapDay) : RuleLocalDate.currentDate()
            const dueLd = snapDue ? parseRuleLocalDate(snapDue) : null
            const completedLd = snapCompleted ? parseRuleLocalDate(snapCompleted) : null
            targetEvent = new RuleEventJs(
                syntheticId,
                stageId,
                '',
                mapEventStatus(snapStatus),
                dayLd,
                dayLd,
                null,
                dueLd,
                completedLd,
                dhis2Context.enrollment.orgUnit || '',
                null,
                Object.entries(deOverlay).map(([dataElement, value]) => ({ dataElement, value: value ?? '' }))
            )
        } else {
            return null
        }

        const ruleEvents = events.filter((e) => e?.event && e.event !== targetEvent.event).map((e) => buildEventJs(e, '', null))

        const out = engine.evaluateEvent(targetEvent, enrollmentJs, ruleEvents, executionContext)
        return mergeEffectsFromDhis2(out)
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn(
            '[dhis2-rule-engine] evaluation failed, falling back to legacy rules:',
            e?.message || e,
            e?.stack ? `\n${String(e.stack).split('\n').slice(0, 4).join('\n')}` : ''
        )
        return null
    }
}
