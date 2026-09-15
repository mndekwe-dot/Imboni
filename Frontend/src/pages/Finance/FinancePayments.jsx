import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ListSection } from '../../components/ui/ListSection'
import { EmptyState } from '../../components/ui/EmptyState'
import { DataTable } from '../../components/ui/DataTable'
import { Modal } from '../../components/ui/Modal'
import { StudentSearchPicker } from '../../components/ui/StudentSearchPicker'
import { ClassFilter } from '../../components/ui/ClassFilter'
import { openDocument } from '../../api/documents'
import { DocumentActions } from '../../components/ui/DocumentActions'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { formatDate } from '../../utils/date'
import {
    getDebtors, getPayments, getStudentFinance, recordPayment, reversePayment,
} from '../../api/finance'
import { FinanceShell, Money, formatAmount, categoryName } from './FinanceShell'

const METHODS = ['cash', 'momo', 'bank', 'cheque', 'waiver', 'other']

/**
 * The desk: take money from a family, and the receipt book behind it.
 *
 * One sum can settle several charges. Where it goes is shown line by line
 * before it is saved - a "pay 20,000" box that silently picked tuition over
 * lunch is exactly the thing a parent notices at the end of term.
 */
export function FinancePayments() {
    const { t } = useTranslation()
    const toast = useToast()

    const [payments, setPayments] = useState([])
    const [loading, setLoading]   = useState(true)
    const [taking, setTaking]     = useState(false)
    const [receipt, setReceipt]   = useState(null)

    const [klass, setKlass] = useState({ grade: '', stream: '' })

    // Sent to the list, to Print and to Export alike, so a cash-up sheet is the
    // receipt book on screen rather than a similar-looking one.
    const docParams = {
        ...(klass.grade ? { grade: klass.grade } : {}),
        ...(klass.stream ? { stream: klass.stream } : {}),
    }

    const load = useCallback(() => {
        setLoading(true)
        getPayments(docParams)
            .then(d => setPayments(Array.isArray(d) ? d : []))
            .catch(e => { if (e?.status !== 402) toast.error(errorMessage(e, t('finance.loadFailed'))) })
            .finally(() => setLoading(false))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toast, t, klass.grade, klass.stream])

    useEffect(() => { load() }, [load])

    // Reverses the whole receipt: every charge a split payment covered.
    async function handleReverse(payment) {
        try {
            await reversePayment(payment.id, '')
            load()
            toast.success(t('finance.payments.reversed'))
        } catch (e) {
            toast.error(errorMessage(e, t('finance.saveFailed')))
        }
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

            <ClassFilter grade={klass.grade} stream={klass.stream}
                onChange={setKlass} disabled={loading} />

            <div className="toolbar-card mb-1-5">
                <button className="btn btn-primary" onClick={() => setTaking(true)}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span>
                    {t('finance.payments.take')}
                </button>
                <div className="toolbar-spacer" />
                {/* Printing the receipt book is the cash-up: the same rows,
                    with a line for whoever counted and whoever checked. */}
                <DocumentActions url="/imboni/finance/payments/" params={docParams}
                    stem="receipts" disabled={loading} />
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

/**
 * Split a sum across charges the way the server will when nobody chooses:
 * oldest due date first, each charge filled before the next gets anything.
 */
function allocateOldestFirst(fees, amount) {
    let left = Math.max(0, Number(amount) || 0)
    const parts = {}
    for (const fee of fees) {
        const part = Math.min(left, Number(fee.balance))
        parts[fee.id] = part > 0 ? String(part) : ''
        left -= part
    }
    return parts
}

/**
 * Find the family, take the money, see where it goes.
 *
 * A parent hands over one sum, and it usually covers more than one charge:
 * arrears, then tuition, then part of lunch. The sum is spread oldest charge
 * first, shown line by line before anything is saved, and the bursar can set
 * each line by hand when the family says otherwise (a sponsor pays tuition,
 * so this money is for lunch). It all goes on one receipt.
 */
function TakePaymentModal({ onClose, onDone }) {
    const { t } = useTranslation()
    const toast = useToast()

    const [student, setStudent] = useState(null)
    const [account, setAccount] = useState(null)
    const [form, setForm] = useState({ amount: '', method: 'cash', reference: '', payer_name: '' })
    const [manual, setManual] = useState(false)
    const [parts, setParts]   = useState({})
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
        if (!student) return
        getStudentFinance(student.id)
            .then(setAccount)
            .catch(e => {
                setAccount(null)
                toast.error(errorMessage(e, t('finance.loadFailed')))
            })
    }, [student, toast, t])

    const openFees = (student ? account?.fees || [] : [])
        .filter(f => Number(f.balance) > 0)
        .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
    const totalOwed = openFees.reduce((sum, f) => sum + Number(f.balance), 0)

    const shown = manual ? parts : allocateOldestFirst(openFees, form.amount)
    const amount = manual
        ? openFees.reduce((sum, f) => sum + (Number(parts[f.id]) || 0), 0)
        : Number(form.amount) || 0
    const tooMuch = amount > totalOwed
    const lineTooMuch = manual && openFees.some(f => Number(parts[f.id]) > Number(f.balance))

    function chooseStudent(next) {
        setStudent(next)
        setAccount(null)
        setManual(false)
        setParts({})
    }

    function toggleManual(on) {
        // Start the hand-set lines from the split already on screen, so ticking
        // the box changes nothing until a line is edited.
        if (on) setParts(allocateOldestFirst(openFees, form.amount))
        setManual(on)
    }

    async function submit() {
        if (!student || amount <= 0 || tooMuch || lineTooMuch) return
        setBusy(true)
        try {
            const allocations = openFees
                .filter(f => Number(shown[f.id]) > 0)
                .map(f => ({ fee: f.id, amount: String(shown[f.id]) }))
            const result = await recordPayment({
                student: student.id, ...form, amount: String(amount), allocations,
            })
            onDone({ ...result.payment, amount: result.total, lines: result.payments })
            toast.success(t('finance.payments.taken', {
                amount: formatAmount(result.total), receipt: result.payment.receipt_no,
            }))
        } catch (e) {
            // The server says WHICH rule refused it (more than is owed, lines
            // that do not add up), so pass its words through.
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
                        disabled={busy || !student || amount <= 0 || tooMuch || lineTooMuch}>
                        {t('finance.payments.take')}
                    </button>
                </>
            }
        >
            <StudentSearchPicker
                value={student}
                onChange={chooseStudent}
                fetchStudents={searchStudents}
                label={t('common.student')}
                placeholder={t('finance.payments.findStudent')}
            />

            {student && account && !openFees.length && (
                <p className="u-muted mt-1-5">{t('finance.payments.nothingOwed')}</p>
            )}

            {openFees.length > 0 && (
                <>
                    <div className="form-grid mt-1-5">
                        <div>
                            <label className="form-label" htmlFor="pay-amount">
                                {t('finance.fields.amount')}
                            </label>
                            <input id="pay-amount" type="number" min="0" step="1" className="form-input"
                                value={manual ? String(amount || '') : form.amount}
                                readOnly={manual}
                                aria-invalid={tooMuch || undefined}
                                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                            <p className={tooMuch ? 'text-xs-muted u-danger' : 'text-xs-muted'}>
                                {tooMuch
                                    ? t('finance.payments.tooMuch', { amount: formatAmount(totalOwed) })
                                    : t('finance.payments.totalOwed', { amount: formatAmount(totalOwed) })}
                            </p>
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

                    <p className="text-xs-muted mt-1-5">{t('finance.payments.splitIntro')}</p>
                    <div className="data-table-wrap framed">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>{t('finance.payments.charge')}</th>
                                    <th className="u-text-right">{t('finance.payments.owed')}</th>
                                    <th className="u-text-right">{t('finance.payments.thisPayment')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {openFees.map(f => (
                                    <tr key={f.id}>
                                        <td>
                                            <strong>{categoryName(t, f.category, f.category_name)}</strong>
                                            <div className="text-xs-muted">
                                                {t('finance.payments.dueOn', { date: formatDate(f.due_date) })}
                                            </div>
                                        </td>
                                        <td className="u-text-right"><Money value={f.balance} /></td>
                                        <td className="u-text-right">
                                            {manual ? (
                                                <input type="number" min="0" step="1" max={f.balance}
                                                    className="form-input fin-split-input"
                                                    aria-label={t('finance.payments.amountFor', {
                                                        charge: categoryName(t, f.category, f.category_name),
                                                    })}
                                                    aria-invalid={Number(parts[f.id]) > Number(f.balance) || undefined}
                                                    value={parts[f.id] ?? ''}
                                                    onChange={e => setParts(p => ({ ...p, [f.id]: e.target.value }))} />
                                            ) : Number(shown[f.id]) > 0 ? (
                                                <Money value={shown[f.id]} />
                                            ) : (
                                                <span className="text-muted">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <label className="form-check mt-1">
                        <input type="checkbox" checked={manual}
                            onChange={e => toggleManual(e.target.checked)} />
                        <span>{t('finance.payments.chooseAmounts')}</span>
                    </label>
                </>
            )}
        </Modal>
    )
}

/** The slip the family walks away with. */
function ReceiptModal({ payment, onClose }) {
    const { t } = useTranslation()

    // The server renders this one. A receipt printed from the browser is a
    // two-column table with no letterhead, no balance and nowhere to sign --
    // the parent is being handed a document, not a screenshot.
    function print() {
        openDocument(`/imboni/finance/payments/${payment.id}/receipt/`)
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
                <dl className="detail-grid">
                    <div><dt>{t('common.student')}</dt><dd>{payment.student?.name}</dd></div>
                    <div><dt>{t('common.class')}</dt><dd>{payment.student?.class_label || '-'}</dd></div>
                    {/* A receipt that covered several charges lists each; one
                        picked from the receipt book shows its own line. */}
                    <div>
                        <dt>{t('finance.fields.category')}</dt>
                        <dd>
                            {(payment.lines?.length > 1 ? payment.lines : [payment]).map(line => (
                                <div key={line.id || line.category}>
                                    {categoryName(t, line.category, line.category_name)}
                                    {payment.lines?.length > 1 && <> · <Money value={line.amount} /></>}
                                </div>
                            ))}
                        </dd>
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
