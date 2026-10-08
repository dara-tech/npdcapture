import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import i18n from '@dhis2/d2-i18n'
import { useDataEngine } from '@dhis2/app-runtime'
import { userDisplayLabel } from '../../lib/userForm'
import {
    disableUser,
    fetchUserAttributeDefinitions,
    fetchUsers,
    formatUserManagementError,
} from '../../services/userManagementApi'
import { exportUsersCsv } from './lib/exportUsersCsv'
import { UserEditSheet } from './components/UserEditSheet'
import {
    FILTER_ALL,
    UserManagementToolbar,
} from './components/UserManagementToolbar'
import { UserManagementTable } from './components/UserManagementTable'
import { ImportUsersModal } from './components/ImportUsersModal'
import { ReplicateUserModal } from './components/ReplicateUserModal'
import { ConfigColumnsListModal } from '../../components/ConfigColumnsListModal'
import { useListColumnConfig } from '../../hooks/useListColumnConfig'
import { buildUserAttributeDefMap } from './lib/userAttributes'
import {
    buildUserTableColumns,
    DEFAULT_USER_VISIBLE_COLUMN_IDS,
    USER_COLUMN_STORAGE_KEY,
} from './lib/userTableColumns'

const applyClientFilters = (users, { filterStatus, filterRoleId, filterGroupId }) => {
    let list = [...users]
    if (filterStatus === 'active') {
        list = list.filter((u) => !u.disabled)
    } else if (filterStatus === 'disabled') {
        list = list.filter((u) => Boolean(u.disabled))
    }
    if (filterRoleId) {
        list = list.filter((u) =>
            (u.userRoles || []).some((r) => r.id === filterRoleId)
        )
    }
    if (filterGroupId) {
        list = list.filter((u) =>
            (u.userGroups || []).some((g) => g.id === filterGroupId)
        )
    }
    return list
}

