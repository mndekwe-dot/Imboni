import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { ClassMaterials } from '../../components/materials/MaterialList'
import { useNotifications } from '../../hooks/useNotifications'
import { useSessionUser } from '../../hooks/useSessionUser'
import { useToast } from '../../context/ToastContext'
import { errorMessage } from '../../utils/errors'
import { toList } from '../../api/client'
import { getMyChildren, getChildMaterials } from '../../api/parent'
import { parentNavItems, parentSecondaryItems } from './parentNav'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/parent.css'

/** What each child's teachers have shared this term, so it can be revised at home. */
export function ParentMaterials() {
    const { t } = useTranslation()
    const toast = useToast()
    const sessionUser = useSessionUser()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [children,      setChildren]      = useState([])
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [loading,       setLoading]       = useState(true)
    const [materials,     setMaterials]     = useState(null)

    useEffect(() => {
        getMyChildren()
            .then(d => setChildren(toList(d)))
            .catch(e => toast.error(errorMessage(e, t('materials.loadFailed'))))
            .finally(() => setLoading(false))
    }, [t, toast])

    const child = children[selectedIndex]

    useEffect(() => {
        if (!child) return
        let live = true
        getChildMaterials(child.id)
            .then(d => { if (live) setMaterials(toList(d)) })
            .catch(e => {
                if (!live) return
                setMaterials([])
                toast.error(errorMessage(e, t('materials.loadFailed')))
            })
        return () => { live = false }
    }, [child, t, toast])

    function pick(index) {
        setMaterials(null)
        setSelectedIndex(index)
    }

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={parentNavItems} secondaryItems={parentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('materials.parentTitle')}
                        subtitle={t('materials.parentSubtitle')}
                        {...sessionUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        {loading ? (
                            <p className="u-pad u-muted">{t('common.loading')}</p>
                        ) : children.length === 0 ? (
                            <p className="u-pad u-muted">{t('materials.noChildren')}</p>
                        ) : (
                            <>
                                {children.length > 1 && (
                                    <div className="flex-row-gap-sm">
                                        <label className="form-label mb-0" htmlFor="parent-materials-child">
                                            {t('materials.child')}
                                        </label>
                                        <select id="parent-materials-child" className="form-input u-w-auto"
                                            value={selectedIndex} onChange={e => pick(Number(e.target.value))}>
                                            {children.map((c, i) => (
                                                <option key={c.id} value={i}>
                                                    {c.student_name} ({c.grade}{c.section})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                {materials === null ? (
                                    <p className="u-pad u-muted">{t('common.loading')}</p>
                                ) : (
                                    <ClassMaterials key={child.id} materials={materials} />
                                )}
                            </>
                        )}
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
