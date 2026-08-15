import { useState } from 'react'
import { Link } from 'react-router'
import { PublicLayout } from '../components/PublicLayout'
import { findMySchool } from '../api/discovery'
import { errorMessage } from '../utils/errors'

/**
 * Recovery for the subdomain model: a user who has lost their school's address.
 *
 * The backend answers identically whether or not the address is registered, so
 * this page must NOT try to be more helpful than that. No "no account found",
 * no different styling for a hit -- either would turn the form into an oracle
 * telling a stranger which school a given parent's child attends.
 *
 * There is exactly one success state, and it is deliberately vague.
 */
export function FindSchool() {
    const [email, setEmail] = useState('')
    const [sent, setSent] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)

    async function handleSubmit(e) {
        e.preventDefault()
        if (busy) return

        setBusy(true)
        setError('')
        try {
            const res = await findMySchool(email)
            setMessage(res?.detail || 'If that address is registered, we have sent it an email.')
            setSent(true)
        } catch (err) {
            // Only genuine failures surface: rate limiting, or the server being
            // unreachable. Never "we couldn't find you" -- the API does not say
            // that, and neither should this.
            setError(errorMessage(err, 'Could not send the reminder. Please try again shortly.'))
        } finally {
            setBusy(false)
        }
    }

    return (
        <PublicLayout
            title="Find your school"
            subtitle="Every school on Imboni has its own web address. Lost yours? Enter your email and we will send it to you."
        >
            <div className="pub-prose">
                {sent ? (
                    <div className="pub-find-done">
                        <span className="material-symbols-rounded" aria-hidden="true">mark_email_read</span>
                        <p>{message}</p>
                        <p className="pub-find-note">
                            The email lists every school your address is registered
                            with. If nothing arrives within a few minutes, check
                            your spam folder, then ask your school office to
                            confirm which address they hold for you.
                        </p>
                        <Link to="/" className="pub-plan-cta">Back to home</Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="pub-find-form">
                        <label htmlFor="find-email">Your email address</label>
                        <input
                            id="find-email"
                            type="email"
                            required
                            autoComplete="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            disabled={busy}
                        />

                        {error && <p className="pub-find-error" role="alert">{error}</p>}

                        <button type="submit" className="pub-plan-cta pub-plan-cta--solid" disabled={busy}>
                            {busy ? 'Sending...' : 'Email me my school link'}
                        </button>

                        <p className="pub-find-note">
                            Use the address your school has on file for you. For a
                            parent that is usually the one the school writes to;
                            for staff and students it is your school email.
                        </p>
                    </form>
                )}

                <h2>Why does my school have its own address?</h2>
                <p>
                    Each school on Imboni is kept completely separate, down to its
                    own database. Your school&apos;s web address is what tells the
                    system which school you belong to, which is part of how one
                    school&apos;s records can never appear in another&apos;s.
                </p>
                <p>
                    It looks like <strong>yourschool.imboni.tech</strong>. Bookmark
                    it once and you will not need this page again.
                </p>

                <h2>Still stuck?</h2>
                <p>
                    Your school office can tell you the address and confirm which
                    email they hold for you. If you are setting up a new school
                    rather than joining one,{' '}
                    <Link to="/signup">sign up here</Link> or{' '}
                    <Link to="/contact">talk to us</Link>.
                </p>
            </div>
        </PublicLayout>
    )
}
