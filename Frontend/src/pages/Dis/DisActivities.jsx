import { Sidebar } from '../../components/layout/Sidebar'
import { FilterBar } from '../../components/ui/FilterBar'
import { NewActivityModal } from '../../components/modals/NewActivityModal'
import { EditActivityModal } from '../../components/modals/EditActivityModal'
import { useState } from 'react'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'


import { disNavItems, disSecondaryItems, disUser } from './disNav'

const activityStats = [
    { iconClass: 'info', icon: 'emoji_events', value: '18', label: 'Active Clubs', trend: '+3 this term', trendClass: 'positive' },
    { iconClass: 'success', icon: 'groups', value: '847', label: 'Enrolled Students', trend: '+42 this term', trendClass: 'positive' },
    { iconClass: 'warning', icon: 'report', value: '4', label: 'Conduct Incidents', trend: 'During activities', trendClass: 'negative' },
    { iconClass: 'positive', icon: 'supervisor_account', value: '18', label: 'Patron Teachers', trend: 'All assigned', trendClass: 'positive' },
]

const activities = [
    { avClass: 'patron', avText: 'FC', cat: 'sports', name: 'Football Club', patron: 'Mr. Nshimiyimana', schedule: 'Tue & Thu, 4:30 PM', venue: 'Main Sports Field', status: 'active', description: 'Competitive football training and inter-school matches.', badge: 'Active', members: 34, incidents: '0 incidents this term', incidentClass: 'disc-points-pos' },
    { avClass: 'patron', avText: 'BK', cat: 'sports', name: 'Basketball Team', patron: 'Mr. Nkurunziza', schedule: 'Mon & Wed, 5:00 PM', venue: 'Basketball Court', status: 'active', description: 'School basketball team for all year groups.', badge: 'Active', members: 28, incidents: '1 incident this term', incidentClass: 'disc-points-neg' },
    { avClass: 'matron', avText: 'DA', cat: 'arts', name: 'Drama & Arts Club', patron: 'Ms. Ingabire', schedule: 'Fridays, 3:30 PM', venue: 'School Hall', status: 'active', description: 'Drama performances, art exhibitions and creative expression.', badge: 'Active', members: 27, incidents: '0 incidents this term', incidentClass: 'disc-points-pos' },
    { avClass: 'patron', avText: 'DB', cat: 'academic', name: 'Debate Club', patron: 'Ms. Umutoni', schedule: 'Wednesdays, 4:00 PM', venue: 'Library Conference Room', status: 'active', description: 'Debate competitions and public speaking skills development.', badge: 'Active', members: 22, incidents: '0 incidents this term', incidentClass: 'disc-points-pos' },
    { avClass: 'patron', avText: 'SC', cat: 'science', name: 'Science Club', patron: 'Mr. Bizimana', schedule: 'Thursdays, 4:00 PM', venue: 'Science Laboratory', status: 'active', description: 'Experiments, science fairs and STEM exploration.', badge: 'Active', members: 18, incidents: '0 incidents this term', incidentClass: 'disc-points-pos' },
    { avClass: 'matron', avText: 'CS', cat: 'social', name: 'Community Service Club', patron: 'Mr. Ntakirutimana', schedule: 'Saturdays, 9:00 AM', venue: 'Community Hall / Grounds', status: 'active', description: 'Community outreach, charity drives and school environment care.', badge: 'Active', members: 45, incidents: '0 incidents this term', incidentClass: 'disc-points-pos' },
]


