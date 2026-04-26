import { useSearchParams } from 'react-router'
import { Sidebar } from '../../src/components/layout/Sidebar'
import '../styles/layout.css'
import '../styles/components.css'
import '../styles/parent.css'
import { DashboardContent } from '../components/layout/DashboardContent'

/* â”€â”€ Nav items for every portal â”€â”€ */
const NAV = {
    student: {
        navItems: [
            { to: '/student',               icon: 'dashboard', label: 'Dashboard', end: true },
            { to: '/student/results',       icon: 'assessment',     label: 'My Results' },
            { to: '/student/attendance',    icon: 'fact_check',     label: 'Attendance' },
            { to: '/student/timetable',     icon: 'calendar_month', label: 'Timetable' },
            { to: '/student/assignments',   icon: 'assignment',     label: 'Assignments' },
            { to: '/student/activities',    icon: 'emoji_events',   label: 'Activities' },
            { to: '/student/discipline',    icon: 'gavel',          label: 'Discipline' },
            { to: '/student/announcements', icon: 'announcement',   label: 'Announcements' },
            { to: '/student/messages',      icon: 'chat',           label: 'Messages' },
        ],
        secondaryItems: [
            { to: '/profile?role=student', icon: 'account_circle', label: 'Profile' },
            { to: '/login',                     icon: 'logout',          label: 'Logout' },
        ],
    },
    teacher: {
        navItems: [
            { to: '/teacher',               icon: 'dashboard', label: 'Dashboard', end: true },
            { to: '/teacher/classes',       icon: 'book',           label: 'My Classes' },
            { to: '/teacher/students',      icon: 'people',         label: 'Students' },
            { to: '/teacher/attendance',    icon: 'fact_check',     label: 'Attendance' },
            { to: '/teacher/results',       icon: 'school',         label: 'Results' },
            { to: '/teacher/assignments',   icon: 'assignment',     label: 'Assignments' },
            { to: '/teacher/timetable',     icon: 'calendar_month', label: 'Timetable' },
            { to: '/teacher/announcements', icon: 'announcement',   label: 'Announcements' },
            { to: '/teacher/messages',      icon: 'chat',           label: 'Messages' },
        ],
        secondaryItems: [
            { to: '/profile?role=teacher', icon: 'account_circle', label: 'Profile' },
            { to: '/login',                     icon: 'logout',          label: 'Logout' },
        ],
    },
    parent: {
        navItems: [
            { to: '/parent',               icon: 'dashboard', label: 'Dashboard', end: true },
            { to: '/parent/children',      icon: 'child_care',  label: 'My Children' },
            { to: '/parent/results',       icon: 'assessment',  label: 'Results' },
            { to: '/parent/attendance',    icon: 'fact_check',  label: 'Attendance' },
            { to: '/parent/behaviour',     icon: 'gavel',       label: 'Behaviour' },
            { to: '/parent/announcements', icon: 'announcement',label: 'Announcements' },
        ],
        secondaryItems: [
            { to: '/profile?role=parent', icon: 'account_circle', label: 'Profile' },
            { to: '/login',                    icon: 'logout',          label: 'Logout' },
        ],
    },
    discipline: {
        navItems: [
            { to: '/discipline',          icon: 'dashboard', label: 'Dashboard', end: true },
            { to: '/discipline/students', icon: 'groups',            label: 'Students' },
            { to: '/discipline/reports',  icon: 'report',            label: 'Reports' },
            { to: '/discipline/activities',icon: 'emoji_events',     label: 'Activities' },
            { to: '/discipline/boarding', icon: 'home',              label: 'Boarding' },
            { to: '/discipline/dining',   icon: 'restaurant',        label: 'Dining' },
            { to: '/discipline/staff',    icon: 'badge',             label: 'Staff' },
            { to: '/discipline/leaders',  icon: 'military_tech',     label: 'Student Leaders' },
            { to: '/discipline/timetable',icon: 'calendar_month',    label: 'Timetable' },
            { to: '/discipline/messages', icon: 'chat',              label: 'Messages' },
        ],
        secondaryItems: [
            { to: '/profile?role=discipline', icon: 'account_circle', label: 'Profile' },
            { to: '/login',                        icon: 'logout',          label: 'Logout' },
        ],
    },
    dos: {
        navItems: [
            { to: '/dos',               icon: 'dashboard', label: 'Dashboard', end: true },
            { to: '/dos/analytics',     icon: 'bar_chart',   label: 'Analytics' },
            { to: '/dos/results',       icon: 'assessment',  label: 'Results Approval' },
            { to: '/dos/teachers',      icon: 'badge',       label: 'Teachers' },
            { to: '/dos/students',      icon: 'people',      label: 'Students' },
            { to: '/dos/attendance',    icon: 'fact_check',  label: 'Attendance' },
            { to: '/dos/exams',         icon: 'school',      label: 'Exam Schedule' },
            { to: '/dos/timetable',     icon: 'calendar_month', label: 'Timetable' },
            { to: '/dos/leaders',       icon: 'military_tech',  label: 'Student Leaders' },
            { to: '/dos/announcements', icon: 'announcement',   label: 'Announcements' },
            { to: '/dos/messages',      icon: 'chat',           label: 'Messages' },
        ],
        secondaryItems: [
            { to: '/profile?role=dos', icon: 'account_circle', label: 'Profile' },
            { to: '/login',                 icon: 'logout',          label: 'Logout' },
        ],
    },
    matron: {
        navItems: [
            { to: '/matron',                      icon: 'dashboard', label: 'Dashboard', end: true },
            { to: '/matron/students',             icon: 'groups',            label: 'My Students' },
            { to: '/matron/schedule',             icon: 'schedule',          label: 'Daily Schedule' },
            { to: '/matron/incidents',            icon: 'report',            label: 'Report Incident' },
            { to: '/matron/health',               icon: 'health_and_safety', label: 'Health & Wellness' },
            { to: '/matron/parent-communication', icon: 'family_restroom',   label: 'Parent Comms' },
            { to: '/matron/messages',             icon: 'chat',              label: 'Messages' },
        ],
        secondaryItems: [
            { to: '/profile?role=matron', icon: 'account_circle', label: 'Profile' },
            { to: '/login',                    icon: 'logout',          label: 'Logout' },
        ],
    },
}

