import { useTranslation } from 'react-i18next'
import { useState } from "react";
import { Modal } from './Modal'
import { DAYS, EXTRA_SLOTS } from '../../data/extraTimetable'
import { PERIODS } from '../../data/academicTimetable'

export function TimetableEditForm({
    type, editingSlot, onSave, onDelete, onCancel,
    periods = PERIODS, slots = EXTRA_SLOTS,
    subjects = [], teachers = [], rooms = [], onSubjectChange,
}) {
    const { t } = useTranslation()
    const [form, setForm] = useState({
        day:       editingSlot?.day                  || '',
        slotId:    editingSlot?.slot?.id || editingSlot?.period?.id || '',
        subject:   editingSlot?.cell?.subject        || '',
        teacher:   editingSlot?.cell?.teacher        || '',
        room:      editingSlot?.cell?.room           || '',
        cellType:  editingSlot?.cell?.type           || 'academic',
        subjectId: editingSlot?.cell?.subjectId      || '',
        teacherId: editingSlot?.cell?.teacherId      || '',
    })

    function handleChange(e) {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    }


    const title = editingSlot?.cell ? 'Edit Slot' : 'Add Slot'

    return (
        <Modal title={title} icon="edit_calendar" onClose={onCancel}>
            <div className="tt-form">
                <div className="tt-form-row">
                    <div className="form-group">
                        <label className="form-label" htmlFor="tt-form-day">Day</label>
                        <select id="tt-form-day" className="form-input" name="day" value={form.day} onChange={handleChange}>
                            <option value="">{t('timetable.copy.selectDay')}</option>
                            {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="tt-form-slot">{type === 'academic' ? 'Period' : 'Time Slot'}</label>
                        <select id="tt-form-slot" className="form-input" name="slotId" value={form.slotId} onChange={handleChange}>
                            <option value="">Select {type === 'academic' ? 'period' : 'slot'}</option>
                            {type === 'academic'
                                ? periods.map(p => <option key={p.id} value={p.id}>{p.label} ({p.time})</option>)
                                : slots.map(s => <option key={s.id} value={s.id}>{s.label} ({s.time})</option>)
                            }
                        </select>
                    </div>

                    {type === 'extracurricular' && (
                        <div className="form-group">
                            <label className="form-label" htmlFor="tt-form-cell-type">{t('timetable.copy.activityType')}</label>
                            <select id="tt-form-cell-type" className="form-input" name="cellType" value={form.cellType} onChange={handleChange}>
                                <option value="sports">{t('dos.leaders.catSport')}</option>
                                <option value="academic">{t('timetable.copy.academicClub')}</option>
                                <option value="arts">Arts</option>
                                <option value="social">{t('timetable.copy.socialCommunity')}</option>
                                <option value="boarding">{t('timetable.copy.boardingDormitory')}</option>
                                <option value="dining">{t('nav.dining')}</option>
                                <option value="empty">{t('timetable.copy.emptyFree')}</option>
                            </select>
                        </div>
                    )}
                </div>

                <div className="tt-form-row">
                    <div className="form-group">
                        <label className="form-label" htmlFor="tt-form-subject">{type === 'academic' ? 'Subject' : 'Activity Name'}</label>
                        <select
                            id="tt-form-subject"
                            className="form-input"
                            name="subjectId"
                            value={form.subjectId}
                            onChange={e => {
                                const id = e.target.value
                                const s = subjects.find(s => s.id === id)
                                setForm(prev => ({ ...prev, subjectId: id, subject: s?.name || '', teacherId: '', teacher: '' }))
                                if (onSubjectChange) onSubjectChange(id)
                            }}
                        >
                            <option value="">{t('dos.teachers.selectSubject')}</option>
                            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="tt-form-teacher">{type === 'academic' ? 'Teacher' : 'Staff in Charge'}</label>
                        <select
                            id="tt-form-teacher"
                            className="form-input"
                            name="teacherId"
                            value={form.teacherId}
                            onChange={e => {
                                const id = e.target.value
                                const t = teachers.find(t => String(t.teacher_id) === String(id))
                                setForm(prev => ({ ...prev, teacherId: id, teacher: t?.full_name || '' }))
                            }}
                        >
                            <option value="">{form.subjectId ? 'Select teacher' : 'Select subject first'}</option>
                            {teachers.map(t => <option key={t.teacher_id} value={t.teacher_id}>{t.full_name}</option>)}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="tt-form-room">{t('dos.scheduling.venueRoom')}</label>
                        <select
                            id="tt-form-room"
                            className="form-input"
                            name="room"
                            value={form.room}
                            onChange={e => setForm(prev => ({ ...prev, room: e.target.value }))}
                        >
                            <option value="">{t('dos.scheduling.selectRoom')}</option>
                            {rooms.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="tt-form-actions">
                    <button className="btn btn-outline" onClick={onCancel}>{t('common.cancel')}</button>
                    {editingSlot?.cell && (
                        <button
                            className="btn btn-outline tt-btn-danger"
                            onClick={() => onDelete(editingSlot)}
                        >
                            <span className="material-symbols-rounded icon-sm" aria-hidden="true">delete</span> Delete
                        </button>
                    )}
                    <button className="btn btn-primary" onClick={() => onSave(form)}>
                        <span className="material-symbols-rounded icon-sm" aria-hidden="true">save</span> Save
                    </button>
                </div>
            </div>
        </Modal>
    )
}
