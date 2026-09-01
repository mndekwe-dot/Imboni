import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import {
    platformLogin, platformVerifyMfa, storePlatformSession, isPlatformAuthed,
} from '../../api/platform'
import { errorMessage } from '../../utils/errors'
import logo from '../../assets/images/imboni-logo.webp'
import '../../styles/components.css'
import '../../styles/platform.css'

export function PlatformLogin() {
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
            setError(errorMessage(err, 'Could not sign in. Check your credentials.'))
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
            setError(errorMessage(err, 'That code is not right. Try the current one.'))
        } finally {
            setLoading(false)
        }
    }

    if (challenge) {
        return (
            <div className="platform-login">
                <form className="platform-login-card" onSubmit={handleVerify}>
                    <div className="platform-login-brand">
                        <img src={logo} alt="Imboni" />
                        <div>
                            <h1>Two-factor code</h1>
                            <p>Open your authenticator app for {email}</p>
                        </div>
                    </div>

                    {error && (
                        <div className="platform-login-error" role="alert">
                            <span className="material-symbols-rounded" aria-hidden="true">error</span>
                            {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label" htmlFor="pf-code">6-digit code</label>
                        <input id="pf-code" className="form-input" inputMode="numeric"
                               autoComplete="one-time-code" required autoFocus
                               value={code} onChange={e => setCode(e.target.value)}
                               placeholder="000000" />
                    </div>

                    <button type="submit" className="btn btn-primary pf-full pf-mt" disabled={loading}>
                        {loading ? 'Checking…' : 'Verify and sign in'}
                    </button>

                    <button type="button" className="btn btn-ghost pf-full"
                            onClick={() => { setChallenge(''); setCode(''); setError('') }}>
                        Back
                    </button>
                </form>
            </div>
        )
    }

    return (
        <div className="platform-login">
            <form className="platform-login-card" onSubmit={handleSubmit}>
                <div className="platform-login-brand">
                    <img src={logo} alt="Imboni" />
                    <div>
                        <h1>Imboni Platform</h1>
                        <p>Operator console for all schools</p>
                    </div>
                </div>

                {error && (
                    <div className="platform-login-error" role="alert">
                        <span className="material-symbols-rounded" aria-hidden="true">error</span>
                        {error}
                    </div>
                )}

                <div className="form-group">
                    <label className="form-label" htmlFor="pf-email">Email</label>
                    <input id="pf-email" className="form-input" type="email" autoComplete="username" required
                           value={email} onChange={e => setEmail(e.target.value)} placeholder="you@imboni.com" />
                </div>

                <div className="form-group">
                    <label className="form-label" htmlFor="pf-password">Password</label>
                    <div className="platform-pw-wrap">
                        <input id="pf-password" className="form-input" type={showPw ? 'text' : 'password'}
                               autoComplete="current-password" required
                               value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" />
                        <button type="button" className="platform-pw-toggle" aria-label="Toggle password visibility" onClick={() => setShowPw(p => !p)}>
                            <span className="material-symbols-rounded" aria-hidden="true">{showPw ? 'visibility_off' : 'visibility'}</span>
                        </button>
                    </div>
                </div>

                <button type="submit" className="btn btn-primary pf-full pf-mt" disabled={loading}>
                    {loading ? 'Signing in…' : 'Sign in'}
                </button>

                <p className="platform-login-note">
                    Restricted to Imboni platform operators. School staff sign in on their school&apos;s own address.
                </p>
            </form>
        </div>
    )
}
