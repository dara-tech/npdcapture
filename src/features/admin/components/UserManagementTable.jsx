import React, { useEffect, useMemo, useRef } from 'react'
import i18n from '@dhis2/d2-i18n'
import {
    Calendar,
    ChevronDown,
    ChevronRight,
    Copy,
    Mail,
    MapPin,
    MoreHorizontal,
    Pencil,
    Phone,
    Trash2,
    Users,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/ui/popover'
import { Spinner } from '../../../components/ui/spinner'
import { cn } from '../../../lib/utils'
import { userDisplayLabel } from '../../../lib/userForm'
import { ADMIN } from '../adminUi'
import {
    getUserAttributeDisplayValue,
    getUserAttributeLabel,
    getUserScalarFieldValue,
    normaliseUserAttributeValues,
    parseUserAttributeColumnId,
} from '../lib/userAttributes'
import {
    avatarTone,
    formatLastLogin,
    joinMetaNames,
    userInitials,
} from '../lib/userTableUtils'

const FIXED_COLUMN_COUNT = 5

const StatusBadge = ({ disabled }) => (
    <span
        className={cn(
            'inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
            disabled
                ? 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
        )}
    >
        {disabled ? i18n.t('Disabled') : i18n.t('Active')}
    </span>
)

const UserAvatar = ({ user }) => {
    const initials = userInitials(user)
    return (
        <span
            className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                avatarTone(user?.id || initials)
            )}
        >
            {initials}
        </span>
    )
}

const joinList = (items, getLabel) => {
    const labels = (items || []).map(getLabel).filter(Boolean)
    return labels.length ? labels.join(' · ') : '—'
}

