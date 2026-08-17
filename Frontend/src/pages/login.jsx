import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useAuth } from '../hooks/useAuth'
import { useSchoolIdentity } from '../hooks/useSchoolIdentity'
import '../styles/login.css'
import '../styles/components.css'
import '../styles/public-pages.css'
import logo from '../assets/images/imboni-logo.png'

function ForgotPasswordModal({ onClose }) {
    const { t } = useTranslation()
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-rounded">lock_reset</span>
                        <h2 className="modal-title">{t('auth.resetPassword')}</h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose}><span className="material-symbols-rounded">close</span></button>
                </div>
                <div className="modal-body">
                    <p className="lg-forgot-intro">
                        {t('auth.resetIntroContact')}
                    </p>
                    <div className="u-stack-sm">
                        <div className="lg-contact-row">
                            <span className="material-symbols-rounded lg-contact-icon">mail</span>
                            <div>
                                <div className="lg-contact-label">{t('common.email')}</div>
                                <div className="lg-contact-value">admin@imboni.edu</div>
                            </div>
                        </div>
                        <div className="lg-contact-row">
                            <span className="material-symbols-rounded lg-contact-icon">phone</span>
                            <div>
                                <div className="lg-contact-label">{t('auth.schoolExtension')}</div>
                                <div className="lg-contact-value">{t('auth.extensionValue')}</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-primary u-full" onClick={onClose}>{t('auth.gotIt')}</button>
                </div>
            </div>
        </div>
    )
}

const ROLE_KEYS = [
    'roles.student', 'roles.teacher', 'roles.parent',
    'roles.dos', 'roles.discipline', 'roles.matron',
]

export function LogIn() {
    const { t } = useTranslation()
    const { login, completeTwoFactor } = useAuth()
    // Decorative only: null on the bare domain or if the lookup fails.
    const { school } = useSchoolIdentity()
    const [email,      setEmail]      = useState('')
    const [password,   setPassword]   = useState('')
    const [showPw,     setShowPw]     = useState(false)
    const [error,      setError]      = useState('')
    const [loading,    setLoading]    = useState(false)
    const [showForgot, setShowForgot] = useState(false)
    // 2FA accounts get a challenge back from the first step; we then ask for a code.
    const [challenge,  setChallenge]  = useState(null)
    const [code,       setCode]       = useState('')

    // Generic login: no portal restriction. useAuth redirects by the user's role.
    async function handleSubmit(e) {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const result = await login(email, password)
            if (result?.requires2fa) {
                setChallenge(result.challenge)
            }
        } catch (err) {
            setError(err.message || 'Unable to sign in. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    async function handleVerify(e) {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            await completeTwoFactor(challenge, code.trim())
        } catch (err) {
            setError(err.message || 'Invalid or expired code. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="login-page">

            {/* ── Left panel — branding ── */}
            <div className="login-left">
                <div className="orb-accent"></div>
                <div className="login-left-grid"></div>

                <div className="login-left-content">
                    <div className="login-logo-wrap">
                        <img src={logo} alt="Imboni Logo" />
                    </div>

                    <h2>
                        Imboni<br />
                        <span>{t('auth.brandTagline')}</span>
                    </h2>

                    <p>
                        {t('auth.leftIntro')}
                    </p>

                    <div className="left-divider"></div>

                    <div className="login-left-roles">
                        {ROLE_KEYS.map(key => (
                            <span key={key} className="role-pill">{t(key)}</span>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Right panel — form ── */}
            <div className="login-right">

                {/* Mobile logo — hidden on desktop */}
                <div className="login-right-logo">
                    <img src={logo} alt="Imboni Logo" />
                </div>

                {/* The school's own name, so a parent lands somewhere that looks
                    like their school rather than generic software. Renders
                    nothing on the bare domain or if the lookup fails — never a
                    reason to block signing in. */}
                {school && (
                    <div className="school-brand">
                        <p className="school-brand-name">{school.name}</p>
                        <p className="school-brand-sub">{t('auth.onImboni')}</p>
                        {school.status === 'suspended' && (
                            <p className="school-brand-warn">
                                {t('auth.suspendedWarning')}
                            </p>
                        )}
                    </div>
                )}

                <div className="login-welcome">
                    <div className="login-welcome-icon">
                        <span className="material-symbols-rounded">school</span>
                    </div>
                    <div>
                        <h1 className="login-heading">{t('auth.welcomeBack')}</h1>
                    </div>
                </div>

                <p className="login-subheading">
                    {t('auth.loginSubheading')}
                </p>

                {/* Error banner — shown only when there's an error to report. */}
                {error && (
                    <div className="login-error portal-login-error-visible" role="alert">
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
                        <button type="submit" className="login-btn" disabled={loading}>
                            {loading
                                ? <><span className="btn-spinner"></span> {t('auth.verifying')}</>
                                : 'Verify and sign in'}
                        </button>
                        <button
                            type="button"
                            className="forgot-link lg-back-link"
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
                                placeholder={t('auth.emailPlaceholderExample')}
                                autoComplete="email"
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
                            <button
                                type="button"
                                className="pw-toggle"
                                aria-label={t('auth.togglePassword')}
                                onClick={() => setShowPw(p => !p)}
                            >
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
                        <button type="button" className="forgot-link" onClick={() => setShowForgot(true)}>{t('auth.forgotPassword')}</button>
                    </div>

                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading
                            ? <><span className="btn-spinner"></span> {t('auth.signingIn')}</>
                            : t('auth.signIn')}
                    </button>

                </form>
                )}

                <div className="form-divider">{t('auth.or')}</div>

                <div className="login-help">
                    <div className="login-help-icon">
                        <span className="material-symbols-rounded">support_agent</span>
                    </div>
                    <div>
                        <strong>{t('auth.needHelp')}</strong>{' '}
                        {t('auth.contactOffice', { email: 'admin@imboni.edu', extension: '100' })}
                    </div>
                </div>

                <div className="login-footer">
                    {t('auth.footerCopyright', { year: new Date().getFullYear() })}{' '}
                    <Link to="/privacy">{t('auth.privacyPolicy')}</Link>
                </div>

            </div>
            {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
        </div>
    )
}
