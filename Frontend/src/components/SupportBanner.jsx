import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { clearSupportSession, readSupportSession } from '../utils/supportSession'

/**
 * Said on every page for as long as a support session lasts, so nobody looks at
 * a school without it being obvious on screen. It disappears, and the login
 * with it, the moment the session runs out.
 */
export function SupportBanner() {
    const { t } = useTranslation()
    const [session, setSession] = useState(readSupportSession)

    useEffect(() => {
        if (!session) return undefined
        const timer = setInterval(() => {
            if (!readSupportSession()) { clearSupportSession(); setSession(null); window.location.assign('/login') }
        }, 15000)
        return () => clearInterval(timer)
    }, [session])

    if (!session) return null

    function end() {
        clearSupportSession()
        window.location.assign('/login')
    }

    const time = new Date(session.exp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    return (
        <div className="support-banner" role="alert">
            <span>{t('common.supportSession.banner', { time })}</span>
            <button className="btn btn-sm btn-outline" onClick={end}>{t('common.supportSession.end')}</button>
        </div>
    )
}
