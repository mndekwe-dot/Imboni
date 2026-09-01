import { SubscriptionBanner } from './SubscriptionBanner'

export function DashboardContent({ children }) {
    return (
        <div className="dashboard-content">
            <div className="dc-inner">
                {/* Every portal renders through here, so the school's billing
                    standing is announced once rather than seven times. */}
                <SubscriptionBanner />
                {children}
            </div>
        </div>
    )
}
