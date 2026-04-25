import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import { useState } from 'react'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems, dosUser } from './dosNav'
import { DashboardContent } from '../../components/layout/DashboardContent'


const settingsStats = [
    { iconClass: 'info',    icon: 'layers',         label: 'Sections'       },
    { iconClass: 'success', icon: 'calendar_month', label: 'Year Groups'    },
    { iconClass: 'warning', icon: 'groups',         label: 'Stream Classes' },
]

function TagList({ items, onRemove }) {
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
            {items.map(item => (
                <span key={item} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                    padding: '0.25rem 0.625rem', borderRadius: '999px',
                    background: 'var(--muted)', fontSize: '0.82rem', fontWeight: 500,
                    color: 'var(--foreground)',
                }}>
                    {item}
                    <button onClick={() => onRemove(item)} style={{
                        display: 'inline-flex', alignItems: 'center', background: 'none',
                        border: 'none', cursor: 'pointer', padding: 0,
                        color: 'var(--muted-foreground)',
                    }}>
                        <span className="material-symbols-rounded" style={{ fontSize: '0.9rem' }}>close</span>
                    </button>
                </span>
            ))}
            {items.length === 0 && (
                <span style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>
                    None added yet
                </span>
            )}
        </div>
    )
}

function ConfigSection({ title, description, items, onAdd, onRemove, placeholder }) {
    const [input, setInput] = useState('')

    function handleAdd() {
        const val = input.trim()
        if (!val || items.includes(val)) return
        onAdd(val)
        setInput('')
    }

    return (
        <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ marginBottom: '0.5rem' }}>
                <p style={{ fontWeight: 600, fontSize: '0.9rem', margin: 0 }}>{title}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', margin: '0.1rem 0 0' }}>{description}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                    className="form-input"
                    style={{ flex: 1 }}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    placeholder={placeholder}
                />
                <button className="btn btn-primary btn-sm" onClick={handleAdd}>
                    <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>add</span>
                    Add
                </button>
            </div>
            <TagList items={items} onRemove={onRemove} />
        </div>
    )
}

export function DosSettings() {
    const { config, saveConfig } = useSchoolConfig()

    const totalYears   = config.sections.reduce((sum, sec) => sum + sec.years.length, 0)
    const totalClasses = config.sections.reduce((sum, sec) => sum + sec.classes.length, 0)
    const statCounts   = [config.sections.length, totalYears, totalClasses]

    function updateSection(name, field, updatedArray) {
        saveConfig({
            ...config,
            sections: config.sections.map(s =>
                s.name === name ? { ...s, [field]: updatedArray } : s
            )
        })
    }

    function addSection(name) {
        if (config.sections.find(s => s.name === name)) return
        saveConfig({ ...config, sections: [...config.sections, { name, years: [], classes: [] }] })
    }

    function removeSection(name) {
        saveConfig({ ...config, sections: config.sections.filter(s => s.name !== name) })
    }

    function addYearToSection(sectionName, val) {
        const sec = config.sections.find(s => s.name === sectionName)
        if (!sec || sec.years.includes(val)) return
        updateSection(sectionName, 'years', [...sec.years, val])
    }

    function removeYearFromSection(sectionName, val) {
        const sec = config.sections.find(s => s.name === sectionName)
        if (!sec) return
        updateSection(sectionName, 'years', sec.years.filter(y => y !== val))
    }

    function addClassToSection(sectionName, className) {
        const sec = config.sections.find(s => s.name === sectionName)
        if (!sec || sec.classes.includes(className)) return
        updateSection(sectionName, 'classes', [...sec.classes, className])
    }

    function removeClassFromSection(sectionName, className) {
        const sec = config.sections.find(s => s.name === sectionName)
        if (!sec) return
        updateSection(sectionName, 'classes', sec.classes.filter(c => c !== className))
    }

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={dosNavItems} secondaryItems={dosSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="School Settings"
                        subtitle="Configure school structure — sections, year groups and stream classes"
                        userName="DOS Master"
                        userRole="Director of Studies"
                        userInitials="DS"
                        avatarClass="dos-av"
                        notifications={dosUser.notifications}
                    />

                    <DashboardContent>
                        <div className="disc-stat-grid" style={{ marginBottom: '1.5rem' }}>
                            {settingsStats.map((s, i) => (
                                <div key={i} className="disc-stat-card">
                                    <div className={`disc-stat-icon ${s.iconClass}`}>
                                        <span className="material-symbols-rounded">{s.icon}</span>
                                    </div>
                                    <div>
                                        <div className="disc-stat-value">{statCounts[i]}</div>
                                        <div className="disc-stat-label">{s.label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title">Sections, Years &amp; Classes</h2>
                                <span style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                                    Each section has its own year groups and class streams
                                </span>
                            </div>
                            <div className="card-content">
                                <ConfigSection
                                    title="Add Section"
                                    description="Academic divisions e.g. O-Level, A-Level"
                                    items={config.sections.map(s => s.name)}
                                    onAdd={addSection}
                                    onRemove={removeSection}
                                    placeholder="e.g. O-Level"
                                />

                                {config.sections.length > 0 && (
                                    <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
                                        {config.sections.map(sec => (
                                            <div key={sec.name} style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--muted)', borderRadius: '8px' }}>
                                                <p style={{ fontWeight: 700, fontSize: '0.95rem', margin: '0 0 1rem' }}>{sec.name}</p>
                                                <ConfigSection
                                                    title="Year Groups"
                                                    description={`e.g. S1, S2 for ${sec.name}`}
                                                    items={sec.years}
                                                    onAdd={val => addYearToSection(sec.name, val)}
                                                    onRemove={val => removeYearFromSection(sec.name, val)}
                                                    placeholder="e.g. S1"
                                                />
                                                <ConfigSection
                                                    title="Stream Classes"
                                                    description={`e.g. A, B or MPG, PCB for ${sec.name}`}
                                                    items={sec.classes}
                                                    onAdd={val => addClassToSection(sec.name, val)}
                                                    onRemove={val => removeClassFromSection(sec.name, val)}
                                                    placeholder="e.g. A or MPG"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                    <span className="material-symbols-rounded" style={{ fontSize: '1rem', color: 'var(--success, #16a34a)' }}>cloud_done</span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                                        Changes are saved automatically
                                    </span>
                                </div>
                            </div>
                        </div>
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
