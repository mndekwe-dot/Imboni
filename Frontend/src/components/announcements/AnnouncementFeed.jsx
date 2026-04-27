import { useState } from 'react'
import { Sidebar } from '../layout/Sidebar'
import { DashboardHeader } from '../layout/DashboardHeader'
import { AnnouncementItem } from './AnnouncementItem'
import { EmptyState } from '../ui/EmptyState'
import { Modal } from '../ui/Modal'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/pages.css'
import { DashboardContent } from '../layout/DashboardContent'

const TYPE_OPTIONS = ['general', 'urgent', 'school', 'academic', 'event']
const AUDIENCE_OPTIONS = ['School-wide', 'Students', 'Teachers', 'Parents', 'Staff', 'Boarding']

const EMPTY_FORM = { title: '', type: 'general', audience: 'School-wide', body: '' }

function ComposeModal({ onClose, onPublish, authorName }) {
    const [form, setForm]     = useState({ ...EMPTY_FORM })
    const [isDraft, setDraft] = useState(false)

    function handle(e) {
        const { name, value } = e.target
        setForm(prev => ({ ...prev, [name]: value }))
    }

    const isValid = form.title.trim() && form.body.trim()

    function submit(draft) {
        if (!isValid) return
        setDraft(draft)
        onPublish({
            ...form,
            title:    form.title.trim(),
            body:     form.body.trim(),
            date:     new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            author:   authorName ?? 'Administration',
            icon:     form.type === 'urgent' ? 'priority_high' : form.type === 'event' ? 'emoji_events' : form.type === 'academic' ? 'school' : 'campaign',
            isUnread: !draft,
            isDraft:  draft,
        })
        onClose()
    }

    return (
        <Modal
            title="New Announcement"
            icon="edit_note"
            onClose={onClose}
            size="wide"
            footer={
                <div className="modal-footer-row">
                    <span className="modal-footer-hint">{!isValid && '* Title and body are required'}</span>
                    <button className="btn btn-outline" onClick={onClose}>Cancel</button>
                    <button className="btn btn-outline" disabled={!isValid} onClick={() => submit(true)}>
                        <span className="material-symbols-rounded icon-sm">save</span>Save Draft
                    </button>
                    <button className="btn btn-primary" disabled={!isValid} onClick={() => submit(false)}>
                        <span className="material-symbols-rounded icon-sm">send</span>Publish
                    </button>
                </div>
            }
        >
            <div className="form-group">
                <label className="form-label">Title *</label>
                <input
                    className="form-control"
                    name="title"
                    value={form.title}
                    onChange={handle}
                    placeholder="e.g. School closed — Public Holiday, April 28"
                />
            </div>

            <div className="resp-grid-2" style={{ gap: '0.75rem', marginBottom: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Type</label>
                    <select className="form-control" name="type" value={form.type} onChange={handle}>
                        {TYPE_OPTIONS.map(t => (
                            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Audience</label>
                    <select className="form-control" name="audience" value={form.audience} onChange={handle}>
                        {AUDIENCE_OPTIONS.map(a => (
                            <option key={a} value={a}>{a}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="form-group">
                <label className="form-label">Body *</label>
                <textarea
                    className="form-control"
                    name="body"
                    value={form.body}
                    onChange={handle}
                    placeholder="Write the full announcement here…"
                    style={{ minHeight: 120, resize: 'vertical' }}
                />
            </div>

            {form.type === 'urgent' && (
                <div className="ann-compose-urgent-notice">
                    <span className="material-symbols-rounded">warning</span>
                    Urgent announcements are highlighted and sent immediately to all recipients.
                </div>
            )}
        </Modal>
    )
}

export function AnnouncementFeed({
    navItems,
    secondaryItems,
    title = 'Announcements',
    subtitle,
    userName,
    userRole,
    userInitials,
    avatarClass,
    notifications,
    announcements = [],
    chips = ['All'],
    sidebar,
    topPanel,
    canCompose = false,
    authorName,
}) {
    const [activeChip, setActiveChip]   = useState(chips[0])
    const [search, setSearch]           = useState('')
    const [selected, setSelected]       = useState(null)
    const [composing, setComposing]     = useState(false)
    const [list, setList]               = useState(announcements)

    const filtered = list.filter(a => {
        const matchChip   = activeChip === chips[0] || a.type?.toLowerCase() === activeChip.toLowerCase()
        const matchSearch = !search || [a.title, a.body, a.author].some(f => f?.toLowerCase().includes(search.toLowerCase()))
        return matchChip && matchSearch
    })

    const unreadCount = filtered.filter(a => a.isUnread).length

    function handlePublish(newAnn) {
        setList(prev => [newAnn, ...prev])
    }

    return (
        <>
            {selected && (
                <Modal
                    title={selected.title}
                    icon={selected.icon ?? 'campaign'}
                    onClose={() => setSelected(null)}
                    size="wide"
                    footer={
                        <div className="modal-footer-row">
                            <button className="btn btn-outline btn-sm mr-auto" onClick={() => setSelected(null)}>
                                <span className="material-symbols-rounded icon-sm">arrow_back</span> Back
                            </button>
                            <button className="btn btn-primary btn-sm" onClick={() => setSelected(null)}>
                                <span className="material-symbols-rounded icon-sm">done</span>
                                {selected.isUnread ? 'Mark as Read' : 'Close'}
                            </button>
                        </div>
                    }
                >
                    <div className="ann-detail-meta">
                        <span className={`ann-type-badge ${selected.type ?? 'general'}`}>
                            {(selected.type ?? 'general').charAt(0).toUpperCase() + (selected.type ?? 'general').slice(1)}
                        </span>
                        <span className="ann-dot"></span>
                        <span className="ann-detail-date">{selected.date}</span>
                        {selected.audience && <>
                            <span className="ann-dot"></span>
                            <span className="ann-detail-date">{selected.audience}</span>
                        </>}
                    </div>

                    <div className="ann-detail-body">{selected.body}</div>

                    {selected.author && (
                        <div className="ann-detail-author">
                            <div className="ann-author-avatar">
                                {selected.author.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <div className="ann-author-name">{selected.author}</div>
                                <div className="ann-author-date">Posted {selected.date}</div>
                            </div>
                        </div>
                    )}
                </Modal>
            )}

            {composing && (
                <ComposeModal
                    onClose={() => setComposing(false)}
                    onPublish={handlePublish}
                    authorName={authorName}
                />
            )}

            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={navItems} secondaryItems={secondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={title}
                        subtitle={subtitle}
                        userName={userName}
                        userRole={userRole}
                        userInitials={userInitials}
                        avatarClass={avatarClass}
                        notifications={notifications}
                    />
                    <DashboardContent>

                        {topPanel}

                        <div className={`ann-page-wrap${sidebar ? '' : ' ann-no-sidebar'}`}>
                            <div className="ann-feed-card">
                                {/* Toolbar */}
                                <div className="ann-toolbar">
                                    <div className="ann-search-wrap">
                                        <span className="material-symbols-rounded">search</span>
                                        <input
                                            type="text"
                                            placeholder="Search announcements..."
                                            value={search}
                                            onChange={e => setSearch(e.target.value)}
                                        />
                                        {search && (
                                            <button onClick={() => setSearch('')} className="modal-search-clear">
                                                <span className="material-symbols-rounded">close</span>
                                            </button>
                                        )}
                                    </div>
                                    <div className="ann-chip-bar">
                                        {chips.map(chip => (
                                            <button
                                                key={chip}
                                                className={`ann-chip${chip === activeChip ? ' active' : ''}${chip.toLowerCase() === 'urgent' ? ' urgent' : ''}`}
                                                onClick={() => setActiveChip(chip)}
                                            >
                                                {chip}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="ann-toolbar-right">
                                        <button className="btn btn-outline btn-sm">
                                            <span className="material-symbols-rounded">done_all</span> Mark All Read
                                        </button>
                                        {canCompose && (
                                            <button className="btn btn-primary btn-sm" onClick={() => setComposing(true)}>
                                                <span className="material-symbols-rounded icon-sm">add</span>
                                                New Announcement
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* List header */}
                                <div className="ann-list-header">
                                    <span className="ann-list-label">
                                        {activeChip === chips[0] ? 'All Announcements' : `${activeChip} Announcements`}
                                    </span>
                                    <div className="ann-list-meta">
                                        {unreadCount > 0 && (
                                            <span className="ann-unread-badge">{unreadCount} unread</span>
                                        )}
                                        <span className="ann-count-text">
                                            {filtered.length} item{filtered.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                </div>

                                {filtered.length === 0 ? (
                                    <div className="ann-empty-wrap">
                                        <EmptyState
                                            icon="campaign"
                                            title={search ? `No results for "${search}"` : `No ${activeChip.toLowerCase()} announcements`}
                                            description={search ? 'Try different keywords or clear the search.' : 'There are no announcements in this category right now.'}
                                            action={
                                                search
                                                    ? { label: 'Clear Search', icon: 'close', onClick: () => setSearch('') }
                                                    : activeChip !== chips[0]
                                                        ? { label: 'Show All', icon: 'refresh', onClick: () => setActiveChip(chips[0]) }
                                                        : canCompose
                                                            ? { label: 'New Announcement', icon: 'add', onClick: () => setComposing(true) }
                                                            : undefined
                                            }
                                        />
                                    </div>
                                ) : (
                                    <div className="ann-list ann-list-contained">
                                        {filtered.map((item, i) => (
                                            <AnnouncementItem key={i} {...item} onClick={() => setSelected(item)} />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {sidebar && (
                                <div className="ann-sidebar">
                                    {sidebar}
                                </div>
                            )}
                        </div>

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
