import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { FilterBar } from '../../components/ui/FilterBar'
import { ListSection } from '../../components/ui/ListSection'
import { EmptyState } from '../../components/ui/EmptyState'
import { Modal } from '../../components/ui/Modal'
import { StatCard } from '../../components/layout/StatCard'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { formatDate } from '../../utils/date'
import { readStoredUser } from '../../utils/roles'
import {
    createExpense, createExpenseCategory, decideExpense, getExpenseCategories, getExpenses,
} from '../../api/finance'
import { FinanceShell, Money } from './FinanceShell'
import { badge } from '../../utils/tone'

const FILTERS = ['all', 'pending', 'approved', 'paid', 'rejected']
const METHODS = ['cash', 'momo', 'bank', 'cheque', 'other']

/**
 * Money out: recorded by the office, approved by the head, then paid.
 *
 * Three steps rather than one because recording and approving in a single
 * action would make the control meaningless — the person who spent it cannot
 * be the person who signs it off.
 */
export function FinanceExpenses() {
    const { t } = useTranslation()
    const toast = useToast()
    const role = readStoredUser()?.role

    const [searchParams, setSearchParams] = useSearchParams()
    const statusParam = searchParams.get('status')
    const [filter, setFilter] = useState(FILTERS.includes(statusParam) ? statusParam : 'pending')

    const [rows, setRows]           = useState([])
    const [categories, setCategories] = useState([])
    const [loading, setLoading]     = useState(true)
    const [showNew, setShowNew]     = useState(false)

    const load = useCallback(() => {
        setLoading(true)
        getExpenses({ status: filter })
            .then(d => setRows(Array.isArray(d) ? d : []))
            .catch(e => { if (e?.status !== 402) toast.error(errorMessage(e, t('finance.loadFailed'))) })
            .finally(() => setLoading(false))
    }, [filter, toast, t])

    useEffect(() => { load() }, [load])
    useEffect(() => {
        getExpenseCategories().then(d => setCategories(Array.isArray(d) ? d : [])).catch(() => {})
    }, [])

    async function handleCreate(form) {
        try {
            await createExpense(form)
            setShowNew(false)
            load()
            toast.success(t('finance.expenses.recorded'))
        } catch (e) {
            toast.error(errorMessage(e, t('finance.saveFailed')))
        }
    }

    async function handleDecision(expense, decision) {
        try {
            await decideExpense(expense.id, decision, '')
            load()
            toast.success(t(`finance.expenses.${decision}Toast`))
        } catch (e) {
            toast.error(errorMessage(e, t('finance.saveFailed')))
        }
    }

    const total = rows.reduce((sum, r) => sum + Number(r.amount), 0)
    const pending = rows.filter(r => r.status === 'pending').length

    return (
        <FinanceShell title={t('finance.expenses.title')} subtitle={t('finance.expenses.subtitle')}>
            {showNew && (
                <ExpenseForm
                    categories={categories}
                    onClose={() => setShowNew(false)}
                    onSave={handleCreate}
                    onCategoryAdded={cat => setCategories(prev => [...prev, cat])}
                />
            )}

            <div className="portal-stat-grid mb-1-5">
                <StatCard icon="shopping_bag" value={loading ? '-' : <Money value={total} />}
                    label={t('finance.expenses.inView')} />
                <StatCard icon="pending_actions" value={loading ? '-' : pending}
                    label={t('finance.expenses.awaitingApproval')}
                    colorClass={pending ? 'warning' : ''} />
            </div>

            <div className="toolbar-card mb-1-5">
                <FilterBar
                    options={FILTERS.map(key => ({ key, label: t(`finance.expenses.filter.${key}`) }))}
                    active={filter}
                    onChange={next => {
                        setFilter(next)
                        setSearchParams(next === 'pending' ? {} : { status: next }, { replace: true })
                    }}
                />
                <div className="toolbar-spacer" />
                {role === 'bursar' && (
                    <button className="btn btn-primary btn-sm" onClick={() => setShowNew(true)}>
                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span>
                        {t('finance.expenses.record')}
                    </button>
                )}
            </div>

            <ListSection
                icon="shopping_bag"
                title={t(`finance.expenses.filter.${filter}`)}
                count={loading ? null : t('finance.expenseCount', { count: rows.length })}
            >
                {loading ? (
                    <p className="u-muted">{t('common.loading')}</p>
                ) : rows.length === 0 ? (
                    <EmptyState
                        icon="shopping_bag"
                        title={t('finance.expenses.empty')}
                        description={t('finance.expenses.emptyDesc')}
                        action={role === 'bursar'
                            ? { label: t('finance.expenses.record'), icon: 'add',
                                onClick: () => setShowNew(true) }
                            : undefined}
                    />
                ) : (
                    <ul className="row-list">
                        {rows.map(row => (
                            <li key={row.id} className="row-item">
                                <span className="row-icon" aria-hidden="true">
                                    <span className="material-symbols-rounded">receipt</span>
                                </span>
                                <div className="row-main">
                                    <div className="u-strong u-sm">{row.description}</div>
                                    <div className="text-xs-muted">
                                        {row.category_name} · {formatDate(row.spent_on)}
                                        {row.payee ? ` · ${row.payee}` : ''}
                                    </div>
                                </div>
                                <Money value={row.amount} />
                                <span className={badge(row.status)}>
                                    {t(`finance.expenses.status.${row.status}`)}
                                </span>
                                <div className="row-actions">
                                    {row.status === 'pending' && role === 'admin' && (
                                        <>
                                            <button className="btn btn-outline btn-sm"
                                                onClick={() => handleDecision(row, 'rejected')}>
                                                {t('finance.expenses.reject')}
                                            </button>
                                            <button className="btn btn-primary btn-sm"
                                                onClick={() => handleDecision(row, 'approved')}>
                                                {t('finance.expenses.approve')}
                                            </button>
                                        </>
                                    )}
                                    {row.status === 'approved' && role === 'bursar' && (
                                        <button className="btn btn-primary btn-sm"
                                            onClick={() => handleDecision(row, 'paid')}>
                                            {t('finance.expenses.markPaid')}
                                        </button>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </ListSection>
        </FinanceShell>
    )
}

function ExpenseForm({ categories, onClose, onSave, onCategoryAdded }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [form, setForm] = useState({
        category: '', description: '', amount: '', payee: '', method: 'cash',
        reference: '', spent_on: '',
    })
    const [newCategory, setNewCategory] = useState('')
    const [error, setError] = useState(null)
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

    async function addCategory() {
        if (!newCategory.trim()) return
        try {
            const created = await createExpenseCategory({ name: newCategory.trim() })
            onCategoryAdded(created)
            set('category', created.id)
            setNewCategory('')
        } catch (e) {
            toast.error(errorMessage(e, t('finance.saveFailed')))
        }
    }

    function submit() {
        if (!form.category || !form.description.trim() || !form.amount) {
            setError(t('finance.expenses.required'))
            return
        }
        onSave({ ...form, spent_on: form.spent_on || undefined })
    }

    return (
        <Modal
            title={t('finance.expenses.record')}
            icon="receipt"
            onClose={onClose}
            footer={
                <>
                    <button className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
                    <button className="btn btn-primary" onClick={submit}>{t('common.save')}</button>
                </>
            }
        >
            <div className="form-grid">
                <div className="form-col-full">
                    <label className="form-label" htmlFor="ex-desc">
                        {t('finance.fields.description')}
                    </label>
                    <input id="ex-desc" className="form-input" value={form.description}
                        onChange={e => set('description', e.target.value)} />
                </div>
                <div>
                    <label className="form-label" htmlFor="ex-category">
                        {t('finance.fields.category')}
                    </label>
                    <select id="ex-category" className="form-select" value={form.category}
                        onChange={e => set('category', e.target.value)}>
                        <option value="">{t('finance.expenses.chooseCategory')}</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="form-label" htmlFor="ex-amount">
                        {t('finance.fields.amount')}
                    </label>
                    <input id="ex-amount" type="number" step="0.01" className="form-input"
                        value={form.amount} onChange={e => set('amount', e.target.value)} />
                </div>
                <div>
                    <label className="form-label" htmlFor="ex-payee">{t('finance.fields.payee')}</label>
                    <input id="ex-payee" className="form-input" value={form.payee}
                        onChange={e => set('payee', e.target.value)} />
                </div>
                <div>
                    <label className="form-label" htmlFor="ex-method">{t('finance.fields.method')}</label>
                    <select id="ex-method" className="form-select" value={form.method}
                        onChange={e => set('method', e.target.value)}>
                        {METHODS.map(m => (
                            <option key={m} value={m}>{t(`finance.methods.${m}`)}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="form-label" htmlFor="ex-date">{t('finance.fields.spentOn')}</label>
                    <input id="ex-date" type="date" className="form-input" value={form.spent_on}
                        onChange={e => set('spent_on', e.target.value)} />
                </div>
                <div>
                    <label className="form-label" htmlFor="ex-ref">
                        {t('finance.fields.reference')}
                    </label>
                    <input id="ex-ref" className="form-input" value={form.reference}
                        onChange={e => set('reference', e.target.value)} />
                </div>
            </div>

            {/* A category that does not exist yet is the commonest reason a
                clerk abandons this form, so it can be added without leaving. */}
            <div className="fin-add-category">
                <label className="form-label" htmlFor="ex-newcat">
                    {t('finance.expenses.newCategory')}
                </label>
                <div className="fin-add-category-row">
                    <input id="ex-newcat" className="form-input" value={newCategory}
                        onChange={e => setNewCategory(e.target.value)} />
                    <button className="btn btn-outline btn-sm" onClick={addCategory}
                        disabled={!newCategory.trim()}>
                        {t('common.add')}
                    </button>
                </div>
            </div>

            {error && <p className="form-error">{error}</p>}
        </Modal>
    )
}
