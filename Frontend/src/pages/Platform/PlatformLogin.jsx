import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { platformLogin, storePlatformSession, isPlatformAuthed } from '../../api/platform'
import { errorMessage } from '../../utils/errors'
import logo from '../../assets/images/imboni-logo.png'
import '../../styles/components.css'
import '../../styles/platform.css'

export function PlatformLogin() {
    const navigate = useNavigate()
    const [email,    setEmail]    = useState('')
    const [password, setPassword] = useState('')
    const [showPw,   setShowPw]   = useState(false)
    const [error,    setError]    = useState('')
    const [loading,  setLoading]  = useState(false)

    useEffect(() => { if (isPlatformAuthed()) navigate('/platform', { replace: true }) }, [navigate])

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')
        setLoading(true)
        try {
            const data = await platformLogin(email.trim(), password)
            storePlatformSession(data)
            navigate('/platform', { replace: true })
        } catch (err) {
            setError(errorMessage(err, 'Could not sign in. Check your credentials.'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="platform-login">
            <form className="platform-login-card" onSubmit={handleSubmit}>
                <div className="platform-login-brand">
                    <img src={logo} alt="Imboni" />
                    <div>
                        <h1>Imboni Platform</h1>
                        <p>Operator console — all schools</p>
                    </div>
                </div>

                {error && (
                    <div className="platform-login-error" role="alert">
                        <span className="material-symbols-rounded">error</span>
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
                            <span className="material-symbols-rounded">{showPw ? 'visibility_off' : 'visibility'}</span>
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
