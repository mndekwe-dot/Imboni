import { useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/admin.css'
import { adminNavItems, adminSecondaryItems, adminUser } from './adminNav'


const reportCards = [
    { icon: 'school',        iconClass: '',        title: 'Academic Performance Report',  desc: 'Term-by-term averages, subject breakdowns and class rankings across all year groups.',               lastGenerated: 'Mar 5, 2026'  },
    { icon: 'fact_check',    iconClass: 'success', title: 'Attendance Summary Report',    desc: 'School-wide attendance rates, absenteeism trends and individual student records.',                   lastGenerated: 'Mar 5, 2026'  },
    { icon: 'payments',      iconClass: '',        title: 'Finance & Fee Collection',     desc: 'Fee collection progress, outstanding balances, bursary allocations and monthly expense summary.',    lastGenerated: 'Mar 8, 2026'  },
    { icon: 'badge',         iconClass: 'success', title: 'Staff & HR Report',            desc: 'Staffing levels, contract types, leave records and teacher-to-student ratio analysis.',             lastGenerated: 'Feb 28, 2026' },
    { icon: 'gavel',         iconClass: 'danger',  title: 'Discipline & Welfare Report',  desc: 'Incident log, disciplinary actions, dormitory compliance and student welfare summary.',              lastGenerated: 'Mar 1, 2026'  },
    { icon: 'emoji_events',  iconClass: 'warning', title: 'Co-curricular Activities',     desc: 'Sports results, club membership, competitions entered and student participation rates.',             lastGenerated: 'Feb 20, 2026' },
    { icon: 'analytics',     iconClass: '',        title: 'Exam Results Analysis',        desc: 'National exam performance, predicted grades, cohort comparisons and improvement targets.',          lastGenerated: 'Jan 15, 2026' },
    { icon: 'local_library', iconClass: 'success', title: 'Library Usage Report',         desc: 'Book borrowing stats, popular titles, overdue returns and library access hours.',                   lastGenerated: 'Feb 25, 2026' },
]

const initialExports = [
    { icon: 'picture_as_pdf', name: 'Term 2 Academic Report 2026.pdf',   size: '1.2 MB', date: 'Mar 5, 2026'  },
    { icon: 'table_chart',    name: 'Fee Collection Summary Term2.xlsx',  size: '340 KB', date: 'Mar 8, 2026'  },
    { icon: 'picture_as_pdf', name: 'Staff HR Report Feb 2026.pdf',       size: '780 KB', date: 'Feb 28, 2026' },
    { icon: 'picture_as_pdf', name: 'Discipline Report Term 2 2026.pdf',  size: '560 KB', date: 'Mar 1, 2026'  },
]

function ReportCard({ icon, iconClass, title, desc, lastGenerated, genState, onGenerate }) {
    return (
        <div className="adm-report-card">
            <div className={`adm-report-icon ${iconClass}`}>
                <span className="material-symbols-rounded">{icon}</span>
            </div>
            <div className="adm-report-title">{title}</div>
            <div className="adm-report-desc">{desc}</div>
            <div className="adm-report-meta">
                <span className="material-symbols-rounded" style={{ fontSize: '0.85rem' }}>history</span>
                Last: {genState === 'done' ? 'Just now' : lastGenerated}
                <button
                    className={`btn btn-sm btn-${genState === 'done' ? 'outline' : 'primary'}`}
                    style={{ marginLeft: 'auto', padding: '0.2rem 0.75rem', minWidth: '90px' }}
                    onClick={onGenerate}
                    disabled={genState === 'loading'}
                >
                    {genState === 'loading' && (
                        <span className="material-symbols-rounded" style={{ fontSize: '0.9rem', animation: 'spin 1s linear infinite' }}>refresh</span>
                    )}
                    {genState === 'done' && (
                        <span className="material-symbols-rounded" style={{ fontSize: '0.9rem', color: 'var(--success)' }}>check</span>
                    )}
                    {genState === 'idle' && (
                        <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>download</span>
                    )}
                    {genState === 'loading' ? 'Generating…' : genState === 'done' ? 'Done' : 'Generate'}
                </button>
            </div>
        </div>
    )
}

export function AdminReports() {
    // genStates: { [title]: 'idle' | 'loading' | 'done' }
    const [genStates, setGenStates] = useState({})
    const [exports, setExports]     = useState(initialExports)

    function handleGenerate(title) {
        setGenStates(prev => ({ ...prev, [title]: 'loading' }))
        setTimeout(() => {
            setGenStates(prev => ({ ...prev, [title]: 'done' }))
            const fileName = title.replace(/[^a-zA-Z0-9]/g, '_') + '_2026.pdf'
            setExports(prev => [
                { icon: 'picture_as_pdf', name: fileName, size: `${(Math.random() * 1.5 + 0.3).toFixed(1)} MB`, date: 'Apr 17, 2026' },
                ...prev.slice(0, 5),
            ])
            // Reset back to idle after 3 s so button is reusable
            setTimeout(() => setGenStates(prev => ({ ...prev, [title]: 'idle' })), 3000)
        }, 1800)
    }

    function handleDownload(name) {
        const el = document.createElement('a')
        el.href = '#'
        el.setAttribute('download', name)
        el.click()
    }

    return (
        <>
            <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={adminNavItems} secondaryItems={adminSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Reports"
                        subtitle="Generate and download school reports for all departments"
                        userName={adminUser.userName}
                        userRole={adminUser.userRole}
                        userInitials={adminUser.userInitials}
                        avatarClass={adminUser.avatarClass}
                        notifications={adminUser.notifications}
                    />
                    <div className="dashboard-content">

                        {/* Report Cards */}
                        <div>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.875rem' }}>Available Reports</h3>
                            <div className="adm-report-grid">
                                {reportCards.map((r, i) => (
                                    <ReportCard
                                        key={i} {...r}
                                        genState={genStates[r.title] || 'idle'}
                                        onGenerate={() => handleGenerate(r.title)}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Recent Exports */}
                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title">Recent Exports</h2>
                                <button className="btn btn-outline btn-sm">
                                    <span className="material-symbols-rounded">folder_open</span>
                                    View All
                                </button>
                            </div>
                            <div className="card-content">
                                {exports.map((file, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0', borderBottom: i < exports.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                        <span className="material-symbols-rounded" style={{ color: 'var(--admin)', fontSize: '1.4rem' }}>{file.icon}</span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{file.name}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>{file.size} · {file.date}</div>
                                        </div>
                                        <button className="adm-btn" onClick={() => handleDownload(file.name)} title="Download">
                                            <span className="material-symbols-rounded">download</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </main>
            </div>
        </>
    )
}
