import { useDataQuery } from '@dhis2/app-runtime'
import { isSuperuser } from '../lib/ruleSuperuser'

const ME_AUTHORITIES_QUERY = {
    me: {
        resource: 'me',
        params: {
            fields: ['authorities'],
        },
    },
}

export const useSuperuser = () => {
    const { loading, error, data } = useDataQuery(ME_AUTHORITIES_QUERY)
    const authorities = data?.me?.authorities || []

    return {
        loading,
        error,
        authorities,
        isSuperuser: isSuperuser(authorities),
    }
}
