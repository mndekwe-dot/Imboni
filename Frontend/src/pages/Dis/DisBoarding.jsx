import { useState, useEffect, useRef } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { DataTable } from '../../components/ui/DataTable'
import { disNavItems, disSecondaryItems, disUser } from './disNav'
import {
    getDisBoarding, createDisBoarding, patchDisBoarding, deleteDisBoarding,
    getDisFacilities, getDisStudents,
} from '../../api/discipline'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'
import '../../styles/tables.css'
import { DashboardContent } from '../../components/layout/DashboardContent'

const BOARDING_TYPE_LABEL = {
    full_boarder:   'Full Boarder',
    weekly_boarder: 'Weekly Boarder',
    day_scholar:    'Day Scholar',
}

const BOARDING_TYPE_OPTIONS = [
    { value: 'full_boarder',   label: 'Full Boarder'   },
    { value: 'weekly_boarder', label: 'Weekly Boarder' },
    { value: 'day_scholar',    label: 'Day Scholar'    },
]

// ── Boarding Modal (Add / Edit) ───────────────────────────────────────────────

function BoardingModal({ record, dormitories, onClose, onSave }) {
    const isEditing = !!record

    // Student search (create only)
    const [query,           setQuery]           = useState(record?.student_name || '')
    const [searchResults,   setSearchResults]   = useState([])
    const [selectedStudent, setSelectedStudent] = useState(
        record ? { id: null, name: record.student_name, student_id: record.student_id } : null
    )
    const [searching,    setSearching]    = useState(false)
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const searchRef   = useRef(null)
    const debounceRef = useRef(null)

    const [form, setForm] = useState({
        dormitory:    record?.dormitory     || (dormitories[0]?.name || ''),
        room_number:  record?.room_number   || '',
        bed_number:   record?.bed_number    || '',
        boarding_type:record?.boarding_type || 'full_boarder',
        check_in_date:record?.check_in_date || '',
        notes:        record?.notes         || '',
    })
    const [saving, setSaving] = useState(false)
    const [error,  setError]  = useState(null)

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    useEffect(() => {
        function handler(e) {
            if (searchRef.current && !searchRef.current.contains(e.target)) setDropdownOpen(false)
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    function handleSearch(e) {
        const q = e.target.value
        setQuery(q)
        setSelectedStudent(null)
        clearTimeout(debounceRef.current)
        if (q.length < 2) { setSearchResults([]); setDropdownOpen(false); return }
        debounceRef.current = setTimeout(async () => {
            setSearching(true)
            try {
                const results = await getDisStudents({ search: q })
                setSearchResults(Array.isArray(results) ? results.slice(0, 8) : [])
                setDropdownOpen(true)
            } catch { setSearchResults([]) }
            finally   { setSearching(false) }
        }, 300)
    }

    function selectStudent(s) {
        setSelectedStudent(s)
        setQuery(s.name)
        setDropdownOpen(false)
        setSearchResults([])
    }

    function handleChange(e) {
        const { name, value } = e.target
        setForm(prev => ({ ...prev, [name]: value }))
    }

    async function handleSave() {
        if (!isEditing && !selectedStudent) { setError('Please select a student.'); return }
        if (!form.dormitory)     { setError('Please select a dormitory.');    return }
        if (!form.room_number)   { setError('Room number is required.');      return }
        if (!form.check_in_date) { setError('Check-in date is required.');    return }
        setSaving(true); setError(null)
        try {
            const data = {
                dormitory:     form.dormitory,
                room_number:   form.room_number,
                bed_number:    form.bed_number,
                boarding_type: form.boarding_type,
                check_in_date: form.check_in_date,
                notes:         form.notes,
            }
            if (!isEditing) data.student_id = selectedStudent.id
            await onSave(data)
        } catch(e) {
            setError(e?.response?.data?.error || 'Failed to save. Please try again.')
        } finally { setSaving(false) }
    }

    const cls = selectedStudent
        ? `${selectedStudent.grade || ''}${selectedStudent.section || ''}`
        : record ? `${record.grade || ''}${record.section || ''}` : ''

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-rounded" style={{ color: 'var(--discipline, #7c3aed)' }}>
                            {isEditing ? 'edit' : 'hotel'}
                        </span>
                        <h2 className="modal-title">{isEditing ? 'Edit Boarding Record' : 'Assign to Boarding'}</h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose}><span className="material-symbols-rounded">close</span></button>
                </div>

                <div className="modal-body">

                    {/* Student selector */}
                    {isEditing ? (
                        <div className="form-group">
                            <label className="form-label">Student</label>
                            <div style={{ padding: '0.5rem 0.75rem', background: 'var(--muted)', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600 }}>
                                {record.student_name}
                                {cls && <span className="class-chip" style={{ marginLeft: '0.5rem', fontSize: '0.72rem' }}>{cls}</span>}
                            </div>
                        </div>
                    ) : (
                        <div className="form-group" ref={searchRef} style={{ position: 'relative' }}>
                            <label className="form-label">Student *</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    className="form-input"
                                    value={query}
                                    onChange={handleSearch}
                                    placeholder="Search by name or ADM number…"
                                    autoComplete="off"
                                />
                                {searching && (
                                    <span className="material-symbols-rounded" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1rem', color: 'var(--muted-foreground)' }}>
                                        progress_activity
                                    </span>
                                )}
                            </div>
                            {dropdownOpen && searchResults.length > 0 && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: '220px', overflowY: 'auto', marginTop: '2px' }}>
                                    {searchResults.map(s => (
                                        <div key={s.id} onClick={() => selectStudent(s)}
                                            style={{ padding: '0.625rem 0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.625rem', borderBottom: '1px solid var(--border)' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--muted)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>
                                                {s.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{s.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{s.student_id} · {s.grade}{s.section}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {selectedStudent && (
                                <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: '#15803d', fontWeight: 600 }}>
                                    ✓ {selectedStudent.name} — {selectedStudent.student_id}
                                    {cls && <span className="class-chip" style={{ marginLeft: '0.4rem', fontSize: '0.7rem' }}>{cls}</span>}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Dormitory + boarding type */}
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">Dormitory *</label>
                            <select className="form-input" name="dormitory" value={form.dormitory} onChange={handleChange}>
                                <option value="">— Select dormitory —</option>
                                {dormitories.length > 0 ? (() => {
                                    // Group by section_name; fall back to flat list if no sections
                                    const sectionNames = [...new Set(dormitories.map(d => d.section_name).filter(Boolean))]
                                    const grouped      = dormitories.filter(d => d.section_name)
                                    const ungrouped    = dormitories.filter(d => !d.section_name)
                                    if (sectionNames.length === 0) {
                                        return dormitories.map(d => (
                                            <option key={d.id} value={d.name}>{d.name}{d.capacity ? ` (cap. ${d.capacity})` : ''}</option>
                                        ))
                                    }
                                    return (
                                        <>
                                            {sectionNames.map(sec => (
                                                <optgroup key={sec} label={sec}>
                                                    {dormitories.filter(d => d.section_name === sec).map(d => (
                                                        <option key={d.id} value={d.name}>{d.name}{d.capacity ? ` (cap. ${d.capacity})` : ''}</option>
                                                    ))}
                                                </optgroup>
                                            ))}
                                            {ungrouped.map(d => (
                                                <option key={d.id} value={d.name}>{d.name}{d.capacity ? ` (cap. ${d.capacity})` : ''}</option>
                                            ))}
                                        </>
                                    )
                                })() : (
                                    <option value="" disabled>No dormitories configured — add them in Settings</option>
                                )}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Boarding Type *</label>
                            <select className="form-input" name="boarding_type" value={form.boarding_type} onChange={handleChange}>
                                {BOARDING_TYPE_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Room + bed */}
                    <div className="form-row-2">
                        <div className="form-group">
                            <label className="form-label">Room Number *</label>
                            <input className="form-input" name="room_number" value={form.room_number} onChange={handleChange} placeholder="e.g. 12A" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Bed Number</label>
                            <input className="form-input" name="bed_number" value={form.bed_number} onChange={handleChange} placeholder="e.g. 3" />
                        </div>
                    </div>

                    {/* Check-in date */}
                    <div className="form-group">
                        <label className="form-label">Check-in Date *</label>
                        <input className="form-input" type="date" name="check_in_date" value={form.check_in_date} onChange={handleChange} />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Notes (optional)</label>
                        <input className="form-input" name="notes" value={form.notes} onChange={handleChange} placeholder="Any relevant notes…" />
                    </div>

                    {error && <p style={{ color: '#dc2626', fontSize: '0.82rem', margin: 0 }}>{error}</p>}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving || (!isEditing && !selectedStudent)}>
                        <span className="material-symbols-rounded">{isEditing ? 'save' : 'hotel'}</span>
                        {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Assign'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Boarding Row ──────────────────────────────────────────────────────────────

function BoardingRow({ record, dormSectionMap, onEdit, onDelete }) {
    const [confirmDelete, setConfirmDelete] = useState(false)
    const { student_name, student_id, grade, section, dormitory, room_number, bed_number, boarding_type, check_in_date } = record
    const cls         = `${grade || ''}${section || ''}`
    const sectionName = dormSectionMap?.[dormitory] || null

    return (
        <tr>
            <td><strong>{student_name}</strong></td>
            <td><span className="class-chip">{cls}</span></td>
            <td className="text-muted">{student_id}</td>
            <td>
                <span className="disc-badge">{dormitory}</span>
                {sectionName && <div style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>{sectionName}</div>}
            </td>
            <td className="text-muted">Room {room_number}{bed_number ? ` · Bed ${bed_number}` : ''}</td>
            <td>{BOARDING_TYPE_LABEL[boarding_type] || boarding_type}</td>
            <td className="text-muted">{check_in_date || '—'}</td>
            <td className="action-cell">
                {confirmDelete ? (
                    <>
                        <span className="remove-confirm-text">Remove?</span>
                        <button className="btn btn-primary btn-sm" onClick={() => onDelete(record.id)}>Yes</button>
                        <button className="btn btn-outline btn-sm" onClick={() => setConfirmDelete(false)}>No</button>
                    </>
                ) : (
                    <>
                        <button className="btn btn-outline btn-sm" onClick={() => onEdit(record)}>
                            <span className="material-symbols-rounded icon-sm">edit</span>
                        </button>
                        <button className="btn btn-outline btn-sm" style={{ color: '#dc2626', borderColor: '#dc2626' }} onClick={() => setConfirmDelete(true)}>
                            <span className="material-symbols-rounded icon-sm">delete</span>
                        </button>
                    </>
                )}
            </td>
        </tr>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function DisBoarding() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [students,     setStudents]     = useState([])
    const [dormitories,  setDormitories]  = useState([])
    const [loading,      setLoading]      = useState(true)
    const [filter,       setFilter]       = useState('all')
    const [showModal,    setShowModal]    = useState(false)
    const [editingRecord,setEditingRecord]= useState(null)

    useEffect(() => {
        Promise.all([
            getDisBoarding(),
            getDisFacilities({ type: 'dormitory' }),
        ]).then(([boarding, dorms]) => {
            setStudents(Array.isArray(boarding) ? boarding : [])
            setDormitories(Array.isArray(dorms) ? dorms : [])
        }).catch(console.error).finally(() => setLoading(false))
    }, [])

    // Section-grouped filter data
    const sectionNames  = [...new Set(dormitories.map(d => d.section_name).filter(Boolean))]
    const sectionGroups = sectionNames.map(sec => ({
        name:  sec,
        dorms: dormitories.filter(d => d.section_name === sec),
    }))
    const unsectionedDorms = dormitories.filter(d => !d.section_name)

    // Fallback flat names when no facility data
    const fallbackNames = dormitories.length === 0
        ? [...new Set(students.map(s => s.dormitory).filter(Boolean))].sort()
        : []

    // Map: dormitory name → section name (for table display)
    const dormSectionMap = Object.fromEntries(
        dormitories.filter(d => d.section_name).map(d => [d.name, d.section_name])
    )

    const visible = filter === 'all'
        ? students
        : students.filter(s => s.dormitory === filter)

    const stats = [
        { iconClass: 'info',    icon: 'home',            value: students.filter(s => s.boarding_type === 'full_boarder').length,   label: 'Full Boarders'   },
        { iconClass: 'warning', icon: 'weekend',         value: students.filter(s => s.boarding_type === 'weekly_boarder').length, label: 'Weekly Boarders' },
        { iconClass: 'success', icon: 'directions_walk', value: students.filter(s => s.boarding_type === 'day_scholar').length,    label: 'Day Scholars'    },
        { iconClass: '',        icon: 'groups',          value: students.length,                                                   label: 'Total Students'  },
    ]

    async function handleCreate(data) {
        const created = await createDisBoarding(data)
        setStudents(prev => [created, ...prev])
        setShowModal(false)
    }

    async function handleUpdate(data) {
        const updated = await patchDisBoarding(editingRecord.id, data)
        setStudents(prev => prev.map(s => s.id === editingRecord.id ? updated : s))
        setEditingRecord(null)
    }

    async function handleDelete(id) {
        await deleteDisBoarding(id)
        setStudents(prev => prev.filter(s => s.id !== id))
    }

    return (
        <>
            {(showModal || editingRecord) && (
                <BoardingModal
                    record={editingRecord || null}
                    dormitories={dormitories}
                    onClose={() => { setShowModal(false); setEditingRecord(null) }}
                    onSave={editingRecord ? handleUpdate : handleCreate}
                />
            )}

            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title="Boarding" subtitle="Dormitory assignments and boarding records" {...disUser} notifications={liveNotifications} onNotificationRead={markRead} />

                    <DashboardContent>

                        <div className="disc-stat-grid">
                            {stats.map((s, i) => (
                                <div key={i} className="disc-stat-card">
                                    <div className={`disc-stat-icon ${s.iconClass}`}><span className="material-symbols-rounded">{s.icon}</span></div>
                                    <div>
                                        <div className="disc-stat-value">{loading ? '—' : s.value}</div>
                                        <div className="disc-stat-label">{s.label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="card mb-1-5">
                            <div className="card-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                                <select
                                    className="form-input"
                                    style={{ maxWidth: '260px' }}
                                    value={filter}
                                    onChange={e => setFilter(e.target.value)}
                                >
                                    <option value="all">All Dormitories</option>
                                    {sectionGroups.map(({ name: secName, dorms }) => (
                                        <optgroup key={secName} label={secName}>
                                            {dorms.map(d => (
                                                <option key={d.name} value={d.name}>{d.name}{d.capacity ? ` (cap. ${d.capacity})` : ''}</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                    {unsectionedDorms.map(d => (
                                        <option key={d.name} value={d.name}>{d.name}{d.capacity ? ` (cap. ${d.capacity})` : ''}</option>
                                    ))}
                                    {fallbackNames.map(n => (
                                        <option key={n} value={n}>{n}</option>
                                    ))}
                                </select>

                                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                                    <span className="material-symbols-rounded">add</span> Assign to Boarding
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <p style={{ padding: '2rem', color: 'var(--muted-foreground)' }}>Loading boarding records…</p>
                        ) : (
                            <DataTable
                                title="Boarding Students"
                                data={visible}
                                columns={['Student', 'Class', 'Student ID', 'Dormitory', 'Room / Bed', 'Type', 'Check-in', 'Actions']}
                                renderRow={(r, i) => (
                                    <BoardingRow
                                        key={r.id || i}
                                        record={r}
                                        dormSectionMap={dormSectionMap}
                                        onEdit={setEditingRecord}
                                        onDelete={handleDelete}
                                    />
                                )}
                                emptyIcon="hotel"
                                emptyTitle="No boarding records"
                                emptyDesc={filter === 'all' ? 'No boarding records on file.' : `No students in ${filter}.`}
                                onClearFilters={filter !== 'all' ? () => setFilter('all') : undefined}
                            />
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
