import React, { useMemo, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useDataEngine } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { Cross2Icon } from '@radix-ui/react-icons'
import {
    Printer,
    Copy,
    Check,
    Languages,
    SlidersHorizontal,
    FileText,
    QrCode,
    Calendar,
    User,
    Eye,
    Filter,
    Columns2,
    Rows2,
} from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Select } from '../../../components/ui/select'
import { generateQrSvg } from '../../../lib/qrCodeGenerator'
import { cn } from '../../../lib/utils'
import { getPreferredLocale } from '../../../lib/localePreference'
import { fetchOrganisationUnit } from '../../../services/trackerApi'
import {
    STI_SECTIONS_HIDDEN_WHEN_MALE,
    STI_SECTIONS_HIDDEN_WHEN_FEMALE,
} from '../../../lib/stiSexFormGating'
import nchadsLogo from '../../../assets/nchads-logo.png'

const KHMER_LETTERS = [
    'ក', 'ខ', 'គ', 'ឃ', 'ង', 'ច', 'ឆ', 'ជ', 'ឈ', 'ញ',
    'ដ', 'ឋ', 'ឌ', 'ឍ', 'ណ', 'ត', 'ថ', 'ទ', 'ធ', 'ន',
    'ប', 'ផ', 'ព', 'ភ', 'ម', 'យ', 'រ', 'ល', 'វ', 'ស',
    'ហ', 'ឡ', 'អ',
]

const ENGLISH_LETTERS = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
    'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
    'U', 'V', 'W', 'X', 'Y', 'Z',
]

const toKhmerNumber = (num) => {
    if (num == null || num === '') return ''
    const digits = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩']
    return String(num).replace(/[0-9]/g, (d) => digits[Number(d)] ?? d)
}

