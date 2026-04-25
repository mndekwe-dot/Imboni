import { useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { Timetable } from '../../components/timetable/Timetable'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/parent.css'
import { parentNavItems, parentSecondaryItems, parentUser } from './parentNav'
import { DashboardContent } from '../../components/layout/DashboardContent'


// Parent's children and their classes — replace with profile/API data later
const CHILDREN = [
    { name: 'Uwase Amina',   classId: 'S4A' },
    { name: 'Uwase Patrick', classId: 'S2B' },
]

export function ParentTimetable() {
    // Parent selects which child's timetable to view
    const [selectedIndex, setSelectedIndex] = useState(0)
    const child = CHILDREN[selectedIndex]

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
                        name="Mrs. Chantal Uwase"
                        role="Parent"
                        initials="CU"
                        avatarClass="parent-av"
                    />
                    <DashboardContent>
                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title">{child.name} — Class {child.classId}</h2>
                                {/* Child selector — only shown when parent has more than one child */}
                                {CHILDREN.length > 1 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <label className="form-label" style={{ margin: 0 }}>Child:</label>
                                        <select
                                            className="form-input"
                                            style={{ width: 'auto' }}
                                            value={selectedIndex}
                                            onChange={e => setSelectedIndex(Number(e.target.value))}
                                        >
                                            {CHILDREN.map((c, i) => (
                                                <option key={c.name} value={i}>{c.name} — {c.classId}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div className="card-content">
                                {/* editable not passed → defaults to false — parents cannot edit */}
                                <Timetable type="academic" classId={child.classId} />
                            </div>
                        </div>
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
