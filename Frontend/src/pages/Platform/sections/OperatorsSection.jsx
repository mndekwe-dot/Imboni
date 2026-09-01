import { useCallback, useEffect, useState } from 'react'
import { Modal } from '../../../components/ui/Modal'
import {
    confirmMfaSetup, createOperator, getOperators, getPlatformMe, operatorCan,
    platformUser, resetOperatorMfa, startMfaSetup, storePlatformSession,
    updateOperator,
} from '../../../api/platform'
import { useToast } from '../../../context/ToastContext'
import { errorMessage } from '../../../utils/errors'

// What each role may do, in the operator's own words. Shown next to the picker
// because "commercial" means nothing until you say what it costs and grants.
const ROLES = [
    { value: 'support',    label: 'Support',    blurb: 'Answer tickets and read a school. Cannot change money or infrastructure.' },
    { value: 'commercial', label: 'Commercial', blurb: 'Contracts, payments and plans, plus everything Support can do.' },
    { value: 'operations', label: 'Operations', blurb: 'Provision, restrict and suspend schools, and manage operators. Requires two-factor.' },
]

const emptyForm = () => ({ email: '', name: '', role: 'support', password: '' })

/**
 * Who works here, and the operator's own second factor.
 *
 * Managing the roster is itself an operations action: granting a role is how
 * someone gets the power to switch a school off. But the MFA panel at the top
 * is for whoever is signed in, at any role -- an operations account that has
 * not enrolled holds the title and none of the powers, so it must always be
 * able to reach its own enrolment.
 */
