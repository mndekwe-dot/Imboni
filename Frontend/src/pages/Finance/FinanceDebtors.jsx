import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SearchBar } from '../../components/ui/SearchBar'
import { ClassFilter } from '../../components/ui/ClassFilter'
import { DocumentActions } from '../../components/ui/DocumentActions'
import { ListSection } from '../../components/ui/ListSection'
import { EmptyState } from '../../components/ui/EmptyState'
import { DataTable } from '../../components/ui/DataTable'
import { Modal } from '../../components/ui/Modal'
import { StatCard } from '../../components/layout/StatCard'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { formatDate } from '../../utils/date'
import { getDebtors, getStudentFinance, saveStudentAccount } from '../../api/finance'
import { FinanceShell, Money } from './FinanceShell'

/** Who owes what, worst first — the list the office actually works from. */
export function FinanceDebtors() {
    const { t } = useTranslation()
    const toast = useToast()

    const [rows, setRows]       = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch]   = useState('')
    const [openId, setOpenId]   = useState(null)
    const [klass, setKlass]     = useState({ grade: '', stream: '' })

    // The class narrows the QUERY, not the rendered rows. Filtering a capped
    // list in the browser would show "S4A" while quietly hiding the S4A
    // families who fell outside the server's first 300 rows.
    const params = {
        ...(klass.grade ? { grade: klass.grade } : {}),
        ...(klass.stream ? { stream: klass.stream } : {}),
    }

    const load = useCallback(() => {
        setLoading(true)
        getDebtors(params)
            .then(d => setRows(Array.isArray(d) ? d : []))
            .catch(e => { if (e?.status !== 402) toast.error(errorMessage(e, t('finance.loadFailed'))) })
            .finally(() => setLoading(false))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toast, t, klass.grade, klass.stream])

    useEffect(() => { load() }, [load])

    const q = search.trim().toLowerCase()
    const visible = rows.filter(r =>
        !q || r.student.name.toLowerCase().includes(q)
        || (r.student.student_id || '').toLowerCase().includes(q)
        || (r.student.class_label || '').toLowerCase().includes(q))

    const totalOwed = visible.reduce((sum, r) => sum + Number(r.outstanding), 0)
    const totalOverdue = visible.reduce((sum, r) => sum + Number(r.overdue), 0)

    return (
        <FinanceShell title={t('finance.debtors.title')} subtitle={t('finance.debtors.subtitle')}>
            {openId && (
                <StudentAccountModal id={openId} onClose={() => setOpenId(null)} onSaved={load} />
            )}

            <div className="portal-stat-grid mb-1-5">
                <StatCard icon="groups" value={loading ? '-' : visible.length}
                    label={t('finance.debtors.families')} colorClass="info" />
                <StatCard icon="account_balance_wallet"
                    value={loading ? '-' : <Money value={totalOwed} />}
                    label={t('finance.stats.outstanding')} colorClass="warning" />
                <StatCard icon="event_busy"
                    value={loading ? '-' : <Money value={totalOverdue} />}
                    label={t('finance.fields.overdue')}
                    colorClass={totalOverdue > 0 ? 'warning' : ''} />
            </div>

            <div className="toolbar-card mb-1-5">
                <SearchBar value={search} onChange={setSearch}
                    placeholder={t('finance.debtors.searchPlaceholder')} />
                <ClassFilter grade={klass.grade} stream={klass.stream}
                    onChange={setKlass} disabled={loading} />
                <div className="toolbar-spacer" />
                {/* Printed and exported from the server with the same filters,
                    so the paper matches the screen and carries every row rather
                    than the page's first 300. */}
                <DocumentActions url="/imboni/finance/debtors/" params={params}
                    stem="who-owes" disabled={loading} />
            </div>

            <ListSection
                icon="account_balance_wallet"
                title={t('finance.debtors.title')}
                count={loading ? null : t('finance.familyCount', { count: visible.length })}
            >
                {loading ? (
                    <p className="u-muted">{t('common.loading')}</p>
                ) : visible.length === 0 ? (
                    <EmptyState
                        icon={search ? 'search_off' : 'task_alt'}
                        title={search ? t('common.noResults', { query: search })
                            : t('finance.debtors.allSettled')}
                        description={search ? t('common.trySearch')
                            : t('finance.debtors.allSettledDesc')}
                        action={search
                            ? { label: t('common.clear'), icon: 'close', onClick: () => setSearch('') }
                            : undefined}
                    />
                ) : (
                    <ul className="fin-row-list">
                        {visible.map(row => (
                            <li key={row.student.id} className="fin-row">
                                <button className="fin-row-open" onClick={() => setOpenId(row.student.id)}>
                                    <span className="fin-avatar">{initials(row.student.name)}</span>
                                    <span className="fin-row-main">
                                        <span className="u-strong u-sm">{row.student.name}</span>
                                        <span className="text-xs-muted">
                                            {row.student.class_label} · {row.student.student_id}
                                        </span>
                                    </span>
                                </button>
                                <span className="fin-row-figures">
                                    <Money value={row.outstanding} className="fin-owed" />
                                    {Number(row.overdue) > 0 && (
                                        <span className="badge badge-high">
                                            {t('finance.debtors.overdueOf', { amount: row.overdue })}
                                        </span>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </ListSection>
        </FinanceShell>
    )
}

function initials(name = '') {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

/** One family: every charge, and the office's note about them. */
function StudentAccountModal({ id, onClose, onSaved }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [data, setData] = useState(null)
    const [note, setNote] = useState({ payer_name: '', payer_phone: '', arrangement: '', bursary_percent: '0' })

    useEffect(() => {
        getStudentFinance(id).then(d => {
            setData(d)
            if (d.account) {
                setNote({
                    payer_name: d.account.payer_name || '',
                    payer_phone: d.account.payer_phone || '',
                    arrangement: d.account.arrangement || '',
                    bursary_percent: d.account.bursary_percent ?? '0',
                })
            }
        }).catch(() => setData(null))
    }, [id])

    async function save() {
        try {
            await saveStudentAccount(id, note)
            toast.success(t('common.saved'))
            onSaved?.()
        } catch (e) {
            toast.error(errorMessage(e, t('finance.saveFailed')))
        }
    }

    return (
        <Modal
            title={data?.student?.name || t('common.loading')}
            icon="account_balance_wallet"
            size="wide"
            onClose={onClose}
            footer={
                <>
                    <button className="btn btn-outline" onClick={onClose}>{t('common.close')}</button>
                    <button className="btn btn-primary" onClick={save}>{t('common.save')}</button>
                </>
            }
        >
            {!data ? <p className="u-muted">{t('common.loading')}</p> : (
                <>
                    <div className="fin-balance-row">
                        <div>
                            <span className="fin-balance-label">{t('finance.stats.charged')}</span>
                            <Money value={data.charged} />
                        </div>
                        <div>
                            <span className="fin-balance-label">{t('finance.stats.collected')}</span>
                            <Money value={data.paid} />
                        </div>
                        <div>
                            <span className="fin-balance-label">{t('finance.stats.outstanding')}</span>
                            <Money value={data.outstanding} className="fin-owed" />
                        </div>
                    </div>

                    <DataTable
                        title={t('finance.debtors.charges')}
                        data={data.fees}
                        pageSize={6}
                        columns={[t('finance.fields.category'), t('finance.fields.amount'),
                            t('finance.fields.paid'), t('finance.fields.balance'),
                            t('finance.fields.due'), t('common.status')]}
                        emptyIcon="receipt_long"
                        emptyTitle={t('finance.debtors.noCharges')}
                        emptyDesc={t('finance.debtors.noChargesDesc')}
                        renderRow={fee => (
                            <tr key={fee.id}>
                                <td><strong>{t(`finance.categories.${fee.category}`)}</strong></td>
                                <td><Money value={fee.amount} /></td>
                                <td><Money value={fee.paid} /></td>
                                <td><Money value={fee.balance} /></td>
                                <td className="text-muted">{formatDate(fee.due_date)}</td>
                                <td>
                                    <span className={`badge fin-status-${fee.status}`}>
                                        {t(`finance.status.${fee.status}`)}
                                    </span>
                                </td>
                            </tr>
                        )}
                    />

                    {/* The office's own note. A bursary is a discount applied when
                        charges are RAISED, not a payment — the school never
                        received that money and the books must not say it did. */}
                    <h3 className="card-title mt-1-5">
                        <span className="material-symbols-rounded" aria-hidden="true">edit_note</span>
                        {t('finance.debtors.officeNote')}
                    </h3>
                    <div className="fin-form-grid">
                        <div>
                            <label className="form-label" htmlFor="acc-payer">
                                {t('finance.fields.payer')}
                            </label>
                            <input id="acc-payer" className="form-input" value={note.payer_name}
                                onChange={e => setNote(n => ({ ...n, payer_name: e.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label" htmlFor="acc-phone">
                                {t('finance.fields.phone')}
                            </label>
                            <input id="acc-phone" className="form-input" value={note.payer_phone}
                                onChange={e => setNote(n => ({ ...n, payer_phone: e.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label" htmlFor="acc-bursary">
                                {t('finance.fields.bursary')}
                            </label>
                            <input id="acc-bursary" type="number" min="0" max="100" className="form-input"
                                value={note.bursary_percent}
                                onChange={e => setNote(n => ({ ...n, bursary_percent: e.target.value }))} />
                            <p className="text-xs-muted">{t('finance.debtors.bursaryHint')}</p>
                        </div>
                        <div className="fin-col-full">
                            <label className="form-label" htmlFor="acc-arrangement">
                                {t('finance.fields.arrangement')}
                            </label>
                            <textarea id="acc-arrangement" className="form-input form-textarea" rows="2"
                                value={note.arrangement}
                                onChange={e => setNote(n => ({ ...n, arrangement: e.target.value }))} />
                        </div>
                    </div>
                </>
            )}
        </Modal>
    )
}
