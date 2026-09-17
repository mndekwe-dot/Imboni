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
import { getStudentMaterials } from '../../api/student'
import { studentNavItems, studentSecondaryItems } from './studentNav'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/student.css'

/** Notes, slides and videos the class's teachers have shared this term. */
export function StudentMaterials() {
    const { t } = useTranslation()
    const toast = useToast()
    const sessionUser = useSessionUser()
    const { notifications: liveNotifications, markRead } = useNotifications()
    const [materials, setMaterials] = useState([])
    const [loading,   setLoading]   = useState(true)
    const [error,     setError]     = useState(null)

    useEffect(() => {
        getStudentMaterials()
            .then(d => setMaterials(toList(d)))
            .catch(e => {
                const message = errorMessage(e, t('materials.loadFailed'))
                setError(message)
                toast.error(message)
            })
            .finally(() => setLoading(false))
    }, [t, toast])

    return (
        <>
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={studentNavItems} secondaryItems={studentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={t('materials.studentTitle')}
                        subtitle={t('materials.studentSubtitle')}
                        {...sessionUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        {loading ? (
                            <p className="u-pad u-muted">{t('common.loading')}</p>
                        ) : error ? (
                            <p className="form-error">{error}</p>
                        ) : (
                            <ClassMaterials materials={materials} />
                        )}
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
