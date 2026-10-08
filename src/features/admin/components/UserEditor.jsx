import React, { useCallback, useEffect, useMemo, useState } from 'react'
import i18n from '@dhis2/d2-i18n'
import { ChevronLeft, Save, X } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Spinner } from '../../../components/ui/spinner'
import { cn } from '../../../lib/utils'
import { FORM } from '../../../lib/formUi'
import { ADMIN } from '../adminUi'
import {
    emptyUserForm,
    formToUserPayload,
    userDisplayLabel,
    userToForm,
    validateUserForm,
} from '../../../lib/userForm'
import {
    createUser,
    fetchUserById,
    fetchUserGroups,
    fetchUserRoles,
    formatUserManagementError,
    searchOrganisationUnits,
    updateUser,
} from '../../../services/userManagementApi'
import { ApiRevealButton } from './ApiRevealButton'
import { MultiSelectChips } from './MultiSelectChips'

const USER_FIELD_IDS = {
    username: 'user-field-username',
    password: 'user-field-password',
    firstName: 'user-field-firstName',
    surname: 'user-field-surname',
    email: 'user-field-email',
    phoneNumber: 'user-field-phoneNumber',
    roleIds: 'user-field-roleIds',
    groupIds: 'user-field-groupIds',
    organisationUnitIds: 'user-field-organisationUnitIds',
}

function UserFormField({
    id,
    label,
    required,
    error,
    hint,
    children,
    className,
}) {
    const errorId = error ? `${id}-error` : undefined
    return (
        <div className={cn('space-y-1.5', className)}>
            <label htmlFor={id} className={cn(FORM.formLabel, 'capture-font flex items-center gap-1')}>
                <span>{label}</span>
                {required ? (
                    <span className={FORM.fieldRequiredMark} aria-hidden>
                        *
                    </span>
                ) : null}
            </label>
            {children}
            {error ? (
                <p id={errorId} className="capture-font text-xs font-medium text-red-700" role="alert">
                    {error}
                </p>
            ) : hint ? (
                <p className="capture-font text-xs font-normal text-slate-500">{hint}</p>
            ) : null}
        </div>
    )
}

