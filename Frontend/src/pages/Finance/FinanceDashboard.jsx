import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { StatCard } from '../../components/layout/StatCard'
import { ListSection } from '../../components/ui/ListSection'
import { EmptyState } from '../../components/ui/EmptyState'
import { DocumentActions } from '../../components/ui/DocumentActions'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { formatDate } from '../../utils/date'
import { getFinanceDashboard, getFinanceReport } from '../../api/finance'
import { FinanceShell, Money, categoryName, formatAmount } from './FinanceShell'

/**
 * The school's money for the term, on one page.
 *
 * This and Reports showed the same term twice: collected and outstanding here,
 * collected, spent and net there - with the other income left off both, and
 * the Export button up in the page header where no other page keeps one. The
 * statement below is now the whole of the school's money in and out, printed
 * and exported from its own section.
 */
export function FinanceDashboard() {
    const { t } = useTranslation()
    const toast = useToast()
    const [data, setData]       = useState(null)
    const [report, setReport]   = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        Promise.all([getFinanceDashboard(), getFinanceReport()])
            .then(([dashboard, statement]) => { setData(dashboard); setReport(statement) })
            // 402 means the school is not on the plan; the shell already says
            // so, and a toast would be shouting the same thing.
            .catch(e => { if (e?.status !== 402) toast.error(errorMessage(e, t('finance.loadFailed'))) })
            .finally(() => setLoading(false))
    }, [toast, t])

    const rate = data?.collection_rate ?? 0
    const net = Number(report?.net ?? 0)

    return (
        <FinanceShell title={t('finance.dashboard.title')} subtitle={t('finance.dashboard.subtitle')}>
            <div className="portal-stat-grid mb-1-5">
                <StatCard icon="savings" colorClass="success"
                    value={loading ? '-' : <Money value={report?.income_total} />}
                    label={t('finance.dashboard.moneyIn')} />
                <StatCard icon="shopping_bag"
                    value={loading ? '-' : <Money value={report?.expenses} />}
                    label={t('finance.dashboard.moneyOut')}
                    trend={Number(report?.committed) > 0
                        ? t('finance.dashboard.committed', { amount: formatAmount(report.committed) }) : undefined} />
                <StatCard icon="account_balance" colorClass={net < 0 ? 'red' : 'info'}
                    value={loading ? '-' : <Money value={report?.net} />}
                    label={net < 0 ? t('finance.dashboard.deficit') : t('finance.dashboard.surplus')} />
                <StatCard icon="account_balance_wallet"
                    colorClass={Number(data?.outstanding) > 0 ? 'warning' : ''}
                    value={loading ? '-' : <Money value={data?.outstanding} />}
                    label={t('finance.dashboard.feesOwed')} />
            </div>

            {/* Collection rate is the one number a head teacher asks for, so it
                gets a bar rather than another figure in a row of figures. */}
            <ListSection className="mb-1-5" icon="monitoring"
                title={t('finance.dashboard.collection')}
                count={data?.term || null}>
                <div className="fin-rate">
                    <div className="fin-rate-head">
                        <span className="fin-rate-value">{loading ? '—' : `${rate}%`}</span>
                        <span className="text-xs-muted">
                            {t('finance.dashboard.collectedOf', {
                                collected: formatAmount(data?.collected), charged: formatAmount(data?.charged),
                            })}
                            {' · '}
                            {t('finance.dashboard.owingCount', { count: data?.students_owing ?? 0 })}
                        </span>
                    </div>
                    <div className="fin-rate-bar" role="progressbar"
                        aria-valuenow={rate} aria-valuemin={0} aria-valuemax={100}>
                        {/* Clamped: a term that over-collected must not draw a
                            bar past its own box. */}
                        <span className="fin-rate-fill"
                            style={{ width: `${Math.min(100, Math.max(0, rate))}%` }} />
                    </div>
                </div>
            </ListSection>

            <div className="toolbar-card mb-1-5">
                <div>
                    <div className="u-strong">{t('finance.dashboard.statement')}</div>
                    <div className="text-xs-muted">{t('finance.dashboard.statementHint')}</div>
                </div>
                <div className="toolbar-spacer" />
                <DocumentActions url="/imboni/finance/report/" stem="income-and-expenditure" disabled={loading} />
            </div>

            <div className="fin-dash-grid mb-1-5">
                <ListSection icon="savings" title={t('finance.dashboard.moneyIn')}
                    count={report ? <Money value={report.income_total} /> : null}>
                    {loading ? <p className="u-muted">{t('common.loading')}</p>
                        : !report?.income?.length ? (
                            <EmptyState icon="savings" title={t('finance.dashboard.nothingIn')}
                                description={t('finance.dashboard.nothingInDesc')} />
                        ) : (
                            <>
                                <ul className="row-list">
                                    {report.income.map(line => (
                                        <li key={`${line.source}-${line.key}`} className="row-item">
                                            <div className="row-main">
                                                <div className="u-strong u-sm">
                                                    {line.source === 'fees' ? categoryName(t, line.key, line.label) : line.label}
                                                </div>
                                                <div className="text-xs-muted">
                                                    {t(line.source === 'fees' ? 'finance.dashboard.fromFees' : 'finance.dashboard.otherIncome')}
                                                </div>
                                            </div>
                                            <Money value={line.amount} />
                                        </li>
                                    ))}
                                </ul>
                                {report.by_method?.length > 0 && (
                                    <p className="text-xs-muted mt-1">
                                        {t('finance.dashboard.feesByMethod')}{' '}
                                        {report.by_method.map(row =>
                                            `${t(`finance.methods.${row.method}`)} ${formatAmount(row.total)}`).join(' · ')}
                                    </p>
                                )}
                            </>
                        )}
                </ListSection>

                <ListSection icon="shopping_bag" title={t('finance.dashboard.moneyOut')}
                    count={report ? <Money value={report.expenses} /> : null}>
                    {loading ? <p className="u-muted">{t('common.loading')}</p>
                        : !report?.expenditure?.length ? (
                            <EmptyState icon="shopping_bag" title={t('finance.dashboard.nothingOut')}
                                description={t('finance.dashboard.nothingOutDesc')} />
                        ) : (
                            <ul className="row-list">
                                {report.expenditure.map(line => (
                                    <li key={line.key} className="row-item">
                                        <div className="row-main"><div className="u-strong u-sm">{line.label}</div></div>
                                        <Money value={line.amount} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    {Number(report?.committed) > 0 && (
                        <p className="text-xs-muted mt-1">
                            {t('finance.dashboard.committedNote', { amount: formatAmount(report.committed) })}
                        </p>
                    )}
                </ListSection>
            </div>

            <div className="fin-dash-grid">
                <ListSection icon="groups" title={t('finance.dashboard.byClass')}>
                    {loading ? (
                        <p className="u-muted">{t('common.loading')}</p>
                    ) : !data?.by_class?.length ? (
                        <EmptyState icon="groups" title={t('finance.dashboard.nothingBilled')}
                            description={t('finance.dashboard.nothingBilledDesc')} />
                    ) : (
                        <ul className="row-list">
                            {data.by_class.map(row => (
                                <li key={row.class_label} className="row-item">
                                    <span className="class-chip">{row.class_label}</span>
                                    <div className="row-main">
                                        <div className="text-xs-muted">
                                            {/* Formatted before interpolation. These are raw
                                                decimal strings from the API, so the sentence
                                                read "260000.00 of 440000.00 collected" right
                                                beside a properly grouped "180,000 RWF". */}
                                            {t('finance.dashboard.ofCharged', {
                                                collected: formatAmount(row.collected),
                                                charged: formatAmount(row.charged),
                                            })}
                                        </div>
                                    </div>
                                    <Money value={row.outstanding} className="amount-owed" />
                                </li>
                            ))}
                        </ul>
                    )}
                </ListSection>

                <ListSection icon="receipt" title={t('finance.dashboard.recentPayments')}>
                    {loading ? (
                        <p className="u-muted">{t('common.loading')}</p>
                    ) : !data?.recent_payments?.length ? (
                        <EmptyState icon="payments" title={t('finance.dashboard.noPayments')}
                            description={t('finance.dashboard.noPaymentsDesc')} />
                    ) : (
                        <ul className="row-list">
                            {data.recent_payments.map(p => (
                                <li key={p.id} className="row-item">
                                    <span className="fin-receipt-no">{p.receipt_no}</span>
                                    <div className="row-main">
                                        <div className="u-strong u-sm">{p.student?.name}</div>
                                        <div className="text-xs-muted">
                                            {t(`finance.methods.${p.method}`)} · {formatDate(p.paid_on)}
                                        </div>
                                    </div>
                                    <Money value={p.amount} />
                                </li>
                            ))}
                        </ul>
                    )}
                </ListSection>
            </div>

            <div className="fin-action-row mt-1-5">
                <Link to="/finance/fees" className="fin-action-card">
                    <span className="material-symbols-rounded" aria-hidden="true">person_alert</span>
                    <div>
                        <div className="fin-action-value">{loading ? '-' : data?.students_owing ?? 0}</div>
                        <div className="fin-action-label">{t('finance.dashboard.chaseDebtors')}</div>
                    </div>
                </Link>
                <Link to="/finance/fees?tab=charges&status=overdue" className="fin-action-card">
                    <span className="material-symbols-rounded" aria-hidden="true">event_busy</span>
                    <div>
                        <div className="fin-action-value">{loading ? '-' : data?.overdue_charges ?? 0}</div>
                        <div className="fin-action-label">{t('finance.dashboard.overdueCharges')}</div>
                    </div>
                </Link>
                <Link to="/finance/expenses?status=pending" className="fin-action-card">
                    <span className="material-symbols-rounded" aria-hidden="true">pending_actions</span>
                    <div>
                        <div className="fin-action-value">{loading ? '-' : data?.pending_expenses ?? 0}</div>
                        <div className="fin-action-label">{t('finance.dashboard.pendingExpenses')}</div>
                    </div>
                </Link>
            </div>
        </FinanceShell>
    )
}
