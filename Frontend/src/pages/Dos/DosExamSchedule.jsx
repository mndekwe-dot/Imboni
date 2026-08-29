import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { PageLoading } from '../../components/layout/PageLoading'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import {
    getDosExamSchedule, deleteDosExamSchedule, updateDosExamSchedule,
    getTerms, generateDosExamSchedule, commitDosExamSchedule,
} from '../../api/dos'
import { ExamCalendar } from './ExamCalendar'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems } from './dosNav'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { useSchoolSettings } from '../../hooks/useSchoolSetting'
import { useSessionUser } from '../../hooks/useSessionUser'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { formatSchoolDate } from '../../utils/date'
import { Modal } from '../../components/ui/Modal'
import { useToast } from '../../context/ToastContext'



function ExamRow({ num, subject, code, classes, date, time, duration, rooms, invigilator, statusClass, statusKey, id, onDelete }) {
    const { t } = useTranslation()
    return (
        <tr>
            <td>{num}</td>
            <td>
                <div className="es-subject-name">{subject}</div>
                <div className="es-subject-code">{code}</div>
            </td>
            <td>{classes}</td>
            <td className="es-nowrap">{date}</td>
            <td>
                <span className="es-time-chip">
                    <span className="material-symbols-rounded" aria-hidden="true">schedule</span>{time}
                </span>
            </td>
            <td>{duration}</td>
            <td>{rooms.map((r, i) => <span key={i} className="es-room-chip">{r}</span>)}</td>
            <td>{invigilator}</td>
            <td><span className={`badge ${statusClass}`}>{t(statusKey)}</span></td>
            <td>
                <div className="es-row-actions">
                    <button className="es-icon-btn" aria-label={t('common.edit')}><span className="material-symbols-rounded" aria-hidden="true">edit</span></button>
                    <button className="es-icon-btn" aria-label={t('common.view')}><span className="material-symbols-rounded" aria-hidden="true">visibility</span></button>
                    <button className="es-icon-btn danger" onClick={() => id && onDelete(id)} aria-label={t('common.delete')}><span className="material-symbols-rounded" aria-hidden="true">delete</span></button>
                </div>
            </td>
        </tr>
    )
}

const EXAM_TYPES = [
    { value: 'midterm', labelKey: 'dos.scheduling.typeMidterm' },
    { value: 'final',   labelKey: 'dos.scheduling.typeFinal'   },
    { value: 'mock',    labelKey: 'dos.scheduling.typeMock'    },
    { value: 'quiz',    labelKey: 'dos.scheduling.typeQuiz'    },
    { value: 'other',   labelKey: 'dos.scheduling.typeOther'   },
]

