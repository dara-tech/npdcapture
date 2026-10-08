import React, { useMemo } from 'react'
import i18n from '@dhis2/d2-i18n'
import { clearSensitiveCaches, useConfig, useDataQuery } from '@dhis2/app-runtime'
import { UserAvatar } from '@dhis2/ui'
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover'
import { cn } from '../../lib/utils'

const ME_QUERY = {
    me: {
        resource: 'me',
        params: {
            fields: ['name', 'email', 'avatar'],
        },
    },
    help: {
        resource: 'systemSettings/helpPageLink',
    },
}

const joinPath = (baseUrl, ...parts) => {
    const base = String(baseUrl || '').replace(/\/$/, '')
    const path = parts
        .filter(Boolean)
        .join('/')
        .replace(/^\//, '')
    return path ? `${base}/${path}` : base
}

const ProfileMenuLink = ({ href, onClick, children }) => (
    <a
        href={href}
        onClick={onClick}
        className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
    >
        {children}
    </a>
)

export const ToolbarUserProfile = ({ className }) => {
    const { baseUrl } = useConfig()
    const { loading, data } = useDataQuery(ME_QUERY)

    const name = data?.me?.name || ''
    const email = data?.me?.email || ''
    const avatarId = data?.me?.avatar?.id
    const helpUrl = data?.help?.helpPageLink

    const links = useMemo(
        () => ({
            settings: joinPath(baseUrl, 'dhis-web-user-profile/#/settings'),
            account: joinPath(baseUrl, 'dhis-web-user-profile/#/account'),
            about: joinPath(baseUrl, 'dhis-web-user-profile/#/aboutPage'),
            logout: joinPath(baseUrl, 'dhis-web-commons-security/logout.action'),
        }),
        [baseUrl]
    )

    const handleLogout = async (event) => {
        event.preventDefault()
        await clearSensitiveCaches()
        window.location.assign(links.logout)
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    disabled={loading || !name}
                    className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200/90 bg-slate-50 p-0 transition-colors hover:border-app-tint-35 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--app-header-bar-rgb)/0.28)] disabled:opacity-40',
                        className
                    )}
                    title={i18n.t('Profile menu')}
                    aria-label={i18n.t('Profile menu')}
                >
                    {name ? (
                        <UserAvatar avatarId={avatarId} name={name} small />
                    ) : (
                        <span className="h-8 w-8 animate-pulse rounded-full bg-slate-200" />
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-0">
                <div className="border-b border-slate-100 px-4 py-3">
                    <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
                    {email ? (
                        <p className="truncate text-xs text-slate-500">{email}</p>
                    ) : null}
                </div>
                <nav className="flex flex-col p-1.5">
                    <ProfileMenuLink href={links.settings}>{i18n.t('Settings')}</ProfileMenuLink>
                    <ProfileMenuLink href={links.account}>{i18n.t('Account')}</ProfileMenuLink>
                    {helpUrl ? (
                        <ProfileMenuLink href={helpUrl}>{i18n.t('Help')}</ProfileMenuLink>
                    ) : null}
                    <ProfileMenuLink href={links.about}>{i18n.t('About DHIS2')}</ProfileMenuLink>
                    <ProfileMenuLink href={links.logout} onClick={handleLogout}>
                        {i18n.t('Logout')}
                    </ProfileMenuLink>
                </nav>
            </PopoverContent>
        </Popover>
    )
}
