import i18n from '@dhis2/d2-i18n'

const KHMER_DIGITS_MAP = {
    '០': '0',
    '១': '1',
    '២': '2',
    '៣': '3',
    '៤': '4',
    '៥': '5',
    '៦': '6',
    '៧': '7',
    '៨': '8',
    '៩': '9',
}

/**
 * Parses raw stage title into a structured display object:
 * { number: '01', title: 'ព័ត៌មានរបស់អតិថិជន', meta: 'ថ្នាំលេប' }
 */
export const parseStageDisplay = (rawName, fallbackIndex = 1) => {
    if (!rawName) {
        return {
            number: String(fallbackIndex).padStart(2, '0'),
            title: '',
            meta: null,
        }
    }
    const s = String(rawName).trim()

    // 1. Extract stage number
    const numMatch = s.match(/(?:ទម្រង់\s*([០-៩\d]+)|([0-9]+)\s*Form)/i)
    let number = null
    if (numMatch) {
        const rawNum = numMatch[1] || numMatch[2]
        number = rawNum
            .split('')
            .map((c) => KHMER_DIGITS_MAP[c] || c)
            .join('')
            .padStart(2, '0')
    } else {
        number = String(fallbackIndex).padStart(2, '0')
    }

    // 2. Clean prefix like "ទម្រង់ ០១៖ ", "01 Form: ", "Form: "
    const clean = s
        .replace(/^(?:ទម្រង់\s*[០-៩\d]*\s*[៖:]\s*|\d+\s*Form\s*[:]\s*|Form\s*[:]\s*|ទម្រង់\s*)/i, '')
        .trim()

    // 3. Extract trailing tag inside parentheses, e.g. "(ថ្នាំលេប)", "(រាល់៣ខែ)"
    const metaMatches = clean.match(/\(([^)]+)\)$/)
    const meta = metaMatches ? metaMatches[1].trim() : null

    // 4. Main title without the trailing meta
    let title = metaMatches ? clean.replace(/\s*\([^)]+\)$/, '').trim() : clean
    if (!title) {
        title = clean || s
    }

    return { number, title, meta }
}

/**
 * Stage labels for UI tabs and badges — returns full name without truncating.
 */
export const getShortStageLabel = (stageName) => {
    if (!stageName) return ''
    return String(stageName).trim()
}

/**
 * Group stages into logical clinical workflow categories when there are > 4 stages.
 */
export const groupStagesForWorkflow = (programStages = []) => {
    if (!programStages || programStages.length <= 4) {
        return null
    }

    const groups = [
        {
            id: 'INITIAL',
            name: i18n.t('Initial & Baseline'),
            nameKh: 'ដំណាក់កាលដំបូង',
            stageIds: new Set(),
            stages: [],
        },
        {
            id: 'ROUTINE',
            name: i18n.t('Follow-up & Lab'),
            nameKh: 'តាមដាន & Lab',
            stageIds: new Set(),
            stages: [],
        },
        {
            id: 'TRANSITIONS',
            name: i18n.t('Case Management'),
            nameKh: 'ករណីពិសេស',
            stageIds: new Set(),
            stages: [],
        },
    ]

    programStages.forEach((stage, idx) => {
        const name = String(stage.displayName || stage.name || '').toLowerCase()
        const sortOrder = Number(stage.sortOrder || idx + 1)

        if (
            sortOrder <= 3 ||
            name.includes('intake') ||
            name.includes('eligibility') ||
            name.includes('baseline') ||
            name.includes('ព័ត៌មាន') ||
            name.includes('លក្ខណៈវិនិច្ឆ័យ') ||
            name.includes('ដំបូង')
        ) {
            groups[0].stageIds.add(stage.id)
            groups[0].stages.push(stage)
        } else if (
            name.includes('discontinuation') ||
            name.includes('transfer') ||
            name.includes('restart') ||
            name.includes('approval') ||
            name.includes('ឈប់') ||
            name.includes('ផ្ទេរ') ||
            name.includes('ឡើងវិញ')
        ) {
            groups[2].stageIds.add(stage.id)
            groups[2].stages.push(stage)
        } else {
            groups[1].stageIds.add(stage.id)
            groups[1].stages.push(stage)
        }
    })

    return groups.filter((g) => g.stages.length > 0)
}

/**
 * Find the next logical program stage in sequence.
 */
export const getNextProgramStage = (currentStageId, programStages = []) => {
    if (!currentStageId || !programStages?.length) return null
    const currentIndex = programStages.findIndex((s) => s.id === currentStageId)
    if (currentIndex >= 0 && currentIndex < programStages.length - 1) {
        return programStages[currentIndex + 1]
    }
    return null
}
