import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import { verifyInvitation, completeRegistration } from '../api/auth'
import '../styles/registration.css'

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

    if (loading) return <div className="reg-center"><p>Verifying your link...</p></div>

    if (linkError) return (
        <div className="reg-center">
            <span className="material-symbols-rounded reg-icon-danger">link_off</span>
            <h2>Link Invalid</h2>
            <p className="reg-msg">{linkError}</p>
            <p className="reg-msg-sm">Contact your Director of Studies to resend the invitation.</p>
        </div>
    )

    if (done) return (
        <div className="reg-center">
            <span className="material-symbols-rounded reg-icon-success">check_circle</span>
            <h1>Account Created!</h1>
            <p className="reg-msg">
                Welcome to Imboni, {invite?.first_name}. Your account is ready. Log in to see your assigned classes and schedule.
            </p>
            <button className="btn btn-primary u-mt-sm" onClick={() => navigate('/login/teacher')}>
                Go to Teacher Login
            </button>
        </div>
    )

    return (
        <div className="reg-page">
            <div className="reg-wrap">

                {/* Header */}
                <div className="reg-header">
                    <span className="material-symbols-rounded reg-header-icon">school</span>
                    <h1 className="reg-title">Complete Your Registration</h1>
                    <p className="reg-sub">
                        You have been invited as a <strong>Teacher</strong> at Imboni School.
                    </p>
                </div>

                <div className="card reg-card">
                    <form onSubmit={handleSubmit}>

                        {/* Pre-filled read-only fields from invitation */}
                        <div className="u-grid-2 u-mb">
                            <div className="form-group">
                                <label className="form-label">First Name</label>
                                <input className="form-control" value={invite?.first_name || ''} disabled />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Last Name</label>
                                <input className="form-control" value={invite?.last_name || ''} disabled />
                            </div>
                        </div>

                        <div className="form-group u-mb">
                            <label className="form-label">Email</label>
                            <input className="form-control" value={invite?.email || ''} disabled />
                        </div>

                        <hr className="reg-hr" />

                        {/* Fields the teacher sets themselves */}
                        <div className="form-group u-mb">
                            <label className="form-label">Choose a Username *</label>
                            <input className="form-control" placeholder="e.g. j.habimana"
                                value={form.username}
                                onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                                required autoFocus />
                        </div>

                        <div className="form-group u-mb">
                            <label className="form-label">Password * (min 8 characters)</label>
                            <input className="form-control" type="password" placeholder="Choose a strong password"
                                value={form.password}
                                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                required />
                        </div>

                        <div className="form-group u-mb-lg">
                            <label className="form-label">Confirm Password *</label>
                            <input className="form-control" type="password" placeholder="Repeat your password"
                                value={form.password2}
                                onChange={e => setForm(p => ({ ...p, password2: e.target.value }))}
                                required />
                        </div>

                        {formError && (
                            <p className="reg-error">
                                {formError}
                            </p>
                        )}

                        <button className="btn btn-primary u-full" type="submit" disabled={submitting}>
                            {submitting ? 'Creating Account...' : 'Complete Registration'}
                        </button>
                    </form>
                </div>

                <p className="reg-note">
                    Having trouble? Contact your Director of Studies.
                </p>
            </div>
        </div>
    )
}
