import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import {
    getDisFacilities, createDisFacility, patchDisFacility, deleteDisFacility,
    getDisFacilitySections, createDisFacilitySection, patchDisFacilitySection, deleteDisFacilitySection,
} from '../../api/discipline'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'
import { disNavItems, disSecondaryItems, disUser } from './disNav'

// ── Constants ─────────────────────────────────────────────────────────────────

const FACILITY_TYPES = [
    { key: 'dormitory',   label: 'Dormitory',       icon: 'hotel',            genderRelevant: true  },
    { key: 'dining_hall', label: 'Dining Hall',      icon: 'restaurant',       genderRelevant: false },
    { key: 'common_room', label: 'Common Room',      icon: 'living',           genderRelevant: false },
    { key: 'medical',     label: 'Medical Room',     icon: 'medical_services', genderRelevant: false },
    { key: 'sports',      label: 'Sports Facility',  icon: 'sports_soccer',    genderRelevant: false },
    { key: 'library',     label: 'Library',          icon: 'menu_book',        genderRelevant: false },
    { key: 'other',       label: 'Other',            icon: 'category',         genderRelevant: false },
]

const GENDER_OPTIONS = [
    { value: 'boys',  label: 'Boys'           },
    { value: 'girls', label: 'Girls'          },
    { value: 'mixed', label: 'Mixed / Shared' },
    { value: 'na',    label: 'Not Applicable' },
]

const GENDER_BADGE = {
    boys:  { cls: 'info',    label: 'Boys'  },
    girls: { cls: 'warning', label: 'Girls' },
    mixed: { cls: 'success', label: 'Mixed' },
    na:    { cls: '',        label: ''      },
}

// ── Section Modal ─────────────────────────────────────────────────────────────

