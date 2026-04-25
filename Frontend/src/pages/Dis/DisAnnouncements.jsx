import { useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useAnnouncements } from '../../context/AnnouncementsContext'
import { disNavItems, disSecondaryItems, disUser } from './disNav'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'
import { DashboardContent } from '../../components/layout/DashboardContent'

const initialBroadcasts = [
    { id: 'd1', avatar: 'EM', title: 'Zero-Tolerance Reminder — Bullying & Harassment',   sentTo: 'All Students', time: 'Apr 10, 2026', badgeClass: 'urgent',   badge: 'Urgent',   views: '312', isDraft: false, excerpt: 'A reminder that any form of bullying, harassment or intimidation will result in immediate disciplinary action including suspension.' },
    { id: 'd2', avatar: 'EM', title: 'Term 2 Conduct Rules Briefing — All Students',      sentTo: 'All Students', time: 'Apr 9, 2026',  badgeClass: 'school',   badge: 'Conduct',  views: '289', isDraft: false, excerpt: 'All students are required to attend the Term 2 conduct briefing in the main hall on Friday April 11 at 2:00 PM. Attendance is compulsory.' },
    { id: 'd3', avatar: 'EM', title: 'Lights-Out Policy Reminder — All Dormitories',      sentTo: 'Boarders',     time: 'Apr 8, 2026',  badgeClass: 'academic', badge: 'Boarding', views: '198', isDraft: false, excerpt: 'Lights-out is strictly at 10:00 PM. Any student found using electronic devices after 10:00 PM will have them confiscated for two weeks.' },
    { id: 'd4', avatar: 'EM', title: 'Inter-House Conduct Challenge — April 2026',        sentTo: 'All Students', time: 'Apr 5, 2026',  badgeClass: 'event',    badge: 'Events',   views: '274', isDraft: false, excerpt: 'The April Inter-House Conduct Challenge begins Monday April 14. Houses earn points for positive conduct. Karisimbi leads from last term.' },
    { id: 'd5', avatar: 'EM', title: 'Dining Hall Conduct — Updated Expectations',        sentTo: 'Boarders',     time: 'Apr 3, 2026',  badgeClass: 'general',  badge: 'Dining',   views: '156', isDraft: false, excerpt: 'Students are reminded to observe dining decorum at all times. Queue orderly, maintain table cleanliness, and report to your sitting on time.' },
    { id: 'd6', avatar: 'EM', title: 'Disciplinary Appeals Process — Updated Guidelines', sentTo: null,           time: 'Mar 28, 2026', badgeClass: 'general',  badge: 'General',  views: null,  isDraft: true,  excerpt: 'Students or parents wishing to appeal a disciplinary decision must submit a written appeal within 5 school days of the decision...' },
]

const CATEGORIES = [
    { value: 'urgent',  label: 'Urgent',  icon: 'priority_high' },
    { value: 'conduct', label: 'Conduct', icon: 'gavel'         },
    { value: 'boarding',label: 'Boarding',icon: 'hotel'         },
    { value: 'dining',  label: 'Dining',  icon: 'restaurant'    },
    { value: 'events',  label: 'Events',  icon: 'emoji_events'  },
    { value: 'general', label: 'General', icon: 'info'          },
]

const AUDIENCES = [
    { value: 'students',  label: 'All Students',        icon: 'group'           },
    { value: 'staff',     label: 'All Staff',             icon: 'badge'           },
    { value: 'parents',   label: 'Parents / Guardians',   icon: 'family_restroom' },
]

function BroadcastItem({ avatar, title, sentTo, time, badgeClass, badge, views, isDraft, excerpt, onDelete }) {
    return (
        <div className="ann-item">
            <div className="ann-item-header">
                <div className="ann-avatar">{avatar}</div>
                <div className="ann-item-meta">
                    <div className="ann-item-title">{title}</div>
                    <div className="ann-item-sub">
                        {isDraft ? 'Draft' : `Sent to: ${sentTo}`} &nbsp;&middot;&nbsp; {time}
                    </div>
                </div>
                <span className={`ann-badge ${badgeClass}`}>{badge}</span>
            </div>
            <p className="ann-excerpt">{excerpt}</p>
            <div className="ann-item-footer">
                {isDraft
                    ? <span className="ann-views"><span className="material-symbols-rounded">draft</span> Draft</span>
                    : <span className="ann-views"><span className="material-symbols-rounded">visibility</span> {views} views</span>
                }
                <div className="ann-item-actions">
                    <button className="ann-icon-btn"><span className="material-symbols-rounded">edit</span></button>
                    {isDraft && <button className="ann-icon-btn"><span className="material-symbols-rounded">publish</span></button>}
                    <button className="ann-icon-btn danger" onClick={onDelete}>
                        <span className="material-symbols-rounded">delete</span>
                    </button>
                </div>
            </div>
        </div>
    )
}

