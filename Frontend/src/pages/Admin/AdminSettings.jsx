import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { useNotifications } from '../../hooks/useNotifications'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { SchoolStructureEditor } from '../../components/settings/SchoolStructureEditor'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import { yearsFromConfig } from '../../utils/classes'
import { useSchoolSettings } from '../../hooks/useSchoolSetting'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import {
    updateSchoolSettings,
    getSubjects, createSubject, updateSubject, deleteSubject,
    renameSubjectCategory, deleteSubjectCategory,
    getDosRooms, createDosRoom, deleteDosRoom,
    getCurrentTerm,
} from '../../api/dos'
import { runTermRollover } from '../../api/admin'
import { adminNavItems, adminSecondaryItems, adminUser } from './adminNav'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/admin.css'
import '../../styles/dos.css'
import '../../styles/discipline.css'

// ── Nav items ─────────────────────────────────────────────────────────────────

// Sections are identified by a stable id, never by their label: the label is
// translated, so keying the active section off it would leave every section
// unreachable the moment the interface is not in English.
const settingsNav = [
    { id: 'info',          icon: 'info',           labelKey: 'admin.settings.navInfo'          },
    { id: 'structure',     icon: 'layers',         labelKey: 'admin.settings.navStructure'     },
    { id: 'subjects',      icon: 'book',           labelKey: 'admin.settings.navSubjects'      },
    { id: 'rooms',         icon: 'meeting_room',   labelKey: 'admin.settings.navRooms'         },
    { id: 'rollover',      icon: 'restart_alt',    labelKey: 'admin.settings.navRollover'      },
    { id: 'calendar',      icon: 'calendar_month', labelKey: 'admin.settings.navCalendar'      },
    { id: 'notifications', icon: 'notifications',  labelKey: 'admin.settings.navNotifications' },
    { id: 'access',        icon: 'security',       labelKey: 'admin.settings.navAccess'        },
    { id: 'backup',        icon: 'backup',         labelKey: 'admin.settings.navBackup'        },
]

const LIVE_SECTIONS = ['info', 'structure', 'subjects', 'rooms', 'rollover']

// ── Shared small components ───────────────────────────────────────────────────

