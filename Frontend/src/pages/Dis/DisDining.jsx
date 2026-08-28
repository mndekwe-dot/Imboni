import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { DataTable } from '../../components/ui/DataTable'
import { disNavItems, disSecondaryItems } from './disNav'
import { getDisDining, createDisDining, patchDisDining, deleteDisDining, searchDisStudents } from '../../api/discipline'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { StatCard } from '../../components/layout/StatCard'
import { StudentSearchPicker } from '../../components/ui/StudentSearchPicker'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'

const PLAN_TYPES = [
    { value: 'full_board',  labelKey: 'dis.dining.fullBoard'  },
    { value: 'half_board',  labelKey: 'dis.dining.halfBoard'  },
    { value: 'day_scholar', labelKey: 'dis.dining.dayScholar' },
]

const PLAN_TYPE_KEY = Object.fromEntries(PLAN_TYPES.map(p => [p.value, p.labelKey]))
const PLAN_TYPE_CLS = { full_board: 'success', half_board: 'warning', day_scholar: '' }

/* The stored value when the school has one this list does not know. Showing
   the raw `half_board` is still better than showing nothing. */
const planLabel = (t, value) => (PLAN_TYPE_KEY[value] ? t(PLAN_TYPE_KEY[value]) : value)

// ── Dining Modal ──────────────────────────────────────────────────────────────

