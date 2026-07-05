import { LiveMessages } from '../../components/messaging/LiveMessages'
import { dosNavItems, dosSecondaryItems } from './dosNav'
import { useSessionUser } from '../../hooks/useSessionUser'

export function DosMessages() {
    const sessionUser = useSessionUser()
    return (
        <LiveMessages
            navItems={dosNavItems}
            secondaryItems={dosSecondaryItems}
            title="Messages"
            subtitle="Communicate with teachers, staff and parents"
            {...sessionUser}
        />
    )
}
