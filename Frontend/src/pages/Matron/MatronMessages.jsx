import { LiveMessages } from '../../components/messaging/LiveMessages'
import { matronNavItems, matronSecondaryItems } from './matronNav'
import { useSessionUser } from '../../hooks/useSessionUser'

export function MatronMessages() {
    const sessionUser = useSessionUser()
    return (
        <LiveMessages
            navItems={matronNavItems}
            secondaryItems={matronSecondaryItems}
            title="Messages"
            subtitle="Communicate with the Discipline Master, students & parents"
            {...sessionUser}
        />
    )
}
