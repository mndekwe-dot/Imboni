import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ListSection } from '../../components/ui/ListSection'
import { EmptyState } from '../../components/ui/EmptyState'
import { DataTable } from '../../components/ui/DataTable'
import { Modal } from '../../components/ui/Modal'
import { StudentSearchPicker } from '../../components/ui/StudentSearchPicker'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { formatDate } from '../../utils/date'
import { downloadCsv, printTable } from '../../utils/exportTable'
import {
    getDebtors, getPayments, getStudentFinance, recordPayment, reversePayment,
} from '../../api/finance'
import { FinanceShell, Money } from './FinanceShell'

const METHODS = ['cash', 'momo', 'bank', 'cheque', 'waiver', 'other']

/**
 * The desk: take money against a charge, and the receipt book behind it.
 *
 * Taking a payment is two steps on purpose — find the family, then pick WHICH
 * charge. A single "pay 20,000" box against a student would have to guess
 * which of tuition, lunch and transport it settles, and guessing wrong is
 * exactly the thing a parent notices at the end of term.
 */
export function FinancePayments() {
    const { t } = useTranslation()
    const toast = useToast()

    const [payments, setPayments] = useState([])
    const [loading, setLoading]   = useState(true)
    const [taking, setTaking]     = useState(false)
    const [receipt, setReceipt]   = useState(null)

    const load = useCallback(() => {
        setLoading(true)
        getPayments()
            .then(d => setPayments(Array.isArray(d) ? d : []))
            .catch(e => { if (e?.status !== 402) toast.error(errorMessage(e, t('finance.loadFailed'))) })
            .finally(() => setLoading(false))
    }, [toast, t])

    useEffect(() => { load() }, [load])

    async function handleReverse(payment) {
        try {
            await reversePayment(payment.id, '')
            load()
            toast.success(t('finance.payments.reversed'))
        } catch (e) {
            toast.error(errorMessage(e, t('finance.saveFailed')))
        }
    }

    function handleExport() {
        downloadCsv('payments', {
            columns: [t('finance.fields.receipt'), t('common.student'),
                t('finance.fields.category'), t('finance.fields.amount'),
                t('finance.fields.method'), t('finance.fields.paidOn')],
            rows: payments.map(p => [p.receipt_no, p.student?.name,
                t(`finance.categories.${p.category}`), p.amount,
                t(`finance.methods.${p.method}`), p.paid_on]),
        })
    }

    return (
        <FinanceShell title={t('finance.payments.title')} subtitle={t('finance.payments.subtitle')}>
            {taking && (
                <TakePaymentModal
                    onClose={() => setTaking(false)}
                    onDone={payment => { setTaking(false); setReceipt(payment); load() }}
                />
            )}
            {receipt && <ReceiptModal payment={receipt} onClose={() => setReceipt(null)} />}

            <div className="toolbar-card mb-1-5">
                <button className="btn btn-primary" onClick={() => setTaking(true)}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span>
                    {t('finance.payments.take')}
                </button>
                <div className="toolbar-spacer" />
                <button className="btn btn-outline btn-sm" onClick={handleExport}
                    disabled={!payments.length}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">download</span>
                    {t('common.export')}
                </button>
            </div>

            <DataTable
                title={t('finance.payments.receiptBook')}
                data={payments}
                columns={[t('finance.fields.receipt'), t('common.student'),
                    t('finance.fields.amount'), t('finance.fields.method'),
                    t('finance.fields.paidOn'), t('common.actions')]}
                emptyIcon="payments"
                emptyTitle={t('finance.payments.none')}
                emptyDesc={t('finance.payments.noneDesc')}
                renderRow={p => (
                    <tr key={p.id} className={p.is_reversed ? 'fin-reversed' : ''}>
                        <td><code className="fin-receipt-no">{p.receipt_no}</code></td>
                        <td>
                            <strong>{p.student?.name}</strong>
                            {p.student?.class_label && (
                                <span className="class-chip">{p.student.class_label}</span>
                            )}
                        </td>
                        <td><Money value={p.amount} /></td>
                        <td>{t(`finance.methods.${p.method}`)}</td>
                        <td className="text-muted">{formatDate(p.paid_on)}</td>
                        <td className="action-cell">
                            {p.is_reversed ? (
                                <span className="badge">{t('finance.payments.reversedTag')}</span>
                            ) : (
                                <>
                                    <button className="btn btn-outline btn-sm"
                                        onClick={() => setReceipt(p)}>
                                        {t('finance.payments.receipt')}
                                    </button>
                                    <button className="btn btn-outline btn-sm"
                                        onClick={() => handleReverse(p)}>
                                        {t('finance.payments.reverse')}
                                    </button>
                                </>
                            )}
                        </td>
                    </tr>
                )}
            />
            {loading && <p className="u-pad u-muted">{t('common.loading')}</p>}
        </FinanceShell>
    )
}

