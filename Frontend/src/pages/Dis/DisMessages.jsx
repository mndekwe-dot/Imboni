import { LiveMessages } from '../../components/messaging/LiveMessages'
import { useTranslation } from 'react-i18next'
import { disNavItems, disSecondaryItems } from './disNav'
import { useSessionUser } from '../../hooks/useSessionUser'

export function DisMessages() {
    const { t } = useTranslation()
    const sessionUser = useSessionUser()
    return (
        <LiveMessages
            navItems={disNavItems}
            secondaryItems={disSecondaryItems}
            title={t('nav.messages')}
            subtitle={t('dis.messages.subtitle')}
            {...sessionUser}
        />
    )
}
