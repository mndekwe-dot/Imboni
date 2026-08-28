import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import '../../styles/components.css'
import { StudentSearchPicker } from '../ui/StudentSearchPicker'
import { searchDisStudents } from '../../api/discipline'

const ROLE_OPTIONS = [
    { value: 'head_boy',        labelKey: 'modals.leader.roleHeadBoy'         },
    { value: 'head_girl',       labelKey: 'modals.leader.roleHeadGirl'        },
    { value: 'deputy_head_boy', labelKey: 'modals.leader.roleDeputyHeadBoy'   },
    { value: 'deputy_head_girl',labelKey: 'modals.leader.roleDeputyHeadGirl'  },
    { value: 'prefect',         labelKey: 'modals.leader.rolePrefect'         },
    { value: 'class_captain',   labelKey: 'modals.leader.roleClassCaptain'    },
    { value: 'games_captain',   labelKey: 'modals.leader.roleGamesCaptain'    },
]

export function LeaderModal({ leader, onClose, onSave }) {
    const { t } = useTranslation()
    const isEditing = !!leader

    const [role,          setRole]          = useState(leader?.role          || 'prefect')
    const [appointedDate, setAppointedDate] = useState(leader?.appointed_date || '')
    const [notes,         setNotes]         = useState(leader?.notes          || '')
    const [saving,        setSaving]        = useState(false)
    const [error,         setError]         = useState(null)
    const [selectedStudent,setSelectedStudent] = useState(
        leader ? { id: leader.student_uuid, name: leader.student_name, student_id: leader.student_id, grade: leader.grade, section: leader.section } : null
    )

    // Student search handled by shared StudentSearchPicker

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    async function handleSave() {
        if (!isEditing && !selectedStudent) { setError(t('common.selectStudentRequired')); return }
        if (!role) { setError(t('common.selectRoleRequired')); return }
        setSaving(true); setError(null)
        try {
            const data = { role, appointed_date: appointedDate, notes }
            if (!isEditing) data.student_id = selectedStudent.id
            await onSave(data)
        } catch { setError(t('common.genericSaveFailed')) }
        finally   { setSaving(false) }
    }

    const cls = selectedStudent ? `${selectedStudent.grade || ''}${selectedStudent.section || ''}` : ''

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-rounded dmod-title-icon">
                            {isEditing ? 'edit' : 'person_add'}
                        </span>
                        <h2 className="modal-title">{isEditing ? t('modals.leader.editTitle') : t('modals.leader.addTitle')}</h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose}><span className="material-symbols-rounded">close</span></button>
                </div>

                <div className="modal-body">

                    {/* Student selector */}
                    {isEditing ? (
                        <div className="form-group">
                            <label className="form-label">{t('common.student')}</label>
                            <div className="dmod-current">
                                {leader.student_name}
                                {cls && <span className="class-chip dis-chip-inline">{cls}</span>}
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

                    {/* Role */}
                    <div className="form-group">
                        <label className="form-label">{t('modals.leader.roleRequired')}</label>
                        <select className="form-input" value={role} onChange={e => setRole(e.target.value)}>
                            {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{t(r.labelKey)}</option>)}
                        </select>
                    </div>

                    {/* Appointed date */}
                    <div className="form-group">
                        <label className="form-label">{t('common.appointedDate')}</label>
                        <input className="form-input" type="date" value={appointedDate} onChange={e => setAppointedDate(e.target.value)} />
                    </div>

                    {/* Notes */}
                    <div className="form-group">
                        <label className="form-label">{t('modals.leader.notesOptional')}</label>
                        <input className="form-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('modals.leader.notesPlaceholder')} />
                    </div>

                    {error && <p className="dmod-error">{error}</p>}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving || (!isEditing && !selectedStudent)}>
                        <span className="material-symbols-rounded">{isEditing ? 'save' : 'person_add'}</span>
                        {saving ? t('common.saving') : isEditing ? t('common.saveChanges') : t('modals.leader.addLeader')}
                    </button>
                </div>
            </div>
        </div>
    )
}
