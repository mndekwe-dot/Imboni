import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
    createDepartment, deleteDepartment, getDepartments, getStaffMembers, updateDepartment,
} from '../../api/staff'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { EmptyState } from '../ui/EmptyState'
import { ListSection } from '../ui/ListSection'
import { Modal } from '../ui/Modal'
import { departmentName } from './departmentName'

/**
 * The parts of the school people work in, how many work in each, and who leads it.
 *
 * A department that still has workers is retired rather than deleted: past
 * payslips and the register name it, and losing it would lose that history.
 */
export function DepartmentsPanel() {
    const { t } = useTranslation()
    const toast = useToast()
    const [departments, setDepartments] = useState([])
    const [members, setMembers] = useState([])
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState(null)
    const [busy, setBusy] = useState(false)

    const load = useCallback(() => {
        setLoading(true)
        Promise.all([getDepartments(), getStaffMembers({ status: 'active' })])
            .then(([d, m]) => {
                setDepartments(Array.isArray(d) ? d : [])
                setMembers(Array.isArray(m) ? m : [])
            })
            .catch(e => toast.error(errorMessage(e, t('staff.loadFailed'))))
            .finally(() => setLoading(false))
    }, [toast, t])

    useEffect(() => { load() }, [load])

    async function run(action, success) {
        setBusy(true)
        try {
            await action()
            toast.success(success)
            load()
        } catch (e) {
            toast.error(errorMessage(e, t('staff.saveFailed')))
        } finally {
            setBusy(false)
        }
    }

    return (
        <>
            {editing && (
                <DepartmentModal department={editing === 'new' ? null : editing} members={members}
                    onClose={() => setEditing(null)} onSaved={load} />
            )}

            <ListSection icon="corporate_fare" title={t('staff.departmentsTitle')}
                count={loading ? null : departments.filter(d => d.is_active).length}
                headerRight={(
                    <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span>
                        {t('staff.addDepartment')}
                    </button>
                )}>
                {loading ? <p className="u-muted">{t('common.loading')}</p>
                    : departments.length === 0 ? (
                        <EmptyState icon="corporate_fare" title={t('staff.noDepartments')}
                            description={t('staff.noDepartmentsDesc')} />
                    ) : (
                        <ul className="row-list">
                            {departments.map(d => (
                                <li key={d.id} className={`row-item${d.is_active ? '' : ' staff-row-off'}`}>
                                    <span className="row-icon">
                                        <span className="material-symbols-rounded" aria-hidden="true">corporate_fare</span>
                                    </span>
                                    <div className="row-main">
                                        <div className="u-strong">{departmentName(t, d.code, d.name)}</div>
                                        <div className="text-xs-muted">
                                            {t('staff.memberCount', { count: d.member_count })}
                                            {d.head_name ? ` · ${t('staff.headedBy', { name: d.head_name })}` : ''}
                                            {d.is_active ? '' : ` · ${t('staff.retired')}`}
                                        </div>
                                    </div>
                                    <div className="row-actions">
                                        <button className="btn btn-ghost btn-sm" disabled={busy}
                                            onClick={() => setEditing(d)}>
                                            {t('common.edit')}
                                        </button>
                                        {d.is_active ? (
                                            <button className="btn btn-ghost btn-sm" disabled={busy}
                                                onClick={() => run(() => deleteDepartment(d.id),
                                                    d.member_count ? t('staff.departmentRetired') : t('staff.departmentDeleted'))}>
                                                {d.member_count ? t('staff.retire') : t('common.delete')}
                                            </button>
                                        ) : (
                                            <button className="btn btn-ghost btn-sm" disabled={busy}
                                                onClick={() => run(() => updateDepartment(d.id, { is_active: true }),
                                                    t('common.saved'))}>
                                                {t('staff.restore')}
                                            </button>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
            </ListSection>
        </>
    )
}

function DepartmentModal({ department, members, onClose, onSaved }) {
    const { t } = useTranslation()
    const toast = useToast()
    const [form, setForm] = useState({
        name: department ? departmentName(t, department.code, department.name) : '',
        description: department?.description || '',
        head: department?.head || '',
    })
    const [busy, setBusy] = useState(false)
    const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

    async function save(event) {
        event.preventDefault()
        setBusy(true)
        const data = { ...form, name: form.name.trim(), head: form.head || null }
        // A built-in name shown in the reader's language is not a rename: saving
        // it would store the French word and stop translating it for everyone.
        if (department && data.name === departmentName(t, department.code, department.name)) delete data.name
        try {
            if (department) await updateDepartment(department.id, data)
            else await createDepartment(data)
            toast.success(t('common.saved'))
            onSaved()
            onClose()
        } catch (e) {
            toast.error(errorMessage(e, t('staff.saveFailed')))
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal title={department ? t('staff.editDepartment') : t('staff.addDepartment')} icon="corporate_fare"
            onClose={onClose}
            footer={(
                <>
                    <button type="button" className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
                    <button type="submit" form="department-form" className="btn btn-primary"
                        disabled={busy || !form.name.trim()}>
                        {busy ? t('common.saving') : t('common.save')}
                    </button>
                </>
            )}>
            <form id="department-form" onSubmit={save} className="u-stack-1">
                <label className="form-group">
                    <span className="form-label">{t('staff.fields.departmentName')}</span>
                    <input className="form-input" value={form.name} onChange={set('name')} required
                        placeholder={t('staff.departmentPlaceholder')} />
                </label>
                <label className="form-group">
                    <span className="form-label">{t('staff.fields.head')}</span>
                    <select className="form-select" value={form.head} onChange={set('head')}>
                        <option value="">{t('staff.noHead')}</option>
                        {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                    </select>
                </label>
                <label className="form-group">
                    <span className="form-label">{t('staff.fields.description')}</span>
                    <input className="form-input" value={form.description} onChange={set('description')} />
                </label>
            </form>
        </Modal>
    )
}
