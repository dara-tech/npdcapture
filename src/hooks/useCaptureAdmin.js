import { useDataQuery } from '@dhis2/app-runtime'
import {
    canEditUsers,
    isCaptureAdmin,
    isDataEntryExperience,
    isSuperuser,
    isUserAdmin,
    showAdminNavigation,
    userHasDataEntryRole,
} from '../lib/captureAdmin'

const ME_AUTHORITIES_QUERY = {
    me: {
        resource: 'me',
        params: {
            fields: [
                'id',
                'username',
                'authorities',
                'userRoles[id,name,displayName,code]',
                'userCredentials[userRoles[id,name,displayName,code]]',
            ],
        },
    },
}

/** DHIS2 2.40 may return roles on `me` or under `userCredentials`. */
export const resolveMeUserRoles = (me) => {
    if (!me || typeof me !== 'object') return []
    const direct = me.userRoles
    if (Array.isArray(direct) && direct.length) return direct
    const nested = me.userCredentials?.userRoles
    if (Array.isArray(nested) && nested.length) return nested
    return []
}

export const useCaptureAdmin = () => {
    const { loading, error, data } = useDataQuery(ME_AUTHORITIES_QUERY)
    const me = data?.me
    const authorities = me?.authorities || []
    const userRoles = resolveMeUserRoles(me)
    const navigationOptions = {
        userRoles,
        dataEntryRoleNames: '',
        captureRoleIds: [],
    }

    return {
        loading,
        error,
        authorities,
        userRoles,
        me,
        currentUsername: me?.username || '',
        isCaptureAdmin: isCaptureAdmin(authorities),
        isSuperuser: isSuperuser(authorities),
        isUserAdmin: isUserAdmin(authorities),
        canEditUsers: canEditUsers(authorities),
        hasDataEntryRole: userHasDataEntryRole(userRoles, '', []),
        showAdminNavigation: showAdminNavigation(authorities, navigationOptions),
        isDataEntryExperience: isDataEntryExperience(authorities, navigationOptions),
    }
}

/** @deprecated Use useCaptureAdmin().isSuperuser */
export const useRuleSuperAdmin = () => {
    const result = useCaptureAdmin()
    return {
        loading: result.loading,
        error: result.error,
        authorities: result.authorities,
        isRuleSuperAdmin: result.isSuperuser,
    }
}
