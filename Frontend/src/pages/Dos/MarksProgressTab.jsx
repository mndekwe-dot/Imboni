import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getMarksProgress, remindTeachers } from '../../api/dos'
import { SkeletonTable } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../context/ToastContext'
import { confirmDialog } from '../../utils/confirm'
import { errorMessage } from '../../utils/errors'
import '../../styles/tables.css'
import '../../styles/dos.css'

// What each state looks like. The icon says it as well as the colour does, so
// the grid reads in greyscale and for anyone who cannot tell green from amber.
const STATES = {
    approved:  { icon: 'check_circle', cls: 'is-approved' },
    submitted: { icon: 'pending',      cls: 'is-submitted' },
    partial:   { icon: 'warning',      cls: 'is-partial' },
    missing:   { icon: 'error',        cls: 'is-missing' },
    empty:     { icon: 'remove',       cls: 'is-empty' },
}
const ORDER = ['approved', 'submitted', 'partial', 'missing']

/**
 * The term as one grid: a row per class, a column per subject, each cell saying
 * whether that teacher's marks are in. Report cards wait for every cell, and
 * until now the only way to find the late one was to open each class in turn.
 */
export function MarksProgressTab() {
    const { t } = useTranslation()
    const toast = useToast()
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [reminding, setReminding] = useState(false)

    const load = useCallback(() => {
        setLoading(true)
        getMarksProgress()
            .then(setData)
            .catch(err => toast.error(errorMessage(err, t('dos.results.progress.loadFailed'))))
            .finally(() => setLoading(false))
    }, [toast, t])

    useEffect(() => { load() }, [load])

    async function remind() {
        if (!(await confirmDialog(t('dos.results.progress.confirmRemind')))) return
        setReminding(true)
        try {
            const res = await remindTeachers()
            if (res.notified === 0 && res.skipped_recent === 0) {
                toast.success(t('dos.results.progress.nothingOpen'))
            } else {
                const sent = res.notified === 1
                    ? t('dos.results.progress.remindedOne', { count: 1 })
                    : t('dos.results.progress.remindedMany', { count: res.notified })
                const skipped = res.skipped_recent
                    ? ` ${t('dos.results.progress.skippedRecent', { count: res.skipped_recent })}` : ''
                toast.success(res.notified ? sent + skipped : skipped.trim())
            }
        } catch (err) {
            toast.error(errorMessage(err, t('dos.results.progress.remindFailed')))
        } finally {
            setReminding(false)
        }
    }

    if (loading && !data) {
        return <SkeletonTable rows={6} cols={6} label={t('dos.results.progress.loading')} />
    }
    if (!data || data.cells.length === 0) {
        return <EmptyState icon="fact_check" title={t('dos.results.progress.empty')} />
    }

    const byKey = new Map(data.cells.map(c => [`${c.class_id}|${c.subject_id}`, c]))
    const open = data.summary.partial + data.summary.missing

    return (
        <div className="dt-container">
            <div className="dt-header">
                <span className="dt-title">{t('dos.results.progress.title')}</span>
                <div className="dt-header-right">
                    <button type="button" className="btn btn-primary btn-sm"
                        onClick={remind} disabled={reminding || open === 0}>
                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">notifications</span>
                        {reminding ? t('dos.results.progress.reminding') : t('dos.results.progress.remind')}
                    </button>
                </div>
            </div>

            <ul className="mp-legend" aria-label={t('dos.results.progress.subtitle')}>
                {ORDER.map(state => (
                    <li key={state} className={`mp-chip ${STATES[state].cls}`}>
                        <span className="material-symbols-rounded" aria-hidden="true">{STATES[state].icon}</span>
                        {t(`dos.results.progress.states.${state}`)}
                        <strong>{data.summary[state]}</strong>
                    </li>
                ))}
            </ul>

            <div className="dt-body mp-scroll" aria-busy={loading || undefined}>
                <table className="dt-table mp-table">
                    <thead>
                        <tr>
                            <th scope="col">{t('dos.results.progress.classCol')}</th>
                            {data.subjects.map(s => <th key={s.id} scope="col" className="mp-subject">{s.name}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {data.classes.map(c => (
                            <tr key={c.id}>
                                <th scope="row" className="mp-class">{c.name}</th>
                                {data.subjects.map(s => {
                                    const cell = byKey.get(`${c.id}|${s.id}`)
                                    if (!cell) {
                                        return <td key={s.id} className="mp-cell is-none" title={t('dos.results.progress.noCell')}>–</td>
                                    }
                                    const st = STATES[cell.state]
                                    const label = t(`dos.results.progress.states.${cell.state}`)
                                    return (
                                        <td key={s.id} className={`mp-cell ${st.cls}`}
                                            title={t('dos.results.progress.cellTitle', {
                                                teacher: cell.teacher_name, entered: cell.entered, total: cell.total,
                                            })}>
                                            <span className="material-symbols-rounded" aria-hidden="true">{st.icon}</span>
                                            <span className="mp-count" aria-hidden="true">{cell.entered}/{cell.total}</span>
                                            <span className="sr-only">{label}: {cell.teacher_name}, {cell.entered}/{cell.total}</span>
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
