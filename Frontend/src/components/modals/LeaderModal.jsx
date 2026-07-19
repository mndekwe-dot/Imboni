import { useState, useEffect, useRef } from 'react'
import { getDisStudents } from '../../api/discipline'
import '../../styles/components.css'

const ROLE_OPTIONS = [
    { value: 'head_boy',        label: 'Head Boy'         },
    { value: 'head_girl',       label: 'Head Girl'        },
    { value: 'deputy_head_boy', label: 'Deputy Head Boy'  },
    { value: 'deputy_head_girl',label: 'Deputy Head Girl' },
    { value: 'prefect',         label: 'Prefect'          },
    { value: 'class_captain',   label: 'Class Captain'    },
    { value: 'games_captain',   label: 'Games Captain'    },
]

export function LeaderModal({ leader, onClose, onSave }) {
    const isEditing = !!leader

    const [role,          setRole]          = useState(leader?.role          || 'prefect')
    const [appointedDate, setAppointedDate] = useState(leader?.appointed_date || '')
    const [notes,         setNotes]         = useState(leader?.notes          || '')
    const [saving,        setSaving]        = useState(false)
    const [error,         setError]         = useState(null)

    // Student search state (only for create)
    const [query,          setQuery]          = useState(leader?.student_name || '')
    const [searchResults,  setSearchResults]  = useState([])
    const [selectedStudent,setSelectedStudent]= useState(
        leader ? { id: leader.student_uuid, name: leader.student_name, student_id: leader.student_id, grade: leader.grade, section: leader.section } : null
    )
    const [searching,      setSearching]      = useState(false)
    const [dropdownOpen,   setDropdownOpen]   = useState(false)
    const searchRef = useRef(null)
    const debounceRef = useRef(null)

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    // Close dropdown on outside click
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
            finally { setSearching(false) }
        }, 300)
    }

    function selectStudent(s) {
        setSelectedStudent(s)
        setQuery(s.name)
        setDropdownOpen(false)
        setSearchResults([])
    }

    async function handleSave() {
        if (!isEditing && !selectedStudent) { setError('Please select a student.'); return }
        if (!role) { setError('Please select a role.'); return }
        setSaving(true); setError(null)
        try {
            const data = { role, appointed_date: appointedDate, notes }
            if (!isEditing) data.student_id = selectedStudent.id
            await onSave(data)
        } catch { setError('Failed to save. Please try again.') }
        finally   { setSaving(false) }
    }

    const cls = selectedStudent ? `${selectedStudent.grade || ''}${selectedStudent.section || ''}` : ''

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-rounded" style={{ color: 'var(--discipline, #7c3aed)' }}>
                            {isEditing ? 'edit' : 'person_add'}
                        </span>
                        <h2 className="modal-title">{isEditing ? 'Edit Student Leader' : 'Add Student Leader'}</h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose}><span className="material-symbols-rounded">close</span></button>
                </div>

                <div className="modal-body">

                    {/* Student selector */}
                    {isEditing ? (
                        <div className="form-group">
                            <label className="form-label">Student</label>
                            <div style={{ padding: '0.5rem 0.75rem', background: 'var(--muted)', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600 }}>
                                {leader.student_name}
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
                                    <span className="material-symbols-rounded" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1rem', color: 'var(--muted-foreground)', animation: 'spin 1s linear infinite' }}>
                                        progress_activity
                                    </span>
                                )}
                            </div>
                            {dropdownOpen && searchResults.length > 0 && (
                                <div style={{
                                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                                    background: 'var(--card)', border: '1px solid var(--border)',
                                    borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                                    maxHeight: '220px', overflowY: 'auto', marginTop: '2px',
                                }}>
                                    {searchResults.map(s => (
                                        <div key={s.id} onClick={() => selectStudent(s)} style={{
                                            padding: '0.625rem 0.875rem', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '0.625rem',
                                            borderBottom: '1px solid var(--border)',
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--muted)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>
                                                {s.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{s.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                                                    {s.student_id} · {s.grade}{s.section}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {selectedStudent && (
                                <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: '#15803d', fontWeight: 600 }}>
                                    ✓ {selectedStudent.name} ({selectedStudent.student_id})
                                    {cls && <span className="class-chip" style={{ marginLeft: '0.4rem', fontSize: '0.7rem' }}>{cls}</span>}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Role */}
                    <div className="form-group">
                        <label className="form-label">Role *</label>
                        <select className="form-input" value={role} onChange={e => setRole(e.target.value)}>
                            {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                    </div>

                    {/* Appointed date */}
                    <div className="form-group">
                        <label className="form-label">Appointed Date</label>
                        <input className="form-input" type="date" value={appointedDate} onChange={e => setAppointedDate(e.target.value)} />
                    </div>

                    {/* Notes */}
                    <div className="form-group">
                        <label className="form-label">Notes (optional)</label>
                        <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes…" />
                    </div>

                    {error && <p style={{ color: '#dc2626', fontSize: '0.82rem', margin: 0 }}>{error}</p>}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving || (!isEditing && !selectedStudent)}>
                        <span className="material-symbols-rounded">{isEditing ? 'save' : 'person_add'}</span>
                        {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Leader'}
                    </button>
                </div>
            </div>
        </div>
    )
}
