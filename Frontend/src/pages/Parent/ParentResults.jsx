import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { parentNavItems, parentSecondaryItems } from './parentNav'
import { formatDate, formatDateShort } from '../../utils/date'
import {
    getMyChildren, getChildAssessments, getChildSummative, getChildReviews,
} from '../../api/parent'

const toList = d => Array.isArray(d) ? d : (d?.results ?? [])
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/parent.css'

function initials(name = '') {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

function gradeBadge(g) {
    if (g === 'A') return 'badge-success'
    if (g === 'B') return 'badge-primary'
    return 'badge-warning'
}

function gradeClass(g) {
    if (g === 'A') return 'a'
    if (g === 'B') return 'b'
    return 'c'
}

function scoreLabel(obtained, max) {
    if (obtained == null) return '-'
    return max ? `${Math.round(obtained)}/${Math.round(max)}` : `${Math.round(obtained)}`
}

const ASSESSMENT_TYPE_KEYS = {
    quiz:         'teacher.classes.typeQuiz',
    homework:     'teacher.classes.typeHomework',
    project:      'teacher.classes.typeProject',
    presentation: 'teacher.classes.typePresentation',
    lab:          'teacher.classes.typeLab',
}

function AssessmentRow({ title, assessment_type, date, score_display, grade, subject_name }) {
    const { t } = useTranslation()
    const typeKey   = ASSESSMENT_TYPE_KEYS[assessment_type]
    const typeLabel = typeKey ? t(typeKey) : (assessment_type || '')
    const dateStr   = date ? formatDate(date) : '-'
    return (
        <tr>
            <td>{subject_name}</td>
            <td>{typeLabel}</td>
            <td>{score_display}</td>
            <td><span className={`badge ${gradeBadge(grade)}`}>{grade}</span></td>
            <td>{dateStr}</td>
        </tr>
    )
}

function SummativeRow({ subject_name, class_test_marks, exam_score, final_score, grade }) {
    return (
        <tr>
            <td><strong>{subject_name}</strong></td>
            <td>{scoreLabel(class_test_marks)}</td>
            <td>{scoreLabel(exam_score)}</td>
            <td><strong>{scoreLabel(final_score)}</strong></td>
            <td><span className={`grade-badge ${gradeClass(grade)}`}>{grade}</span></td>
        </tr>
    )
}

function ReviewBubble({ teacher_name, teacher_role, teacher_comment, updated_at }) {
    const ini    = initials(teacher_name)
    const timeAgo = updated_at
        ? formatDateShort(updated_at)
        : ''
    return (
        <div className="review-bubble">
            <div className="review-header">
                <div className="avatar avatar-sm pr-avatar-primary">{ini}</div>
                <div>
                    <p className="u-sm"><strong>{teacher_name}</strong></p>
                    <p className="u-xs text-muted">{teacher_role}{timeAgo ? ` · ${timeAgo}` : ''}</p>
                </div>
            </div>
            <p className="review-text u-sm">"{teacher_comment}"</p>
        </div>
    )
}

function AssessmentItem({ title, assessment_type, score_display, grade }) {
    const { t } = useTranslation()
    const typeKey   = ASSESSMENT_TYPE_KEYS[assessment_type]
    const typeLabel = typeKey ? t(typeKey) : (assessment_type || '')
    const cls = grade === 'A' ? 'text-success' : grade === 'B' ? 'text-primary' : 'text-warning'
    return (
        <div className="assessment-item">
            <div className="assessment-icon quiz">
                <span className="material-symbols-rounded" aria-hidden="true">quiz</span>
            </div>
            <div className="assessment-info">
                <p><strong>{title}</strong></p>
                <p className="u-xs text-muted">{typeLabel}</p>
            </div>
            <div className={`assessment-score ${cls}`}>{score_display}</div>
        </div>
    )
}

export function ParentResults() {
    const { t } = useTranslation()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const sessionUser = useSessionUser()
    const [children,    setChildren]    = useState([])
    const [activeIdx,   setActiveIdx]   = useState(0)
    const [loading,     setLoading]     = useState(true)
    const [assessments, setAssessments] = useState([])
    const [summative,   setSummative]   = useState([])
    const [reviews,     setReviews]     = useState([])
    const [loadingData, setLoadingData] = useState(false)

    /* `?child=<id>` picks the child up front, so the "View results" button on a
       card in My Children lands on THAT child rather than on whoever happens to
       be first. The id, not the position: a list that comes back in a different
       order must not open a different child. */
    const [searchParams] = useSearchParams()
    const requestedChild = searchParams.get('child')

    useEffect(() => {
        getMyChildren()
            .then(d => {
                const list = toList(d)
                setChildren(list)
                if (requestedChild) {
                    const i = list.findIndex(c => String(c.id) === requestedChild)
                    if (i > -1) setActiveIdx(i)
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [requestedChild])

    useEffect(() => {
        if (!children.length) return
        const child = children[activeIdx]
        if (!child) return
        setLoadingData(true)
        setAssessments([])
        setSummative([])
        setReviews([])
        Promise.all([
            getChildAssessments(child.id).catch(() => []),
            getChildSummative(child.id).catch(() => []),
            getChildReviews(child.id).catch(() => []),
        ]).then(([a, s, r]) => {
            setAssessments(toList(a))
            setSummative(toList(s))
            setReviews(toList(r))
        }).finally(() => setLoadingData(false))
    }, [children, activeIdx])

    const child = children[activeIdx]

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={parentNavItems} secondaryItems={parentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('parent.results.title')}
                        subtitle={t('parent.results.subtitle')}
                        {...sessionUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    {!loading && children.length > 0 && (
                        <div className="child-switcher-bar">
                            <span className="child-switcher-label">{t('common.viewing')}</span>
                            {children.map((c, i) => (
                                <button key={c.id}
                                    className={`child-tab${i === activeIdx ? ' active' : ''}`}
                                    onClick={() => setActiveIdx(i)}>
                                    <div className="child-tab-avatar">{initials(c.student_name)}</div>
                                    <div className="child-tab-info">
                                        <span className="child-tab-name">{c.student_name}</span>
                                        <span className="child-tab-grade">{c.grade}{c.section}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    <DashboardContent>
                        {loading ? (
                            <p className="u-pad u-muted">{t('common.loading')}</p>
                        ) : !child ? (
                            <p className="u-pad u-muted">{t('parent.results.noChildren')}</p>
                        ) : (
                            <>
                                {/* Recent Assessments table */}
                                <div className="card">
                                    <div className="card-header">
                                        <h3 className="card-title">{t('parent.results.recentFor', { name: child.student_name })}</h3>
                                    </div>
                                    <div className="card-content">
                                        {loadingData ? (
                                            <p className="u-muted">{t('common.loading')}</p>
                                        ) : assessments.length === 0 ? (
                                            <p className="u-muted">{t('parent.results.noAssessments')}</p>
                                        ) : (
                                            <div className="table-responsive">
                                                <table>
                                                    <thead>
                                                        <tr>
                                                            <th>{t('common.subject')}</th>
                                                            <th>{t('common.type')}</th>
                                                            <th>{t('common.score')}</th>
                                                            <th>{t('common.grade')}</th>
                                                            <th>{t('common.date')}</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {assessments.map((a, i) => (
                                                            <AssessmentRow key={a.id || i} {...a} />
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Summative Performance */}
                                {summative.length > 0 && (
                                    <div className="card mt-1-5">
                                        <div className="card-header">
                                            <h3 className="card-title">{t('parent.results.summative')}</h3>
                                        </div>
                                        <div className="card-content">
                                            <div className="table-responsive">
                                                <table>
                                                    <thead>
                                                        <tr>
                                                            <th>{t('common.subject')}</th>
                                                            <th>{t('common.classTest')}</th>
                                                            <th>{t('common.exam')}</th>
                                                            <th>{t('common.final')}</th>
                                                            <th>{t('common.grade')}</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {summative.map((r, i) => (
                                                            <SummativeRow key={r.id || i} {...r} />
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Assessments & Teacher Reviews */}
                                <div className="grid-2 mt-1-5">
                                    <div className="card">
                                        <div className="card-header">
                                            <h3 className="card-title">{t('parent.results.recentAssessments')}</h3>
                                            <span className="badge badge-secondary">{t('parent.results.thisTerm')}</span>
                                        </div>
                                        <div className="card-content">
                                            {assessments.length === 0 ? (
                                                <p className="u-muted">{t('parent.results.noAssessments')}</p>
                                            ) : (
                                                <div className="assessment-list">
                                                    {assessments.slice(0, 4).map((a, i) => (
                                                        <AssessmentItem key={a.id || i} {...a} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="card">
                                        <div className="card-header">
                                            <h3 className="card-title">{t('parent.results.teacherReviews')}</h3>
                                        </div>
                                        <div className="card-content">
                                            {reviews.length === 0 ? (
                                                <p className="u-muted">{t('parent.results.noReviews')}</p>
                                            ) : (
                                                <div className="review-timeline">
                                                    {reviews.map((r, i) => (
                                                        <ReviewBubble key={r.id || i} {...r} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
