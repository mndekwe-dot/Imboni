import { useState } from 'react'
import { LanguageSwitcher } from '../components/ui/LanguageSwitcher'
import { useTranslation, Trans } from 'react-i18next'
import { requestPasswordReset } from '../api/auth'
import { useAuth } from '../hooks/useAuth'
import {Link} from 'react-router'
import '../styles/login.css'
import '../styles/components.css'
import { useSchoolBranding } from '../hooks/useSchoolBranding'

function ForgotPasswordModal({ onClose }) {
    const { t } = useTranslation()
    // Form state
    const [email,   setEmail]   = useState('')
    const [sending, setSending] = useState(false) // true while API call is running
    const [sent,    setSent]    = useState(false)  // true after email sent successfully
    const [error,   setError]   = useState('')     // error message from server

    // Sends the email to the backend which generates a token and emails the reset link.
    // The frontend never handles the token — only the backend does.
    async function handleReset() {
        setSending(true)
        setError('')
        try {
            await requestPasswordReset(email)
            setSent(true)  // switch modal body to success message
        } catch (err) {
            setError(err.message)
        } finally {
            setSending(false)
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-rounded">lock_reset</span>
                        <h2 className="modal-title">{t('auth.resetPassword')}</h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose}>
                        <span className="material-symbols-rounded">close</span>
                    </button>
                </div>

                <div className="modal-body">
                    {/* After sending — show success message instead of the form */}
                    {sent ? (
                        <p className="lg-line16">
                            {/* <1> in the translation maps to the <strong> below. */}
                            <Trans i18nKey="auth.resetSent" values={{ email }}>
                                <strong />
                            </Trans>
                        </p>
                    ) : (
                        <>
                            <p className="lg-forgot-intro">{t('auth.resetIntro')}</p>
                            {/* Show server error if request failed */}
                            {error && (
                                <p className="lg-modal-err">{error}</p>
                            )}
                            <div className="form-group">
                                <label className="form-label">{t('auth.email')}</label>
                                <input
                                    type="email"
                                    className="form-input"
                                    placeholder={t('auth.emailPlaceholder')}
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                />
                            </div>
                        </>
                    )}
                </div>

                <div className="modal-footer">
                    {/* After sending — only show Done button */}
                    {sent ? (
                        <button className="btn btn-primary u-full" onClick={onClose}>
                            {t('common.done')}
                        </button>
                    ) : (
                        <>
                            <button className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
                            {/* Disabled until email is typed and while request is running */}
                            <button
                                className="btn btn-primary"
                                onClick={handleReset}
                                disabled={sending || !email}
                            >
                                {sending ? t('common.sending') : t('auth.sendResetLink')}
                            </button>
                        </>
                    )}
                </div>

            </div>
        </div>
    )
}

/**
 * PortalLogin — reusable login page for every portal.
 *
 * Props:
 *   portal      — slug sent to the backend  e.g. 'dos'; also selects the
 *                 translated portal name and blurb, so no display text is
 *                 passed in as a prop
 *   icon        — Material Symbol name      e.g. 'analytics'
 *   placeholder — email hint                e.g. 'dos@imboni.rw'
 *   redirectTo  — path after login          e.g. '/dos'
 */
