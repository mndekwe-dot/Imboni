import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { EmptyState } from '../../components/ui/EmptyState'
import { ClassPicker } from '../../components/ui/ClassPicker'
import { MaterialList } from '../../components/materials/MaterialList'
import { MaterialFormModal } from '../../components/materials/MaterialFormModal'
import { useNotifications } from '../../hooks/useNotifications'
import { useSchoolConfig } from '../../hooks/useSchoolConfig'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { sectionsFromClasses } from '../../utils/classes'
import { toList } from '../../api/client'
import { getTeacherMaterials, deleteTeacherMaterial, getTeacherMyClasses } from '../../api/teacher'
import { teacherNavItems, teacherSecondaryItems } from './teacherNav'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/teacher.css'

/**
 * Notes, slides, past papers and video links a teacher shares with a class.
 *
 * The only upload a teacher had was the worksheet on an assignment, so
 * anything that was not set work had no home. Students find these under
 * Materials, and parents see the same list for their child.
 */
export function TeacherMaterials() {
    const { t } = useTranslation()
    const toast = useToast()
    const { config } = useSchoolConfig()
    const { notifications: liveNotifications, markRead } = useNotifications()

    const [materials,     setMaterials]     = useState([])
    const [classSubjects, setClassSubjects] = useState([])
    const [loading,       setLoading]       = useState(true)
    const [loadError,     setLoadError]     = useState(null)
    const [editing,       setEditing]       = useState(null)   // null | 'new' | material
    const [busyId,        setBusyId]        = useState(null)
    const [section,  setSection]  = useState('')
    const [year,     setYear]     = useState('')
    const [classVal, setClassVal] = useState('')

    const load = useCallback(async () => {
        try {
            const [list, classes] = await Promise.all([getTeacherMaterials(), getTeacherMyClasses()])
            setMaterials(toList(list))
            setClassSubjects(toList(classes))
            setLoadError(null)
        } catch (e) {
            const message = errorMessage(e, t('materials.loadFailed'))
            setLoadError(message)
            toast.error(message)
        } finally {
            setLoading(false)
        }
    }, [t, toast])

    useEffect(() => { load() }, [load])

    // The picker offers only the classes this teacher teaches.
    const classById = useMemo(() => new Map(classSubjects.map(cs =>
        [String(cs.class_id), { grade: cs.grade, section: cs.section }])), [classSubjects])
    const sections = useMemo(() => sectionsFromClasses([...classById.values()], config),
        [classById, config])
    const classFiltered = Boolean(section || year || classVal)

    const visible = materials.filter(m => {
        if (!classFiltered) return true
        const cls = classById.get(String(m.class_id))
        if (!cls) return false
        if (section && !sections.find(s => s.name === section)?.years.some(y => y.name === cls.grade)) return false
        if (year && cls.grade !== year) return false
        if (classVal && cls.section !== classVal) return false
        return true
    })

    function saved(material) {
        setMaterials(prev => [material, ...prev.filter(m => m.id !== material.id)])
        setEditing(null)
    }

    async function remove(material) {
        if (!window.confirm(t('materials.confirmDelete', { title: material.title }))) return
        setBusyId(material.id)
        try {
            await deleteTeacherMaterial(material.id)
            setMaterials(prev => prev.filter(m => m.id !== material.id))
            toast.success(t('materials.deleted'))
        } catch (e) {
            toast.error(errorMessage(e, t('materials.deleteFailed')))
        } finally {
            setBusyId(null)
        }
    }

    const noClasses = !loading && !loadError && classSubjects.length === 0

    return (
        <div className="dashboard-page" data-portal="teacher">
            <div className="dashboard-layout">
                <Sidebar navItems={teacherNavItems} secondaryItems={teacherSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('materials.teacherTitle')}
                        subtitle={t('materials.teacherSubtitle')}
                        userRole={t('roles.teacher')}
                        avatarClass="teacher-av"
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                        actions={
                            <button className="btn btn-primary" onClick={() => setEditing('new')}
                                disabled={loading || classSubjects.length === 0}>
                                <span className="material-symbols-rounded icon-sm" aria-hidden="true">add</span>
                                {t('materials.share')}
                            </button>
                        }
                    />
                    <DashboardContent>
                        {loading ? (
                            <p className="u-muted">{t('common.loading')}</p>
                        ) : loadError ? (
                            <p className="form-error">{loadError}</p>
                        ) : noClasses ? (
                            <p className="notice-banner">{t('materials.noClasses')}</p>
                        ) : (
                            <>
                                <ClassPicker
                                    sections={sections}
                                    section={section}   onSectionChange={setSection}
                                    year={year}         onYearChange={setYear}
                                    classVal={classVal} onClassChange={setClassVal}
                                />
                                {materials.length === 0 ? (
                                    <EmptyState icon="folder_open"
                                        title={t('materials.emptyTeacherTitle')}
                                        description={t('materials.emptyTeacherMessage')}
                                        action={{ label: t('materials.share'), onClick: () => setEditing('new') }} />
                                ) : visible.length === 0 ? (
                                    <p className="empty-note padded">{t('materials.noneForClass')}</p>
                                ) : (
                                    <MaterialList materials={visible} showClass actions={m => (<>
                                        <button className="btn btn-outline btn-sm" onClick={() => setEditing(m)}
                                            aria-label={`${t('common.edit')} ${m.title}`}>
                                            <span className="material-symbols-rounded icon-sm" aria-hidden="true">edit</span>
                                        </button>
                                        <button className="btn btn-outline btn-sm" onClick={() => remove(m)}
                                            disabled={busyId === m.id}
                                            aria-label={`${t('common.delete')} ${m.title}`}>
                                            <span className="material-symbols-rounded icon-sm" aria-hidden="true">delete</span>
                                        </button>
                                    </>)} />
                                )}
                            </>
                        )}
                    </DashboardContent>
                </main>
            </div>
            {editing && (
                <MaterialFormModal
                    material={editing === 'new' ? null : editing}
                    classSubjects={classSubjects}
                    onClose={() => setEditing(null)}
                    onSaved={saved}
                />
            )}
        </div>
    )
}
