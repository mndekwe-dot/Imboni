import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../components/ui/LanguageSwitcher'
import { useSchoolIdentity } from '../hooks/useSchoolIdentity'
import { lookupSchoolByCode } from '../api/discovery'
import { errorMessage } from '../utils/errors'
import { ROLE_HOME, readStoredUser } from '../utils/roles'
import {
    schoolUrl, goToSchool, readRememberedSchool, rememberSchool, forgetSchool,
} from '../utils/schoolHost'
import '../styles/login.css'
import '../styles/components.css'

/**
 * The first screen of the installed desktop app (the manifest's start_url).
 *
 * Imboni keeps each school on its own subdomain, but an installed app has one
 * start address. So the app opens here, on the bare domain, and this page sends
 * the person on to their school:
 *
 *   - on a school's own host      -> straight to their portal, or the login page
 *   - on the bare domain, and this device has used a school before
 *                                 -> back to that school
 *   - otherwise                   -> ask for the school code (the subdomain)
 *
 * The remembered school is re-checked with the server before being trusted, so a
 * school that has since been removed shows the code form instead of a dead page.
 * If the check cannot be made (offline), the remembered school is used as is.
 */
export function Start() {
    const { t } = useTranslation()
    const [params] = useSearchParams()
    const { school, loading } = useSchoolIdentity()

    // `?other=1` is the "this is not my school" door: forget and ask again.
    // The parameter's name is chosen with care: the icon guard reads any
    // quoted word that is an icon name, and the obvious word is one.
    const switching = params.get('other') === '1'

    const [remembered, setRemembered] = useState(() => {
        if (switching) forgetSchool()
        return switching ? null : readRememberedSchool()
    })
    const [code, setCode] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')

    const signedIn = Boolean(localStorage.getItem('imboni_access'))
    const onSchoolHost = Boolean(school)

    // Re-verify the remembered school, then go. Runs only on the bare domain.
    useEffect(() => {
        if (loading || onSchoolHost || signedIn || !remembered) return
        let alive = true

        lookupSchoolByCode(remembered.code)
            .then(found => {
                if (!alive) return
                rememberSchool({ code: remembered.code, name: found.name, domain: found.domain })
                goToSchool(schoolUrl(found.domain))
            })
            .catch(err => {
                if (!alive) return
                if (err?.response?.status === 404) {
                    // The school is gone, or its code changed. Ask again.
                    forgetSchool()
                    setRemembered(null)
                    return
                }
                // Offline or the server is down: trust what we remembered.
                goToSchool(schoolUrl(remembered.domain))
            })

        return () => { alive = false }
    }, [loading, onSchoolHost, signedIn, remembered])

    // Already on a school's host (or holding its session): this page has nothing
    // to ask. Signed-in users go to their own portal; everyone else signs in.
    if (signedIn || onSchoolHost) {
        const role = readStoredUser()?.role
        return <Navigate to={(signedIn && ROLE_HOME[role]) || '/login'} replace />
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (busy) return
        setBusy(true)
        setError('')
        try {
            const found = await lookupSchoolByCode(code.trim())
            rememberSchool({ code: code.trim().toLowerCase(), name: found.name, domain: found.domain })
            goToSchool(schoolUrl(found.domain))
        } catch (err) {
            // A 404 is "no such school"; anything else is a connection problem
            // or a server fault and is reported as that, not as a bad code.
            setError(err?.response?.status === 404
                ? t('start.notFound')
                : errorMessage(err, t('start.connectFailed')))
            setBusy(false)
        }
    }

    function notMySchool() {
        forgetSchool()
        setRemembered(null)
    }

    // Decided by what we remember, not by whether the host lookup has finished:
    // waiting on `loading` flashed the code form for a moment before "Opening".
    const opening = Boolean(remembered)

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-lang">
                    <LanguageSwitcher variant="dropdown" />
                </div>

                <div className="login-welcome">
                    <div className="login-welcome-icon">
                        <span className="material-symbols-rounded" aria-hidden="true">school</span>
                    </div>
                    <div>
                        <h1 className="login-heading">{t('start.title')}</h1>
                    </div>
                </div>

                {opening ? (
                    <>
                        <p className="login-subheading" role="status">
                            {t('start.opening', { school: remembered.name || remembered.code })}
                        </p>
                        <button type="button" className="forgot-link lg-back-link" onClick={notMySchool}>
                            {t('start.notYourSchool')}
                        </button>
                    </>
                ) : (
                    <>
                        <p className="login-subheading">{t('start.subtitle')}</p>

                        {error && (
                            <div className="login-error portal-login-error-visible" role="alert">
                                <span className="material-symbols-rounded" aria-hidden="true">error</span>
                                {error}
                            </div>
                        )}

                        <form className="login-form" onSubmit={handleSubmit} autoComplete="off">
                            <div className="form-group">
                                <label className="form-label" htmlFor="school-code">{t('start.codeLabel')}</label>
                                <div className="input-wrap">
                                    <span className="input-icon material-symbols-rounded" aria-hidden="true">domain</span>
                                    <input
                                        className="form-input"
                                        type="text"
                                        id="school-code"
                                        name="code"
                                        placeholder={t('start.codePlaceholder')}
                                        autoCapitalize="none"
                                        autoCorrect="off"
                                        spellCheck={false}
                                        required
                                        autoFocus
                                        disabled={busy || loading}
                                        value={code}
                                        onChange={e => setCode(e.target.value)}
                                    />
                                </div>
                                <p className="login-subheading">{t('start.codeHint')}</p>
                            </div>

                            <button type="submit" className="login-btn" disabled={busy || loading || !code.trim()}>
                                {busy
                                    ? <><span className="btn-spinner"></span> {t('start.checking')}</>
                                    : t('start.continue')}
                            </button>
                        </form>

                        <div className="form-divider">{t('auth.or')}</div>

                        <div className="login-footer">
                            <Link to="/find-school">{t('start.forgotCode')}</Link>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
