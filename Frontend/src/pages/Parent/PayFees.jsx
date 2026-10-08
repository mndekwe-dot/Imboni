import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { formatAmount } from '../../utils/money'
import { getChildPay, startChildPay, getChildPayAttempt } from '../../api/parent'

const POLL_MS = 4000
const GIVE_UP_MS = 3 * 60 * 1000

function PayModal({ childId, owing, onClose, onSettled }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [amount, setAmount] = useState(String(Math.round(Number(owing))))
    const [phone, setPhone] = useState('')
    const [attempt, setAttempt] = useState(null)   // {id, status, detail, receipt_no}
    const [busy, setBusy] = useState(false)
    const startedAt = useRef(0)
    const [tick, setTick] = useState(0)   // bumps after a dropped request, to ask again

    // Ask how it is going until the parent approves, declines, or we give up waiting.
    // One effect per state of the attempt, so leaving the page cancels the next ask.
    useEffect(() => {
        if (!attempt || attempt.status !== 'pending') return undefined
        const timer = setTimeout(async () => {
            try {
                const next = await getChildPayAttempt(childId, attempt.id)
                setAttempt(next)
                if (next.status !== 'pending') onSettled()
                else if (Date.now() - startedAt.current < GIVE_UP_MS) setTick(n => n + 1)
            } catch {
                // A dropped request is not a declined payment: keep asking.
                if (Date.now() - startedAt.current < GIVE_UP_MS) setTick(n => n + 1)
            }
        }, POLL_MS)
        return () => clearTimeout(timer)
    }, [attempt, tick, childId, onSettled])

    async function send(e) {
        e.preventDefault()
        setBusy(true)
        try {
            startedAt.current = Date.now()
            setAttempt(await startChildPay(childId, { amount, phone }))
        } catch (err) {
            toast.error(errorMessage(err, t('parent.pay.failedStart')))
        } finally { setBusy(false) }
    }

    const finished = attempt && attempt.status !== 'pending'

    return (
        <Modal title={t('parent.pay.title')} icon="payments" onClose={onClose}>
            {!attempt ? (
                <form onSubmit={send}>
                    <p className="u-muted u-sm">{t('parent.pay.intro')}</p>
                    <label className="form-group">
                        <span className="form-label">{t('parent.pay.amount')}</span>
                        <input className="form-input" type="number" min="1" max={owing} required value={amount}
                            onChange={e => setAmount(e.target.value)} />
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('parent.pay.phone')}</span>
                        <input className="form-input" type="tel" inputMode="tel" placeholder="07XX XXX XXX" required
                            value={phone} onChange={e => setPhone(e.target.value)} />
                    </label>
                    <div className="modal-actions">
                        <button type="button" className="btn btn-outline" onClick={onClose}>{t('parent.pay.close')}</button>
                        <button type="submit" className="btn btn-primary" disabled={busy}>{t('parent.pay.send')}</button>
                    </div>
                </form>
            ) : (
                <div role="status">
                    {attempt.status === 'pending' && <p>{t('parent.pay.waiting')}</p>}
                    {attempt.status === 'successful' && <p className="u-strong">{t('parent.pay.success', { receipt: attempt.receipt_no })}</p>}
                    {attempt.status === 'needs_review' && <p>{t('parent.pay.review')}</p>}
                    {attempt.status === 'failed' && <p className="form-error">{t('parent.pay.failed', { reason: attempt.detail })}</p>}
                    {finished && (
                        <div className="modal-actions">
                            <button className="btn btn-primary" onClick={onClose}>{t('parent.pay.close')}</button>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    )
}

/**
 * "Pay with mobile money", on a child's card.
 *
 * Absent unless the school has switched online payment on AND something is
 * owing: a button that cannot work, or that offers to pay nothing, is worse
 * than none.
 */
export function PayFeesPanel({ childId }) {
    const { t } = useTranslation()
    const [info, setInfo] = useState(null)
    const [open, setOpen] = useState(false)

    const load = useCallback(() => {
        getChildPay(childId).then(setInfo).catch(() => setInfo(null))
    }, [childId])

    useEffect(() => { load() }, [load])

    if (!info?.enabled || Number(info.outstanding) <= 0) return null

    return (
        <section className="detail-section">
            <div className="financial-row">
                <span className="label">{t('parent.pay.owing', { amount: formatAmount(info.outstanding) })}</span>
                <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>{t('parent.pay.button')}</button>
            </div>
            {open && <PayModal childId={childId} owing={info.outstanding} onClose={() => setOpen(false)} onSettled={load} />}
        </section>
    )
}