export function PatientSummaryPrintModal({
    open,
    onClose,
    tei = {},
    program = {},
    programMetadata = {},
    attributesMap = {},
    events = [],
    orgUnitName = '',
    orgUnitId = '',
}) {
    const engine = useDataEngine()
    const [liveOuName, setLiveOuName] = useState('')

    // Language state override in modal (allows toggling KM / EN on the fly for printing)
    const defaultLocale = getPreferredLocale() || i18n.language || 'km'
    const [printLang, setPrintLang] = useState(
        defaultLocale === 'km' || String(defaultLocale).startsWith('km') ? 'km' : 'en'
    )
    const isKm = printLang === 'km'

    // Print Layout options
    const [densityMode, setDensityMode] = useState('compact') // 'compact' | 'standard'
    const [selectedEventId, setSelectedEventId] = useState('ALL') // 'ALL' or specific event ID
    const [copiedSummary, setCopiedSummary] = useState(false)

    // Sync default locale when modal opens
    useEffect(() => {
        if (open) {
            const loc = getPreferredLocale() || i18n.language || 'km'
            setPrintLang(loc === 'km' || String(loc).startsWith('km') ? 'km' : 'en')
        }
    }, [open])

    // Find the target organisation unit ID
    const targetOuId =
        orgUnitId ||
        tei?.orgUnit ||
        tei?.enrollments?.[0]?.orgUnit ||
        events?.[0]?.orgUnit

    useEffect(() => {
        if (!open || !targetOuId || !engine) return
        let active = true

        fetchOrganisationUnit({ engine, id: targetOuId })
            .then((ou) => {
                if (active && ou) {
                    setLiveOuName(ou.displayName || ou.name || '')
                }
            })
            .catch((err) => {
                console.warn('Could not fetch orgUnit name for print', err)
            })

        return () => {
            active = false
        }
    }, [open, engine, targetOuId])

    // Keyboard Escape to close modal
    useEffect(() => {
        if (!open) return
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault()
                onClose?.()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [open, onClose])

    // Resolve Facility / Organisation Unit name
    const effectiveOrgUnitName = useMemo(() => {
        if (orgUnitName && String(orgUnitName).trim() !== '') return String(orgUnitName).trim()
        if (liveOuName && String(liveOuName).trim() !== '') return String(liveOuName).trim()
        if (tei?.enrollments?.[0]?.orgUnitName) return tei.enrollments[0].orgUnitName
        if (events?.[0]?.orgUnitName) return events[0].orgUnitName
        if (targetOuId && programMetadata?.organisationUnits) {
            const ou = programMetadata.organisationUnits.find((o) => o.id === targetOuId)
            if (ou) return ou.displayName || ou.name || ''
        }
        return ''
    }, [orgUnitName, liveOuName, tei, events, targetOuId, programMetadata])

    // Index all data elements, option sets, and stage sections from metadata
    const { deDictionary, stagesDictionary, stagesMapById } = useMemo(() => {
        const deDict = {}
        const stagesDict = {}
        const stageObjMap = {}

        // 1. Index programMetadata.dataElements
        if (Array.isArray(programMetadata?.dataElements)) {
            for (const de of programMetadata.dataElements) {
                if (de?.id) {
                    deDict[de.id] = {
                        id: de.id,
                        name: isKm ? de.displayName || de.name : de.name || de.displayName,
                        displayName: de.displayName || de.name,
                        valueType: de.valueType,
                        optionSet: de.optionSet,
                    }
                }
            }
        } else if (programMetadata?.dataElements && typeof programMetadata.dataElements === 'object') {
            for (const [key, val] of Object.entries(programMetadata.dataElements)) {
                deDict[key] = typeof val === 'object' ? val : { id: key, name: val, displayName: val }
            }
        }

        // 2. Index attributesMap
        if (attributesMap && typeof attributesMap === 'object') {
            if (Array.isArray(attributesMap)) {
                for (const a of attributesMap) {
                    if (a?.id) deDict[a.id] = a
                }
            } else {
                for (const [k, v] of Object.entries(attributesMap)) {
                    if (!deDict[k]) {
                        deDict[k] = typeof v === 'object' ? v : { id: k, name: v, displayName: v }
                    }
                }
            }
        }

        // 3. Index stages & stage data elements & stage sections
        const allStages = programMetadata?.stages || programMetadata?.programStages || []

        for (const stage of allStages) {
            if (stage.id) {
                stagesDict[stage.id] = stage.displayName || stage.name
                stageObjMap[stage.id] = stage
            }

            // Register stage data elements
            const sdeList = stage.dataElements || stage.programStageDataElements || stage.stageDataElements || []
            for (const sde of sdeList) {
                const de = sde.dataElement || sde
                if (de?.id) {
                    deDict[de.id] = {
                        id: de.id,
                        name: isKm
                            ? de.displayName || sde.displayName || de.name || sde.name
                            : de.name || sde.name || de.displayName || sde.displayName,
                        displayName: de.displayName || sde.displayName || de.name || sde.name,
                        valueType: de.valueType || sde.valueType,
                        optionSet: de.optionSet || sde.optionSet,
                    }
                }
            }

            // Register section data elements
            const secList = stage.sections || stage.programStageSections || []
            for (const sec of secList) {
                if (Array.isArray(sec.dataElements)) {
                    for (const de of sec.dataElements) {
                        if (de?.id && !deDict[de.id]) {
                            deDict[de.id] = {
                                id: de.id,
                                name: isKm ? de.displayName || de.name : de.name || de.displayName,
                                displayName: de.displayName || de.name,
                                valueType: de.valueType,
                                optionSet: de.optionSet,
                            }
                        }
                    }
                }
            }
        }

        return {
            deDictionary: deDict,
            stagesDictionary: stagesDict,
            stagesMapById: stageObjMap,
        }
    }, [programMetadata, attributesMap, isKm])

    // Resolve patient attributes
    const attributes = tei.attributes || []
    const metaAttrs = programMetadata?.attributes || []

    const getAttr = (...searchKeys) => {
        for (const key of searchKeys) {
            const query = key.toLowerCase()
            const found = attributes.find((a) => {
                if (a.attribute === key) return true
                if (a.displayName?.toLowerCase().includes(query)) return true
                const meta = metaAttrs.find((m) => m.id === a.attribute)
                if (
                    meta?.displayName?.toLowerCase().includes(query) ||
                    meta?.name?.toLowerCase().includes(query) ||
                    meta?.systemName?.toLowerCase().includes(query) ||
                    meta?.shortName?.toLowerCase().includes(query)
                ) {
                    return true
                }
                if (
                    typeof attributesMap?.[a.attribute] === 'string' &&
                    attributesMap[a.attribute].toLowerCase().includes(query)
                ) {
                    return true
                }
                return false
            })
            if (found?.value != null && String(found.value).trim() !== '') {
                return String(found.value).trim()
            }
        }
        return ''
    }

    const pmrsCode = getAttr('pmrs', 'pmrs code', 'pmrs_code', 'លេខកូដ pmrs', 'កូដ pmrs')
    const prepCode = getAttr('prep code', 'prep_code', 'prepcode', 'លេខកូដប្រីព', 'កូដប្រីព', 'លេខកូដប្រេប', 'កូដប្រេប', 'លេខកូដ prep', 'prep')
    const smhCode = getAttr('smh', 'smh id', 'smh_id', 'smh code', 'លេខកូដ smh')
    const uuicCode = getAttr('uuic', 'uuic code', 'uuic_code', 'កូដ uuic', 'national id')
    const clientCode =
        pmrsCode ||
        prepCode ||
        smhCode ||
        uuicCode ||
        getAttr('code', 'identifier', 'client code', 'អត្តសញ្ញាណ') ||
        tei.trackedEntityInstance ||
        tei.trackedEntity ||
        ''

    const isPrep = useMemo(() => {
        const pName = String(program?.displayName || program?.name || '').toLowerCase()
        return pName.includes('prep') || pName.includes('ប្រេប') || pName.includes('ប្រីព')
    }, [program])

    const secondaryIdLabel = useMemo(() => {
        if (isPrep) {
            if (prepCode && uuicCode) return isKm ? 'លេខកូដ PrEP / UUIC:' : 'PrEP / UUIC:'
            if (prepCode) return isKm ? 'លេខកូដ PrEP:' : 'PrEP Code:'
            if (uuicCode) return isKm ? 'លេខកូដ UUIC:' : 'UUIC:'
            return isKm ? 'លេខកូដ PrEP / UUIC:' : 'PrEP / UUIC:'
        }
        if (smhCode && uuicCode) return isKm ? 'លេខកូដ SMH / UUIC:' : 'SMH / UUIC:'
        if (smhCode) return isKm ? 'លេខកូដ SMH:' : 'SMH ID:'
        if (uuicCode) return isKm ? 'លេខកូដ UUIC:' : 'UUIC:'
        return isKm ? 'លេខកូដ UUIC:' : 'UUIC:'
    }, [isPrep, prepCode, smhCode, uuicCode, isKm])

    const secondaryIdValue = useMemo(() => {
        if (isPrep) {
            return [prepCode, uuicCode].filter(Boolean).join(' / ') || clientCode || (isKm ? 'មិនមាន' : 'N/A')
        }
        return [smhCode, uuicCode].filter(Boolean).join(' / ') || clientCode || (isKm ? 'មិនមាន' : 'N/A')
    }, [isPrep, prepCode, smhCode, uuicCode, clientCode, isKm])

    const firstName = getAttr('first name', 'first_name', 'firstname', 'នាម')
    const lastName = getAttr('last name', 'last_name', 'lastname', 'គោត្តនាម')
    const singleName = getAttr('full name', 'fullname', 'name', 'ឈ្មោះ', 'គោត្តនាម និងនាម')

    const fullName =
        [firstName, lastName].filter(Boolean).join(' ').trim() ||
        singleName ||
        (clientCode ? `${clientCode}` : isKm ? 'មិនមានឈ្មោះ' : 'Anonymous')

    const rawSex = getAttr('sex', 'gender', 'ភេទ', 'biological sex')
    const sexUpper = String(rawSex).trim().toUpperCase()
    const isMale = sexUpper === 'MALE' || sexUpper === 'M' || rawSex === 'ប្រុស'
    const isFemale = sexUpper === 'FEMALE' || sexUpper === 'F' || rawSex === 'ស្រី'

    const sexDisplay = isFemale
        ? isKm
            ? 'ស្រី'
            : 'Female'
        : isMale
          ? isKm
              ? 'ប្រុស'
              : 'Male'
          : sexUpper.includes('TRANS') || sexUpper === 'TG' || rawSex.includes('កែភេទ')
            ? isKm
                ? 'បំប្លែងយេនឌ័រ'
                : 'Transgender'
            : rawSex || (isKm ? 'មិនបានកត់ត្រា' : 'Unspecified')

    const dobVal = getAttr(
        'date of birth',
        'dob',
        'birth date',
        'birthdate',
        'ថ្ងៃខែឆ្នាំកំណើត',
        'ថ្ងៃកំណើត'
    )
    const ageVal = getAttr('age', 'អាយុ', 'age in years', 'completed age')

    const phone =
        getAttr('phone number', 'phone', 'contact', 'telephone', 'mobile', 'ទូរស័ព្ទ') ||
        (isKm ? 'មិនមាន' : 'N/A')
    const address =
        getAttr('address', 'village', 'commune', 'district', 'province', 'អាសយដ្ឋាន', 'ទីលំនៅ') ||
        (isKm ? 'មិនមាន' : 'N/A')

    const enrollmentDate =
        tei.enrollments?.[0]?.enrolledAt ||
        tei.enrollments?.[0]?.enrollmentDate ||
        tei.createdAt ||
        ''

    // Helper to check if section should be hidden for patient's sex (បុរស vs ស្ត្រី)
    const isSectionHiddenForSex = (sec) => {
        const secId = sec.id
        const name = String(sec.displayName || sec.name || '').toLowerCase()

        if (isMale) {
            if (STI_SECTIONS_HIDDEN_WHEN_MALE.has(secId)) return true
            if (
                name.includes('ស្ត្រី') ||
                name.includes('ស្រី') ||
                name.includes('female') ||
                name.includes('cervix') ||
                name.includes('pregnancy') ||
                name.includes('មាត់ស្បូន')
            ) {
                return true
            }
        }

        if (isFemale) {
            if (STI_SECTIONS_HIDDEN_WHEN_FEMALE.has(secId)) return true
            if (
                name.includes('បុរស') ||
                name.includes('ប្រុស') ||
                name.includes('male') ||
                name.includes('urethral') ||
                name.includes('circumcision') ||
                name.includes('បំពង់នោម')
            ) {
                return true
            }
        }

        return false
    }

    // Helper to format data element labels and values strictly in selected language
    const formatDataElementLabel = (deId) => {
        const de = deDictionary[deId]
        if (!de) return deId

        const raw = isKm ? de.displayName || de.name || deId : de.name || de.displayName || deId
        const str = String(raw).trim()

        // Clean out any mixed English in Khmer mode, and mixed Khmer in English mode
        if (isKm) {
            // If string has "/English", strip it
            if (str.includes('/') && /[A-Za-z]/.test(str)) {
                const parts = str.split('/')
                if (/[\u1780-\u17FF]/.test(parts[0]) && !/[\u1780-\u17FF]/.test(parts[1])) {
                    return parts[0].trim()
                }
            }
            return str.replace(/\/[A-Za-z\s&,\.\(\)\-]+/g, '').trim()
        } else {
            // English mode
            if (str.includes('/') && /[A-Za-z]/.test(str)) {
                const parts = str.split('/')
                if (/[A-Za-z]/.test(parts[1]) && !/[\u1780-\u17FF]/.test(parts[1])) {
                    return parts[1].trim()
                }
            }
            if (de.name && /[A-Za-z]/.test(de.name) && !/[\u1780-\u17FF]/.test(de.name)) {
                return de.name.trim()
            }
            return str
        }
    }

    const formatDataElementValue = (deId, value) => {
        if (value == null || value === '') return '-'
        const str = String(value).trim()

        // Exact boolean handling
        if (str === 'true' || str.toLowerCase() === 'yes') return isKm ? 'បាទ/ចាស' : 'Yes'
        if (str === 'false' || str.toLowerCase() === 'no') return isKm ? 'ទេ' : 'No'

        // Common clinical option translations
        const COMMON_TRANSLATIONS = {
            'មិនធ្លាប់': { km: 'មិនធ្លាប់', en: 'Never' },
            'ធ្លាប់': { km: 'ធ្លាប់', en: 'Ever' },
            'ថ្មី': { km: 'ថ្មី', en: 'New' },
            'ចាស់': { km: 'ចាស់', en: 'Old / Re-visit' },
            'មកខ្លួនឯង': { km: 'មកខ្លួនឯង', en: 'Self-referred' },
            'ចាំបាច់មកពិនិត្យតាមដានបន្ត': { km: 'ចាំបាច់មកពិនិត្យតាមដានបន្ត', en: 'Follow-up Required' },
            'មិនចាំបាច់': { km: 'មិនចាំបាច់', en: 'Not Required' },
            'វិជ្ជមាន': { km: 'វិជ្ជមាន', en: 'Positive (+)' },
            'អវិជ្ជមាន': { km: 'អវិជ្ជមាន', en: 'Negative (-)' },
            'មិនច្បាស់លាស់': { km: 'មិនច្បាស់លាស់', en: 'Indeterminate' },
        }

        if (COMMON_TRANSLATIONS[str]) {
            return isKm ? COMMON_TRANSLATIONS[str].km : COMMON_TRANSLATIONS[str].en
        }

        // Option set mapping
        const de = deDictionary[deId]
        if (de?.optionSet?.options?.length) {
            const matchedOpt = de.optionSet.options.find(
                (o) => o.code === str || o.id === str || String(o.name) === str || String(o.displayName) === str
            )
            if (matchedOpt) {
                if (isKm) {
                    return matchedOpt.displayName || matchedOpt.name || str
                } else {
                    return matchedOpt.name || matchedOpt.displayName || str
                }
            }
        }

        return str
    }

    // Helper to format clean single-language section headings
    const formatSectionHeading = (rawTitle, sectionIndex) => {
        if (!rawTitle) {
            return isKm ? `ផ្នែកទី ${toKhmerNumber(sectionIndex + 1)}` : `Section ${sectionIndex + 1}`
        }

        const str = String(rawTitle).trim()

        if (isKm) {
            // Extract pure Khmer part
            let cleaned = str
                .replace(/\/[A-Za-z0-9\s&,\.\(\)\-]+/g, '')
                .replace(/\s*-\s*[A-Za-z\s&,\.\(\)]+$/g, '')
                .replace(/\s+/g, ' ')
                .trim()
            return cleaned || str
        } else {
            // Extract pure English part
            const englishMatches = str.match(/[A-Za-z0-9\s&,\.\(\)\-]+/g)
            if (englishMatches && englishMatches.length > 0) {
                const joined = englishMatches
                    .map((m) => m.trim())
                    .filter((m) => m.length > 1 && /[A-Za-z]/.test(m))
                    .join(' - ')
                if (joined) {
                    const englishLetter = ENGLISH_LETTERS[sectionIndex % ENGLISH_LETTERS.length]
                    return `Part ${englishLetter} - ${joined}`
                }
            }
            return `Part ${ENGLISH_LETTERS[sectionIndex % ENGLISH_LETTERS.length]} - ${str}`
        }
    }

    const handlePrint = () => {
        window.print()
    }

    // Copy clinical summary to clipboard
    const handleCopySummary = () => {
        const summaryText = [
            `--- PATIENT CLINICAL SUMMARY (${isKm ? 'របាយការណ៍សង្ខេបអ្នកជំងឺ' : 'NCHADS'}) ---`,
            `Facility: ${effectiveOrgUnitName || 'N/A'}`,
            `Date: ${new Date().toLocaleDateString()}`,
            `Name: ${fullName}`,
            pmrsCode ? `PMRS: ${pmrsCode}` : null,
            prepCode ? `PrEP: ${prepCode}` : null,
            smhCode ? `SMH: ${smhCode}` : null,
            uuicCode ? `UUIC: ${uuicCode}` : null,
            `Sex: ${sexDisplay} | Age: ${ageVal || 'N/A'} | DOB: ${dobVal || 'N/A'}`,
            `Phone: ${phone}`,
            `Address: ${address}`,
            `Total Clinical Visits: ${events.length}`,
        ]
            .filter(Boolean)
            .join('\n')

        navigator.clipboard.writeText(summaryText)
        setCopiedSummary(true)
        setTimeout(() => setCopiedSummary(false), 2000)
    }

    const currentDateStr = isKm
        ? `ថ្ងៃទី ${toKhmerNumber(new Date().getDate())} ខែ ${toKhmerNumber(new Date().getMonth() + 1)} ឆ្នាំ ${toKhmerNumber(new Date().getFullYear())}`
        : new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
          })

    // Filter events if specific event selected
    const displayedEvents = useMemo(() => {
        if (selectedEventId === 'ALL') return events
        return events.filter((e) => (e.event || e.id) === selectedEventId)
    }, [events, selectedEventId])

    if (!open || typeof document === 'undefined') return null

    const modalContent = (
        <div id="patient-print-portal-root">
            {/* Global Print Stylesheet for full-length multi-page A4 document */}
            <style>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 8mm 10mm 8mm 10mm;
                    }
                    html, body {
                        background: #ffffff !important;
                        color: #000000 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        height: auto !important;
                        min-height: 100% !important;
                        overflow: visible !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        font-size: 11px !important;
                    }
                    /* Hide everything in the app except print document */
                    #root,
                    #d2-app-root,
                    body > *:not(#patient-print-portal-root),
                    header,
                    nav,
                    aside,
                    .no-print {
                        display: none !important;
                    }
                    #patient-print-portal-root {
                        display: block !important;
                        position: static !important;
                        width: 100% !important;
                        height: auto !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                    }
                    #patient-print-modal-overlay {
                        display: block !important;
                        position: static !important;
                        width: 100% !important;
                        height: auto !important;
                        min-height: auto !important;
                        background: #ffffff !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        inset: auto !important;
                        z-index: auto !important;
                        overflow: visible !important;
                    }
                    #patient-print-card {
                        display: block !important;
                        position: static !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        height: auto !important;
                        max-height: none !important;
                        overflow: visible !important;
                        border: none !important;
                        border-radius: 0 !important;
                        box-shadow: none !important;
                        background: #ffffff !important;
                    }
                    #patient-print-document {
                        display: block !important;
                        position: static !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        height: auto !important;
                        max-height: none !important;
                        overflow: visible !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .print-stage-block {
                        break-inside: auto !important;
                        page-break-inside: auto !important;
                        margin-bottom: 8px !important;
                    }
                    .print-sub-section {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                        -webkit-column-break-inside: avoid !important;
                        margin-bottom: 6px !important;
                        overflow: visible !important;
                    }
                    .print-row {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                        -webkit-column-break-inside: avoid !important;
                    }
                    .print-stage-header {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                        -webkit-column-break-inside: avoid !important;
                    }
                    .print-signature-block {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                        -webkit-column-break-inside: avoid !important;
                    }
                    table, tr, td, th, tbody, thead {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                        -webkit-column-break-inside: avoid !important;
                    }
                }
            `}</style>

            {/* Modal Dialog Overlay */}
            <div
                id="patient-print-modal-overlay"
                onClick={(e) => {
                    if (e.target.id === 'patient-print-modal-overlay') {
                        onClose?.()
                    }
                }}
                className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-200"
            >
                {/* Modal Dialog Card */}
                <div
                    id="patient-print-card"
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-5xl max-h-[94vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-zinc-800"
                >
                    {/* Modal Top Control Bar (Hidden on print) */}
                    <div className="no-print px-5 py-2.5 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-zinc-900 shrink-0">
                        {/* Title & Badge (Without sub label) */}
                        <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-app-tint-10 text-app-primary">
                                <Printer className="h-4 w-4" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                                <span>
                                    {isKm
                                        ? 'ប័ណ្ណសុខភាព និងសង្ខេបប្រវត្តិព្យាបាល (NCHADS)'
                                        : 'Patient Health Card & Clinical Summary'}
                                </span>
                                <span className="text-[10px] bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-mono px-2 py-0.5 rounded">
                                    A4 Standard
                                </span>
                            </h3>
                        </div>

                        {/* Controls: Language, Density, Visit Filter, Copy, Print, Close */}
                        <div className="flex items-center gap-1.5 shrink-0">
                            {/* Live Language Selector in Modal (Uniform h-8 container) */}
                            <div className="h-8 flex items-center p-0.5 bg-slate-200/80 dark:bg-zinc-800 rounded-lg border border-slate-300 dark:border-zinc-700">
                                <button
                                    type="button"
                                    onClick={() => setPrintLang('km')}
                                    title={isKm ? 'ភាសាខ្មែរ (Khmer)' : 'Switch to Khmer'}
                                    className={cn(
                                        'h-7 px-2.5 text-xs font-bold rounded-md flex items-center justify-center transition-all',
                                        isKm
                                            ? 'bg-white dark:bg-zinc-900 text-app-primary shadow-xs'
                                            : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                                    )}
                                >
                                    ខ្មែរ
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPrintLang('en')}
                                    title={!isKm ? 'English' : 'Switch to English'}
                                    className={cn(
                                        'h-7 px-2.5 text-xs font-bold rounded-md flex items-center justify-center transition-all',
                                        !isKm
                                            ? 'bg-white dark:bg-zinc-900 text-app-primary shadow-xs'
                                            : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                                    )}
                                >
                                    EN
                                </button>
                            </div>

                            {/* Density Selector (Uniform h-8 container) */}
                            <div className="h-8 flex items-center p-0.5 bg-slate-200/80 dark:bg-zinc-800 rounded-lg border border-slate-300 dark:border-zinc-700">
                                <button
                                    type="button"
                                    onClick={() => setDensityMode('compact')}
                                    title={isKm ? 'ប្លង់សន្សំទំព័រ (Compact Grid)' : 'Compact Grid (2 Columns)'}
                                    aria-label="Compact Grid"
                                    className={cn(
                                        'h-7 w-7 flex items-center justify-center rounded-md transition-all',
                                        densityMode === 'compact'
                                            ? 'bg-white dark:bg-zinc-900 text-app-primary shadow-xs'
                                            : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                                    )}
                                >
                                    <Columns2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDensityMode('standard')}
                                    title={isKm ? 'ប្លង់ទូលាយ (Standard View)' : 'Standard View (1 Column)'}
                                    aria-label="Standard View"
                                    className={cn(
                                        'h-7 w-7 flex items-center justify-center rounded-md transition-all',
                                        densityMode === 'standard'
                                            ? 'bg-white dark:bg-zinc-900 text-app-primary shadow-xs'
                                            : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900'
                                    )}
                                >
                                    <Rows2 className="h-3.5 w-3.5" />
                                </button>
                            </div>

                            {/* Event Filter with Shadcn Select Dropdown */}
                            {events.length > 1 && (
                                <div className="w-[150px] shrink-0">
                                    <Select
                                        value={selectedEventId}
                                        onValueChange={(val) => setSelectedEventId(val)}
                                        options={[
                                            {
                                                value: 'ALL',
                                                label: isKm
                                                    ? `វគ្គទាំងអស់ (${events.length})`
                                                    : `All Visits (${events.length})`,
                                            },
                                            ...events.map((ev, idx) => ({
                                                value: ev.event || ev.id,
                                                label: `${isKm ? 'វគ្គ ' + toKhmerNumber(idx + 1) : 'Visit ' + (idx + 1)}: ${String(ev.eventDate || ev.occurredAt || '').slice(0, 10)}`,
                                            })),
                                        ]}
                                        className="h-8 min-h-8 text-xs font-semibold rounded-lg bg-white dark:bg-zinc-800 border-slate-300 dark:border-zinc-700"
                                    />
                                </div>
                            )}

                            {/* Copy Summary Text (Uniform h-8 w-8) */}
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCopySummary}
                                className="h-8 w-8 p-0 text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer rounded-lg shrink-0"
                                title={isKm ? (copiedSummary ? 'បានចម្លងរួចរាល់' : 'ចម្លងអត្ថបទសង្ខេប (Copy)') : (copiedSummary ? 'Copied to clipboard' : 'Copy summary')}
                                aria-label="Copy Summary"
                            >
                                {copiedSummary ? (
                                    <Check className="h-4 w-4 text-emerald-600" />
                                ) : (
                                    <Copy className="h-4 w-4" />
                                )}
                            </Button>

                            {/* Print Button (Uniform h-8 w-8) */}
                            <Button
                                type="button"
                                onClick={handlePrint}
                                className="h-8 w-8 p-0 bg-app-primary hover:bg-app-primary/90 text-white rounded-lg shadow-xs cursor-pointer shrink-0 border-0"
                                title={isKm ? 'បោះពុម្ព A4 (Print A4)' : 'Print A4'}
                                aria-label="Print A4"
                            >
                                <Printer className="h-4 w-4" />
                            </Button>

                            {/* Close Button (Uniform h-8 w-8) */}
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onClose?.()}
                                className="h-8 w-8 p-0 border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer rounded-lg shrink-0"
                                title={isKm ? 'បិទ (Close)' : 'Close'}
                                aria-label="Close"
                            >
                                <Cross2Icon className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Printable Document Area */}
                    <div
                        className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 bg-white text-black"
                        id="patient-print-document"
                    >
                        {/* Official National Healthcare Letterhead */}
                        <div className="flex items-start justify-between gap-4 pb-2.5 border-b-2 border-black">
                            {/* Left: Ministry & NCHADS Logo */}
                            <div className="flex items-start gap-3 max-w-[65%]">
                                <img
                                    src={nchadsLogo}
                                    alt="NCHADS Logo"
                                    style={{ width: '64px', height: '64px', minWidth: '64px', minHeight: '64px' }}
                                    className="w-16 h-16 object-contain shrink-0"
                                />
                                <div className="text-left flex flex-col justify-center">
                                    <h4 className="text-[13px] font-bold text-black tracking-tight leading-snug">
                                        {isKm ? 'ក្រសួងសុខាភិបាល' : 'MINISTRY OF HEALTH'}
                                    </h4>
                                    <h5 className="text-[11.5px] font-bold text-black leading-snug mt-0.5">
                                        {isKm
                                            ? 'មជ្ឈមណ្ឌលជាតិប្រយុទ្ធនឹងជំងឺអេដស៍ សើស្បែក និងកាមរោគ (NCHADS)'
                                            : 'National Center for HIV/AIDS, Dermatology and STD (NCHADS)'}
                                    </h5>
                                    <p className="text-[11px] font-semibold text-black mt-0.5">
                                        {isKm
                                            ? `មណ្ឌលសុខភាព / មន្ទីរពេទ្យបង្អែក ៖ ${effectiveOrgUnitName || '.......................................................'}`
                                            : `Health Facility / Hospital: ${effectiveOrgUnitName || '.......................................................'}`}
                                    </p>
                                </div>
                            </div>

                            {/* Right: Kingdom of Cambodia Motto */}
                            <div className="text-right flex flex-col items-end shrink-0">
                                <h3 className="text-[14px] font-bold text-black tracking-wide">
                                    {isKm ? 'ព្រះរាជាណាចក្រកម្ពុជា' : 'KINGDOM OF CAMBODIA'}
                                </h3>
                                <h4 className="text-[12px] font-bold text-black tracking-wider mt-0.5">
                                    {isKm ? 'ជាតិ សាសនា ព្រះមហាក្សត្រ' : 'NATION RELIGION KING'}
                                </h4>
                                <div className="w-20 h-0.5 bg-black my-1 self-end" />
                                <p className="text-[10px] text-black font-medium">{currentDateStr}</p>
                            </div>
                        </div>

                        {/* Document Title Banner */}
                        <div className="text-center my-3">
                            <h2 className="text-[15px] font-bold text-black uppercase tracking-wide">
                                {isKm
                                    ? 'ប័ណ្ណសុខភាព និងសង្ខេបប្រវត្តិព្យាបាលអ្នកជំងឺ'
                                    : 'PATIENT CLINICAL SUMMARY & HEALTH RECORD'}
                            </h2>
                            <p className="text-[11px] font-bold text-black mt-0.5">
                                {program?.displayName ||
                                    program?.name ||
                                    (isKm ? 'កម្មវិធីជាតិសុខភាព' : 'National Health Program')}
                            </p>
                        </div>

                        {/* Client Demographics Structured Medical Table */}
                        <div className="border border-black mb-3.5 flex items-stretch bg-white">
                            {/* Table of Demographics */}
                            <div className="flex-1 flex flex-col justify-center">
                                <table className="w-full h-full border-collapse text-xs">
                                    <tbody>
                                        {/* Row 1: PMRS / SMH / UUIC Identifiers */}
                                        <tr className="border-b border-black">
                                            <td className="w-[18%] bg-slate-100 font-bold border-r border-black px-2.5 py-1 text-[11px] text-black">
                                                {isKm ? 'លេខកូដ PMRS:' : 'PMRS Code:'}
                                            </td>
                                            <td className="w-[32%] font-bold border-r border-black px-2.5 py-1 text-xs text-black font-mono">
                                                {pmrsCode || (isKm ? 'មិនមាន' : 'N/A')}
                                            </td>
                                            <td className="w-[20%] bg-slate-100 font-bold border-r border-black px-2.5 py-1 text-[11px] text-black">
                                                {secondaryIdLabel}
                                            </td>
                                            <td className="w-[30%] font-bold px-2.5 py-1 text-xs text-black font-mono">
                                                {secondaryIdValue}
                                            </td>
                                        </tr>

                                        {/* Row 2: Name & Sex */}
                                        <tr className="border-b border-black">
                                            <td className="bg-slate-100 font-bold border-r border-black px-2.5 py-1 text-[11px] text-black">
                                                {isKm ? 'គោត្តនាម និងនាម:' : 'Full Name:'}
                                            </td>
                                            <td className="font-bold border-r border-black px-2.5 py-1 text-xs text-black">
                                                {fullName}
                                            </td>
                                            <td className="bg-slate-100 font-bold border-r border-black px-2.5 py-1 text-[11px] text-black">
                                                {isKm ? 'ភេទ:' : 'Sex:'}
                                            </td>
                                            <td className="px-2.5 py-1 text-xs text-black font-semibold">
                                                {sexDisplay}
                                            </td>
                                        </tr>

                                        {/* Row 3: DOB / Age & Phone */}
                                        <tr className="border-b border-black">
                                            <td className="bg-slate-100 font-bold border-r border-black px-2.5 py-1 text-[11px] text-black">
                                                {isKm ? 'ថ្ងៃកំណើត (អាយុ):' : 'DOB (Age):'}
                                            </td>
                                            <td className="border-r border-black px-2.5 py-1 text-xs text-black font-medium">
                                                {dobVal && ageVal
                                                    ? isKm
                                                        ? `${dobVal} (${toKhmerNumber(ageVal)} ឆ្នាំ)`
                                                        : `${dobVal} (${ageVal} yrs)`
                                                    : dobVal ||
                                                      (ageVal
                                                          ? isKm
                                                              ? `${toKhmerNumber(ageVal)} ឆ្នាំ`
                                                              : `${ageVal} yrs`
                                                          : isKm
                                                            ? 'មិនបានកត់ត្រា'
                                                            : 'Unspecified')}
                                            </td>
                                            <td className="bg-slate-100 font-bold border-r border-black px-2.5 py-1 text-[11px] text-black">
                                                {isKm ? 'លេខទូរស័ព្ទ:' : 'Phone Number:'}
                                            </td>
                                            <td className="px-2.5 py-1 text-xs text-black font-medium">
                                                {phone}
                                            </td>
                                        </tr>

                                        {/* Row 4: Address & Registration Date */}
                                        <tr>
                                            <td className="bg-slate-100 font-bold border-r border-black px-2.5 py-1 text-[11px] text-black">
                                                {isKm ? 'អាសយដ្ឋាន:' : 'Address:'}
                                            </td>
                                            <td className="border-r border-black px-2.5 py-1 text-xs text-black font-medium">
                                                {address}
                                            </td>
                                            <td className="bg-slate-100 font-bold border-r border-black px-2.5 py-1 text-[11px] text-black">
                                                {isKm ? 'ថ្ងៃចុះឈ្មោះ:' : 'Enrollment Date:'}
                                            </td>
                                            <td className="px-2.5 py-1 text-xs text-black font-medium">
                                                {enrollmentDate ? String(enrollmentDate).slice(0, 10) : 'N/A'}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Client QR Code Cell */}
                            <div className="border-l border-black p-1.5 flex flex-col items-center justify-center bg-white shrink-0 w-[88px] self-stretch">
                                {generateQrSvg({
                                    text: clientCode || tei.trackedEntityInstance || 'NCHADS-CLIENT',
                                    size: 72,
                                    showLabel: false,
                                })}
                                <span className="text-[8px] font-mono text-center mt-0.5 text-black font-bold truncate max-w-[80px]">
                                    {pmrsCode || prepCode || smhCode || uuicCode || clientCode}
                                </span>
                            </div>
                        </div>

                        {/* Clinical Encounters & Stage Sections */}
                        <div className="mb-4">
                            <div className="border-b-2 border-black pb-1 mb-2 flex items-center justify-between">
                                <h4 className="text-xs font-bold uppercase text-black tracking-wider">
                                    {isKm
                                        ? `ប្រវត្តិនៃការពិនិត្យ និងព្យាបាលតាមដំណាក់កាល (${toKhmerNumber(displayedEvents.length)})`
                                        : `CLINICAL ENCOUNTERS & STAGE SUMMARY (${displayedEvents.length})`}
                                </h4>
                            </div>

                            {displayedEvents.length === 0 ? (
                                <div className="py-5 text-center text-xs text-black border border-black p-4">
                                    {isKm
                                        ? 'មិនទាន់មានប្រវត្តិពិនិត្យព្យាបាលនៅឡើយទេ'
                                        : 'No clinical encounter records found'}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {displayedEvents.map((ev, idx) => {
                                        const eventDate = ev.eventDate || ev.occurredAt || ev.createdAt
                                        const stageObj = stagesMapById[ev.programStage]
                                        const stageName =
                                            stageObj?.displayName ||
                                            stageObj?.name ||
                                            stagesDictionary[ev.programStage] ||
                                            ev.programStageName ||
                                            ev.stageName ||
                                            (isKm ? 'ការពិនិត្យព្យាបាល' : 'Clinical Visit')

                                        const isComplete = ev.status === 'COMPLETED'
                                        const dataValues = ev.dataValues || []

                                        // Build map of event data values
                                        const dataValuesMap = new Map()
                                        for (const dv of dataValues) {
                                            if (dv.value != null && String(dv.value).trim() !== '') {
                                                dataValuesMap.set(dv.dataElement, dv.value)
                                            }
                                        }

                                        // Extract stage sections if configured & filter by sex gating
                                        const allSections =
                                            stageObj?.programStageSections || stageObj?.sections || []
                                        const activeSections = allSections.filter(
                                            (sec) => !isSectionHiddenForSex(sec)
                                        )

                                        // Group data elements strictly by section
                                        const renderedSections = []
                                        const assignedDeIds = new Set()

                                        let sectionIndex = 0
                                        for (const sec of activeSections) {
                                            const secDeList = (
                                                sec.dataElementIds ||
                                                (Array.isArray(sec.dataElements)
                                                    ? sec.dataElements.map((item) => item?.id || item)
                                                    : []) ||
                                                (Array.isArray(sec.programStageDataElements)
                                                    ? sec.programStageDataElements.map((item) => item?.dataElement?.id || item?.id || item)
                                                    : []) ||
                                                []
                                            ).filter(Boolean)

                                            const answeredInSec = []
                                            for (const deId of secDeList) {
                                                if (dataValuesMap.has(deId)) {
                                                    answeredInSec.push({
                                                        dataElement: deId,
                                                        value: dataValuesMap.get(deId),
                                                    })
                                                    assignedDeIds.add(deId)
                                                }
                                            }

                                            if (answeredInSec.length > 0) {
                                                const rawTitle = sec.displayName || sec.name || sec.formName || ''
                                                const displayHeading = formatSectionHeading(rawTitle, sectionIndex)

                                                renderedSections.push({
                                                    id: sec.id,
                                                    heading: displayHeading,
                                                    letterIndex: sectionIndex,
                                                    items: answeredInSec,
                                                })
                                                sectionIndex++
                                            }
                                        }

                                        // If no sections were found in metadata, group answered data elements under a standard section
                                        if (renderedSections.length === 0 && dataValues.length > 0) {
                                            const answeredItems = dataValues.filter(
                                                (dv) => dv.value != null && String(dv.value).trim() !== ''
                                            )
                                            if (answeredItems.length > 0) {
                                                renderedSections.push({
                                                    id: 'general-findings',
                                                    heading: isKm
                                                        ? 'ចំណុច ក - ព័ត៌មានលម្អិតនៃការពិនិត្យគ្លីនិក'
                                                        : 'Part A - Clinical Examination Findings',
                                                    letterIndex: 0,
                                                    items: answeredItems,
                                                })
                                            }
                                        }

                                        const stageNumberDisplay = isKm
                                            ? `${toKhmerNumber(idx + 1)}.`
                                            : `${idx + 1}.`

                                        const cleanStageName = isKm
                                            ? stageName.replace(/\/[A-Za-z\s&,\.\(\)\-]+/g, '').trim()
                                            : stageObj?.name || stageName.replace(/^[\u1780-\u17FF\s]+\/\s*/, '').trim()

                                        return (
                                            <div
                                                key={ev.event || idx}
                                                className="print-stage-block mb-4 text-xs"
                                            >
                                                {/* Stage Header Banner */}
                                                <div className="print-stage-header flex items-center justify-between bg-slate-100 border-2 border-black px-3 py-1.5 mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-black text-xs">
                                                            {stageNumberDisplay} {cleanStageName}
                                                        </span>
                                                        <span className="text-[10.5px] px-2 py-0.5 bg-white border border-black font-bold text-black">
                                                            {eventDate ? String(eventDate).slice(0, 10) : 'N/A'}
                                                        </span>
                                                    </div>
                                                    <span className="text-[9.5px] font-bold uppercase tracking-wider px-2 py-0.5 border border-black bg-white text-black">
                                                        {isComplete
                                                            ? isKm
                                                                ? 'បានបញ្ចប់'
                                                                : 'COMPLETED'
                                                            : isKm
                                                              ? 'កំពុងបន្ត'
                                                              : 'ACTIVE'}
                                                    </span>
                                                </div>

                                                {/* Stage Sections Block */}
                                                <div className="space-y-2.5">
                                                    {renderedSections.length === 0 ? (
                                                        <div className="border border-black p-3 text-center text-[11px] text-black italic">
                                                            {isKm
                                                                ? 'មិនមានទិន្នន័យពិនិត្យ'
                                                                : 'No recorded data values'}
                                                        </div>
                                                    ) : (
                                                        renderedSections.map((sec, secIdx) => (
                                                            <div
                                                                key={sec.id || secIdx}
                                                                style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                                                                className="print-sub-section border border-black bg-white rounded-xs"
                                                            >
                                                                {sec.heading && (
                                                                    <div className="bg-slate-100/90 px-3 py-1.5 border-b border-black text-[11px] font-bold text-black tracking-wide flex items-center justify-between">
                                                                        <span className="font-bold text-black uppercase">{sec.heading}</span>
                                                                        <span className="text-[9.5px] font-normal text-black opacity-75">
                                                                            ({isKm ? toKhmerNumber(sec.items.length) : sec.items.length} {isKm ? 'ចម្លើយ' : 'items'})
                                                                        </span>
                                                                    </div>
                                                                )}

                                                                {/* Density: Compact 2-Column Grid vs Standard 1-Column */}
                                                                <div
                                                                    className={cn(
                                                                        'divide-y divide-black/20',
                                                                        densityMode === 'compact'
                                                                            ? 'grid grid-cols-1 md:grid-cols-2 divide-y-0 md:divide-x md:divide-black/20'
                                                                            : ''
                                                                    )}
                                                                >
                                                                    {sec.items.map((dv, dvIdx) => {
                                                                        const label = formatDataElementLabel(
                                                                            dv.dataElement
                                                                        )
                                                                        const displayVal = formatDataElementValue(
                                                                            dv.dataElement,
                                                                            dv.value
                                                                        )
                                                                        const itemNum = isKm
                                                                            ? toKhmerNumber(dvIdx + 1)
                                                                            : String(dvIdx + 1)

                                                                        return (
                                                                            <div
                                                                                key={dvIdx}
                                                                                style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                                                                                className="print-row flex items-center justify-between gap-3 px-3 py-1 text-xs border-b border-black/10 md:border-b-0"
                                                                            >
                                                                                <div className="flex items-start gap-1.5 min-w-0 pr-2">
                                                                                    <span className="font-bold text-black shrink-0 text-[11px]">
                                                                                        {itemNum}.
                                                                                    </span>
                                                                                    <span className="font-medium text-black text-[11px] leading-snug">
                                                                                        {label}:
                                                                                    </span>
                                                                                </div>
                                                                                <div className="text-right shrink-0">
                                                                                    <span className="inline-block font-bold text-[11px] text-black">
                                                                                        {displayVal}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Official Signatures & Verification Stamp Section */}
                        <div className="print-signature-block mt-5 pt-2.5 border-t-2 border-black grid grid-cols-2 gap-8 text-xs text-black">
                            <div>
                                <span className="block text-[10.5px] font-bold uppercase text-black">
                                    {isKm
                                        ? 'បានឃើញ និងបញ្ជាក់ដោយប្រធានមណ្ឌល/មន្ទីរពេទ្យ'
                                        : 'Facility Director Stamp & Verification'}
                                </span>
                                <div className="mt-10 border-b-2 border-black w-44" />
                            </div>
                            <div className="text-right">
                                <span className="block text-[10.5px] font-bold uppercase text-black">
                                    {isKm ? 'គ្រូពេទ្យពិនិត្យព្យាបាល' : 'Clinical Officer Signature'}
                                </span>
                                <div className="mt-10 border-b-2 border-black w-44 ml-auto" />
                            </div>
                        </div>

                        {/* Confidentiality Footer Note */}
                        <div className="mt-3 text-center text-[9px] text-black font-semibold uppercase tracking-wider">
                            {isKm
                                ? 'ឯកសារសុខាភិបាលសម្ងាត់ផ្លូវការ (Official Confidential Medical Document - NCHADS)'
                                : 'Official Confidential Medical Document - NCHADS'}
                        </div>
                    </div>

                    {/* Screen-only Modal Bottom Control Bar */}
                    <div className="no-print px-5 py-2.5 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-900 shrink-0">
                        <span className="text-xs text-slate-500 dark:text-zinc-400">
                            {isKm
                                ? 'ចុចប៊ូតុងបោះពុម្ព A4 ឬចុច Esc ដើម្បីបិទ'
                                : 'Press Print A4 or hit Esc / Click Outside to close'}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onClose?.()}
                                className="h-8 px-3.5 text-xs font-bold border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                            >
                                <span>{isKm ? 'បិទ' : 'Close'}</span>
                            </Button>
                            <Button
                                type="button"
                                onClick={handlePrint}
                                className="h-8 px-4 bg-app-primary hover:bg-app-primary/90 text-white rounded-md text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                                <Printer className="h-4 w-4" />
                                <span>{isKm ? 'បោះពុម្ព A4' : 'Print A4'}</span>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )

    if (typeof document === 'undefined') return null
    return createPortal(modalContent, document.body)
}
