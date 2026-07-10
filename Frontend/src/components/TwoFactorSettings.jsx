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
        <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
            <h4 style={{ margin: '0 0 0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className="material-symbols-rounded">encrypted</span>
                Two-Factor Authentication
            </h4>
            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Add a second step at sign-in using an authenticator app (Google
                Authenticator, Authy, …). Strongly recommended for staff accounts.
            </p>

            {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>}

            {/* Enabled + idle → status badge + disable */}
            {enabled && stage === 'idle' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--success, #16a34a)', fontWeight: 600 }}>
                        <span className="material-symbols-rounded">check_circle</span> Enabled
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
                <div style={{ maxWidth: 360 }}>
                    <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                        1. Scan this QR code with your authenticator app:
                    </p>
                    <img src={setupData.qr} alt="2FA QR code" width={180} height={180}
                         style={{ background: '#fff', padding: 8, borderRadius: 8, border: '1px solid var(--border)' }} />
                    <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', margin: '0.5rem 0' }}>
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
                    <div className="form-actions" style={{ gap: '0.5rem' }}>
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
                <div style={{ maxWidth: 360 }}>
                    <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 600 }}>
                        Save these backup codes somewhere safe. Each works once if you lose your device.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem', fontFamily: 'monospace',
                                  background: 'var(--muted)', padding: '0.75rem', borderRadius: 8, marginBottom: '0.75rem' }}>
                        {backupCodes.map(c => <span key={c}>{c}</span>)}
                    </div>
                    <button className="btn btn-primary" onClick={() => setStage('idle')}>
                        I've saved them
                    </button>
                </div>
            )}

            {/* Disable → password confirm */}
            {stage === 'disable' && (
                <div style={{ maxWidth: 360 }}>
                    <div className="form-group">
                        <label className="form-label">Confirm your password to disable 2FA</label>
                        <input
                            className="form-input" type="password" placeholder="Your password"
                            value={password} autoFocus
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>
                    <div className="form-actions" style={{ gap: '0.5rem' }}>
                        <button className="btn btn-danger" onClick={confirmDisable} disabled={busy || !password}>
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