export const UserEditor = ({
    engine,
    canEdit,
    selectedUserId,
    users,
    onSelectUser,
    onUsersChanged,
    onMobileBack,
    onClose,
    embedInSheet = false,
}) => {
    const [form, setForm] = useState(() => emptyUserForm())
    const [loadingDetail, setLoadingDetail] = useState(false)
    const [saving, setSaving] = useState(false)
    const [notice, setNotice] = useState(null)
    const [roles, setRoles] = useState([])
    const [groups, setGroups] = useState([])
    const [ouSearch, setOuSearch] = useState('')
    const [ouResults, setOuResults] = useState([])
    const [ouLabels, setOuLabels] = useState({})
    const [fieldErrors, setFieldErrors] = useState({})

    const isNew = selectedUserId === '__new__'

    const clearFieldError = (key) => {
        setFieldErrors((prev) => {
            if (!prev[key]) return prev
            const next = { ...prev }
            delete next[key]
            return next
        })
    }

    const patchForm = (patch) => {
        setForm((p) => ({ ...p, ...patch }))
        for (const key of Object.keys(patch)) {
            clearFieldError(key)
            if (key === 'roleIds' || key === 'organisationUnitIds') {
                clearFieldError('roleIds')
                clearFieldError('organisationUnitIds')
            }
        }
    }

    const inputInvalidClass = (key) =>
        fieldErrors[key]
            ? 'border-red-400 bg-red-50/50 focus:border-red-500 focus:ring-red-200/80'
            : ''

    const roleOptions = useMemo(
        () =>
            [...roles]
                .sort((a, b) =>
                    String(a.displayName || a.name || '').localeCompare(
                        String(b.displayName || b.name || '')
                    )
                )
                .map((r) => ({
                    value: r.id,
                    label: r.displayName || r.name || r.id,
                })),
        [roles]
    )

    const groupOptions = useMemo(
        () =>
            [...groups]
                .sort((a, b) =>
                    String(a.displayName || a.name || '').localeCompare(
                        String(b.displayName || b.name || '')
                    )
                )
                .map((g) => ({
                    value: g.id,
                    label: g.displayName || g.name || g.id,
                })),
        [groups]
    )

    const ouOptions = useMemo(
        () =>
            ouResults.map((ou) => ({
                value: ou.id,
                label: ou.displayName || ou.path || ou.id,
            })),
        [ouResults]
    )

    const loadLookups = useCallback(async () => {
        try {
            const [r, g] = await Promise.all([
                fetchUserRoles({ engine }),
                fetchUserGroups({ engine }),
            ])
            setRoles(r)
            setGroups(g)
        } catch {
            /* optional */
        }
    }, [engine])

    useEffect(() => {
        loadLookups()
    }, [loadLookups])

    useEffect(() => {
        if (isNew) {
            setForm(emptyUserForm())
            setFieldErrors({})
            return
        }
        if (!selectedUserId) return

        const cached = users.find((u) => u.id === selectedUserId)
        if (cached && !loadingDetail) {
            const next = userToForm(cached)
            setForm(next)
            const labels = {}
            for (const ou of cached.organisationUnits || []) {
                if (ou?.id) labels[ou.id] = ou.displayName || ou.path || ou.id
            }
            setOuLabels((prev) => ({ ...prev, ...labels }))
        }

        let cancelled = false
        ;(async () => {
            setLoadingDetail(true)
            try {
                const user = await fetchUserById({ engine, id: selectedUserId })
                if (cancelled) return
                setForm(userToForm(user))
                const labels = {}
                for (const ou of user?.organisationUnits || []) {
                    if (ou?.id) labels[ou.id] = ou.displayName || ou.path || ou.id
                }
                setOuLabels((prev) => ({ ...prev, ...labels }))
            } catch {
                if (!cancelled && cached) setForm(userToForm(cached))
            } finally {
                if (!cancelled) setLoadingDetail(false)
            }
        })()

        return () => {
            cancelled = true
        }
    }, [selectedUserId, isNew, engine, users])

    useEffect(() => {
        const q = ouSearch.trim()
        if (q.length < 2) {
            setOuResults([])
            return
        }
        const t = setTimeout(async () => {
            try {
                const list = await searchOrganisationUnits({ engine, search: q })
                setOuResults(list)
            } catch {
                setOuResults([])
            }
        }, 300)
        return () => clearTimeout(t)
    }, [ouSearch, engine])

    const showNotice = (type, text) => {
        setNotice({ type, text })
        setTimeout(() => setNotice(null), 5000)
    }

    const handleSave = async () => {
        if (!canEdit) return

        const validation = validateUserForm(form, { isNew })
        if (Object.keys(validation).length > 0) {
            setFieldErrors(validation)
            showNotice('error', i18n.t('Please fix the highlighted fields.'))
            const firstKey = Object.keys(validation)[0]
            const el = document.getElementById(USER_FIELD_IDS[firstKey] || firstKey)
            el?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
            el?.focus?.()
            return
        }

        setFieldErrors({})
        setSaving(true)
        try {
            const payload = formToUserPayload(form, {
                includePassword: isNew || Boolean(form.password?.trim()),
            })
            if (form.id) {
                await updateUser({ engine, id: form.id, payload })
                showNotice('success', i18n.t('User saved'))
            } else {
                const created = await createUser({ engine, payload })
                const newId = created?.uid || created?.response?.uid
                showNotice('success', i18n.t('User created'))
                if (newId) onSelectUser(newId)
            }
            await onUsersChanged?.()
            onClose?.()
        } catch (e) {
            showNotice('error', formatUserManagementError(e, i18n.t('Failed to save user')))
        } finally {
            setSaving(false)
        }
    }

    const selectedOuOptions = useMemo(
        () =>
            (form.organisationUnitIds || []).map((id) => ({
                value: id,
                label: ouLabels[id] || id,
            })),
        [form.organisationUnitIds, ouLabels]
    )

    if (!selectedUserId) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
                <p className="text-sm text-slate-500">
                    {i18n.t('Select a user from the list.')}
                </p>
            </div>
        )
    }

    return (
        <div
            className={cn(
                'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
                embedInSheet ? 'bg-white dark:bg-zinc-950' : 'bg-[#fbfcfd] dark:bg-zinc-950'
            )}
        >
            <div className={ADMIN.editorHeader}>
                {notice && (
                    <div
                        className={cn(
                            'border-b px-3 py-2 text-xs font-medium',
                            notice.type === 'success'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                                : 'border-red-200 bg-red-50 text-red-800'
                        )}
                    >
                        {notice.text}
                    </div>
                )}
                <div className="flex flex-wrap items-center gap-2 px-3 py-2 md:px-4">
                    {onClose ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 shrink-0 px-0"
                            onClick={onClose}
                            aria-label={i18n.t('Close')}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    ) : onMobileBack ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 shrink-0 px-2 md:hidden"
                            onClick={onMobileBack}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                    ) : null}
                    <p className="capture-font min-w-0 flex-1 truncate text-sm font-bold app-text-title">
                        {isNew
                            ? i18n.t('New user')
                            : userDisplayLabel(
                                  users.find((u) => u.id === selectedUserId) || form
                              )}
                    </p>
                    {form.id ? <ApiRevealButton resource="users" id={form.id} /> : null}
                    {canEdit ? (
                        <Button
                            type="button"
                            size="sm"
                            className="ml-auto h-8 gap-1 bg-[var(--app-header-bar-bg)] px-3 text-xs text-white hover:bg-[var(--app-header-bar-bg-hover)]"
                            disabled={saving || loadingDetail}
                            onClick={handleSave}
                        >
                            {saving ? (
                                <Spinner className="h-3.5 w-3.5 border-white/30 border-t-white" />
                            ) : (
                                <>
                                    <Save className="h-3.5 w-3.5" />
                                    {i18n.t('Save')}
                                </>
                            )}
                        </Button>
                    ) : null}
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-3 md:p-5">
                {loadingDetail ? (
                    <div className="flex justify-center py-16">
                        <Spinner className="h-10 w-10 border-slate-200 border-t-[var(--app-header-bar-bg)]" />
                    </div>
                ) : (
                    <div className="mx-auto max-w-2xl space-y-4">
                        {!canEdit ? (
                            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                {i18n.t('You have view-only access. Changes cannot be saved.')}
                            </p>
                        ) : null}

                        <section className={cn(ADMIN.editorSection, 'space-y-4')}>
                            <h3 className={cn(FORM.sectionHeaderPrimary, 'capture-font')}>
                                {i18n.t('Account')}
                            </h3>
                            <UserFormField
                                id={USER_FIELD_IDS.username}
                                label={i18n.t('Username')}
                                required
                                error={
                                    fieldErrors.username
                                        ? i18n.t(fieldErrors.username)
                                        : null
                                }
                            >
                                <Input
                                    id={USER_FIELD_IDS.username}
                                    value={form.username}
                                    onChange={(e) => patchForm({ username: e.target.value })}
                                    className={cn(
                                        'capture-font h-10 text-sm',
                                        inputInvalidClass('username')
                                    )}
                                    disabled={!canEdit || Boolean(form.id)}
                                    aria-invalid={Boolean(fieldErrors.username) || undefined}
                                    aria-describedby={
                                        fieldErrors.username
                                            ? `${USER_FIELD_IDS.username}-error`
                                            : undefined
                                    }
                                />
                            </UserFormField>
                            <UserFormField
                                id={USER_FIELD_IDS.password}
                                label={
                                    isNew
                                        ? i18n.t('Password')
                                        : i18n.t('New password (leave blank to keep)')
                                }
                                required={isNew}
                                error={
                                    fieldErrors.password
                                        ? i18n.t(fieldErrors.password)
                                        : null
                                }
                            >
                                <Input
                                    id={USER_FIELD_IDS.password}
                                    type="password"
                                    value={form.password}
                                    onChange={(e) => patchForm({ password: e.target.value })}
                                    className={cn(
                                        'capture-font h-10 text-sm',
                                        inputInvalidClass('password')
                                    )}
                                    disabled={!canEdit}
                                    autoComplete="new-password"
                                    aria-invalid={Boolean(fieldErrors.password) || undefined}
                                    aria-describedby={
                                        fieldErrors.password
                                            ? `${USER_FIELD_IDS.password}-error`
                                            : undefined
                                    }
                                />
                            </UserFormField>
                            <label className="capture-font flex items-center gap-2 text-sm font-normal text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={form.disabled}
                                    onChange={(e) =>
                                        patchForm({ disabled: e.target.checked })
                                    }
                                    disabled={!canEdit}
                                    className="rounded border-slate-300"
                                />
                                {i18n.t('Disabled')}
                            </label>
                        </section>

                        <section className={cn(ADMIN.editorSection, 'space-y-4')}>
                            <h3 className={cn(FORM.sectionHeaderPrimary, 'capture-font')}>
                                {i18n.t('Profile')}
                            </h3>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <UserFormField
                                    id={USER_FIELD_IDS.firstName}
                                    label={i18n.t('First name')}
                                >
                                    <Input
                                        id={USER_FIELD_IDS.firstName}
                                        value={form.firstName}
                                        onChange={(e) =>
                                            patchForm({ firstName: e.target.value })
                                        }
                                        className="capture-font h-10 text-sm"
                                        disabled={!canEdit}
                                    />
                                </UserFormField>
                                <UserFormField
                                    id={USER_FIELD_IDS.surname}
                                    label={i18n.t('Last name')}
                                >
                                    <Input
                                        id={USER_FIELD_IDS.surname}
                                        value={form.surname}
                                        onChange={(e) =>
                                            patchForm({ surname: e.target.value })
                                        }
                                        className="capture-font h-10 text-sm"
                                        disabled={!canEdit}
                                    />
                                </UserFormField>
                            </div>
                            <UserFormField
                                id={USER_FIELD_IDS.email}
                                label={i18n.t('Email')}
                                error={
                                    fieldErrors.email ? i18n.t(fieldErrors.email) : null
                                }
                            >
                                <Input
                                    id={USER_FIELD_IDS.email}
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => patchForm({ email: e.target.value })}
                                    className={cn(
                                        'capture-font h-10 text-sm',
                                        inputInvalidClass('email')
                                    )}
                                    disabled={!canEdit}
                                    aria-invalid={Boolean(fieldErrors.email) || undefined}
                                    aria-describedby={
                                        fieldErrors.email
                                            ? `${USER_FIELD_IDS.email}-error`
                                            : undefined
                                    }
                                />
                            </UserFormField>
                            <UserFormField
                                id={USER_FIELD_IDS.phoneNumber}
                                label={i18n.t('Phone')}
                            >
                                <Input
                                    id={USER_FIELD_IDS.phoneNumber}
                                    value={form.phoneNumber}
                                    onChange={(e) =>
                                        patchForm({ phoneNumber: e.target.value })
                                    }
                                    className="capture-font h-10 text-sm"
                                    disabled={!canEdit}
                                />
                            </UserFormField>
                        </section>

                        <section
                            className={cn(
                                ADMIN.editorSection,
                                fieldErrors.roleIds &&
                                    'border-red-300 ring-1 ring-red-200/80 dark:border-red-800 dark:ring-red-900/50'
                            )}
                        >
                            <UserFormField
                                id={USER_FIELD_IDS.roleIds}
                                label={i18n.t('User roles')}
                                error={
                                    fieldErrors.roleIds
                                        ? i18n.t(fieldErrors.roleIds)
                                        : null
                                }
                                hint={
                                    isNew
                                        ? i18n.t(
                                              'Required if no organisation unit is assigned.'
                                          )
                                        : null
                                }
                            >
                                <MultiSelectChips
                                    id={USER_FIELD_IDS.roleIds}
                                    options={roleOptions}
                                    value={form.roleIds}
                                    onChange={(roleIds) => patchForm({ roleIds })}
                                    placeholder={i18n.t('Search roles…')}
                                    invalid={Boolean(fieldErrors.roleIds)}
                                    aria-describedby={
                                        fieldErrors.roleIds
                                            ? `${USER_FIELD_IDS.roleIds}-error`
                                            : undefined
                                    }
                                    disabled={!canEdit}
                                />
                            </UserFormField>
                        </section>

                        <section className={ADMIN.editorSection}>
                            <UserFormField
                                id={USER_FIELD_IDS.groupIds}
                                label={i18n.t('User groups')}
                            >
                                <MultiSelectChips
                                    id={USER_FIELD_IDS.groupIds}
                                    options={groupOptions}
                                    value={form.groupIds}
                                    onChange={(groupIds) => patchForm({ groupIds })}
                                    placeholder={i18n.t('Search groups…')}
                                    disabled={!canEdit}
                                />
                            </UserFormField>
                        </section>

                        <section
                            className={cn(
                                ADMIN.editorSection,
                                fieldErrors.organisationUnitIds &&
                                    'border-red-300 ring-1 ring-red-200/80 dark:border-red-800 dark:ring-red-900/50'
                            )}
                        >
                            <UserFormField
                                id={USER_FIELD_IDS.organisationUnitIds}
                                label={i18n.t('Organisation units')}
                                error={
                                    fieldErrors.organisationUnitIds
                                        ? i18n.t(fieldErrors.organisationUnitIds)
                                        : null
                                }
                                hint={
                                    isNew
                                        ? i18n.t(
                                              'Required if no user role is assigned. Search and pick at least one site.'
                                          )
                                        : null
                                }
                            >
                                <MultiSelectChips
                                    id={USER_FIELD_IDS.organisationUnitIds}
                                    options={[...selectedOuOptions, ...ouOptions]}
                                    value={form.organisationUnitIds}
                                    onChange={(organisationUnitIds) => {
                                        patchForm({ organisationUnitIds })
                                        for (const ou of ouResults) {
                                            if (ou?.id) {
                                                setOuLabels((prev) => ({
                                                    ...prev,
                                                    [ou.id]:
                                                        ou.displayName || ou.path || ou.id,
                                                }))
                                            }
                                        }
                                    }}
                                    onSearchChange={setOuSearch}
                                    placeholder={i18n.t(
                                        'Search org units (type 2+ letters)…'
                                    )}
                                    invalid={Boolean(fieldErrors.organisationUnitIds)}
                                    aria-describedby={
                                        fieldErrors.organisationUnitIds
                                            ? `${USER_FIELD_IDS.organisationUnitIds}-error`
                                            : undefined
                                    }
                                    disabled={!canEdit}
                                />
                            </UserFormField>
                        </section>
                    </div>
                )}
            </div>
        </div>
    )
}