/** Find the family, pick the charge, take the money. */
function TakePaymentModal({ onClose, onDone }) {
    const { t } = useTranslation()
    const toast = useToast()

    const [student, setStudent] = useState(null)
    const [account, setAccount] = useState(null)
    const [feeId, setFeeId]     = useState('')
    const [form, setForm] = useState({ amount: '', method: 'cash', reference: '', payer_name: '' })
    const [busy, setBusy] = useState(false)

    const searchStudents = useCallback(q => getDebtors({ q }).then(rows =>
        (Array.isArray(rows) ? rows : []).map(r => ({
            id: r.student.id,
            name: r.student.name,
            student_id: r.student.student_id,
            grade: r.student.class_label,
            section: '',
        }))), [])

    useEffect(() => {
        if (!student) { setAccount(null); return }
        getStudentFinance(student.id)
            .then(data => {
                setAccount(data)
                // Preselect the oldest unsettled charge — the one a family
                // paying something almost always means to pay.
                const open = (data.fees || []).filter(f => Number(f.balance) > 0)
                setFeeId(open.length ? open[open.length - 1].id : '')
            })
            .catch(() => setAccount(null))
    }, [student])

    const openFees = (account?.fees || []).filter(f => Number(f.balance) > 0)
    const chosen = openFees.find(f => f.id === feeId)

    async function submit() {
        if (!chosen || !form.amount) return
        setBusy(true)
        try {
            const result = await recordPayment({ fee: chosen.id, ...form })
            onDone(result.payment)
            toast.success(t('finance.payments.taken', {
                amount: form.amount, receipt: result.payment.receipt_no,
            }))
        } catch (e) {
            // The server says WHICH rule refused it — more than outstanding,
            // already settled — so pass its words through.
            toast.error(errorMessage(e, t('finance.payments.failed')))
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal
            title={t('finance.payments.take')}
            icon="payments"
            size="wide"
            onClose={onClose}
            footer={
                <>
                    <button className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
                    <button className="btn btn-primary" onClick={submit}
                        disabled={busy || !chosen || !form.amount}>
                        {t('finance.payments.take')}
                    </button>
                </>
            }
        >
            <StudentSearchPicker
                value={student}
                onChange={setStudent}
                fetchStudents={searchStudents}
                label={t('common.student')}
                placeholder={t('finance.payments.findStudent')}
            />

            {student && !openFees.length && (
                <p className="u-muted mt-1-5">{t('finance.payments.nothingOwed')}</p>
            )}

            {openFees.length > 0 && (
                <>
                    <div className="mt-1-5">
                        <label className="form-label" htmlFor="pay-fee">
                            {t('finance.payments.whichCharge')}
                        </label>
                        <select id="pay-fee" className="form-select" value={feeId}
                            onChange={e => setFeeId(e.target.value)}>
                            {openFees.map(f => (
                                <option key={f.id} value={f.id}>
                                    {t(`finance.categories.${f.category}`)} — {f.balance} ({f.due_date})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="fin-form-grid mt-1-5">
                        <div>
                            <label className="form-label" htmlFor="pay-amount">
                                {t('finance.fields.amount')}
                            </label>
                            <input id="pay-amount" type="number" step="0.01" className="form-input"
                                value={form.amount}
                                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                            {chosen && (
                                <p className="text-xs-muted">
                                    {t('finance.payments.outstandingIs', { amount: chosen.balance })}
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="form-label" htmlFor="pay-method">
                                {t('finance.fields.method')}
                            </label>
                            <select id="pay-method" className="form-select" value={form.method}
                                onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                                {METHODS.map(m => (
                                    <option key={m} value={m}>{t(`finance.methods.${m}`)}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="form-label" htmlFor="pay-ref">
                                {t('finance.fields.reference')}
                            </label>
                            <input id="pay-ref" className="form-input" value={form.reference}
                                placeholder={t('finance.payments.referencePlaceholder')}
                                onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
                        </div>
                        <div>
                            <label className="form-label" htmlFor="pay-payer">
                                {t('finance.fields.payer')}
                            </label>
                            <input id="pay-payer" className="form-input" value={form.payer_name}
                                onChange={e => setForm(f => ({ ...f, payer_name: e.target.value }))} />
                        </div>
                    </div>
                </>
            )}
        </Modal>
    )
}

/** The slip the family walks away with. */
function ReceiptModal({ payment, onClose }) {
    const { t } = useTranslation()

    function print() {
        printTable(t('finance.payments.receipt'), {
            columns: [t('finance.fields.field'), t('finance.fields.value')],
            rows: [
                [t('finance.fields.receipt'), payment.receipt_no],
                [t('common.student'), payment.student?.name],
                [t('common.class'), payment.student?.class_label],
                [t('finance.fields.category'), t(`finance.categories.${payment.category}`)],
                [t('finance.fields.amount'), payment.amount],
                [t('finance.fields.method'), t(`finance.methods.${payment.method}`)],
                [t('finance.fields.reference'), payment.reference || '-'],
                [t('finance.fields.paidOn'), payment.paid_on],
                [t('finance.fields.receivedBy'), payment.received_by_name || '-'],
            ],
        })
    }

    return (
        <Modal
            title={t('finance.payments.receipt')}
            icon="receipt"
            onClose={onClose}
            footer={
                <>
                    <button className="btn btn-outline" onClick={onClose}>{t('common.close')}</button>
                    <button className="btn btn-primary" onClick={print}>
                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">print</span>
                        {t('common.print')}
                    </button>
                </>
            }
        >
            <div className="fin-receipt">
                <div className="fin-receipt-head">
                    <span className="fin-receipt-no">{payment.receipt_no}</span>
                    <Money value={payment.amount} className="fin-receipt-amount" />
                </div>
                <dl className="fin-detail-grid">
                    <div><dt>{t('common.student')}</dt><dd>{payment.student?.name}</dd></div>
                    <div><dt>{t('common.class')}</dt><dd>{payment.student?.class_label || '-'}</dd></div>
                    <div>
                        <dt>{t('finance.fields.category')}</dt>
                        <dd>{t(`finance.categories.${payment.category}`)}</dd>
                    </div>
                    <div>
                        <dt>{t('finance.fields.method')}</dt>
                        <dd>{t(`finance.methods.${payment.method}`)}</dd>
                    </div>
                    <div><dt>{t('finance.fields.reference')}</dt><dd>{payment.reference || '-'}</dd></div>
                    <div><dt>{t('finance.fields.paidOn')}</dt><dd>{formatDate(payment.paid_on)}</dd></div>
                </dl>
            </div>
        </Modal>
    )
}
