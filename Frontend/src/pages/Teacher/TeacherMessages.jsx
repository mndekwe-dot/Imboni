import { LiveMessages } from '../../components/messaging/LiveMessages'
import { teacherNavItems, teacherSecondaryItems } from './teacherNav'
import { useSessionUser } from '../../hooks/useSessionUser'

export function TeacherMessages() {
    const sessionUser = useSessionUser()
    return (
        <LiveMessages
            navItems={teacherNavItems}
            secondaryItems={teacherSecondaryItems}
            title="Messages"
            subtitle="Communicate with parents and staff"
            {...sessionUser}
        />
    )
}
