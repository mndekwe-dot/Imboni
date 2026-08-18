import { LiveMessages } from '../../components/messaging/LiveMessages'
import { useTranslation } from 'react-i18next'
import { parentNavItems, parentSecondaryItems } from './parentNav'
import { useSessionUser } from '../../hooks/useSessionUser'

export function ParentMessages() {
    const { t } = useTranslation()
    const sessionUser = useSessionUser()
    return (
        <LiveMessages
            navItems={parentNavItems}
            secondaryItems={parentSecondaryItems}
            title={t('nav.messages')}
            subtitle={t('parent.messages.subtitle')}
            {...sessionUser}
        />
    )
}
