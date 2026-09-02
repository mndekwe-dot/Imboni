import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ClassFilter } from '../../components/ui/ClassFilter'
import { DataTable } from '../../components/ui/DataTable'
import { DocumentActions } from '../../components/ui/DocumentActions'
import { ListSection } from '../../components/ui/ListSection'
import { Modal } from '../../components/ui/Modal'
import { SearchBar } from '../../components/ui/SearchBar'
import { StatCard } from '../../components/layout/StatCard'
import {
    carryArrears, createIncomeCategory, getArrears, getCashAccounts,
    getIncomeCategories, getOtherIncome, recordOtherIncome,
} from '../../api/finance'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { formatDate } from '../../utils/date'
import { FinanceShell, Money, formatAmount } from './FinanceShell'

/**
 * The two kinds of money the fee cycle does not see.
 *
 * OTHER INCOME is money that belongs to no family — canteen, uniforms, hall
 * hire, a donation. Kept apart from fee payments deliberately: a payment settles
 * a charge and moves a family's balance, this settles nothing.
 *
 * ARREARS is the opposite: money a family owes from a term that has already
 * finished. Every screen measures the current term, so last term's debt used to
 * vanish from the system while remaining owed in real life.
 */
export function FinanceIncome() {
    const { t } = useTranslation()
    const toast = useToast()

    const [tab, setTab] = useState('income')
    const [income, setIncome] = useState({ total: '0', results: [] })
    const [arrears, setArrears] = useState({ total: '0', results: [] })
    const [categories, setCategories] = useState([])
    const [accounts, setAccounts] = useState([])
    const [loading, setLoading] = useState(true)
    const [taking, setTaking] = useState(false)
    const [search, setSearch] = useState('')
    const [klass, setKlass] = useState({ grade: '', stream: '' })

    const arrearsParams = {
        ...(klass.grade ? { grade: klass.grade } : {}),
        ...(klass.stream ? { stream: klass.stream } : {}),
    }

    const load = useCallback(() => {
        setLoading(true)
        Promise.all([
            getOtherIncome(), getArrears(arrearsParams), getIncomeCategories(),
            getCashAccounts(),
        ])
            .then(([i, a, c, acc]) => {
                setIncome(i || { total: '0', results: [] })
                setArrears(a || { total: '0', results: [] })
                setCategories(Array.isArray(c) ? c : [])
                setAccounts(Array.isArray(acc) ? acc : [])
            })
            .catch(e => { if (e?.status !== 402) toast.error(errorMessage(e, t('finance.loadFailed'))) })
            .finally(() => setLoading(false))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toast, t, klass.grade, klass.stream])

    useEffect(() => { load() }, [load])

    async function carry() {
        try {
            const result = await carryArrears()
            toast.success(t('finance.income.carried', {
                raised: result.raised, updated: result.updated,
            }))
            load()
        } catch (error) {
            toast.error(errorMessage(error, t('finance.income.carryFailed')))
        }
    }

    const q = search.trim().toLowerCase()
    const visibleIncome = (income.results || []).filter(r =>
        !q || r.description.toLowerCase().includes(q)
        || (r.category_name || '').toLowerCase().includes(q))

    return (
        <FinanceShell title={t('finance.income.title')} subtitle={t('finance.income.subtitle')}>
            {taking && (
                <IncomeModal categories={categories} accounts={accounts}
                    onClose={() => setTaking(false)} onSaved={load} />
            )}

            <div className="portal-stat-grid mb-1-5">
                <StatCard icon="add_card" value={loading ? '-' : <Money value={income.total} />}
                    label={t('finance.income.thisTerm')} />
                <StatCard icon="history" value={loading ? '-' : <Money value={arrears.total} />}
                    label={t('finance.income.arrearsOwed')}
                    colorClass={Number(arrears.total) > 0 ? 'warning' : ''} />
                <StatCard icon="groups" value={loading ? '-' : (arrears.results || []).length}
                    label={t('finance.income.familiesBehind')} colorClass="info" />
            </div>

            <div className="toolbar-card mb-1-5">
                <div className="filter-tabs-bar">
                    {['income', 'arrears'].map(key => (
                        <button key={key} type="button"
                            className={`tab-btn${tab === key ? ' active' : ''}`}
                            onClick={() => setTab(key)}>
                            {t(`finance.income.tab.${key}`)}
                        </button>
                    ))}
                </div>
                <div className="toolbar-spacer" />
                {tab === 'income' ? (
                    <>
                        <button className="btn btn-primary btn-sm" onClick={() => setTaking(true)}>
                            <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span>
                            {t('finance.income.record')}
                        </button>
                        <DocumentActions url="/imboni/finance/income/" stem="other-income"
                            pdf={false} disabled={loading} />
                    </>
                ) : (
                    <>
                        <ClassFilter grade={klass.grade} stream={klass.stream}
                            onChange={setKlass} disabled={loading} />
                        <button className="btn btn-outline btn-sm" onClick={carry}>
                            <span className="material-symbols-rounded icon-sm" aria-hidden="true">redo</span>
                            {t('finance.income.carryForward')}
                        </button>
                        <DocumentActions url="/imboni/finance/arrears/" params={arrearsParams}
                            stem="arrears" pdf={false} disabled={loading} />
                    </>
                )}
            </div>

            {tab === 'income' ? (
                <>
                    <div className="toolbar-card mb-1-5">
                        <SearchBar value={search} onChange={setSearch}
                            placeholder={t('finance.income.searchPlaceholder')} />
                    </div>
                    <DataTable
                        title={t('finance.income.received')}
                        icon="add_card"
                        data={visibleIncome}
                        columns={[
                            { label: t('common.date') },
                            { label: t('finance.fields.category') },
                            { label: t('common.description') },
                            { label: t('finance.fields.method') },
                            { label: t('finance.cash.account') },
                            { label: t('finance.fields.amount'), align: 'right' },
                        ]}
                        renderRow={r => (
                            <tr key={r.id}>
                                <td className="text-muted">{formatDate(r.received_on)}</td>
                                <td>{r.category_name}</td>
                                <td>{r.description}</td>
                                <td>{r.method_label}</td>
                                <td>{r.account_name || '—'}</td>
                                <td className="dt-num"><Money value={r.amount} /></td>
                            </tr>
                        )}
                        emptyIcon="add_card"
                        emptyTitle={t('finance.income.none')}
                        emptyDesc={t('finance.income.noneDesc')}
                    />
                </>
            ) : (
                <ListSection icon="history" title={t('finance.income.arrearsTitle')}
                    count={loading ? null : (arrears.results || []).length}>
                    {loading ? <p className="u-muted">{t('common.loading')}</p> : (
                        <>
                            <p className="u-muted u-sm">{t('finance.income.arrearsNote')}</p>
                            <ul className="row-list mt-1">
                                {(arrears.results || []).map(r => (
                                    <li key={r.student.id} className="row-item">
                                        <span className="class-chip">{r.student.class_label}</span>
                                        <div className="row-main">
                                            <div className="u-strong">{r.student.name}</div>
                                            <div className="text-xs-muted">{r.student.student_id}</div>
                                        </div>
                                        <Money value={r.arrears} className="amount-owed" />
                                    </li>
                                ))}
                                {(arrears.results || []).length === 0 && (
                                    <li className="u-muted">{t('finance.income.noArrears')}</li>
                                )}
                            </ul>
                        </>
                    )}
                </ListSection>
            )}
        </FinanceShell>
    )
}