export const UserManagementPage = ({ canEdit }) => {
    const engine = useDataEngine()
    const [users, setUsers] = useState([])
    const [pager, setPager] = useState(null)
    const [loadingInitial, setLoadingInitial] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [listError, setListError] = useState('')
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [filterOrgUnitId, setFilterOrgUnitId] = useState('')
    const [filterStatus, setFilterStatus] = useState('')
    const [filterRoleId, setFilterRoleId] = useState('')
    const [filterGroupId, setFilterGroupId] = useState('')
    const [page, setPage] = useState(1)
    const [selectedIds, setSelectedIds] = useState(() => new Set())
    const [expandedId, setExpandedId] = useState('')
    const [sheetUserId, setSheetUserId] = useState('')
    const [replicateUser, setReplicateUser] = useState(null)
    const [importOpen, setImportOpen] = useState(false)
    const [userAttributeDefs, setUserAttributeDefs] = useState([])
    const fetchingMoreRef = useRef(false)

    const userTableColumns = useMemo(
        () => buildUserTableColumns(userAttributeDefs),
        [userAttributeDefs]
    )
    const userAttributeDefMap = useMemo(
        () => buildUserAttributeDefMap(userAttributeDefs),
        [userAttributeDefs]
    )
    const columnConfig = useListColumnConfig({
        columns: userTableColumns,
        defaultVisibleIds: DEFAULT_USER_VISIBLE_COLUMN_IDS,
        storageKey: USER_COLUMN_STORAGE_KEY,
    })

    useEffect(() => {
        if (!engine) return
        let cancelled = false
        ;(async () => {
            try {
                const defs = await fetchUserAttributeDefinitions({ engine })
                if (!cancelled) setUserAttributeDefs(defs)
            } catch {
                if (!cancelled) setUserAttributeDefs([])
            }
        })()
        return () => {
            cancelled = true
        }
    }, [engine])

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 350)
        return () => clearTimeout(t)
    }, [search])

    const loadUsers = useCallback(
        async (opts = {}) => {
            const nextPage = opts.page ?? 1
            const append = Boolean(opts.append)
            if (append) setLoadingMore(true)
            else setLoadingInitial(true)
            setListError('')
            try {
                const { users: list, pager: pg } = await fetchUsers({
                    engine,
                    search: debouncedSearch,
                    organisationUnitId: filterOrgUnitId,
                    page: nextPage,
                })
                setUsers((prev) => (append ? [...prev, ...list] : list))
                setPager(pg)
                setPage(nextPage)
                if (!append) {
                    setSelectedIds(new Set())
                }
            } catch (e) {
                setListError(e?.message || i18n.t('Failed to load users'))
                if (!append) setUsers([])
            } finally {
                if (append) setLoadingMore(false)
                else setLoadingInitial(false)
            }
        },
        [engine, debouncedSearch, filterOrgUnitId]
    )

    const loadMore = useCallback(async () => {
        if (loadingInitial || loadingMore || fetchingMoreRef.current) return
        if (!pager || page >= pager.pageCount) return
        fetchingMoreRef.current = true
        try {
            await loadUsers({ page: page + 1, append: true })
        } finally {
            fetchingMoreRef.current = false
        }
    }, [loadingInitial, loadingMore, pager, page, loadUsers])

    useEffect(() => {
        loadUsers({ page: 1 })
    }, [loadUsers])

    const displayedUsers = useMemo(
        () =>
            applyClientFilters(users, {
                filterStatus,
                filterRoleId,
                filterGroupId,
            }),
        [users, filterStatus, filterRoleId, filterGroupId]
    )

    const hasMore = pager ? page < pager.pageCount : false

    const normalizeFilter = (value, setter) => {
        setter(value === FILTER_ALL ? '' : value)
    }

    const toggleSelect = (id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleSelectAll = () => {
        setSelectedIds((prev) => {
            if (prev.size === displayedUsers.length) return new Set()
            return new Set(displayedUsers.map((u) => u.id))
        })
    }

    const toggleExpand = (id) => {
        setExpandedId((prev) => (prev === id ? '' : id))
    }

    const openCreate = () => {
        if (!canEdit) return
        setSheetUserId('__new__')
    }

    const openEdit = (id) => {
        setSheetUserId(id)
    }

    const handleDelete = async (user) => {
        if (!canEdit) return
        const label = userDisplayLabel(user)
        if (!window.confirm(i18n.t('Disable user "{{name}}"?', { name: label }))) return
        try {
            await disableUser({ engine, id: user.id })
            await loadUsers({ page: 1 })
        } catch (e) {
            window.alert(formatUserManagementError(e, i18n.t('Failed to disable user')))
        }
    }

    const handleSaved = async () => {
        await loadUsers({ page: 1 })
        setSheetUserId('')
    }

    const handleExport = () => {
        const toExport =
            selectedIds.size > 0
                ? displayedUsers.filter((u) => selectedIds.has(u.id))
                : displayedUsers
        exportUsersCsv(toExport, 'users.csv', userAttributeDefs)
    }

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
            <div className="shrink-0">
                <UserManagementToolbar
                    engine={engine}
                    search={search}
                    onSearchChange={setSearch}
                    filterOrgUnitId={filterOrgUnitId}
                    onFilterOrgUnitIdChange={setFilterOrgUnitId}
                    filterStatus={filterStatus}
                    onFilterStatusChange={(v) => normalizeFilter(v, setFilterStatus)}
                    filterRoleId={filterRoleId}
                    onFilterRoleIdChange={(v) => normalizeFilter(v, setFilterRoleId)}
                    filterGroupId={filterGroupId}
                    onFilterGroupIdChange={(v) => normalizeFilter(v, setFilterGroupId)}
                    canEdit={canEdit}
                    onAddUser={openCreate}
                    onExport={handleExport}
                    onImport={() => setImportOpen(true)}
                    onConfigureColumns={columnConfig.openColumnsModal}
                />
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
                {selectedIds.size > 0 ? (
                    <p className="mb-2 text-xs font-medium text-slate-600">
                        {i18n.t('{{count}} selected', { count: selectedIds.size })}
                    </p>
                ) : null}

                <UserManagementTable
                    users={displayedUsers}
                    loading={loadingInitial}
                    error={listError}
                    canEdit={canEdit}
                    visibleColumns={columnConfig.visibleColumns}
                    attributeDefMap={userAttributeDefMap}
                    selectedIds={selectedIds}
                    expandedId={expandedId}
                    onToggleSelect={toggleSelect}
                    onToggleSelectAll={toggleSelectAll}
                    onToggleExpand={toggleExpand}
                    onEdit={openEdit}
                    onReplicate={setReplicateUser}
                    onDelete={handleDelete}
                    hasMore={hasMore}
                    loadingMore={loadingMore}
                    onLoadMore={loadMore}
                />
            </div>

            <UserEditSheet
                open={Boolean(sheetUserId)}
                userId={sheetUserId}
                engine={engine}
                canEdit={canEdit}
                users={users}
                onClose={() => setSheetUserId('')}
                onUsersChanged={handleSaved}
            />

            <ImportUsersModal
                open={importOpen}
                engine={engine}
                onClose={() => setImportOpen(false)}
                onImported={() => loadUsers({ page: 1 })}
            />

            <ReplicateUserModal
                open={Boolean(replicateUser)}
                engine={engine}
                userToReplicate={replicateUser}
                onClose={() => setReplicateUser(null)}
                onReplicated={() => {
                    setReplicateUser(null)
                    loadUsers({ page: 1 })
                }}
            />

            <ConfigColumnsListModal
                open={columnConfig.modalOpen}
                onClose={columnConfig.closeColumnsModal}
                configColumns={columnConfig.configColumns}
                draftVisibleIds={columnConfig.draftVisibleIds}
                draggedIndex={columnConfig.draggedIndex}
                toggleDraftColumn={columnConfig.toggleDraftColumn}
                handleDragStart={columnConfig.handleDragStart}
                handleDragOver={columnConfig.handleDragOver}
                handleDragEnd={columnConfig.handleDragEnd}
                handleResetColumns={columnConfig.handleResetColumns}
                onApply={columnConfig.applyColumnChanges}
                description={i18n.t(
                    'Choose which columns appear in the user list. Custom user attributes from DHIS2 are listed below built-in fields. Name, status, and actions are always shown.'
                )}
            />
        </div>
    )
}
