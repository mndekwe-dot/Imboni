import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTable } from '../../components/ui/DataTable'
import { DocumentActions } from '../../components/ui/DocumentActions'
import { EmptyState } from '../../components/ui/EmptyState'
import { ListSection } from '../../components/ui/ListSection'
import { Modal } from '../../components/ui/Modal'
import { StatCard } from '../../components/layout/StatCard'
import {
    createCashAccount, getCashPosition, recordCount, transferCash,
} from '../../api/finance'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { formatDate } from '../../utils/date'
import { FinanceShell, Money, formatAmount } from './FinanceShell'

/**
 * Where the money actually is.
 *
 * The dashboard could say 767,500 collected and nobody could answer "so where
 * is it?". A receipt records that a parent paid; it does not record that the
 * cash reached the bank, and that gap is where school money goes missing.
 */
export function FinanceCash() {
    const { t } = useTranslation()
    const toast = useToast()

    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [account, setAccount] = useState('')
    const [dialog, setDialog] = useState(null)   // 'account' | 'transfer' | 'count'

    const params = account ? { account } : {}

    const load = useCallback(() => {
        setLoading(true)
        getCashPosition(params)
            .then(setData)
            .catch(e => { if (e?.status !== 402) toast.error(errorMessage(e, t('finance.loadFailed'))) })
            .finally(() => setLoading(false))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toast, t, account])

    useEffect(() => { load() }, [load])

    const accounts = data?.accounts || []
    const movements = data?.movements || []

    return (
        <FinanceShell title={t('finance.cash.title')} subtitle={t('finance.cash.subtitle')}>
            {dialog === 'account' && (
                <AccountModal onClose={() => setDialog(null)} onSaved={load} />
            )}
            {dialog === 'transfer' && (
                <TransferModal accounts={accounts} onClose={() => setDialog(null)} onSaved={load} />
            )}
            {dialog === 'count' && (
                <CountModal accounts={accounts} onClose={() => setDialog(null)} onSaved={load} />
            )}

            <div className="portal-stat-grid mb-1-5">
                <StatCard icon="savings" value={loading ? '-' : <Money value={data?.total} />}
                    label={t('finance.cash.totalHeld')} />
                <StatCard icon="account_balance" value={loading ? '-' : accounts.length}
                    label={t('finance.cash.accounts')} colorClass="info" />
            </div>

            <ListSection icon="account_balance" title={t('finance.cash.accounts')}
                count={loading ? null : accounts.length}
                headerRight={
                    <button className="btn btn-outline btn-sm" onClick={() => setDialog('account')}>
                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span>
                        {t('finance.cash.addAccount')}
                    </button>
                }>
                {loading ? <p className="u-muted">{t('common.loading')}</p>
                    : accounts.length === 0 ? (
                        <EmptyState icon="savings" title={t('finance.cash.noAccounts')}
                            description={t('finance.cash.noAccountsDesc')}
                            action={{ label: t('finance.cash.addAccount'), icon: 'add',
                                onClick: () => setDialog('account') }} />
                    ) : (
                        <ul className="row-list">
                            {accounts.map(a => (
                                <li key={a.id} className="row-item">
                                    <span className="row-icon">
                                        <span className="material-symbols-rounded" aria-hidden="true">
                                            {a.kind === 'bank' ? 'account_balance'
                                                : a.kind === 'mobile' ? 'smartphone' : 'savings'}
                                        </span>
                                    </span>
                                    <div className="row-main">
                                        <div className="u-strong">
                                            {a.name}
                                            {a.is_default && (
                                                <span className="pill"> {t('finance.cash.default')}</span>
                                            )}
                                        </div>
                                        <div className="text-xs-muted">
                                            {a.kind_label}{a.reference ? ` · ${a.reference}` : ''}
                                        </div>
                                    </div>
                                    <Money value={a.balance} />
                                </li>
                            ))}
                        </ul>
                    )}
            </ListSection>

            <div className="toolbar-card mb-1-5 mt-1-5">
                <select className="form-input class-filter-select" value={account}
                    onChange={e => setAccount(e.target.value)}
                    aria-label={t('finance.cash.accounts')}>
                    <option value="">{t('finance.cash.allAccounts')}</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <button className="btn btn-outline btn-sm" onClick={() => setDialog('transfer')}
                    disabled={accounts.length < 2}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">swap_horiz</span>
                    {t('finance.cash.transfer')}
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => setDialog('count')}
                    disabled={!accounts.length}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">fact_check</span>
                    {t('finance.cash.count')}
                </button>
                <div className="toolbar-spacer" />
                <DocumentActions url="/imboni/finance/cash/" params={params}
                    stem="cash-position" disabled={loading} />
            </div>

            <DataTable
                title={t('finance.cash.movements')}
                icon="receipt_long"
                data={movements}
                columns={[
                    { label: t('common.date') },
                    { label: t('finance.cash.account') },
                    { label: t('finance.cash.reason') },
                    { label: t('common.description') },
                    { label: t('finance.fields.amount'), align: 'right' },
                ]}
                renderRow={m => (
                    <tr key={m.id}>
                        <td className="text-muted">{formatDate(m.occurred_on)}</td>
                        <td>{m.account_name}</td>
                        <td>{m.kind_label}</td>
                        <td>{m.receipt_no ? `${m.receipt_no} · ${m.description}` : m.description}</td>
                        {/* Money out is stored negative, so it reads as it happened
                            rather than needing a column to say which way it went. */}
                        <td className="dt-num">
                            <span className={Number(m.amount) < 0 ? 'amount-owed' : ''}>
                                {formatAmount(m.amount)}
                            </span>
                        </td>
                    </tr>
                )}
                emptyIcon="receipt_long"
                emptyTitle={t('finance.cash.noMovements')}
                emptyDesc={t('finance.cash.noMovementsDesc')}
            />
        </FinanceShell>
    )
}

