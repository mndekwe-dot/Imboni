import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { TabGroup } from '../../components/ui/TabGroup'
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
import { StatCard } from '../../components/layout/StatCard'

// ── Constants ─────────────────────────────────────────────────────────────────

const FACILITY_TYPES = [
    { key: 'dormitory',   labelKey: 'dis.settings.typeDormitory',  icon: 'hotel',            genderRelevant: true  },
    { key: 'dining_hall', labelKey: 'dis.settings.typeDiningHall', icon: 'restaurant',       genderRelevant: false },
    { key: 'common_room', labelKey: 'dis.settings.typeCommonRoom', icon: 'living',           genderRelevant: false },
    { key: 'medical',     labelKey: 'dis.settings.typeMedical',    icon: 'medical_services', genderRelevant: false },
    { key: 'sports',      labelKey: 'dis.settings.typeSports',     icon: 'sports_soccer',    genderRelevant: false },
    { key: 'library',     labelKey: 'dis.settings.typeLibrary',    icon: 'menu_book',        genderRelevant: false },
    { key: 'other',       labelKey: 'dis.settings.typeOther',      icon: 'category',         genderRelevant: false },
]

const GENDER_OPTIONS = [
    { value: 'boys',  labelKey: 'dis.settings.genderBoys'  },
    { value: 'girls', labelKey: 'dis.settings.genderGirls' },
    { value: 'mixed', labelKey: 'dis.settings.genderMixed' },
    { value: 'na',    labelKey: 'dis.settings.genderNa'    },
]

// The badge shows a shorter word than the form option ('Mixed', not
// 'Mixed / Shared'), and 'na' deliberately has no badge at all.
const GENDER_BADGE = {
    boys:  { cls: 'info',    labelKey: 'dis.settings.genderBoys'       },
    girls: { cls: 'warning', labelKey: 'dis.settings.genderGirls'      },
    mixed: { cls: 'success', labelKey: 'dis.settings.genderMixedShort' },
    na:    { cls: '',        labelKey: null                            },
}

// ── Section Modal ─────────────────────────────────────────────────────────────