function DiningModal({ plan, onClose, onSave }) {
    const { t } = useTranslation()
    const isEditing = !!plan

    // Student search handled by shared StudentSearchPicker
    const [selectedStudent, setSelectedStudent] = useState(
        plan ? { id: null, name: plan.student_name, student_id: plan.student_id } : null
    )

    const [planType, setPlanType] = useState(plan?.plan_type || 'full_board')
    const [saving,   setSaving]   = useState(false)
    const [error,    setError]    = useState(null)

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    async function handleSave() {
        if (!isEditing && !selectedStudent) { setError(t('common.selectStudentRequired')); return }
        setSaving(true); setError(null)
        try {
            const data = isEditing
                ? { plan_type: planType }
                : { student_id: selectedStudent.id, plan_type: planType }
            await onSave(data)
        } catch (e) {
            setError(e?.response?.data?.error || t('common.genericSaveFailed'))
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
                        <h2 className="modal-title">{isEditing ? t('dis.dining.editPlan') : t('dis.dining.addPlan')}</h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose}><span className="material-symbols-rounded">close</span></button>
                </div>

                <div className="modal-body">
                    {/* Student selector */}
                    {isEditing ? (
                        <div className="form-group">
                            <label className="form-label">{t('common.student')}</label>
                            <div className="dis-student-box">
                                {plan.student_name}
                                <span className="text-muted dis-id-inline">{plan.student_id}</span>
                            </div>
                        </div>
                    ) : (
                        <StudentSearchPicker
                            value={selectedStudent}
                            onChange={setSelectedStudent}
                            fetchStudents={searchDisStudents}
                            required
                        />
                    )}

                    {/* Plan type */}
                    <div className="form-group">
                        <label className="form-label">{t('dis.dining.planRequired')}</label>
                        <div className="u-row-sm u-wrap">
                            {PLAN_TYPES.map(pt => (
                                <label key={pt.value} className={`dis-plan-opt${planType === pt.value ? ' on' : ''}`}>
                                    <input type="radio" value={pt.value} checked={planType === pt.value} onChange={() => setPlanType(pt.value)} className="dis-radio" />
                                    {t(pt.labelKey)}
                                </label>
                            ))}
                        </div>
                    </div>

                    {!isEditing && (
                        <p className="dis-modal-note">{t('dis.dining.termNote')}</p>
                    )}

                    {error && <p className="dis-modal-err">{error}</p>}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving || (!isEditing && !selectedStudent)}>
                        <span className="material-symbols-rounded">{isEditing ? 'save' : 'restaurant'}</span>
                        {saving ? t('common.saving') : isEditing ? t('common.saveChanges') : t('dis.dining.addPlanAction')}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Dining Row ────────────────────────────────────────────────────────────────

function DiningRow({ plan, onEdit, onDelete }) {
    const { t } = useTranslation()
    const [confirmDelete, setConfirmDelete] = useState(false)
    const { student_name, student_id, plan_type, term_name } = plan
    const label = planLabel(t, plan_type)
    const cls   = PLAN_TYPE_CLS[plan_type] || ''

    return (
        <tr>
            <td><strong>{student_name}</strong></td>
            <td className="text-muted">{student_id}</td>
            <td><span className={`badge${cls ? ' badge-' + cls : ''}`}>{label}</span></td>
            <td className="text-muted">{term_name || '-'}</td>
            <td className="action-cell">
                {confirmDelete ? (
                    <>
                        <span className="remove-confirm-text">{t('common.removeConfirm')}</span>
                        <button className="btn btn-primary btn-sm" onClick={() => onDelete(plan.id)}>{t('common.yes')}</button>
                        <button className="btn btn-outline btn-sm" onClick={() => setConfirmDelete(false)}>{t('common.no')}</button>
                    </>
                ) : (
                    <>
                        <button className="btn btn-outline btn-sm" onClick={() => onEdit(plan)} aria-label={`${t('common.edit')} — ${student_name}`}>
                            <span className="material-symbols-rounded icon-sm">edit</span>
                        </button>
                        <button className="btn btn-outline btn-sm dis-btn-del" onClick={() => setConfirmDelete(true)} aria-label={`${t('common.delete')} — ${student_name}`}>
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
    const { t } = useTranslation()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const sessionUser = useSessionUser()
    const toast = useToast()
    const [plans,         setPlans]         = useState([])
    const [loading,       setLoading]       = useState(true)
    const [filter,        setFilter]        = useState('all')
    const [showModal,     setShowModal]     = useState(false)
    const [editingPlan,   setEditingPlan]   = useState(null)

    useEffect(() => {
        getDisDining()
            .then(data => setPlans(Array.isArray(data) ? data : []))
            .catch(e => toast.error(errorMessage(e, t('dis.dining.loadFailed'))))
            .finally(() => setLoading(false))
    }, [toast, t])

    const visible = filter === 'all' ? plans : plans.filter(p => p.plan_type === filter)

    const stats = [
        { iconClass: 'success', icon: 'restaurant',      value: plans.filter(p => p.plan_type === 'full_board').length,  label: t('dis.dining.fullBoard')  },
        { iconClass: 'warning', icon: 'lunch_dining',    value: plans.filter(p => p.plan_type === 'half_board').length,  label: t('dis.dining.halfBoard')  },
        { iconClass: '',        icon: 'directions_walk', value: plans.filter(p => p.plan_type === 'day_scholar').length, label: t('dis.dining.dayScholar') },
        { iconClass: 'info',    icon: 'groups',          value: plans.length,                                            label: t('dis.dining.totalPlans') },
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
        try {
            await deleteDisDining(id)
            setPlans(prev => prev.filter(p => p.id !== id))
        } catch (e) {
            toast.error(errorMessage(e, t('dis.dining.saveFailed')))
        }
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

            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader title={t('dis.dining.title')} subtitle={t('dis.dining.subtitle')} {...sessionUser} notifications={liveNotifications} onNotificationRead={markRead} />

                    <DashboardContent>

                        <div className="portal-stat-grid">
                            {stats.map((s, i) => (
                                <StatCard key={i} icon={s.icon} value={loading ? '-' : s.value} label={s.label} colorClass={s.iconClass} />
                            ))}
                        </div>

                        <div className="card mb-1-5">
                            <div className="card-content dis-filter-bar">
                                <select
                                    className="form-input dis-filter-select-sm"
                                    value={filter}
                                    onChange={e => setFilter(e.target.value)}
                                >
                                    <option value="all">{t('common.allStudents')}</option>
                                    {PLAN_TYPES.map(pt => (
                                        <option key={pt.value} value={pt.value}>{t(pt.labelKey)}</option>
                                    ))}
                                </select>
                                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                                    <span className="material-symbols-rounded icon-sm">add</span> {t('dis.dining.addPlan')}
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <p className="u-pad u-muted">{t('dis.dining.loading')}</p>
                        ) : (
                            <DataTable
                                title={t('dis.dining.plans')}
                                data={visible}
                                columns={[
                                    t('common.student'), t('common.admissionNo'),
                                    t('dis.dining.planType'), t('common.term'), t('common.actions'),
                                ]}
                                renderRow={(p, i) => (
                                    <DiningRow
                                        key={p.id || i}
                                        plan={p}
                                        onEdit={setEditingPlan}
                                        onDelete={handleDelete}
                                    />
                                )}
                                emptyIcon="restaurant"
                                emptyTitle={t('dis.dining.noPlans')}
                                emptyDesc={filter === 'all'
                                    ? t('dis.dining.noPlansDesc')
                                    : t('dis.dining.noPlansOfType', { type: planLabel(t, filter) })}
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
