/** Resolve DHIS2 server URL (production injects meta tag; dev uses env). */
export function resolveBaseUrl() {
    const meta = document
        .querySelector('meta[name="dhis2-base-url"]')
        ?.getAttribute('content')
    if (meta && meta !== '__DHIS2_BASE_URL__') {
        return meta.replace(/\/$/, '')
    }
    const env = process.env.REACT_APP_DHIS2_BASE_URL
    if (env) {
        return String(env).replace(/\/$/, '')
    }
    return ''
}

async function parseErrorMessage(res) {
    try {
        const body = await res.json()
        return body?.message || body?.status || res.statusText
    } catch {
        return res.statusText || 'Login failed'
    }
}

/** Returns current user when session cookie is valid. */
export async function fetchSession(baseUrl) {
    const res = await fetch(`${baseUrl}/api/me?fields=id,username`, {
        credentials: 'include',
    })
    if (!res.ok) {
        const err = new Error(await parseErrorMessage(res))
        err.status = res.status
        throw err
    }
    return res.json()
}

async function loginWithNewApi(baseUrl, username, password) {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    })
    if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
    }
}

async function loginWithLegacyApi(baseUrl, username, password) {
    const body = `j_username=${encodeURIComponent(username)}&j_password=${encodeURIComponent(password)}`
    const res = await fetch(`${baseUrl}/dhis-web-commons-security/login.action`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    })
    if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
    }
}

async function supportsNewLoginApi(server) {
    try {
        const res = await fetch(`${server}/api/loginConfig`, { credentials: 'include' })
        return res.ok
    } catch {
        return false
    }
}

export async function loginWithCredentials({ baseUrl, username, password }) {
    const server = String(baseUrl || '').replace(/\/$/, '')
    if (!server) {
        throw new Error('Server URL is required')
    }
    if (await supportsNewLoginApi(server)) {
        await loginWithNewApi(server, username, password)
    } else {
        await loginWithLegacyApi(server, username, password)
    }
}

export function persistBaseUrl(appName, baseUrl) {
    if (baseUrl) {
        window.localStorage.DHIS2_BASE_URL = baseUrl
    }
    if (appName && baseUrl) {
        return import('@dhis2/pwa').then(({ setBaseUrlByAppName }) =>
            setBaseUrlByAppName({ appName, baseUrl })
        )
    }
    return Promise.resolve()
}
