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
            {items.length === 0 && <span className="tag-chip-empty">None added yet</span>}
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
                    <span className="material-symbols-rounded icon-sm">add</span> Add
                </button>
            </div>
            <TagList items={items} onRemove={onRemove} />
        </div>
    )
}

function YearInput({ onAdd }) {
    const [input, setInput] = useState('')
    function handle() {
        const val = input.trim()
        if (!val) return
        onAdd(val)
        setInput('')
    }
    return (
        <div className="settings-block-input-row" style={{ marginTop: '0.5rem' }}>
            <input
                className="disc-picker-select flex-1"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handle()}
                placeholder="e.g. S1"
            />
            <button className="btn btn-primary btn-sm" onClick={handle}>
                <span className="material-symbols-rounded icon-sm">add</span> Add Year
            </button>
        </div>
    )
}

function YearBlock({ year, onRename, onRemove, onAddStream, onRemoveStream }) {
    const [editing, setEditing]         = useState(false)
    const [draft, setDraft]             = useState(year.name)
    const [streamInput, setStreamInput] = useState('')

    function commitRename() {
        const val = draft.trim()
        if (val && val !== year.name) onRename(year.name, val)
        setEditing(false)
    }

    function handleAddStream() {
        const val = streamInput.trim()
        if (!val) return
        onAddStream(val)
        setStreamInput('')
    }

    return (
        <div style={{ border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '0.875rem 1rem', marginTop: '0.75rem', background: 'var(--background)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {editing ? (
                    <>
                        <input
                            className="disc-picker-select"
                            style={{ width: '7rem' }}
                            value={draft}
                            onChange={e => setDraft(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setEditing(false); setDraft(year.name) } }}
                            autoFocus
                        />
                        <button className="btn btn-primary btn-sm" onClick={commitRename}>Save</button>
                        <button className="btn btn-outline btn-sm" onClick={() => { setEditing(false); setDraft(year.name) }}>Cancel</button>
                    </>
                ) : (
                    <>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{year.name}</span>
                        <button className="btn-icon-clean" onClick={() => setEditing(true)} title="Rename" style={{ color: 'var(--muted-foreground)' }}>
                            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>edit</span>
                        </button>
                        <div style={{ flex: 1 }} />
                        <button className="btn-icon-clean" onClick={onRemove} title="Remove" style={{ color: 'var(--danger)' }}>
                            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>delete</span>
                        </button>
                    </>
                )}
            </div>

            <div className="tag-list" style={{ marginBottom: '0.5rem' }}>
                {year.streams.map(s => (
                    <span key={s} className="tag-chip">
                        {s}
                        <button className="tag-chip-remove" onClick={() => onRemoveStream(s)}>
                            <span className="material-symbols-rounded">close</span>
                        </button>
                    </span>
                ))}
                {year.streams.length === 0 && <span className="tag-chip-empty">No streams yet</span>}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                    className="disc-picker-select"
                    style={{ flex: 1, maxWidth: '14rem', fontSize: '0.85rem' }}
                    value={streamInput}
                    onChange={e => setStreamInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddStream()}
                    placeholder="Add stream e.g. A, MPG"
                />
                <button className="btn btn-outline btn-sm" onClick={handleAddStream}>
                    <span className="material-symbols-rounded icon-sm">add</span> Stream
                </button>
            </div>
        </div>
    )
}

export function DisSettings() {
    const { config, saveConfig, loading, error } = useSchoolConfig()
    const [saving, setSaving] = useState(false)
    const [saved,  setSaved]  = useState(false)

    if (loading) return <p style={{ padding: '2rem' }}>Loading...</p>
    if (error)   return <p style={{ padding: '2rem', color: 'var(--danger)' }}>Error: {error}</p>

    const totalYears  = config.reduce((sum, sec) => sum + sec.years.length, 0)
    const totalStreams = config.reduce((sum, sec) => sum + sec.years.reduce((s, y) => s + y.streams.length, 0), 0)

    const settingsStats = [
        { iconClass: 'info',    icon: 'layers',         label: 'Sections',       value: config.length },
        { iconClass: 'success', icon: 'calendar_month', label: 'Year Groups',    value: totalYears    },
        { iconClass: 'warning', icon: 'groups',         label: 'Stream Classes', value: totalStreams  },
    ]

    function addSection(name) {
        if (config.find(s => s.name === name)) return
        saveConfig([...config, { name, years: [] }])
    }

    function removeSection(name) {
        saveConfig(config.filter(s => s.name !== name))
    }

    function addYear(sectionName, yearName) {
        if (!yearName.trim()) return
        const sec = config.find(s => s.name === sectionName)
        if (!sec || sec.years.find(y => y.name === yearName)) return
        saveConfig(config.map(s => s.name === sectionName
            ? { ...s, years: [...s.years, { name: yearName, streams: [] }] }
            : s))
    }

    function removeYear(sectionName, yearName) {
        saveConfig(config.map(s => s.name === sectionName
            ? { ...s, years: s.years.filter(y => y.name !== yearName) }
            : s))
    }

    function renameYear(sectionName, oldName, newName) {
        if (!newName.trim() || oldName === newName) return
        saveConfig(config.map(s => s.name === sectionName
            ? { ...s, years: s.years.map(y => y.name === oldName ? { ...y, name: newName } : y) }
            : s))
    }

    function addStream(sectionName, yearName, stream) {
        if (!stream.trim()) return
        saveConfig(config.map(s => s.name === sectionName
            ? { ...s, years: s.years.map(y => y.name === yearName && !y.streams.includes(stream)
                ? { ...y, streams: [...y.streams, stream] }
                : y) }
            : s))
    }

    function removeStream(sectionName, yearName, stream) {
        saveConfig(config.map(s => s.name === sectionName
            ? { ...s, years: s.years.map(y => y.name === yearName
                ? { ...y, streams: y.streams.filter(st => st !== stream) }
                : y) }
            : s))
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
                        {config.length > 0 && (
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
                        )}

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

                                                <div className="settings-block">
                                                    <div className="settings-block-label">
                                                        <p className="settings-block-title">Year Groups</p>
                                                        <p className="settings-block-desc">Each year has its own stream classes</p>
                                                    </div>
                                                    <YearInput onAdd={yearName => addYear(sec.name, yearName)} />
                                                </div>

                                                {sec.years.map(y => (
                                                    <YearBlock
                                                        key={y.name}
                                                        year={y}
                                                        onRename={(old, next) => renameYear(sec.name, old, next)}
                                                        onRemove={() => removeYear(sec.name, y.name)}
                                                        onAddStream={stream => addStream(sec.name, y.name, stream)}
                                                        onRemoveStream={stream => removeStream(sec.name, y.name, stream)}
                                                    />
                                                ))}

                                                {sec.years.length === 0 && (
                                                    <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                                                        No year groups yet — add one above
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="cloud-save-row">
                                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
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
