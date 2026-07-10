import { LiveMessages } from '../../components/messaging/LiveMessages'
import { studentNavItems, studentSecondaryItems } from './studentNav'
import { useSessionUser } from '../../hooks/useSessionUser'

export function StudentMessages() {
    const sessionUser = useSessionUser()
    return (
        <LiveMessages
            navItems={studentNavItems}
            secondaryItems={studentSecondaryItems}
            title="Messages"
            subtitle="Communicate with your teachers"
            {...sessionUser}
        />
    )
}
