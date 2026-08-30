import { LiveMessages } from '../../components/messaging/LiveMessages'
import { useTranslation } from 'react-i18next'
import { librarianNavItems, librarianSecondaryItems } from './librarianNav'
import { useSessionUser } from '../../hooks/useSessionUser'

export function LibraryMessages() {
    const { t } = useTranslation()
    const sessionUser = useSessionUser()
    return (
        <LiveMessages
            navItems={librarianNavItems}
            secondaryItems={librarianSecondaryItems}
            title={t('nav.messages')}
            subtitle={t('library.messages.subtitle')}
            {...sessionUser}
        />
    )
}
