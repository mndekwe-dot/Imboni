import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { Modal } from '../ui/Modal'
import { getMatronStudent } from '../../api/matron'
import { classLabel } from '../../utils/classes'
import '../../styles/components.css'
import '../../styles/matron.css'

/**
 * One boarder, opened from the roll.
 *
 * The roll answered "who is in this house"; it could not answer "who is this".
 * A matron who found a student by name then had to leave the page, open Report
 * Incident, and type the name again into the picker — so the roll was a dead
 * end at exactly the moment she had found the person she was looking for.
 *
 * The summary comes from the row that was already on screen, so the dialog has
 * content the instant it opens; the detail request adds conduct standing and
 * the recent behaviour record underneath when it lands. A failed request
 * leaves the summary standing rather than emptying the dialog.
 *
 * "Report an incident" carries the student through in the URL, so the incident
 * form opens with them already selected — and survives a reload, which passing
 * the object through router state would not.
 */

const REPORT_TONE = {
    incident:    'warning',
    warning:     'warning',
    positive:    'positive',
    achievement: 'positive',
}

const CONDUCT_TONE = {
    a: 'excellent', excellent: 'excellent',
    b: 'good',      good:      'good',
    c: 'fair',      fair:      'fair',
    d: 'poor',      poor:      'poor',
}

function Field({ label, value }) {
    return (
        <div className="stu-modal-field">
            <span className="stu-modal-field-label">{label}</span>
            <span className="stu-modal-field-value">{value || '-'}</span>
        </div>
    )
}

export function MatronStudentModal({ student, onClose }) {
    const { t } = useTranslation()
    const [detail, setDetail] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!student?.id) { setLoading(false); return }
        let cancelled = false
        setLoading(true)
        getMatronStudent(student.id)
            .then(data => { if (!cancelled) setDetail(data) })
            // The summary above is already rendered from the row; losing the
            // record below is not worth blanking the dialog for.
            .catch(() => {})
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [student?.id])

    if (!student) return null

    const conduct = detail?.conduct_grade
    const conductTone = CONDUCT_TONE[String(conduct || '').toLowerCase()] || ''
    const incidents = detail?.recent_incidents ?? []

    return (
        <Modal
            title={student.name}
            icon="person"
            size="wide"
            onClose={onClose}
            footer={
                <>
                    <button className="btn btn-outline" onClick={onClose}>{t('common.close')}</button>
                    <Link
                        to={`/matron/incidents?student=${encodeURIComponent(student.id)}`}
                        className="btn btn-primary"
                    >
                        <span className="material-symbols-rounded icon-sm">report</span>
                        {t('matron.students.reportIncidentFor')}
                    </Link>
                </>
            }
        >
            <div className="stu-modal-head">
                <div className="stu-av stu-modal-av">{student.initials}</div>
                <div>
                    <div className="stu-modal-name">{student.name}</div>
                    <div className="stu-modal-sub">
                        {student.studentCode}
                        {student.classBadge && <> &middot; {student.classBadge}</>}
                    </div>
                </div>
                {conduct && (
                    <span className={`conduct-badge ${conductTone}`}>{conduct}</span>
                )}
            </div>

            <div className="stu-modal-grid">
                <Field label={t('common.class')}        value={student.classBadge || classLabel(student.year, student.classLetter)} />
                <Field label={t('common.dormitory')}    value={student.dormitory} />
                <Field label={t('common.room')}         value={student.room} />
                <Field label={t('matron.students.bed')} value={detail?.bed_number} />
                <Field label={t('common.boardingType')} value={student.boardingType} />
                <Field label={t('common.admissionNo')}  value={student.studentCode} />
            </div>

            <h3 className="stu-modal-section">{t('matron.students.recentRecord')}</h3>
            {loading ? (
                <p className="empty-note">{t('common.loading')}</p>
            ) : incidents.length === 0 ? (
                <p className="empty-note">{t('matron.students.noRecord')}</p>
            ) : (
                <ul className="stu-modal-record">
                    {incidents.map(r => (
                        <li key={r.id} className="stu-modal-record-row">
                            <span className={`incident-type-tag ${REPORT_TONE[r.report_type] || 'warning'}`}>
                                {r.severity || r.report_type}
                            </span>
                            <div className="stu-modal-record-body">
                                <div className="stu-modal-record-title">{r.title}</div>
                                <div className="stu-modal-record-meta">
                                    {r.date}
                                    {r.reported_by && <> &middot; {r.reported_by}</>}
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </Modal>
    )
}
