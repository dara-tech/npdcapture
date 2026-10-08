import React, { useEffect, useMemo, useState } from 'react'
import i18n from '@dhis2/d2-i18n'
import { MixerHorizontalIcon } from '@radix-ui/react-icons'
import { Plus, Search } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Select } from '../../../components/ui/select'
import { fetchUserGroups, fetchUserRoles } from '../../../services/userManagementApi'
import { cn } from '../../../lib/utils'
import { OrgUnitSelect } from '../../context/OrgUnitSelect'
import { ADMIN } from '../adminUi'

export const FILTER_ALL = '__all__'

const filterSelectClass = cn(ADMIN.control, 'min-w-[7rem] flex-1 md:flex-none md:w-[7.25rem] shrink-0')

const orgFilterButtonClass = cn(ADMIN.control, 'flex min-w-[8rem] flex-1 md:flex-none md:w-[9rem] shrink-0 items-center px-3 text-left')

export const UserManagementToolbar = ({
    engine,
    search,
    onSearchChange,
    filterOrgUnitId,
    onFilterOrgUnitIdChange,
    filterStatus,
    onFilterStatusChange,
    filterRoleId,
    onFilterRoleIdChange,
    filterGroupId,
    onFilterGroupIdChange,
    canEdit,
    onAddUser,
    onExport,
    onImport,
    onConfigureColumns,
}) => {
    const [roles, setRoles] = useState([])
    const [groups, setGroups] = useState([])

    useEffect(() => {
        if (!engine) return
        ;(async () => {
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
        })()
    }, [engine])

    const statusOptions = useMemo(
        () => [
            { value: FILTER_ALL, label: i18n.t('Status') },
            { value: 'active', label: i18n.t('Active') },
            { value: 'disabled', label: i18n.t('Disabled') },
        ],
        []
    )

    const roleOptions = useMemo(
        () => [
            { value: FILTER_ALL, label: i18n.t('Roles') },
            ...[...roles]
                .sort((a, b) =>
                    String(a.displayName || a.name || '').localeCompare(
                        String(b.displayName || b.name || '')
                    )
                )
                .map((r) => ({
                    value: r.id,
                    label: r.displayName || r.name || r.id,
                })),
        ],
        [roles]
    )

    const groupOptions = useMemo(
        () => [
            { value: FILTER_ALL, label: i18n.t('Groups') },
            ...[...groups]
                .sort((a, b) =>
                    String(a.displayName || a.name || '').localeCompare(
                        String(b.displayName || b.name || '')
                    )
                )
                .map((g) => ({
                    value: g.id,
                    label: g.displayName || g.name || g.id,
                })),
        ],
        [groups]
    )

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className={ADMIN.pageTitle}>
                    {i18n.t('User Management')}
                </h1>
                {canEdit ? (
                    <Button
                        type="button"
                        className="h-8 gap-1.5 rounded-md bg-[var(--app-header-bar-bg)] px-3 text-xs font-semibold text-white hover:bg-[var(--app-header-bar-bg-hover)]"
                        onClick={onAddUser}
                    >
                        <Plus className="h-3.5 w-3.5" />
                        {i18n.t('ADD USER')}
                    </Button>
                ) : null}
            </div>

            <div className={ADMIN.toolbarShell}>
                <OrgUnitSelect
                    value={filterOrgUnitId || ''}
                    onChange={onFilterOrgUnitIdChange}
                    allowEmpty
                    emptyLabel={i18n.t('Org')}
                    buttonClassName={orgFilterButtonClass}
                />
                <Select
                    value={filterStatus || FILTER_ALL}
                    onValueChange={onFilterStatusChange}
                    options={statusOptions}
                    placeholder={i18n.t('Status')}
                    className={filterSelectClass}
                />
                <Select
                    value={filterGroupId || FILTER_ALL}
                    onValueChange={onFilterGroupIdChange}
                    options={groupOptions}
                    placeholder={i18n.t('Groups')}
                    searchPlaceholder={i18n.t('Search groups…')}
                    className={filterSelectClass}
                />
                <Select
                    value={filterRoleId || FILTER_ALL}
                    onValueChange={onFilterRoleIdChange}
                    options={roleOptions}
                    placeholder={i18n.t('Roles')}
                    searchPlaceholder={i18n.t('Search roles…')}
                    className={filterSelectClass}
                />

                <div className="relative min-w-[10rem] flex-1 shrink">
                    <Search
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                        aria-hidden
                    />
                    <Input
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder={i18n.t('Search users')}
                        className={ADMIN.searchInput}
                    />
                </div>

                {canEdit && onImport ? (
                    <button
                        type="button"
                        onClick={onImport}
                        className="shrink-0 whitespace-nowrap px-2 py-2 text-sm font-semibold text-[var(--app-header-bar-bg)] hover:underline"
                    >
                        {i18n.t('Import users')}
                    </button>
                ) : null}
                <button
                    type="button"
                    onClick={onExport}
                    className="shrink-0 whitespace-nowrap px-2 py-2 text-sm font-semibold text-[var(--app-header-bar-bg)] hover:underline"
                >
                    {i18n.t('Export users')}
                </button>
                {onConfigureColumns ? (
                    <button
                        type="button"
                        onClick={onConfigureColumns}
                        className={ADMIN.iconBtn}
                        title={i18n.t('Configure Columns')}
                        aria-label={i18n.t('Configure Columns')}
                    >
                        <MixerHorizontalIcon className="h-4 w-4 shrink-0" aria-hidden />
                    </button>
                ) : null}
            </div>
        </div>
    )
}