function AccountModal({ onClose, onSaved }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [form, setForm] = useState({ name: '', kind: 'cash', reference: '',
        opening_balance: '0', is_default: false })
    const [busy, setBusy] = useState(false)

    const set = (key) => (e) => setForm(f => ({
        ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

    async function submit(event) {
        event.preventDefault()
        setBusy(true)
        try {
            await createCashAccount(form)
            toast.success(t('finance.cash.accountAdded'))
            onSaved(); onClose()
        } catch (error) {
            toast.error(errorMessage(error, t('finance.cash.saveFailed')))
        } finally { setBusy(false) }
    }

    return (
        <Modal onClose={onClose} title={t('finance.cash.addAccount')}>
            <form onSubmit={submit}>
                <div className="form-grid">
                    <label className="form-group form-col-full">
                        <span className="form-label">{t('common.name')}</span>
                        <input className="form-input" value={form.name} onChange={set('name')}
                            required autoFocus />
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('finance.cash.kind')}</span>
                        <select className="form-input" value={form.kind} onChange={set('kind')}>
                            <option value="cash">{t('finance.cash.kinds.cash')}</option>
                            <option value="bank">{t('finance.cash.kinds.bank')}</option>
                            <option value="mobile">{t('finance.cash.kinds.mobile')}</option>
                        </select>
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('finance.cash.reference')}</span>
                        <input className="form-input" value={form.reference}
                            onChange={set('reference')} />
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('finance.cash.opening')}</span>
                        <input className="form-input" type="number" step="1"
                            value={form.opening_balance} onChange={set('opening_balance')} />
                    </label>
                </div>
                <label className="form-check mt-1">
                    <input type="checkbox" checked={form.is_default} onChange={set('is_default')} />
                    <span>{t('finance.cash.makeDefault')}</span>
                </label>
                <div className="modal-actions">
                    <button type="button" className="btn btn-outline" onClick={onClose}>
                        {t('common.cancel')}
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={busy}>
                        {busy ? t('common.saving') : t('common.save')}
                    </button>
                </div>
            </form>
        </Modal>
    )
}

