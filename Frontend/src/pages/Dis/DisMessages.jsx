import { LiveMessages } from '../../components/messaging/LiveMessages'
import { disNavItems, disSecondaryItems } from './disNav'
import { useSessionUser } from '../../hooks/useSessionUser'

export function DisMessages() {
    const sessionUser = useSessionUser()
    return (
        <LiveMessages
            navItems={disNavItems}
            secondaryItems={disSecondaryItems}
            title="Messages"
            subtitle="Communicate with matrons, patrons, students & parents"
            {...sessionUser}
        />
    )
}