function TypeBlock({ typeName, subjects, onRenameType, onDeleteType, onAddLesson, onRenameLesson, onDeleteLesson }) {
    const { t } = useTranslation()
    const [editingType,   setEditingType]   = useState(false)
    const [typeDraft,     setTypeDraft]     = useState(typeName)
    const [lessonName,    setLessonName]    = useState('')
    const [lessonCode,    setLessonCode]    = useState('')
    const [lessonErr,     setLessonErr]     = useState('')
    const [editingLesson, setEditingLesson] = useState(null)
    const [lessonDraft,   setLessonDraft]   = useState('')

    function commitTypeRename() {
        const val = typeDraft.trim()
        if (val && val !== typeName) onRenameType(typeName, val)
        setEditingType(false)
    }

    async function handleAddLesson() {
        if (!lessonName.trim() || !lessonCode.trim()) { setLessonErr(t('settings.nameCodeRequired')); return }
        try {
            await onAddLesson(lessonName.trim(), lessonCode.trim().toUpperCase(), typeName)
            setLessonName(''); setLessonCode(''); setLessonErr('')
        } catch (e) { setLessonErr(e.message || t('settings.addLessonFailed')) }
    }

    function commitLessonRename(id) {
        if (lessonDraft.trim()) onRenameLesson(id, lessonDraft.trim())
        setEditingLesson(null)
    }

    return (
        <div className="adm-editblock adm-editblock-pad">
            <div className="adm-editblock-head">
                {editingType ? (
                    <>
                        <input className="form-input adm-input-grow" value={typeDraft}
                            onChange={e => setTypeDraft(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') commitTypeRename(); if (e.key === 'Escape') { setEditingType(false); setTypeDraft(typeName) } }}
                            autoFocus />
                        <button className="btn btn-primary btn-sm" onClick={commitTypeRename}>{t('common.save')}</button>
                        <button className="btn btn-outline btn-sm" onClick={() => { setEditingType(false); setTypeDraft(typeName) }}>{t('common.cancel')}</button>
                    </>
                ) : (
                    <>
                        <span className="adm-type-title">{typeName}</span>
                        <span className="adm-set-count u-fs-075">{t('settings.lessonCount', { count: subjects.length })}</span>
                        <button className="btn-icon-clean adm-icon-muted" onClick={() => setEditingType(true)} title={t('settings.renameType')}>
                            <span className="material-symbols-rounded u-fs-1">edit</span>
                        </button>
                        <div className="adm-spacer" />
                        <button className="btn-icon-clean adm-icon-danger" onClick={() => onDeleteType(typeName)} title={t('settings.deleteType')}>
                            <span className="material-symbols-rounded u-fs-1">delete</span>
                        </button>
                    </>
                )}
            </div>

            {subjects.map(s => (
                <div key={s.id} className="adm-lesson-row">
                    {editingLesson === s.id ? (
                        <>
                            <input className="form-input adm-input-grow" value={lessonDraft}
                                onChange={e => setLessonDraft(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') commitLessonRename(s.id); if (e.key === 'Escape') setEditingLesson(null) }}
                                autoFocus />
                            <button className="btn btn-primary btn-sm" onClick={() => commitLessonRename(s.id)}>{t('common.save')}</button>
                            <button className="btn btn-outline btn-sm" onClick={() => setEditingLesson(null)}>{t('common.cancel')}</button>
                        </>
                    ) : (
                        <>
                            <span className="adm-lesson-name">{s.name}</span>
                            <span className="adm-lesson-code">{s.code}</span>
                            <button className="btn-icon-clean adm-icon-muted" onClick={() => { setEditingLesson(s.id); setLessonDraft(s.name) }} title={t('common.rename')}>
                                <span className="material-symbols-rounded u-fs-095">edit</span>
                            </button>
                            <button className="btn-icon-clean adm-icon-danger" onClick={() => onDeleteLesson(s.id)} title={t('common.delete')}>
                                <span className="material-symbols-rounded u-fs-095">delete</span>
                            </button>
                        </>
                    )}
                </div>
            ))}

            {subjects.length === 0 && <p className="adm-lesson-empty">{t('settings.noLessons')}</p>}

            <div className="adm-lesson-add">
                <input className="form-input adm-input-lesson"
                    value={lessonName} onChange={e => setLessonName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddLesson()}
                    placeholder={t('settings.lessonNamePlaceholder')} />
                <input className="form-input adm-input-code"
                    value={lessonCode} onChange={e => setLessonCode(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddLesson()}
                    placeholder={t('settings.lessonCodePlaceholder')} />
                <button className="btn btn-outline btn-sm" onClick={handleAddLesson}>
                    <span className="material-symbols-rounded icon-sm">add</span> {t('settings.lesson')}
                </button>
            </div>
            {lessonErr && <p className="adm-inline-err">{lessonErr}</p>}
        </div>
    )
}

// ── Section components ────────────────────────────────────────────────────────

function SchoolInfoSection() {
    const { t } = useTranslation()
    const toast = useToast()
    const { setting, loading: settingsLoading } = useSchoolSettings()
    const [schoolName, setSchoolName] = useState('')
    const [timezone,   setTimezone]   = useState('Africa/Kigali')
    const [currency,   setCurrency]   = useState('RWF')
    const [saving,     setSaving]     = useState(false)
    const [saved,      setSaved]      = useState(false)

    useEffect(() => {
        if (!settingsLoading) {
            setSchoolName(setting.school_name || '')
            setTimezone(setting.timezone || 'Africa/Kigali')
            setCurrency(setting.currency || 'RWF')
        }
    }, [settingsLoading, setting])

    async function handleSave() {
        setSaving(true)
        try {
            await updateSchoolSettings({ school_name: schoolName, timezone, currency })
            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        } catch (e) {
            toast.error(errorMessage(e, t('admin.settings.saveInfoFailed')))
        }
        finally { setSaving(false) }
    }

    if (settingsLoading) return <p className="adm-set-note">{t('common.loading')}</p>

    return (
        <div className="u-flex u-col u-gap-125">
            <div className="settings-block">
                <div className="settings-block-label">
                    <p className="settings-block-title">{t('admin.settings.schoolName')}</p>
                    <p className="settings-block-desc">{t('admin.settings.schoolNameDesc')}</p>
                </div>
                <div className="settings-block-input-row">
                    <input
                        className="form-input flex-1"
                        value={schoolName}
                        onChange={e => { setSchoolName(e.target.value); setSaved(false) }}
                        placeholder={t('admin.settings.schoolNamePlaceholder')}
                    />
                </div>
            </div>

            <div className="settings-block">
                <div className="settings-block-label">
                    <p className="settings-block-title">{t('settings.currency')}</p>
                    <p className="settings-block-desc">{t('settings.currencyDesc')}</p>
                </div>
                <div className="settings-block-input-row">
                    <select
                        className="disc-picker-select flex-1"
                        value={currency}
                        onChange={e => { setCurrency(e.target.value); setSaved(false) }}
                    >
                        <option value="RWF">{t('settings.currencyRwf')}</option>
                        <option value="KES">{t('settings.currencyKes')}</option>
                        <option value="UGX">{t('settings.currencyUgx')}</option>
                        <option value="TZS">{t('settings.currencyTzs')}</option>
                        <option value="BIF">{t('settings.currencyBif')}</option>
                        <option value="USD">{t('settings.currencyUsd')}</option>
                        <option value="EUR">{t('settings.currencyEur')}</option>
                    </select>
                </div>
            </div>

            <div className="settings-block">
                <div className="settings-block-label">
                    <p className="settings-block-title">{t('settings.timezone')}</p>
                    <p className="settings-block-desc">{t('settings.timezoneDesc')}</p>
                </div>
                <div className="settings-block-input-row">
                    <select
                        className="disc-picker-select flex-1"
                        value={timezone}
                        onChange={e => { setTimezone(e.target.value); setSaved(false) }}
                    >
                        <optgroup label={t('settings.tzEastAfrica')}>
                            <option value="Africa/Kigali">Africa/Kigali (Rwanda, UTC+3)</option>
                            <option value="Africa/Nairobi">Africa/Nairobi (Kenya, Uganda, Tanzania, UTC+3)</option>
                            <option value="Africa/Kampala">Africa/Kampala (Uganda, UTC+3)</option>
                            <option value="Africa/Dar_es_Salaam">Africa/Dar_es_Salaam (Tanzania, UTC+3)</option>
                            <option value="Africa/Addis_Ababa">Africa/Addis_Ababa (Ethiopia, UTC+3)</option>
                        </optgroup>
                        <optgroup label={t('settings.tzWestAfrica')}>
                            <option value="Africa/Lagos">Africa/Lagos (Nigeria, UTC+1)</option>
                            <option value="Africa/Accra">Africa/Accra (Ghana, UTC+0)</option>
                            <option value="Africa/Abidjan">Africa/Abidjan (Ivory Coast, UTC+0)</option>
                            <option value="Africa/Dakar">Africa/Dakar (Senegal, UTC+0)</option>
                        </optgroup>
                        <optgroup label={t('settings.tzSouthernAfrica')}>
                            <option value="Africa/Johannesburg">Africa/Johannesburg (South Africa, UTC+2)</option>
                            <option value="Africa/Harare">Africa/Harare (Zimbabwe, UTC+2)</option>
                            <option value="Africa/Lusaka">Africa/Lusaka (Zambia, UTC+2)</option>
                        </optgroup>
                        <optgroup label={t('settings.tzNorthAfrica')}>
                            <option value="Africa/Cairo">Africa/Cairo (Egypt, UTC+2)</option>
                            <option value="Africa/Casablanca">Africa/Casablanca (Morocco, UTC+1)</option>
                        </optgroup>
                        <optgroup label={t('settings.tzEurope')}>
                            <option value="Europe/London">Europe/London (UK, UTC+0/+1)</option>
                            <option value="Europe/Paris">Europe/Paris (France, Belgium, UTC+1/+2)</option>
                        </optgroup>
                        <optgroup label={t('settings.tzAmericas')}>
                            <option value="America/New_York">America/New_York (US East, UTC-5/-4)</option>
                            <option value="America/Los_Angeles">America/Los_Angeles (US West, UTC-8/-7)</option>
                        </optgroup>
                    </select>
                </div>
            </div>

            <div>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    <span className="material-symbols-rounded">{saved ? 'check' : 'save'}</span>
                    {saved ? t('settings.savedBang') : saving ? t('common.saving') : t('admin.settings.saveChanges')}
                </button>
            </div>
        </div>
    )
}

function SubjectsSection() {
    const { t } = useTranslation()
    const toast = useToast()
    const [subjects,    setSubjects]    = useState([])
    const [newTypeName, setNewTypeName] = useState('')

    useEffect(() => {
        getSubjects().then(setSubjects).catch(e => toast.error(errorMessage(e, t('settings.loadSubjectsFailed'))))
    }, [])

    function handleAddType() {
        const val = newTypeName.trim()
        if (!val || subjects.some(s => s.category === val)) return
        setNewTypeName('')
        setSubjects(prev => [...prev, { id: `__type_${val}`, name: '', code: '', category: val, _placeholder: true }])
    }

    async function handleAddLesson(name, code, category) {
        const created = await createSubject({ name, code, category })
        setSubjects(prev => prev.filter(s => !s._placeholder || s.category !== category).concat(created).sort((a, b) => a.name.localeCompare(b.name)))
    }

    async function handleRenameType(oldName, newName) {
        await renameSubjectCategory(oldName, newName)
        setSubjects(prev => prev.map(s => s.category === oldName ? { ...s, category: newName } : s))
    }

    async function handleDeleteType(name) {
        await deleteSubjectCategory(name)
        setSubjects(prev => prev.filter(s => s.category !== name))
    }

    async function handleRenameLesson(id, name) {
        const updated = await updateSubject(id, { name })
        setSubjects(prev => prev.map(s => s.id === id ? updated : s))
    }

    async function handleDeleteLesson(id) {
        await deleteSubject(id)
        setSubjects(prev => prev.filter(s => s.id !== id))
    }

    const subjectsByType = subjects
        .filter(s => !s._placeholder || s.category)
        .reduce((acc, s) => {
            const cat = s.category || 'Uncategorised'
            if (!acc[cat]) acc[cat] = []
            if (!s._placeholder) acc[cat].push(s)
            else if (!acc[cat].length) acc[cat] = []
            return acc
        }, {})

    const typeCount   = Object.keys(subjectsByType).length
    const lessonCount = subjects.filter(s => !s._placeholder).length

    return (
        <div>
            <div className="u-row-sm u-mb">
                <span className="adm-set-count">
                    {t('settings.typeCount', { count: typeCount })} · {t('settings.lessonCount', { count: lessonCount })}
                </span>
            </div>

            <div className="settings-block">
                <div className="settings-block-label">
                    <p className="settings-block-title">{t('settings.addSubjectType')}</p>
                    <p className="settings-block-desc">{t('settings.addSubjectTypeDesc')}</p>
                </div>
                <div className="settings-block-input-row u-mt-sm">
                    <input
                        className="form-input flex-1"
                        value={newTypeName}
                        onChange={e => setNewTypeName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddType()}
                        placeholder={t('settings.egSciences')}
                    />
                    <button className="btn btn-primary btn-sm" onClick={handleAddType}>
                        <span className="material-symbols-rounded icon-sm">add</span> {t('settings.addType')}
                    </button>
                </div>
            </div>

            {Object.entries(subjectsByType).map(([typeName, lessons]) => (
                <TypeBlock
                    key={typeName}
                    typeName={typeName}
                    subjects={lessons}
                    onRenameType={handleRenameType}
                    onDeleteType={handleDeleteType}
                    onAddLesson={handleAddLesson}
                    onRenameLesson={handleRenameLesson}
                    onDeleteLesson={handleDeleteLesson}
                />
            ))}

            {typeCount === 0 && (
                <p className="u-muted u-sm u-mt-075">
                    {t('settings.noTypes')}
                </p>
            )}
        </div>
    )
}

function RoomsSection() {
    const { t } = useTranslation()
    const toast = useToast()
    const [rooms,     setRooms]     = useState([])
    const [roomInput, setRoomInput] = useState('')
    const [roomErr,   setRoomErr]   = useState('')

    useEffect(() => {
        getDosRooms().then(data => setRooms(data)).catch(e => toast.error(errorMessage(e, t('settings.loadRoomsFailed'))))
    }, [])

    async function handleAddRoom() {
        const name = roomInput.trim()
        if (!name) return
        if (rooms.some(r => r.name.toLowerCase() === name.toLowerCase())) {
            setRoomErr(t('settings.roomExists')); return
        }
        try {
            const newRoom = await createDosRoom(name)
            setRooms(prev => [...prev, newRoom].sort((a, b) => a.name.localeCompare(b.name)))
            setRoomInput('')
            setRoomErr('')
        } catch (e) { setRoomErr(e.message || t('settings.addRoomFailed')) }
    }

    async function handleDeleteRoom(id) {
        try {
            await deleteDosRoom(id)
            setRooms(prev => prev.filter(r => r.id !== id))
        } catch (e) {
            toast.error(errorMessage(e, t('settings.deleteRoomFailed')))
        }
    }

    return (
        <div>
            <div className="settings-block">
                <div className="settings-block-label">
                    <p className="settings-block-title">{t('settings.addRoom')}</p>
                    <p className="settings-block-desc">{t('settings.addRoomDesc')}</p>
                </div>
                <div className="settings-block-input-row u-mt-sm">
                    <input
                        className="form-input flex-1"
                        value={roomInput}
                        onChange={e => { setRoomInput(e.target.value); setRoomErr('') }}
                        onKeyDown={e => e.key === 'Enter' && handleAddRoom()}
                        placeholder={t('settings.roomPlaceholder')}
                    />
                    <button className="btn btn-primary btn-sm" onClick={handleAddRoom}>
                        <span className="material-symbols-rounded icon-sm">add</span> {t('common.add')}
                    </button>
                </div>
                {roomErr && <p className="adm-inline-err">{roomErr}</p>}
            </div>

            <div className="tag-list u-mt-075">
                {rooms.map(r => (
                    <span key={r.id} className="tag-chip">
                        <span className="material-symbols-rounded adm-room-icon">meeting_room</span>
                        {r.name}
                        <button className="tag-chip-remove" onClick={() => handleDeleteRoom(r.id)}>
                            <span className="material-symbols-rounded">close</span>
                        </button>
                    </span>
                ))}
                {rooms.length === 0 && <span className="tag-chip-empty">{t('settings.noRooms')}</span>}
            </div>

            <p className="u-xs u-muted u-mt">
                {t('settings.roomCount', { count: rooms.length })}
            </p>
        </div>
    )
}

// ── Term Rollover ─────────────────────────────────────────────────────────────

function TermRolloverSection() {
    const { t } = useTranslation()
    // The school's own terms, not a hard-coded term1/2/3 — a semester system has
    // two and a quarter system four.
    const { setting } = useSchoolSettings()
    const { config } = useSchoolConfig()
    const termOptions = setting.terms ?? []
    const years = yearsFromConfig(config)
    const finalYear = years[years.length - 1]

    const [currentTerm, setCurrentTerm] = useState(null)
    const [step, setStep]       = useState(1)          // 1 form → 2 preview → 3 done
    const [form, setForm] = useState({ term: '', year: '', name: '', start_date: '', end_date: '' })
    const [preview, setPreview] = useState(null)
    const [result, setResult]   = useState(null)
    const [busy, setBusy]       = useState(false)
    const [error, setError]     = useState(null)

    useEffect(() => {
        getCurrentTerm().then(setCurrentTerm).catch(() => setCurrentTerm(null))
    }, [])

    // Preselect the school's first term once its configuration arrives, so the
    // dropdown is never empty. The list is loaded, not hard-coded, so the
    // default has to wait for it.
    useEffect(() => {
        if (!form.term && termOptions.length) set('term', termOptions[0].code)
    }, [termOptions])   // eslint-disable-line react-hooks/exhaustive-deps

    function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

    const isValid = form.term && form.year && form.name.trim() && form.start_date && form.end_date

    async function handlePreview() {
        setBusy(true); setError(null)
        try {
            const data = await runTermRollover({ ...form, name: form.name.trim(), dry_run: true })
            setPreview(data)
            setStep(2)
        } catch (err) {
            setError(err?.response?.data?.error || t('admin.settings.previewFailed'))
        } finally {
            setBusy(false)
        }
    }

    async function handleExecute() {
        setBusy(true); setError(null)
        try {
            const data = await runTermRollover({ ...form, name: form.name.trim(), dry_run: false })
            setResult(data)
            setStep(3)
        } catch (err) {
            setError(err?.response?.data?.error || t('admin.settings.rolloverFailed'))
        } finally {
            setBusy(false)
        }
    }

    const summaryRows = (data) => [
        {
            label: t('admin.settings.mode'),
            value: data.mode === 'promotion' ? t('admin.settings.modePromotion') : t('admin.settings.modeCarry'),
        },
        { label: t('admin.settings.studentsPromoted'), value: data.students_promoted },
        {
            label: finalYear
                ? t('admin.settings.studentsGraduatingYear', { year: finalYear })
                : t('admin.settings.studentsGraduating'),
            value: data.students_graduated,
        },
        { label: t('admin.settings.rostersCreated'), value: data.rosters_created },
    ]

    return (
        <div>
            <p className="u-muted u-mb u-fs-085">
                {t('admin.settings.currentTermLabel')} <strong>{currentTerm?.name || '-'}</strong>{' '}
                {finalYear
                    ? t('admin.settings.rolloverIntroFinal', { year: finalYear })
                    : t('admin.settings.rolloverIntro')}
            </p>

            {step === 1 && (
                <>
                    <div className="adm-ro-grid">
                        <div>
                            <label className="form-label" htmlFor="ro-term">{t('admin.settings.newTerm')}</label>
                            <select id="ro-term" className="form-input" value={form.term} onChange={e => set('term', e.target.value)}>
                                {termOptions.map(opt => <option key={opt.code} value={opt.code}>{opt.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label" htmlFor="ro-year">{t('common.year')}</label>
                            <input id="ro-year" type="number" className="form-input" placeholder={t('admin.settings.egYear')}
                                value={form.year} onChange={e => set('year', e.target.value)} />
                        </div>
                        <div>
                            <label className="form-label" htmlFor="ro-name">{t('admin.settings.displayName')}</label>
                            <input id="ro-name" className="form-input" placeholder={t('admin.settings.egTermName')}
                                value={form.name} onChange={e => set('name', e.target.value)} />
                        </div>
                        <div>
                            <label className="form-label" htmlFor="ro-start">{t('common.startDate')}</label>
                            <input id="ro-start" type="date" className="form-input"
                                value={form.start_date} onChange={e => set('start_date', e.target.value)} />
                        </div>
                        <div>
                            <label className="form-label" htmlFor="ro-end">{t('common.endDate')}</label>
                            <input id="ro-end" type="date" className="form-input"
                                value={form.end_date} onChange={e => set('end_date', e.target.value)} />
                        </div>
                    </div>
                    {error && <p className="adm-ro-err">{error}</p>}
                    <button className="btn btn-primary" onClick={handlePreview} disabled={!isValid || busy}>
                        <span className="material-symbols-rounded icon-sm">visibility</span>
                        {busy ? t('admin.settings.checking') : t('admin.settings.previewRollover')}
                    </button>
                </>
            )}

            {step === 2 && preview && (
                <>
                    <div className="adm-ro-panel">
                        <p className="u-strong u-mb-sm">
                            {preview.current_term} → {preview.new_term}
                        </p>
                        {summaryRows(preview).map(row => (
                            <div key={row.label} className="adm-ro-sumrow">
                                <span className="u-muted">{row.label}</span>
                                <strong>{row.value}</strong>
                            </div>
                        ))}
                        {preview.missing_classes?.length > 0 && (
                            <p className="adm-ro-warn">
                                <span className="material-symbols-rounded adm-ro-warn-icon">warning</span>{' '}
                                {t('admin.settings.missingClasses', { list: preview.missing_classes.join(', ') })}
                            </p>
                        )}
                    </div>
                    <p className="adm-ro-danger">
                        {t('admin.settings.rolloverDanger', { term: preview.current_term })}
                    </p>
                    {error && <p className="adm-ro-err">{error}</p>}
                    <div className="u-row-sm">
                        <button className="btn btn-outline" onClick={() => setStep(1)} disabled={busy}>{t('common.back')}</button>
                        <button className="btn btn-primary" onClick={handleExecute} disabled={busy}>
                            <span className="material-symbols-rounded icon-sm">restart_alt</span>
                            {busy ? t('admin.settings.rollingOver') : t('admin.settings.runRollover')}
                        </button>
                    </div>
                </>
            )}

            {step === 3 && result && (
                <div className="adm-ro-done">
                    <span className="material-symbols-rounded adm-ro-done-icon">check_circle</span>
                    <p className="adm-ro-done-title">
                        {t('admin.settings.rolloverDone', { term: result.new_term })}
                    </p>
                    <p className="u-muted u-fs-085">
                        {t('admin.settings.rolloverSummary', {
                            promoted: result.students_promoted,
                            graduated: result.students_graduated,
                            rosters: result.rosters_created,
                        })}
                    </p>
                </div>
            )}
        </div>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminSettings() {
    const { t } = useTranslation()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [activeSection, setActiveSection] = useState('info')

    const activeItem = settingsNav.find(item => item.id === activeSection)

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={adminNavItems} secondaryItems={adminSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('nav.settings')}
                        subtitle={t('admin.settings.subtitle')}
                        {...adminUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        <div className="adm-settings-grid">

                            {/* Left nav */}
                            <nav className="adm-settings-nav">
                                {settingsNav.map(item => (
                                    <button
                                        key={item.id}
                                        className={`adm-settings-nav-item${activeSection === item.id ? ' active' : ''}`}
                                        onClick={() => setActiveSection(item.id)}
                                    >
                                        <span className="material-symbols-rounded">{item.icon}</span>
                                        {t(item.labelKey)}
                                        {!LIVE_SECTIONS.includes(item.id) && (
                                            <span className="adm-soon-tag">{t('common.soon')}</span>
                                        )}
                                    </button>
                                ))}
                            </nav>

                            {/* Right content */}
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">{activeItem && t(activeItem.labelKey)}</h2>
                                </div>
                                <div className="card-content">

                                    {activeSection === 'info'      && <SchoolInfoSection />}
                                    {activeSection === 'structure' && <SchoolStructureEditor />}
                                    {activeSection === 'subjects'  && <SubjectsSection />}
                                    {activeSection === 'rooms'     && <RoomsSection />}
                                    {activeSection === 'rollover'  && <TermRolloverSection />}

                                    {!LIVE_SECTIONS.includes(activeSection) && (
                                        <div className="coming-soon">
                                            <span className="material-symbols-rounded coming-soon-icon">construction</span>
                                            <p className="coming-soon-title">{activeItem && t(activeItem.labelKey)}</p>
                                            <p className="coming-soon-desc">{t('admin.settings.comingSoon')}</p>
                                        </div>
                                    )}

                                </div>
                            </div>

                        </div>
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
