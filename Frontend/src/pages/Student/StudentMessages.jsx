import { LiveMessages } from '../../components/messaging/LiveMessages'
import { useTranslation } from 'react-i18next'
import { studentNavItems, studentSecondaryItems } from './studentNav'
import { useSessionUser } from '../../hooks/useSessionUser'

export function StudentMessages() {
    const { t } = useTranslation()
    const sessionUser = useSessionUser()
    return (
        <LiveMessages
            navItems={studentNavItems}
            secondaryItems={studentSecondaryItems}
            title={t('nav.messages')}
            subtitle={t('student.messages.subtitle')}
            {...sessionUser}
        />
    )
}