export function PortalLogin({ portal, icon, placeholder, redirectTo }) {
    const { t } = useTranslation()
    const {login, completeTwoFactor} = useAuth()
    const { schoolName, logo: schoolLogo } = useSchoolBranding()
    const label    = t(`portal.${portal}`)
    const subtitle = t(`portalLogin.${portal}`)
    const [email,      setEmail]      = useState('')
    const [password,   setPassword]   = useState('')
    const [showPw,     setShowPw]     = useState(false)
    const [error,      setError]      = useState('')
    const [loading,    setLoading]    = useState(false)
    const [showForgot, setShowForgot] = useState(false)
    // When the account has 2FA, login returns a challenge and we show a code step.
    const [challenge,  setChallenge]  = useState(null)
    const [code,       setCode]       = useState('')

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const result = await login(email,password,portal,redirectTo)
            if (result?.requires2fa) {
                setChallenge(result.challenge)
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    async function handleVerify(e) {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            await completeTwoFactor(challenge, code.trim(), redirectTo)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // No accent is passed in any more. Each route used to hand this a literal
    // that agreed with nothing: /login/student was cyan while the student
    // portal is emerald, /login/teacher violet while teacher is cyan,
    // /login/parent orange. The palette in index.css is the one source now,
    // and login.css falls through to var(--primary).
    return (
        <div className="login-page">

            {/* One centred card. The branding column that used to sit on the
                left carried a logo, a tagline and three reassurance lines;
                the two that still say something (secure, restricted) moved
                under the form, and the rest went. */}
            <div className="login-card">

                {/* Both are ways out for someone who landed on the wrong portal
                    or the wrong language, so both sit above the form. The
                    switcher is centred here exactly as it is on /login - the two
                    sign-in screens should not differ in where their controls sit. */}
                <Link to="/" className="portal-login-back">
                    <span className="material-symbols-rounded">arrow_back</span>
                    {t('auth.backToHome')}
                </Link>
                <div className="login-lang">
                    <LanguageSwitcher variant="dropdown" />
                </div>

                <div className="login-welcome">
                    <div className="login-welcome-icon">
                        {schoolLogo
                            ? <img src={schoolLogo} alt={schoolName || ''} />
                            : <span className="material-symbols-rounded">{icon}</span>}
                    </div>
                    <div className="portal-login-badge">
                        <div className="portal-login-badge-icon">
                            <span className="material-symbols-rounded">{icon}</span>
                        </div>
                        <span>{label}</span>
                    </div>
                    <h1 className="login-heading">{schoolName || label}</h1>
                </div>

                <p className="login-subheading">{subtitle}</p>

                {/* Error banner */}
                {error && (
                    <div className="login-error portal-login-error-visible">
                        <span className="material-symbols-rounded">error</span>
                        {error}
                    </div>
                )}

                {challenge ? (
                    <form className="login-form" onSubmit={handleVerify} autoComplete="off">
                        <p className="login-subheading lg-mt-0">
                            {t('auth.twoFactorHint')}
                        </p>
                        <div className="form-group">
                            <label className="form-label" htmlFor="twofa-code">{t('auth.verificationCode')}</label>
                            <div className="input-wrap">
                                <span className="input-icon material-symbols-rounded">password</span>
                                <input
                                    className="form-input"
                                    type="text"
                                    id="twofa-code"
                                    name="code"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    placeholder="123456"
                                    required
                                    autoFocus
                                    value={code}
                                    onChange={e => setCode(e.target.value)}
                                />
                            </div>
                        </div>
                        <button type="submit" className="login-btn portal-login-btn" disabled={loading}>
                            {loading
                                ? <><span className="btn-spinner"></span> {t('auth.verifying')}</>
                                : t('auth.verifyAndSignIn')}
                        </button>
                        <button
                            type="button"
                            className="forgot-link portal-forgot-link lg-back-link"
                            onClick={() => { setChallenge(null); setCode(''); setError('') }}
                        >
                            {t('auth.backToSignIn')}
                        </button>
                    </form>
                ) : (
                <form className="login-form" onSubmit={handleSubmit} autoComplete="off">

                    <div className="form-group">
                        <label className="form-label" htmlFor="email">{t('auth.email')}</label>
                        <div className="input-wrap">
                            <span className="input-icon material-symbols-rounded">mail</span>
                            <input
                                className="form-input"
                                type="email"
                                id="email"
                                name="email"
                                placeholder={placeholder}
                                autoComplete="off"
                                required
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="password">{t('auth.password')}</label>
                        <div className="input-wrap">
                            <span className="input-icon material-symbols-rounded">lock</span>
                            <input
                                className="form-input"
                                type={showPw ? 'text' : 'password'}
                                id="password"
                                name="password"
                                placeholder={t('auth.passwordPlaceholder')}
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                            <button type="button" className="pw-toggle" onClick={() => setShowPw(p => !p)} aria-label={t('auth.togglePassword')}>
                                <span className="material-symbols-rounded">
                                    {showPw ? 'visibility_off' : 'visibility'}
                                </span>
                            </button>
                        </div>
                    </div>

                    <div className="form-options">
                        <label className="remember-label">
                            <input type="checkbox" name="remember" />
                            {t('auth.rememberMe')}
                        </label>
                        <button type="button" className="forgot-link portal-forgot-link" onClick={() => setShowForgot(true)}>
                            {t('auth.forgotPassword')}
                        </button>
                    </div>

                    <button type="submit" className="login-btn portal-login-btn" disabled={loading}>
                        {loading
                            ? <><span className="btn-spinner"></span> {t('auth.signingIn')}</>
                            : t('auth.signInTo', { portal: label })
                        }
                    </button>

                </form>
                )}

                <div className="login-footer">
                    {t('auth.footer', { year: new Date().getFullYear() })}{' '}
                    <a href="#">{t('auth.privacyPolicy')}</a>
                </div>
            </div>

            {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
        </div>
    )
}
