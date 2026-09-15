import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { TabGroup } from '../../components/ui/TabGroup'
import { FinanceShell } from './FinanceShell'
import { DebtorsPanel } from './FinanceDebtors'
import { ChargesPanel } from './FinanceFees'
import { FeeSetupPanel } from './FinanceStructure'
import { ArrearsPanel } from './FinanceArrears'

const TABS = [
    { key: 'owing', icon: 'account_balance_wallet' },
    { key: 'charges', icon: 'receipt_long' },
    { key: 'setup', icon: 'price_change' },
    { key: 'arrears', icon: 'history' },
]

/**
 * Everything about school fees, on one page.
 *
 * Who owes, the charges behind it, what the school charges, and what is owed
 * from earlier terms were four pages in the menu - three of them lists of the
 * same charges seen from different sides, and the fourth hidden under Other
 * income. The tab lives in the URL, so the old addresses and the dashboard's
 * links still land on the right one.
 */
export function FinanceFeesHub() {
    const { t } = useTranslation()
    const [params, setParams] = useSearchParams()
    const asked = params.get('tab')
    const tab = TABS.some(item => item.key === asked) ? asked : (params.get('status') ? 'charges' : 'owing')

    function choose(key) {
        // Each tab keeps its own filters; carrying "status=overdue" into Who owes means nothing.
        setParams(key === 'owing' ? {} : { tab: key }, { replace: true })
    }

    return (
        <FinanceShell title={t('finance.feesHub.title')} subtitle={t(`finance.feesHub.subtitle.${tab}`)}>
            <TabGroup label={t('finance.feesHub.title')} value={tab} onChange={choose} idPrefix="fees-"
                tabs={TABS.map(item => ({ ...item, label: t(`finance.feesHub.tab.${item.key}`) }))} />
            <div role="tabpanel" id={`fees-panel-${tab}`} aria-labelledby={`fees-tab-${tab}`}>
                {tab === 'owing' && <DebtorsPanel />}
                {tab === 'charges' && <ChargesPanel />}
                {tab === 'setup' && <FeeSetupPanel />}
                {tab === 'arrears' && <ArrearsPanel />}
            </div>
        </FinanceShell>
    )
}
