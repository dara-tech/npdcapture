import { resolveStageFieldDisplayLabel } from '../../../lib/stageFieldLabelI18n'
import { stageFieldLayoutParts } from '../../../lib/stageKhmerFieldGroups'

const SEX_ATTRIBUTE_HINTS = /ភេទ|^sex\b|gender|sex at birth/i
const DOB_ATTRIBUTE_HINTS = /ថ្ងៃខែឆ្នាំកំណើត|date of birth|dob|birth date/i
const AGE_ATTRIBUTE_HINTS = /អាយុ|^age\b/i
const PATIENT_TYPE_ATTRIBUTE_HINTS = /patient type|client type|population|\bkp\b|kp type|target pop|ក្រុមប្រឈម|ប្រភេទអ្នកជំងឺ|ប្រភេទអតិថិជន|^ប្រភេទ\b|client category/i

const LAB_TEST_HINTS = /lab|មន្ទីរពិសោធន៍|តេស្ត|test|rpr|hiv|syphilis|tppa|tpha|hepatitis|hcv|hbv|naat|pcr|gram|wet mount/i
const REACTIVE_HINTS = /^(true|positive|reactive|មានប្រតិកម្ម|វិជ្ជមាន|pos|react|1)$/i
const NON_REACTIVE_HINTS = /^(false|negative|non-reactive|nonreactive|មិនមានប្រតិកម្ម|អវិជ្ជមាន|neg|non-react|0)$/i

const MEDICINE_HINTS = /ឱសថ|ថ្នាំ|medicine|drug|treatment|antibiotic|penicillin|ceftriaxone|azithromycin|doxycycline|metronidazole|cefixime|acyclovir|prep|pep|arv|spectinomycin|amoxicillin|ciprofloxacin|erythromycin|benzathine|gentamicin/i

export function cleanKhmerEnglishMixedLabel(text) {
    if (!text) return ''
    const str = String(text).trim()

    // If it contains Khmer script
    const hasKhmer = /[\u1780-\u17FF]/.test(str)
    if (hasKhmer) {
        // Remove trailing parenthesized English/Latin like "ទេ (No)" -> "ទេ", "បាទ/ចាស (Yes)" -> "បាទ/ចាស"
        let cleaned = str.replace(/\s*\([A-Za-z0-9\s,\.\-_\/]+\)\s*$/, '').trim()

        // If it has "/" separating Khmer and pure Latin/English:
        // e.g. "ក-ការផ្តល់ពត៌មានទូទៅ/General information" -> "ក-ការផ្តល់ពត៌មានទូទៅ"
        if (cleaned.includes('/')) {
            const parts = cleaned.split('/')
            if (parts.length === 2 && /[\u1780-\u17FF]/.test(parts[0]) && !/[\u1780-\u17FF]/.test(parts[1])) {
                cleaned = parts[0].trim()
            }
        }
        return cleaned
    }

    return str
}

function normalizeDate(raw) {
    if (!raw) return ''
    return String(raw).includes('T') ? raw.split('T')[0] : String(raw).slice(0, 10)
}

function computeAge(dobStr, ageStr, refDate = new Date()) {
    if (ageStr && !isNaN(Number(ageStr))) {
        return Number(ageStr)
    }
    if (dobStr) {
        const dob = new Date(dobStr)
        if (!isNaN(dob.getTime())) {
            const diffMs = refDate.getTime() - dob.getTime()
            const ageDate = new Date(diffMs)
            return Math.abs(ageDate.getUTCFullYear() - 1970)
        }
    }
    return null
}

function resolveTeiAttribute(tei, hints, teaMap) {
    const teiObj = tei?.tei || tei || {}
    const attrs = teiObj.attributes || tei?.attributes || []
    for (const attr of attrs) {
        const teaId = attr.attribute || attr.id
        const teaMeta = teaMap?.get(teaId)
        const name = String(teaMeta?.displayName || teaMeta?.name || attr.displayName || attr.name || '').trim()
        if (hints.test(name)) {
            const rawVal = attr.value
            if (rawVal == null || String(rawVal).trim() === '') return null
            if (teaMeta?.optionSet?.options?.length) {
                const opt = teaMeta.optionSet.options.find(
                    (o) => o.code === rawVal || o.id === rawVal || o.name === rawVal || o.displayName === rawVal
                )
                if (opt) return opt.displayName || opt.name || rawVal
            }
            return rawVal
        }
    }
    return null
}

export function extractTeiDemographics(tei, teaMap) {
    const rawSex = resolveTeiAttribute(tei, SEX_ATTRIBUTE_HINTS, teaMap)
    const sexStr = String(rawSex || '').toLowerCase().trim()
    let sex = 'UNKNOWN'
    if (/male|^m\b|ប្រុស/i.test(sexStr)) sex = 'MALE'
    else if (/female|^f\b|ស្រី/i.test(sexStr)) sex = 'FEMALE'
    else if (sexStr) sex = 'OTHER'

    const rawDob = resolveTeiAttribute(tei, DOB_ATTRIBUTE_HINTS, teaMap)
    const rawAge = resolveTeiAttribute(tei, AGE_ATTRIBUTE_HINTS, teaMap)
    const age = computeAge(rawDob, rawAge)

    let ageGroup = 'unknown'
    if (age !== null && !isNaN(age)) {
        if (age < 15) ageGroup = 'under15'
        else if (age <= 49) ageGroup = 'age15to49'
        else ageGroup = 'age50plus'
    }

    const rawPop = resolveTeiAttribute(tei, PATIENT_TYPE_ATTRIBUTE_HINTS, teaMap)
    const popStr = String(rawPop || '').toLowerCase().trim()
    let population = 'OTHER'
    if (/msm|tg|trans|បុរសរួមភេទ|កែភេទ/i.test(popStr)) population = 'MSM_TG'
    else if (/few|ew|entertainment|កំសាន្ត/i.test(popStr)) population = 'FEW'
    else if (/lrw|low risk|ប្រឈមទាប/i.test(popStr)) population = 'LRW'
    else if (/pwid|pwud|drug|គ្រឿងញៀន/i.test(popStr)) population = 'PWID_PWUD'
    else if (/partner|ដៃគូ|ppw\b/i.test(popStr)) {
        population = sex === 'FEMALE' ? 'PARTNER_F' : 'PARTNER_M'
    } else if (/pregnant|pw\b|ផ្ទៃពោះ/i.test(popStr)) {
        population = 'PW'
    } else if (sex === 'MALE') {
        population = 'MEN'
    } else if (sex === 'FEMALE') {
        population = 'LRW'
    }

    return { sex, age, ageGroup, population, rawPop: rawPop || 'Other', rawSex }
}

