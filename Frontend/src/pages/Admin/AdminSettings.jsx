import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import { useSchoolSettings } from '../../hooks/useSchoolSetting'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import {
    updateSchoolSettings,
    getSubjects, createSubject, updateSubject, deleteSubject,
    renameSubjectCategory, deleteSubjectCategory,
    getDosRooms, createDosRoom, deleteDosRoom,
    getCurrentTerm,
} from '../../api/dos'
import { runTermRollover } from '../../api/admin'
import { adminNavItems, adminSecondaryItems, adminUser } from './adminNav'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/admin.css'
import '../../styles/dos.css'
import '../../styles/discipline.css'

// ── Nav items ─────────────────────────────────────────────────────────────────

const settingsNav = [
    { icon: 'info',           label: 'School Info'      },
    { icon: 'layers',         label: 'School Structure' },
    { icon: 'book',           label: 'Subjects'         },
    { icon: 'meeting_room',   label: 'Rooms'            },
    { icon: 'restart_alt',    label: 'Term Rollover'    },
    { icon: 'calendar_month', label: 'Academic Calendar'},
    { icon: 'notifications',  label: 'Notifications'    },
    { icon: 'security',       label: 'Access & Roles'   },
    { icon: 'backup',         label: 'Data & Backup'    },
]

const LIVE_SECTIONS = ['School Info', 'School Structure', 'Subjects', 'Rooms', 'Term Rollover']

// ── Shared small components ───────────────────────────────────────────────────

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
                    className="form-input flex-1"
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

