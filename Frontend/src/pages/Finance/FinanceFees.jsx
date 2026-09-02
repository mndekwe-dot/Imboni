import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { SearchBar } from '../../components/ui/SearchBar'
import { ClassFilter } from '../../components/ui/ClassFilter'
import { DocumentActions } from '../../components/ui/DocumentActions'
import { FilterBar } from '../../components/ui/FilterBar'
import { DataTable } from '../../components/ui/DataTable'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { formatDate } from '../../utils/date'
import { getFees } from '../../api/finance'
import { FinanceShell, Money } from './FinanceShell'
import { badge } from '../../utils/tone'

const FILTERS = ['all', 'outstanding', 'overdue', 'cleared']

/** Every charge the school has raised, and what has been received against it. */
export function FinanceFees() {
    const { t } = useTranslation()
    const toast = useToast()

    const [searchParams, setSearchParams] = useSearchParams()
    const statusParam = searchParams.get('status')
    const [status, setStatus] = useState(
        FILTERS.includes(statusParam) ? statusParam : 'outstanding')
    const [search, setSearch] = useState('')
    const [fees, setFees]     = useState([])
    const [loading, setLoading] = useState(true)
    const [klass, setKlass]   = useState({ grade: '', stream: '' })

    // What the server is being asked for. Print and export send exactly this,
    // so the paper is the screen -- including the rows past the display cap.
    const docParams = {
        status,
        ...(klass.grade ? { grade: klass.grade } : {}),
        ...(klass.stream ? { stream: klass.stream } : {}),
    }

    const load = useCallback(() => {
        setLoading(true)
        getFees(docParams)
            .then(d => setFees(Array.isArray(d) ? d : []))
            .catch(e => { if (e?.status !== 402) toast.error(errorMessage(e, t('finance.loadFailed'))) })
            .finally(() => setLoading(false))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status, toast, t, klass.grade, klass.stream])

    useEffect(() => { load() }, [load])

    const q = search.trim().toLowerCase()
    const visible = fees.filter(f =>
        !q || (f.student?.name || '').toLowerCase().includes(q)
        || (f.student?.student_id || '').toLowerCase().includes(q)
        || (f.student?.class_label || '').toLowerCase().includes(q))


    return (
        <FinanceShell title={t('finance.fees.title')} subtitle={t('finance.fees.subtitle')}>
            <div className="toolbar-card mb-1-5">
                <SearchBar value={search} onChange={setSearch}
                    placeholder={t('finance.fees.searchPlaceholder')} />
                <ClassFilter grade={klass.grade} stream={klass.stream}
                    onChange={setKlass} disabled={loading} />
                <div className="toolbar-spacer" />
                <DocumentActions url="/imboni/finance/fees/" params={docParams}
                    stem="charges" disabled={loading} />
            </div>

            <div className="toolbar-card mb-1-5">
                <FilterBar
                    options={FILTERS.map(key => ({ key, label: t(`finance.fees.filter.${key}`) }))}
                    active={status}
                    onChange={next => {
                        setStatus(next)
                        setSearchParams(next === 'outstanding' ? {} : { status: next },
                            { replace: true })
                    }}
                />
            </div>

            <DataTable
                title={t(`finance.fees.filter.${status}`)}
                data={visible}
                columns={[t('common.student'), t('finance.fields.category'),
                    t('finance.fields.amount'), t('finance.fields.paid'),
                    t('finance.fields.balance'), t('finance.fields.due'), t('common.status')]}
                emptyIcon="receipt_long"
                emptyTitle={t('finance.fees.none')}
                emptyDesc={t('finance.fees.noneDesc')}
                onClearFilters={status === 'all' ? undefined : () => setStatus('all')}
                renderRow={fee => (
                    <tr key={fee.id}>
                        <td>
                            <strong>{fee.student?.name}</strong>
                            {fee.student?.class_label && (
                                <span className="class-chip">{fee.student.class_label}</span>
                            )}
                        </td>
                        <td>{t(`finance.categories.${fee.category}`)}</td>
                        <td><Money value={fee.amount} /></td>
                        <td><Money value={fee.paid} /></td>
                        <td>
                            {/* The balance is the column the office scans, so it
                                carries the weight and the colour. */}
                            <Money value={fee.balance}
                                className={Number(fee.balance) > 0 ? 'amount-owed' : ''} />
                        </td>
                        <td className="text-muted">{formatDate(fee.due_date)}</td>
                        <td>
                            <span className={badge(fee.status)}>
                                {t(`finance.status.${fee.status}`)}
                            </span>
                        </td>
                    </tr>
                )}
            />
            {loading && <p className="u-pad u-muted">{t('common.loading')}</p>}
        </FinanceShell>
    )
}