function TransferModal({ accounts, onClose, onSaved }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [form, setForm] = useState({ from_account: '', to_account: '', amount: '',
        description: '' })
    const [busy, setBusy] = useState(false)
    const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

    async function submit(event) {
        event.preventDefault()
        setBusy(true)
        try {
            await transferCash(form)
            toast.success(t('finance.cash.transferred'))
            onSaved(); onClose()
        } catch (error) {
            toast.error(errorMessage(error, t('finance.cash.transferFailed')))
        } finally { setBusy(false) }
    }

    const ready = form.from_account && form.to_account && Number(form.amount) > 0

    return (
        <Modal onClose={onClose} title={t('finance.cash.transfer')}>
            <form onSubmit={submit}>
                <div className="form-grid">
                    <label className="form-group">
                        <span className="form-label">{t('finance.cash.from')}</span>
                        <select className="form-input" value={form.from_account}
                            onChange={set('from_account')} required>
                            <option value="">{t('common.choose')}</option>
                            {accounts.map(a => (
                                <option key={a.id} value={a.id}>
                                    {a.name} ({formatAmount(a.balance)})
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('finance.cash.to')}</span>
                        <select className="form-input" value={form.to_account}
                            onChange={set('to_account')} required>
                            <option value="">{t('common.choose')}</option>
                            {accounts.filter(a => a.id !== form.from_account).map(a => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                        </select>
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('finance.fields.amount')}</span>
                        <input className="form-input" type="number" min="1" step="1"
                            value={form.amount} onChange={set('amount')} required />
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('common.description')}</span>
                        <input className="form-input" value={form.description}
                            onChange={set('description')} />
                    </label>
                </div>
                <div className="modal-actions">
                    <button type="button" className="btn btn-outline" onClick={onClose}>
                        {t('common.cancel')}
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={busy || !ready}>
                        {busy ? t('common.saving') : t('finance.cash.transfer')}
                    </button>
                </div>
            </form>
        </Modal>
    )
}

/**
 * Record what was counted. Deliberately does NOT correct the books.
 *
 * Counting is one decision and changing the books is another; a system that
 * does both at once makes every count agree by construction and prove nothing.
 */
function CountModal({ accounts, onClose, onSaved }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [form, setForm] = useState({ account: '', counted_balance: '', note: '' })
    const [busy, setBusy] = useState(false)
    const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

    const chosen = accounts.find(a => a.id === form.account)
    const difference = chosen && form.counted_balance !== ''
        ? Number(form.counted_balance) - Number(chosen.balance)
        : null

    async function submit(event) {
        event.preventDefault()
        setBusy(true)
        try {
            await recordCount(form)
            toast.success(t('finance.cash.counted'))
            onSaved(); onClose()
        } catch (error) {
            toast.error(errorMessage(error, t('finance.cash.saveFailed')))
        } finally { setBusy(false) }
    }

    return (
        <Modal onClose={onClose} title={t('finance.cash.count')}>
            <form onSubmit={submit}>
                <div className="form-grid">
                    <label className="form-group">
                        <span className="form-label">{t('finance.cash.account')}</span>
                        <select className="form-input" value={form.account}
                            onChange={set('account')} required>
                            <option value="">{t('common.choose')}</option>
                            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('finance.cash.counted')}</span>
                        <input className="form-input" type="number" step="1"
                            value={form.counted_balance} onChange={set('counted_balance')} required />
                    </label>
                </div>

                {chosen && (
                    <div className="figure-strip mt-1">
                        <div>
                            <span className="figure-label">{t('finance.cash.books')}</span>
                            <Money value={chosen.balance} />
                        </div>
                        {difference !== null && (
                            <div>
                                <span className="figure-label">{t('finance.cash.difference')}</span>
                                <span className={difference < 0 ? 'fin-money amount-owed' : 'fin-money'}>
                                    {difference > 0 ? '+' : ''}{formatAmount(difference)}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                <label className="form-group mt-1">
                    <span className="form-label">{t('common.note')}</span>
                    <textarea className="form-input" rows="2" value={form.note}
                        onChange={set('note')} />
                </label>
                <p className="u-muted u-sm">{t('finance.cash.countNote')}</p>

                <div className="modal-actions">
                    <button type="button" className="btn btn-outline" onClick={onClose}>
                        {t('common.cancel')}
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={busy}>
                        {busy ? t('common.saving') : t('common.save')}
                    </button>
                </div>
            </form>
        </Modal>
    )
}