function YearBlock({ year, onRename, onRemove, onAddStream, onRemoveStream }) {
    const [editing,     setEditing]     = useState(false)
    const [draft,       setDraft]       = useState(year.name)
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
                        <button className="btn-icon-clean" onClick={() => setEditing(true)} title="Rename year" style={{ color: 'var(--muted-foreground)' }}>
                            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>edit</span>
                        </button>
                        <div style={{ flex: 1 }} />
                        <button className="btn-icon-clean" onClick={onRemove} title="Remove year" style={{ color: 'var(--danger)' }}>
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

function TypeBlock({ typeName, subjects, onRenameType, onDeleteType, onAddLesson, onRenameLesson, onDeleteLesson }) {
    const [editingType,   setEditingType]   = useState(false)
    const [typeDraft,     setTypeDraft]     = useState(typeName)
    const [lessonName,    setLessonName]    = useState('')
    const [lessonCode,    setLessonCode]    = useState('')
    const [lessonErr,     setLessonErr]     = useState('')
    const [editingLesson, setEditingLesson] = useState(null)
    const [lessonDraft,   setLessonDraft]   = useState('')

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

    function commitLessonRename(id) {
        if (lessonDraft.trim()) onRenameLesson(id, lessonDraft.trim())
        setEditingLesson(null)
    }

    return (
        <div style={{ border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '1rem', marginTop: '0.75rem', background: 'var(--background)' }}>
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
                        <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{subjects.length} lesson{subjects.length !== 1 ? 's' : ''}</span>
                        <button className="btn-icon-clean" onClick={() => setEditingType(true)} title="Rename type" style={{ color: 'var(--muted-foreground)' }}>
                            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>edit</span>
                        </button>
                        <div style={{ flex: 1 }} />
                        <button className="btn-icon-clean" onClick={() => onDeleteType(typeName)} title="Delete type" style={{ color: 'var(--danger)' }}>
                            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>delete</span>
                        </button>
                    </>
                )}
            </div>

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
                            <button className="btn-icon-clean" onClick={() => { setEditingLesson(s.id); setLessonDraft(s.name) }} title="Rename" style={{ color: 'var(--muted-foreground)' }}>
                                <span className="material-symbols-rounded" style={{ fontSize: '0.95rem' }}>edit</span>
                            </button>
                            <button className="btn-icon-clean" onClick={() => onDeleteLesson(s.id)} title="Delete" style={{ color: 'var(--danger)' }}>
                                <span className="material-symbols-rounded" style={{ fontSize: '0.95rem' }}>delete</span>
                            </button>
                        </>
                    )}
                </div>
            ))}

            {subjects.length === 0 && <p style={{ color: 'var(--muted-foreground)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>No lessons yet</p>}

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

// ── Section components ────────────────────────────────────────────────────────

function SchoolInfoSection() {
    const toast = useToast()
    const { setting, loading: settingsLoading } = useSchoolSettings()
    const [schoolName, setSchoolName] = useState('')
    const [timezone,   setTimezone]   = useState('Africa/Kigali')
    const [saving,     setSaving]     = useState(false)
    const [saved,      setSaved]      = useState(false)

    useEffect(() => {
        if (!settingsLoading) {
            setSchoolName(setting.school_name || '')
            setTimezone(setting.timezone || 'Africa/Kigali')
        }
    }, [settingsLoading, setting])

    async function handleSave() {
        setSaving(true)
        try {
            await updateSchoolSettings({ school_name: schoolName, timezone })
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        } catch (e) {
            toast.error(errorMessage(e, 'Could not save school information.'))
        }
        finally { setSaving(false) }
    }

    if (settingsLoading) return <p style={{ color: 'var(--muted-foreground)' }}>Loading…</p>

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="settings-block">
                <div className="settings-block-label">
                    <p className="settings-block-title">School Name</p>
                    <p className="settings-block-desc">Displayed across all portals and reports</p>
                </div>
                <div className="settings-block-input-row">
                    <input
                        className="form-input flex-1"
                        value={schoolName}
                        onChange={e => { setSchoolName(e.target.value); setSaved(false) }}
                        placeholder="e.g. Imboni Academy"
                    />
                </div>
            </div>

            <div className="settings-block">
                <div className="settings-block-label">
                    <p className="settings-block-title">Timezone</p>
                    <p className="settings-block-desc">All dates shown to users will use this timezone</p>
                </div>
                <div className="settings-block-input-row">
                    <select
                        className="disc-picker-select flex-1"
                        value={timezone}
                        onChange={e => { setTimezone(e.target.value); setSaved(false) }}
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
                        </optgroup>
                        <optgroup label="Americas">
                            <option value="America/New_York">America/New_York — US East (UTC-5/-4)</option>
                            <option value="America/Los_Angeles">America/Los_Angeles — US West (UTC-8/-7)</option>
                        </optgroup>
                    </select>
                </div>
            </div>

            <div>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    <span className="material-symbols-rounded">{saved ? 'check' : 'save'}</span>
                    {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Changes'}
                </button>
            </div>
        </div>
    )
}

function SchoolStructureSection() {
    const toast = useToast()
    const { config, saveConfig, loading, error } = useSchoolConfig()
    const [saving, setSaving] = useState(false)
    const [saved,  setSaved]  = useState(false)

    if (loading) return <p style={{ color: 'var(--muted-foreground)' }}>Loading…</p>
    if (error)   return <p style={{ color: 'var(--danger)' }}>Error: {error}</p>

    const totalYears   = config.reduce((sum, sec) => sum + sec.years.length, 0)
    const totalStreams  = config.reduce((sum, sec) => sum + sec.years.reduce((s, y) => s + y.streams.length, 0), 0)

    function addSection(name) {
        if (config.find(s => s.name === name)) return
        saveConfig([...config, { name, years: [] }])
    }
    function removeSection(name) { saveConfig(config.filter(s => s.name !== name)) }

    function addYear(sectionName, yearName) {
        if (!yearName.trim()) return
        const sec = config.find(s => s.name === sectionName)
        if (!sec || sec.years.find(y => y.name === yearName)) return
        saveConfig(config.map(s => s.name === sectionName
            ? { ...s, years: [...s.years, { name: yearName, streams: [] }] } : s))
    }
    function removeYear(sectionName, yearName) {
        saveConfig(config.map(s => s.name === sectionName
            ? { ...s, years: s.years.filter(y => y.name !== yearName) } : s))
    }
    function renameYear(sectionName, oldName, newName) {
        if (!newName.trim() || oldName === newName) return
        saveConfig(config.map(s => s.name === sectionName
            ? { ...s, years: s.years.map(y => y.name === oldName ? { ...y, name: newName } : y) } : s))
    }
    function addStream(sectionName, yearName, stream) {
        if (!stream.trim()) return
        saveConfig(config.map(s => s.name === sectionName
            ? { ...s, years: s.years.map(y => y.name === yearName && !y.streams.includes(stream)
                ? { ...y, streams: [...y.streams, stream] } : y) } : s))
    }
    function removeStream(sectionName, yearName, stream) {
        saveConfig(config.map(s => s.name === sectionName
            ? { ...s, years: s.years.map(y => y.name === yearName
                ? { ...y, streams: y.streams.filter(st => st !== stream) } : y) } : s))
    }

    async function handleSave() {
        setSaving(true)
        try {
            await saveConfig(config)
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        } catch (e) {
            toast.error(errorMessage(e, 'Could not save the school structure.'))
        } finally { setSaving(false) }
    }

    return (
        <div>
            {config.length > 0 && (
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                    {[
                        { icon: 'layers',         label: 'Sections',       value: config.length },
                        { icon: 'calendar_month', label: 'Year Groups',    value: totalYears    },
                        { icon: 'groups',         label: 'Stream Classes', value: totalStreams  },
                    ].map(s => (
                        <div key={s.label} className="disc-stat-card" style={{ flex: 1, minWidth: 120 }}>
                            <div className="disc-stat-icon info">
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

            {config.length === 0 && (
                <div className="card mb-1-5" style={{ borderLeft: '4px solid var(--primary)', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span className="material-symbols-rounded" style={{ color: 'var(--primary)', fontSize: '1.5rem' }}>info</span>
                        <div>
                            <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Getting started</p>
                            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
                                Add your first section (e.g. O-Level or A-Level), then add year groups and stream classes to it.
                            </p>
                        </div>
                    </div>
                </div>
            )}

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
                                <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                                    No year groups yet — add one above
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <div className="cloud-save-row">
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    {saved ? 'Saved!' : saving ? 'Saving…' : 'Save to Database'}
                </button>
            </div>
        </div>
    )
}

function SubjectsSection() {
    const toast = useToast()
    const [subjects,    setSubjects]    = useState([])
    const [newTypeName, setNewTypeName] = useState('')

    useEffect(() => {
        getSubjects().then(setSubjects).catch(e => toast.error(errorMessage(e, 'Could not load subjects.')))
    }, [])

    function handleAddType() {
        const val = newTypeName.trim()
        if (!val || subjects.some(s => s.category === val)) return
        setNewTypeName('')
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

    const subjectsByType = subjects
        .filter(s => !s._placeholder || s.category)
        .reduce((acc, s) => {
            const cat = s.category || 'Uncategorised'
            if (!acc[cat]) acc[cat] = []
            if (!s._placeholder) acc[cat].push(s)
            else if (!acc[cat].length) acc[cat] = []
            return acc
        }, {})

    const typeCount   = Object.keys(subjectsByType).length
    const lessonCount = subjects.filter(s => !s._placeholder).length

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)' }}>
                    {typeCount} type{typeCount !== 1 ? 's' : ''} · {lessonCount} lesson{lessonCount !== 1 ? 's' : ''}
                </span>
            </div>

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

            {typeCount === 0 && (
                <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem', marginTop: '0.75rem' }}>
                    No subject types yet — add one above.
                </p>
            )}
        </div>
    )
}

function RoomsSection() {
    const toast = useToast()
    const [rooms,     setRooms]     = useState([])
    const [roomInput, setRoomInput] = useState('')
    const [roomErr,   setRoomErr]   = useState('')

    useEffect(() => {
        getDosRooms().then(data => setRooms(data)).catch(e => toast.error(errorMessage(e, 'Could not load rooms.')))
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
        } catch (e) { setRoomErr(e.message || 'Could not add room') }
    }

    async function handleDeleteRoom(id) {
        try {
            await deleteDosRoom(id)
            setRooms(prev => prev.filter(r => r.id !== id))
        } catch (e) {
            toast.error(errorMessage(e, 'Could not delete the room.'))
        }
    }

    return (
        <div>
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
                {rooms.length === 0 && <span className="tag-chip-empty">No rooms yet — add one above</span>}
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', marginTop: '1rem' }}>
                {rooms.length} room{rooms.length !== 1 ? 's' : ''} configured
            </p>
        </div>
    )
}

// ── Term Rollover ─────────────────────────────────────────────────────────────

const TERM_OPTIONS = [
    { value: 'term1', label: 'Term 1' },
    { value: 'term2', label: 'Term 2' },
    { value: 'term3', label: 'Term 3' },
]

function TermRolloverSection() {
    const [currentTerm, setCurrentTerm] = useState(null)
    const [step, setStep]       = useState(1)          // 1 form → 2 preview → 3 done
    const [form, setForm] = useState({ term: 'term1', year: '', name: '', start_date: '', end_date: '' })
    const [preview, setPreview] = useState(null)
    const [result, setResult]   = useState(null)
    const [busy, setBusy]       = useState(false)
    const [error, setError]     = useState(null)

    useEffect(() => {
        getCurrentTerm().then(setCurrentTerm).catch(() => setCurrentTerm(null))
    }, [])

    function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

    const isValid = form.term && form.year && form.name.trim() && form.start_date && form.end_date

    async function handlePreview() {
        setBusy(true); setError(null)
        try {
            const data = await runTermRollover({ ...form, name: form.name.trim(), dry_run: true })
            setPreview(data)
            setStep(2)
        } catch (err) {
            setError(err?.response?.data?.error || 'Preview failed.')
        } finally {
            setBusy(false)
        }
    }

    async function handleExecute() {
        setBusy(true); setError(null)
        try {
            const data = await runTermRollover({ ...form, name: form.name.trim(), dry_run: false })
            setResult(data)
            setStep(3)
        } catch (err) {
            setError(err?.response?.data?.error || 'Rollover failed.')
        } finally {
            setBusy(false)
        }
    }

    const summaryRows = (data) => [
        { label: 'Mode', value: data.mode === 'promotion' ? 'New academic year — promote students' : 'Same year — carry rosters over' },
        { label: 'Students promoted', value: data.students_promoted },
        { label: 'Students graduating (S6)', value: data.students_graduated },
        { label: 'Class rosters created', value: data.rosters_created },
    ]

    return (
        <div>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', marginBottom: '1rem' }}>
                Current term: <strong>{currentTerm?.name || '—'}</strong>.
                Rolling over ends the current term, creates the next one and — when a new
                academic year starts — promotes every active student one grade (S6 graduates).
            </p>

            {step === 1 && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div>
                            <label className="form-label" htmlFor="ro-term">New term</label>
                            <select id="ro-term" className="form-input" value={form.term} onChange={e => set('term', e.target.value)}>
                                {TERM_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label" htmlFor="ro-year">Year</label>
                            <input id="ro-year" type="number" className="form-input" placeholder="e.g. 2027"
                                value={form.year} onChange={e => set('year', e.target.value)} />
                        </div>
                        <div>
                            <label className="form-label" htmlFor="ro-name">Display name</label>
                            <input id="ro-name" className="form-input" placeholder="e.g. Term 1 2027"
                                value={form.name} onChange={e => set('name', e.target.value)} />
                        </div>
                        <div>
                            <label className="form-label" htmlFor="ro-start">Start date</label>
                            <input id="ro-start" type="date" className="form-input"
                                value={form.start_date} onChange={e => set('start_date', e.target.value)} />
                        </div>
                        <div>
                            <label className="form-label" htmlFor="ro-end">End date</label>
                            <input id="ro-end" type="date" className="form-input"
                                value={form.end_date} onChange={e => set('end_date', e.target.value)} />
                        </div>
                    </div>
                    {error && <p style={{ color: '#dc2626', fontSize: '0.82rem' }}>{error}</p>}
                    <button className="btn btn-primary" onClick={handlePreview} disabled={!isValid || busy}>
                        <span className="material-symbols-rounded icon-sm">visibility</span>
                        {busy ? 'Checking…' : 'Preview Rollover'}
                    </button>
                </>
            )}

            {step === 2 && preview && (
                <>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '1rem', marginBottom: '1rem' }}>
                        <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>
                            {preview.current_term} → {preview.new_term}
                        </p>
                        {summaryRows(preview).map(row => (
                            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                                <span style={{ color: 'var(--muted-foreground)' }}>{row.label}</span>
                                <strong>{row.value}</strong>
                            </div>
                        ))}
                        {preview.missing_classes?.length > 0 && (
                            <p style={{ color: 'var(--warning, #d97706)', fontSize: '0.8rem', marginTop: '0.75rem' }}>
                                <span className="material-symbols-rounded" style={{ fontSize: '1rem', verticalAlign: 'middle' }}>warning</span>{' '}
                                No class exists for: {preview.missing_classes.join(', ')} — those students will be
                                promoted but not added to a roster. Create the classes first if needed.
                            </p>
                        )}
                    </div>
                    <p style={{ fontSize: '0.82rem', color: '#dc2626', marginBottom: '0.75rem' }}>
                        This cannot be undone from the interface. Make sure results for
                        {' '}{preview.current_term} are approved before proceeding.
                    </p>
                    {error && <p style={{ color: '#dc2626', fontSize: '0.82rem' }}>{error}</p>}
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-outline" onClick={() => setStep(1)} disabled={busy}>Back</button>
                        <button className="btn btn-primary" onClick={handleExecute} disabled={busy}>
                            <span className="material-symbols-rounded icon-sm">restart_alt</span>
                            {busy ? 'Rolling over…' : 'Run Rollover'}
                        </button>
                    </div>
                </>
            )}

            {step === 3 && result && (
                <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '2.5rem', color: 'var(--success)' }}>check_circle</span>
                    <p style={{ fontWeight: 700, fontSize: '1.05rem', margin: '0.5rem 0' }}>
                        {result.new_term} is now the current term
                    </p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>
                        {result.students_promoted} promoted · {result.students_graduated} graduated ·{' '}
                        {result.rosters_created} rosters created
                    </p>
                </div>
            )}
        </div>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminSettings() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [activeSection, setActiveSection] = useState('School Info')

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={adminNavItems} secondaryItems={adminSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Settings"
                        subtitle="School-wide configuration — structure, subjects, rooms and preferences"
                        {...adminUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        <div className="adm-settings-grid">

                            {/* Left nav */}
                            <nav className="adm-settings-nav">
                                {settingsNav.map(item => (
                                    <button
                                        key={item.label}
                                        className={`adm-settings-nav-item${activeSection === item.label ? ' active' : ''}`}
                                        onClick={() => setActiveSection(item.label)}
                                    >
                                        <span className="material-symbols-rounded">{item.icon}</span>
                                        {item.label}
                                        {!LIVE_SECTIONS.includes(item.label) && (
                                            <span style={{ marginLeft: 'auto', fontSize: '0.62rem', color: 'var(--muted-foreground)', fontWeight: 400 }}>soon</span>
                                        )}
                                    </button>
                                ))}
                            </nav>

                            {/* Right content */}
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">{activeSection}</h2>
                                </div>
                                <div className="card-content">

                                    {activeSection === 'School Info'      && <SchoolInfoSection />}
                                    {activeSection === 'School Structure' && <SchoolStructureSection />}
                                    {activeSection === 'Subjects'         && <SubjectsSection />}
                                    {activeSection === 'Rooms'            && <RoomsSection />}
                                    {activeSection === 'Term Rollover'    && <TermRolloverSection />}

                                    {!LIVE_SECTIONS.includes(activeSection) && (
                                        <div className="coming-soon">
                                            <span className="material-symbols-rounded coming-soon-icon">construction</span>
                                            <p className="coming-soon-title">{activeSection}</p>
                                            <p className="coming-soon-desc">Configuration options coming soon.</p>
                                        </div>
                                    )}

                                </div>
                            </div>

                        </div>
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
