import { useState } from 'react'
import { requestPasswordReset } from '../api/auth'
import { useAuth } from '../hooks/useAuth'
import {Link} from 'react-router'
import logo from '../assets/images/imboni-logo.png'
import '../styles/login.css'
import '../styles/components.css'

function ForgotPasswordModal({ onClose }) {
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
                        <h2 className="modal-title">Reset Password</h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose}>
                        <span className="material-symbols-rounded">close</span>
                    </button>
                </div>

                <div className="modal-body">
                    {/* After sending — show success message instead of the form */}
                    {sent ? (
                        <p className="lg-line16">
                            A password reset link has been sent to <strong>{email}</strong>.
                            Check your email and follow the instructions.
                        </p>
                    ) : (
                        <>
                            <p className="lg-forgot-intro">
                                Enter your email address and we will send you a reset link.
                            </p>
                            {/* Show server error if request failed */}
                            {error && (
                                <p className="lg-modal-err">{error}</p>
                            )}
                            <div className="form-group">
                                <label className="form-label">Email address</label>
                                <input
                                    type="email"
                                    className="form-input"
                                    placeholder="Enter your email"
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
                            Done
                        </button>
                    ) : (
                        <>
                            <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                            {/* Disabled until email is typed and while request is running */}
                            <button
                                className="btn btn-primary"
                                onClick={handleReset}
                                disabled={sending || !email}
                            >
                                {sending ? 'Sending...' : 'Send Reset Link'}
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
 *   portal      — slug sent to the backend  e.g. 'dos'
 *   label       — portal display name       e.g. 'Director of Studies'
 *   subtitle    — short description         e.g. 'Academic oversight and scheduling'
 *   icon        — Material Symbol name      e.g. 'analytics'
 *   accentColor — hex/CSS color             e.g. '#003d7a'
 *   placeholder — email hint                e.g. 'dos@imboni.rw'
 *   redirectTo  — path after login          e.g. '/dos'
 */
export function PortalLogin({ portal, label, subtitle, icon, accentColor, placeholder, redirectTo }) {
    const {login, completeTwoFactor} = useAuth()
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

    return (
        <div className="login-page" style={{ '--portal-login-accent': accentColor }}>

            {/* ── Left panel ─────────────────────────────────────────────── */}
            <div className="login-left portal-login-left">
                <div className="orb-accent"></div>
                <div className="login-left-grid"></div>

                <div className="login-left-content">
                    <div className="login-logo-wrap">
                        <img src={logo} alt="Imboni Logo" />
                    </div>

                    {/* Portal badge */}
                    <div className="portal-login-badge">
                        <div className="portal-login-badge-icon">
                            <span className="material-symbols-rounded">{icon}</span>
                        </div>
                        <span>{label}</span>
                    </div>

                    <h2>
                        Imboni<br />
                        <span>Education Connects</span>
                    </h2>

                    <p>{subtitle}</p>

                    <div className="left-divider"></div>

                    <div className="portal-login-info">
                        <div className="portal-login-info-row">
                            <span className="material-symbols-rounded">verified_user</span>
                            <span>Secure: your data is encrypted</span>
                        </div>
                        <div className="portal-login-info-row">
                            <span className="material-symbols-rounded">lock</span>
                            <span>Access restricted to authorised users only</span>
                        </div>
                        <div className="portal-login-info-row">
                            <span className="material-symbols-rounded">support_agent</span>
                            <span>Contact admin@imboni.rw for account issues</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Right panel ────────────────────────────────────────────── */}
            <div className="login-right">

                <div className="login-right-logo">
                    <img src={logo} alt="Imboni Logo" />
                </div>

                {/* Back link */}
                <Link to="/" className="portal-login-back">
                    <span className="material-symbols-rounded">arrow_back</span>
                    Back to home
                </Link>

                <div className="login-welcome">
                    <div className="login-welcome-icon portal-login-icon-wrap">
                        <span className="material-symbols-rounded">{icon}</span>
                    </div>
                    <div>
                        <h1 className="login-heading">{label}</h1>
                    </div>
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
                            Enter the 6-digit code from your authenticator app
                            (or a backup code) to finish signing in.
                        </p>
                        <div className="form-group">
                            <label className="form-label" htmlFor="twofa-code">Verification code</label>
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
                                ? <><span className="btn-spinner"></span> Verifying...</>
                                : 'Verify and sign in'}
                        </button>
                        <button
                            type="button"
                            className="forgot-link portal-forgot-link lg-back-link"
                            onClick={() => { setChallenge(null); setCode(''); setError('') }}
                        >
                            Back to sign in
                        </button>
                    </form>
                ) : (
                <form className="login-form" onSubmit={handleSubmit} autoComplete="off">

                    <div className="form-group">
                        <label className="form-label" htmlFor="email">Email address</label>
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
                        <label className="form-label" htmlFor="password">Password</label>
                        <div className="input-wrap">
                            <span className="input-icon material-symbols-rounded">lock</span>
                            <input
                                className="form-input"
                                type={showPw ? 'text' : 'password'}
                                id="password"
                                name="password"
                                placeholder="Enter your password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                            <button type="button" className="pw-toggle" onClick={() => setShowPw(p => !p)} aria-label="Toggle password visibility">
                                <span className="material-symbols-rounded">
                                    {showPw ? 'visibility_off' : 'visibility'}
                                </span>
                            </button>
                        </div>
                    </div>

                    <div className="form-options">
                        <label className="remember-label">
                            <input type="checkbox" name="remember" />
                            Remember me
                        </label>
                        <button type="button" className="forgot-link portal-forgot-link" onClick={() => setShowForgot(true)}>
                            Forgot password?
                        </button>
                    </div>

                    <button type="submit" className="login-btn portal-login-btn" disabled={loading}>
                        {loading
                            ? <><span className="btn-spinner"></span> Signing in...</>
                            : `Sign in to ${label}`
                        }
                    </button>

                </form>
                )}

                <div className="login-footer">
                    Imboni Education Connects &copy; {new Date().getFullYear()}.{' '}
                    <a href="#">Privacy Policy</a>
                </div>
            </div>

            {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
        </div>
    )
}
