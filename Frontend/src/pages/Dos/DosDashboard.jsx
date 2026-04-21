import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { WelcomeBanner } from '../../components/layout/WelcomeBanner'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems, dosUser } from './dosNav'


const dosStats = [
    { iconClass: '',        icon: 'people',          trend: '+15',    trendClass: 'positive', trendIcon: 'trending_up', value: '1,245', label: 'Total Students'    },
    { iconClass: 'warning', icon: 'school',          trend: '45 FT',  trendClass: 'neutral',  trendIcon: null,          value: '85',    label: 'Teaching Staff'    },
    { iconClass: 'success', icon: 'analytics',       trend: '+3%',    trendClass: 'positive', trendIcon: 'trending_up', value: '78%',   label: 'Avg Performance'   },
    { iconClass: 'danger',  icon: 'pending_actions', trend: 'Urgent', trendClass: 'negative', trendIcon: null,          value: '24',    label: 'Pending Approvals' },
]
const recentActivities = [
    { iconClass: 'success', icon: 'check_circle', title: 'S4A Results Approved', time: '2 hours ago' },
    { iconClass: 'info',    icon: 'person_add',   title: 'New Teacher Added',        time: '5 hours ago' },
    { iconClass: 'warning', icon: 'pending',      title: '3 Results Pending Review', time: '1 day ago'   },
]
const performanceOverview = [
    { label: 'School Average',  value: '78%', width: '78%' },
    { label: 'Attendance Rate', value: '94%', width: '94%' },
]

function StatCard({ iconClass, icon, trend, trendClass, trendIcon, value, label }) {
    return (
        <div className="stat-card">
            <div className="stat-header">
                <div className={`stat-icon${iconClass ? ' ' + iconClass : ''}`}>
                    <span className="material-symbols-rounded">{icon}</span>
                </div>
                <span className={`stat-trend ${trendClass}`}>
                    {trendIcon && <span className="material-symbols-rounded">{trendIcon}</span>}
                    {trend}
                </span>
            </div>
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
        </div>
    )
}

function ActivityItem({ iconClass, icon, title, time }) {
    return (
        <div className="activity-item">
            <span className={`activity-icon ${iconClass}`}>
                <span className="material-symbols-rounded">{icon}</span>
            </span>
            <div className="activity-details">
                <p className="activity-title">{title}</p>
                <p className="activity-time">{time}</p>
            </div>
        </div>
    )
}

function ProgressItem({ label, value, width }) {
    return (
        <div className="progress-item">
            <div className="progress-label">
                <span>{label}</span>
                <span className="progress-value">{value}</span>
            </div>
            <div className="progress-bar">
                <div className="progress-fill" style={{ width }}></div>
            </div>
        </div>
    )
}

export function DosDashboard() {
    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={dosNavItems} secondaryItems={dosSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="DOS Dashboard"
                        subtitle="Welcome back, Dr. Ndagijimana"
                        userRole="DOS"
                        userName="Dr. Jean-Claude Ndagijimana"
                        userRoleLabel="Director of Studies"
                        initials="JN"
                        notifications={dosUser.notifications}
                    />

                    <div className="dashboard-content">
                        <WelcomeBanner
                            name="Dr. Ndagijimana"
                            role="Director of Studies &bull; Imboni Academy"
                        />

                        <div className="quick-stats">
                            {dosStats.map((stat) => (
                                <StatCard key={stat.label} {...stat} />
                            ))}
                        </div>

                        <div className="cards-grid">
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">Quick Actions</h2>
                                </div>
                                <div className="card-content">
                                    <div className="action-buttons">
                                        <button className="btn btn-primary">
                                            <span className="material-symbols-rounded">fact_check</span>
                                            Approve Results
                                        </button>
                                        <button className="btn btn-secondary">
                                            <span className="material-symbols-rounded">school</span>
                                            View Teachers
                                        </button>
                                        <button className="btn btn-secondary">
                                            <span className="material-symbols-rounded">people</span>
                                            Manage Students
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">Recent Activity</h2>
                                </div>
                                <div className="card-content">
                                    <div className="activity-list">
                                        {recentActivities.map((item) => (
                                            <ActivityItem key={item.title} {...item} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">Performance Overview</h2>
                                </div>
                                <div className="card-content">
                                    <div className="progress-group">
                                        {performanceOverview.map((item) => (
                                            <ProgressItem key={item.label} {...item} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title">Performance by Grade</h2>
                                <p className="card-subtitle">Average scores across all grades</p>
                            </div>
                            <div className="card-content">
                                <div className="chart-container">
                                    <div className="chart-placeholder">
                                        <span className="material-symbols-rounded">analytics</span>
                                        <p>
                                            S6: 82% | S5: 78% | S4: 75% | S3: 72%
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </>
    )
}
