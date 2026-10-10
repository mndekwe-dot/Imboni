import { useEffect, useState } from 'react'
import { Navigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import client from '../api/client'
import { clearSession, startSupportSession } from '../api/session'
import { decodeJwtPayload, saveSupportSession } from '../utils/supportSession'

/**
 * Where a platform operator lands from "Open support session".
 *
 * The token is in the URL fragment, which the browser never sends to a server.
 * It is moved into this tab's own storage and the fragment is wiped from the address bar
 * straight away, so it is not left in history or on screen.
 */
export function SupportSession() {
    const { t } = useTranslation()
    const [state, setState] = useState('opening')   // opening | done | invalid

    useEffect(() => {
        const token = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token')
        window.history.replaceState(null, '', window.location.pathname)
        const claims = token ? decodeJwtPayload(token) : null
        if (!claims?.support_session || claims.exp * 1000 <= Date.now()) { setState('invalid'); return }

        // A support session replaces whoever was signed in on this browser.
        clearSession()
        startSupportSession(token)
        client.get('/imboni/account/profile/')
            .then(user => {
                localStorage.setItem('imboni_user', JSON.stringify(user))
                saveSupportSession({ exp: claims.exp, operator: claims.operator })
                setState('done')
            })
            .catch(() => { clearSession(); setState('invalid') })
    }, [])

    if (state === 'done') return <Navigate to="/admin" replace />
    return (
        <div className="route-fallback" role="status">
            <p>{state === 'invalid' ? t('common.supportSession.invalid') : t('common.supportSession.opening')}</p>
        </div>
    )
}