const ExpandedDetails = ({ user, attributeDefMap }) => (
    <div className="border-t border-[var(--app-header-bar-bg)]/20 bg-app-tint-8/50 dark:bg-zinc-900/50">
        <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-left">
                <thead>
                    <tr className="border-b border-slate-200/60 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:border-[color:var(--app-border)] dark:text-zinc-400">
                    <th className="w-[22%] px-4 py-2.5 align-bottom font-bold">
                        <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                            {i18n.t('Organisation units')}
                        </span>
                    </th>
                    <th className="w-[32%] px-4 py-2.5 align-bottom font-bold">
                        <span className="inline-flex items-center gap-1.5">
                            <Users className="h-3 w-3 shrink-0" aria-hidden />
                            {i18n.t('User roles')}
                        </span>
                    </th>
                    <th className="w-[26%] px-4 py-2.5 align-bottom font-bold">
                        <span className="inline-flex items-center gap-1.5">
                            <Users className="h-3 w-3 shrink-0" aria-hidden />
                            {i18n.t('User groups')}
                        </span>
                    </th>
                    <th className="w-[20%] px-4 py-2.5 align-bottom font-bold">
                        <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 shrink-0" aria-hidden />
                            {i18n.t('Last login')}
                        </span>
                    </th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td className="px-4 py-3 align-top text-xs leading-relaxed text-slate-700 dark:text-zinc-300">
                        {joinList(user.organisationUnits, (ou) => ou.displayName || ou.path)}
                    </td>
                    <td className="px-4 py-3 align-top text-xs leading-relaxed text-slate-700 dark:text-zinc-300">
                        {joinList(user.userRoles, (r) => r.displayName || r.name)}
                    </td>
                    <td className="px-4 py-3 align-top text-xs leading-relaxed text-slate-700 dark:text-zinc-300">
                        {joinList(user.userGroups, (g) => g.displayName || g.name)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-slate-700">
                        {formatLastLogin(user)}
                    </td>
                </tr>
            </tbody>
        </table>
        </div>
        {normaliseUserAttributeValues(user).length > 0 ? (
            <div className="border-t border-slate-200/60 px-4 pb-3 pt-3 dark:border-[color:var(--app-border)]">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                    {i18n.t('User attributes')}
                </p>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                    {normaliseUserAttributeValues(user).map(({ attributeId, attribute }) => {
                        const def = attributeDefMap?.get?.(attributeId) || attribute
                        return (
                        <div key={attributeId}>
                            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                {getUserAttributeLabel(def)}
                            </dt>
                            <dd className="mt-0.5 text-xs text-slate-800 dark:text-zinc-200">
                                {getUserAttributeDisplayValue(user, attributeId, attributeDefMap) || '—'}
                            </dd>
                        </div>
                        )
                    })}
                </dl>
            </div>
        ) : null}
    </div>
)

const renderOptionalCell = (colId, user, attributeDefMap) => {
    switch (colId) {
        case 'roles':
            return (
                <span className="block truncate text-sm text-slate-700 dark:text-zinc-300">
                    {joinMetaNames(user.userRoles, 2)}
                </span>
            )
        case 'groups':
            return (
                <span className="block truncate text-sm text-slate-700 dark:text-zinc-300">
                    {joinMetaNames(user.userGroups, 2)}
                </span>
            )
        case 'email':
            return user.email ? (
                <span className="inline-flex min-w-0 max-w-full items-center gap-1 truncate text-sm text-slate-700">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">{user.email}</span>
                </span>
            ) : (
                '—'
            )
        case 'phone':
            return user.phoneNumber ? (
                <span className="inline-flex items-center gap-1 text-sm text-slate-700">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    {user.phoneNumber}
                </span>
            ) : (
                '—'
            )
        case 'gender':
        case 'jobTitle':
        case 'introduction':
        case 'code': {
            const text = getUserScalarFieldValue(user, colId)
            return (
                <span className="block truncate text-sm text-slate-700 dark:text-zinc-300">
                    {text || '—'}
                </span>
            )
        }
        case 'lastLogin': {
            const text = formatLastLogin(user)
            return (
                <span className="block truncate text-sm text-slate-700 dark:text-zinc-300">
                    {text || '—'}
                </span>
            )
        }
        default: {
            const attributeId = parseUserAttributeColumnId(colId)
            if (attributeId) {
                const text = getUserAttributeDisplayValue(user, attributeId, attributeDefMap)
                return (
                    <span className="block truncate text-sm text-slate-700 dark:text-zinc-300">
                        {text || '—'}
                    </span>
                )
            }
            return '—'
        }
    }
}

export const UserManagementTable = ({
    users,
    loading,
    error,
    canEdit,
    selectedIds,
    expandedId,
    visibleColumns = [],
    attributeDefMap,
    onToggleSelect,
    onToggleSelectAll,
    onToggleExpand,
    onEdit,
    onReplicate,
    onDelete,
    hasMore,
    loadingMore,
    onLoadMore,
}) => {
    const allSelected = users.length > 0 && selectedIds.size === users.length
    const someSelected = selectedIds.size > 0

    const colCount = FIXED_COLUMN_COUNT + visibleColumns.length

    const rows = useMemo(() => users, [users])
    const scrollRef = useRef(null)
    const sentinelRef = useRef(null)

    useEffect(() => {
        if (!hasMore || loading || loadingMore || !onLoadMore) return
        const root = scrollRef.current
        const target = sentinelRef.current
        if (!root || !target) return

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) onLoadMore()
            },
            { root, rootMargin: '160px', threshold: 0 }
        )
        observer.observe(target)
        return () => observer.disconnect()
    }, [hasMore, loading, loadingMore, onLoadMore, users.length])

    return (
        <div className={ADMIN.contentShell}>
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-auto custom-scrollbar">
                <table className="w-full min-w-[800px] table-fixed border-collapse text-left">
                    <thead className={ADMIN.tableThead}>
                        <tr className={cn(ADMIN.tableHeaderRow, 'text-sm font-semibold leading-snug')}>
                            <th className="w-10 px-3 py-3">
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    ref={(el) => {
                                        if (el) el.indeterminate = someSelected && !allSelected
                                    }}
                                    onChange={onToggleSelectAll}
                                    className="rounded border-slate-300"
                                    aria-label={i18n.t('Select all')}
                                />
                            </th>
                            <th className="w-10 px-1 py-3" />
                            <th className="min-w-0 px-3 py-3">{i18n.t('Name')}</th>
                            {visibleColumns.map((col) => (
                                <th key={col.id} className="min-w-0 px-3 py-3">
                                    {col.label}
                                </th>
                            ))}
                            <th className="w-[5.5rem] px-3 py-3">{i18n.t('Status')}</th>
                            <th className="w-24 px-3 py-3 text-right">{i18n.t('Edit')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && rows.length === 0 ? (
                            <tr>
                                <td colSpan={colCount} className="py-16 text-center">
                                    <Spinner className="mx-auto h-8 w-8 border-slate-200 border-t-[var(--app-header-bar-bg)]" />
                                </td>
                            </tr>
                        ) : error ? (
                            <tr>
                                <td colSpan={colCount} className="py-8 text-center text-sm text-red-600">
                                    {error}
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={colCount} className="py-16 text-center text-sm app-text-meta">
                                    {i18n.t('No users found.')}
                                </td>
                            </tr>
                        ) : (
                            rows.map((user) => {
                                const selected = selectedIds.has(user.id)
                                const expanded = expandedId === user.id
                                const username = user?.userCredentials?.username
                                return (
                                    <React.Fragment key={user.id}>
                                        <tr
                                            className={cn(
                                                'border-b border-slate-100 transition-colors dark:border-[color:var(--app-border)]',
                                                selected && 'bg-app-tint-8 dark:bg-zinc-900/80',
                                                expanded && 'bg-app-tint-8/80 dark:bg-zinc-900/60'
                                            )}
                                        >
                                            <td className="px-3 py-3 align-middle">
                                                <input
                                                    type="checkbox"
                                                    checked={selected}
                                                    onChange={() => onToggleSelect(user.id)}
                                                    className="rounded border-slate-300"
                                                    aria-label={i18n.t('Select user')}
                                                />
                                            </td>
                                            <td className="px-1 py-3 align-middle">
                                                <button
                                                    type="button"
                                                    onClick={() => onToggleExpand(user.id)}
                                                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                                                    aria-expanded={expanded}
                                                >
                                                    {expanded ? (
                                                        <ChevronDown className="h-4 w-4" />
                                                    ) : (
                                                        <ChevronRight className="h-4 w-4" />
                                                    )}
                                                </button>
                                            </td>
                                            <td className="min-w-0 px-3 py-3 align-middle">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <UserAvatar user={user} />
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold app-text-title">
                                                            {userDisplayLabel(user)}
                                                        </p>
                                                        {username ? (
                                                            <p className="truncate text-xs app-text-meta">
                                                                {username}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </td>
                                            {visibleColumns.map((col) => (
                                                <td
                                                    key={col.id}
                                                    className="min-w-0 px-3 py-3 align-middle"
                                                >
                                                    {renderOptionalCell(col.id, user, attributeDefMap)}
                                                </td>
                                            ))}
                                            <td className="px-3 py-3 align-middle">
                                                <StatusBadge disabled={user.disabled} />
                                            </td>
                                            <td className="px-3 py-3 align-middle">
                                                <div className="flex justify-end">
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <button
                                                                type="button"
                                                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                                                                title={i18n.t('More options')}
                                                            >
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </button>
                                                        </PopoverTrigger>
                                                        <PopoverContent align="end" className="w-48 p-1">
                                                            <div className="flex flex-col">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onReplicate?.(user)}
                                                                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                                                >
                                                                    <Copy className="h-4 w-4 text-slate-500" />
                                                                    {i18n.t('Replicate user')}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onEdit(user.id)}
                                                                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                                                >
                                                                    <Pencil className="h-4 w-4 text-slate-500" />
                                                                    {i18n.t('Edit user')}
                                                                </button>
                                                                {canEdit ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => onDelete(user)}
                                                                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                        {i18n.t('Disable user')}
                                                                    </button>
                                                                ) : null}
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                </div>
                                            </td>
                                        </tr>
                                        {expanded ? (
                                            <tr>
                                                <td colSpan={colCount} className="p-0">
                                                    <ExpandedDetails
                                                        user={user}
                                                        attributeDefMap={attributeDefMap}
                                                    />
                                                </td>
                                            </tr>
                                        ) : null}
                                    </React.Fragment>
                                )
                            })
                        )}
                    </tbody>
                </table>
                {rows.length > 0 && (hasMore || loadingMore) ? (
                    <div
                        ref={sentinelRef}
                        className="flex items-center justify-center border-t border-slate-100 py-4 dark:border-[color:var(--app-border)]"
                        aria-hidden={!loadingMore}
                    >
                        {loadingMore ? (
                            <Spinner className="h-6 w-6 border-slate-200 border-t-[var(--app-header-bar-bg)]" />
                        ) : (
                            <span className="h-1 w-1" />
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    )
}
