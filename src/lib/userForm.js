const refIds = (items) =>
    (items || [])
        .map((x) => (typeof x === 'string' ? x : x?.id))
        .filter(Boolean)

export const emptyUserForm = () => ({
    id: '',
    username: '',
    password: '',
    firstName: '',
    surname: '',
    email: '',
    phoneNumber: '',
    disabled: false,
    roleIds: [],
    groupIds: [],
    organisationUnitIds: [],
})

export const userToForm = (user) => ({
    id: user?.id || '',
    username: user?.username || user?.userCredentials?.username || '',
    password: '',
    firstName: user?.firstName || '',
    surname: user?.surname || '',
    email: user?.email || '',
    phoneNumber: user?.phoneNumber || '',
    disabled: Boolean(user?.disabled || user?.userCredentials?.disabled),
    roleIds: refIds(user?.userRoles),
    groupIds: refIds(user?.userGroups),
    organisationUnitIds: refIds(user?.organisationUnits),
})

export const formToUserPayload = (form, { includePassword = false } = {}) => {
    const username = form.username?.trim() || ''
    const userRoles = (form.roleIds || []).map((id) => ({ id }))
    const organisationUnits = (form.organisationUnitIds || []).map((id) => ({ id }))

    const payload = {
        // DHIS2 2.40+ persists username on User (not only UserCredentials).
        username,
        firstName: form.firstName?.trim() || '',
        surname: form.surname?.trim() || '',
        disabled: Boolean(form.disabled),
        userRoles,
        userGroups: (form.groupIds || []).map((id) => ({ id })),
        organisationUnits,
        dataViewOrganisationUnits: organisationUnits,
        teiSearchOrganisationUnits: organisationUnits,
    }

    const email = form.email?.trim()
    const phoneNumber = form.phoneNumber?.trim()
    if (email) payload.email = email
    if (phoneNumber) payload.phoneNumber = phoneNumber

    const credentials = {
        username,
        disabled: Boolean(form.disabled),
        userRoles,
    }
    if (includePassword && form.password?.trim()) {
        credentials.password = form.password.trim()
    }

    payload.userCredentials = credentials

    if (form.id) payload.id = form.id

    return payload
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Client-side validation before create/update.
 * @returns {Record<string, string>} field id → i18n message key or English fallback
 */
export const validateUserForm = (form, { isNew = false } = {}) => {
    const errors = {}

    if (!form.username?.trim()) {
        errors.username = 'Username is required.'
    }

    if (isNew && !form.password?.trim()) {
        errors.password = 'Password is required for new users.'
    }

    const hasOu = (form.organisationUnitIds || []).length > 0
    const hasRoles = (form.roleIds || []).length > 0
    if (!hasOu && !hasRoles) {
        const msg = 'Assign at least one organisation unit or user role.'
        errors.organisationUnitIds = msg
        errors.roleIds = msg
    }

    const email = form.email?.trim()
    if (email && !EMAIL_RE.test(email)) {
        errors.email = 'Enter a valid email address.'
    }

    return errors
}

export const userDisplayLabel = (user) => {
    if (user?.displayName) return user.displayName
    const parts = [user?.firstName, user?.surname].filter(Boolean)
    if (parts.length) return parts.join(' ')
    return user?.userCredentials?.username || user?.username || user?.id || ''
}
