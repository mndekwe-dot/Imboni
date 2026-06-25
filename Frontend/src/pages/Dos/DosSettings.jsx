import { useState,useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import { updateSchoolSettings, getSubjects, createSubject, updateSubject, deleteSubject, renameSubjectCategory, deleteSubjectCategory, getDosRooms, createDosRoom, deleteDosRoom } from '../../api/dos'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems, dosUser } from './dosNav'
import { useSchoolSettings } from '../../hooks/useSchoolSetting'

// ── Small reusable components ────────────────────────────────────────────────

// Renders a list of chips with a remove button on each
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

// Renders a text input + Add button + tag list for one config field
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
                    className="form-input flex-1"
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

// ── TypeBlock — one subject type with its lessons ────────────────────────────
function TypeBlock({ typeName, subjects, onRenameType, onDeleteType, onAddLesson, onRenameLesson, onDeleteLesson }) {
    const [editingType,  setEditingType]  = useState(false)
    const [typeDraft,    setTypeDraft]    = useState(typeName)
    const [lessonName,   setLessonName]   = useState('')
    const [lessonCode,   setLessonCode]   = useState('')
    const [lessonErr,    setLessonErr]    = useState('')
    const [editingLesson, setEditingLesson] = useState(null) // subject id
    const [lessonDraft,  setLessonDraft]  = useState('')

    function commitTypeRename() {
        const val = typeDraft.trim()
        if (val && val !== typeName) onRenameType(typeName, val)
        setEditingType(false)
    }

    async function handleAddLesson() {
        if (!lessonName.trim() || !lessonCode.trim()) { setLessonErr('Name and code are required'); return }
        try {
            await onAddLesson(lessonName.trim(), lessonCode.trim().toUpperCase(), typeName)
            setLessonName(''); setLessonCode(''); setLessonErr('')
        } catch (e) { setLessonErr(e.message || 'Could not add lesson') }
    }

    function startEditLesson(subject) {
        setEditingLesson(subject.id)
        setLessonDraft(subject.name)
    }

    function commitLessonRename(id) {
        if (lessonDraft.trim()) onRenameLesson(id, lessonDraft.trim())
        setEditingLesson(null)
    }

    return (
        <div style={{ border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1rem', marginTop: '0.75rem', background: 'var(--background)' }}>
            {/* Type header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {editingType ? (
                    <>
                        <input className="form-input" style={{ flex: 1 }} value={typeDraft}
                            onChange={e => setTypeDraft(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') commitTypeRename(); if (e.key === 'Escape') { setEditingType(false); setTypeDraft(typeName) } }}
                            autoFocus />
                        <button className="btn btn-primary btn-sm" onClick={commitTypeRename}>Save</button>
                        <button className="btn btn-outline btn-sm" onClick={() => { setEditingType(false); setTypeDraft(typeName) }}>Cancel</button>
                    </>
                ) : (
                    <>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{typeName}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{subjects.length} lesson{subjects.length !== 1 ? 's' : ''}</span>
                        <button className="btn-icon-clean" onClick={() => setEditingType(true)} title="Rename type" style={{ color: 'var(--muted-foreground)' }}>
                            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>edit</span>
                        </button>
                        <div style={{ flex: 1 }} />
                        <button className="btn-icon-clean" onClick={() => onDeleteType(typeName)} title="Delete type and all its lessons" style={{ color: 'var(--danger)' }}>
                            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>delete</span>
                        </button>
                    </>
                )}
            </div>

            {/* Lesson list */}
            {subjects.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.6rem', borderRadius: '0.375rem', marginBottom: '0.375rem', background: 'var(--card)', border: '1px solid var(--border)' }}>
                    {editingLesson === s.id ? (
                        <>
                            <input className="form-input" style={{ flex: 1 }} value={lessonDraft}
                                onChange={e => setLessonDraft(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') commitLessonRename(s.id); if (e.key === 'Escape') setEditingLesson(null) }}
                                autoFocus />
                            <button className="btn btn-primary btn-sm" onClick={() => commitLessonRename(s.id)}>Save</button>
                            <button className="btn btn-outline btn-sm" onClick={() => setEditingLesson(null)}>Cancel</button>
                        </>
                    ) : (
                        <>
                            <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 500 }}>{s.name}</span>
                            <span style={{ fontSize: '0.7rem', background: 'var(--primary)', color: '#fff', padding: '0.1rem 0.45rem', borderRadius: '0.25rem', fontWeight: 600 }}>{s.code}</span>
                            <button className="btn-icon-clean" onClick={() => startEditLesson(s)} title="Rename" style={{ color: 'var(--muted-foreground)' }}>
                                <span className="material-symbols-rounded" style={{ fontSize: '0.95rem' }}>edit</span>
                            </button>
                            <button className="btn-icon-clean" onClick={() => onDeleteLesson(s.id)} title="Delete" style={{ color: 'var(--danger)' }}>
                                <span className="material-symbols-rounded" style={{ fontSize: '0.95rem' }}>delete</span>
                            </button>
                        </>
                    )}
                </div>
            ))}

            {subjects.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>No lessons yet</p>}

            {/* Add lesson */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <input className="form-input" style={{ flex: 2, minWidth: '9rem', fontSize: '0.85rem' }}
                    value={lessonName} onChange={e => setLessonName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddLesson()}
                    placeholder="Lesson name e.g. Mathematics" />
                <input className="form-input" style={{ flex: 1, minWidth: '5rem', fontSize: '0.85rem' }}
                    value={lessonCode} onChange={e => setLessonCode(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddLesson()}
                    placeholder="Code e.g. MAT" />
                <button className="btn btn-outline btn-sm" onClick={handleAddLesson}>
                    <span className="material-symbols-rounded icon-sm">add</span> Lesson
                </button>
            </div>
            {lessonErr && <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{lessonErr}</p>}
        </div>
    )
}

// ── YearInput — add a new year group ────────────────────────────────────────
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
                className="form-input flex-1"
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

// ── YearBlock — one year with editable name and per-year streams ─────────────
function YearBlock({ year, onRename, onRemove, onAddStream, onRemoveStream }) {
    const [editing, setEditing]       = useState(false)
    const [draft, setDraft]           = useState(year.name)
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
            {/* Year header — name + edit + delete */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {editing ? (
                    <>
                        <input
                            className="form-input"
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
                        <button
                            className="btn-icon-clean"
                            onClick={() => setEditing(true)}
                            title="Rename year"
                            style={{ color: 'var(--muted-foreground)' }}
                        >
                            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>edit</span>
                        </button>
                        <div style={{ flex: 1 }} />
                        <button
                            className="btn-icon-clean"
                            onClick={onRemove}
                            title="Remove year"
                            style={{ color: 'var(--danger)' }}
                        >
                            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>delete</span>
                        </button>
                    </>
                )}
            </div>

            {/* Stream chips */}
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

            {/* Add stream */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                    className="form-input"
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

// ── Main page ────────────────────────────────────────────────────────────────

export function DosSettings() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const { config, saveConfig, loading, error } = useSchoolConfig()
    const { setting, loading: settingsLoading } = useSchoolSettings()
    const [subjects,  setSubjects]  = useState([])
    const [rooms,     setRooms]     = useState([])
    const [roomInput, setRoomInput] = useState('')
    const [roomErr,   setRoomErr]   = useState('')
    const [timezone,  setTimezone]  = useState('Africa/Kigali')
    const [tzSaving,  setTzSaving]  = useState(false)
    const [tzSaved,   setTzSaved]   = useState(false)
    const [saving, setSaving] = useState(false)
    const [saved,  setSaved]  = useState(false)

    useEffect(() => {
        if (!settingsLoading) setTimezone(setting.timezone)
    }, [settingsLoading, setting.timezone])

    useEffect(() => {
        getSubjects().then(setSubjects).catch(console.error)
        getDosRooms().then(data => setRooms(data)).catch(console.error)
    }, [])

    async function handleAddRoom() {
        const name = roomInput.trim()
        if (!name) return
        if (rooms.some(r => r.name.toLowerCase() === name.toLowerCase())) {
            setRoomErr('Room already exists'); return
        }
        try {
            const newRoom = await createDosRoom(name)
            setRooms(prev => [...prev, newRoom].sort((a, b) => a.name.localeCompare(b.name)))
            setRoomInput('')
            setRoomErr('')
        } catch (e) {
            setRoomErr(e.message || 'Could not add room')
        }
    }

    async function handleDeleteRoom(id) {
        try {
            await deleteDosRoom(id)
            setRooms(prev => prev.filter(r => r.id !== id))
        } catch (e) {
            console.error(e)
        }
    }

    // ── Subject / Type handlers ───────────────────────────────────────────────
    const [newTypeName, setNewTypeName] = useState('')

    function handleAddType() {
        const val = newTypeName.trim()
        if (!val || subjects.some(s => s.category === val)) return
        setNewTypeName('')
        // type exists when it has lessons — just track it locally for now
        // adding a lesson to it creates the type implicitly
        setSubjects(prev => prev) // trigger re-group (type appears once a lesson is added)
        // store as empty placeholder so UI shows it immediately
        setSubjects(prev => [...prev, { id: `__type_${val}`, name: '', code: '', category: val, _placeholder: true }])
    }

    async function handleAddLesson(name, code, category) {
        const created = await createSubject({ name, code, category })
        setSubjects(prev => prev.filter(s => !s._placeholder || s.category !== category).concat(created).sort((a, b) => a.name.localeCompare(b.name)))
    }

    async function handleRenameType(oldName, newName) {
        await renameSubjectCategory(oldName, newName)
        setSubjects(prev => prev.map(s => s.category === oldName ? { ...s, category: newName } : s))
    }

    async function handleDeleteType(name) {
        await deleteSubjectCategory(name)
        setSubjects(prev => prev.filter(s => s.category !== name))
    }

    async function handleRenameLesson(id, name) {
        const updated = await updateSubject(id, { name })
        setSubjects(prev => prev.map(s => s.id === id ? updated : s))
    }

    async function handleDeleteLesson(id) {
        await deleteSubject(id)
        setSubjects(prev => prev.filter(s => s.id !== id))
    }

    // Group subjects by category
    const subjectsByType = subjects
        .filter(s => !s._placeholder || s.category)
        .reduce((acc, s) => {
            const cat = s.category || 'Uncategorised'
            if (!acc[cat]) acc[cat] = []
            if (!s._placeholder) acc[cat].push(s)
            else if (!acc[cat].length) acc[cat] = []
            return acc
        }, {})

    // ── Loading / error / empty states ───────────────────────────────────────

    if (loading) return <p style={{ padding: '2rem' }}>Loading...</p>
    if (error)   return <p style={{ padding: '2rem', color: 'var(--danger)' }}>Error: {error}</p>

    // ── Derived stat counts ───────────────────────────────────────────────────

    const totalYears  = config.reduce((sum, sec) => sum + sec.years.length, 0)
    const totalStreams = config.reduce((sum, sec) => sum + sec.years.reduce((s, y) => s + y.streams.length, 0), 0)

    const settingsStats = [
        { iconClass: 'info',    icon: 'layers',         label: 'Sections',      value: config.length },
        { iconClass: 'success', icon: 'calendar_month', label: 'Year Groups',   value: totalYears    },
        { iconClass: 'warning', icon: 'groups',         label: 'Stream Classes', value: totalStreams  },
    ]

    // ── Generic update helpers ────────────────────────────────────────────────

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

    // ── Save to backend ───────────────────────────────────────────────────────

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

    async function handleTimezoneSave() {
        setTzSaving(true)
        try{
            await updateSchoolSettings({timezone})
            setTzSaved(true)
            setTimeout(()=>setTzSaved(false),3000)
        }catch (err){
            console.error(err)
        } finally{
            setTzSaving(false)
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────

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
                        {...dosUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />

                    <DashboardContent>

                        {/* Stat cards — only when sections exist */}
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

                        {/* Onboarding notice — only when no sections yet */}
                        {config.length === 0 && (
                            <div className="card mb-1-5" style={{ borderLeft: '4px solid var(--primary)', padding: '1rem 1.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span className="material-symbols-rounded" style={{ color: 'var(--primary)', fontSize: '1.5rem' }}>info</span>
                                    <div>
                                        <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Getting started</p>
                                        <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
                                            Add your first section below (e.g. O-Level or A-Level), then add year groups and stream classes to it.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Config card */}
                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title">Sections, Years &amp; Classes</h2>
                                <span className="settings-info-text">
                                    Each section has its own year groups and stream classes
                                </span>
                            </div>
                            <div className="card-content">

                                {/* Add / remove sections */}
                                <ConfigSection
                                    title="Add Section"
                                    description="Academic divisions e.g. O-Level, A-Level"
                                    items={config.map(s => s.name)}
                                    onAdd={addSection}
                                    onRemove={removeSection}
                                    placeholder="e.g. O-Level"
                                />

                                {/* Per-section year and stream config */}
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

                                {/* Save button */}
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

                        {/* Subjects / Lessons card */}
                        <div className="card" style={{ marginTop: '1.5rem' }}>
                            <div className="card-header">
                                <h2 className="card-title">Academic Subjects</h2>
                                <span className="settings-info-text">{Object.keys(subjectsByType).length} type{Object.keys(subjectsByType).length !== 1 ? 's' : ''} · {subjects.filter(s => !s._placeholder).length} lessons</span>
                            </div>
                            <div className="card-content">
                                {/* Add type */}
                                <div className="settings-block">
                                    <div className="settings-block-label">
                                        <p className="settings-block-title">Add Subject Type</p>
                                        <p className="settings-block-desc">e.g. Sciences, Languages, Humanities</p>
                                    </div>
                                    <div className="settings-block-input-row" style={{ marginTop: '0.5rem' }}>
                                        <input
                                            className="form-input flex-1"
                                            value={newTypeName}
                                            onChange={e => setNewTypeName(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleAddType()}
                                            placeholder="e.g. Sciences"
                                        />
                                        <button className="btn btn-primary btn-sm" onClick={handleAddType}>
                                            <span className="material-symbols-rounded icon-sm">add</span> Add Type
                                        </button>
                                    </div>
                                </div>

                                {/* Type blocks */}
                                {Object.entries(subjectsByType).map(([typeName, lessons]) => (
                                    <TypeBlock
                                        key={typeName}
                                        typeName={typeName}
                                        subjects={lessons}
                                        onRenameType={handleRenameType}
                                        onDeleteType={handleDeleteType}
                                        onAddLesson={handleAddLesson}
                                        onRenameLesson={handleRenameLesson}
                                        onDeleteLesson={handleDeleteLesson}
                                    />
                                ))}

                                {Object.keys(subjectsByType).length === 0 && (
                                    <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                                        No subject types yet — add one above
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Rooms card */}
                        <div className="card" style={{ marginTop: '1.5rem' }}>
                            <div className="card-header">
                                <h2 className="card-title">Rooms &amp; Venues</h2>
                                <span className="settings-info-text">{rooms.length} room{rooms.length !== 1 ? 's' : ''} configured</span>
                            </div>
                            <div className="card-content">
                                <div className="settings-block">
                                    <div className="settings-block-label">
                                        <p className="settings-block-title">Add Room</p>
                                        <p className="settings-block-desc">Classrooms, labs, halls — used when scheduling timetable slots</p>
                                    </div>
                                    <div className="settings-block-input-row" style={{ marginTop: '0.5rem' }}>
                                        <input
                                            className="form-input flex-1"
                                            value={roomInput}
                                            onChange={e => { setRoomInput(e.target.value); setRoomErr('') }}
                                            onKeyDown={e => e.key === 'Enter' && handleAddRoom()}
                                            placeholder="e.g. Lab 1, Room 12, Hall A"
                                        />
                                        <button className="btn btn-primary btn-sm" onClick={handleAddRoom}>
                                            <span className="material-symbols-rounded icon-sm">add</span> Add
                                        </button>
                                    </div>
                                    {roomErr && <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{roomErr}</p>}
                                </div>

                                <div className="tag-list" style={{ marginTop: '0.75rem' }}>
                                    {rooms.map(r => (
                                        <span key={r.id} className="tag-chip">
                                            <span className="material-symbols-rounded" style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>meeting_room</span>
                                            {r.name}
                                            <button className="tag-chip-remove" onClick={() => handleDeleteRoom(r.id)}>
                                                <span className="material-symbols-rounded">close</span>
                                            </button>
                                        </span>
                                    ))}
                                    {rooms.length === 0 && (
                                        <span className="tag-chip-empty">No rooms yet — add one above</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Timezone card */}
                        <div className="card" style={{ marginTop: '1.5rem' }}>
                            <div className="card-header">
                                <h2 className="card-title">School Settings</h2>
                                <span className="settings-info-text">Timezone used for all dates and times</span>
                            </div>
                            <div className="card-content">
                                <div className="settings-block">
                                    <div className="settings-block-label">
                                        <p className="settings-block-title">Timezone</p>
                                        <p className="settings-block-desc">All dates shown to users will use this timezone regardless of their location</p>
                                    </div>
                                    <div className="settings-block-input-row">
                                        <select
                                            className="disc-picker-select flex-1"
                                            value={timezone}
                                            onChange={e => setTimezone(e.target.value)}
                                        >
                                            <optgroup label="East Africa">
                                                <option value="Africa/Kigali">Africa/Kigali — Rwanda (UTC+3)</option>
                                                <option value="Africa/Nairobi">Africa/Nairobi — Kenya, Uganda, Tanzania (UTC+3)</option>
                                                <option value="Africa/Kampala">Africa/Kampala — Uganda (UTC+3)</option>
                                                <option value="Africa/Dar_es_Salaam">Africa/Dar_es_Salaam — Tanzania (UTC+3)</option>
                                                <option value="Africa/Addis_Ababa">Africa/Addis_Ababa — Ethiopia (UTC+3)</option>
                                            </optgroup>
                                            <optgroup label="West Africa">
                                                <option value="Africa/Lagos">Africa/Lagos — Nigeria (UTC+1)</option>
                                                <option value="Africa/Accra">Africa/Accra — Ghana (UTC+0)</option>
                                                <option value="Africa/Abidjan">Africa/Abidjan — Ivory Coast (UTC+0)</option>
                                                <option value="Africa/Dakar">Africa/Dakar — Senegal (UTC+0)</option>
                                            </optgroup>
                                            <optgroup label="Southern Africa">
                                                <option value="Africa/Johannesburg">Africa/Johannesburg — South Africa (UTC+2)</option>
                                                <option value="Africa/Harare">Africa/Harare — Zimbabwe (UTC+2)</option>
                                                <option value="Africa/Lusaka">Africa/Lusaka — Zambia (UTC+2)</option>
                                            </optgroup>
                                            <optgroup label="North Africa">
                                                <option value="Africa/Cairo">Africa/Cairo — Egypt (UTC+2)</option>
                                                <option value="Africa/Casablanca">Africa/Casablanca — Morocco (UTC+1)</option>
                                            </optgroup>
                                            <optgroup label="Europe">
                                                <option value="Europe/London">Europe/London — UK (UTC+0/+1)</option>
                                                <option value="Europe/Paris">Europe/Paris — France, Belgium (UTC+1/+2)</option>
                                                <option value="Europe/Brussels">Europe/Brussels — Belgium (UTC+1/+2)</option>
                                            </optgroup>
                                            <optgroup label="Middle East">
                                                <option value="Asia/Dubai">Asia/Dubai — UAE (UTC+4)</option>
                                            </optgroup>
                                            <optgroup label="Americas">
                                                <option value="America/New_York">America/New_York — US East (UTC-5/-4)</option>
                                                <option value="America/Los_Angeles">America/Los_Angeles — US West (UTC-8/-7)</option>
                                            </optgroup>
                                        </select>
                                        <button className="btn btn-primary btn-sm" onClick={handleTimezoneSave} disabled={tzSaving}>
                                            {tzSaved ? 'Saved!' : tzSaving ? 'Saving...' : 'Save'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
