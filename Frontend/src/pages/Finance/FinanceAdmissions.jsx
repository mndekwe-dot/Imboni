import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTable } from '../../components/ui/DataTable'
import { useToast } from '../../context/ToastContext'
import { confirmDialog } from '../../utils/confirm'
import { errorMessage } from '../../utils/errors'
import { getAdmissions, confirmAdmission } from '../../api/finance'
import { FinanceShell, Money } from './FinanceShell'

/**
 * Students the school is holding until their deposit is confirmed.
 *
 * Only has anyone in it when the school has switched on "hold new students until
 * the deposit is confirmed" (DOS settings). The bursar sees each family's
 * charged, paid and owed, and confirming activates the student and places them
 * in their class, which is the first moment they appear on a register.
 */
export function FinanceAdmissions() {
    const { t } = useTranslation()
    const toast = useToast()
    const [rows, setRows] = useState([])
    const [loading, setLoading] = useState(true)
    const [busyId, setBusyId] = useState(null)

    const load = useCallback(() => {
        setLoading(true)
        getAdmissions()
            .then(res => setRows(res?.results ?? []))
            .catch(err => toast.error(errorMessage(err, t('finance.admissions.loadFailed'))))
            .finally(() => setLoading(false))
    }, [toast, t])

    useEffect(() => { load() }, [load])

    async function confirm(row) {
        if (!(await confirmDialog(t('finance.admissions.confirmAsk', { name: row.full_name })))) return
        setBusyId(row.student_id)
        try {
            const res = await confirmAdmission(row.student_id)
            toast.success(res.placed
                ? t('finance.admissions.confirmedPlaced', { name: row.full_name, class: res.class_name })
                : t('finance.admissions.confirmedUnplaced', { name: row.full_name }))
            setRows(prev => prev.filter(r => r.student_id !== row.student_id))
        } catch (err) {
            toast.error(errorMessage(err, t('finance.admissions.confirmFailed')))
        } finally {
            setBusyId(null)
        }
    }

    return (
        <FinanceShell title={t('finance.admissions.title')} subtitle={t('finance.admissions.subtitle')}>
            <DataTable
                title={t('finance.admissions.table')}
                data={rows}
                loading={loading}
                loadingLabel={t('finance.admissions.loading')}
                skeletonAvatar
                columns={[
                    t('common.student'),
                    t('finance.admissions.classCol'),
                    { label: t('finance.admissions.charged'), align: 'right' },
                    { label: t('finance.admissions.paid'), align: 'right' },
                    { label: t('finance.admissions.owed'), align: 'right' },
                    t('common.actions'),
                ]}
                renderRow={r => (
                    <tr key={r.student_id}>
                        <td>
                            <div className="u-strong">{r.full_name}</div>
                            <div className="text-muted">{r.student_code}</div>
                        </td>
                        <td>{r.grade}{r.section}</td>
                        <td className="dt-num"><Money value={r.charged} /></td>
                        <td className="dt-num"><Money value={r.paid} /></td>
                        <td className="dt-num"><Money value={r.owed} /></td>
                        <td>
                            <button type="button" className="btn btn-primary btn-sm"
                                disabled={busyId === r.student_id} onClick={() => confirm(r)}>
                                <span className="material-symbols-rounded icon-sm" aria-hidden="true">how_to_reg</span>
                                {busyId === r.student_id
                                    ? t('finance.admissions.confirming')
                                    : t('finance.admissions.confirm')}
                            </button>
                        </td>
                    </tr>
                )}
                emptyIcon="how_to_reg"
                emptyTitle={t('finance.admissions.emptyTitle')}
                emptyDesc={t('finance.admissions.emptyDesc')}
            />
        </FinanceShell>
    )
}