export function createDemographicGrid() {
    return {
        male: {
            under15: 0,
            age15to49: 0,
            age50plus: 0,
            total: 0,
            teis: { under15: [], age15to49: [], age50plus: [], all: [] },
        },
        female: {
            under15: 0,
            age15to49: 0,
            age50plus: 0,
            total: 0,
            teis: { under15: [], age15to49: [], age50plus: [], all: [] },
        },
        other: {
            under15: 0,
            age15to49: 0,
            age50plus: 0,
            total: 0,
            teis: { under15: [], age15to49: [], age50plus: [], all: [] },
        },
        total: 0,
        teis: [],
    }
}

export function recordDemographicHit(grid, demo, eventTei) {
    if (!grid) return
    const genderKey = demo.sex === 'MALE' ? 'male' : demo.sex === 'FEMALE' ? 'female' : 'other'
    const ageKey = demo.ageGroup === 'under15' ? 'under15' : demo.ageGroup === 'age50plus' ? 'age50plus' : 'age15to49'

    grid[genderKey][ageKey] += 1
    grid[genderKey].total += 1
    if (grid[genderKey].teis[ageKey]) grid[genderKey].teis[ageKey].push(eventTei)
    if (grid[genderKey].teis.all) grid[genderKey].teis.all.push(eventTei)

    grid.total += 1
    grid.teis.push(eventTei)
}

export function mergeDemographicGrid(target, source) {
    if (!target || !source) return
    for (const gender of ['male', 'female', 'other']) {
        if (!target[gender] || !source[gender]) continue
        for (const age of ['under15', 'age15to49', 'age50plus']) {
            target[gender][age] = (target[gender][age] || 0) + (source[gender][age] || 0)
            if (source[gender].teis?.[age]?.length) {
                if (!target[gender].teis) target[gender].teis = { under15: [], age15to49: [], age50plus: [], all: [] }
                if (!target[gender].teis[age]) target[gender].teis[age] = []
                target[gender].teis[age].push(...source[gender].teis[age])
            }
        }
        target[gender].total = (target[gender].total || 0) + (source[gender].total || 0)
        if (source[gender].teis?.all?.length) {
            if (!target[gender].teis) target[gender].teis = { under15: [], age15to49: [], age50plus: [], all: [] }
            if (!target[gender].teis.all) target[gender].teis.all = []
            target[gender].teis.all.push(...source[gender].teis.all)
        }
    }
    target.total = (target.total || 0) + (source.total || 0)
    if (source.teis?.length) {
        if (!target.teis) target.teis = []
        target.teis.push(...source.teis)
    }
}

export function isMedicineIndicator(ind) {
    if (!ind) return false
    const name = String(ind.name || '')
    if (/ឈ្មោះ\s*ឱសថ|name\s*of\s*medicine|medicine\s*name|drug\s*name|ឈ្មោះថ្នាំ/i.test(name)) return true
    if (/^([១២៣៤៥]|[1-5])[\s.]*[-–—/]\s*.*(ឱសថ|ថ្នាំ|medicine|drug)/i.test(name)) return true
    if (/ផ្សេង\s*ទៀត|other\s*drug|other\s*medicine|ឈ្មោះឱសថផ្សេង|ឱសថផ្សេង/i.test(name)) return true
    return false
}

export function getCanonicalDeName(rawName) {
    if (!rawName) return ''
    let name = String(rawName).trim()
    name = name.replace(/^([១២៣៤៥]|[1-5])[\s.]*[-–—/]\s*/, '').trim()
    if (/^ឈ្មោះ\s*ឱសថ.*(ផ្សេង|other)/i.test(name) || /^(ផ្សេង|other).*ឱសថ/i.test(name)) {
        name = 'ឈ្មោះឱសថ'
    }
    return name
}