const recentActivityIncidents = [
    { iconClass: 'warning', icon: 'sports_basketball', title: 'Unsportsmanlike conduct \u2014 Basketball match vs Groupe Scolaire Officiel', time: 'Mar 5, 2026 \u2022 Student: Mutabazi Kevin (S4A)', typeClass: 'negative', type: 'Negative' },
    { iconClass: 'positive', icon: 'emoji_events', title: 'Outstanding leadership at inter-school debate competition', time: 'Mar 2, 2026 \u2022 Student: Hakizimana Grace (S3A)', typeClass: 'positive', type: 'Positive' },
    { iconClass: 'warning', icon: 'theater_comedy', title: 'Missed 3 consecutive Drama Club sessions without excuse', time: 'Feb 28, 2026 \u2022 Student: Nzeyimana Naomie (S1A)', typeClass: 'warning', type: 'Warning' },
]
const filterOptions = [
    { key: 'all', label: 'All Activities' },
    { key: 'sports', label: 'Sports' },
    { key: 'arts', label: 'Arts' },
    { key: 'academic', label: 'Academic' },
    { key: 'social', label: 'Social' },
    { key: 'science', label: 'Science' },
]

function ActivityStat({ iconClass, icon, value, label, trend, trendClass }) {
    return (
        <div className="disc-stat-card">
            <div className={`disc-stat-icon ${iconClass}`}><span className="material-symbols-rounded">{icon}</span></div>
            <div>
                <div className="disc-stat-value">{value}</div>
                <div className="disc-stat-label">{label}</div>
                <div className={`disc-stat-trend ${trendClass}`}>{trend}</div>
            </div>
        </div>
    )
}

function ActivityCard({ avClass, avText, cat, name, patron, schedule, venue, incidents, incidentClass, badge, members, onEdit }) {
    const role = `${cat.charAt(0).toUpperCase() + cat.slice(1)} \u2022 Patron: ${patron}`
    return (
        <div className="staff-card" data-cat={cat}>
            <div className="staff-card-top">
                <div className={`staff-card-avatar ${avClass}`}>{avText}</div>
                <div>
                    <div className="staff-card-name">{name}</div>
                    <div className="staff-card-role">{role}</div>
                </div>
                <span className="pub-badge active" style={{ marginLeft: 'auto' }}>{badge}</span>
            </div>
            <div className="staff-card-meta">
                <span><span className="material-symbols-rounded">groups</span>{members} members</span>
                <span><span className="material-symbols-rounded">schedule</span>{schedule}</span>
                <span><span className="material-symbols-rounded">location_on</span>{venue}</span>
                <span><span className="material-symbols-rounded">report</span><span className={incidentClass}>{incidents}</span></span>
            </div>
            <div className="staff-card-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => { }}>
                    <span className="material-symbols-rounded">group</span> Members
                </button>
                <button className="btn btn-primary btn-sm" onClick={onEdit}>
                    <span className="material-symbols-rounded">edit</span> Edit
                </button>
            </div>
        </div>
    )
}

function ActivityIncident({ iconClass, icon, title, time, typeClass, type }) {
    return (
        <div className="disc-activity-item">
            <div className={`disc-activity-icon ${iconClass}`}><span className="material-symbols-rounded">{icon}</span></div>
            <div className="disc-activity-details">
                <p className="disc-activity-title">{title}</p>
                <p className="disc-activity-time">{time} &bull; <span className={`incident-type-tag ${typeClass}`}>{type}</span></p>
            </div>
            <button className="btn btn-secondary btn-sm">View Report</button>
        </div>
    )
}

