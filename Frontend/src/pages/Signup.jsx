import { useState } from 'react'
import { Link } from 'react-router'
import '../styles/components.css'

const SIGNUP_URL = '/imboni/onboarding/signup/'

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Public marketing domain used only for the live subdomain preview.
const BASE_DOMAIN = 'imboni.com'

const EMPTY_FORM = {
    school_name: '',
    subdomain: '',
    admin_first_name: '',
    admin_last_name: '',
    admin_email: '',
    admin_password: '',
}

// Keep the subdomain to the characters the backend accepts: lowercase
// letters, numbers and hyphens.
function sanitizeSubdomain(value) {
    return value.toLowerCase().replace(/[^a-z0-9-]/g, '')
}

export function Signup() {
    const [form, setForm] = useState(EMPTY_FORM)
    const [fieldErrors, setFieldErrors] = useState({})
    const [generalError, setGeneralError] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [result, setResult] = useState(null)

    function update(name, value) {
        setForm(prev => ({ ...prev, [name]: value }))
        // Clear an error for a field as soon as the user edits it.
        if (fieldErrors[name]) {
            setFieldErrors(prev => {
                const next = { ...prev }
                delete next[name]
                return next
            })
        }
    }

    // Local required-field check before we bother the server.
    function validate() {
        const errs = {}
        if (!form.school_name.trim())       errs.school_name = ['School name is required.']
        if (!form.subdomain.trim())         errs.subdomain = ['Please choose a subdomain.']
        if (!form.admin_first_name.trim())  errs.admin_first_name = ['First name is required.']
        if (!form.admin_last_name.trim())   errs.admin_last_name = ['Last name is required.']
        if (!form.admin_email.trim())       errs.admin_email = ['Email is required.']
        if (!form.admin_password)           errs.admin_password = ['Password is required.']
        else if (form.admin_password.length < 8) errs.admin_password = ['Password must be at least 8 characters.']
        return errs
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setGeneralError('')

        const localErrors = validate()
        if (Object.keys(localErrors).length > 0) {
            setFieldErrors(localErrors)
            return
        }

        setSubmitting(true)
        setFieldErrors({})
        try {
            // Unauthenticated, same-origin call — do NOT use the auth client.
            const res = await fetch(SIGNUP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })

            let data = null
            try { data = await res.json() } catch { /* body may be empty */ }

            // Accepted: provisioning runs in the background — poll for completion.
            if (res.status === 202 && data?.status_url) {
                const outcome = await pollUntilReady(data.status_url)
                if (outcome.ok) {
                    setResult({
                        school_name: outcome.data.school_name,
                        subdomain:   outcome.data.subdomain,
                        admin_email: outcome.data.admin_email,
                        url:         outcome.data.url,
                        message:     'School created. You can now sign in.',
                    })
                } else {
                    setGeneralError(outcome.detail)
                }
                setSubmitting(false)
                return
            }

            // DRF returns { field: [messages] } for validation errors, or a
            // { detail: "..." } for general failures.
            if (data && typeof data === 'object' && !data.detail) {
                setFieldErrors(data)
                setGeneralError('Please fix the highlighted fields and try again.')
            } else {
                setGeneralError(data?.detail || 'Something went wrong creating your school. Please try again.')
            }
            setSubmitting(false)
        } catch {
            setGeneralError('Could not reach the server. Check your connection and try again.')
            setSubmitting(false)
        }
    }

    // Poll the status endpoint until the school is ready or failed. Checks once
    // immediately, then every 2s (in case provisioning is quick).
    async function pollUntilReady(statusUrl) {
        for (let i = 0; i < 46; i++) {          // ~90s ceiling
            let data = null
            try {
                const res = await fetch(statusUrl, { headers: { Accept: 'application/json' } })
                if (res.ok) data = await res.json().catch(() => null)
            } catch { /* transient network blip — retry after the wait */ }

            if (data?.status === 'ready')  return { ok: true, data }
            if (data?.status === 'failed') return { ok: false, detail: data.detail || 'Provisioning failed. Please try again.' }

            await sleep(2000)                   // 'pending' or blip — wait, then retry
        }
        return {
            ok: false,
            detail: 'This is taking longer than expected. Your school may still be finishing setup — try signing in shortly.',
        }
    }

    // ── Success confirmation ──
    if (result) {
        return (
            <div style={pageStyle}>
                <div style={{ width: '100%', maxWidth: '480px', textAlign: 'center' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '4rem', color: 'var(--success)' }}>check_circle</span>
                    <h1 style={{ marginTop: '0.5rem', fontSize: '1.6rem', fontWeight: 700 }}>
                        {result.school_name} is ready!
                    </h1>
                    <p style={{ color: 'var(--muted)', marginTop: '0.5rem' }}>
                        {result.message || 'School created. You can now sign in.'}
                    </p>

                    <div className="card" style={{ padding: '1.5rem', marginTop: '1.5rem', textAlign: 'left' }}>
                        <div style={{ marginBottom: '1rem' }}>
                            <div className="form-label" style={{ marginBottom: '0.35rem' }}>Your school address</div>
                            <a href={result.url} style={{ color: 'var(--primary)', fontWeight: 600, wordBreak: 'break-all' }}>
                                {result.url}
                            </a>
                        </div>
                        <div>
                            <div className="form-label" style={{ marginBottom: '0.35rem' }}>Administrator email</div>
                            <div style={{ wordBreak: 'break-all' }}>{result.admin_email}</div>
                        </div>
                    </div>

                    <a href={result.url} className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem', justifyContent: 'center' }}>
                        Go to {result.subdomain} and sign in
                    </a>
                    <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '1rem' }}>
                        Sign in there with the administrator email and password you just set.
                    </p>
                </div>
            </div>
        )
    }

    // ── Sign-up form ──
    const previewHost = form.subdomain ? `${form.subdomain}.${BASE_DOMAIN}` : `yourschool.${BASE_DOMAIN}`

    return (
        <div style={pageStyle}>
            <div style={{ width: '100%', maxWidth: '480px' }}>

                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '2.5rem', color: 'var(--primary)' }}>add_business</span>
                    <h1 style={{ marginTop: '0.5rem', fontSize: '1.5rem', fontWeight: 700 }}>Sign up your school</h1>
                    <p style={{ color: 'var(--muted)', marginTop: '0.25rem', fontSize: '0.9rem' }}>
                        Create your school's own Imboni space in a couple of minutes.
                    </p>
                </div>

                <div className="card" style={{ padding: '1.75rem' }}>
                    <form onSubmit={handleSubmit} noValidate>

                        <Field label="School name *" error={fieldErrors.school_name}>
                            <input className="form-control" placeholder="e.g. Green Hills Academy"
                                value={form.school_name}
                                onChange={e => update('school_name', e.target.value)}
                                autoFocus />
                        </Field>

                        <Field
                            label="Subdomain *"
                            error={fieldErrors.subdomain}
                            help="Letters, numbers, hyphens.">
                            <input className="form-control" placeholder="greenhills"
                                value={form.subdomain}
                                onChange={e => update('subdomain', sanitizeSubdomain(e.target.value))}
                                autoCapitalize="none" autoCorrect="off" spellCheck="false" />
                            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.35rem' }}>
                                Your school will live at{' '}
                                <strong style={{ color: 'var(--primary)' }}>{previewHost}</strong>
                            </div>
                        </Field>

                        <div className="form-row-2" style={{ marginBottom: '1rem' }}>
                            <Field label="Admin first name *" error={fieldErrors.admin_first_name} noMargin>
                                <input className="form-control" placeholder="Jane"
                                    value={form.admin_first_name}
                                    onChange={e => update('admin_first_name', e.target.value)} />
                            </Field>
                            <Field label="Admin last name *" error={fieldErrors.admin_last_name} noMargin>
                                <input className="form-control" placeholder="Doe"
                                    value={form.admin_last_name}
                                    onChange={e => update('admin_last_name', e.target.value)} />
                            </Field>
                        </div>

                        <Field label="Admin email *" error={fieldErrors.admin_email}>
                            <input className="form-control" type="email" placeholder="jane@greenhills.edu"
                                value={form.admin_email}
                                onChange={e => update('admin_email', e.target.value)}
                                autoComplete="email" />
                        </Field>

                        <Field label="Admin password *" error={fieldErrors.admin_password} help="At least 8 characters.">
                            <input className="form-control" type="password" placeholder="Choose a strong password"
                                value={form.admin_password}
                                onChange={e => update('admin_password', e.target.value)}
                                autoComplete="new-password" />
                        </Field>

                        {generalError && (
                            <p style={{ color: 'var(--danger)', fontSize: '0.875rem', margin: '0 0 0.75rem' }}>
                                {generalError}
                            </p>
                        )}

                        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} type="submit" disabled={submitting}>
                            {submitting ? 'Creating your school…' : 'Create school'}
                        </button>

                        {submitting && (
                            <p style={{ color: 'var(--muted)', fontSize: '0.8rem', textAlign: 'center', marginTop: '0.75rem' }}>
                                This can take a moment while we set everything up.
                            </p>
                        )}
                    </form>
                </div>

                <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem', marginTop: '1rem' }}>
                    Already have a school on Imboni? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Sign in</Link>
                </p>
            </div>
        </div>
    )
}

const pageStyle = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--background)',
    padding: '2rem',
}

// Small labelled field wrapper that renders an inline error underneath.
function Field({ label, error, help, noMargin, children }) {
    return (
        <div className="form-group" style={{ marginBottom: noMargin ? 0 : '1rem' }}>
            <label className="form-label">{label}</label>
            {children}
            {help && !error && (
                <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{help}</div>
            )}
            {error && (
                <div style={{ fontSize: '0.8rem', color: 'var(--danger)' }}>
                    {Array.isArray(error) ? error.join(' ') : String(error)}
                </div>
            )}
        </div>
    )
}
