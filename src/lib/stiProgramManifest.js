/** Dedicated STI tracker program (២.កម្មវិធី STI) — rules use STI_* prefixes; not filtered like prevention. */
export const STI_PROGRAM_ID = 'pj7yQcLrhE2'

export const STI_PROGRAM_STAGE_IDS = {
    /** Examination & treatment clinical form (DHIS2 Maintenance stage). */
    clinicalForm: 'oj7dKrmA8eg',
}

export function isStiProgram(programId) {
    return String(programId || '') === STI_PROGRAM_ID
}
