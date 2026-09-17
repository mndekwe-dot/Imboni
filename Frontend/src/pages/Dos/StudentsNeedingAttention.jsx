import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getAtRiskStudents, getChronicAbsence } from '../../api/dos'
import { toList } from '../../api/client'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import '../../styles/dos.css'

/* One row per student, low marks and chronic absence merged, with a chip per reason. */
export function buildAttentionList(atRisk, chronic, t) {
    const byCode = new Map()
    for (const s of atRisk) {
        byCode.set(s.student_code, {
            student_name: s.student_name,
            student_code: s.student_code,
            grade: s.grade,
            reasons: [{ type: 'score', label: t('dos.results.attentionScore', { avg: s.average_score, failing: s.subjects_failing }) }],
        })
    }
    for (const s of chronic) {
        const reason = { type: 'absence', label: t('dos.results.attentionAbsence', { rate: s.attendance_rate, days: s.days_absent }) }
        const existing = byCode.get(s.student_code)
        if (existing) existing.reasons.push(reason)
        else byCode.set(s.student_code, {
            student_name: s.student_name,
            student_code: s.student_code,
            grade: s.grade,
            reasons: [reason],
        })
    }
    // Students flagged for both reasons first
    return [...byCode.values()].sort((a, b) => b.reasons.length - a.reasons.length)
}

/**
 * Students with a failing average this term or chronic absence this month.
 * Part of the Results → Analytics tab; it used to be the only thing a separate
 * Analytics page added on top of the same charts.
 */
export function StudentsNeedingAttention({ termId }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [atRisk,  setAtRisk]  = useState([])
    const [chronic, setChronic] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let live = true
        const failed = e => toast.error(errorMessage(e, t('dos.results.attentionLoadFailed')))
        Promise.all([
            getAtRiskStudents(termId ? { term_id: termId } : undefined).then(toList).catch(e => { failed(e); return [] }),
            getChronicAbsence().then(toList).catch(e => { failed(e); return [] }),
        ]).then(([risk, absent]) => {
            if (!live) return
            setAtRisk(risk)
            setChronic(absent)
            setLoading(false)
        })
        return () => { live = false }
    }, [termId, toast, t])

    const attention = buildAttentionList(atRisk, chronic, t)

    return (
        <div className="card">
            <div className="card-header">
                <h3 className="card-title">
                    <span className="material-symbols-rounded dos-attention-flag-icon" aria-hidden="true">flag</span>
                    {t('dos.results.attentionTitle')}
                </h3>
                <span className="badge">{attention.length}</span>
            </div>
            <div className="card-content">
                {loading ? (
                    <p className="empty-note">{t('common.loading')}</p>
                ) : attention.length === 0 ? (
                    <p className="empty-note">{t('dos.results.attentionNone')}</p>
                ) : (
                    <div className="dos-attention-list">
                        {attention.map(s => (
                            <div key={s.student_code} className="dos-attention-row">
                                <div className="dos-attention-name-col">
                                    <div className="u-strong u-sm">{s.student_name}</div>
                                    <div className="dos-attention-code">{s.student_code} · {s.grade}</div>
                                </div>
                                <div className="dos-attention-reasons">
                                    {s.reasons.map((r, i) => (
                                        <span key={i} className={`dos-reason-chip ${r.type}`}>
                                            <span className="material-symbols-rounded dos-reason-chip-icon" aria-hidden="true">
                                                {r.type === 'score' ? 'trending_down' : 'event_busy'}
                                            </span>
                                            {r.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