export function combineSectionIndicators(indicatorsList) {
    if (!indicatorsList || indicatorsList.length === 0) return []

    const result = []
    const combinedMap = new Map()

    for (const ind of indicatorsList) {
        const rawName = ind.name || ''
        const isMed = isMedicineIndicator(ind)
        const isSlotNumbered = /^([១២៣៤៥]|[1-5])[\s.]*[-–—/]\s*/.test(rawName)
        const canonicalName = getCanonicalDeName(rawName)

        const shouldCombine = isMed || (isSlotNumbered && Boolean(canonicalName))

        if (!shouldCombine) {
            result.push(ind)
            continue
        }

        const groupKey = isMed ? 'MEDICINE_NAME_COMBINED' : canonicalName.toLowerCase()

        if (!combinedMap.has(groupKey)) {
            const combinedName = isMed ? 'ឈ្មោះឱសថ' : canonicalName
            const targetInd = {
                ...ind,
                deId: isMed ? `combined_medicine_${ind.stageId || 'default'}` : `combined_${ind.deId}`,
                name: combinedName,
                total: 0,
                demographics: createDemographicGrid(),
                teis: [],
                hasOptions: Boolean(ind.hasOptions),
                options: [],
                _optionsMap: new Map(),
            }

            if (ind.hasOptions && ind.options) {
                for (const opt of ind.options) {
                    const optKey = (opt.code || opt.name || '').trim().toLowerCase()
                    const optCopy = {
                        ...opt,
                        total: 0,
                        demographics: createDemographicGrid(),
                        teis: [],
                    }
                    targetInd._optionsMap.set(optKey, optCopy)
                    targetInd.options.push(optCopy)
                }
            }

            combinedMap.set(groupKey, targetInd)
            result.push(targetInd)
        }

        const target = combinedMap.get(groupKey)

        target.total += ind.total || 0
        mergeDemographicGrid(target.demographics, ind.demographics)
        if (ind.teis?.length) {
            target.teis.push(...ind.teis)
        }

        if (ind.hasOptions && ind.options) {
            target.hasOptions = true
            for (const opt of ind.options) {
                const optKey = (opt.code || opt.name || '').trim().toLowerCase()
                let targetOpt = target._optionsMap.get(optKey)

                if (!targetOpt) {
                    targetOpt = {
                        ...opt,
                        total: 0,
                        demographics: createDemographicGrid(),
                        teis: [],
                    }
                    target._optionsMap.set(optKey, targetOpt)
                    target.options.push(targetOpt)
                }

                targetOpt.total += opt.total || 0
                mergeDemographicGrid(targetOpt.demographics, opt.demographics)
                if (opt.teis?.length) {
                    targetOpt.teis.push(...opt.teis)
                }
            }
        }
    }

    for (const ind of result) {
        if (ind._optionsMap) {
            delete ind._optionsMap
        }
        if (ind.hasOptions && ind.options?.length) {
            ind.options.sort((a, b) => b.total - a.total)
            const hasCounts = ind.options.some((o) => o.total > 0)
            if (hasCounts && ind.options.length > 8) {
                ind.options = ind.options.filter((o) => o.total > 0)
            }
        }
    }

    return result
}

export function combineMatrixIndicators(indicatorsList) {
    if (!indicatorsList || indicatorsList.length === 0) return []

    const result = []
    const combinedMap = new Map()

    for (const de of indicatorsList) {
        const rawName = de.name || ''
        const isMed = isMedicineIndicator(de)
        const isSlotNumbered = /^([១២៣៤៥]|[1-5])[\s.]*[-–—/]\s*/.test(rawName)
        const canonicalName = getCanonicalDeName(rawName)

        const shouldCombine = isMed || (isSlotNumbered && Boolean(canonicalName))

        if (!shouldCombine) {
            result.push(de)
            continue
        }

        const groupKey = isMed ? 'MEDICINE_NAME_COMBINED' : canonicalName.toLowerCase()

        if (!combinedMap.has(groupKey)) {
            const combinedName = isMed ? 'ឈ្មោះឱសថ' : canonicalName
            const targetDe = {
                ...de,
                id: isMed ? `combined_medicine_${de.stageId || 'default'}` : `combined_${de.id}`,
                name: combinedName,
                total: 0,
                frequencies: {},
                valueTeis: {},
                demographics: createDemographicGrid(),
                optionDemographics: {},
                teis: [],
            }
            combinedMap.set(groupKey, targetDe)
            result.push(targetDe)
        }

        const target = combinedMap.get(groupKey)
        target.total += de.total || 0
        mergeDemographicGrid(target.demographics, de.demographics)
        if (de.teis?.length) {
            target.teis.push(...de.teis)
        }

        for (const [val, freq] of Object.entries(de.frequencies || {})) {
            target.frequencies[val] = (target.frequencies[val] || 0) + freq
            if (de.valueTeis?.[val]?.length) {
                if (!target.valueTeis[val]) target.valueTeis[val] = []
                target.valueTeis[val].push(...de.valueTeis[val])
            }
            if (de.optionDemographics?.[val]) {
                if (!target.optionDemographics[val]) {
                    target.optionDemographics[val] = createDemographicGrid()
                }
                mergeDemographicGrid(target.optionDemographics[val], de.optionDemographics[val])
            }
        }
    }

    return result
}

export function formatTeiReportItem(tei, teaMap = new Map(), ev = null) {
    const teiObj = tei?.tei || tei || {}
    const teiId = teiObj.trackedEntity || teiObj.trackedEntityInstance || tei?.trackedEntity || tei?.id || ev?.trackedEntity
    const enr = teiObj.enrollments?.[0] || tei?.enrollments?.[0]
    const enrId = enr?.enrollment || tei?.enrollment || ev?.enrollment
    const enrDate = normalizeDate(enr?.enrolledAt || enr?.enrollmentDate || tei?.enrolledAt)

    const findVal = (hints) => {
        const attrs = teiObj.attributes || tei?.attributes || []
        for (const a of attrs) {
            const teaId = a.attribute || a.id
            const tea = teaMap.get(teaId)
            const name = tea?.displayName || tea?.name || a.displayName || a.name || ''
            if (hints.test(name)) {
                if (tea?.optionSet?.options?.length) {
                    const opt = tea.optionSet.options.find(
                        (o) => o.code === a.value || o.id === a.value || o.name === a.value || o.displayName === a.value
                    )
                    if (opt) return opt.displayName || opt.name || a.value
                }
                return a.value
            }
        }
        return null
    }

    const uuic = findVal(/^uuic\b|uuic/i) || ''
    const pmrs = findVal(/^pmrs\b|pmrs|smh/i) || ''
    const otherId = findVal(/art code|id poor|code|client id/i) || ''
    const clientCode = uuic || pmrs || otherId || teiId?.slice(-6)

    const firstName = findVal(/first name|given name|ឈ្មោះ/i) || ''
    const lastName = findVal(/last name|family name|នាមត្រកូល/i) || ''
    const fullName = [lastName, firstName].filter(Boolean).join(' ') || findVal(/name|ឈ្មោះ/i) || 'អនាមិក'
    
    const rawSex = findVal(SEX_ATTRIBUTE_HINTS)
    const sexStr = String(rawSex || '').toLowerCase().trim()
    let sexLabel = '—'
    if (/male|^m\b|ប្រុស/i.test(sexStr)) sexLabel = 'ប្រុស'
    else if (/female|^f\b|ស្រី/i.test(sexStr)) sexLabel = 'ស្រី'
    else if (sexStr) sexLabel = 'ផ្សេងៗ'

    const dob = findVal(DOB_ATTRIBUTE_HINTS)
    const age = findVal(AGE_ATTRIBUTE_HINTS) || computeAge(dob, null)
    const patientType = findVal(PATIENT_TYPE_ATTRIBUTE_HINTS)
    const phone = findVal(/phone|tel|ទូរស័ព្ទ/i)

    const targetEv = ev || (tei?.event ? tei : null)
    const evDate = targetEv ? normalizeDate(targetEv.occurredAt || targetEv.eventDate || targetEv.createdAt) : null

    return {
        id: teiId,
        teiId,
        enrollmentId: enrId,
        eventId: targetEv?.event,
        uuic: uuic || '—',
        pmrs: pmrs || otherId || '—',
        clientCode,
        name: fullName,
        sex: sexLabel,
        age: age || '—',
        patientType: cleanKhmerEnglishMixedLabel(patientType) || '—',
        phone: phone || '—',
        enrollmentDate: evDate || enrDate || '—',
        tei: teiObj,
    }
}

