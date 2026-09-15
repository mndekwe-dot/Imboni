import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
    createStaffMember, deleteStaffMember, getDepartments, getStaffMembers, updateStaffMember,
} from '../../api/staff'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { formatAmount } from '../../utils/money'
import { DataTable } from '../ui/DataTable'
import { DocumentActions } from '../ui/DocumentActions'
import { Modal } from '../ui/Modal'
import { SearchBar } from '../ui/SearchBar'
import { departmentName } from './departmentName'

const EMPLOYMENT = ['full_time', 'part_time', 'contract', 'casual']

/**
 * Everyone the school employs, with or without an Imboni login.
 *
 * One component for both offices that keep it. The admin sees the register;
 * payroll passes `onSalary`, which adds what each person is paid and the button
 * that sets it. `reloadKey` lets the page refresh the list after a salary saves.
 */
export function StaffRegister({ onSalary, reloadKey = 0 }) {
    const { t } = useTranslation()
    const toast = useToast()
    const payroll = typeof onSalary === 'function'

    const [members, setMembers] = useState([])
    const [departments, setDepartments] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [department, setDepartment] = useState('')
    const [status, setStatus] = useState('active')
    const [editing, setEditing] = useState(null)

    const params = {
        ...(search.trim() ? { q: search.trim() } : {}),
        ...(department ? { department } : {}),
        status,
    }

    const load = useCallback(() => {
        setLoading(true)
        Promise.all([getStaffMembers(params), getDepartments()])
            .then(([m, d]) => {
                setMembers(Array.isArray(m) ? m : [])
                setDepartments(Array.isArray(d) ? d : [])
            })
            .catch(e => toast.error(errorMessage(e, t('staff.loadFailed'))))
            .finally(() => setLoading(false))
    }, [search, department, status, reloadKey, toast, t]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { load() }, [load])

    const columns = [
        { label: t('staff.fields.name') },
        { label: t('staff.fields.jobTitle') },
        { label: t('staff.fields.department') },
        { label: t('staff.fields.employment') },
        ...(payroll ? [{ label: t('finance.payroll.net'), align: 'right' }] : []),
        { label: '' },
    ]

    return (
        <>
            {editing && (
                <WorkerModal member={editing === 'new' ? null : editing} departments={departments}
                    onClose={() => setEditing(null)} onSaved={load} />
            )}

            <div className="toolbar-card">
                <SearchBar value={search} onChange={setSearch} placeholder={t('staff.searchPlaceholder')} />
                <select className="form-input class-filter-select" value={department}
                    aria-label={t('staff.fields.department')}
                    onChange={e => setDepartment(e.target.value)}>
                    <option value="">{t('staff.allDepartments')}</option>
                    {departments.map(d => (
                        <option key={d.id} value={d.id}>{departmentName(t, d.code, d.name)}</option>
                    ))}
                    <option value="none">{t('staff.noDepartment')}</option>
                </select>
                <select className="form-input class-filter-select" value={status}
                    aria-label={t('common.status')} onChange={e => setStatus(e.target.value)}>
                    <option value="active">{t('staff.status.active')}</option>
                    <option value="left">{t('staff.status.left')}</option>
                    <option value="all">{t('staff.status.all')}</option>
                </select>
                <div className="toolbar-spacer" />
                <DocumentActions url="/imboni/staff/members/" params={params} stem="staff-register"
                    pdf={false} disabled={loading} />
                <button className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
                    <span className="material-symbols-rounded icon-sm" aria-hidden="true">person_add</span>
                    {t('staff.addWorker')}
                </button>
            </div>

            <DataTable
                title={t('staff.register')}
                icon="badge"
                data={loading ? [] : members}
                columns={columns}
                pageSize={12}
                renderRow={m => (
                    <tr key={m.id}>
                        <td>
                            <div className="u-strong">{m.full_name}</div>
                            <div className="text-xs-muted">
                                {[m.staff_no, m.phone].filter(Boolean).join(' · ')
                                    || (m.has_account ? t(`roles.${m.account_role}`, { defaultValue: m.account_role }) : '')}
                            </div>
                        </td>
                        <td>{m.job_title || '-'}</td>
                        <td>{m.department_name ? departmentName(t, m.department_code, m.department_name) : '-'}</td>
                        <td>
                            {t(`staff.employment.${m.employment_type}`)}
                            {m.has_account && (
                                <span className="pill pill-info staff-account-pill">{t('staff.hasAccount')}</span>
                            )}
                            {!m.is_active && (
                                <span className="pill pill-muted staff-account-pill">{t('staff.status.leftShort')}</span>
                            )}
                        </td>
                        {payroll && (
                            <td className="dt-num">
                                {m.salary ? formatAmount(m.salary.net_estimate)
                                    : <span className="text-xs-muted">{t('staff.noSalary')}</span>}
                            </td>
                        )}
                        <td className="action-cell">
                            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(m)}>
                                {t('common.edit')}
                            </button>
                            {payroll && m.is_active && (
                                <button className="btn btn-outline btn-sm" onClick={() => onSalary(m)}>
                                    {m.salary ? t('staff.salary') : t('staff.setSalary')}
                                </button>
                            )}
                        </td>
                    </tr>
                )}
                emptyIcon="badge"
                emptyTitle={loading ? t('common.loading') : t('staff.empty')}
                emptyDesc={loading ? '' : t('staff.emptyDesc')}
            />
        </>
    )
}

