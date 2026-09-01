import { useTranslation } from 'react-i18next'

import { LiveMessages } from '../../components/messaging/LiveMessages'
import { useSessionUser } from '../../hooks/useSessionUser'
import { bursarNavItems, bursarSecondaryItems } from './bursarNav'

export function FinanceMessages() {
    const { t } = useTranslation()
    const sessionUser = useSessionUser()
    return (
        <LiveMessages
            navItems={bursarNavItems}
            secondaryItems={bursarSecondaryItems}
            title={t('nav.messages')}
            subtitle={t('finance.messages.subtitle')}
            {...sessionUser}
        />
    )
}
