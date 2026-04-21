import { useState } from 'react'
import { AnnouncementFeed } from '../../components/announcements/AnnouncementFeed'
import { useAnnouncements } from '../../context/AnnouncementsContext'
import '../../styles/teacher.css'
import { teacherNavItems, teacherSecondaryItems, teacherUser } from './teacherNav'

const initialAnnouncements = [
    { id: 't1', type: 'school',     icon: 'school',      title: 'S4 & S6 Exam Timetable Published', date: 'January 10, 2026',  body: 'The Term 2 exam timetable for S4 and S6 has been published. Please check your class pages for detailed timings.',                                          author: 'Dr. Ndagijimana (DOS)',      isUnread: false },
    { id: 't2', type: 'general',    icon: 'groups',       title: 'Staff Meeting — January 20th',     date: 'January 5, 2026',   body: 'All teachers are requested to attend the monthly staff meeting on January 20th at 10:00 AM in the conference room.',                                    author: 'Administration',             isUnread: false },
    { id: 't3', type: 'activities', icon: 'emoji_events', title: 'Mathematics Competition',           date: 'December 20, 2025', body: 'Students interested in participating in the inter-school mathematics competition should register by January 10th. Contact Mr. Rurangwa for details.', author: 'Mr. Rurangwa (Mathematics)', isUnread: false },
    { id: 't4', type: 'class',      icon: 'groups',       title: 'Study Group Sessions',             date: 'December 15, 2025', body: 'Extra study sessions for S4 students every Tuesday and Thursday from 4:00 PM to 5:30 PM. Topics: Advanced Calculus and Statistics.',                  author: 'Mr. Rurangwa (Mathematics)', isUnread: false },
    { id: 't5', type: 'class',      icon: 'menu_book',    title: 'Textbook Collection Reminder',     date: 'December 10, 2025', body: 'All S3 students must collect their new mathematics textbooks from the library by December 20th. Bring your student ID.',                                author: 'Library Administration',     isUnread: false },
]

const TEMPLATES = [
    { label: 'Homework Reminder', category: 'Academic', title: 'Homework Reminder',   body: 'Please complete the assigned homework before the next class.' },
    { label: 'Exam Schedule',     category: 'Academic', title: 'Upcoming Exam',        body: 'A class exam is scheduled. Please revise all topics covered this term.' },
    { label: 'Class Canceled',    category: 'General',  title: 'Class Canceled Today', body: 'Today\'s class has been canceled. Please use the time for self-study.' },
    { label: 'Congratulations',   category: 'General',  title: 'Well Done!',           body: 'Congratulations to all students on your outstanding performance.' },
    { label: 'Important Notice',  category: 'Urgent',   title: 'Important Notice',     body: 'Please read this notice carefully and act accordingly.' },
    { label: 'Reading Assignment', category: 'Academic', title: 'Reading Assignment',  body: 'Please complete the reading assignment before our next session.' },
]

export function TeacherAnnouncement() {
    const { addAnnouncement } = useAnnouncements()
    const [myAnnouncements, setMyAnnouncements] = useState(initialAnnouncements)
    const [form, setForm] = useState({ category: '', title: '', body: '' })
    const [published, setPublished] = useState(false)

    function handleChange(e) {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }

    function handleTemplate(t) {
        setForm({ category: t.category, title: t.title, body: t.body })
    }

    function handlePublish() {
        if (!form.title || !form.body || !form.category) return
        const newAnn = {
            id:       `t-${Date.now()}`,
            type:     form.category.toLowerCase(),
            icon:     'campaign',
            title:    form.title,
            body:     form.body,
            date:     new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            author:   'Mr. Rurangwa (Mathematics)',
            isUnread: true,
        }
        // add to teacher's own feed
        setMyAnnouncements(prev => [newAnn, ...prev])
        // add to shared store — audience: 'students' so only students see it
        addAnnouncement({ ...form, audience: 'students', source: 'teacher', author: 'Mr. Rurangwa (Mathematics)' })
        setForm({ category: '', title: '', body: '' })
        setPublished(true)
        setTimeout(() => setPublished(false), 3000)
    }

    const topPanel = (
        <>
            <div className="card mb-1-5">
                <div className="card-header">
                    <h3 className="card-title">Create New Announcement</h3>
                    <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                        Visible to: <strong>Students only</strong>
                    </span>
                </div>
                <div className="card-content">
                    <div className="flex-column-gap">
                        <div className="form-group">
                            <label className="label">Category</label>
                            <select className="input" name="category" value={form.category} onChange={handleChange}>
                                <option value="">Select category...</option>
                                <option>Academic</option>
                                <option>Events</option>
                                <option>General</option>
                                <option>Urgent</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="label">Title</label>
                            <input type="text" className="input" name="title" value={form.title} onChange={handleChange} placeholder="Announcement title..." />
                        </div>

                        <div className="form-group">
                            <label className="label">Message</label>
                            <textarea className="input" rows="4" name="body" value={form.body} onChange={handleChange} placeholder="Write your announcement..."></textarea>
                        </div>

                        <div className="action-toolbar">
                            <button
                                className="btn btn-primary self-start"
                                onClick={handlePublish}
                                disabled={!form.title || !form.body || !form.category}
                                style={published ? { background: 'var(--success)' } : {}}
                            >
                                <span className="material-symbols-rounded icon-sm">{published ? 'check' : 'send'}</span>
                                {published ? 'Published!' : 'Publish to Students'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

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
        </>
    )

    return (
        <AnnouncementFeed
            navItems={teacherNavItems}
            secondaryItems={teacherSecondaryItems}
            title="Announcements"
            subtitle="Create and manage class announcements"
            userName="Pacifique Rurangwa"
            userRole="Teacher · Mathematics"
            userInitials="PR"
            avatarClass="teacher-av"
            notifications={teacherUser.notifications}
            announcements={myAnnouncements}
            chips={['All', 'Academic', 'Events', 'General']}
            topPanel={topPanel}
        />
    )
}
