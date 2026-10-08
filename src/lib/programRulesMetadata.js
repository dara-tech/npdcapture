/**
 * Program rules in Maintenance reference Khmer/default field and option labels.
 * UI metadata is localized (`displayName`); rules must always resolve against stable names.
 */

function stableFieldLabel(meta) {
    return String(meta?.systemName || meta?.name || meta?.displayName || '').trim()
}

function mapOptionsForRules(options = []) {
    return options.map((o) => {
        const code = o.code != null && String(o.code).trim() !== '' ? String(o.code).trim() : null
        const stable =
            code || String(o.systemName || o.name || o.displayName || o.id || '').trim()
        return {
            ...o,
            name: stable,
            displayName: stable,
        }
    })
}

function mapDeForRules(de) {
    if (!de) return de
    const stable = stableFieldLabel(de)
    const optionSet = de.optionSet
        ? {
              ...de.optionSet,
              options: mapOptionsForRules(de.optionSet.options || []),
          }
        : de.optionSet
    return {
        ...de,
        name: stable || de.name,
        displayName: stable || de.displayName,
        optionSet,
    }
}

/**
 * @param {ReturnType<import('../services/metadataService').normalizeProgramMetadata>} metadata
 */
export function buildMetadataForProgramRules(metadata) {
    if (!metadata) return null

    const dataElements = {}
    for (const [id, de] of Object.entries(metadata.dataElements || {})) {
        dataElements[id] = mapDeForRules(de)
    }

    const attributes = (metadata.attributes || []).map((a) => {
        const stable = stableFieldLabel(a)
        const optionSet = a.optionSet
            ? {
                  ...a.optionSet,
                  options: mapOptionsForRules(a.optionSet.options || []),
              }
            : a.optionSet
        return {
            ...a,
            name: stable || a.name,
            displayName: stable || a.displayName,
            optionSet,
        }
    })

    return {
        ...metadata,
        dataElements,
        attributes,
    }
}