function IncomeModal({ categories, accounts, onClose, onSaved }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [form, setForm] = useState({ category: '', description: '', amount: '',
        method: 'cash', reference: '', account: '' })
    const [newCategory, setNewCategory] = useState('')
    const [busy, setBusy] = useState(false)
    const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

    async function addCategory() {
        if (!newCategory.trim()) return
        try {
            const created = await createIncomeCategory({ name: newCategory.trim() })
            categories.push(created)
            setForm(f => ({ ...f, category: created.id }))
            setNewCategory('')
        } catch (error) {
            toast.error(errorMessage(error, t('finance.income.saveFailed')))
        }
    }

    async function submit(event) {
        event.preventDefault()
        setBusy(true)
        try {
            await recordOtherIncome(form)
            toast.success(t('finance.income.recorded'))
            onSaved(); onClose()
        } catch (error) {
            toast.error(errorMessage(error, t('finance.income.saveFailed')))
        } finally { setBusy(false) }
    }

    const ready = form.category && Number(form.amount) > 0

    return (
        <Modal onClose={onClose} title={t('finance.income.record')}>
            <form onSubmit={submit}>
                <div className="form-grid">
                    <label className="form-group">
                        <span className="form-label">{t('finance.fields.category')}</span>
                        <select className="form-input" value={form.category}
                            onChange={set('category')} required>
                            <option value="">{t('common.choose')}</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('finance.fields.amount')}</span>
                        <input className="form-input" type="number" min="1" step="1"
                            value={form.amount} onChange={set('amount')} required />
                    </label>
                    <label className="form-group form-col-full">
                        <span className="form-label">{t('common.description')}</span>
                        <input className="form-input" value={form.description}
                            onChange={set('description')} required />
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('finance.fields.method')}</span>
                        <select className="form-input" value={form.method} onChange={set('method')}>
                            <option value="cash">{t('finance.methods.cash')}</option>
                            <option value="momo">{t('finance.methods.momo')}</option>
                            <option value="bank">{t('finance.methods.bank')}</option>
                            <option value="cheque">{t('finance.methods.cheque')}</option>
                        </select>
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('finance.cash.account')}</span>
                        <select className="form-input" value={form.account} onChange={set('account')}>
                            <option value="">{t('finance.cash.defaultAccount')}</option>
                            {accounts.map(a => (
                                <option key={a.id} value={a.id}>
                                    {a.name} ({formatAmount(a.balance)})
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <div className="fin-add-category">
                    <span className="form-label">{t('finance.income.newCategory')}</span>
                    <div className="fin-add-category-row">
                        <input className="form-input" value={newCategory}
                            onChange={e => setNewCategory(e.target.value)}
                            placeholder={t('finance.income.newCategoryPlaceholder')} />
                        <button type="button" className="btn btn-outline btn-sm"
                            onClick={addCategory} disabled={!newCategory.trim()}>
                            {t('common.add')}
                        </button>
                    </div>
                </div>

                <div className="modal-actions">
                    <button type="button" className="btn btn-outline" onClick={onClose}>
                        {t('common.cancel')}
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={busy || !ready}>
                        {busy ? t('common.saving') : t('finance.income.record')}
                    </button>
                </div>
            </form>
        </Modal>
    )
}
