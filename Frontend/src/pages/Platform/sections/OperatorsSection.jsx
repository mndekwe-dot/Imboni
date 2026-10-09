import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../../components/ui/Modal'
import {
    confirmMfaSetup, createOperator, getOperators, getPlatformMe, operatorCan,
    platformUser, resetOperatorMfa, startMfaSetup, storePlatformSession,
    updateOperator,
} from '../../../api/platform'
import { useToast } from '../../../context/ToastContext'
import { errorMessage } from '../../../utils/errors'
import { SkeletonList } from '../../../components/ui/Skeleton'

// What each role may do, in the operator's own words (see the `blurb` strings).
// Shown next to the picker because "commercial" means nothing until you say
// what it costs and grants.
const ROLES = ['support', 'commercial', 'operations']

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
    const { t } = useTranslation()
    const toast = useToast()
    const me = platformUser()
    const canManage = operatorCan('operations')
    const o = key => t(`platform.operators.${key}`)
    const roleLabel = r => t(`platform.operators.roles.${r}.label`, { defaultValue: r })

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
            toast.error(errorMessage(e, t('platform.operators.loadFailed')))
        } finally {
            setLoading(false)
        }
    }, [toast, canManage, t])

    useEffect(() => { load() }, [load])

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    async function beginSetup() {
        try {
            setSetup(await startMfaSetup())
        } catch (e) { toast.error(errorMessage(e, o('setupFailed'))) }
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
            toast.success(o('mfaOn'))
        } catch (err) {
            toast.error(errorMessage(err, o('codeWrong')))
        } finally { setSaving(false) }
    }

    async function submit(e) {
        e.preventDefault()
        setSaving(true)
        try {
            await createOperator(form)
            toast.success(o('added'))
            setForm(emptyForm()); setAdding(false)
            load()
        } catch (err) { toast.error(errorMessage(err, o('addFailed'))) }
        finally { setSaving(false) }
    }

    async function changeRole(operator, role) {
        try {
            await updateOperator(operator.id, { role })
            toast.success(t('platform.operators.roleChanged', { email: operator.email, role: roleLabel(role) }))
            load()
        } catch (e) { toast.error(errorMessage(e, o('roleFailed'))) }
    }

    async function toggleActive(operator) {
        try {
            await updateOperator(operator.id, { is_active: !operator.is_active })
            load()
        } catch (e) { toast.error(errorMessage(e, o('accountFailed'))) }
    }

    async function clearMfa(operator) {
        try {
            await resetOperatorMfa(operator.id)
            toast.success(t('platform.operators.mfaReset', { email: operator.email }))
            load()
        } catch (e) { toast.error(errorMessage(e, o('mfaResetFailed'))) }
    }

    return (
        <>
            {/* ── Your own second factor ───────────────────────────────── */}
            <div className="card pf-mb">
                <div className="card-content">
                    <div className="platform-panel-head">
                        <h2>{o('yourMfa')}</h2>
                        <span className={`platform-chip platform-chip-${me?.mfa_enabled ? 'ok' : 'warn'}`}>
                            {me?.mfa_enabled ? o('on') : o('off')}
                        </span>
                    </div>

                    {me?.mfa_enabled ? (
                        <p className="platform-muted">{o('mfaOnNote')}</p>
                    ) : (
                        <>
                            <p className="platform-muted pf-mb">
                                {me?.role === 'operations' ? o('mfaOpsNote') : o('mfaOtherNote')}
                            </p>
                            <button className="btn btn-primary btn-sm" onClick={beginSetup}>
                                {o('setUp')}
                            </button>
                        </>
                    )}

                    {setup && (
                        <Modal title={o('setUp')} icon="lock" onClose={() => setSetup(null)} footer={
                            <>
                                <button className="btn btn-outline" onClick={() => setSetup(null)}>{o('cancel')}</button>
                                <button type="submit" form="mfa-form" className="btn btn-primary" disabled={saving}>
                                    {saving ? o('checking') : o('turnOn')}
                                </button>
                            </>
                        }>
                            <p className="platform-muted">{o('setupIntro')}</p>
                            {/* The secret in text as well as the URI: not every
                                operator can scan a QR from the machine they are
                                signed in on. */}
                            <p className="platform-strong pf-mono">{setup.secret}</p>
                            <form id="mfa-form" onSubmit={finishSetup}>
                                <label>{o('code')}
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
                        <p className="platform-muted">{o('managedByOps')}</p>
                    </div>
                </div>
            ) : (
                <div className="card">
                    <div className="card-content">
                        <div className="platform-panel-head">
                            <h2>{o('title')}</h2>
                            <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
                                {o('add')}
                            </button>
                        </div>

                        {adding && (
                            <Modal title={o('addTitle')} icon="person_add" size="lg" onClose={() => setAdding(false)} footer={
                                <>
                                    <button className="btn btn-outline" onClick={() => setAdding(false)}>{o('cancel')}</button>
                                    <button type="submit" form="operator-form" className="btn btn-primary" disabled={saving}>
                                        {saving ? o('saving') : o('addSubmit')}
                                    </button>
                                </>
                            }>
                                <form id="operator-form" className="platform-form-grid" onSubmit={submit}>
                                    <label>{o('form.email')}
                                        <input className="form-input" type="email" required
                                               value={form.email} onChange={e => set('email', e.target.value)} />
                                    </label>
                                    <label>{o('form.name')}
                                        <input className="form-input" value={form.name}
                                               onChange={e => set('name', e.target.value)} />
                                    </label>
                                    <label>{o('form.role')}
                                        <select className="form-input" value={form.role}
                                                onChange={e => set('role', e.target.value)}>
                                            {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                                        </select>
                                    </label>
                                    <label>{o('form.password')}
                                        <input className="form-input" type="password" minLength={10} required
                                               autoComplete="new-password"
                                               value={form.password} onChange={e => set('password', e.target.value)} />
                                    </label>
                                    <p className="platform-muted">{o(`roles.${form.role}.blurb`)}</p>
                                </form>
                            </Modal>
                        )}

                        {loading ? (
                            <SkeletonList items={3} />
                        ) : (
                            <div className="data-table-wrap">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>{o('cols.operator')}</th><th>{o('cols.role')}</th><th>{o('cols.mfa')}</th>
                                            <th>{o('cols.lastSeen')}</th><th className="platform-col-action">{o('cols.action')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {operators.map(op => (
                                            <tr key={op.id}>
                                                <td>
                                                    <span className="platform-strong">{op.email}</span>
                                                    {!op.is_active && (
                                                        <span className="platform-chip platform-chip-bad pf-ml">{o('disabled')}</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <select className="form-input" value={op.role}
                                                            aria-label={t('platform.operators.roleOf', { email: op.email })}
                                                            onChange={e => changeRole(op, e.target.value)}>
                                                        {ROLES.map(r => (
                                                            <option key={r} value={r}>{roleLabel(r)}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td>
                                                    <span className={`platform-chip platform-chip-${op.mfa_enabled ? 'ok' : 'warn'}`}>
                                                        {op.mfa_enabled ? o('on') : o('off')}
                                                    </span>
                                                </td>
                                                <td>{op.last_login ? new Date(op.last_login).toLocaleString() : '-'}</td>
                                                <td className="platform-col-action">
                                                    {op.mfa_enabled && (
                                                        <button className="btn btn-outline btn-sm"
                                                                onClick={() => clearMfa(op)}>
                                                            {o('reset')}
                                                        </button>
                                                    )}
                                                    <button className="btn btn-outline btn-sm pf-ml"
                                                            onClick={() => toggleActive(op)}>
                                                        {op.is_active ? o('disable') : o('enableAccount')}
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
