import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { platformLogin, storePlatformSession, isPlatformAuthed } from '../../api/platform'
import { errorMessage } from '../../utils/errors'
import '../../styles/platform.css'

export function PlatformLogin() {
    const navigate = useNavigate()
    const [email,    setEmail]    = useState('')
    const [password, setPassword] = useState('')
    const [showPw,   setShowPw]   = useState(false)
    const [error,    setError]    = useState('')
    const [loading,  setLoading]  = useState(false)

    // Already signed in? Go straight to the console.
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
        <div className="platform-auth">
            <form className="platform-auth-card" onSubmit={handleSubmit}>
                <div className="platform-brand">
                    <span className="material-symbols-rounded">hub</span>
                    <div>
                        <h1>Imboni Platform</h1>
                        <p>Operator console — all schools</p>
                    </div>
                </div>

                {error && (
                    <div className="platform-error" role="alert">
                        <span className="material-symbols-rounded">error</span>
                        {error}
                    </div>
                )}

                <label className="platform-label" htmlFor="pf-email">Email</label>
                <input
                    id="pf-email"
                    className="platform-input"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@imboni.com"
                />

                <label className="platform-label" htmlFor="pf-password">Password</label>
                <div className="platform-input-wrap">
                    <input
                        id="pf-password"
                        className="platform-input"
                        type={showPw ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Enter your password"
                    />
                    <button type="button" className="platform-pw-toggle"
                            aria-label="Toggle password visibility"
                            onClick={() => setShowPw(p => !p)}>
                        <span className="material-symbols-rounded">{showPw ? 'visibility_off' : 'visibility'}</span>
                    </button>
                </div>

                <button type="submit" className="platform-btn platform-btn-primary" disabled={loading} style={{ marginTop: '1rem', width: '100%' }}>
                    {loading ? 'Signing in…' : 'Sign in'}
                </button>

                <p className="platform-auth-note">
                    Restricted to Imboni platform operators. School staff sign in on their school's own address.
                </p>
            </form>
        </div>
    )
}
