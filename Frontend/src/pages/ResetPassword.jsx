import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router'
import { confirmPasswordReset } from '../api/auth'
import '../styles/reset-password.css'

const SPECIAL_CHAR_RE = /[!@#$%^&*(),.?":{}|<>_\-+=[\]\\/~`;']/

export function ResetPassword() {
    const { uid, token } = useParams()
    const navigate = useNavigate()

    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const hasMinLength = password.length >= 8
    const hasSpecialChar = SPECIAL_CHAR_RE.test(password)
    const passwordsMatch = password && confirm && password === confirm
    const canSubmit = hasMinLength && hasSpecialChar && passwordsMatch && !saving

    async function handleSubmit(e) {
        e.preventDefault()
        if (!canSubmit) return
        setSaving(true)
        setError('')
        try {
            await confirmPasswordReset(uid, token, password)
            navigate('/login', { state: { passwordReset: true } })
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="reset-password-page">
            <div className="reset-password-card">
                <div className="reset-password-icon">
                    <span className="material-symbols-rounded">lock</span>
                </div>

                <h1 className="reset-password-title">Set new password</h1>
                <p className="reset-password-subtitle">
                    Your new password must be different to previously used passwords.
                </p>

                {error && <p className="reset-password-error">{error}</p>}

                <form onSubmit={handleSubmit}>
                    <div className="reset-password-field">
                        <label className="reset-password-label" htmlFor="password">Password</label>
                        <div className="reset-password-input-wrap">
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                autoComplete="new-password"
                                required
                            />
                            <button
                                type="button"
                                className="reset-password-toggle"
                                onClick={() => setShowPassword(s => !s)}
                                aria-label="Toggle password visibility"
                            >
                                <span className="material-symbols-rounded">
                                    {showPassword ? 'visibility_off' : 'visibility'}
                                </span>
                            </button>
                        </div>
                    </div>

                    <div className="reset-password-field">
                        <label className="reset-password-label" htmlFor="confirm">Confirm password</label>
                        <div className="reset-password-input-wrap">
                            <input
                                id="confirm"
                                type={showConfirm ? 'text' : 'password'}
                                placeholder="••••••••••••"
                                value={confirm}
                                onChange={e => setConfirm(e.target.value)}
                                autoComplete="new-password"
                                required
                            />
                            <button
                                type="button"
                                className="reset-password-toggle"
                                onClick={() => setShowConfirm(s => !s)}
                                aria-label="Toggle password visibility"
                            >
                                <span className="material-symbols-rounded">
                                    {showConfirm ? 'visibility_off' : 'visibility'}
                                </span>
                            </button>
                        </div>
                    </div>

                    <ul className="reset-password-rules">
                        <li className={hasMinLength ? 'reset-password-rule-met' : ''}>
                            <span className="material-symbols-rounded">
                                {hasMinLength ? 'check_circle' : 'radio_button_unchecked'}
                            </span>
                            Must be at least 8 characters
                        </li>
                        <li className={hasSpecialChar ? 'reset-password-rule-met' : ''}>
                            <span className="material-symbols-rounded">
                                {hasSpecialChar ? 'check_circle' : 'radio_button_unchecked'}
                            </span>
                            Must contain one special character
                        </li>
                    </ul>

                    <button type="submit" className="reset-password-submit" disabled={!canSubmit}>
                        {saving ? 'Resetting…' : 'Reset password'}
                    </button>
                </form>

                <Link to="/login" className="reset-password-back">
                    <span className="material-symbols-rounded">arrow_back</span>
                    Back to login
                </Link>
            </div>
        </div>
    )
}