export function OperatorsSection() {
    const toast = useToast()
    const me = platformUser()
    const canManage = operatorCan('operations')

    const [operators, setOperators] = useState([])
    const [loading, setLoading] = useState(true)
    const [adding, setAdding] = useState(false)
    const [form, setForm] = useState(emptyForm())
    const [saving, setSaving] = useState(false)

    // MFA enrolment for the signed-in operator.
    const [setup, setSetup] = useState(null)   // { secret, otpauth_uri }
    const [code, setCode] = useState('')

    const load = useCallback(async () => {
        if (!canManage) { setLoading(false); return }
        setLoading(true)
        try {
            setOperators(await getOperators())
        } catch (e) {
            toast.error(errorMessage(e, 'Could not load the operator list.'))
        } finally {
            setLoading(false)
        }
    }, [toast, canManage])

    useEffect(() => { load() }, [load])

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    async function beginSetup() {
        try {
            setSetup(await startMfaSetup())
        } catch (e) { toast.error(errorMessage(e, 'Could not start two-factor setup.')) }
    }

    async function finishSetup(e) {
        e.preventDefault()
        setSaving(true)
        try {
            await confirmMfaSetup(code.trim())
            // Refresh the cached operator so the console stops hiding the
            // controls this account now genuinely has.
            const fresh = await getPlatformMe()
            storePlatformSession({
                access: localStorage.getItem('imboni_platform_access'),
                refresh: localStorage.getItem('imboni_platform_refresh'),
                user: fresh,
            })
            setSetup(null); setCode('')
            toast.success('Two-factor is on. Your operations tools are unlocked.')
        } catch (err) {
            toast.error(errorMessage(err, 'That code is not right. Try the current one.'))
        } finally { setSaving(false) }
    }

    async function submit(e) {
        e.preventDefault()
        setSaving(true)
        try {
            await createOperator(form)
            toast.success('Operator added.')
            setForm(emptyForm()); setAdding(false)
            load()
        } catch (err) { toast.error(errorMessage(err, 'Could not add the operator.')) }
        finally { setSaving(false) }
    }

    async function changeRole(operator, role) {
        try {
            await updateOperator(operator.id, { role })
            toast.success(`${operator.email} is now ${role}.`)
            load()
        } catch (e) { toast.error(errorMessage(e, 'Could not change the role.')) }
    }

    async function toggleActive(operator) {
        try {
            await updateOperator(operator.id, { is_active: !operator.is_active })
            load()
        } catch (e) { toast.error(errorMessage(e, 'Could not change the account.')) }
    }

    async function clearMfa(operator) {
        try {
            await resetOperatorMfa(operator.id)
            toast.success(`${operator.email} can enrol a new device.`)
            load()
        } catch (e) { toast.error(errorMessage(e, 'Could not reset two-factor.')) }
    }

    return (
        <>
            {/* ── Your own second factor ───────────────────────────────── */}
            <div className="card pf-mb">
                <div className="card-content">
                    <div className="platform-panel-head">
                        <h2>Your two-factor</h2>
                        <span className={`platform-chip platform-chip-${me?.mfa_enabled ? 'ok' : 'warn'}`}>
                            {me?.mfa_enabled ? 'On' : 'Off'}
                        </span>
                    </div>

                    {me?.mfa_enabled ? (
                        <p className="platform-muted">
                            Your account asks for a code from your authenticator app at every sign-in.
                        </p>
                    ) : (
                        <>
                            <p className="platform-muted pf-mb">
                                {me?.role === 'operations'
                                    ? 'Your account holds the Operations role, so provisioning, restricting and suspending stay closed until you enrol a second factor.'
                                    : 'Add a second factor so a stolen password is not enough to reach the console.'}
                            </p>
                            <button className="btn btn-primary btn-sm" onClick={beginSetup}>
                                Set up two-factor
                            </button>
                        </>
                    )}

                    {setup && (
                        <Modal title="Set up two-factor" icon="lock" onClose={() => setSetup(null)} footer={
                            <>
                                <button className="btn btn-outline" onClick={() => setSetup(null)}>Cancel</button>
                                <button type="submit" form="mfa-form" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Checking…' : 'Turn it on'}
                                </button>
                            </>
                        }>
                            <p className="platform-muted">
                                Add this key to your authenticator app, then type the code it shows.
                            </p>
                            {/* The secret in text as well as the URI: not every
                                operator can scan a QR from the machine they are
                                signed in on. */}
                            <p className="platform-strong pf-mono">{setup.secret}</p>
                            <form id="mfa-form" onSubmit={finishSetup}>
                                <label>6-digit code
                                    <input className="form-input" inputMode="numeric" required autoFocus
                                           value={code} onChange={e => setCode(e.target.value)}
                                           placeholder="000000" />
                                </label>
                            </form>
                        </Modal>
                    )}
                </div>
            </div>

            {/* ── The roster ───────────────────────────────────────────── */}
            {!canManage ? (
                <div className="card">
                    <div className="card-content">
                        <p className="platform-muted">
                            The operator list is managed by Operations. Ask them to add or change an account.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="card">
                    <div className="card-content">
                        <div className="platform-panel-head">
                            <h2>Operators</h2>
                            <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
                                + Add operator
                            </button>
                        </div>

                        {adding && (
                            <Modal title="Add an operator" icon="person_add" size="lg" onClose={() => setAdding(false)} footer={
                                <>
                                    <button className="btn btn-outline" onClick={() => setAdding(false)}>Cancel</button>
                                    <button type="submit" form="operator-form" className="btn btn-primary" disabled={saving}>
                                        {saving ? 'Saving…' : 'Add operator'}
                                    </button>
                                </>
                            }>
                                <form id="operator-form" className="platform-form-grid" onSubmit={submit}>
                                    <label>Email
                                        <input className="form-input" type="email" required
                                               value={form.email} onChange={e => set('email', e.target.value)} />
                                    </label>
                                    <label>Name
                                        <input className="form-input" value={form.name}
                                               onChange={e => set('name', e.target.value)} />
                                    </label>
                                    <label>Role
                                        <select className="form-input" value={form.role}
                                                onChange={e => set('role', e.target.value)}>
                                            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                        </select>
                                    </label>
                                    <label>Password
                                        <input className="form-input" type="password" minLength={10} required
                                               autoComplete="new-password"
                                               value={form.password} onChange={e => set('password', e.target.value)} />
                                    </label>
                                    <p className="platform-muted">
                                        {ROLES.find(r => r.value === form.role)?.blurb}
                                    </p>
                                </form>
                            </Modal>
                        )}

                        {loading ? (
                            <p className="platform-muted">Loading…</p>
                        ) : (
                            <div className="data-table-wrap">
                                <table className="data-table">
                                    <thead>
                                        <tr><th>Operator</th><th>Role</th><th>Two-factor</th><th>Last seen</th><th className="platform-col-action">Action</th></tr>
                                    </thead>
                                    <tbody>
                                        {operators.map(op => (
                                            <tr key={op.id}>
                                                <td>
                                                    <span className="platform-strong">{op.email}</span>
                                                    {!op.is_active && (
                                                        <span className="platform-chip platform-chip-bad pf-ml">Disabled</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <select className="form-input" value={op.role}
                                                            onChange={e => changeRole(op, e.target.value)}>
                                                        {ROLES.map(r => (
                                                            <option key={r.value} value={r.value}>{r.label}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td>
                                                    <span className={`platform-chip platform-chip-${op.mfa_enabled ? 'ok' : 'warn'}`}>
                                                        {op.mfa_enabled ? 'On' : 'Off'}
                                                    </span>
                                                </td>
                                                <td>{op.last_login ? new Date(op.last_login).toLocaleString() : '-'}</td>
                                                <td className="platform-col-action">
                                                    {op.mfa_enabled && (
                                                        <button className="btn btn-outline btn-sm"
                                                                onClick={() => clearMfa(op)}>
                                                            Reset 2FA
                                                        </button>
                                                    )}
                                                    <button className="btn btn-outline btn-sm pf-ml"
                                                            onClick={() => toggleActive(op)}>
                                                        {op.is_active ? 'Disable' : 'Enable'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}
