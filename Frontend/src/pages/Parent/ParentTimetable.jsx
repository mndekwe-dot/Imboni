import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { Timetable } from '../../components/timetable/Timetable'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { parentNavItems, parentSecondaryItems, parentUser } from './parentNav'
import { getMyChildren } from '../../api/parent'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/parent.css'

export function ParentTimetable() {
    const [children,      setChildren]      = useState([])
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [loading,       setLoading]       = useState(true)

    useEffect(() => {
        getMyChildren()
            .then(setChildren)
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const child = children[selectedIndex]

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={parentNavItems} secondaryItems={parentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Class Timetable"
                        subtitle="View your child's weekly academic schedule"
                        {...parentUser}
                    />
                    <DashboardContent>
                        {loading ? (
                            <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>Loading…</p>
                        ) : children.length === 0 ? (
                            <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>No children linked to your account.</p>
                        ) : (
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">
                                        {child.student_name} — Class {child.grade}{child.section}
                                    </h2>
                                    {children.length > 1 && (
                                        <div className="flex-row-gap-sm">
                                            <label className="form-label mb-0">Child:</label>
                                            <select
                                                className="form-input"
                                                style={{ width: 'auto' }}
                                                value={selectedIndex}
                                                onChange={e => setSelectedIndex(Number(e.target.value))}
                                            >
                                                {children.map((c, i) => (
                                                    <option key={c.id} value={i}>
                                                        {c.student_name} — {c.grade}{c.section}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                                <div className="card-content">
                                    <Timetable type="academic" classId={`${child.grade}${child.section}`} />
                                </div>
                            </div>
                        )}
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
