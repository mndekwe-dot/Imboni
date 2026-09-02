import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DocumentActions } from '../../components/ui/DocumentActions'
import { EmptyState } from '../../components/ui/EmptyState'
import { ListSection } from '../../components/ui/ListSection'
import { Modal } from '../../components/ui/Modal'
import { StatCard } from '../../components/layout/StatCard'
import {
    createBudget, getBudget, getBudgets, getExpenseCategories, setBudgetLine,
    updateBudget,
} from '../../api/finance'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { FinanceShell, Money, formatAmount } from './FinanceShell'
import { pill } from '../../utils/tone'

/**
 * What the school planned to spend, against what it actually has.
 *
 * Expenses record what happened. This is the decision, made in advance, about
 * what may happen — which is what turns the expenses page from a diary into a
 * control.
 */
export function FinanceBudget() {
    const { t } = useTranslation()
    const toast = useToast()

    const [budgets, setBudgets] = useState([])
    const [current, setCurrent] = useState(null)
    const [report, setReport]   = useState(null)
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState(false)

    const load = useCallback(() => {
        setLoading(true)
        Promise.all([getBudgets(), getExpenseCategories()])
            .then(([b, c]) => {
                const list = Array.isArray(b) ? b : []
                setBudgets(list)
                setCategories(Array.isArray(c) ? c : [])
                setCurrent(prev => prev && list.some(x => x.id === prev) ? prev : list[0]?.id || null)
            })
            .catch(e => { if (e?.status !== 402) toast.error(errorMessage(e, t('finance.loadFailed'))) })
            .finally(() => setLoading(false))
    }, [toast, t])

    useEffect(() => { load() }, [load])

    const loadReport = useCallback(() => {
        if (!current) { setReport(null); return }
        getBudget(current).then(setReport).catch(() => setReport(null))
    }, [current])
    useEffect(() => { loadReport() }, [loadReport])

    async function create() {
        try {
            const budget = await createBudget({ name: t('finance.budget.defaultName') })
            toast.success(t('finance.budget.created'))
            setCurrent(budget.id)
            load()
        } catch (error) {
            toast.error(errorMessage(error, t('finance.budget.createFailed')))
        }
    }

    async function approve() {
        try {
            await updateBudget(current, { status: 'approved' })
            toast.success(t('finance.budget.approved'))
            load(); loadReport()
        } catch (error) {
            toast.error(errorMessage(error, t('finance.budget.saveFailed')))
        }
    }

    const budget = report?.budget
    const lines = report?.lines || []
    const overspent = lines.filter(l => l.over)

    return (
        <FinanceShell title={t('finance.budget.title')} subtitle={t('finance.budget.subtitle')}>
            {editing && budget && (
                <LineModal budgetId={budget.id} categories={categories} lines={lines}
                    onClose={() => setEditing(false)} onSaved={() => { loadReport(); load() }} />
            )}

            <div className="portal-stat-grid mb-1-5">
                <StatCard icon="request_quote"
                    value={loading ? '-' : <Money value={report?.planned_total} />}
                    label={t('finance.budget.planned')} colorClass="info" />
                <StatCard icon="shopping_bag"
                    value={loading ? '-' : <Money value={report?.actual_total} />}
                    label={t('finance.budget.actual')} />
                <StatCard icon="balance"
                    value={loading ? '-' : <Money value={report?.variance_total} />}
                    label={t('finance.budget.variance')}
                    colorClass={Number(report?.variance_total) < 0 ? 'warning' : ''} />
                <StatCard icon="warning" value={loading ? '-' : overspent.length}
                    label={t('finance.budget.overCategories')}
                    colorClass={overspent.length ? 'warning' : ''} />
            </div>

            <div className="toolbar-card mb-1-5">
                <select className="form-input class-filter-select" value={current || ''}
                    onChange={e => setCurrent(e.target.value)}
                    aria-label={t('finance.budget.title')}>
                    {budgets.map(b => (
                        <option key={b.id} value={b.id}>{b.name} · {b.term_label}</option>
                    ))}
                    {budgets.length === 0 && <option value="">{t('finance.budget.none')}</option>}
                </select>
                {budget && (
                    <span className={pill(budget.status)}>
                        {t(`finance.budget.status.${budget.status}`)}
                    </span>
                )}
                <div className="toolbar-spacer" />
                {budget && budget.status === 'draft' && (
                    <button className="btn btn-outline btn-sm" onClick={approve}>
                        {t('finance.budget.approve')}
                    </button>
                )}
                <button className="btn btn-outline btn-sm" onClick={create}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span>
                    {t('finance.budget.newBudget')}
                </button>
                {budget && (
                    <DocumentActions url={`/imboni/finance/budgets/${budget.id}/`}
                        stem="budget" disabled={loading} />
                )}
            </div>

            <ListSection icon="request_quote" title={t('finance.budget.lines')}
                count={loading ? null : lines.length}
                headerRight={budget && (
                    <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>
                        {t('finance.budget.setLine')}
                    </button>
                )}>
                {loading ? <p className="u-muted">{t('common.loading')}</p>
                    : !budget ? (
                        <EmptyState icon="request_quote" title={t('finance.budget.none')}
                            description={t('finance.budget.noneDesc')}
                            action={{ label: t('finance.budget.newBudget'), icon: 'add',
                                onClick: create }} />
                    ) : lines.length === 0 ? (
                        <EmptyState icon="playlist_add" title={t('finance.budget.noLines')}
                            description={t('finance.budget.noLinesDesc')}
                            action={{ label: t('finance.budget.setLine'), icon: 'add',
                                onClick: () => setEditing(true) }} />
                    ) : (
                        <ul className="row-list">
                            {lines.map(line => (
                                <li key={line.category_id || line.category} className="row-item">
                                    <div className="row-main">
                                        <div className="u-strong">
                                            {line.category}
                                            {line.unbudgeted && (
                                                <span className="pill pill-danger">
                                                    {' '}{t('finance.budget.unbudgeted')}
                                                </span>
                                            )}
                                        </div>
                                        {/* The bar is the point of the page: a
                                            number tells you the spend, the bar
                                            tells you whether it is a problem. */}
                                        <div className="fin-rate-bar mt-1">
                                            <span className="fin-rate-fill"
                                                style={{
                                                    width: `${Math.min(line.used_percent || 0, 100)}%`,
                                                    background: line.over
                                                        ? 'var(--destructive)' : undefined,
                                                }} />
                                        </div>
                                        <div className="text-xs-muted mt-1">
                                            {t('finance.budget.spentOf', {
                                                actual: formatAmount(line.actual),
                                                planned: formatAmount(line.planned),
                                            })}
                                        </div>
                                    </div>
                                    <div className="row-figures">
                                        <span className={line.over ? 'fin-money amount-owed' : 'fin-money'}>
                                            {formatAmount(line.variance)}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
            </ListSection>

            <p className="u-muted u-sm mt-1">{t('finance.budget.actualsNote')}</p>
        </FinanceShell>
    )
}

function LineModal({ budgetId, categories, lines, onClose, onSaved }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [category, setCategory] = useState('')
    const [planned, setPlanned]   = useState('')
    const [busy, setBusy] = useState(false)

    // Pre-fill when the category already has a figure, so setting one twice
    // reads as correcting it rather than starting again.
    function pick(value) {
        setCategory(value)
        const existing = lines.find(l => l.category_id === value)
        setPlanned(existing ? String(Math.round(Number(existing.planned))) : '')
    }

    async function submit(event) {
        event.preventDefault()
        setBusy(true)
        try {
            await setBudgetLine(budgetId, { category, planned })
            toast.success(t('finance.budget.lineSaved'))
            onSaved(); onClose()
        } catch (error) {
            toast.error(errorMessage(error, t('finance.budget.saveFailed')))
        } finally { setBusy(false) }
    }

    return (
        <Modal onClose={onClose} title={t('finance.budget.setLine')}>
            <form onSubmit={submit}>
                <div className="form-grid">
                    <label className="form-group">
                        <span className="form-label">{t('finance.fields.category')}</span>
                        <select className="form-input" value={category}
                            onChange={e => pick(e.target.value)} required>
                            <option value="">{t('common.choose')}</option>
                            {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('finance.budget.planned')}</span>
                        <input className="form-input" type="number" min="0" step="1"
                            value={planned} onChange={e => setPlanned(e.target.value)} required />
                    </label>
                </div>
                <div className="modal-actions">
                    <button type="button" className="btn btn-outline" onClick={onClose}>
                        {t('common.cancel')}
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={busy || !category}>
                        {busy ? t('common.saving') : t('common.save')}
                    </button>
                </div>
            </form>
        </Modal>
    )
}