/* Fallback when no ?role= is provided */
const fallbackNav = {
    navItems: [
        { to: '/profile', icon: 'account_circle', label: 'Profile' },
    ],
    secondaryItems: [
        { to: '/login', icon: 'logout', label: 'Logout' },
    ],
}

export function Account() {
    const [searchParams] = useSearchParams()
    const role = searchParams.get('role') || ''
    const { navItems, secondaryItems } = NAV[role] ?? fallbackNav

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={navItems} secondaryItems={secondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <header className="dashboard-header">
                        <button className="mobile-menu-btn" onClick={() => document.dispatchEvent(new CustomEvent('imboni:open-sidebar'))}><span className="material-symbols-rounded">menu</span></button>
                        <div className="dashboard-header-title">
                            <h1>Account Settings</h1>
                            <p>Update your personal information and preferences</p>
                        </div>
                        <div className="dashboard-header-actions">
                            <span className="date-display">Tuesday, March 10, 2026</span>
                            <div className="header-user">
                                <div className="header-user-info">
                                    <span className="header-user-name">Sandrine Uwera</span>
                                    <span className="header-user-role">User</span>
                                </div>
                                <div className="header-user-av parent-av">SU</div>
                            </div>
                        </div>
                    </header>

                    <DashboardContent>
                        <div className="account-settings-grid">

                            {/* Settings sidebar nav */}
                            <aside className="card settings-nav-card">
                                <nav className="settings-nav-list">
                                    <a href="#profile" className="settings-nav-item active">
                                        <span className="material-symbols-rounded">person</span> Personal Profile
                                    </a>
                                    <a href="#security" className="settings-nav-item">
                                        <span className="material-symbols-rounded">lock</span> Security
                                    </a>
                                    <a href="#notifications" className="settings-nav-item">
                                        <span className="material-symbols-rounded">notifications</span> Notifications
                                    </a>
                                    <a href="#billing" className="settings-nav-item">
                                        <span className="material-symbols-rounded">payments</span> Billing History
                                    </a>
                                </nav>
                            </aside>

                            <div className="settings-sections">

                                {/* Personal Profile */}
                                <section id="profile" className="card settings-section-card">
                                    <div className="settings-card-header">
                                        <h3>Personal Profile</h3>
                                    </div>
                                    <div className="card-content">
                                        <div className="profile-upload-container">
                                            <div className="avatar-large">SU</div>
                                            <button className="btn btn-outline btn-sm">Change Photo</button>
                                        </div>
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label className="form-label">Full Name</label>
                                                <input type="text" className="form-input" defaultValue="Sandrine Uwera" />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Email Address</label>
                                                <input type="email" className="form-input" defaultValue="s.uwera@imboni.edu" />
                                            </div>
                                        </div>
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label className="form-label">Phone Number</label>
                                                <input type="tel" className="form-input" defaultValue="+250 788 000 000" />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Role</label>
                                                <input type="text" className="form-input" defaultValue="Teacher" readOnly />
                                            </div>
                                        </div>
                                        <div className="form-actions">
                                            <button className="btn btn-primary">Update Profile</button>
                                        </div>
                                    </div>
                                </section>

                                {/* Security */}
                                <section id="security" className="card settings-section-card">
                                    <div className="settings-card-header">
                                        <h3>Security</h3>
                                    </div>
                                    <div className="card-content">
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label className="form-label">Current Password</label>
                                                <input type="password" className="form-input" placeholder="Enter current password" />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">New Password</label>
                                                <input type="password" className="form-input" placeholder="Enter new password" />
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Confirm New Password</label>
                                            <input type="password" className="form-input" placeholder="Confirm new password" />
                                        </div>
                                        <div className="form-actions">
                                            <button className="btn btn-primary">Change Password</button>
                                        </div>
                                    </div>
                                </section>

                                {/* Notifications */}
                                <section id="notifications" className="card settings-section-card">
                                    <div className="settings-card-header">
                                        <h3>Notifications</h3>
                                    </div>
                                    <div className="card-content">
                                        <div className="notif-list">
                                            {[
                                                { label: 'New messages', desc: 'Get notified when you receive a new message' },
                                                { label: 'Announcements', desc: 'Get notified when a new announcement is posted' },
                                                { label: 'Results published', desc: 'Get notified when exam results are available' },
                                                { label: 'Discipline reports', desc: 'Get notified when a discipline record is added' },
                                            ].map((item) => (
                                                <div key={item.label} className="notif-row">
                                                    <div>
                                                        <div className="notif-label">{item.label}</div>
                                                        <div className="notif-desc">{item.desc}</div>
                                                    </div>
                                                    <label className="toggle-wrap">
                                                        <input type="checkbox" defaultChecked />
                                                        <span className="toggle-thumb"></span>
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="form-actions">
                                            <button className="btn btn-primary">Save Preferences</button>
                                        </div>
                                    </div>
                                </section>

                                {/* Linked family / billing */}
                                <section id="billing" className="card settings-section-card">
                                    <div className="settings-card-header">
                                        <h3>Family Connections</h3>
                                    </div>
                                    <div className="card-content">
                                        <div className="linked-children-list">
                                            <div className="linked-child-item">
                                                <div className="child-brief">
                                                    <div className="avatar-sm">UA</div>
                                                    <div>
                                                        <p className="name">Uwase Amina</p>
                                                        <p className="id-tag">S4A Â· ID: 2024-001</p>
                                                    </div>
                                                </div>
                                                <span className="badge status-paid">Verified</span>
                                            </div>
                                            <div className="linked-child-item">
                                                <div className="child-brief">
                                                    <div className="avatar-sm" style={{ background: 'var(--accent)' }}>IJ</div>
                                                    <div>
                                                        <p className="name">Ishimwe Jean</p>
                                                        <p className="id-tag">S1B Â· ID: 2024-042</p>
                                                    </div>
                                                </div>
                                                <span className="badge status-paid">Verified</span>
                                            </div>
                                        </div>
                                        <button className="btn btn-outline mt-1 w-full">
                                            <span className="material-symbols-rounded">person_add</span> Link New Student
                                        </button>
                                    </div>
                                </section>

                            </div>
                        </div>
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
