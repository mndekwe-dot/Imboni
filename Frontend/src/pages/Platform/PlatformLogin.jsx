import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
    platformLogin, platformVerifyMfa, storePlatformSession, isPlatformAuthed,
} from '../../api/platform'
import { errorMessage } from '../../utils/errors'
import logo from '../../assets/images/imboni-logo.webp'
import '../../styles/components.css'
import '../../styles/platform.css'

export function PlatformLogin() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const [email,    setEmail]    = useState('')
    const [password, setPassword] = useState('')
    const [showPw,   setShowPw]   = useState(false)
    const [error,    setError]    = useState('')
    const [loading,  setLoading]  = useState(false)
    // Set when the password step succeeded but a second factor is still owed.
    // Holding it in state rather than storing anything is the point: until the
    // code is right there is no session, so a stolen password gets no further
    // than this screen.
    const [challenge, setChallenge] = useState('')
    const [code,      setCode]      = useState('')

    useEffect(() => { if (isPlatformAuthed()) navigate('/platform', { replace: true }) }, [navigate])

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const data = await platformLogin(email.trim(), password)
            if (data.mfa_required) {
                setChallenge(data.challenge)
                return
            }
            storePlatformSession(data)
            navigate('/platform', { replace: true })
        } catch (err) {
            setError(errorMessage(err, t('platform.login.signInFailed')))
        } finally {
            setLoading(false)
        }
    }

    async function handleVerify(e) {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const data = await platformVerifyMfa(challenge, code.trim())
            storePlatformSession(data)
            navigate('/platform', { replace: true })
        } catch (err) {
            setError(errorMessage(err, t('platform.login.codeWrong')))
        } finally {
            setLoading(false)
        }
    }

    if (challenge) {
        return (
            <div className="platform-login">
                <form className="platform-login-card" onSubmit={handleVerify}>
                    <div className="platform-login-brand">
                        <img src={logo} alt={t('platform.login.logoAlt')} />
                        <div>
                            <h1>{t('platform.login.twoFactorTitle')}</h1>
                            <p>{t('platform.login.twoFactorIntro', { email })}</p>
                        </div>
                    </div>

                    {error && (
                        <div className="platform-login-error" role="alert">
                            <span className="material-symbols-rounded" aria-hidden="true">error</span>
                            {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label" htmlFor="pf-code">{t('platform.login.codeLabel')}</label>
                        <input id="pf-code" className="form-input" inputMode="numeric"
                               autoComplete="one-time-code" required autoFocus
                               value={code} onChange={e => setCode(e.target.value)}
                               placeholder="000000" />
                    </div>

                    <button type="submit" className="btn btn-primary pf-full pf-mt" disabled={loading}>
                        {loading ? t('platform.login.checking') : t('platform.login.verify')}
                    </button>

                    <button type="button" className="btn btn-ghost pf-full"
                            onClick={() => { setChallenge(''); setCode(''); setError('') }}>
                        {t('platform.login.back')}
                    </button>
                </form>
            </div>
        )
    }

    return (
        <div className="platform-login">
            <form className="platform-login-card" onSubmit={handleSubmit}>
                <div className="platform-login-brand">
                    <img src={logo} alt={t('platform.login.logoAlt')} />
                    <div>
                        <h1>{t('platform.login.title')}</h1>
                        <p>{t('platform.login.subtitle')}</p>
                    </div>
                </div>

                {error && (
                    <div className="platform-login-error" role="alert">
                        <span className="material-symbols-rounded" aria-hidden="true">error</span>
                        {error}
                    </div>
                )}

                <div className="form-group">
                    <label className="form-label" htmlFor="pf-email">{t('platform.login.email')}</label>
                    <input id="pf-email" className="form-input" type="email" autoComplete="username" required
                           value={email} onChange={e => setEmail(e.target.value)} placeholder="you@imboni.com" />
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="pf-password">{t('platform.login.password')}</label>
                    <div className="platform-pw-wrap">
                        <input id="pf-password" className="form-input" type={showPw ? 'text' : 'password'}
                               autoComplete="current-password" required
                               value={password} onChange={e => setPassword(e.target.value)} placeholder={t('platform.login.passwordPlaceholder')} />
                        <button type="button" className="platform-pw-toggle" aria-label={t('platform.login.togglePassword')} onClick={() => setShowPw(p => !p)}>
                            <span className="material-symbols-rounded" aria-hidden="true">{showPw ? 'visibility_off' : 'visibility'}</span>
                        </button>
                    </div>
                </div>

                <button type="submit" className="btn btn-primary pf-full pf-mt" disabled={loading}>
                    {loading ? t('platform.login.signingIn') : t('platform.login.signIn')}
                </button>

                <p className="platform-login-note">{t('platform.login.note')}</p>
            </form>
        </div>
    )
}