function SectionModal({ section, onClose, onSave }) {
    const isEditing = !!section
    const [form, setForm] = useState({
        name:        section?.name        || '',
        gender:      section?.gender      || 'na',
        description: section?.description || '',
    })
    const [saving, setSaving] = useState(false)
    const [error,  setError]  = useState(null)

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    async function handleSave() {
        if (!form.name.trim()) { setError('Section name is required.'); return }
        setSaving(true); setError(null)
        try {
            await onSave({ name: form.name.trim(), gender: form.gender, description: form.description })
        } catch { setError('Failed to save. Please try again.') }
        finally   { setSaving(false) }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-rounded" style={{ color: 'var(--discipline, #7c3aed)' }}>
                            {isEditing ? 'edit' : 'add_circle'}
                        </span>
                        <h2 className="modal-title">{isEditing ? 'Edit Section' : 'Add Section'}</h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose}><span className="material-symbols-rounded">close</span></button>
                </div>
                <div className="modal-body">
                    <div className="form-group">
                        <label className="form-label">Section Name *</label>
                        <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                            placeholder="e.g. Boys Section, Girls Wing" autoFocus />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Gender</label>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {GENDER_OPTIONS.map(g => (
                                <label key={g.value} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem', padding: '0.35rem 0.75rem', borderRadius: '6px', border: `1px solid ${form.gender === g.value ? 'var(--primary)' : 'var(--border)'}`, background: form.gender === g.value ? 'var(--primary-light, #ede9fe)' : 'transparent' }}>
                                    <input type="radio" value={g.value} checked={form.gender === g.value} onChange={() => setForm(p => ({ ...p, gender: g.value }))} style={{ accentColor: 'var(--primary)' }} />
                                    {g.label}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Description (optional)</label>
                        <textarea className="form-input form-textarea" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows="2" placeholder="Brief description…" />
                    </div>
                    {error && <p style={{ color: '#dc2626', fontSize: '0.82rem', margin: 0 }}>{error}</p>}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
                        <span className="material-symbols-rounded">{isEditing ? 'save' : 'add_circle'}</span>
                        {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Section'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Section Card ──────────────────────────────────────────────────────────────

function SectionCard({ section, dormCount, onEdit, onDelete }) {
    const [confirm, setConfirm] = useState(false)
    const gBadge = GENDER_BADGE[section.gender] || GENDER_BADGE.na

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'var(--background)', border: '1px solid var(--border)', borderRadius: '10px' }}>
            <div className="staff-card-avatar patron" style={{ width: '2.25rem', height: '2.25rem', minWidth: '2.25rem' }}>
                <span className="material-symbols-rounded" style={{ fontSize: '1.1rem' }}>meeting_room</span>
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{section.name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                    {dormCount} dormitor{dormCount === 1 ? 'y' : 'ies'}
                    {section.description && ` · ${section.description}`}
                </div>
            </div>
            {gBadge.label && <span className={`pub-badge ${gBadge.cls}`}>{gBadge.label}</span>}
            {confirm ? (
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Delete?</span>
                    <button className="btn btn-primary btn-sm" onClick={() => onDelete(section.id)}>Yes</button>
                    <button className="btn btn-outline btn-sm" onClick={() => setConfirm(false)}>No</button>
                </div>
            ) : (
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => setConfirm(true)}>
                        <span className="material-symbols-rounded icon-sm">delete</span>
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => onEdit(section)}>
                        <span className="material-symbols-rounded icon-sm">edit</span> Edit
                    </button>
                </div>
            )}
        </div>
    )
}

// ── Facility Modal ────────────────────────────────────────────────────────────

function FacilityModal({ facility, defaultType, sections, onClose, onSave }) {
    const isEditing = !!facility
    const [form, setForm] = useState({
        name:          facility?.name          || '',
        facility_type: facility?.facility_type || defaultType || 'dormitory',
        gender:        facility?.gender        || 'na',
        section:       facility?.section       || '',
        capacity:      facility?.capacity      || '',
        description:   facility?.description   || '',
    })
    const [saving, setSaving] = useState(false)
    const [error,  setError]  = useState(null)

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    function handleChange(e) {
        const { name, value } = e.target
        setForm(prev => ({ ...prev, [name]: value }))
    }

    const typeInfo = FACILITY_TYPES.find(t => t.key === form.facility_type)

    async function handleSave() {
        if (!form.name.trim()) { setError('Name is required.'); return }
        setSaving(true); setError(null)
        try {
            await onSave({
                name:          form.name.trim(),
                facility_type: form.facility_type,
                gender:        typeInfo?.genderRelevant ? form.gender : 'na',
                section:       typeInfo?.genderRelevant ? (form.section || null) : null,
                capacity:      form.capacity ? parseInt(form.capacity) : null,
                description:   form.description,
            })
        } catch { setError('Failed to save. Please try again.') }
        finally   { setSaving(false) }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-rounded" style={{ color: 'var(--discipline, #7c3aed)' }}>
                            {isEditing ? 'edit' : 'add_circle'}
                        </span>
                        <h2 className="modal-title">{isEditing ? 'Edit Facility' : 'Add Facility'}</h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose}><span className="material-symbols-rounded">close</span></button>
                </div>
                <div className="modal-body">
                    <div className="form-group">
                        <label className="form-label">Facility Name *</label>
                        <input className="form-input" name="name" value={form.name} onChange={handleChange} placeholder="e.g. Bisoke" autoFocus />
                    </div>
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">Type *</label>
                            <select className="form-input" name="facility_type" value={form.facility_type} onChange={handleChange} disabled={isEditing}>
                                {FACILITY_TYPES.map(t => (
                                    <option key={t.key} value={t.key}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Capacity</label>
                            <input className="form-input" type="number" name="capacity" value={form.capacity} onChange={handleChange} placeholder="e.g. 60" min="1" />
                        </div>
                    </div>

                    {/* Section + gender — only for dormitories */}
                    {typeInfo?.genderRelevant && (
                        <>
                            {sections.length > 0 && (
                                <div className="form-group">
                                    <label className="form-label">Section</label>
                                    <select className="form-input" name="section" value={form.section || ''} onChange={handleChange}>
                                        <option value="">— No section —</option>
                                        {sections.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="form-group">
                                <label className="form-label">Gender Designation</label>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {GENDER_OPTIONS.filter(g => g.value !== 'na').map(g => (
                                        <label key={g.value} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.875rem', padding: '0.35rem 0.75rem', borderRadius: '6px', border: `1px solid ${form.gender === g.value ? 'var(--primary)' : 'var(--border)'}`, background: form.gender === g.value ? 'var(--primary-light, #ede9fe)' : 'transparent' }}>
                                            <input type="radio" name="gender" value={g.value} checked={form.gender === g.value} onChange={handleChange} style={{ accentColor: 'var(--primary)' }} />
                                            {g.label}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    <div className="form-group">
                        <label className="form-label">Description (optional)</label>
                        <textarea className="form-input form-textarea" name="description" value={form.description} onChange={handleChange} rows="2" placeholder="Brief description or notes…" />
                    </div>
                    {error && <p style={{ color: '#dc2626', fontSize: '0.82rem', margin: 0 }}>{error}</p>}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
                        <span className="material-symbols-rounded">{isEditing ? 'save' : 'add_circle'}</span>
                        {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Facility'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Facility Card ─────────────────────────────────────────────────────────────

function FacilityCard({ facility, sections, onEdit, onDelete }) {
    const [confirmDelete, setConfirmDelete] = useState(false)
    const typeInfo  = FACILITY_TYPES.find(t => t.key === facility.facility_type)
    const gBadge    = GENDER_BADGE[facility.gender] || GENDER_BADGE.na
    const secName   = facility.section_name || null

    return (
        <div className="staff-card">
            <div className="staff-card-top">
                <div className="staff-card-avatar patron">
                    <span className="material-symbols-rounded" style={{ fontSize: '1.2rem' }}>{typeInfo?.icon || 'category'}</span>
                </div>
                <div>
                    <div className="staff-card-name">{facility.name}</div>
                    <div className="staff-card-role">{typeInfo?.label || facility.facility_type}</div>
                </div>
                {gBadge.label && (
                    <span className={`pub-badge ${gBadge.cls} ml-auto`}>{gBadge.label}</span>
                )}
            </div>
            <div className="staff-card-meta">
                {secName && (
                    <span><span className="material-symbols-rounded">meeting_room</span>{secName}</span>
                )}
                {facility.capacity && (
                    <span><span className="material-symbols-rounded">groups</span>Capacity: {facility.capacity}</span>
                )}
                {facility.description && (
                    <span><span className="material-symbols-rounded">notes</span>{facility.description}</span>
                )}
            </div>
            <div className="staff-card-actions">
                {confirmDelete ? (
                    <>
                        <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>Delete?</span>
                        <button className="btn btn-primary btn-sm" onClick={() => onDelete(facility.id)}>Yes</button>
                        <button className="btn btn-outline btn-sm" onClick={() => setConfirmDelete(false)}>No</button>
                    </>
                ) : (
                    <>
                        <button className="btn btn-outline btn-sm" onClick={() => setConfirmDelete(true)}>
                            <span className="material-symbols-rounded icon-sm">delete</span>
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => onEdit(facility)}>
                            <span className="material-symbols-rounded icon-sm">edit</span> Edit
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}

// ── School config helpers ─────────────────────────────────────────────────────

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
            <input className="disc-picker-select flex-1" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handle()} placeholder="e.g. S1" />
            <button className="btn btn-primary btn-sm" onClick={handle}><span className="material-symbols-rounded icon-sm">add</span> Add Year</button>
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
                        <input className="disc-picker-select" style={{ width: '7rem' }} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setEditing(false); setDraft(year.name) } }} autoFocus />
                        <button className="btn btn-primary btn-sm" onClick={commitRename}>Save</button>
                        <button className="btn btn-outline btn-sm" onClick={() => { setEditing(false); setDraft(year.name) }}>Cancel</button>
                    </>
                ) : (
                    <>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{year.name}</span>
                        <button className="btn-icon-clean" onClick={() => setEditing(true)} style={{ color: 'var(--muted-foreground)' }}><span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>edit</span></button>
                        <div style={{ flex: 1 }} />
                        <button className="btn-icon-clean" onClick={onRemove} style={{ color: 'var(--danger)' }}><span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>delete</span></button>
                    </>
                )}
            </div>
            <div className="tag-list" style={{ marginBottom: '0.5rem' }}>
                {year.streams.map(s => (
                    <span key={s} className="tag-chip">{s}<button className="tag-chip-remove" onClick={() => onRemoveStream(s)}><span className="material-symbols-rounded">close</span></button></span>
                ))}
                {year.streams.length === 0 && <span className="tag-chip-empty">No streams yet</span>}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input className="disc-picker-select" style={{ flex: 1, maxWidth: '14rem', fontSize: '0.85rem' }} value={streamInput} onChange={e => setStreamInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddStream()} placeholder="Add stream e.g. A, MPG" />
                <button className="btn btn-outline btn-sm" onClick={handleAddStream}><span className="material-symbols-rounded icon-sm">add</span> Stream</button>
            </div>
        </div>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function DisSettings() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const { config, saveConfig, loading, error } = useSchoolConfig()
    const [activeTab, setActiveTab] = useState('facilities')

    // ── Facilities state ──
    const [facilities,    setFacilities]    = useState([])
    const [sections,      setSections]      = useState([])
    const [facLoading,    setFacLoading]    = useState(false)
    const [facLoaded,     setFacLoaded]     = useState(false)
    const [editingFac,    setEditingFac]    = useState(null)
    const [addingFacType, setAddingFacType] = useState(null)
    const [editingSec,    setEditingSec]    = useState(null)
    const [addingSection, setAddingSection] = useState(false)

    // ── School config state ──
    const [saving, setSaving] = useState(false)
    const [saved,  setSaved]  = useState(false)

    useEffect(() => {
        if (activeTab !== 'facilities' || facLoaded) return
        setFacLoaded(true)
        setFacLoading(true)
        Promise.all([getDisFacilities(), getDisFacilitySections()])
            .then(([facs, secs]) => {
                setFacilities(Array.isArray(facs) ? facs : [])
                setSections(Array.isArray(secs) ? secs : [])
            })
            .catch(console.error)
            .finally(() => setFacLoading(false))
    }, [activeTab, facLoaded])

    // ── Facility CRUD ──
    async function handleCreateFacility(data) {
        const created = await createDisFacility(data)
        setFacilities(prev => [...prev, created])
        setAddingFacType(null)
    }
    async function handleUpdateFacility(id, data) {
        const updated = await patchDisFacility(id, data)
        setFacilities(prev => prev.map(f => f.id === id ? updated : f))
        setEditingFac(null)
    }
    async function handleDeleteFacility(id) {
        await deleteDisFacility(id)
        setFacilities(prev => prev.filter(f => f.id !== id))
    }

    // ── Section CRUD ──
    async function handleCreateSection(data) {
        const created = await createDisFacilitySection(data)
        setSections(prev => [...prev, created])
        setAddingSection(false)
    }
    async function handleUpdateSection(id, data) {
        const updated = await patchDisFacilitySection(id, data)
        setSections(prev => prev.map(s => s.id === id ? updated : s))
        setEditingSec(null)
    }
    async function handleDeleteSection(id) {
        await deleteDisFacilitySection(id)
        setSections(prev => prev.filter(s => s.id !== id))
        // clear section reference from affected dormitories
        setFacilities(prev => prev.map(f => f.section === id ? { ...f, section: null, section_name: null } : f))
    }

    // ── School config CRUD ──
    function addSection(name) {
        if (config.find(s => s.name === name)) return
        saveConfig([...config, { name, years: [] }])
    }
    function removeSection(name) { saveConfig(config.filter(s => s.name !== name)) }
    function addYear(sectionName, yearName) {
        if (!yearName.trim()) return
        const sec = config.find(s => s.name === sectionName)
        if (!sec || sec.years.find(y => y.name === yearName)) return
        saveConfig(config.map(s => s.name === sectionName ? { ...s, years: [...s.years, { name: yearName, streams: [] }] } : s))
    }
    function removeYear(sectionName, yearName) {
        saveConfig(config.map(s => s.name === sectionName ? { ...s, years: s.years.filter(y => y.name !== yearName) } : s))
    }
    function renameYear(sectionName, oldName, newName) {
        if (!newName.trim() || oldName === newName) return
        saveConfig(config.map(s => s.name === sectionName ? { ...s, years: s.years.map(y => y.name === oldName ? { ...y, name: newName } : y) } : s))
    }
    function addStream(sectionName, yearName, stream) {
        if (!stream.trim()) return
        saveConfig(config.map(s => s.name === sectionName
            ? { ...s, years: s.years.map(y => y.name === yearName && !y.streams.includes(stream) ? { ...y, streams: [...y.streams, stream] } : y) }
            : s))
    }
    function removeStream(sectionName, yearName, stream) {
        saveConfig(config.map(s => s.name === sectionName
            ? { ...s, years: s.years.map(y => y.name === yearName ? { ...y, streams: y.streams.filter(st => st !== stream) } : y) }
            : s))
    }
    async function handleSaveConfig() {
        setSaving(true)
        try { await saveConfig(config); setSaved(true); setTimeout(() => setSaved(false), 3000) }
        catch(e) { console.error(e) }
        finally   { setSaving(false) }
    }

    // ── Derived ──
    const totalYears  = (config || []).reduce((sum, sec) => sum + sec.years.length, 0)
    const totalStreams = (config || []).reduce((sum, sec) => sum + sec.years.reduce((s, y) => s + y.streams.length, 0), 0)
    const dormitories = facilities.filter(f => f.facility_type === 'dormitory')
    const diningHalls = facilities.filter(f => f.facility_type === 'dining_hall')
    const otherRooms  = facilities.filter(f => !['dormitory','dining_hall'].includes(f.facility_type))

    // Group dormitories by section
    const dormsBySection = sections.map(sec => ({
        section: sec,
        dorms: dormitories.filter(d => d.section === sec.id),
    }))
    const unsectionedDorms = dormitories.filter(d => !d.section)

    const facStats = [
        { iconClass: 'info',    icon: 'hotel',        value: dormitories.length, label: 'Dormitories'  },
        { iconClass: '',        icon: 'meeting_room',  value: sections.length,    label: 'Sections'     },
        { iconClass: 'success', icon: 'restaurant',   value: diningHalls.length, label: 'Dining Halls' },
        { iconClass: 'warning', icon: 'category',     value: otherRooms.length,  label: 'Other Rooms'  },
    ]

    const showModal = addingFacType || editingFac
    const showSecModal = addingSection || editingSec

    return (
        <>
            {showModal && (
                <FacilityModal
                    facility={editingFac || null}
                    defaultType={addingFacType}
                    sections={sections}
                    onClose={() => { setAddingFacType(null); setEditingFac(null) }}
                    onSave={editingFac
                        ? (data) => handleUpdateFacility(editingFac.id, data)
                        : (data) => handleCreateFacility(data)
                    }
                />
            )}
            {showSecModal && (
                <SectionModal
                    section={editingSec || null}
                    onClose={() => { setAddingSection(false); setEditingSec(null) }}
                    onSave={editingSec
                        ? (data) => handleUpdateSection(editingSec.id, data)
                        : (data) => handleCreateSection(data)
                    }
                />
            )}

            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Settings"
                        subtitle="Configure facilities, school structure and portal defaults"
                        {...disUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>

                        <div className="filter-tabs-bar mb-5">
                            <button className={`filter-tab${activeTab === 'facilities' ? ' active' : ''}`} onClick={() => setActiveTab('facilities')}>
                                <span className="material-symbols-rounded">apartment</span> Facilities
                            </button>
                            <button className={`filter-tab${activeTab === 'structure' ? ' active' : ''}`} onClick={() => setActiveTab('structure')}>
                                <span className="material-symbols-rounded">layers</span> School Structure
                            </button>
                        </div>

                        {/* ── FACILITIES TAB ── */}
                        {activeTab === 'facilities' && (
                            <>
                                {!facLoading && (
                                    <div className="disc-stat-grid mb-1-5">
                                        {facStats.map((s, i) => (
                                            <div key={i} className="disc-stat-card">
                                                <div className={`disc-stat-icon ${s.iconClass}`}><span className="material-symbols-rounded">{s.icon}</span></div>
                                                <div>
                                                    <div className="disc-stat-value">{s.value}</div>
                                                    <div className="disc-stat-label">{s.label}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {facLoading ? (
                                    <p style={{ color: 'var(--muted-foreground)', padding: '2rem 0' }}>Loading facilities…</p>
                                ) : (
                                    <>
                                        {/* ── Dormitory Sections ── */}
                                        <div className="card mb-1-5">
                                            <div className="card-header">
                                                <h2 className="card-title"><span className="material-symbols-rounded">meeting_room</span> Dormitory Sections</h2>
                                                <button className="btn btn-primary btn-sm" onClick={() => setAddingSection(true)}>
                                                    <span className="material-symbols-rounded icon-sm">add</span> Add Section
                                                </button>
                                            </div>
                                            <div className="card-content">
                                                {sections.length === 0 ? (
                                                    <p style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>
                                                        No sections yet. Create sections like "Boys Section" or "Girls Wing" to organise your dormitories.
                                                    </p>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                        {sections.map(sec => (
                                                            <SectionCard
                                                                key={sec.id}
                                                                section={sec}
                                                                dormCount={dormitories.filter(d => d.section === sec.id).length}
                                                                onEdit={setEditingSec}
                                                                onDelete={handleDeleteSection}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* ── Dormitories (grouped by section) ── */}
                                        <div className="card mb-1-5">
                                            <div className="card-header">
                                                <h2 className="card-title"><span className="material-symbols-rounded">hotel</span> Dormitories</h2>
                                                <button className="btn btn-primary btn-sm" onClick={() => setAddingFacType('dormitory')}>
                                                    <span className="material-symbols-rounded icon-sm">add</span> Add Dormitory
                                                </button>
                                            </div>
                                            <div className="card-content">
                                                {dormitories.length === 0 ? (
                                                    <p style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>No dormitories configured yet.</p>
                                                ) : (
                                                    <>
                                                        {/* Grouped by section */}
                                                        {dormsBySection.filter(g => g.dorms.length > 0).map(({ section: sec, dorms }) => (
                                                            <div key={sec.id} style={{ marginBottom: '1rem' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
                                                                    <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{sec.name}</span>
                                                                    {GENDER_BADGE[sec.gender]?.label && (
                                                                        <span className={`pub-badge ${GENDER_BADGE[sec.gender].cls}`} style={{ fontSize: '0.7rem' }}>{GENDER_BADGE[sec.gender].label}</span>
                                                                    )}
                                                                </div>
                                                                <div className="staff-cards-grid">
                                                                    {dorms.map(f => (
                                                                        <FacilityCard key={f.id} facility={f} sections={sections} onEdit={setEditingFac} onDelete={handleDeleteFacility} />
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}

                                                        {/* Unsectioned dormitories */}
                                                        {unsectionedDorms.length > 0 && (
                                                            <div>
                                                                {dormsBySection.some(g => g.dorms.length > 0) && (
                                                                    <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.625rem' }}>No Section</div>
                                                                )}
                                                                <div className="staff-cards-grid">
                                                                    {unsectionedDorms.map(f => (
                                                                        <FacilityCard key={f.id} facility={f} sections={sections} onEdit={setEditingFac} onDelete={handleDeleteFacility} />
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* ── Dining Halls ── */}
                                        <div className="card mb-1-5">
                                            <div className="card-header">
                                                <h2 className="card-title"><span className="material-symbols-rounded">restaurant</span> Dining Halls</h2>
                                                <button className="btn btn-primary btn-sm" onClick={() => setAddingFacType('dining_hall')}>
                                                    <span className="material-symbols-rounded icon-sm">add</span> Add Dining Hall
                                                </button>
                                            </div>
                                            <div className="card-content">
                                                {diningHalls.length === 0 ? (
                                                    <p style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>No dining halls configured yet.</p>
                                                ) : (
                                                    <div className="staff-cards-grid">
                                                        {diningHalls.map(f => (
                                                            <FacilityCard key={f.id} facility={f} sections={sections} onEdit={setEditingFac} onDelete={handleDeleteFacility} />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* ── Other Rooms ── */}
                                        <div className="card">
                                            <div className="card-header">
                                                <h2 className="card-title"><span className="material-symbols-rounded">category</span> Other Rooms &amp; Facilities</h2>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    {['common_room','medical','sports','library','other'].map(type => {
                                                        const t = FACILITY_TYPES.find(x => x.key === type)
                                                        return (
                                                            <button key={type} className="btn btn-outline btn-sm" onClick={() => setAddingFacType(type)} title={`Add ${t?.label}`}>
                                                                <span className="material-symbols-rounded icon-sm">{t?.icon}</span>
                                                            </button>
                                                        )
                                                    })}
                                                    <button className="btn btn-primary btn-sm" onClick={() => setAddingFacType('other')}>
                                                        <span className="material-symbols-rounded icon-sm">add</span> Add Room
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="card-content">
                                                {otherRooms.length === 0 ? (
                                                    <p style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>No other rooms configured yet.</p>
                                                ) : (
                                                    <div className="staff-cards-grid">
                                                        {otherRooms.map(f => (
                                                            <FacilityCard key={f.id} facility={f} sections={sections} onEdit={setEditingFac} onDelete={handleDeleteFacility} />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </>
                        )}

                        {/* ── SCHOOL STRUCTURE TAB ── */}
                        {activeTab === 'structure' && (
                            <>
                                {loading ? (
                                    <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>Loading…</p>
                                ) : error ? (
                                    <p style={{ padding: '2rem', color: 'var(--danger)' }}>Error: {error}</p>
                                ) : (
                                    <>
                                        {(config || []).length > 0 && (
                                            <div className="disc-stat-grid mb-1-5">
                                                {[
                                                    { iconClass: 'info',    icon: 'layers',         label: 'Sections',       value: (config||[]).length },
                                                    { iconClass: 'success', icon: 'calendar_month', label: 'Year Groups',    value: totalYears           },
                                                    { iconClass: 'warning', icon: 'groups',         label: 'Stream Classes', value: totalStreams          },
                                                ].map((s, i) => (
                                                    <div key={i} className="disc-stat-card">
                                                        <div className={`disc-stat-icon ${s.iconClass}`}><span className="material-symbols-rounded">{s.icon}</span></div>
                                                        <div><div className="disc-stat-value">{s.value}</div><div className="disc-stat-label">{s.label}</div></div>
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
                                                    items={(config||[]).map(s => s.name)}
                                                    onAdd={addSection}
                                                    onRemove={removeSection}
                                                    placeholder="e.g. O-Level"
                                                />
                                                {(config||[]).length > 0 && (
                                                    <div className="settings-border-section">
                                                        {(config||[]).map(sec => (
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
                                                                    <YearBlock key={y.name} year={y}
                                                                        onRename={(old, next) => renameYear(sec.name, old, next)}
                                                                        onRemove={() => removeYear(sec.name, y.name)}
                                                                        onAddStream={stream => addStream(sec.name, y.name, stream)}
                                                                        onRemoveStream={stream => removeStream(sec.name, y.name, stream)}
                                                                    />
                                                                ))}
                                                                {sec.years.length === 0 && (
                                                                    <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: '0.5rem' }}>No year groups yet — add one above</p>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="cloud-save-row">
                                                    <button className="btn btn-primary" onClick={handleSaveConfig} disabled={saving}>
                                                        {saved ? 'Saved!' : saving ? 'Saving...' : 'Save to Database'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </>
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