function SectionModal({ section, onClose, onSave }) {
    const { t } = useTranslation()
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
        if (!form.name.trim()) { setError(t('dis.settings.sectionNameMissing')); return }
        setSaving(true); setError(null)
        try {
            await onSave({ name: form.name.trim(), gender: form.gender, description: form.description })
        } catch { setError(t('common.genericSaveFailed')) }
        finally   { setSaving(false) }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-rounded disc-modal-icon" aria-hidden="true">
                            {isEditing ? 'edit' : 'add_circle'}
                        </span>
                        <h2 className="modal-title">{isEditing ? t('dis.settings.editSection') : t('dis.settings.addSection')}</h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose} aria-label={t('common.close')}><span className="material-symbols-rounded" aria-hidden="true">close</span></button>
                </div>
                <div className="modal-body">
                    <div className="form-group">
                        <label className="form-label">{t('dis.settings.sectionNameRequired')}</label>
                        <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                            placeholder={t('dis.settings.sectionNamePlaceholder')} autoFocus />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('dis.settings.gender')}</label>
                        <div className="disc-gender-options">
                            {GENDER_OPTIONS.map(g => (
                                <label key={g.value} className={`disc-gender-opt${form.gender === g.value ? ' active' : ''}`}>
                                    <input type="radio" value={g.value} checked={form.gender === g.value} onChange={() => setForm(p => ({ ...p, gender: g.value }))} className="disc-gender-radio" />
                                    {t(g.labelKey)}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('dis.settings.descriptionOptional')}</label>
                        <textarea className="form-input form-textarea" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows="2" placeholder={t('dis.settings.descriptionPlaceholder')} />
                    </div>
                    {error && <p className="form-error-text">{error}</p>}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
                        <span className="material-symbols-rounded" aria-hidden="true">{isEditing ? 'save' : 'add_circle'}</span>
                        {saving ? t('common.saving') : isEditing ? t('common.saveChanges') : t('dis.settings.addSection')}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Section Card ──────────────────────────────────────────────────────────────

function SectionCard({ section, dormCount, onEdit, onDelete }) {
    const { t } = useTranslation()
    const [confirm, setConfirm] = useState(false)
    const gBadge = GENDER_BADGE[section.gender] || GENDER_BADGE.na

    return (
        <div className="disc-section-row">
            <div className="staff-card-avatar patron disc-avatar-sm">
                <span className="material-symbols-rounded u-lg" aria-hidden="true">meeting_room</span>
            </div>
            <div className="disc-fill">
                <div className="disc-row-title">{section.name}</div>
                <div className="u-xs u-muted">
                    {t('dis.settings.dormCount', { count: dormCount })}
                    {section.description && ` · ${section.description}`}
                </div>
            </div>
            {gBadge.labelKey && <span className={`pub-badge ${gBadge.cls}`}>{t(gBadge.labelKey)}</span>}
            {confirm ? (
                <div className="disc-confirm-row">
                    <span className="text-xs-muted">{t('common.deleteConfirm')}</span>
                    <button className="btn btn-primary btn-sm" onClick={() => onDelete(section.id)}>{t('common.yes')}</button>
                    <button className="btn btn-outline btn-sm" onClick={() => setConfirm(false)}>{t('common.no')}</button>
                </div>
            ) : (
                <div className="disc-btn-row">
                    <button className="btn btn-outline btn-sm" onClick={() => setConfirm(true)} aria-label={t('common.delete')}>
                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">delete</span>
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => onEdit(section)}>
                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">edit</span> {t('common.edit')}
                    </button>
                </div>
            )}
        </div>
    )
}

// ── Facility Modal ────────────────────────────────────────────────────────────

function FacilityModal({ facility, defaultType, sections, onClose, onSave }) {
    const { t } = useTranslation()
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

    const typeInfo = FACILITY_TYPES.find(ft => ft.key === form.facility_type)

    async function handleSave() {
        if (!form.name.trim()) { setError(t('dis.settings.nameRequired')); return }
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
        } catch { setError(t('common.genericSaveFailed')) }
        finally   { setSaving(false) }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-rounded disc-modal-icon" aria-hidden="true">
                            {isEditing ? 'edit' : 'add_circle'}
                        </span>
                        <h2 className="modal-title">{isEditing ? t('dis.settings.editFacility') : t('dis.settings.addFacility')}</h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose} aria-label={t('common.close')}><span className="material-symbols-rounded" aria-hidden="true">close</span></button>
                </div>
                <div className="modal-body">
                    <div className="form-group">
                        <label className="form-label">{t('dis.settings.facilityNameRequired')}</label>
                        <input className="form-input" name="name" value={form.name} onChange={handleChange} placeholder={t('dis.settings.facilityNamePlaceholder')} autoFocus />
                    </div>
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">{t('dis.settings.typeRequired')}</label>
                            <select className="form-input" name="facility_type" value={form.facility_type} onChange={handleChange} disabled={isEditing}>
                                {FACILITY_TYPES.map(ft => (
                                    <option key={ft.key} value={ft.key}>{t(ft.labelKey)}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('dis.settings.capacity')}</label>
                            <input className="form-input" type="number" name="capacity" value={form.capacity} onChange={handleChange} placeholder={t('dis.settings.capacityPlaceholder')} min="1" />
                        </div>
                    </div>

                    {/* Section + gender — only for dormitories */}
                    {typeInfo?.genderRelevant && (
                        <>
                            {sections.length > 0 && (
                                <div className="form-group">
                                    <label className="form-label">{t('common.section')}</label>
                                    <select className="form-input" name="section" value={form.section || ''} onChange={handleChange}>
                                        <option value="">{t('dis.settings.noSection')}</option>
                                        {sections.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="form-group">
                                <label className="form-label">{t('dis.settings.genderDesignation')}</label>
                                <div className="disc-gender-options">
                                    {GENDER_OPTIONS.filter(g => g.value !== 'na').map(g => (
                                        <label key={g.value} className={`disc-gender-opt${form.gender === g.value ? ' active' : ''}`}>
                                            <input type="radio" name="gender" value={g.value} checked={form.gender === g.value} onChange={handleChange} className="disc-gender-radio" />
                                            {t(g.labelKey)}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    <div className="form-group">
                        <label className="form-label">{t('dis.settings.descriptionOptional')}</label>
                        <textarea className="form-input form-textarea" name="description" value={form.description} onChange={handleChange} rows="2" placeholder={t('dis.settings.facilityDescPlaceholder')} />
                    </div>
                    {error && <p className="form-error-text">{error}</p>}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.name.trim()}>
                        <span className="material-symbols-rounded" aria-hidden="true">{isEditing ? 'save' : 'add_circle'}</span>
                        {saving ? t('common.saving') : isEditing ? t('common.saveChanges') : t('dis.settings.addFacility')}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Facility Card ─────────────────────────────────────────────────────────────

function FacilityCard({ facility, sections, onEdit, onDelete }) {
    const { t } = useTranslation()
    const [confirmDelete, setConfirmDelete] = useState(false)
    const typeInfo  = FACILITY_TYPES.find(ft => ft.key === facility.facility_type)
    const gBadge    = GENDER_BADGE[facility.gender] || GENDER_BADGE.na
    const secName   = facility.section_name || null

    return (
        <div className="staff-card">
            <div className="staff-card-top">
                <div className="staff-card-avatar patron">
                    <span className="material-symbols-rounded disc-facility-icon" aria-hidden="true">{typeInfo?.icon || 'category'}</span>
                </div>
                <div>
                    <div className="staff-card-name">{facility.name}</div>
                    <div className="staff-card-role">{typeInfo ? t(typeInfo.labelKey) : facility.facility_type}</div>
                </div>
                {gBadge.labelKey && (
                    <span className={`pub-badge ${gBadge.cls} ml-auto`}>{t(gBadge.labelKey)}</span>
                )}
            </div>
            <div className="staff-card-meta">
                {secName && (
                    <span><span className="material-symbols-rounded" aria-hidden="true">meeting_room</span>{secName}</span>
                )}
                {facility.capacity && (
                    <span><span className="material-symbols-rounded" aria-hidden="true">groups</span>{t('dis.settings.capacityLabel', { count: facility.capacity })}</span>
                )}
                {facility.description && (
                    <span><span className="material-symbols-rounded" aria-hidden="true">notes</span>{facility.description}</span>
                )}
            </div>
            <div className="staff-card-actions">
                {confirmDelete ? (
                    <>
                        <span className="u-xs u-muted">{t('common.deleteConfirm')}</span>
                        <button className="btn btn-primary btn-sm" onClick={() => onDelete(facility.id)}>{t('common.yes')}</button>
                        <button className="btn btn-outline btn-sm" onClick={() => setConfirmDelete(false)}>{t('common.no')}</button>
                    </>
                ) : (
                    <>
                        <button className="btn btn-outline btn-sm" onClick={() => setConfirmDelete(true)} aria-label={t('common.delete')}>
                            <span className="material-symbols-rounded icon-sm" aria-hidden="true">delete</span>
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => onEdit(facility)}>
                            <span className="material-symbols-rounded icon-sm" aria-hidden="true">edit</span> {t('common.edit')}
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
        { iconClass: 'info',    icon: 'hotel',        value: dormitories.length, label: t('dis.settings.dormitories')    },
        { iconClass: '',        icon: 'meeting_room', value: sections.length,    label: t('dis.settings.statSections')   },
        { iconClass: 'success', icon: 'restaurant',   value: diningHalls.length, label: t('dis.settings.diningHalls')    },
        { iconClass: 'warning', icon: 'category',     value: otherRooms.length,  label: t('dis.settings.statOtherRooms') },
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

            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
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

                        {/* Tabs switch a panel, so this is <TabGroup>. It was
                            built from .filter-tab chips — the control the app
                            uses for narrowing a list in place. */}
                        <TabGroup
                            tabs={[
                                { key: 'facilities', label: t('dis.settings.tabFacilities'), icon: 'apartment' },
                                { key: 'structure',  label: t('dis.settings.tabStructure'),  icon: 'layers'    },
                            ]}
                            value={activeTab}
                            onChange={setActiveTab}
                            label={t('nav.settings')}
                            idPrefix="dis-settings-"
                        />

                        {/* ── FACILITIES TAB ── */}
                        {activeTab === 'facilities' && (
                            <>
                                {!facLoading && (
                                    <div className="portal-stat-grid mb-1-5">
                                        {facStats.map((s, i) => (
                                            <StatCard key={i} icon={s.icon} value={s.value} label={s.label} colorClass={s.iconClass} />
                                        ))}
                                    </div>
                                )}

                                {facLoading ? (
                                    <p className="disc-loading-text">{t('dis.settings.loadingFacilities')}</p>
                                ) : (
                                    <>
                                        {/* ── Dormitory Sections ── */}
                                        <div className="card mb-1-5">
                                            <div className="card-header">
                                                <h2 className="card-title"><span className="material-symbols-rounded" aria-hidden="true">meeting_room</span> {t('dis.settings.dormitorySections')}</h2>
                                                <button className="btn btn-primary btn-sm" onClick={() => setAddingSection(true)}>
                                                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span> {t('dis.settings.addSection')}
                                                </button>
                                            </div>
                                            <div className="card-content">
                                                {sections.length === 0 ? (
                                                    <p className="disc-empty-text">
                                                        {t('dis.settings.noSections')}
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
                                                <h2 className="card-title"><span className="material-symbols-rounded" aria-hidden="true">hotel</span> {t('dis.settings.dormitories')}</h2>
                                                <button className="btn btn-primary btn-sm" onClick={() => setAddingFacType('dormitory')}>
                                                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span> {t('dis.settings.addDormitory')}
                                                </button>
                                            </div>
                                            <div className="card-content">
                                                {dormitories.length === 0 ? (
                                                    <p className="disc-empty-text">{t('dis.settings.noDormitories')}</p>
                                                ) : (
                                                    <>
                                                        {/* Grouped by section */}
                                                        {dormsBySection.filter(g => g.dorms.length > 0).map(({ section: sec, dorms }) => (
                                                            <div key={sec.id} className="u-mb">
                                                                <div className="u-row-sm disc-mb-mid">
                                                                    <span className="disc-group-label">{sec.name}</span>
                                                                    {GENDER_BADGE[sec.gender]?.labelKey && (
                                                                        <span className={`pub-badge ${GENDER_BADGE[sec.gender].cls} disc-badge-xs`}>{t(GENDER_BADGE[sec.gender].labelKey)}</span>
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
                                                                    <div className="disc-group-label disc-mb-mid">{t('dis.settings.noSectionGroup')}</div>
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
                                                <h2 className="card-title"><span className="material-symbols-rounded" aria-hidden="true">restaurant</span> {t('dis.settings.diningHalls')}</h2>
                                                <button className="btn btn-primary btn-sm" onClick={() => setAddingFacType('dining_hall')}>
                                                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span> {t('dis.settings.addDiningHall')}
                                                </button>
                                            </div>
                                            <div className="card-content">
                                                {diningHalls.length === 0 ? (
                                                    <p className="disc-empty-text">{t('dis.settings.noDiningHalls')}</p>
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
                                                <h2 className="card-title"><span className="material-symbols-rounded" aria-hidden="true">category</span> {t('dis.settings.otherRooms')}</h2>
                                                <div className="disc-btn-inline-group">
                                                    {['common_room','medical','sports','library','other'].map(type => {
                                                        const ft = FACILITY_TYPES.find(x => x.key === type)
                                                        return (
                                                            <button key={type} className="btn btn-outline btn-sm" onClick={() => setAddingFacType(type)}
                                                                title={t('dis.settings.addType', { type: ft ? t(ft.labelKey) : type })}>
                                                                <span className="material-symbols-rounded icon-sm" aria-hidden="true">{ft?.icon}</span>
                                                            </button>
                                                        )
                                                    })}
                                                    <button className="btn btn-primary btn-sm" onClick={() => setAddingFacType('other')}>
                                                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span> {t('dis.settings.addRoom')}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="card-content">
                                                {otherRooms.length === 0 ? (
                                                    <p className="disc-empty-text">{t('dis.settings.noOtherRooms')}</p>
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
                                    <p className="u-pad u-muted">{t('common.loading')}</p>
                                ) : error ? (
                                    <p className="u-pad disc-danger">{t('common.errorPrefix')}: {error}</p>
                                ) : (
                                    <>
                                        {(config || []).length > 0 && (
                                            <div className="portal-stat-grid mb-1-5">
                                                {[
                                                    { iconClass: 'info',    icon: 'layers',         label: t('common.sections'),      value: (config||[]).length },
                                                    { iconClass: 'success', icon: 'calendar_month', label: t('common.yearGroups'),    value: totalYears          },
                                                    { iconClass: 'warning', icon: 'groups',         label: t('common.streamClasses'), value: totalStreams        },
                                                ].map((s, i) => (
                                                    <StatCard key={i} icon={s.icon} value={s.value} label={s.label} colorClass={s.iconClass} />
                                                ))}
                                            </div>
                                        )}

                                        <div className="card">
                                            <div className="card-header">
                                                <h2 className="card-title">{t('dis.settings.structureTitle')}</h2>
                                                <span className="settings-info-text">{t('dis.settings.structureHint')}</span>
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
