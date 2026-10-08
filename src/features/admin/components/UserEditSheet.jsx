import React from 'react'
import i18n from '@dhis2/d2-i18n'
import { cn } from '../../../lib/utils'
import { ADMIN } from '../adminUi'
import { UserEditor } from './UserEditor'

export const UserEditSheet = ({
    open,
    userId,
    engine,
    canEdit,
    users,
    onClose,
    onUsersChanged,
}) => {
    if (!open || !userId) return null

    return (
        <>
            <button
                type="button"
                className="fixed inset-0 z-40 cursor-default bg-slate-900/40"
                aria-label={i18n.t('Close')}
                onClick={onClose}
            />
            <aside
                className={cn(
                    'fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col',
                    ADMIN.sheet
                )}
                role="dialog"
                aria-modal="true"
            >
                <UserEditor
                    engine={engine}
                    canEdit={canEdit}
                    selectedUserId={userId}
                    users={users}
                    onSelectUser={() => {}}
                    onUsersChanged={onUsersChanged}
                    onClose={onClose}
                    embedInSheet
                />
            </aside>
        </>
    )
}
