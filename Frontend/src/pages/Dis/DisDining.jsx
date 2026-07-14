import { useState, useEffect, useRef } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { DataTable } from '../../components/ui/DataTable'
import { disNavItems, disSecondaryItems } from './disNav'
import { getDisDining, createDisDining, patchDisDining, deleteDisDining, getDisStudents } from '../../api/discipline'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'
import { DashboardContent } from '../../components/layout/DashboardContent'

const PLAN_TYPES = [
    { value: 'full_board',  label: 'Full Board'   },
    { value: 'half_board',  label: 'Half Board'   },
    { value: 'day_scholar', label: 'Day Scholar'  },
]

const PLAN_TYPE_LABEL = { full_board: 'Full Board', half_board: 'Half Board', day_scholar: 'Day Scholar' }
const PLAN_TYPE_CLS   = { full_board: 'success',    half_board: 'warning',    day_scholar: ''            }

// ── Dining Modal ──────────────────────────────────────────────────────────────

function DiningModal({ plan, onClose, onSave }) {
    const isEditing = !!plan

    const [query,           setQuery]           = useState(plan?.student_name || '')
    const [searchResults,   setSearchResults]   = useState([])
    const [selectedStudent, setSelectedStudent] = useState(
        plan ? { id: null, name: plan.student_name, student_id: plan.student_id } : null
    )
    const [searching,    setSearching]    = useState(false)
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const searchRef   = useRef(null)
    const debounceRef = useRef(null)

    const [planType, setPlanType] = useState(plan?.plan_type || 'full_board')
    const [saving,   setSaving]   = useState(false)
    const [error,    setError]    = useState(null)

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

    async function handleSave() {
        if (!isEditing && !selectedStudent) { setError('Please select a student.'); return }
        setSaving(true); setError(null)
        try {
            const data = isEditing
                ? { plan_type: planType }
                : { student_id: selectedStudent.id, plan_type: planType }
            await onSave(data)
        } catch (e) {
            setError(e?.response?.data?.error || 'Failed to save. Please try again.')
        } finally { setSaving(false) }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-rounded disc-modal-icon">
                            {isEditing ? 'edit' : 'restaurant'}
                        </span>
                        <h2 className="modal-title">{isEditing ? 'Edit Dining Plan' : 'Add Dining Plan'}</h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose}><span className="material-symbols-rounded">close</span></button>
                </div>

                <div className="modal-body">
                    {/* Student selector */}
                    {isEditing ? (
                        <div className="form-group">
                            <label className="form-label">Student</label>
                            <div className="dis-student-box">
                                {plan.student_name}
                                <span className="text-muted dis-id-inline">{plan.student_id}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="form-group u-relative" ref={searchRef}>
                            <label className="form-label">Student *</label>
                            <div className="u-relative">
                                <input
                                    className="form-input"
                                    value={query}
                                    onChange={handleSearch}
                                    placeholder="Search by name or ADM number…"
                                    autoComplete="off"
                                />
                                {searching && (
                                    <span className="material-symbols-rounded dis-search-spin">
                                        progress_activity
                                    </span>
                                )}
                            </div>
                            {dropdownOpen && searchResults.length > 0 && (
                                <div className="dis-search-menu">
                                    {searchResults.map(s => (
                                        <div key={s.id} onClick={() => selectStudent(s)} className="dis-search-item">
                                            <div className="dis-search-av">
                                                {s.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                                            </div>
                                            <div>
                                                <div className="dis-search-name">{s.name}</div>
                                                <div className="dis-search-sub">{s.student_id} · {s.grade}{s.section}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {selectedStudent && (
                                <div className="dis-selected-ok">
                                    ✓ {selectedStudent.name} — {selectedStudent.student_id}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Plan type */}
                    <div className="form-group">
                        <label className="form-label">Dining Plan *</label>
                        <div className="u-row-sm u-wrap">
                            {PLAN_TYPES.map(pt => (
                                <label key={pt.value} className={`dis-plan-opt${planType === pt.value ? ' on' : ''}`}>
                                    <input type="radio" value={pt.value} checked={planType === pt.value} onChange={() => setPlanType(pt.value)} className="dis-radio" />
                                    {pt.label}
                                </label>
                            ))}
                        </div>
                    </div>

                    {!isEditing && (
                        <p className="dis-modal-note">
                            Plan will be assigned to the current academic term.
                        </p>
                    )}

                    {error && <p className="dis-modal-err">{error}</p>}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving || (!isEditing && !selectedStudent)}>
                        <span className="material-symbols-rounded">{isEditing ? 'save' : 'restaurant'}</span>
                        {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Plan'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Dining Row ────────────────────────────────────────────────────────────────

function DiningRow({ plan, onEdit, onDelete }) {
    const [confirmDelete, setConfirmDelete] = useState(false)
    const { student_name, student_id, plan_type, term_name } = plan
    const label = PLAN_TYPE_LABEL[plan_type] || plan_type
    const cls   = PLAN_TYPE_CLS[plan_type]   || ''

    return (
        <tr>
            <td><strong>{student_name}</strong></td>
            <td className="text-muted">{student_id}</td>
            <td><span className={`badge${cls ? ' badge-' + cls : ''}`}>{label}</span></td>
            <td className="text-muted">{term_name || '—'}</td>
            <td className="action-cell">
                {confirmDelete ? (
                    <>
                        <span className="remove-confirm-text">Remove?</span>
                        <button className="btn btn-primary btn-sm" onClick={() => onDelete(plan.id)}>Yes</button>
                        <button className="btn btn-outline btn-sm" onClick={() => setConfirmDelete(false)}>No</button>
                    </>
                ) : (
                    <>
                        <button className="btn btn-outline btn-sm" onClick={() => onEdit(plan)}>
                            <span className="material-symbols-rounded icon-sm">edit</span>
                        </button>
                        <button className="btn btn-outline btn-sm dis-btn-del" onClick={() => setConfirmDelete(true)}>
                            <span className="material-symbols-rounded icon-sm">delete</span>
                        </button>
                    </>
                )}
            </td>
        </tr>
    )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function DisDining() {
    const { notifications: liveNotifications, markRead } = useNotifications()
    const sessionUser = useSessionUser()
    const [plans,         setPlans]         = useState([])
    const [loading,       setLoading]       = useState(true)
    const [filter,        setFilter]        = useState('all')
    const [showModal,     setShowModal]     = useState(false)
    const [editingPlan,   setEditingPlan]   = useState(null)

    useEffect(() => {
        getDisDining()
            .then(data => setPlans(Array.isArray(data) ? data : []))
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const visible = filter === 'all' ? plans : plans.filter(p => p.plan_type === filter)

    const stats = [
        { iconClass: 'success', icon: 'restaurant',      value: plans.filter(p => p.plan_type === 'full_board').length,  label: 'Full Board'   },
        { iconClass: 'warning', icon: 'lunch_dining',    value: plans.filter(p => p.plan_type === 'half_board').length,  label: 'Half Board'   },
        { iconClass: '',        icon: 'directions_walk', value: plans.filter(p => p.plan_type === 'day_scholar').length, label: 'Day Scholars' },
        { iconClass: 'info',    icon: 'groups',          value: plans.length,                                            label: 'Total Plans'  },
    ]

    async function handleCreate(data) {
        const created = await createDisDining(data)
        setPlans(prev => [created, ...prev])
        setShowModal(false)
    }

    async function handleUpdate(data) {
        const updated = await patchDisDining(editingPlan.id, data)
        setPlans(prev => prev.map(p => p.id === editingPlan.id ? updated : p))
        setEditingPlan(null)
    }

    async function handleDelete(id) {
        await deleteDisDining(id)
        setPlans(prev => prev.filter(p => p.id !== id))
    }

    return (
        <>
            {(showModal || editingPlan) && (
                <DiningModal
                    plan={editingPlan || null}
                    onClose={() => { setShowModal(false); setEditingPlan(null) }}
                    onSave={editingPlan ? handleUpdate : handleCreate}
                />
            )}

            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title="Dining" subtitle="Student dining plans for the current term" {...sessionUser} notifications={liveNotifications} onNotificationRead={markRead} />

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
                            <div className="card-content dis-filter-bar">
                                <select
                                    className="form-input dis-filter-select-sm"
                                    value={filter}
                                    onChange={e => setFilter(e.target.value)}
                                >
                                    <option value="all">All Students</option>
                                    {PLAN_TYPES.map(pt => (
                                        <option key={pt.value} value={pt.value}>{pt.label}</option>
                                    ))}
                                </select>
                                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                                    <span className="material-symbols-rounded">add</span> Add Dining Plan
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <p className="u-pad u-muted">Loading dining plans…</p>
                        ) : (
                            <DataTable
                                title="Dining Plans"
                                data={visible}
                                columns={['Student', 'Student ID', 'Plan Type', 'Term', 'Actions']}
                                renderRow={(p, i) => (
                                    <DiningRow
                                        key={p.id || i}
                                        plan={p}
                                        onEdit={setEditingPlan}
                                        onDelete={handleDelete}
                                    />
                                )}
                                emptyIcon="restaurant"
                                emptyTitle="No dining plans"
                                emptyDesc={filter === 'all' ? 'No dining plans on record.' : `No ${PLAN_TYPE_LABEL[filter] || filter} plans.`}
                                onClearFilters={filter !== 'all' ? () => setFilter('all') : undefined}
                            />
                        )}

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}

export function DisDiningPanel() { return null }
