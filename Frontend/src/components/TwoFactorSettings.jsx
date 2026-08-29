import { useEffect, useState } from 'react'
import {
    getTwoFactorStatus, setupTwoFactor, verifyTwoFactor, disableTwoFactor,
} from '../api/auth'

/**
 * Two-factor (TOTP) management, shown inside the account Security section.
 * Walks a user through enable → scan QR → confirm code → save backup codes,
 * and lets them disable it again (password-confirmed).
 */
export function TwoFactorSettings() {
    const [enabled,  setEnabled]  = useState(null)   // null = still loading
    const [stage,    setStage]    = useState('idle') // idle | setup | backup | disable
    const [setupData, setSetupData] = useState(null) // { secret, qr, otpauth_uri }
    const [code,     setCode]     = useState('')
    const [password, setPassword] = useState('')
    const [backupCodes, setBackupCodes] = useState([])
    const [busy,     setBusy]     = useState(false)
    const [error,    setError]    = useState('')

    useEffect(() => {
        getTwoFactorStatus()
            .then(res => setEnabled(res.data.enabled))
            .catch(() => setEnabled(false))
    }, [])

    async function beginSetup() {
        setError(''); setBusy(true)
        try {
            const res = await setupTwoFactor()
            setSetupData(res.data)
            setStage('setup')
        } catch (err) {
            setError(err.response?.data?.error || 'Could not start setup.')
        } finally { setBusy(false) }
    }

    async function confirmCode() {
        setError(''); setBusy(true)
        try {
            const res = await verifyTwoFactor(code.trim())
            setBackupCodes(res.data.backup_codes || [])
            setEnabled(true)
            setStage('backup')
            setCode('')
        } catch (err) {
            setError(err.response?.data?.error || 'Invalid code. Try again.')
        } finally { setBusy(false) }
    }

    async function confirmDisable() {
        setError(''); setBusy(true)
        try {
            await disableTwoFactor(password)
            setEnabled(false)
            setStage('idle')
            setPassword('')
        } catch (err) {
            setError(err.response?.data?.error || 'Password is incorrect.')
        } finally { setBusy(false) }
    }

    if (enabled === null) return null   // loading

    return (
        <div className="tfa-section">
            <h4 className="tfa-title">
                <span className="material-symbols-rounded" aria-hidden="true">encrypted</span>
                Two-Factor Authentication
            </h4>
            <p className="tfa-lead">
                Add a second step at sign-in using an authenticator app (Google
                Authenticator, Authy, …). Strongly recommended for staff accounts.
            </p>

            {error && <p className="tfa-error">{error}</p>}

            {/* Enabled + idle → status badge + disable */}
            {enabled && stage === 'idle' && (
                <div className="tfa-row">
                    <span className="tfa-enabled">
                        <span className="material-symbols-rounded" aria-hidden="true">check_circle</span> Enabled
                    </span>
                    <button className="btn btn-secondary" onClick={() => { setStage('disable'); setError('') }}>
                        Disable
                    </button>
                </div>
            )}

            {/* Disabled + idle → enable */}
            {!enabled && stage === 'idle' && (
                <button className="btn btn-primary" onClick={beginSetup} disabled={busy}>
                    {busy ? 'Starting…' : 'Enable two-factor'}
                </button>
            )}

            {/* Setup → QR + code entry */}
            {stage === 'setup' && setupData && (
                <div className="tfa-panel">
                    <p className="tfa-step">
                        1. Scan this QR code with your authenticator app:
                    </p>
                    <img src={setupData.qr} alt="2FA QR code" width={180} height={180} className="tfa-qr" />
                    <p className="tfa-hint">
                        Or enter this key manually: <code>{setupData.secret}</code>
                    </p>
                    <div className="form-group">
                        <label className="form-label">2. Enter the 6-digit code it shows</label>
                        <input
                            className="form-input" type="text" inputMode="numeric"
                            placeholder="123456" value={code} autoFocus
                            onChange={e => setCode(e.target.value)}
                        />
                    </div>
                    <div className="form-actions tfa-actions">
                        <button className="btn btn-primary" onClick={confirmCode} disabled={busy || !code}>
                            {busy ? 'Verifying…' : 'Verify and enable'}
                        </button>
                        <button className="btn btn-secondary" onClick={() => { setStage('idle'); setError('') }}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Backup codes — shown once */}
            {stage === 'backup' && (
                <div className="tfa-panel">
                    <p className="tfa-step tfa-step--strong">
                        Save these backup codes somewhere safe. Each works once if you lose your device.
                    </p>
                    <div className="tfa-codes">
                        {backupCodes.map(c => <span key={c}>{c}</span>)}
                    </div>
                    <button className="btn btn-primary" onClick={() => setStage('idle')}>
                        I've saved them
                    </button>
                </div>
            )}

            {/* Disable → password confirm */}
            {stage === 'disable' && (
                <div className="tfa-panel">
                    <div className="form-group">
                        <label className="form-label">Confirm your password to disable 2FA</label>
                        <input
                            className="form-input" type="password" placeholder="Your password"
                            value={password} autoFocus
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>
                    <div className="form-actions tfa-actions">
                        <button className="btn btn-primary btn-destructive" onClick={confirmDisable} disabled={busy || !password}>
                            {busy ? 'Disabling…' : 'Disable 2FA'}
                        </button>
                        <button className="btn btn-secondary" onClick={() => { setStage('idle'); setError(''); setPassword('') }}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
