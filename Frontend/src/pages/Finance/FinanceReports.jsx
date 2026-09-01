import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StatCard } from '../../components/layout/StatCard'
import { ListSection } from '../../components/ui/ListSection'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { downloadCsv } from '../../utils/exportTable'
import { getFinanceReport } from '../../api/finance'
import { FinanceShell, Money } from './FinanceShell'

/** Money in against money out, and where each came from. */
export function FinanceReports() {
    const { t } = useTranslation()
    const toast = useToast()
    const [data, setData]       = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getFinanceReport()
            .then(setData)
            .catch(e => { if (e?.status !== 402) toast.error(errorMessage(e, t('finance.loadFailed'))) })
            .finally(() => setLoading(false))
    }, [toast, t])

    function handleExport() {
        if (!data) return
        downloadCsv('finance-summary', {
            columns: [t('finance.fields.field'), t('finance.fields.value')],
            rows: [
                [t('finance.stats.charged'), data.charged],
                [t('finance.stats.collected'), data.collected],
                [t('finance.stats.outstanding'), data.outstanding],
                [t('finance.reports.collectionRate'), `${data.collection_rate}%`],
                [t('finance.stats.expenses'), data.expenses],
                [t('finance.reports.net'), data.net],
            ],
        })
    }

    return (
        <FinanceShell
            title={t('finance.reports.title')}
            subtitle={t('finance.reports.subtitle')}
            actions={
                <button className="btn btn-outline btn-sm" onClick={handleExport} disabled={!data}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">download</span>
                    {t('common.export')}
                </button>
            }
        >
            <div className="portal-stat-grid mb-1-5">
                <StatCard icon="payments" colorClass="success"
                    value={loading ? '-' : <Money value={data?.collected} />}
                    label={t('finance.stats.collected')} />
                <StatCard icon="shopping_bag"
                    value={loading ? '-' : <Money value={data?.expenses} />}
                    label={t('finance.stats.expenses')} />
                {/* Net can legitimately be negative — a term where the school
                    spent more than it collected — so it is coloured, not hidden. */}
                <StatCard icon="savings"
                    colorClass={Number(data?.net) < 0 ? 'warning' : 'info'}
                    value={loading ? '-' : <Money value={data?.net} />}
                    label={t('finance.reports.net')} />
                <StatCard icon="account_balance_wallet" colorClass="warning"
                    value={loading ? '-' : <Money value={data?.outstanding} />}
                    label={t('finance.stats.outstanding')} />
            </div>

            <div className="fin-dash-grid">
                <ListSection icon="payments" title={t('finance.reports.byMethod')}>
                    {loading ? (
                        <p className="u-muted">{t('common.loading')}</p>
                    ) : !data?.by_method?.length ? (
                        <EmptyState icon="payments" title={t('finance.reports.noIncome')}
                            description={t('finance.reports.noIncomeDesc')} />
                    ) : (
                        <ul className="row-list">
                            {data.by_method.map(row => (
                                <li key={row.method} className="row-item">
                                    <div className="row-main">
                                        <div className="u-strong u-sm">
                                            {t(`finance.methods.${row.method}`)}
                                        </div>
                                    </div>
                                    <Money value={row.total} />
                                </li>
                            ))}
                        </ul>
                    )}
                </ListSection>

                <ListSection icon="category" title={t('finance.reports.byCategory')}>
                    {loading ? (
                        <p className="u-muted">{t('common.loading')}</p>
                    ) : !data?.by_category?.length ? (
                        <EmptyState icon="shopping_bag" title={t('finance.reports.noSpending')}
                            description={t('finance.reports.noSpendingDesc')} />
                    ) : (
                        <ul className="row-list">
                            {data.by_category.map(row => (
                                <li key={row.category} className="row-item">
                                    <div className="row-main">
                                        <div className="u-strong u-sm">{row.category}</div>
                                    </div>
                                    <Money value={row.total} />
                                </li>
                            ))}
                        </ul>
                    )}
                </ListSection>
            </div>
        </FinanceShell>
    )
}
