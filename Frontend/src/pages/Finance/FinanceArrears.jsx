import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ClassFilter } from '../../components/ui/ClassFilter'
import { DocumentActions } from '../../components/ui/DocumentActions'
import { ListSection } from '../../components/ui/ListSection'
import { carryArrears, getArrears } from '../../api/finance'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { Money } from './FinanceShell'

/**
 * Money families still owe from terms that have finished, and the button that
 * moves it onto this term's bills.
 *
 * It lived under Other income, which it has nothing to do with: it is fees,
 * owed by families, and belongs beside the charges and the list of who owes.
 */
export function ArrearsPanel() {
    const { t } = useTranslation()
    const toast = useToast()
    const [arrears, setArrears] = useState({ total: '0', results: [] })
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)
    const [klass, setKlass] = useState({ grade: '', stream: '' })

    const params = {
        ...(klass.grade ? { grade: klass.grade } : {}),
        ...(klass.stream ? { stream: klass.stream } : {}),
    }

    const load = useCallback(() => {
        setLoading(true)
        getArrears(params)
            .then(a => setArrears(a || { total: '0', results: [] }))
            .catch(e => { if (e?.status !== 402) toast.error(errorMessage(e, t('finance.loadFailed'))) })
            .finally(() => setLoading(false))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toast, t, klass.grade, klass.stream])

    useEffect(() => { load() }, [load])

    async function carry() {
        setBusy(true)
        try {
            const result = await carryArrears()
            toast.success(t('finance.income.carried', { raised: result.raised, updated: result.updated }))
            load()
        } catch (error) {
            toast.error(errorMessage(error, t('finance.income.carryFailed')))
        } finally {
            setBusy(false)
        }
    }

    const rows = arrears.results || []

    return (
        <>
            <ClassFilter grade={klass.grade} stream={klass.stream}
                onChange={setKlass} disabled={loading} />

            <div className="toolbar-card mb-1-5">
                <div className="toolbar-spacer" />
                <button className="btn btn-primary btn-sm" onClick={carry} disabled={busy || loading || !rows.length}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">redo</span>
                    {t('finance.income.carryForward')}
                </button>
                <DocumentActions url="/imboni/finance/arrears/" params={params}
                    stem="arrears" pdf={false} disabled={loading} />
            </div>

            <ListSection icon="history" title={t('finance.income.arrearsTitle')}
                count={loading ? null : <Money value={arrears.total} />}>
                {loading ? <p className="u-muted">{t('common.loading')}</p> : (
                    <>
                        <p className="u-muted u-sm">{t('finance.income.arrearsNote')}</p>
                        <ul className="row-list mt-1">
                            {rows.map(r => (
                                <li key={r.student.id} className="row-item">
                                    <span className="class-chip">{r.student.class_label}</span>
                                    <div className="row-main">
                                        <div className="u-strong">{r.student.name}</div>
                                        <div className="text-xs-muted">{r.student.student_id}</div>
                                    </div>
                                    <Money value={r.arrears} className="amount-owed" />
                                </li>
                            ))}
                            {rows.length === 0 && <li className="u-muted">{t('finance.income.noArrears')}</li>}
                        </ul>
                    </>
                )}
            </ListSection>
        </>
    )
}
