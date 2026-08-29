import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { StatCard } from '../../components/layout/StatCard'
import { EmptyState } from '../../components/ui/EmptyState'
import { TabGroup } from '../../components/ui/TabGroup'
import { useNotifications } from '../../hooks/useNotifications'
import { STATUS_BADGE, STATUS_KEY, TYPE_KEY, TAB_KEY } from '../../components/exams/examModel'
import { ExamPaperReviewModal } from '../../components/exams/ExamPaperReviewModal'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { getDosExamPapers, downloadExamPaperPdf } from '../../api/dos'
import { dosNavItems, dosSecondaryItems } from './dosNav'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'

const TABS = ['submitted', 'approved', 'rejected', 'draft', 'all']

/**
 * Every exam paper in the school, and the DOS's decision on each.
 *
 * Opens on the papers waiting for approval, because that is the only tab with
 * work in it — the rest are a record. Printing is here rather than on the
 * teacher's screen on purpose: the paper leaves the author's hands at
 * submission, and who may duplicate it is the point of the vetting step.
 */
export function DosExamPapers() {
    const { t } = useTranslation()
    const toast = useToast()
    const { notifications: liveNotifications, markRead } = useNotifications()

    const [papers,  setPapers]  = useState([])
    const [counts,  setCounts]  = useState({})
    const [tab,     setTab]     = useState('submitted')
    const [loading, setLoading] = useState(true)
    const [error,   setError]   = useState(null)
    const [reviewing, setReviewing] = useState(null)
    const [printing,  setPrinting]  = useState(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const data = await getDosExamPapers(tab === 'all' ? {} : { status: tab })
            setPapers(data?.results ?? [])
            setCounts(data?.counts ?? {})
            setError(null)
        } catch (e) {
            setError(errorMessage(e, t('dos.examPapers.loadFailed')))
        } finally {
            setLoading(false)
        }
    }, [tab, t])

    useEffect(() => { load() }, [load])

    /**
     * The print endpoint needs the Authorization header, so the PDF arrives as
     * a blob and is handed to the browser through an object URL. A plain link
     * to the same path would come back 403.
     */
    async function print(paper, scheme) {
        setPrinting(paper.id)
        try {
            const blob = await downloadExamPaperPdf(paper.id, scheme)
            const url = URL.createObjectURL(blob)
            window.open(url, '_blank', 'noopener')
            // Revoked on a timer rather than immediately: revoking before the
            // new tab has read the URL leaves it showing a blank viewer.
            setTimeout(() => URL.revokeObjectURL(url), 60_000)
        } catch (e) {
            toast.error(errorMessage(e, t('dos.examPapers.printFailed')))
        } finally {
            setPrinting(null)
        }
    }

    return (
        <div className="dashboard-page" data-portal="dos">
            <div className="dashboard-layout">
                <Sidebar navItems={dosNavItems} secondaryItems={dosSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('dos.examPapers.title')}
                        subtitle={t('dos.examPapers.subtitle')}
                        userRole={t('roles.dos')}
                        avatarClass="dos-av"
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        <div className="portal-stat-grid mb-1-5">
                            <StatCard icon="pending_actions" label={t('dos.examPapers.waiting')}
                                value={counts.submitted ?? 0} colorClass="warning" />
                            <StatCard icon="task_alt" label={t('dos.examPapers.approved')}
                                value={counts.approved ?? 0} colorClass="success" />
                            <StatCard icon="undo" label={t('dos.examPapers.sentBack')}
                                value={counts.rejected ?? 0} />
                            <StatCard icon="edit_note" label={t('dos.examPapers.drafts')}
                                value={counts.draft ?? 0} />
                        </div>

                        <TabGroup
                            tabs={TABS.map(v => ({ key: v, label: t(TAB_KEY[v]) }))}
                            value={tab}
                            onChange={setTab}
                        />

                        {loading ? (
                            <p className="u-muted">{t('common.loading')}</p>
                        ) : error ? (
                            <p className="form-error">{error}</p>
                        ) : papers.length === 0 ? (
                            <EmptyState icon="fact_check"
                                title={t('dos.examPapers.emptyTitle')}
                                description={t('dos.examPapers.emptyMessage')} />
                        ) : (
                            <div className="table-responsive">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>{t('dos.examPapers.paper')}</th>
                                            <th>{t('dos.examPapers.setBy')}</th>
                                            <th>{t('dos.examPapers.className')}</th>
                                            <th>{t('dos.examPapers.marks')}</th>
                                            <th>{t('common.status')}</th>
                                            <th>{t('common.actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {papers.map(paper => (
                                            <tr key={paper.id}>
                                                <td>
                                                    <div className="u-strong">{paper.title}</div>
                                                    <div className="u-muted u-sm">
                                                        {paper.subject_name} · {t(TYPE_KEY[paper.exam_type] ?? paper.exam_type)}
                                                    </div>
                                                </td>
                                                <td>{paper.teacher_name}</td>
                                                <td>{paper.class_name}</td>
                                                <td>{paper.total_marks}</td>
                                                <td>
                                                    <span className={`badge ${STATUS_BADGE[paper.status] ?? 'badge-soft-muted'}`}>
                                                        {t(STATUS_KEY[paper.status] ?? paper.status)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="flex-row-gap-sm">
                                                        <button className="btn btn-outline btn-sm"
                                                            onClick={() => setReviewing(paper)}
                                                            title={t('dos.examPapers.review')}>
                                                            <span className="material-symbols-rounded icon-sm" aria-hidden="true">rate_review</span>
                                                        </button>
                                                        <button className="btn btn-outline btn-sm"
                                                            disabled={printing === paper.id}
                                                            onClick={() => print(paper, false)}
                                                            title={t('dos.examPapers.printPaper')}>
                                                            <span className="material-symbols-rounded icon-sm" aria-hidden="true">print</span>
                                                        </button>
                                                        <button className="btn btn-outline btn-sm"
                                                            disabled={printing === paper.id}
                                                            onClick={() => print(paper, true)}
                                                            title={t('dos.examPapers.printScheme')}>
                                                            <span className="material-symbols-rounded icon-sm" aria-hidden="true">key</span>
                                                        </button>
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

            {reviewing && (
                <ExamPaperReviewModal
                    paper={reviewing}
                    onClose={() => setReviewing(null)}
                    onDecided={() => { setReviewing(null); load() }}
                />
            )}
        </div>
    )
}
