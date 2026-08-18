import { LiveMessages } from '../../components/messaging/LiveMessages'
import { useTranslation } from 'react-i18next'
import { teacherNavItems, teacherSecondaryItems } from './teacherNav'
import { useSessionUser } from '../../hooks/useSessionUser'

export function TeacherMessages() {
    const { t } = useTranslation()
    const sessionUser = useSessionUser()
    return (
        <LiveMessages
            navItems={teacherNavItems}
            secondaryItems={teacherSecondaryItems}
            title={t('nav.messages')}
            subtitle={t('teacher.messages.subtitle')}
            {...sessionUser}
        />
    )
}
