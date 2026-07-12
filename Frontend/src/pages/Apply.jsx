import { useState } from 'react'
import { Link } from 'react-router'
import { applyToImboni } from '../api/platform'
import { errorMessage } from '../utils/errors'
import logo from '../assets/images/imboni-logo.png'
import '../styles/components.css'
import '../styles/platform.css'

const emptyForm = () => ({
    school_name: '', desired_subdomain: '', contact_name: '', contact_email: '',
    contact_phone: '', country: '', city: '', student_estimate: '', plan_interest: '', message: '',
})

export function Apply() {
    const [form, setForm]     = useState(emptyForm())
    const [saving, setSaving] = useState(false)
    const [error, setError]   = useState('')
    const [done, setDone]     = useState(false)

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    async function submit(e) {
        e.preventDefault()
        setSaving(true); setError('')
        try {
            const payload = { ...form }
            if (payload.student_estimate === '') delete payload.student_estimate
            await applyToImboni(payload)
            setDone(true)
        } catch (err) {
            setError(errorMessage(err, 'Could not submit your application. Please try again.'))
        } finally { setSaving(false) }
    }

    return (
        <div className="platform-login is-top">
            <div className="platform-login-card is-wide">
                <div className="platform-login-brand">
                    <img src={logo} alt="Imboni" />
                    <div>
                        <h1>Bring your school to Imboni</h1>
                        <p>Apply to get your school onboarded</p>
                    </div>
                </div>

                {done ? (
                    <div>
                        <div className="pf-callout pf-row">
                            <span className="material-symbols-rounded">check_circle</span>
                            Application received — our team will review it and get back to you.
                        </div>
                        <Link to="/" className="btn btn-outline pf-mt">Back to home</Link>
                    </div>
                ) : (
                    <form onSubmit={submit}>
                        {error && (
                            <div className="platform-login-error" role="alert">
                                <span className="material-symbols-rounded">error</span>{error}
                            </div>
                        )}
                        <div className="platform-form-grid">
                            <label>School name<input className="form-input" required value={form.school_name} onChange={e => set('school_name', e.target.value)} /></label>
                            <label>Desired address (subdomain)
                                <input className="form-input" required placeholder="greenvalley" value={form.desired_subdomain}
                                       onChange={e => set('desired_subdomain', e.target.value.toLowerCase())} />
                            </label>
                            <label>Your name<input className="form-input" required value={form.contact_name} onChange={e => set('contact_name', e.target.value)} /></label>
                            <label>Email<input className="form-input" type="email" required value={form.contact_email} onChange={e => set('contact_email', e.target.value)} /></label>
                            <label>Phone<input className="form-input" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} /></label>
                            <label>Country<input className="form-input" value={form.country} onChange={e => set('country', e.target.value)} /></label>
                            <label>City<input className="form-input" value={form.city} onChange={e => set('city', e.target.value)} /></label>
                            <label>Approx. students<input className="form-input" type="number" min="0" value={form.student_estimate} onChange={e => set('student_estimate', e.target.value)} /></label>
                            <label>Plan interest
                                <select className="form-input" value={form.plan_interest} onChange={e => set('plan_interest', e.target.value)}>
                                    <option value="">— not sure —</option>
                                    <option value="basic">Basic</option><option value="premium">Premium</option>
                                </select>
                            </label>
                        </div>
                        <label className="pf-field pf-mt">
                            <span className="pf-field-label">Anything else?</span>
                            <textarea className="form-input" rows={3} value={form.message} onChange={e => set('message', e.target.value)} placeholder="Tell us about your school…" />
                        </label>
                        <button className="btn btn-primary pf-full pf-mt" disabled={saving}>
                            {saving ? 'Submitting…' : 'Submit application'}
                        </button>
                        <p className="platform-login-note">
                            Already have an account? <Link to="/login">Sign in</Link>.
                        </p>
                    </form>
                )}
            </div>
        </div>
    )
}
