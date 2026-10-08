import { useState, useEffect, useRef } from 'react'
import { searchTrackedEntities } from '../../../services/trackerApi'

export function useDuplicateDetector({ engine, context, formValues = {}, programAttributes = [] }) {
    const [potentialDuplicates, setPotentialDuplicates] = useState([])
    const [checking, setChecking] = useState(false)
    const timerRef = useRef(null)

    // Find attribute IDs for matching
    const phoneAttr = programAttributes.find((a) => {
        const n = (a.name || a.displayName || '').toLowerCase()
        return n.includes('phone') || n.includes('mobile') || n.includes('ទូរស័ព្ទ')
    })

    // Match UUIC specifically (Do NOT match PrEP Code, SMH, or other auto-generated IDs)
    const uuicAttr = programAttributes.find((a) => {
        const n = (a.name || a.displayName || '').toLowerCase()
        return n.includes('uuic')
    })

    const firstNameAttr = programAttributes.find((a) => {
        const n = (a.name || a.displayName || '').toLowerCase()
        return (
            n.includes('first name') ||
            n.includes('firstname') ||
            n.includes('នាមខ្លួន') ||
            n.includes('given')
        )
    })

    const lastNameAttr = programAttributes.find((a) => {
        const n = (a.name || a.displayName || '').toLowerCase()
        return (
            n.includes('last name') ||
            n.includes('lastname') ||
            n.includes('គោត្តនាម') ||
            n.includes('family') ||
            n.includes('surname')
        )
    })

    const phoneVal = phoneAttr ? String(formValues[phoneAttr.id] || '').trim() : ''
    const uuicVal = uuicAttr ? String(formValues[uuicAttr.id] || '').trim() : ''
    const firstNameVal = firstNameAttr ? String(formValues[firstNameAttr.id] || '').trim() : ''
    const lastNameVal = lastNameAttr ? String(formValues[lastNameAttr.id] || '').trim() : ''

    // Only search when the user has entered meaningful identifying personal data:
    // 1. Phone number (at least 8 digits)
    // 2. Full UUIC (at least 9 characters and not placeholder/empty)
    // 3. Both First Name and Last Name entered
    let searchTarget = ''
    if (phoneVal.replace(/\D/g, '').length >= 8) {
        searchTarget = phoneVal
    } else if (uuicVal.length >= 9 && !uuicVal.includes('-') && !uuicVal.includes('—') && !uuicVal.includes(' ')) {
        searchTarget = uuicVal
    } else if (firstNameVal.length >= 2 && lastNameVal.length >= 2) {
        searchTarget = `${lastNameVal} ${firstNameVal}`.trim()
    }

    useEffect(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current)
        }

        if (!searchTarget || !context?.orgUnit || !context?.program) {
            setPotentialDuplicates([])
            setChecking(false)
            return
        }

        setChecking(true)
        timerRef.current = setTimeout(async () => {
            try {
                const res = await searchTrackedEntities({
                    engine,
                    orgUnit: context.orgUnit,
                    ouMode: 'DESCENDANTS',
                    program: context.program,
                    value: searchTarget,
                    pageSize: 5,
                })

                const list = res?.instances || []
                const targetLower = searchTarget.toLowerCase()
                const digits = searchTarget.replace(/\D/g, '')

                const matched = list.filter((inst) => {
                    const attrs = inst.attributes || []
                    return attrs.some((a) => {
                        const v = String(a.value || '').trim().toLowerCase()
                        if (!v) return false
                        if (v === targetLower || v.includes(targetLower)) return true
                        if (digits && digits.length >= 6 && v.replace(/\D/g, '').includes(digits)) return true
                        return false
                    })
                })

                setPotentialDuplicates(matched)
            } catch (err) {
                console.warn('Duplicate detection check error', err)
                setPotentialDuplicates([])
            } finally {
                setChecking(false)
            }
        }, 650)

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [searchTarget, engine, context?.orgUnit, context?.program])

    const activeDuplicates = searchTarget ? potentialDuplicates : []

    return {
        potentialDuplicates: activeDuplicates,
        checking: searchTarget ? checking : false,
        hasDuplicates: activeDuplicates.length > 0,
    }
}
