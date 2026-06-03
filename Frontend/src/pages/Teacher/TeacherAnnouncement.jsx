import { useState, useEffect } from 'react'
import { Link } from 'react-router'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { EmptyState } from '../../components/ui/EmptyState'
import { useSchoolSettings } from '../../hooks/useSchoolSetting'
import { formatSchoolDate } from '../../utils/date'
import { getTeacherAnnouncements, createTeacherAnnouncement } from '../../api/teacher'
import { teacherNavItems, teacherSecondaryItems } from './teacherNav'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'
import '../../styles/pages.css'

const CATEGORY_OPTIONS = [
    { value: 'academic', label: 'Academic' },
    { value: 'event',    label: 'Events'   },
    { value: 'general',  label: 'General'  },
    { value: 'urgent',   label: 'Urgent'   },
]

const AUDIENCE_OPTIONS = [
    { value: 'students',  label: 'Students Only' },
    { value: 'parents',   label: 'Parents Only'  },
    { value: 'all',       label: 'All Users'     },
]

const TEMPLATES = [
    { label: 'Homework Reminder', category: 'academic', title: 'Homework Reminder',   content: 'Please complete the assigned homework before the next class.' },
    { label: 'Exam Schedule',     category: 'academic', title: 'Upcoming Exam',        content: 'A class exam is scheduled. Please revise all topics covered this term.' },
    { label: 'Class Canceled',    category: 'general',  title: 'Class Canceled Today', content: "Today's class has been canceled. Please use the time for self-study." },
    { label: 'Congratulations',   category: 'general',  title: 'Well Done!',           content: 'Congratulations to all students on your outstanding performance.' },
    { label: 'Important Notice',  category: 'urgent',   title: 'Important Notice',     content: 'Please read this notice carefully and act accordingly.' },
    { label: 'Reading Assignment', category: 'academic', title: 'Reading Assignment',  content: 'Please complete the reading assignment before our next session.' },
]

const FILTER_CHIPS = ['All', 'Academic', 'Events', 'General', 'Urgent', 'Drafts']

const CATEGORY_ICON = {
    urgent:   'priority_high',
    academic: 'school',
    event:    'emoji_events',
    general:  'campaign',
}

function chipMatch(ann, chip) {
    if (chip === 'All')      return true
    if (chip === 'Drafts')   return ann.status === 'draft'
    if (chip === 'Academic') return ann.category === 'academic' && ann.status !== 'draft'
    if (chip === 'Events')   return ann.category === 'event'    && ann.status !== 'draft'
    if (chip === 'General')  return ann.category === 'general'  && ann.status !== 'draft'
    if (chip === 'Urgent')   return ann.category === 'urgent'   && ann.status !== 'draft'
    return true
}

function AnnouncementCard({ ann }) {
    const icon    = CATEGORY_ICON[ann.category] || 'campaign'
    const cat     = ann.status === 'draft' ? 'general' : (ann.category || 'general')
    const date    = ann.published_at || ann.created_at
    const dateStr = date
        ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : ''
    return (
        <div className={`ann-item ${cat}`}>
            <div className="ann-item-top">
                <div className={`ann-item-icon ${cat}`}>
                    <span className="material-symbols-rounded">{icon}</span>
                </div>
                <div className="ann-item-head">
                    <div className="ann-item-title">{ann.title}</div>
                    <div className="ann-item-meta">
                        {ann.status === 'draft'
                            ? <span style={{ color: '#f59e0b', fontWeight: 600 }}>Draft</span>
                            : <span>{(cat).toUpperCase()}</span>
                        }
                        <span>·</span>
                        <span>{ann.author_name || 'You'}</span>
                        <span>·</span>
                        <span>{dateStr}</span>
                    </div>
                </div>
            </div>
            <div className="ann-item-body">{ann.content}</div>
        </div>
    )
}

