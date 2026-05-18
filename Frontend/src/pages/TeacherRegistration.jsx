import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import { verifyInvitation, completeRegistration } from '../api/auth'

const center = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    textAlign: 'center',
    padding: '2rem',
}

export function TeacherRegistration() {
    const { uid, token } = useParams()
    const navigate = useNavigate()

    const [invite,     setInvite]     = useState(null)
    const [loading,    setLoading]    = useState(true)
    const [linkError,  setLinkError]  = useState('')
    const [form,       setForm]       = useState({ username: '', password: '', password2: '' })
    const [submitting, setSubmitting] = useState(false)
    const [formError,  setFormError]  = useState('')
    const [done,       setDone]       = useState(false)

    useEffect(() => {
        verifyInvitation(uid, token)
            .then(res => setInvite(res.data))
            .catch(() => setLinkError('This invitation link is invalid or has already been used.'))
            .finally(() => setLoading(false))
    }, [uid, token])

    async function handleSubmit(e) {
        e.preventDefault()
        if (form.password !== form.password2) { setFormError('Passwords do not match'); return }
        if (form.password.length < 8)         { setFormError('Password must be at least 8 characters'); return }
        setSubmitting(true); setFormError('')
        try {
            await completeRegistration({ uid, token, username: form.username, password: form.password, password2: form.password2 })
            setDone(true)
        } catch (err) {
            const data = err.response?.data
            setFormError(
                data?.detail ||
                data?.password?.[0] ||
                data?.username?.[0] ||
                'Registration failed. Please try again.'
            )
        } finally { setSubmitting(false) }
    }

    if (loading) return <div style={center}><p>Verifying your link...</p></div>

    if (linkError) return (
        <div style={center}>
            <span className="material-symbols-rounded" style={{ fontSize: '3rem', color: 'var(--danger)' }}>link_off</span>
            <h2>Link Invalid</h2>
            <p style={{ color: 'var(--muted)', maxWidth: '24rem' }}>{linkError}</p>
            <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Contact your Director of Studies to resend the invitation.</p>
        </div>
    )

    if (done) return (
        <div style={center}>
            <span className="material-symbols-rounded" style={{ fontSize: '4rem', color: 'var(--success)' }}>check_circle</span>
            <h1>Account Created!</h1>
            <p style={{ color: 'var(--muted)', maxWidth: '24rem' }}>
                Welcome to Imboni, {invite?.first_name}. Your account is ready. Log in to see your assigned classes and schedule.
            </p>
            <button className="btn btn-primary" style={{ marginTop: '0.5rem' }} onClick={() => navigate('/login/teacher')}>
                Go to Teacher Login
            </button>
        </div>
    )

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)', padding: '2rem' }}>
            <div style={{ width: '100%', maxWidth: '440px' }}>

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '2.5rem', color: 'var(--primary)' }}>school</span>
                    <h1 style={{ marginTop: '0.5rem', fontSize: '1.5rem', fontWeight: 700 }}>Complete Your Registration</h1>
                    <p style={{ color: 'var(--muted)', marginTop: '0.25rem', fontSize: '0.9rem' }}>
                        You have been invited as a <strong>Teacher</strong> at Imboni School.
                    </p>
                </div>

                <div className="card" style={{ padding: '1.75rem' }}>
                    <form onSubmit={handleSubmit}>

                        {/* Pre-filled read-only fields from invitation */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">First Name</label>
                                <input className="form-control" value={invite?.first_name || ''} disabled />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Last Name</label>
                                <input className="form-control" value={invite?.last_name || ''} disabled />
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label className="form-label">Email</label>
                            <input className="form-control" value={invite?.email || ''} disabled />
                        </div>

                        <hr style={{ margin: '1rem 0', borderColor: 'var(--border)' }} />

                        {/* Fields the teacher sets themselves */}
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label className="form-label">Choose a Username *</label>
                            <input className="form-control" placeholder="e.g. j.habimana"
                                value={form.username}
                                onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                                required autoFocus />
                        </div>

                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label className="form-label">Password * (min 8 characters)</label>
                            <input className="form-control" type="password" placeholder="Choose a strong password"
                                value={form.password}
                                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                required />
                        </div>

                        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                            <label className="form-label">Confirm Password *</label>
                            <input className="form-control" type="password" placeholder="Repeat your password"
                                value={form.password2}
                                onChange={e => setForm(p => ({ ...p, password2: e.target.value }))}
                                required />
                        </div>

                        {formError && (
                            <p style={{ color: 'var(--danger)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                                {formError}
                            </p>
                        )}

                        <button className="btn btn-primary" style={{ width: '100%' }} type="submit" disabled={submitting}>
                            {submitting ? 'Creating Account...' : 'Complete Registration'}
                        </button>
                    </form>
                </div>

                <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem', marginTop: '1rem' }}>
                    Having trouble? Contact your Director of Studies.
                </p>
            </div>
        </div>
    )
}
