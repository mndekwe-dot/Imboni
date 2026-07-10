import { LiveMessages } from '../../components/messaging/LiveMessages'
import { parentNavItems, parentSecondaryItems } from './parentNav'
import { useSessionUser } from '../../hooks/useSessionUser'

export function ParentMessages() {
    const sessionUser = useSessionUser()
    return (
        <LiveMessages
            navItems={parentNavItems}
            secondaryItems={parentSecondaryItems}
            title="Messages"
            subtitle="Communicate with teachers and school staff"
            {...sessionUser}
        />
    )
}
