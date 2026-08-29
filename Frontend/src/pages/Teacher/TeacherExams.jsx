import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { EmptyState } from '../../components/ui/EmptyState'
import { useNotifications } from '../../hooks/useNotifications'
import { STATUS_BADGE, STATUS_KEY } from '../../components/exams/examModel'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import {
    getTeacherExamPapers, submitTeacherExamPaper, deleteTeacherExamPaper,
} from '../../api/teacher'
import { teacherNavItems, teacherSecondaryItems } from './teacherNav'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'

/**
 * The teacher's own exam papers, and where each one has got to.
 *
 * Status is the whole point of the screen: a paper is either still theirs, sat
 * with the DOS, approved, or back with a reason to fix. The reason is shown
 * inline rather than behind a click — it is the one thing the teacher needs in
 * order to act.
 */
export function TeacherExams() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const toast = useToast()
    const { notifications: liveNotifications, markRead } = useNotifications()

    const [papers,  setPapers]  = useState([])
    const [loading, setLoading] = useState(true)
    const [error,   setError]   = useState(null)
    const [busyId,  setBusyId]  = useState(null)

    const load = useCallback(async () => {
        try {
            const data = await getTeacherExamPapers()
            setPapers(Array.isArray(data) ? data : data?.results ?? [])
            setError(null)
        } catch (e) {
            setError(errorMessage(e, t('teacher.exams.loadFailed')))
        } finally {
            setLoading(false)
        }
    }, [t])

    useEffect(() => { load() }, [load])

    async function submit(paper) {
        setBusyId(paper.id)
        try {
            await submitTeacherExamPaper(paper.id)
            toast.success(t('teacher.exams.submitted'))
            await load()
        } catch (e) {
            toast.error(errorMessage(e, t('teacher.exams.submitFailed')))
        } finally {
            setBusyId(null)
        }
    }

    async function remove(paper) {
        if (!window.confirm(t('teacher.exams.confirmDelete', { title: paper.title }))) return
        setBusyId(paper.id)
        try {
            await deleteTeacherExamPaper(paper.id)
            toast.success(t('teacher.exams.deleted'))
            await load()
        } catch (e) {
            toast.error(errorMessage(e, t('teacher.exams.deleteFailed')))
        } finally {
            setBusyId(null)
        }
    }

    return (
        <div className="dashboard-page" data-portal="teacher">
            <div className="dashboard-layout">
                <Sidebar navItems={teacherNavItems} secondaryItems={teacherSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('teacher.exams.title')}
                        subtitle={t('teacher.exams.subtitle')}
                        userRole={t('roles.teacher')}
                        avatarClass="teacher-av"
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                        actions={
                            <button className="btn btn-primary"
                                onClick={() => navigate('/teacher/exams/new')}>
                                <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span>
                                {t('teacher.exams.newPaper')}
                            </button>
                        }
                    />
                    <DashboardContent>
                        {loading ? (
                            <p className="u-muted">{t('common.loading')}</p>
                        ) : error ? (
                            <p className="form-error">{error}</p>
                        ) : papers.length === 0 ? (
                            <EmptyState icon="description"
                                title={t('teacher.exams.emptyTitle')}
                                description={t('teacher.exams.emptyMessage')} />
                        ) : (
                            <div className="table-responsive">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>{t('teacher.exams.paperTitle')}</th>
                                            <th>{t('teacher.exams.className')}</th>
                                            <th>{t('teacher.exams.subject')}</th>
                                            <th>{t('teacher.exams.marks')}</th>
                                            <th>{t('common.status')}</th>
                                            <th>{t('common.actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {papers.map(paper => (
                                            <tr key={paper.id}>
                                                <td>
                                                    <div className="u-strong">{paper.title}</div>
                                                    {paper.status === 'rejected' && paper.rejection_reason && (
                                                        <div className="u-sm form-error">
                                                            {t('teacher.exams.sentBack')} {paper.rejection_reason}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>{paper.class_name}</td>
                                                <td>{paper.subject_name}</td>
                                                <td>
                                                    {paper.total_marks}
                                                    <span className="u-muted u-sm">
                                                        {' '}({t('teacher.exams.qCount', { count: paper.question_count })})
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`badge ${STATUS_BADGE[paper.status] ?? 'badge-soft-muted'}`}>
                                                        {t(STATUS_KEY[paper.status] ?? paper.status)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="flex-row-gap-sm">
                                                        <button className="btn btn-outline btn-sm"
                                                            onClick={() => navigate(`/teacher/exams/${paper.id}/edit`)}
                                                            title={paper.is_editable ? t('common.edit') : t('common.view')}>
                                                            <span className="material-symbols-rounded icon-sm" aria-hidden="true">
                                                                {paper.is_editable ? 'edit_note' : 'visibility'}
                                                            </span>
                                                        </button>
                                                        {paper.is_editable && (
                                                            <button className="btn btn-primary btn-sm"
                                                                disabled={busyId === paper.id || paper.question_count === 0}
                                                                onClick={() => submit(paper)}
                                                                title={t('teacher.exams.submitForApproval')}>
                                                                <span className="material-symbols-rounded icon-sm" aria-hidden="true">send</span>
                                                            </button>
                                                        )}
                                                        {paper.status !== 'approved' && (
                                                            <button className="btn btn-outline btn-sm"
                                                                disabled={busyId === paper.id}
                                                                onClick={() => remove(paper)}
                                                                title={t('common.delete')}>
                                                                <span className="material-symbols-rounded icon-sm" aria-hidden="true">delete</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </DashboardContent>
                </main>
            </div>
        </div>
    )
}