export function DisActivities() {

    const [isOpen, setIsOpen] = useState(false)
    const [filter, setFilter] = useState('all')
    const visible = filter === 'all'
        ? activities
        : activities.filter(r => r.cat === filter)
    const [editingActivity, setEditingActivity] = useState(null)
    function handleSave(updatedForm) {
        console.log('Saved', updatedForm)
    }
    function handleCreate(newForm){
        console.log('new Club Created:', newForm)
    }
    return (
        <>
            {editingActivity && (
                <EditActivityModal
                    activity={editingActivity}
                    onClose={() => setEditingActivity(null)}
                    onSave={handleSave}
                />
            )}
            {isOpen &&(
                <NewActivityModal
                    onClose={()=>setIsOpen(false)}
                    onSave={handleCreate}
                />
            )}
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title="Extracurricular Activities" subtitle="Manage clubs, events, patron assignments and memberships" {...disUser} />

                    <div className="dashboard-content">

                        {/* Stats */}
                        <div className="disc-stat-grid">
                            {activityStats.map((stat, index) => (
                                <ActivityStat key={index} {...stat} />
                            ))}
                        </div>

                        {/* Create / Edit Form Panel */}
                        <div className="act-panel" id="actFormPanel">
                            <div className="card">
                                <div className="card-header">
                                    <button className="card-title" id="actFormTitle" onClick={() => setIsOpen(true)}><span className="material-symbols-rounded">add_circle</span> Create New Club / Event</button>
                                </div>
                                <div className="card-content">
                                    <div className="incident-form">
                                        <div className="form-row-2">
                                            <div className="form-group">
                                                <label className="form-label">Club / Event Name</label>
                                                <input type="text" className="form-input" id="actName" placeholder="e.g. Science Club" />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Category</label>
                                                <select className="form-input" id="actCategory">
                                                    <option>Sports</option>
                                                    <option>Arts</option>
                                                    <option>Academic</option>
                                                    <option>Social</option>
                                                    <option>Science</option>
                                                    <option>Event</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="form-row-2">
                                            <div className="form-group">
                                                <label className="form-label">Patron Teacher</label>
                                                <input type="text" className="form-input" id="actPatron" placeholder="e.g. Mr. Nkurunziza" />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Meeting Schedule</label>
                                                <input type="text" className="form-input" id="actSchedule" placeholder="e.g. Tue &amp; Thu, 4:30 PM" />
                                            </div>
                                        </div>
                                        <div className="form-row-2">
                                            <div className="form-group">
                                                <label className="form-label">Venue / Location</label>
                                                <input type="text" className="form-input" id="actVenue" placeholder="e.g. Sports Field" />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Status</label>
                                                <select className="form-input" id="actStatus">
                                                    <option value="draft">Draft</option>
                                                    <option value="active">Active (visible to students)</option>
                                                    <option value="published">Published (visible to all)</option>
                                                    <option value="suspended">Suspended</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Description</label>
                                            <textarea className="form-input form-textarea" id="actDesc" rows="3" placeholder="Brief description of this club or event..."></textarea>
                                        </div>
                                        <div className="form-actions">
                                            <button className="btn btn-secondary" onClick={() => { }}>Cancel</button>
                                            <button className="btn btn-outline" onClick={() => { }}><span className="material-symbols-rounded">save</span> Save Draft</button>
                                            <button className="btn btn-primary" onClick={() => { }}><span className="material-symbols-rounded">publish</span> Save &amp; Publish</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Members Panel */}
                        <div className="act-panel" id="actMembersPanel">
                            <div className="card">
                                <div className="card-header">
                                    <h3 className="card-title" id="membersPanelTitle"><span className="material-symbols-rounded">group</span> Football Club &mdash; Members</h3>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button className="btn btn-primary btn-sm" onClick={() => { }}><span className="material-symbols-rounded">person_add</span> Add Member</button>
                                        <button className="btn btn-outline btn-sm" onClick={() => { }}>Close</button>
                                    </div>
                                </div>
                                <div className="card-content">

                                    {/* Add member inline form */}
                                    <div id="addMemberForm" style={{ display: 'none', background: 'var(--muted)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                                        <div className="form-row-2" style={{ marginBottom: '0.75rem' }}>
                                            <div className="form-group">
                                                <label className="form-label">Student Name / Adm #</label>
                                                <input type="text" className="form-input" id="newMemberName" placeholder="e.g. Uwase Amina or 2024-S1-001" />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Class</label>
                                                <select className="form-input" id="newMemberClass">
                                                    <option value="">Select class</option>
                                                    <option>S1A</option><option>S1B</option><option>S1C</option>
                                                    <option>S2A</option><option>S2B</option><option>S2C</option>
                                                    <option>S3A</option><option>S3B</option><option>S3C</option>
                                                    <option>S4A</option><option>S4B</option><option>S4C</option>
                                                    <option>S5A</option><option>S5B</option><option>S5C</option>
                                                    <option>S6A</option><option>S6B</option><option>S6C</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="form-actions">
                                            <button className="btn btn-secondary btn-sm" onClick={() => { }}>Cancel</button>
                                            <button className="btn btn-primary btn-sm" onClick={() => { }}>Add Member</button>
                                        </div>
                                    </div>

                                    <div className="member-list" id="memberList">
                                        <div className="member-row">
                                            <div className="student-av-sm patron">KO</div>
                                            <div className="member-info">
                                                <div className="member-name">Mutabazi Kevin</div>
                                                <div className="member-meta">S4A &bull; Adm# 2022-S4-011 &bull; Joined: Jan 2026</div>
                                            </div>
                                            <span className="pub-badge active">Captain</span>
                                            <div className="member-actions">
                                                <button className="btn btn-outline btn-sm" onClick={() => { }}>Edit Role</button>
                                                <button className="btn btn-outline btn-sm" onClick={() => { }}>Remove</button>
                                            </div>
                                        </div>
                                        <div className="member-row">
                                            <div className="student-av-sm patron">PM</div>
                                            <div className="member-info">
                                                <div className="member-name">Mugisha Pierre</div>
                                                <div className="member-meta">S2A &bull; Adm# 2023-S2-012 &bull; Joined: Sep 2025</div>
                                            </div>
                                            <span className="pub-badge draft">Member</span>
                                            <div className="member-actions">
                                                <button className="btn btn-outline btn-sm" onClick={() => { }}>Edit Role</button>
                                                <button className="btn btn-outline btn-sm" onClick={() => { }}>Remove</button>
                                            </div>
                                        </div>
                                        <div className="member-row">
                                            <div className="student-av-sm matron">JA</div>
                                            <div className="member-info">
                                                <div className="member-name">Janet Auma</div>
                                                <div className="member-meta">S2A &bull; Adm# 2023-S2-013 &bull; Joined: Jan 2026</div>
                                            </div>
                                            <span className="pub-badge draft">Member</span>
                                            <div className="member-actions">
                                                <button className="btn btn-outline btn-sm" onClick={() => { }}>Edit Role</button>
                                                <button className="btn btn-outline btn-sm" onClick={() => { }}>Remove</button>
                                            </div>
                                        </div>
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.75rem' }}>Showing 3 of 34 members. <a href="#" style={{ color: 'var(--discipline)' }}>View all members</a></p>
                                </div>
                            </div>
                        </div>

                        {/* Filter + Create bar */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                            <FilterBar
                                options={filterOptions}
                                active={filter}
                                onChange={setFilter}
                            />
                            <button className="btn btn-primary" onClick={() => setIsOpen(true)}>
                                <span className="material-symbols-rounded">add</span> New Club / Event
                            </button>
                        </div>

                        {/* Activity cards */}
                        <div className="staff-cards-grid" id="activityGrid">
                            {visible.map((activity, index) => (
                                <ActivityCard key={index} {...activity} onEdit={() => setEditingActivity(activity)} />
                            ))}

                        </div>

                        {/* Recent incidents */}
                        <div className="card mt-1-5">
                            <div className="card-header">
                                <h2 className="card-title">Recent Conduct Incidents During Activities</h2>
                            </div>
                            <div className="card-content">
                                <div className="disc-activity-list">
                                    {recentActivityIncidents.map((incident, index) => (
                                        <ActivityIncident key={index} {...incident} />
                                    ))}
                                </div>
                            </div>
                        </div>

                    </div>
                </main>
            </div>
        </>
    )
}
