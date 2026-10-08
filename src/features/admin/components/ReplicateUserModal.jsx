import React, { useEffect, useMemo, useState } from 'react'
import i18n from '@dhis2/d2-i18n'
import { Save, X } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Spinner } from '../../../components/ui/spinner'
import { createPortal } from 'react-dom'
import { cn } from '../../../lib/utils'
import { FORM } from '../../../lib/formUi'
import { ADMIN } from '../adminUi'
import {
    formToUserPayload,
    userDisplayLabel,
    userToForm,
} from '../../../lib/userForm'
import {
    createUser,
    formatUserManagementError,
    searchOrganisationUnits,
} from '../../../services/userManagementApi'
import { MultiSelectChips } from './MultiSelectChips'

const USER_FIELD_IDS = {
    username: 'rep-user-field-username',
    password: 'rep-user-field-password',
    organisationUnitIds: 'rep-user-field-organisationUnitIds',
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

export const ReplicateUserModal = ({
    open,
    engine,
    userToReplicate,
    onClose,
    onReplicated,
}) => {
    const [form, setForm] = useState(null)
    const [saving, setSaving] = useState(false)
    const [notice, setNotice] = useState(null)
    const [ouSearch, setOuSearch] = useState('')
    const [ouResults, setOuResults] = useState([])
    const [ouLabels, setOuLabels] = useState({})
    const [fieldErrors, setFieldErrors] = useState({})

    useEffect(() => {
        if (open && userToReplicate) {
            const f = userToForm(userToReplicate)
            f.id = ''
            f.username = ''
            f.password = ''
            f.organisationUnitIds = []
            setForm(f)
            setFieldErrors({})
            setNotice(null)
            setOuSearch('')
            setOuResults([])
            setOuLabels({})
        }
    }, [open, userToReplicate])

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
        }
    }

    const inputInvalidClass = (key) =>
        fieldErrors[key]
            ? 'border-red-400 bg-red-50/50 focus:border-red-500 focus:ring-red-200/80'
            : ''

    const selectedOuOptions = useMemo(
        () =>
            (form?.organisationUnitIds || []).map((id) => ({
                value: id,
                label: ouLabels[id] || id,
            })),
        [form?.organisationUnitIds, ouLabels]
    )

    const ouOptions = useMemo(
        () =>
            ouResults
                .filter((ou) => !(form?.organisationUnitIds || []).includes(ou.id))
                .map((ou) => ({
                    value: ou.id,
                    label: ou.displayName || ou.path || ou.id,
                })),
        [ouResults, form?.organisationUnitIds]
    )

    const handleSave = async () => {
        const errors = {}
        if (!form.username?.trim()) errors.username = i18n.t('Username is required.')
        if (!form.password?.trim()) errors.password = i18n.t('Password is required.')
        if ((form.organisationUnitIds || []).length === 0) {
            errors.organisationUnitIds = i18n.t('Assign at least one organisation unit.')
        }

        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors)
            return
        }

        setSaving(true)
        try {
            const payload = formToUserPayload(form, { includePassword: true })
            await createUser({ engine, payload })
            onReplicated?.()
        } catch (e) {
            showNotice('error', formatUserManagementError(e, i18n.t('Failed to replicate user')))
            setSaving(false)
        }
    }

    if (!open || !form || typeof document === 'undefined') return null

    return createPortal(
        <div
            className="modal-backdrop fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="modal-panel flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl dark:bg-zinc-950 dark:border-zinc-800"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="replicate-modal-title"
            >
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                    <h2 id="replicate-modal-title" className="capture-font text-base font-semibold app-text-title">
                        {i18n.t('Replicate User: {{name}}', { name: userDisplayLabel(userToReplicate) })}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                        aria-label={i18n.t('Close')}
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                {notice && (
                    <div
                        className={cn(
                            'border-b px-4 py-2 text-xs font-medium',
                            notice.type === 'success'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                                : 'border-red-200 bg-red-50 text-red-800'
                        )}
                    >
                        {notice.text}
                    </div>
                )}
                <div className="flex flex-col min-h-0 flex-1 overflow-auto gap-5 p-4 md:p-5">
                    <UserFormField
                        id={USER_FIELD_IDS.username}
                        label={i18n.t('New Username')}
                        required
                        error={fieldErrors.username}
                    >
                        <Input
                            id={USER_FIELD_IDS.username}
                            value={form.username}
                            onChange={(e) => patchForm({ username: e.target.value })}
                            className={cn('capture-font h-10 text-sm', inputInvalidClass('username'))}
                            disabled={saving}
                            aria-invalid={Boolean(fieldErrors.username)}
                        />
                    </UserFormField>

                    <UserFormField
                        id={USER_FIELD_IDS.password}
                        label={i18n.t('New Password')}
                        required
                        error={fieldErrors.password}
                    >
                        <Input
                            id={USER_FIELD_IDS.password}
                            type="password"
                            value={form.password}
                            onChange={(e) => patchForm({ password: e.target.value })}
                            className={cn('capture-font h-10 text-sm', inputInvalidClass('password'))}
                            disabled={saving}
                            autoComplete="new-password"
                            aria-invalid={Boolean(fieldErrors.password)}
                        />
                    </UserFormField>

                    <UserFormField
                        id={USER_FIELD_IDS.organisationUnitIds}
                        label={i18n.t('Organisation units')}
                        required
                        error={fieldErrors.organisationUnitIds}
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
                                            [ou.id]: ou.displayName || ou.path || ou.id,
                                        }))
                                    }
                                }
                            }}
                            onSearchChange={setOuSearch}
                            placeholder={i18n.t('Search org units (type 2+ letters)…')}
                            invalid={Boolean(fieldErrors.organisationUnitIds)}
                            disabled={saving}
                        />
                    </UserFormField>
                </div>
                <div className="flex justify-end gap-3 border-t border-slate-200 p-4 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30">
                    <Button variant="outline" type="button" onClick={onClose} disabled={saving}>
                        {i18n.t('Cancel')}
                    </Button>
                    <Button
                        type="button"
                        className="min-w-[100px] gap-2 bg-[var(--app-header-bar-bg)] text-white hover:bg-[var(--app-header-bar-bg-hover)]"
                        disabled={saving}
                        onClick={handleSave}
                    >
                        {saving ? <Spinner className="h-4 w-4 border-white/30 border-t-white" /> : <Save className="h-4 w-4" />}
                        {i18n.t('Replicate')}
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    )
}
