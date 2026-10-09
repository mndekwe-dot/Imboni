import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../ui/Modal'
import { getStudent360 } from '../../api/student360'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { formatDateTime } from '../../utils/date'
import '../../styles/components.css'
import { SkeletonList } from '../ui/Skeleton'

function Panel({ icon, title, children }) {
    return (
        <section className="card">
            <div className="card-header">
                <h3 className="card-title">
                    <span className="material-symbols-rounded" aria-hidden="true">{icon}</span> {title}
                </h3>
            </div>
            <div className="card-content">{children}</div>
        </section>
    )
}

function Figure({ value, label }) {
    return (
        <div>
            <div className="u-strong">{value ?? '-'}</div>
            <div className="u-muted u-sm">{label}</div>
        </div>
    )
}

/**
 * One student across the academic and discipline offices: marks, attendance and
 * demerits for the current term, side by side. Opened from the DOS and the
 * Director of Discipline's student lists, so neither has to ask the other.
 */
export function Student360Modal({ studentId, onClose }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [data, setData] = useState(null)
    // Callers pass a fresh onClose every render; the load must not restart for that.
    const closeRef = useRef(onClose)
    closeRef.current = onClose

    useEffect(() => {
        let live = true
        getStudent360(studentId)
            .then(d => { if (live) setData(d) })
            .catch(e => {
                if (!live) return
                toast.error(errorMessage(e, t('common.student360.loadFailed')))
                closeRef.current()
            })
        return () => { live = false }
    }, [studentId, toast, t])

    const acad = data?.academics
    const att = data?.attendance
    const disc = data?.discipline

    return (
        <Modal title={data ? data.name : t('common.student360.title')} icon="person" onClose={onClose} size="wide">
            {!data ? (
                <SkeletonList items={3} />
            ) : (
                <div className="u-stack-1">
                    <p className="u-muted u-sm">
                        {data.class_name} · {data.student_id}{data.term ? ` · ${data.term}` : ''}
                    </p>

                    {data.exeat && (
                        <div className="badge badge-soft-warning" role="status">
                            {data.exeat.status === 'out'
                                ? t('common.student360.exeatOut', { when: formatDateTime(data.exeat.expected_return_at) })
                                : t('common.student360.exeatApproved')}
                        </div>
                    )}

                    <Panel icon="school" title={t('common.student360.academics')}>
                        <div className="u-row">
                            <Figure value={acad.average != null ? `${acad.average}%` : null} label={t('common.student360.average')} />
                            <Figure value={acad.subjects_failing} label={t('common.student360.failing')} />
                        </div>
                        {acad.subjects.length === 0 ? (
                            <p className="u-muted u-sm">{t('common.student360.noResults')}</p>
                        ) : (
                            <ul className="u-row u-wrap">
                                {acad.subjects.map(s => (
                                    <li key={s.subject} className={`badge ${s.score < 50 ? 'badge-soft-destructive' : 'badge-soft-success'}`}>
                                        {s.subject} {s.score}%
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>

                    <Panel icon="fact_check" title={t('common.student360.attendance')}>
                        <div className="u-row">
                            <Figure value={att.rate != null ? `${att.rate}%` : null} label={t('common.student360.attendanceRate')} />
                            <Figure value={att.days_absent} label={t('common.student360.daysAbsent')} />
                        </div>
                        {att.days_recorded === 0 && <p className="u-muted u-sm">{t('common.student360.noAttendance')}</p>}
                    </Panel>

                    <Panel icon="gavel" title={t('common.student360.discipline')}>
                        <div className="u-row">
                            <Figure value={disc.marks_deducted} label={t('common.student360.marksLost')} />
                            <Figure value={disc.conduct_grade} label={t('common.student360.conduct')} />
                            {disc.ladder_step && (
                                <span className="badge badge-soft-destructive">{t(`dis.students.ladderSteps.${disc.ladder_step}`)}</span>
                            )}
                        </div>
                        {disc.recent.length === 0 ? (
                            <p className="u-muted u-sm">{t('common.student360.noReports')}</p>
                        ) : (
                            <ul>
                                {disc.recent.map((r, i) => <li key={i}>{r.date} · {r.title}</li>)}
                            </ul>
                        )}
                    </Panel>
                </div>
            )}
        </Modal>
    )
}