export function TeacherAnnouncement() {
    const [announcements, setAnnouncements] = useState([])
    const [loading,       setLoading]       = useState(true)
    const [chip,          setChip]          = useState('All')
    const [form,          setForm]          = useState({ category: '', title: '', content: '', target_audience: 'students' })
    const [publishing,    setPublishing]    = useState(false)
    const [published,     setPublished]     = useState(false)
    const [error,         setError]         = useState(null)
    const { setting } = useSchoolSettings()

    const storedUser = JSON.parse(localStorage.getItem('imboni_user') || '{}')
    const firstName  = storedUser.first_name || ''
    const lastName   = storedUser.last_name  || ''
    const fullName   = storedUser.full_name  || `${firstName} ${lastName}`.trim() || 'Teacher'
    const initials   = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'T'

    function loadAnnouncements() {
        setLoading(true)
        getTeacherAnnouncements()
            .then(res => setAnnouncements(Array.isArray(res.results) ? res.results : []))
            .catch(() => setAnnouncements([]))
            .finally(() => setLoading(false))
    }

    useEffect(() => { loadAnnouncements() }, [])

    function handleChange(e) {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    function handleTemplate(t) {
        setForm(prev => ({ ...prev, category: t.category, title: t.title, content: t.content }))
    }

    async function handlePublish() {
        if (!form.title || !form.content || !form.category) return
        setPublishing(true)
        setError(null)
        try {
            await createTeacherAnnouncement({
                title:           form.title,
                content:         form.content,
                category:        form.category,
                target_audience: form.target_audience,
                status:          'published',
            })
            setForm({ category: '', title: '', content: '', target_audience: 'students' })
            setPublished(true)
            setTimeout(() => setPublished(false), 3000)
            loadAnnouncements()
        } catch {
            setError('Failed to publish. Please try again.')
        } finally {
            setPublishing(false)
        }
    }

    async function handleSaveDraft() {
        if (!form.title || !form.content || !form.category) return
        setPublishing(true)
        setError(null)
        try {
            await createTeacherAnnouncement({
                title:           form.title,
                content:         form.content,
                category:        form.category,
                target_audience: form.target_audience,
                status:          'draft',
            })
            setForm({ category: '', title: '', content: '', target_audience: 'students' })
            loadAnnouncements()
        } catch {
            setError('Failed to save draft.')
        } finally {
            setPublishing(false)
        }
    }

    const visible = announcements.filter(a => chipMatch(a, chip))
    const draftCount = announcements.filter(a => a.status === 'draft').length

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={teacherNavItems} secondaryItems={teacherSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <header className="dashboard-header">
                        <button className="mobile-menu-btn" onClick={() => document.dispatchEvent(new CustomEvent('imboni:open-sidebar'))}>
                            <span className="material-symbols-rounded">menu</span>
                        </button>
                        <div className="dashboard-header-title">
                            <h1>Announcements</h1>
                            <p>Create and manage class announcements</p>
                        </div>
                        <div className="dashboard-header-actions">
                            <span className="date-display">{formatSchoolDate(setting.timezone)}</span>
                            <div className="header-user">
                                <div className="header-user-info">
                                    <span className="header-user-name">{fullName}</span>
                                    <span className="header-user-role">Teacher</span>
                                </div>
                                <Link to="/profile?role=teacher" className="header-user-av teacher-av">{initials}</Link>
                            </div>
                        </div>
                    </header>

                    <DashboardContent>

                        {/* Create form */}
                        <div className="card mb-1-5">
                            <div className="card-header">
                                <h3 className="card-title">Create New Announcement</h3>
                                <span className="settings-info-text">
                                    Audience: <strong>
                                        {AUDIENCE_OPTIONS.find(o => o.value === form.target_audience)?.label || 'Students Only'}
                                    </strong>
                                </span>
                            </div>
                            <div className="card-content">
                                <div className="flex-column-gap">
                                    <div className="resp-grid-2" style={{ gap: '0.75rem' }}>
                                        <div className="form-group">
                                            <label className="label">Category *</label>
                                            <select className="input" name="category" value={form.category} onChange={handleChange}>
                                                <option value="">Select category…</option>
                                                {CATEGORY_OPTIONS.map(o => (
                                                    <option key={o.value} value={o.value}>{o.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="label">Visible To</label>
                                            <select className="input" name="target_audience" value={form.target_audience} onChange={handleChange}>
                                                {AUDIENCE_OPTIONS.map(o => (
                                                    <option key={o.value} value={o.value}>{o.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label className="label">Title *</label>
                                        <input
                                            type="text" className="input" name="title"
                                            value={form.title} onChange={handleChange}
                                            placeholder="Announcement title…"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="label">Message *</label>
                                        <textarea
                                            className="input" rows="4" name="content"
                                            value={form.content} onChange={handleChange}
                                            placeholder="Write your announcement…"
                                        />
                                    </div>

                                    {error && <p style={{ color: 'var(--destructive)', fontSize: '0.85rem' }}>{error}</p>}

                                    <div className="action-toolbar">
                                        <button
                                            className="btn btn-outline btn-sm"
                                            onClick={handleSaveDraft}
                                            disabled={publishing || !form.title || !form.content || !form.category}
                                        >
                                            <span className="material-symbols-rounded icon-sm">save</span>
                                            Save Draft
                                        </button>
                                        <button
                                            className="btn btn-primary self-start"
                                            onClick={handlePublish}
                                            disabled={publishing || !form.title || !form.content || !form.category}
                                            style={published ? { background: 'var(--success)' } : {}}
                                        >
                                            <span className="material-symbols-rounded icon-sm">{published ? 'check' : 'send'}</span>
                                            {publishing ? 'Publishing…' : published ? 'Published!' : 'Publish to Students'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quick Templates */}
                        <div className="card mb-1-5">
                            <div className="card-header">
                                <h3 className="card-title">Quick Templates</h3>
                                <p className="card-description">Click to pre-fill the form</p>
                            </div>
                            <div className="card-content">
                                <div className="filter-group">
                                    {TEMPLATES.map(t => (
                                        <button key={t.label} className="btn btn-outline btn-sm" onClick={() => handleTemplate(t)}>
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Chips filter */}
                        <div className="ann-chip-bar mb-1">
                            {FILTER_CHIPS.map(c => (
                                <button
                                    key={c}
                                    className={`ann-chip${chip === c ? ' active' : ''}`}
                                    onClick={() => setChip(c)}
                                >
                                    {c}
                                    {c === 'Drafts' && draftCount > 0 && (
                                        <span style={{ marginLeft: '0.25rem', background: 'rgba(0,0,0,0.15)', borderRadius: '9px', padding: '0 5px', fontSize: '0.7rem' }}>{draftCount}</span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Announcement list */}
                        {loading ? (
                            <p style={{ color: 'var(--muted-foreground)', padding: '1rem 0' }}>Loading announcements…</p>
                        ) : visible.length === 0 ? (
                            <EmptyState
                                icon="campaign"
                                title="No announcements"
                                description={chip === 'All' ? "You haven't published any announcements yet." : `No ${chip.toLowerCase()} announcements found.`}
                            />
                        ) : (
                            <div className="ann-list">
                                {visible.map(ann => (
                                    <AnnouncementCard key={ann.id} ann={ann} />
                                ))}
                            </div>
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