function WorkerModal({ member, departments, onClose, onSaved }) {
    const { t } = useTranslation()
    const toast = useToast()
    const fromAccount = Boolean(member?.has_account)
    const [form, setForm] = useState({
        first_name: member?.first_name || '', last_name: member?.last_name || '',
        staff_no: member?.staff_no || '', job_title: member?.job_title || '',
        department: member?.department || '', employment_type: member?.employment_type || 'full_time',
        phone: member?.phone || '', email: member?.email || '', national_id: member?.national_id || '',
        start_date: member?.start_date || '', end_date: member?.end_date || '',
        is_active: member ? member.is_active : true, note: member?.note || '',
    })
    const [busy, setBusy] = useState(false)

    const set = key => e => setForm(f => ({
        ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    }))

    async function save(event) {
        event.preventDefault()
        setBusy(true)
        const data = { ...form, department: form.department || null,
            start_date: form.start_date || null, end_date: form.end_date || null }
        if (fromAccount) {
            // The account owns these; sending them back unchanged is still refused
            // if the account was renamed while the form was open.
            for (const key of ['first_name', 'last_name', 'email', 'phone']) delete data[key]
        }
        try {
            if (member) await updateStaffMember(member.id, data)
            else await createStaffMember(data)
            toast.success(t('common.saved'))
            onSaved()
            onClose()
        } catch (e) {
            toast.error(errorMessage(e, t('staff.saveFailed')))
        } finally {
            setBusy(false)
        }
    }

    async function remove() {
        if (!window.confirm(t('staff.deleteConfirm', { name: member.full_name }))) return
        setBusy(true)
        try {
            await deleteStaffMember(member.id)
            toast.success(t('staff.deleted'))
            onSaved()
            onClose()
        } catch (e) {
            toast.error(errorMessage(e, t('staff.saveFailed')))
        } finally {
            setBusy(false)
        }
    }

    const activeDepartments = departments.filter(d => d.is_active || d.id === form.department)

    return (
        <Modal title={member ? member.full_name : t('staff.addWorker')} icon="badge" onClose={onClose}
            size="lg"
            footer={(
                <>
                    {member && !fromAccount && (
                        <button type="button" className="btn btn-ghost" disabled={busy} onClick={remove}>
                            {t('common.delete')}
                        </button>
                    )}
                    <div className="toolbar-spacer" />
                    <button type="button" className="btn btn-outline" onClick={onClose}>{t('common.cancel')}</button>
                    <button type="submit" form="worker-form" className="btn btn-primary" disabled={busy}>
                        {busy ? t('common.saving') : t('common.save')}
                    </button>
                </>
            )}>
            <form id="worker-form" onSubmit={save}>
                {fromAccount && <p className="text-xs-muted mb-1">{t('staff.fromAccountNote')}</p>}
                <div className="form-grid">
                    <label className="form-group">
                        <span className="form-label">{t('staff.fields.firstName')}</span>
                        <input className="form-input" value={form.first_name} onChange={set('first_name')}
                            required disabled={fromAccount} />
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('staff.fields.lastName')}</span>
                        <input className="form-input" value={form.last_name} onChange={set('last_name')}
                            disabled={fromAccount} />
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('staff.fields.jobTitle')}</span>
                        <input className="form-input" value={form.job_title} onChange={set('job_title')}
                            placeholder={t('staff.jobTitlePlaceholder')} />
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('staff.fields.department')}</span>
                        <select className="form-select" value={form.department} onChange={set('department')}>
                            <option value="">{t('staff.noDepartment')}</option>
                            {activeDepartments.map(d => (
                                <option key={d.id} value={d.id}>{departmentName(t, d.code, d.name)}</option>
                            ))}
                        </select>
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('staff.fields.employment')}</span>
                        <select className="form-select" value={form.employment_type} onChange={set('employment_type')}>
                            {EMPLOYMENT.map(key => (
                                <option key={key} value={key}>{t(`staff.employment.${key}`)}</option>
                            ))}
                        </select>
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('staff.fields.staffNo')}</span>
                        <input className="form-input" value={form.staff_no} onChange={set('staff_no')} />
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('staff.fields.phone')}</span>
                        <input className="form-input" type="tel" value={form.phone} onChange={set('phone')}
                            disabled={fromAccount} />
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('staff.fields.email')}</span>
                        <input className="form-input" type="email" value={form.email} onChange={set('email')}
                            disabled={fromAccount} />
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('staff.fields.nationalId')}</span>
                        <input className="form-input" value={form.national_id} onChange={set('national_id')} />
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('staff.fields.startDate')}</span>
                        <input className="form-input" type="date" value={form.start_date} onChange={set('start_date')} />
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('staff.fields.endDate')}</span>
                        <input className="form-input" type="date" value={form.end_date} onChange={set('end_date')} />
                    </label>
                    <label className="form-group">
                        <span className="form-label">{t('staff.fields.note')}</span>
                        <input className="form-input" value={form.note} onChange={set('note')} />
                    </label>
                </div>
                <label className="form-check mt-1">
                    <input type="checkbox" checked={form.is_active} onChange={set('is_active')} />
                    <span>{t('staff.stillWorking')}</span>
                </label>
            </form>
        </Modal>
    )
}
