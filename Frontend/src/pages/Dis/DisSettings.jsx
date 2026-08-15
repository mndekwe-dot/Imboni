import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import { SchoolStructureEditor } from '../../components/settings/SchoolStructureEditor'
import {
    getDisFacilities, createDisFacility, patchDisFacility, deleteDisFacility,
    getDisFacilitySections, createDisFacilitySection, patchDisFacilitySection, deleteDisFacilitySection,
} from '../../api/discipline'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'
import { disNavItems, disSecondaryItems } from './disNav'

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
                        <span className="material-symbols-rounded disc-modal-icon">
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
                        <div className="disc-gender-options">
                            {GENDER_OPTIONS.map(g => (
                                <label key={g.value} className={`disc-gender-opt${form.gender === g.value ? ' active' : ''}`}>
                                    <input type="radio" value={g.value} checked={form.gender === g.value} onChange={() => setForm(p => ({ ...p, gender: g.value }))} className="disc-gender-radio" />
                                    {g.label}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Description (optional)</label>
                        <textarea className="form-input form-textarea" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows="2" placeholder="Brief description…" />
                    </div>
                    {error && <p className="form-error-text">{error}</p>}
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
        <div className="disc-section-row">
            <div className="staff-card-avatar patron disc-avatar-sm">
                <span className="material-symbols-rounded u-lg">meeting_room</span>
            </div>
            <div className="disc-fill">
                <div className="disc-row-title">{section.name}</div>
                <div className="u-xs u-muted">
                    {dormCount} dormitor{dormCount === 1 ? 'y' : 'ies'}
                    {section.description && ` · ${section.description}`}
                </div>
            </div>
            {gBadge.label && <span className={`pub-badge ${gBadge.cls}`}>{gBadge.label}</span>}
            {confirm ? (
                <div className="disc-confirm-row">
                    <span className="text-xs-muted">Delete?</span>
                    <button className="btn btn-primary btn-sm" onClick={() => onDelete(section.id)}>Yes</button>
                    <button className="btn btn-outline btn-sm" onClick={() => setConfirm(false)}>No</button>
                </div>
            ) : (
                <div className="disc-btn-row">
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
                        <span className="material-symbols-rounded disc-modal-icon">
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
                                        <option value="">No section</option>
                                        {sections.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="form-group">
                                <label className="form-label">Gender Designation</label>
                                <div className="disc-gender-options">
                                    {GENDER_OPTIONS.filter(g => g.value !== 'na').map(g => (
                                        <label key={g.value} className={`disc-gender-opt${form.gender === g.value ? ' active' : ''}`}>
                                            <input type="radio" name="gender" value={g.value} checked={form.gender === g.value} onChange={handleChange} className="disc-gender-radio" />
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
                    {error && <p className="form-error-text">{error}</p>}
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
                    <span className="material-symbols-rounded disc-facility-icon">{typeInfo?.icon || 'category'}</span>
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
                        <span className="u-xs u-muted">Delete?</span>
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export function DisSettings() {
    const { t } = useTranslation()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const sessionUser = useSessionUser()
    const { config, loading, error } = useSchoolConfig()
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
                        title={t('nav.settings')}
                        subtitle={t('dis.settings.subtitle')}
                        {...sessionUser}
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
                                    <p className="disc-loading-text">Loading facilities…</p>
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
                                                    <p className="disc-empty-text">
                                                        No sections yet. Create sections like "Boys Section" or "Girls Wing" to organise your dormitories.
                                                    </p>
                                                ) : (
                                                    <div className="disc-col-sm">
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
                                                    <p className="disc-empty-text">No dormitories configured yet.</p>
                                                ) : (
                                                    <>
                                                        {/* Grouped by section */}
                                                        {dormsBySection.filter(g => g.dorms.length > 0).map(({ section: sec, dorms }) => (
                                                            <div key={sec.id} className="u-mb">
                                                                <div className="u-row-sm disc-mb-mid">
                                                                    <span className="disc-group-label">{sec.name}</span>
                                                                    {GENDER_BADGE[sec.gender]?.label && (
                                                                        <span className={`pub-badge ${GENDER_BADGE[sec.gender].cls} disc-badge-xs`}>{GENDER_BADGE[sec.gender].label}</span>
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
                                                                    <div className="disc-group-label disc-mb-mid">No Section</div>
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
                                                    <p className="disc-empty-text">No dining halls configured yet.</p>
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
                                                <div className="disc-btn-inline-group">
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
                                                    <p className="disc-empty-text">No other rooms configured yet.</p>
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
                                    <p className="u-pad u-muted">Loading…</p>
                                ) : error ? (
                                    <p className="u-pad disc-danger">Error: {error}</p>
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
                                                <SchoolStructureEditor showStats={false} />
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
