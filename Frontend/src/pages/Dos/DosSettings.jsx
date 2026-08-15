import { useState,useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { SchoolStructureEditor } from '../../components/settings/SchoolStructureEditor'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import { updateSchoolSettings, getSubjects, createSubject, updateSubject, deleteSubject, renameSubjectCategory, deleteSubjectCategory, getDosRooms, createDosRoom, deleteDosRoom } from '../../api/dos'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems } from './dosNav'
import { useSchoolSettings } from '../../hooks/useSchoolSetting'
import { Loading } from '../../components/ui/Loading'

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
function WeightSelect({ prefix, value, onChange, title }) {
    return (
        <select
            className="dset-weight-select"
            value={value ?? 5}
            onChange={e => onChange(Number(e.target.value))}
            title={title}
            aria-label={title}
        >
            {[1,2,3,4,5,6,7,8,9,10].map(w => (
                <option key={w} value={w}>{prefix}{w}</option>
            ))}
        </select>
    )
}

// ── TypeBlock — one subject type with its lessons ────────────────────────────
function TypeBlock({ typeName, subjects, onRenameType, onDeleteType, onAddLesson, onRenameLesson, onDeleteLesson, onLessonWeight }) {
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
        <div className="dset-editblock flat">
            {/* Type header */}
            <div className="dset-head">
                {editingType ? (
                    <>
                        <input className="form-input dset-input-grow" value={typeDraft}
                            onChange={e => setTypeDraft(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') commitTypeRename(); if (e.key === 'Escape') { setEditingType(false); setTypeDraft(typeName) } }}
                            autoFocus />
                        <button className="btn btn-primary btn-sm" onClick={commitTypeRename}>Save</button>
                        <button className="btn btn-outline btn-sm" onClick={() => { setEditingType(false); setTypeDraft(typeName) }}>Cancel</button>
                    </>
                ) : (
                    <>
                        <span className="dset-type-title">{typeName}</span>
                        <span className="dset-type-count">{subjects.length} lesson{subjects.length !== 1 ? 's' : ''}</span>
                        <button className="btn-icon-clean dset-icon-muted" onClick={() => setEditingType(true)} title="Rename type">
                            <span className="material-symbols-rounded u-fs-1">edit</span>
                        </button>
                        <div className="dset-spacer" />
                        <button className="btn-icon-clean dos-danger-text" onClick={() => onDeleteType(typeName)} title="Delete type and all its lessons">
                            <span className="material-symbols-rounded u-fs-1">delete</span>
                        </button>
                    </>
                )}
            </div>

            {/* Lesson list */}
            {subjects.map(s => (
                <div key={s.id} className="dset-lesson-row">
                    {editingLesson === s.id ? (
                        <>
                            <input className="form-input dset-input-grow" value={lessonDraft}
                                onChange={e => setLessonDraft(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') commitLessonRename(s.id); if (e.key === 'Escape') setEditingLesson(null) }}
                                autoFocus />
                            <button className="btn btn-primary btn-sm" onClick={() => commitLessonRename(s.id)}>Save</button>
                            <button className="btn btn-outline btn-sm" onClick={() => setEditingLesson(null)}>Cancel</button>
                        </>
                    ) : (
                        <>
                            <span className="dset-lesson-name">{s.name}</span>
                            <span className="dset-lesson-code">{s.code}</span>
                            <WeightSelect
                                prefix="E"
                                value={s.exam_weight}
                                onChange={v => onLessonWeight(s.id, { exam_weight: v })}
                                title={`Exam weight for ${s.name} (1-10): heavier subjects are scheduled first, get morning slots and rest gaps between exams`}
                            />
                            <WeightSelect
                                prefix="T"
                                value={s.timetable_weight}
                                onChange={v => onLessonWeight(s.id, { timetable_weight: v })}
                                title={`Timetable weight for ${s.name} (1-10): heavier subjects get first pick of periods and spread more strictly across the week`}
                            />
                            <button className="btn-icon-clean dset-icon-muted" onClick={() => startEditLesson(s)} title="Rename">
                                <span className="material-symbols-rounded u-fs-095">edit</span>
                            </button>
                            <button className="btn-icon-clean dos-danger-text" onClick={() => onDeleteLesson(s.id)} title="Delete">
                                <span className="material-symbols-rounded u-fs-095">delete</span>
                            </button>
                        </>
                    )}
                </div>
            ))}

            {subjects.length === 0 && <p className="dset-lesson-empty">No lessons yet</p>}

            {/* Add lesson */}
            <div className="dset-lesson-add">
                <input className="form-input dset-input-lesson"
                    value={lessonName} onChange={e => setLessonName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddLesson()}
                    placeholder="Lesson name e.g. Mathematics" />
                <input className="form-input dset-input-code"
                    value={lessonCode} onChange={e => setLessonCode(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddLesson()}
                    placeholder="Code e.g. MAT" />
                <button className="btn btn-outline btn-sm" onClick={handleAddLesson}>
                    <span className="material-symbols-rounded icon-sm">add</span> Lesson
                </button>
            </div>
            {lessonErr && <p className="dset-inline-err">{lessonErr}</p>}
        </div>
    )
}

// ── Main page ────────────────────────────────────────────────────────────────

export function DosSettings() {
    const { t } = useTranslation()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const sessionUser = useSessionUser()
    const { config, loading, error } = useSchoolConfig()
    const { setting, loading: settingsLoading } = useSchoolSettings()
    const [subjects,  setSubjects]  = useState([])
    const [rooms,     setRooms]     = useState([])
    const [roomInput, setRoomInput] = useState('')
    const [roomErr,   setRoomErr]   = useState('')
    const [timezone,  setTimezone]  = useState('Africa/Kigali')
    const [tzSaving,  setTzSaving]  = useState(false)
    const [tzSaved,   setTzSaved]   = useState(false)

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

    // patch is { exam_weight } or { timetable_weight }
    async function handleLessonWeight(id, patch) {
        const updated = await updateSubject(id, patch)
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

    if (loading) return <Loading fullPage />
    if (error)   return <p className="u-pad dos-danger-text">Error: {error}</p>

    // ── Derived stat counts ───────────────────────────────────────────────────

    const totalYears  = config.reduce((sum, sec) => sum + sec.years.length, 0)
    const totalStreams = config.reduce((sum, sec) => sum + sec.years.reduce((s, y) => s + y.streams.length, 0), 0)

    const settingsStats = [
        { iconClass: 'info',    icon: 'layers',         label: 'Sections',      value: config.length },
        { iconClass: 'success', icon: 'calendar_month', label: 'Year Groups',   value: totalYears    },
        { iconClass: 'warning', icon: 'groups',         label: 'Stream Classes', value: totalStreams  },
    ]

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
                        title={t('dos.settings.title')}
                        subtitle={t('dos.settings.subtitle')}
                        {...sessionUser}
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
                            <div className="card mb-1-5 u-banner u-banner--primary">
                                <div className="u-row">
                                    <span className="material-symbols-rounded u-banner-icon">info</span>
                                    <div>
                                        <p className="u-strong u-mb-025">Getting started</p>
                                        <p className="dset-notice-desc">
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

                                <SchoolStructureEditor showStats={false} />

                            </div>
                        </div>

                        {/* Subjects / Lessons card */}
                        <div className="card mt-1-5">
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
                                    <div className="settings-block-input-row u-mt-sm">
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
                                        onLessonWeight={handleLessonWeight}
                                    />
                                ))}

                                {Object.keys(subjectsByType).length === 0 && (
                                    <p className="dset-note">
                                        No subject types yet. Add one above.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Rooms card */}
                        <div className="card mt-1-5">
                            <div className="card-header">
                                <h2 className="card-title">Rooms &amp; Venues</h2>
                                <span className="settings-info-text">{rooms.length} room{rooms.length !== 1 ? 's' : ''} configured</span>
                            </div>
                            <div className="card-content">
                                <div className="settings-block">
                                    <div className="settings-block-label">
                                        <p className="settings-block-title">Add Room</p>
                                        <p className="settings-block-desc">Classrooms, labs, halls (used when scheduling timetable slots)</p>
                                    </div>
                                    <div className="settings-block-input-row u-mt-sm">
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
                                    {roomErr && <p className="dset-inline-err">{roomErr}</p>}
                                </div>

                                <div className="tag-list u-mt-075">
                                    {rooms.map(r => (
                                        <span key={r.id} className="tag-chip">
                                            <span className="material-symbols-rounded dset-room-icon">meeting_room</span>
                                            {r.name}
                                            <button className="tag-chip-remove" onClick={() => handleDeleteRoom(r.id)}>
                                                <span className="material-symbols-rounded">close</span>
                                            </button>
                                        </span>
                                    ))}
                                    {rooms.length === 0 && (
                                        <span className="tag-chip-empty">No rooms yet. Add one above.</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Timezone card */}
                        <div className="card mt-1-5">
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
                                                <option value="Africa/Kigali">Africa/Kigali (Rwanda, UTC+3)</option>
                                                <option value="Africa/Nairobi">Africa/Nairobi (Kenya, Uganda, Tanzania, UTC+3)</option>
                                                <option value="Africa/Kampala">Africa/Kampala (Uganda, UTC+3)</option>
                                                <option value="Africa/Dar_es_Salaam">Africa/Dar_es_Salaam (Tanzania, UTC+3)</option>
                                                <option value="Africa/Addis_Ababa">Africa/Addis_Ababa (Ethiopia, UTC+3)</option>
                                            </optgroup>
                                            <optgroup label="West Africa">
                                                <option value="Africa/Lagos">Africa/Lagos (Nigeria, UTC+1)</option>
                                                <option value="Africa/Accra">Africa/Accra (Ghana, UTC+0)</option>
                                                <option value="Africa/Abidjan">Africa/Abidjan (Ivory Coast, UTC+0)</option>
                                                <option value="Africa/Dakar">Africa/Dakar (Senegal, UTC+0)</option>
                                            </optgroup>
                                            <optgroup label="Southern Africa">
                                                <option value="Africa/Johannesburg">Africa/Johannesburg (South Africa, UTC+2)</option>
                                                <option value="Africa/Harare">Africa/Harare (Zimbabwe, UTC+2)</option>
                                                <option value="Africa/Lusaka">Africa/Lusaka (Zambia, UTC+2)</option>
                                            </optgroup>
                                            <optgroup label="North Africa">
                                                <option value="Africa/Cairo">Africa/Cairo (Egypt, UTC+2)</option>
                                                <option value="Africa/Casablanca">Africa/Casablanca (Morocco, UTC+1)</option>
                                            </optgroup>
                                            <optgroup label="Europe">
                                                <option value="Europe/London">Europe/London (UK, UTC+0/+1)</option>
                                                <option value="Europe/Paris">Europe/Paris (France, Belgium, UTC+1/+2)</option>
                                                <option value="Europe/Brussels">Europe/Brussels (Belgium, UTC+1/+2)</option>
                                            </optgroup>
                                            <optgroup label="Middle East">
                                                <option value="Asia/Dubai">Asia/Dubai (UAE, UTC+4)</option>
                                            </optgroup>
                                            <optgroup label="Americas">
                                                <option value="America/New_York">America/New_York (US East, UTC-5/-4)</option>
                                                <option value="America/Los_Angeles">America/Los_Angeles (US West, UTC-8/-7)</option>
                                            </optgroup>
                                        </select>
                                        <button className="btn btn-primary btn-sm" onClick={handleTimezoneSave} disabled={tzSaving}>
                                            {tzSaved ? 'Saved!' : tzSaving ? 'Saving…' : 'Save'}
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
