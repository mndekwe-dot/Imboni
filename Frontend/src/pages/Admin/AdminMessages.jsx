import { LiveMessages } from '../../components/messaging/LiveMessages'
import { adminNavItems, adminSecondaryItems } from './adminNav'
import { useSessionUser } from '../../hooks/useSessionUser'

export function AdminMessages() {
    const sessionUser = useSessionUser()
    return (
        <LiveMessages
            navItems={adminNavItems}
            secondaryItems={adminSecondaryItems}
            title="Messages"
            subtitle="Communicate with staff, department heads and parents"
            {...sessionUser}
        />
    )
}
