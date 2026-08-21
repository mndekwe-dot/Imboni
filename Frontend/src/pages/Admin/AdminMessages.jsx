import { LiveMessages } from '../../components/messaging/LiveMessages'
import { useTranslation } from 'react-i18next'
import { adminNavItems, adminSecondaryItems } from './adminNav'
import { useSessionUser } from '../../hooks/useSessionUser'

export function AdminMessages() {
    const { t } = useTranslation()
    const sessionUser = useSessionUser()
    return (
        <LiveMessages
            navItems={adminNavItems}
            secondaryItems={adminSecondaryItems}
            title={t('nav.messages')}
            subtitle={t('admin.messages.subtitle')}
            {...sessionUser}
        />
    )
}