export function aggregateMonthlyReportData({
    teis = [],
    metadata = null,
    periodRange = null,
}) {
    const startDate = periodRange?.startDate || ''
    const endDate = periodRange?.endDate || ''

    // Build Tracked Entity Attributes lookup
    const teaMap = new Map()
    for (const entry of metadata?.programTrackedEntityAttributes || []) {
        const tea = entry.trackedEntityAttribute || entry
        if (tea?.id) teaMap.set(tea.id, tea)
    }
    for (const tea of metadata?.attributes || metadata?.trackedEntityAttributes || []) {
        if (tea?.id) teaMap.set(tea.id, tea)
    }

    const stages = metadata?.stages || metadata?.programStages || []
    const stageMap = new Map()
    for (const s of stages) {
        stageMap.set(s.id, s)
    }

    // Build data element lookup
    const deMap = new Map()
    const deSectionMap = new Map()
    for (const s of stages) {
        const sSections = s.sections || s.programStageSections || []
        for (let secIdx = 0; secIdx < sSections.length; secIdx++) {
            const sec = sSections[secIdx]
            const rawSecName = sec.displayName || sec.name || sec.formName || `ផ្នែកទី ${secIdx + 1}`
            const secName = cleanKhmerEnglishMixedLabel(rawSecName)
            const secOrder = Number(sec.sortOrder ?? secIdx)
            const deIds = sec.dataElementIds || (sec.dataElements || []).map((d) => d?.id).filter(Boolean)
            for (const deId of deIds) {
                deSectionMap.set(`${s.id}:${deId}`, {
                    sectionId: sec.id || `sec_${secIdx}`,
                    sectionName: secName,
                    sectionSortOrder: secOrder,
                })
            }
        }

        for (const de of s.dataElements || []) {
            if (de?.id) {
                const stageDeObj = {
                    ...de,
                    stageId: s.id,
                    stageName: cleanKhmerEnglishMixedLabel(s.displayName || s.name),
                }
                deMap.set(`${s.id}:${de.id}`, stageDeObj)
                if (!deMap.has(de.id)) {
                    deMap.set(de.id, stageDeObj)
                }
            }
        }
    }

    // 1. Setup Primary Client Profile Category from Program Attributes
    const popTea = (metadata?.attributes || []).find((a) =>
        PATIENT_TYPE_ATTRIBUTE_HINTS.test(a.displayName || a.name || a.systemName)
    )

    const clientProfileMap = new Map()
    if (popTea?.optionSet?.options?.length) {
        for (const opt of popTea.optionSet.options) {
            const optCode = opt.code || opt.id
            const optName = cleanKhmerEnglishMixedLabel(opt.displayName || opt.name || opt.code)
            clientProfileMap.set(optCode, {
                code: optCode,
                name: optName,
                firstVisit: { count: 0, teis: [] },
                followUp: { count: 0, teis: [] },
                demographics: createDemographicGrid(),
                total: 0,
                teis: [],
            })
        }
    }

    const otherProfileEntry = {
        code: 'OTHER',
        name: 'អតិថិជនទូទៅ (General Clients)',
        firstVisit: { count: 0, teis: [] },
        followUp: { count: 0, teis: [] },
        demographics: createDemographicGrid(),
        total: 0,
        teis: [],
    }

    // 2. Pre-seed All Program Stage Sections & Data Elements
    const programSectionsMap = new Map()
    for (let stIdx = 0; stIdx < stages.length; stIdx++) {
        const s = stages[stIdx]
        const stageName = cleanKhmerEnglishMixedLabel(s.displayName || s.name || `Stage ${stIdx + 1}`)
        const sSections = s.sections || s.programStageSections || []

        const effectiveSections = sSections.length > 0 ? sSections : [{
            id: 'default',
            displayName: stageName,
            sortOrder: 0,
            dataElements: s.dataElements || [],
        }]

        for (let secIdx = 0; secIdx < effectiveSections.length; secIdx++) {
            const sec = effectiveSections[secIdx]
            const secKey = `${s.id}:${sec.id || secIdx}`
            const secName = cleanKhmerEnglishMixedLabel(sec.displayName || sec.name || sec.formName || `ផ្នែកទី ${secIdx + 1}`)
            const secOrder = Number(sec.sortOrder ?? secIdx)

            if (!programSectionsMap.has(secKey)) {
                programSectionsMap.set(secKey, {
                    key: secKey,
                    stageId: s.id,
                    stageName,
                    sectionId: sec.id || `sec_${secIdx}`,
                    sectionName: secName,
                    sortOrder: secOrder,
                    indicatorsMap: new Map(),
                })
            }
            const secEntry = programSectionsMap.get(secKey)

            const secDeList = (sec.dataElements?.length ? sec.dataElements : (sec.dataElementIds || []).map((id) => deMap.get(`${s.id}:${id}`) || deMap.get(id))).filter(Boolean)

            for (let deIdx = 0; deIdx < secDeList.length; deIdx++) {
                const de = secDeList[deIdx]
                if (!de?.id) continue
                const deName = cleanKhmerEnglishMixedLabel(de.displayName || de.name || de.id)
                const deSort = Number(de.sortOrder ?? deIdx)

                const optionsList = (de.optionSet?.options || []).map((opt) => ({
                    code: opt.code || opt.id,
                    name: cleanKhmerEnglishMixedLabel(opt.displayName || opt.name || opt.code),
                    demographics: createDemographicGrid(),
                    total: 0,
                    teis: [],
                }))

                if (!secEntry.indicatorsMap.has(de.id)) {
                    secEntry.indicatorsMap.set(de.id, {
                        deId: de.id,
                        stageId: s.id,
                        name: deName,
                        valueType: de.valueType,
                        sortOrder: deSort,
                        hasOptions: optionsList.length > 0,
                        options: optionsList,
                        demographics: createDemographicGrid(),
                        total: 0,
                        teis: [],
                    })
                }
            }
        }
    }

    let totalUniqueClients = 0
    let newEnrollmentsCount = 0
    let totalVisitsCount = 0
    let completedVisitsCount = 0
    let activeVisitsCount = 0

    const totalUniqueClientsTeis = []
    const newEnrollmentsTeis = []
    const totalVisitsTeis = []
    const completedVisitsTeis = []
    const activeVisitsTeis = []

    const sexCounts = {
        Male: { count: 0, teis: [] },
        Female: { count: 0, teis: [] },
        Other: { count: 0, teis: [] },
        Unknown: { count: 0, teis: [] },
    }
    const ageGroups = {
        under15: { count: 0, teis: [] },
        age15to24: { count: 0, teis: [] },
        age25to49: { count: 0, teis: [] },
        age50plus: { count: 0, teis: [] },
        unknown: { count: 0, teis: [] },
    }
    const populationGroups = {}
    const visitsByStage = {}

    // Section B: Syndromic / Clinical symptoms map
    const clinicalSyndromes = new Map()

    // Section C: Lab examinations map
    const labTests = new Map()

    // Section D: Medications & Treatments map
    const medications = new Map()

    // Section E: Universal Data Element Disaggregation Matrix (Male/Female x Age groups)
    const deMatrix = new Map()

    const seenTeiIds = new Set()

    const recordEventDataValues = (stageId, stageName, dataValues, demo, eventFormattedTei) => {
        for (const dv of dataValues || []) {
            const deId = dv.dataElement
            const rawVal = dv.value
            if (rawVal == null || String(rawVal).trim() === '') continue

            const valStr = String(rawVal).trim()
            const deMeta = deMap.get(`${stageId}:${deId}`) || deMap.get(deId) || { id: deId, name: deId, valueType: 'TEXT' }
            const rawDeName = deMeta.displayName || deMeta.name || resolveStageFieldDisplayLabel(deMeta, stageFieldLayoutParts(deMeta)) || deId
            const deName = cleanKhmerEnglishMixedLabel(rawDeName)

            // 1. Record into Program-Driven Sections Report
            for (const secEntry of programSectionsMap.values()) {
                if ((!secEntry.stageId || !stageId || secEntry.stageId === stageId) && secEntry.indicatorsMap.has(deId)) {
                    const ind = secEntry.indicatorsMap.get(deId)
                    const isBooleanYes = valStr === 'true' || valStr === '1' || valStr === 'Yes' || /បាទ|ចាស|មាន|positive|reactive|វិជ្ជមាន|មានប្រតិកម្ម/i.test(valStr)

                    if (ind.valueType === 'BOOLEAN' || ind.valueType === 'TRUE_ONLY') {
                        if (isBooleanYes) {
                            ind.total += 1
                            ind.teis.push(eventFormattedTei)
                            recordDemographicHit(ind.demographics, demo, eventFormattedTei)
                        }
                    } else {
                        ind.total += 1
                        ind.teis.push(eventFormattedTei)
                        recordDemographicHit(ind.demographics, demo, eventFormattedTei)

                        if (ind.hasOptions) {
                            for (const opt of ind.options) {
                                if (
                                    opt.code === valStr ||
                                    opt.name === valStr ||
                                    opt.code.toLowerCase() === valStr.toLowerCase() ||
                                    opt.name.toLowerCase() === valStr.toLowerCase()
                                ) {
                                    opt.total += 1
                                    opt.teis.push(eventFormattedTei)
                                    recordDemographicHit(opt.demographics, demo, eventFormattedTei)
                                    break
                                }
                            }
                        }
                    }
                }
            }

            // 2. Matrix Record uniquely keyed by stageId:deId
            const matrixKey = `${stageId}:${deId}`
            const secInfo = deSectionMap.get(matrixKey) || {
                sectionId: 'default',
                sectionName: 'ព័ត៌មានទូទៅ',
                sectionSortOrder: 999,
            }
            if (!deMatrix.has(matrixKey)) {
                deMatrix.set(matrixKey, {
                    id: matrixKey,
                    deId: deId,
                    stageId: stageId,
                    stageName: deMeta.stageName || stageName,
                    sectionId: secInfo.sectionId,
                    sectionName: secInfo.sectionName,
                    sectionSortOrder: secInfo.sectionSortOrder,
                    name: deName,
                    valueType: deMeta.valueType,
                    total: 0,
                    frequencies: {},
                    valueTeis: {},
                    demographics: createDemographicGrid(),
                    optionDemographics: {},
                    teis: [],
                })
            }
            const mEntry = deMatrix.get(matrixKey)
            mEntry.total += 1

            // Resolve friendly option / boolean display name
            let displayVal = valStr
            if (deMeta.valueType === 'BOOLEAN' || valStr === 'true' || valStr === 'false') {
                if (valStr === 'true' || valStr === '1') {
                    displayVal = 'បាទ/ចាស'
                } else if (valStr === 'false' || valStr === '0') {
                    displayVal = 'ទេ'
                }
            } else if (deMeta.valueType === 'TRUE_ONLY' && (valStr === 'true' || valStr === '1')) {
                displayVal = 'មាន'
            } else if (deMeta.optionSet?.options?.length) {
                const opt = deMeta.optionSet.options.find(
                    (o) => o.code === valStr || o.id === valStr || o.name === valStr || o.displayName === valStr
                )
                if (opt) {
                    displayVal = opt.displayName || opt.name || opt.code || valStr
                }
            }
            displayVal = cleanKhmerEnglishMixedLabel(displayVal)

            mEntry.frequencies[displayVal] = (mEntry.frequencies[displayVal] || 0) + 1
            if (!mEntry.valueTeis[displayVal]) mEntry.valueTeis[displayVal] = []
            mEntry.valueTeis[displayVal].push(eventFormattedTei)
            mEntry.teis.push(eventFormattedTei)

            // Universal DE Disaggregation (Male & Female x Age groups)
            recordDemographicHit(mEntry.demographics, demo, eventFormattedTei)

            if (!mEntry.optionDemographics[displayVal]) {
                mEntry.optionDemographics[displayVal] = createDemographicGrid()
            }
            recordDemographicHit(mEntry.optionDemographics[displayVal], demo, eventFormattedTei)

            // Clinical Syndromes / Symptoms
            const isBooleanYes = valStr === 'true' || valStr === '1' || valStr === 'Yes' || /បាទ|ចាស|មាន/.test(valStr)
            const isSymptomDe = /រោគសញ្ញា|សញ្ញា|symptom|syndrome|ulcer|discharge|pain|lesion|warts/i.test(deName)
            if (isSymptomDe && isBooleanYes) {
                const syndKey = `${stageId}:${deId}`
                if (!clinicalSyndromes.has(syndKey)) {
                    clinicalSyndromes.set(syndKey, {
                        id: syndKey,
                        stageName: deMeta.stageName || stageName,
                        name: deName,
                        count: 0,
                        teis: [],
                    })
                }
                const sEntry = clinicalSyndromes.get(syndKey)
                sEntry.count += 1
                sEntry.teis.push(eventFormattedTei)
            }

            // Laboratory Tests
            const isLabTest = LAB_TEST_HINTS.test(deName) || LAB_TEST_HINTS.test(stageName)
            if (isLabTest) {
                const labKey = `${stageId}:${deId}`
                if (!labTests.has(labKey)) {
                    labTests.set(labKey, {
                        id: labKey,
                        stageName: deMeta.stageName || stageName,
                        name: deName,
                        total: 0,
                        reactive: 0,
                        nonReactive: 0,
                        other: 0,
                        teis: [],
                        reactiveTeis: [],
                        nonReactiveTeis: [],
                    })
                }
                const lab = labTests.get(labKey)
                lab.total += 1
                lab.teis.push(eventFormattedTei)
                if (REACTIVE_HINTS.test(valStr)) {
                    lab.reactive += 1
                    lab.reactiveTeis.push(eventFormattedTei)
                } else if (NON_REACTIVE_HINTS.test(valStr)) {
                    lab.nonReactive += 1
                    lab.nonReactiveTeis.push(eventFormattedTei)
                } else {
                    lab.other += 1
                }
            }
        }
    }

    const recordClientProfileHit = (teiId, formattedTei, demo, teiEnrolledInPeriod) => {
        if (!teiId || seenTeiIds.has(teiId)) return
        seenTeiIds.add(teiId)
        totalUniqueClients += 1
        totalUniqueClientsTeis.push(formattedTei)

        // Sex Breakdown
        if (demo.sex === 'MALE') {
            sexCounts.Male.count += 1
            sexCounts.Male.teis.push(formattedTei)
        } else if (demo.sex === 'FEMALE') {
            sexCounts.Female.count += 1
            sexCounts.Female.teis.push(formattedTei)
        } else if (demo.sex === 'OTHER') {
            sexCounts.Other.count += 1
            sexCounts.Other.teis.push(formattedTei)
        } else {
            sexCounts.Unknown.count += 1
            sexCounts.Unknown.teis.push(formattedTei)
        }

        // Age Breakdown
        if (demo.age == null || isNaN(demo.age)) {
            ageGroups.unknown.count += 1
            ageGroups.unknown.teis.push(formattedTei)
        } else if (demo.age < 15) {
            ageGroups.under15.count += 1
            ageGroups.under15.teis.push(formattedTei)
        } else if (demo.age <= 24) {
            ageGroups.age15to24.count += 1
            ageGroups.age15to24.teis.push(formattedTei)
        } else if (demo.age <= 49) {
            ageGroups.age25to49.count += 1
            ageGroups.age25to49.teis.push(formattedTei)
        } else {
            ageGroups.age50plus.count += 1
            ageGroups.age50plus.teis.push(formattedTei)
        }

        // Record Client Profile / Population Breakdown
        const popVal = String(demo.rawPop || '').trim()
        let profileTarget = null
        if (popVal) {
            profileTarget = clientProfileMap.get(popVal)
            if (!profileTarget) {
                for (const [code, entry] of clientProfileMap.entries()) {
                    if (
                        code.toLowerCase() === popVal.toLowerCase() ||
                        entry.name.toLowerCase() === popVal.toLowerCase()
                    ) {
                        profileTarget = entry
                        break
                    }
                }
            }
        }
        if (!profileTarget) {
            profileTarget = otherProfileEntry
        }

        profileTarget.total += 1
        profileTarget.teis.push(formattedTei)
        recordDemographicHit(profileTarget.demographics, demo, formattedTei)
        if (teiEnrolledInPeriod) {
            profileTarget.firstVisit.count += 1
            profileTarget.firstVisit.teis.push(formattedTei)
        } else {
            profileTarget.followUp.count += 1
            profileTarget.followUp.teis.push(formattedTei)
        }

        if (demo.rawPop) {
            const popStr = cleanKhmerEnglishMixedLabel(String(demo.rawPop).trim())
            if (!populationGroups[popStr]) {
                populationGroups[popStr] = { count: 0, teis: [] }
            }
            populationGroups[popStr].count += 1
            populationGroups[popStr].teis.push(formattedTei)
        }
    }

    for (const item of teis) {
        if (!item) continue
        const isEventRecord = Boolean(item.event || (item.programStage && !item.enrollments))

        if (isEventRecord) {
            // Flat event item (e.g. from searchEvents / Event view)
            const teiSource = item.tei || item
            const teiId = item.trackedEntity || teiSource.trackedEntity || teiSource.trackedEntityInstance || item.event
            const demo = extractTeiDemographics(teiSource, teaMap)
            const eventFormattedTei = formatTeiReportItem(teiSource, teaMap, item)

            const evDate = normalizeDate(item.occurredAt || item.eventDate || item.createdAt)
            if (startDate && endDate && evDate && (evDate < startDate || evDate > endDate)) {
                continue // Out of period range
            }

            let teiEnrolledInPeriod = false
            const enrDate = normalizeDate(item.enrolledAt || teiSource.enrolledAt || teiSource.enrollments?.[0]?.enrolledAt)
            if (startDate && endDate && enrDate && enrDate >= startDate && enrDate <= endDate) {
                teiEnrolledInPeriod = true
                if (!seenTeiIds.has(teiId)) {
                    newEnrollmentsCount += 1
                    newEnrollmentsTeis.push(eventFormattedTei)
                }
            }

            if (!item.isEnrollmentOnly) {
                totalVisitsCount += 1
                totalVisitsTeis.push(eventFormattedTei)

                const status = String(item.status || '').toUpperCase()
                if (status === 'COMPLETED') {
                    completedVisitsCount += 1
                    completedVisitsTeis.push(eventFormattedTei)
                } else {
                    activeVisitsCount += 1
                    activeVisitsTeis.push(eventFormattedTei)
                }

                const stageId = item.programStage
                if (stageId) {
                    const stageMeta = stageMap.get(stageId)
                    const stageName = stageMeta?.displayName || stageMeta?.name || stageId || 'General Visit'

                    if (!visitsByStage[stageId]) {
                        visitsByStage[stageId] = {
                            id: stageId,
                            name: stageName,
                            totalVisits: 0,
                            completedVisits: 0,
                            uniqueClients: new Set(),
                            teis: [],
                        }
                    }
                    visitsByStage[stageId].totalVisits += 1
                    if (status === 'COMPLETED') visitsByStage[stageId].completedVisits += 1
                    visitsByStage[stageId].teis.push(eventFormattedTei)
                    if (teiId) {
                        visitsByStage[stageId].uniqueClients.add(teiId)
                    }

                    recordEventDataValues(stageId, stageName, item.dataValues || [], demo, eventFormattedTei)
                }
            }

            recordClientProfileHit(teiId, eventFormattedTei, demo, teiEnrolledInPeriod)
        } else {
            // Standard TEI item with enrollments
            const tei = item
            const teiId = tei.trackedEntity || tei.trackedEntityInstance
            const enrollments = tei.enrollments || []
            const baseFormattedTei = formatTeiReportItem(tei, teaMap)
            const demo = extractTeiDemographics(tei, teaMap)

            let teiHasActivityInPeriod = false
            let teiEnrolledInPeriod = false
            let teiHadVisitInPeriod = false

            // Check enrollment date
            for (const enr of enrollments) {
                const enrDate = normalizeDate(enr.enrolledAt || enr.enrollmentDate || enr.createdAt)
                if (startDate && endDate && enrDate >= startDate && enrDate <= endDate) {
                    newEnrollmentsCount += 1
                    newEnrollmentsTeis.push(baseFormattedTei)
                    teiHasActivityInPeriod = true
                    teiEnrolledInPeriod = true
                }

                // Check events
                for (const ev of enr.events || []) {
                    const evDate = normalizeDate(ev.occurredAt || ev.eventDate || ev.createdAt)
                    if (startDate && endDate && (evDate < startDate || evDate > endDate)) {
                        continue // Out of period range
                    }

                    const eventFormattedTei = formatTeiReportItem(tei, teaMap, ev)

                    teiHasActivityInPeriod = true
                    teiHadVisitInPeriod = true
                    totalVisitsCount += 1
                    totalVisitsTeis.push(eventFormattedTei)

                    const status = String(ev.status || '').toUpperCase()
                    if (status === 'COMPLETED') {
                        completedVisitsCount += 1
                        completedVisitsTeis.push(eventFormattedTei)
                    } else {
                        activeVisitsCount += 1
                        activeVisitsTeis.push(eventFormattedTei)
                    }

                    // Visits by stage
                    const stageId = ev.programStage
                    const stageMeta = stageMap.get(stageId)
                    const stageName = stageMeta?.displayName || stageMeta?.name || stageId || 'General Visit'

                    if (!visitsByStage[stageId]) {
                        visitsByStage[stageId] = {
                            id: stageId,
                            name: stageName,
                            totalVisits: 0,
                            completedVisits: 0,
                            uniqueClients: new Set(),
                            teis: [],
                        }
                    }
                    visitsByStage[stageId].totalVisits += 1
                    if (status === 'COMPLETED') visitsByStage[stageId].completedVisits += 1
                    visitsByStage[stageId].teis.push(eventFormattedTei)
                    if (teiId && !visitsByStage[stageId].uniqueClients.has(teiId)) {
                        visitsByStage[stageId].uniqueClients.add(teiId)
                    }

                    recordEventDataValues(stageId, stageName, ev.dataValues || [], demo, eventFormattedTei)
                }
            }

            // Count unique clients
            if (teiHasActivityInPeriod || teiEnrolledInPeriod || teiHadVisitInPeriod) {
                recordClientProfileHit(teiId, baseFormattedTei, demo, teiEnrolledInPeriod)
            }
        }
    }

    const completionRate = totalVisitsCount > 0 ? Math.round((completedVisitsCount / totalVisitsCount) * 100) : 0

    // Format visits by stage list
    const visitsByStageList = Object.values(visitsByStage).map((s) => ({
        ...s,
        uniqueClientsCount: s.uniqueClients.size,
        completionRate: s.totalVisits > 0 ? Math.round((s.completedVisits / s.totalVisits) * 100) : 0,
    }))

    // Format clinical syndromes list
    const clinicalSyndromesList = Array.from(clinicalSyndromes.values())
        .map((item) => ({
            ...item,
            percentage: totalVisitsCount > 0 ? ((item.count / totalVisitsCount) * 100).toFixed(1) : '0.0',
        }))
        .sort((a, b) => b.count - a.count)

    // Format lab tests list
    const labTestsList = Array.from(labTests.values())
        .map((item) => ({
            ...item,
            reactiveRate: item.total > 0 ? ((item.reactive / item.total) * 100).toFixed(1) : '0.0',
        }))
        .sort((a, b) => b.total - a.total)

    // Format medications list
    const medicationsList = Array.from(medications.values()).sort((a, b) => b.count - a.count)

    // Format data element matrix
    const deMatrixList = Array.from(deMatrix.values()).sort((a, b) => b.total - a.total)

    // Group indicators by Stage and Form Section
    const formSectionsMap = new Map()
    for (const de of deMatrixList) {
        const key = `${de.stageId}:${de.sectionId}`
        if (!formSectionsMap.has(key)) {
            formSectionsMap.set(key, {
                key,
                stageId: de.stageId,
                stageName: de.stageName,
                sectionId: de.sectionId,
                sectionName: de.sectionName,
                sortOrder: de.sectionSortOrder,
                totalAnswers: 0,
                indicators: [],
            })
        }
        const sEntry = formSectionsMap.get(key)
        sEntry.totalAnswers += de.total
        sEntry.indicators.push(de)
    }

    const formSectionsList = Array.from(formSectionsMap.values())
        .map((sec) => ({
            ...sec,
            indicators: combineMatrixIndicators(sec.indicators.sort((a, b) => b.total - a.total)),
        }))
        .sort((a, b) => {
            if (a.stageId !== b.stageId) return String(a.stageName).localeCompare(String(b.stageName))
            return a.sortOrder - b.sortOrder
        })

    // Program-Aware Metadata-Driven Sections List (All Program Stages & Sections with Real DEs)
    const programSectionsList = Array.from(programSectionsMap.values())
        .map((sec) => ({
            ...sec,
            indicators: combineSectionIndicators(Array.from(sec.indicatorsMap.values()).sort((a, b) => a.sortOrder - b.sortOrder)),
        }))
        .filter((sec) => sec.indicators.length > 0)
        .sort((a, b) => {
            if (a.stageId !== b.stageId) return String(a.stageName).localeCompare(String(b.stageName))
            return a.sortOrder - b.sortOrder
        })

    const clientProfileList = Array.from(clientProfileMap.values())
    if (otherProfileEntry.total > 0 || clientProfileList.length === 0) {
        clientProfileList.push(otherProfileEntry)
    }

    return {
        totalUniqueClients,
        newEnrollmentsCount,
        totalVisitsCount,
        completedVisitsCount,
        activeVisitsCount,
        completionRate,
        totalUniqueClientsTeis,
        newEnrollmentsTeis,
        totalVisitsTeis,
        completedVisitsTeis,
        activeVisitsTeis,
        sexCounts,
        sexDistribution: {
            male: sexCounts?.Male?.count || 0,
            female: sexCounts?.Female?.count || 0,
            other: sexCounts?.Other?.count || 0,
            unknown: sexCounts?.Unknown?.count || 0,
            malePct: totalUniqueClients > 0 ? (((sexCounts?.Male?.count || 0) / totalUniqueClients) * 100).toFixed(1) : '0.0',
            femalePct: totalUniqueClients > 0 ? (((sexCounts?.Female?.count || 0) / totalUniqueClients) * 100).toFixed(1) : '0.0',
        },
        maleTeis: sexCounts?.Male?.teis || [],
        femaleTeis: sexCounts?.Female?.teis || [],
        ageGroups,
        populationGroups: Object.entries(populationGroups).map(([name, data]) => ({
            name,
            count: data.count,
            teis: data.teis,
            percentage: totalUniqueClients > 0 ? ((data.count / totalUniqueClients) * 100).toFixed(1) : '0.0',
        })).sort((a, b) => b.count - a.count),
        visitsByStage: visitsByStageList,
        clinicalSyndromes: clinicalSyndromesList,
        labTests: labTestsList,
        medications: medicationsList,
        deMatrix: deMatrixList,
        formSections: formSectionsList,

        // Program-Driven Official Routine Report Structure (100% Real Program Metadata)
        programReport: {
            programId: metadata?.id,
            programName: cleanKhmerEnglishMixedLabel(metadata?.displayName || metadata?.name || 'Program'),
            clientProfile: clientProfileList,
            sections: programSectionsList,
        },
    }
}
