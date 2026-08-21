import { LiveMessages } from '../../components/messaging/LiveMessages'
import { useTranslation } from 'react-i18next'
import { matronNavItems, matronSecondaryItems } from './matronNav'
import { useSessionUser } from '../../hooks/useSessionUser'

export function MatronMessages() {
    const { t } = useTranslation()
    const sessionUser = useSessionUser()
    return (
        <LiveMessages
            navItems={matronNavItems}
            secondaryItems={matronSecondaryItems}
            title={t('nav.messages')}
            subtitle={t('matron.messages.subtitle')}
            {...sessionUser}
        />
    )
}