// Auto-scheduler modal: collect a window, preview the DSatur-generated plan,
// then commit it. Nothing is written until the DOS confirms the preview.
function ExamGenerateModal({ onClose, onCommitted }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [terms,     setTerms]     = useState([])
    const [form,      setForm]      = useState({
        term_id:       '',
        exam_type:     'midterm',
        start_date:    '',
        num_days:      5,
        skip_weekends: true,
    })
    const [preview,   setPreview]   = useState(null)
    const [busy,      setBusy]      = useState(false)

    useEffect(() => {
        getTerms()
            .then(data => {
                const list = Array.isArray(data) ? data : (data?.results || [])
                setTerms(list)
                const current = list.find(term => term.is_current) || list[0]
                if (current) setForm(f => ({ ...f, term_id: String(current.id) }))
            })
            .catch(() => toast.error(t('dos.examSchedule.loadTermsFailed')))
    }, [toast])

    const canRun = form.term_id && form.start_date && !busy

    function update(field, value) {
        setForm(f => ({ ...f, [field]: value }))
        setPreview(null)   // any change invalidates the current preview
    }

    async function handlePreview() {
        setBusy(true)
        try {
            const plan = await generateDosExamSchedule(form)
            setPreview(plan)
            plan.warnings?.forEach(w => toast.info(w))
        } catch (err) {
            toast.error(err.response?.data?.detail || t('dos.examSchedule.generateFailed'))
        } finally {
            setBusy(false)
        }
    }

    async function handleCommit() {
        setBusy(true)
        try {
            const result = await commitDosExamSchedule(form)
            toast.success(`Saved ${result.created} exam(s).`)
            onCommitted()
        } catch (err) {
            toast.error(err.response?.data?.detail || t('dos.examSchedule.saveFailed'))
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal
            title={t('dos.examSchedule.generateTitle')}
            icon="auto_awesome"
            onClose={onClose}
            size="wide"
            footer={
                <div className="modal-confirm-actions u-full">
                    <button className="btn btn-outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
                    {preview
                        ? <button className="btn btn-primary" onClick={handleCommit}
                                  disabled={busy || preview.summary.scheduled === 0}>
                              {t('dos.examSchedule.saveExams', { count: preview.summary.scheduled })}
                          </button>
                        : <button className="btn btn-primary" onClick={handlePreview} disabled={!canRun}>
                              {busy ? t('common.generating') : t('dos.examSchedule.preview')}
                          </button>}
                </div>
            }
        >
            <div className="u-grid u-grid-2 u-gap-1">
                <div className="form-group">
                    <label className="form-label">{t('dos.examSchedule.academicTermRequired')}</label>
                    <select className="form-select" value={form.term_id}
                            onChange={e => update('term_id', e.target.value)}>
                        <option value="">{t('dos.examSchedule.selectTerm')}</option>
                        {terms.map(term => (
                            <option key={term.id} value={term.id}>{term.name} ({term.year})</option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">{t('dos.examSchedule.examType')}</label>
                    <select className="form-select" value={form.exam_type}
                            onChange={e => update('exam_type', e.target.value)}>
                        {EXAM_TYPES.map(et => <option key={et.value} value={et.value}>{t(et.labelKey)}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">{t('dos.examSchedule.startDateRequired')}</label>
                    <input type="date" className="form-input" value={form.start_date}
                           onChange={e => update('start_date', e.target.value)} />
                </div>
                <div className="form-group">
                    <label className="form-label">{t('dos.examSchedule.examDays')}</label>
                    <input type="number" min="1" max="60" className="form-input" value={form.num_days}
                           onChange={e => update('num_days', Number(e.target.value))} />
                </div>
                <div className="form-group u-col-span-all">
                    <label className="u-flex u-gap-05 u-items-center">
                        <input type="checkbox" checked={form.skip_weekends}
                               onChange={e => update('skip_weekends', e.target.checked)} />
                        {t('dos.examSchedule.skipWeekends')}
                    </label>
                </div>
            </div>

            {preview && (
                <div className="mt-1-5">
                    <div className="es-gen-summary">
                        <span className="badge badge-published">{t('dos.examSchedule.scheduled', { count: preview.summary.scheduled })}</span>
                        {preview.summary.unscheduled > 0 &&
                            <span className="badge badge-draft">{t('dos.examSchedule.unplaced', { count: preview.summary.unscheduled })}</span>}
                        <span className="u-muted u-sm">
                            {t('dos.examSchedule.slotsVenues', { slots: preview.summary.slots_available, venues: preview.summary.venues })}
                        </span>
                    </div>
                    <div className="data-table-wrap mt-1">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>{t('common.subject')}</th>
                                    <th>{t('dos.examSchedule.weightShort')}</th>
                                    <th>{t('common.class')}</th>
                                    <th>{t('common.date')}</th>
                                    <th>{t('common.time')}</th>
                                    <th>{t('common.venue')}</th>
                                    <th>{t('common.invigilator')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {preview.assignments.map((a, i) => (
                                    <tr key={i}>
                                        <td>{a.subject_name}</td>
                                        <td className="u-muted">{a.weight ?? '-'}</td>
                                        <td>{a.class_name}</td>
                                        <td className="es-nowrap">{a.exam_date}</td>
                                        <td className="es-nowrap">{a.start_time}-{a.end_time}</td>
                                        <td>{a.venue || '-'}</td>
                                        <td>{a.invigilator_name || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </Modal>
    )
}

export function DosExamSchedule() {
    const { t } = useTranslation()
    const { setting } = useSchoolSettings()
    const sessionUser = useSessionUser()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [exams,   setExams]   = useState([])
    const [currentTerm, setCurrentTerm] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error,   setError]   = useState(null)
    const [showGenerate, setShowGenerate] = useState(false)
    const [rawExams, setRawExams] = useState([])   // API shape, for the calendar
    const [view, setView] = useState('table')      // 'table' | 'calendar'
    const toast = useToast()

    function loadExams() {
        return getDosExamSchedule()
            .then(data => {
                setRawExams(Array.isArray(data) ? data : [])
                setExams((Array.isArray(data) ? data : []).map((e, i) => ({
                        num:         i + 1,
                        subject:     e.subject,
                        code:        e.exam_type,
                        classes:     e.class_name || '-',
                        date:        e.exam_date,
                        time:        `${e.start_time} - ${e.end_time}`,
                        duration:    '-',
                        rooms:       e.venue ? [e.venue] : ['-'],
                        invigilator: e.invigilator || '-',
                        statusClass: 'badge-upcoming',
                        statusKey:   'common.upcoming',
                        id:          e.id,
                })))
            })
    }

    useEffect(() => {
        loadExams()
            .catch(err => setError(err.message))
            .finally(() => setLoading(false))
        // The card heading names the term the schedule belongs to, rather
        // than a term and year hardcoded into the markup.
        getTerms()
            .then(data => {
                const list = Array.isArray(data) ? data : (data?.results || [])
                setCurrentTerm(list.find(term => term.is_current) || null)
            })
            .catch(() => setCurrentTerm(null))
    }, [])

    async function handleDelete(id) {
        try {
            await deleteDosExamSchedule(id)
            setExams(prev => prev.filter(e => e.id !== id))
            setRawExams(prev => prev.filter(e => e.id !== id))
        } catch (err) { console.error(err) }
    }

    // Drag-and-drop reschedule: move optimistically, roll back if the PATCH fails.
    async function handleReschedule(id, patch) {
        const before = rawExams
        setRawExams(prev => prev.map(e => (e.id === id ? { ...e, ...patch } : e)))
        try {
            await updateDosExamSchedule(id, patch)
            await loadExams()
            toast.success(t('dos.examSchedule.rescheduled'))
        } catch (err) {
            setRawExams(before)
            toast.error(err.response?.data?.detail || t('dos.examSchedule.rescheduleFailed'))
        }
    }

    if (loading) return (
        <PageLoading
            navItems={dosNavItems} secondaryItems={dosSecondaryItems}
            title={t('dos.examSchedule.title')}
            subtitle={t('dos.examSchedule.subtitle')}
            user={sessionUser}
        />
    )
    if (error)   return <p className="u-pad u-danger">{t('common.errorPrefix')}: {error}</p>

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={dosNavItems} secondaryItems={dosSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('dos.examSchedule.title')}
                        subtitle={t('dos.examSchedule.subtitle')}
                        {...sessionUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                        actions={
                            <button className="btn btn-secondary" onClick={() => setShowGenerate(true)}>
                                <span className="material-symbols-rounded" aria-hidden="true">auto_awesome</span> {t('dos.examSchedule.generate')}
                            </button>
                        }
                    />

                    <DashboardContent>
                        <div className="card mt-1-5">
                            <div className="card-header">
                                <h2 className="card-title">
                                    {currentTerm
                                        ? t('dos.examSchedule.cardTitle', { term: `${currentTerm.name} · ${currentTerm.year}` })
                                        : t('dos.examSchedule.cardTitleNoTerm')}
                                </h2>
                                <div className="es-card-actions">
                                    <button
                                        className={`btn btn-sm ${view === 'table' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setView('table')}
                                    >
                                        <span className="material-symbols-rounded" aria-hidden="true">table_rows</span> {t('dos.examSchedule.tableView')}
                                    </button>
                                    <button
                                        className={`btn btn-sm ${view === 'calendar' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setView('calendar')}
                                    >
                                        <span className="material-symbols-rounded" aria-hidden="true">calendar_month</span> {t('dos.examSchedule.calendarView')}
                                    </button>
                                </div>
                            </div>
                            <div className="card-content">
                                {view === 'calendar' ? (
                                    <ExamCalendar exams={rawExams} onReschedule={handleReschedule} />
                                ) : (
                                    <div className="data-table-wrap">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    <th>{t('common.subject')}</th>
                                                    <th>{t('dos.examSchedule.classes')}</th>
                                                    <th>{t('common.date')}</th>
                                                    <th>{t('common.time')}</th>
                                                    <th>{t('common.duration')}</th>
                                                    <th>{t('dos.examSchedule.rooms')}</th>
                                                    <th>{t('common.invigilator')}</th>
                                                    <th>{t('common.status')}</th>
                                                    <th>{t('common.actions')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {exams.length === 0 ? (
                                                    <tr><td colSpan={10} className="empty-note">{t('dos.examSchedule.empty')}</td></tr>
                                                ) : exams.map((row, index) => (
                                                    <ExamRow key={index} {...row} onDelete={handleDelete} />
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </DashboardContent>
                </main>
            </div>

            {showGenerate && (
                <ExamGenerateModal
                    onClose={() => setShowGenerate(false)}
                    onCommitted={() => {
                        setShowGenerate(false)
                        setLoading(true)
                        loadExams().catch(err => setError(err.message)).finally(() => setLoading(false))
                    }}
                />
            )}
        </>
    )
}
