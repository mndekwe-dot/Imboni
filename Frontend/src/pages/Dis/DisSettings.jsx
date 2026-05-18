import { useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'
import { disNavItems, disSecondaryItems, disUser } from './disNav'

function TagList({ items, onRemove }) {
    return (
        <div className="tag-list">
            {items.map(item => (
                <span key={item} className="tag-chip">
                    {item}
                    <button className="tag-chip-remove" onClick={() => onRemove(item)}>
                        <span className="material-symbols-rounded">close</span>
                    </button>
                </span>
            ))}
            {items.length === 0 && (
                <span className="tag-chip-empty">None added yet</span>
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
        <div className="settings-block">
            <div className="settings-block-label">
                <p className="settings-block-title">{title}</p>
                <p className="settings-block-desc">{description}</p>
            </div>
            <div className="settings-block-input-row">
                <input
                    className="disc-picker-select flex-1"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    placeholder={placeholder}
                />
                <button className="btn btn-primary btn-sm" onClick={handleAdd}>
                    <span className="material-symbols-rounded icon-sm">add</span>
                    Add
                </button>
            </div>
            <TagList items={items} onRemove={onRemove} />
        </div>
    )
}

export function DisSettings() {
    const { config, saveConfig, loading, error } = useSchoolConfig()
    const [saving, setSaving] = useState(false)
    const [saved,  setSaved]  = useState(false)

    if (loading) return <p style={{ padding: '2rem' }}>Loading...</p>
    if (error)   return <p style={{ padding: '2rem', color: 'var(--danger)' }}>Error: {error}</p>

    if (config.length === 0) return (
        <div className="dashboard-layout">
            <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />
            <main className="dashboard-main">
                <DashboardHeader
                    title="Portal Settings"
                    subtitle="Configure school structure"
                    {...disUser}
                />
                <DashboardContent>
                    <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                        <p>No school structure configured yet.</p>
                        <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                            The DOS must configure the school structure first.
                        </p>
                    </div>
                </DashboardContent>
            </main>
        </div>
    )

    const totalYears   = config.reduce((sum, sec) => sum + sec.years.length,   0)
    const totalStreams  = config.reduce((sum, sec) => sum + sec.streams.length, 0)

    const settingsStats = [
        { iconClass: 'info',    icon: 'layers',         label: 'Sections',       value: config.length },
        { iconClass: 'success', icon: 'calendar_month', label: 'Year Groups',    value: totalYears    },
        { iconClass: 'warning', icon: 'groups',         label: 'Stream Classes', value: totalStreams  },
    ]

    function updateSection(sectionName, field, updatedArray) {
        const updated = config.map(s =>
            s.name === sectionName ? { ...s, [field]: updatedArray } : s
        )
        saveConfig(updated)
    }

    function addToSection(sectionName, field, val) {
        const sec = config.find(s => s.name === sectionName)
        if (!sec || sec[field].includes(val)) return
        updateSection(sectionName, field, [...sec[field], val])
    }

    function removeFromSection(sectionName, field, val) {
        const sec = config.find(s => s.name === sectionName)
        if (!sec) return
        updateSection(sectionName, field, sec[field].filter(v => v !== val))
    }

    function addSection(name) {
        if (config.find(s => s.name === name)) return
        saveConfig([...config, { name, years: [], streams: [] }])
    }

    function removeSection(name) {
        saveConfig(config.filter(s => s.name !== name))
    }

    async function handleSave() {
        setSaving(true)
        try {
            await saveConfig(config)
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        } catch (err) {
            console.error(err)
        } finally {
            setSaving(false)
        }
    }

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Portal Settings"
                        subtitle="Configure school structure — sections, year groups and stream classes"
                        {...disUser}
                    />

                    <DashboardContent>
                        <div className="disc-stat-grid mb-1-5">
                            {settingsStats.map(s => (
                                <div key={s.label} className="disc-stat-card">
                                    <div className={`disc-stat-icon ${s.iconClass}`}>
                                        <span className="material-symbols-rounded">{s.icon}</span>
                                    </div>
                                    <div>
                                        <div className="disc-stat-value">{s.value}</div>
                                        <div className="disc-stat-label">{s.label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title">Sections, Years &amp; Classes</h2>
                                <span className="settings-info-text">Each section has its own year groups and stream classes</span>
                            </div>
                            <div className="card-content">
                                <ConfigSection
                                    title="Add Section"
                                    description="Academic divisions e.g. O-Level, A-Level"
                                    items={config.map(s => s.name)}
                                    onAdd={addSection}
                                    onRemove={removeSection}
                                    placeholder="e.g. O-Level"
                                />

                                {config.length > 0 && (
                                    <div className="settings-border-section">
                                        {config.map(sec => (
                                            <div key={sec.name} className="sec-config-block">
                                                <p className="sec-config-block-title">{sec.name}</p>
                                                <ConfigSection
                                                    title="Year Groups"
                                                    description={`e.g. S1, S2 for ${sec.name}`}
                                                    items={sec.years}
                                                    onAdd={val => addToSection(sec.name, 'years', val)}
                                                    onRemove={val => removeFromSection(sec.name, 'years', val)}
                                                    placeholder="e.g. S1"
                                                />
                                                <ConfigSection
                                                    title="Stream Classes"
                                                    description={`e.g. A, B or MPG, PCB for ${sec.name}`}
                                                    items={sec.streams}
                                                    onAdd={val => addToSection(sec.name, 'streams', val)}
                                                    onRemove={val => removeFromSection(sec.name, 'streams', val)}
                                                    placeholder="e.g. A or MPG"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="cloud-save-row">
                                    <button
                                        className="btn btn-primary"
                                        onClick={handleSave}
                                        disabled={saving}
                                    >
                                        {saved ? 'Saved!' : saving ? 'Saving...' : 'Save to Database'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
