import { LiveMessages } from '../../components/messaging/LiveMessages'
import { useTranslation } from 'react-i18next'
import { dosNavItems, dosSecondaryItems } from './dosNav'
import { useSessionUser } from '../../hooks/useSessionUser'

export function DosMessages() {
    const { t } = useTranslation()
    const sessionUser = useSessionUser()
    return (
        <LiveMessages
            navItems={dosNavItems}
            secondaryItems={dosSecondaryItems}
            title={t('nav.messages')}
            subtitle={t('dos.messages.subtitle')}
            {...sessionUser}
        />
    )
}
