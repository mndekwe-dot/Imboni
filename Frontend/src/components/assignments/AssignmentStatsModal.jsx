import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../ui/Modal'
import { StatCard } from '../layout/StatCard'
import { getAssignmentStats } from '../../api/teacher'
import { errorMessage } from '../../utils/errors'

/**
 * How the class did on one assignment.
 *
 * A teacher could see every individual mark and no summary at all — no
 * average, no spread, and for a quiz no sense of which question the class
 * actually struggled with, even though every graded answer was already stored.
 * Teaching to the hardest question is most of the reason to set a quiz.
 */
export function AssignmentStatsModal({ assignment, onClose }) {
    const { t } = useTranslation()
    const [stats,   setStats]   = useState(null)
    const [loading, setLoading] = useState(true)
    const [error,   setError]   = useState(null)

    useEffect(() => {
        let alive = true
        getAssignmentStats(assignment.id)
            .then(d => alive && setStats(d))
            .catch(e => alive && setError(errorMessage(e, t('teacher.assignments.loadStatsFailed'))))
            .finally(() => alive && setLoading(false))
        return () => { alive = false }
    }, [assignment.id, t])

    /* Bars are drawn relative to the busiest band, not to the class size, so a
       small class still produces a readable shape. */
    const peak = Math.max(1, ...(stats?.distribution || []).map(b => b.count))

    /* Anything under half the class got right is worth a second lesson. */
    const hardest = (stats?.questions || [])
        .filter(q => q.percent_correct !== null)
        .sort((a, b) => a.percent_correct - b.percent_correct)

    return (
        <Modal
            title={t('teacher.assignments.statsTitle', { title: assignment.title })}
            icon="insights"
            onClose={onClose}
            size="wide"
            footer={
                <div className="modal-footer-row">
                    <span className="modal-footer-hint">{error || ''}</span>
                    <button className="btn btn-outline" onClick={onClose}>{t('common.close')}</button>
                </div>
            }
        >
            {loading ? (
                <p className="u-muted">{t('common.loading')}</p>
            ) : !stats ? (
                <p className="u-muted">{error}</p>
            ) : (
                <>
                    <div className="portal-stat-grid mb-1-5">
                        <StatCard icon="group" label={t('teacher.assignments.statHandedIn')}
                            value={`${stats.submitted}/${stats.total_students}`} />
                        <StatCard icon="grading" label={t('teacher.assignments.statMarked')}
                            value={stats.marked} colorClass="success" />
                        <StatCard icon="percent" label={t('teacher.assignments.statAverage')}
                            value={stats.average === null ? '—' : `${stats.average}%`} />
                        <StatCard icon="check_circle" label={t('teacher.assignments.statPassRate')}
                            value={stats.pass_rate === null ? '—' : `${stats.pass_rate}%`} />
                    </div>

                    <div className="resp-grid-2 grid-gap-sm mb-1-5">
                        <Fact label={t('teacher.assignments.statHighest')}
                              value={fmt(stats.highest, stats.max_score)} />
                        <Fact label={t('teacher.assignments.statLowest')}
                              value={fmt(stats.lowest, stats.max_score)} />
                        <Fact label={t('teacher.assignments.statMedian')}
                              value={fmt(stats.median, stats.max_score)} />
                        <Fact label={t('teacher.assignments.statNotHandedIn')}
                              value={String(stats.not_submitted)} />
                    </div>

                    <div className="section-label-sm">{t('teacher.assignments.distribution')}</div>
                    <div className="stat-bars u-mb">
                        {stats.distribution.map(band => (
                            <div key={band.label} className="stat-bar-row">
                                <span className="stat-bar-label">{band.label}%</span>
                                <div className="stat-bar-track">
                                    <div className="stat-bar-fill"
                                         style={{ width: `${(band.count / peak) * 100}%` }} />
                                </div>
                                <span className="stat-bar-value">{band.count}</span>
                            </div>
                        ))}
                    </div>

                    {hardest.length > 0 && (
                        <>
                            <div className="section-label-sm">
                                {t('teacher.assignments.byQuestion')}
                            </div>
                            <div className="table-responsive">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>{t('teacher.assignments.question')}</th>
                                            <th>{t('teacher.assignments.gotItRight')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {hardest.map(q => (
                                            <tr key={q.question_id}>
                                                <td>{q.number}</td>
                                                <td className="u-truncate" title={q.text}>{q.text}</td>
                                                <td>
                                                    <span className={`badge ${
                                                        q.percent_correct < 50 ? 'badge-soft-destructive'
                                                        : q.percent_correct < 80 ? 'badge-soft-warning'
                                                        : 'badge-soft-success'}`}>
                                                        {q.percent_correct}% ({q.correct}/{q.answered})
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </>
            )}
        </Modal>
    )
}

function Fact({ label, value }) {
    return (
        <div className="mini-stat">
            <div className="mini-stat-label">{label}</div>
            <div className="mini-stat-value">{value}</div>
        </div>
    )
}

/* A mark means nothing without what it was out of. */
function fmt(value, max) {
    return value === null || value === undefined ? '—' : `${value}/${max}`
}