export function DisAnnouncements() {
    const { addAnnouncement } = useAnnouncements()
    const [broadcasts, setBroadcasts] = useState(initialBroadcasts)
    const [broadcastFilter, setBroadcastFilter] = useState('all')
    const [category, setCategory] = useState('conduct')
    const [audiences, setAudiences] = useState(['students'])
    const [form, setForm] = useState({ title: '', body: '' })
    const [published, setPublished] = useState(false)

    function handleChange(e) {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    function toggleAudience(value) {
        setAudiences(prev =>
            prev.includes(value)
                ? prev.filter(a => a !== value)
                : [...prev, value]
        )
    }

    function handlePublish() {
        if (!form.title || !form.body) return
        const sentTo = audiences.map(a => AUDIENCES.find(x => x.value === a)?.label).join(', ')
        const newItem = {
            id:        `d-${Date.now()}`,
            avatar:    'EM',
            title:     form.title,
            sentTo,
            time:      new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            badgeClass: category,
            badge:     CATEGORIES.find(c => c.value === category)?.label,
            views:     '0',
            isDraft:   false,
            excerpt:   form.body,
        }
        setBroadcasts(prev => [newItem, ...prev])
        const hasStudents = audiences.some(a => ['students','boarders','karisimbi','bisoke','muhabura','sabyinyo'].includes(a))
        const hasStaff    = audiences.includes('staff')
        const hasParents  = audiences.includes('parents')
        const contextAudience = (hasStudents && hasStaff && hasParents) ? 'all'
            : hasStudents ? 'students'
            : hasStaff    ? 'staff'
            : 'parents'

        addAnnouncement({
            title:    form.title,
            body:     form.body,
            category,
            audience: contextAudience,
            source:   'dis',
            author:   'Mr. E. Mutabazi (DoD)',
        })
        setForm({ title: '', body: '' })
        setAudiences(['all'])
        setCategory('conduct')
        setPublished(true)
        setTimeout(() => setPublished(false), 3000)
    }

    function handleDelete(id) {
        setBroadcasts(prev => prev.filter(b => b.id !== id))
    }

    const visibleBroadcasts = broadcastFilter === 'all'
        ? broadcasts
        : broadcastFilter === 'drafts'
            ? broadcasts.filter(b => b.isDraft)
            : broadcasts.filter(b => !b.isDraft)

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Announcements"
                        subtitle="Compose and broadcast discipline notices to students and houses"
                        {...disUser}
                    />

                    <DashboardContent>
                        <div className="ann-grid">

                            {/* LEFT — Compose */}
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">
                                        <span className="material-symbols-rounded">edit_note</span> Create Announcement
                                    </h2>
                                </div>
                                <div className="card-content">

                                    <div className="form-group ann-form-group">
                                        <label className="form-label">Category</label>
                                        <div className="ann-category-row">
                                            {CATEGORIES.map(cat => (
                                                <label
                                                    key={cat.value}
                                                    className={`ann-cat-label ${cat.value === 'urgent' ? 'urgent' : cat.value === 'conduct' || cat.value === 'boarding' ? 'academic' : cat.value === 'events' ? 'event' : 'general'}`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="dis-cat"
                                                        value={cat.value}
                                                        checked={category === cat.value}
                                                        onChange={() => setCategory(cat.value)}
                                                    />
                                                    <span className="material-symbols-rounded">{cat.icon}</span> {cat.label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="form-group ann-form-group">
                                        <label className="form-label" htmlFor="disTitle">Announcement Title</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            id="disTitle"
                                            name="title"
                                            value={form.title}
                                            onChange={handleChange}
                                            placeholder="e.g. Curfew Reminder — All Boarders"
                                        />
                                    </div>

                                    <div className="form-group ann-form-group">
                                        <label className="form-label">Send To</label>
                                        <div className="ann-audience-grid">
                                            {AUDIENCES.map(a => (
                                                <label key={a.value} className="ann-audience-item">
                                                    <input
                                                        type="checkbox"
                                                        checked={audiences.includes(a.value)}
                                                        onChange={() => toggleAudience(a.value)}
                                                    />
                                                    <span className="material-symbols-rounded">{a.icon}</span> {a.label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="form-group ann-content-group">
                                        <label className="form-label" htmlFor="disContent">Announcement Content</label>
                                        <textarea
                                            className="form-input"
                                            id="disContent"
                                            name="body"
                                            rows={6}
                                            value={form.body}
                                            onChange={handleChange}
                                            placeholder="Type the full announcement details here..."
                                        />
                                    </div>

                                    <div className="ann-form-actions">
                                        <button
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={() => { setForm({ title: '', body: '' }); setAudiences(['students']); setCategory('conduct') }}
                                        >
                                            Clear
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-primary"
                                            onClick={handlePublish}
                                            disabled={!form.title || !form.body}
                                            style={published ? { background: 'var(--success)' } : {}}
                                        >
                                            <span className="material-symbols-rounded">{published ? 'check' : 'send'}</span>
                                            {published ? 'Published!' : 'Publish Now'}
                                        </button>
                                    </div>

                                </div>
                            </div>

                            {/* RIGHT — Recent Broadcasts */}
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">Recent Broadcasts</h2>
                                    <span className="badge badge-published">
                                        {broadcasts.filter(b => !b.isDraft).length} published
                                    </span>
                                </div>
                                <div className="card-content">
                                    <div className="ann-filter-row">
                                        {['all', 'published', 'drafts'].map(f => (
                                            <button
                                                key={f}
                                                className={`ann-filter-pill${broadcastFilter === f ? ' active' : ''}`}
                                                onClick={() => setBroadcastFilter(f)}
                                            >
                                                {f.charAt(0).toUpperCase() + f.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                    <div>
                                        {visibleBroadcasts.map(item => (
                                            <BroadcastItem
                                                key={item.id}
                                                {...item}
                                                onDelete={() => handleDelete(item.id)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>

                        </div>
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
