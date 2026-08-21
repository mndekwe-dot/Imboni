import { useState, useEffect, useRef } from 'react'
import { getDisStudents } from '../../api/discipline'
import { useDormitories } from '../../hooks/useDormitories'
import { useTranslation } from 'react-i18next'
import '../../styles/components.css'

// Must match the key useDormitories derives, so a stored display name and a
// fetched dormitory resolve to the same <option> value.
const toDormKey = name => String(name || '').toLowerCase().replace(/\s+/g, '-')

export function DormitoryCaptainModal({ captain, onClose, onSave }) {
    const { t } = useTranslation()
    const isEditing = !!captain
    // The school's own dormitories, not a fixed four.
    const DORMITORIES = useDormitories()

    // captain.notes stores the dormitory's display name ("Dormitory: Bisoke"),
    // but the <select> below is keyed by lowercase id ("bisoke") — resolve the
    // matching key so editing a captain shows their actual dormitory selected.
    //
    // Derived from the name directly rather than by looking it up in
    // DORMITORIES: that list arrives asynchronously and is still empty when
    // this initialiser runs, which left the select with an unmatched value.
    const [dormKey, setDormKey] = useState(() =>
        toDormKey(captain?.notes?.replace('Dormitory: ', '') || ''))
    const [appointedDate, setAppointedDate] = useState(captain?.appointed_date || '')
    const [saving,        setSaving]        = useState(false)
    const [error,         setError]         = useState(null)

    // Student search
    const [query,          setQuery]          = useState(captain?.student_name || '')
    const [searchResults,  setSearchResults]  = useState([])
    const [selectedStudent,setSelectedStudent]= useState(
        captain ? { id: captain.student_uuid, name: captain.student_name, student_id: captain.student_id, grade: captain.grade, section: captain.section } : null
    )
    const [searching,    setSearching]    = useState(false)
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const searchRef   = useRef(null)
    const debounceRef = useRef(null)

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
        if (!isEditing && !selectedStudent) { setError(t('common.selectStudentRequired')); return }
        if (!dormKey) { setError(t('common.selectDormitoryRequired')); return }
        setSaving(true); setError(null)
        const dormName = DORMITORIES.find(d => d.key === dormKey)?.name || dormKey
        try {
            const data = {
                appointed_date: appointedDate,
                notes: `Dormitory: ${dormName}`,
            }
            if (!isEditing) data.student_id = selectedStudent.id
            await onSave(data)
        } catch { setError(t('common.genericSaveFailed')) }
        finally   { setSaving(false) }
    }

    const selectedDorm = DORMITORIES.find(d => d.key === dormKey)
    const cls = selectedStudent ? `${selectedStudent.grade || ''}${selectedStudent.section || ''}` : ''

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-left">
                        <span className="material-symbols-rounded dmod-title-icon">
                            {isEditing ? 'edit' : 'person_add'}
                        </span>
                        <h2 className="modal-title">{isEditing ? t('modals.captain.editTitle') : t('modals.captain.addTitle')}</h2>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose}><span className="material-symbols-rounded">close</span></button>
                </div>

                <div className="modal-body">

                    {/* Student selector */}
                    {isEditing ? (
                        <div className="form-group">
                            <label className="form-label">{t('common.student')}</label>
                            <div className="dmod-current">
                                {captain.student_name}
                                {cls && <span className="class-chip dis-chip-inline">{cls}</span>}
                            </div>
                        </div>
                    ) : (
                        <div className="form-group dis-search-wrap" ref={searchRef}>
                            <label className="form-label">{t('modals.leader.studentRequired')}</label>
                            <div className="dis-search-wrap">
                                <input
                                    className="form-input"
                                    value={query}
                                    onChange={handleSearch}
                                    placeholder={t('common.searchStudentPlaceholder')}
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
                                        <div key={s.id} className="dis-search-item" onClick={() => selectStudent(s)}>
                                            <div className="dis-search-av">
                                                {s.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                                            </div>
                                            <div>
                                                <div className="dis-search-name">{s.name}</div>
                                                <div className="dis-search-sub">
                                                    {s.student_id} · {s.grade}{s.section}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {selectedStudent && (
                                <div className="dis-picked">
                                    ✓ {selectedStudent.name} ({selectedStudent.student_id})
                                    {cls && <span className="class-chip dis-chip-inline-sm">{cls}</span>}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Dormitory */}
                    <div className="form-group">
                        <label className="form-label">{t('modals.captain.dormitoryRequired')}</label>
                        <select className="form-input" value={dormKey} onChange={e => setDormKey(e.target.value)} disabled={isEditing}>
                            <option value="">{t('modals.captain.selectDormitory')}</option>
                            <optgroup label={t('modals.captain.girlsDormitories')}>
                                {DORMITORIES.filter(d => d.gender === 'Girls').map(d => (
                                    <option key={d.key} value={d.key}>{d.name}</option>
                                ))}
                            </optgroup>
                            <optgroup label={t('modals.captain.boysDormitories')}>
                                {DORMITORIES.filter(d => d.gender === 'Boys').map(d => (
                                    <option key={d.key} value={d.key}>{d.name}</option>
                                ))}
                            </optgroup>
                        </select>
                        {selectedDorm && (
                            <span className="dmod-note">
                                <span className="material-symbols-rounded">
                                    {selectedDorm.gender === 'Girls' ? 'female' : 'male'}
                                </span>
                                {' '}{selectedDorm.gender === 'Girls'
                                    ? t('modals.captain.girlsDormNote')
                                    : t('modals.captain.boysDormNote')}
                            </span>
                        )}
                    </div>

                    {/* Appointed date */}
                    <div className="form-group">
                        <label className="form-label">{t('common.appointedDate')}</label>
                        <input className="form-input" type="date" value={appointedDate} onChange={e => setAppointedDate(e.target.value)} />
                    </div>

                    {error && <p className="dmod-error">{error}</p>}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving || (!isEditing && !selectedStudent) || !dormKey}>
                        <span className="material-symbols-rounded">{isEditing ? 'save' : 'person_add'}</span>
                        {saving ? t('common.saving') : isEditing ? t('common.saveChanges') : t('modals.captain.addCaptain')}
                    </button>
                </div>
            </div>
        </div>
    )
}
