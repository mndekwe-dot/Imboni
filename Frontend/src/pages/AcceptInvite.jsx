import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { acceptInvitation, checkInvitation } from '../api/auth'
import '../styles/reset-password.css'

const SPECIAL_CHAR_RE = /[!@#$%^&*(),.?":{}|<>_\-+=[\]\\/~`;']/

/**
 * Where a newly provisioned school arrives from its invitation email.
 *
 * The account already exists but has no usable password: provisioning
 * deliberately mints none, so nothing about this school's first credential ever
 * passes through an operator's hands. This page is where the school chooses it.
 *
 * The link is checked BEFORE the form is drawn. An expired or already-used
 * invitation should say so immediately rather than after someone has typed a
 * password twice and pressed a button.
 *
 * Reuses reset-password.css: this is the same act -- choosing a password from a
 * one-time link -- and it should not look like a different product.
 */
export function AcceptInvite() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const [params] = useSearchParams()
    const token = params.get('token') || ''

    const [checking, setChecking] = useState(true)
    const [invite, setInvite] = useState(null)
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        let cancelled = false
        checkInvitation(token)
            .then(data => { if (!cancelled) setInvite(data) })
            .catch(err => { if (!cancelled) setError(err.message) })
            .finally(() => { if (!cancelled) setChecking(false) })
        return () => { cancelled = true }
    }, [token])

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
            await acceptInvitation(token, password)
            navigate('/login/admin', { state: { invitationAccepted: true } })
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    if (checking) {
        return (
            <div className="reset-password-page">
                <div className="reset-password-card">
                    <p className="reset-password-subtitle">{t('acceptInvite.checking')}</p>
                </div>
            </div>
        )
    }

    // A dead link is a dead end, so say what to do next instead of showing a
    // form that cannot succeed.
    if (!invite?.valid) {
        return (
            <div className="reset-password-page">
                <div className="reset-password-card">
                    <div className="reset-password-icon">
                        <span className="material-symbols-rounded" aria-hidden="true">link_off</span>
                    </div>
                    <h1 className="reset-password-title">{t('acceptInvite.deadTitle')}</h1>
                    <p className="reset-password-subtitle">{error || t('acceptInvite.deadBody')}</p>
                    <Link to="/login/admin" className="reset-password-back">
                        <span className="material-symbols-rounded" aria-hidden="true">arrow_back</span>
                        {t('acceptInvite.toSignIn')}
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="reset-password-page">
            <div className="reset-password-card">
                <div className="reset-password-icon">
                    <span className="material-symbols-rounded" aria-hidden="true">key</span>
                </div>

                <h1 className="reset-password-title">
                    {invite.school_name
                        ? t('acceptInvite.titleNamed', { school: invite.school_name })
                        : t('acceptInvite.title')}
                </h1>
                <p className="reset-password-subtitle">
                    {t('acceptInvite.subtitle', { email: invite.email })}
                </p>

                {error && <p className="reset-password-error">{error}</p>}

                <form onSubmit={handleSubmit}>
                    <div className="reset-password-field">
                        <label className="reset-password-label" htmlFor="password">
                            {t('acceptInvite.password')}
                        </label>
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
                                aria-label={t('acceptInvite.toggleVisibility')}
                            >
                                <span className="material-symbols-rounded" aria-hidden="true">
                                    {showPassword ? 'visibility_off' : 'visibility'}
                                </span>
                            </button>
                        </div>
                    </div>

                    <div className="reset-password-field">
                        <label className="reset-password-label" htmlFor="confirm">
                            {t('acceptInvite.confirm')}
                        </label>
                        <div className="reset-password-input-wrap">
                            <input
                                id="confirm"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••••••"
                                value={confirm}
                                onChange={e => setConfirm(e.target.value)}
                                autoComplete="new-password"
                                required
                            />
                        </div>
                    </div>

                    <ul className="reset-password-rules">
                        <li className={hasMinLength ? 'reset-password-rule-met' : ''}>
                            <span className="material-symbols-rounded" aria-hidden="true">
                                {hasMinLength ? 'check_circle' : 'radio_button_unchecked'}
                            </span>
                            {t('acceptInvite.ruleLength')}
                        </li>
                        <li className={hasSpecialChar ? 'reset-password-rule-met' : ''}>
                            <span className="material-symbols-rounded" aria-hidden="true">
                                {hasSpecialChar ? 'check_circle' : 'radio_button_unchecked'}
                            </span>
                            {t('acceptInvite.ruleSpecial')}
                        </li>
                        <li className={passwordsMatch ? 'reset-password-rule-met' : ''}>
                            <span className="material-symbols-rounded" aria-hidden="true">
                                {passwordsMatch ? 'check_circle' : 'radio_button_unchecked'}
                            </span>
                            {t('acceptInvite.ruleMatch')}
                        </li>
                    </ul>

                    <button type="submit" className="reset-password-submit" disabled={!canSubmit}>
                        {saving ? t('acceptInvite.saving') : t('acceptInvite.submit')}
                    </button>
                </form>
            </div>
        </div>
    )
}
