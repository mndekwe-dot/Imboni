import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { statementRows } from '../../utils/statementImport'
import { matchStatement, applyStatement } from '../../api/finance'
import { formatAmount } from './FinanceShell'

const TONE = { suggested: 'badge-soft-success', ambiguous: 'badge-soft-warning', recorded: 'badge-soft-info', unmatched: 'badge-soft-danger' }

/**
 * Match a statement to families, look, then record.
 *
 * Matching writes nothing. Every line the server could place with confidence is
 * ticked; one it could not is listed for the bursar to choose or leave. What is
 * recorded is exactly what is ticked here, and a reference already on a receipt
 * is skipped by the server, so pressing Record twice cannot double a payment.
 */
export function StatementModal({ onClose, onDone }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [method, setMethod] = useState('bank')
    const [lines, setLines] = useState(null)       // the parsed statement
    const [matches, setMatches] = useState(null)   // what the server said per line
    const [choice, setChoice] = useState({})       // line index -> chosen student id
    const [include, setInclude] = useState({})     // line index -> bool
    const [fileError, setFileError] = useState('')
    const [busy, setBusy] = useState(false)

    async function read(e) {
        const file = e.target.files?.[0]
        setMatches(null); setFileError('')
        if (!file) { setLines(null); return }
        const { error, rows } = statementRows(await file.text())
        if (error) { setLines(null); setFileError(t('finance.statement.noAmount')); return }
        if (rows.length === 0) { setLines(null); setFileError(t('finance.statement.noRows')); return }
        setLines(rows)
    }

    async function match() {
        setBusy(true)
        try {
            const out = await matchStatement({ rows: lines })
            const chosen = {}, ticked = {}
            out.results.forEach(r => {
                if (r.status === 'suggested') { chosen[r.row] = r.candidates[0].id; ticked[r.row] = true }
            })
            setMatches(out.results); setChoice(chosen); setInclude(ticked)
        } catch (err) {
            toast.error(errorMessage(err, t('finance.statement.matchFailed')))
        } finally { setBusy(false) }
    }

    const ready = matches ? matches.filter(r => include[r.row] && choice[r.row]) : []
    const review = matches ? matches.filter(r => r.status === 'ambiguous' && !choice[r.row]).length : 0
    const skip = matches ? matches.length - ready.length - review : 0

    async function apply() {
        setBusy(true)
        try {
            const out = await applyStatement({
                method,
                rows: ready.map(r => ({
                    student: choice[r.row], amount: lines[r.row].amount,
                    reference: lines[r.row].reference, date: lines[r.row].date || undefined,
                })),
            })
            toast.success(t('finance.statement.applied', { taken: out.taken.length, skipped: out.skipped.length }))
            onDone(); onClose()
        } catch (err) {
            toast.error(errorMessage(err, t('finance.statement.applyFailed')))
        } finally { setBusy(false) }
    }

    return (
        <Modal title={t('finance.statement.title')} icon="account_balance" size="lg" onClose={onClose}
            unsavedMessage={matches && ready.length > 0 ? t('finance.statement.discard') : undefined}
            footer={
                <>
                    <button className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
                    {!matches ? (
                        <button className="btn btn-primary" onClick={match} disabled={busy || !lines}>
                            {busy ? t('finance.statement.matching') : t('finance.statement.match')}
                        </button>
                    ) : (
                        <button className="btn btn-primary" onClick={apply} disabled={busy || ready.length === 0}>
                            {t('finance.statement.apply', { count: ready.length })}
                        </button>
                    )}
                </>
            }>
            {!matches && (
                <>
                    <p className="u-muted u-sm">{t('finance.statement.intro')}</p>
                    <div className="form-grid">
                        <label className="form-group">
                            <span className="form-label">{t('finance.statement.method')}</span>
                            <select className="form-input" value={method} onChange={e => setMethod(e.target.value)}>
                                <option value="bank">{t('finance.statement.bank')}</option>
                                <option value="momo">{t('finance.statement.momo')}</option>
                            </select>
                        </label>
                        <label className="form-group">
                            <span className="form-label">{t('finance.statement.file')}</span>
                            <input className="form-input" type="file" accept=".csv,text/csv" onChange={read} />
                        </label>
                    </div>
                    {fileError && <p className="form-error">{fileError}</p>}
                </>
            )}

            {matches && (
                <>
                    <p className="u-strong" role="status">
                        {t('finance.statement.summary', { ready: ready.length, review, skip })}
                    </p>
                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>{t('finance.statement.record')}</th>
                                    <th>{t('finance.statement.amount')}</th>
                                    <th>{t('finance.statement.reference')}</th>
                                    <th>{t('finance.statement.family')}</th>
                                    <th>{t('common.status')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {matches.map(r => {
                                    const line = lines[r.row]
                                    const pickable = r.status === 'suggested' || r.status === 'ambiguous'
                                    return (
                                        <tr key={r.row}>
                                            <td>
                                                <input type="checkbox" disabled={!pickable || !choice[r.row]}
                                                    checked={!!include[r.row]} aria-label={`${t('finance.statement.line')} ${r.row + 1}`}
                                                    onChange={e => setInclude(i => ({ ...i, [r.row]: e.target.checked }))} />
                                            </td>
                                            <td>{formatAmount(line.amount.replace(/,/g, ''))}</td>
                                            <td>{line.reference || '-'}</td>
                                            <td>
                                                {pickable ? (
                                                    <select className="form-input" value={choice[r.row] || ''}
                                                        aria-label={`${t('finance.statement.family')} ${r.row + 1}`}
                                                        onChange={e => {
                                                            setChoice(c => ({ ...c, [r.row]: e.target.value }))
                                                            setInclude(i => ({ ...i, [r.row]: !!e.target.value }))
                                                        }}>
                                                        {r.status === 'ambiguous' && <option value="">{t('finance.statement.choose')}</option>}
                                                        {r.candidates.map(c => (
                                                            <option key={c.id} value={c.id}>{c.name} · {c.class_label} · {c.student_id}</option>
                                                        ))}
                                                    </select>
                                                ) : <span className="u-muted u-sm">{r.status === 'unmatched' ? t('finance.statement.unmatchedHint') : r.reason}</span>}
                                            </td>
                                            <td><span className={`badge ${TONE[r.status]}`} title={r.reason}>{t(`finance.statement.status.${r.status}`)}</span></td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </Modal>
    )
}
