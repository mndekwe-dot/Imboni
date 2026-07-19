import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import '../styles/login.css'
import '../styles/components.css'
import logo from '../assets/images/imboni-logo.png'

function ForgotPasswordModal({ onClose }) {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-rounded">lock_reset</span>
                        <h2 className="modal-title">Reset Password</h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose}><span className="material-symbols-rounded">close</span></button>
                </div>
                <div className="modal-body">
                    <p className="lg-forgot-intro">
                        Password resets are handled by the school administration. Please contact the school office using one of the options below:
                    </p>
                    <div className="u-stack-sm">
                        <div className="lg-contact-row">
                            <span className="material-symbols-rounded lg-contact-icon">mail</span>
                            <div>
                                <div className="lg-contact-label">Email</div>
                                <div className="lg-contact-value">admin@imboni.edu</div>
                            </div>
                        </div>
                        <div className="lg-contact-row">
                            <span className="material-symbols-rounded lg-contact-icon">phone</span>
                            <div>
                                <div className="lg-contact-label">School Extension</div>
                                <div className="lg-contact-value">Extension 100</div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-primary u-full" onClick={onClose}>Got it</button>
                </div>
            </div>
        </div>
    )
}

const roles = [
    'Student', 'Teacher', 'Parent', 'Director of Studies', 'Discipline', 'Matron',
]

const stats = [
    { value: '980+',  label: 'Boarders'  },
    { value: '48+',   label: 'Teachers'  },
    { value: '6',     label: 'Portals'   },
    { value: '4',     label: 'Houses'    },
]

export function LogIn() {
    const { login, completeTwoFactor } = useAuth()
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
                        <span>Education Connects</span>
                    </h2>

                    <p>
                        One unified platform for students, teachers, parents,
                        and boarding staff, keeping every part of school life
                        connected and running smoothly.
                    </p>

                    <div className="left-divider"></div>

                    <div className="login-left-roles">
                        {roles.map(role => (
                            <span key={role} className="role-pill">{role}</span>
                        ))}
                    </div>

                    <div className="left-stats">
                        {stats.map(s => (
                            <div key={s.label} className="left-stat-item">
                                <div className="left-stat-value">{s.value}</div>
                                <div className="left-stat-label">{s.label}</div>
                            </div>
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

                <div className="login-welcome">
                    <div className="login-welcome-icon">
                        <span className="material-symbols-rounded">school</span>
                    </div>
                    <div>
                        <h1 className="login-heading">Welcome back</h1>
                    </div>
                </div>

                <p className="login-subheading">
                    Sign in with your school-issued credentials to access your portal.
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
                            Enter the 6-digit code from your authenticator app (or a backup
                            code) to finish signing in.
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
                        <button type="submit" className="login-btn" disabled={loading}>
                            {loading
                                ? <><span className="btn-spinner"></span> Verifying...</>
                                : 'Verify and sign in'}
                        </button>
                        <button
                            type="button"
                            className="forgot-link lg-back-link"
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
                                placeholder="you@imboni.edu"
                                autoComplete="email"
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
                            <button
                                type="button"
                                className="pw-toggle"
                                aria-label="Toggle password visibility"
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
                            Remember me
                        </label>
                        <button type="button" className="forgot-link" onClick={() => setShowForgot(true)}>Forgot password?</button>
                    </div>

                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading
                            ? <><span className="btn-spinner"></span> Signing in...</>
                            : 'Sign in'}
                    </button>

                </form>
                )}

                <div className="form-divider">or</div>

                <div className="login-help">
                    <div className="login-help-icon">
                        <span className="material-symbols-rounded">support_agent</span>
                    </div>
                    <div>
                        <strong>Need help?</strong> Contact the school office at{' '}
                        <strong>admin@imboni.edu</strong> or extension <strong>100</strong>.
                    </div>
                </div>

                <div className="login-footer">
                    Imboni Education Connects &copy; {new Date().getFullYear()}.{' '}
                    <a href="#">Privacy Policy</a>
                </div>

            </div>
            {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
        </div>
    )
}
