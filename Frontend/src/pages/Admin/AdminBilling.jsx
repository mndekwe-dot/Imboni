import { useState, useEffect } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { DashboardContent } from '../../components/layout/DashboardContent'
import { useNotifications } from '../../hooks/useNotifications'
import { getBillingStatus, startCheckout } from '../../api/billing'
import { adminNavItems, adminSecondaryItems, adminUser } from './adminNav'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/admin.css'

// ── Status banners ────────────────────────────────────────────────────────────
// past_due / suspended / trial each get a coloured banner via the shared
// .u-banner utility (accent set by the modifier class).

const BANNERS = {
    past_due:  { mod: 'warn',    icon: 'warning',  title: 'Payment overdue',
                 body: 'We couldn’t process your latest payment. Update your subscription to avoid losing access.' },
    suspended: { mod: 'danger',  icon: 'block',    title: 'Account suspended',
                 body: 'Subscribe to restore access for your school.' },
    trial:     { mod: 'primary', icon: 'schedule', title: 'You’re on a free trial',
                 body: 'Subscribe to a plan to keep access once your trial ends.' },
}

function StatusBanner({ status, onTrial }) {
    const key = status === 'past_due' || status === 'suspended' ? status : (onTrial ? 'trial' : null)
    const b = key && BANNERS[key]
    if (!b) return null
    return (
        <div className={`card u-banner u-banner--${b.mod} u-mb`}>
            <div className="u-row">
                <span className="material-symbols-rounded u-banner-icon">{b.icon}</span>
                <div>
                    <p className="u-strong u-mb-xs">{b.title}</p>
                    <p className="u-muted u-sm">{b.body}</p>
                </div>
            </div>
        </div>
    )
}

// trial/active/past_due/suspended -> a chip tone
const STATUS_CHIP = {
    trial:     { label: 'Trial',     tone: 'primary' },
    active:    { label: 'Active',    tone: 'success' },
    past_due:  { label: 'Past due',  tone: 'warn' },
    suspended: { label: 'Suspended', tone: 'danger' },
}

// ── Usage meters ──────────────────────────────────────────────────────────────

const USAGE_LABELS = {
    students: { name: 'Students', icon: 'school' },
    staff:    { name: 'Staff',    icon: 'badge' },
}

function UsageMeter({ resourceKey, data }) {
    const meta = USAGE_LABELS[resourceKey] || { name: resourceKey, icon: 'group' }
    const { used, limit, remaining, unlimited } = data
    const pct  = unlimited || !limit ? 0 : Math.min(100, Math.round((used / limit) * 100))
    const full = !unlimited && remaining === 0
    const fillMod = unlimited ? 'unlimited' : full ? 'full' : pct >= 80 ? 'warn' : ''

    return (
        <div className="u-mb">
            <div className="u-row-sm u-mb-xs">
                <span className="material-symbols-rounded u-icon-sm u-muted">{meta.icon}</span>
                <span className="u-strong">{meta.name}</span>
                <span className="u-ml-auto u-sm u-muted">
                    {unlimited ? `${used} · Unlimited` : `${used} / ${limit}`}
                </span>
            </div>
            <div className="u-meter">
                <div className={`u-meter-fill ${fillMod}`} style={{ width: unlimited ? '100%' : `${pct}%` }} />
            </div>
            {!unlimited && (
                <p className={`u-xs u-mt-xs ${full ? 'u-danger' : 'u-muted'}`}>
                    {full
                        ? 'Limit reached. Upgrade your plan to add more.'
                        : `${remaining} seat${remaining === 1 ? '' : 's'} remaining`}
                </p>
            )}
        </div>
    )
}

function UsageCard({ usage }) {
    const resources = usage?.resources || {}
    const keys = Object.keys(resources)
    if (keys.length === 0) return null
    return (
        <div className="card u-mb-lg">
            <div className="card-content">
                <p className="u-label u-mb-sm">Usage this plan</p>
                {keys.map(k => <UsageMeter key={k} resourceKey={k} data={resources[k]} />)}
            </div>
        </div>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminBilling() {
    const { notifications: liveNotifications, markRead } = useNotifications()

    const [billing, setBilling] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error,   setError]   = useState('')

    const [checkingOut, setCheckingOut] = useState(null)
    const [actionError, setActionError] = useState('')

    useEffect(() => {
        let alive = true
        getBillingStatus()
            .then(data => { if (alive) setBilling(data) })
            .catch(err => { if (alive) setError(err?.response?.data?.detail || err.message || 'Could not load billing status.') })
            .finally(() => { if (alive) setLoading(false) })
        return () => { alive = false }
    }, [])

    async function handleSubscribe(planKey) {
        setCheckingOut(planKey)
        setActionError('')
        try {
            const { checkout_url } = await startCheckout(planKey)
            if (checkout_url) {
                window.location.assign(checkout_url)
                return
            }
            setActionError('No checkout URL was returned.')
            setCheckingOut(null)
        } catch (err) {
            setActionError(err?.response?.data?.detail || err.message || 'Could not start checkout.')
            setCheckingOut(null)
        }
    }

    const plans        = billing?.plans || []
    const currentPlan  = billing?.plan
    const stripeOn     = billing?.stripe_enabled
    const chip         = STATUS_CHIP[billing?.status] || null
    const redirecting  = checkingOut !== null

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={adminNavItems} secondaryItems={adminSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Billing"
                        subtitle="Manage your school's subscription and plan"
                        {...adminUser}
                        notifications={liveNotifications}
                        onNotificationRead={markRead}
                    />
                    <DashboardContent>
                        {loading && <p className="u-muted">Loading billing…</p>}

                        {!loading && error && (
                            <div className="card u-banner u-banner--danger">
                                <p className="u-danger u-strong">{error}</p>
                            </div>
                        )}

                        {!loading && !error && billing && (
                            <>
                                <StatusBanner status={billing.status} onTrial={billing.on_trial} />

                                {/* Current plan summary */}
                                <div className="card u-mb-lg">
                                    <div className="card-content u-row-between">
                                        <div>
                                            <p className="u-label">Current plan</p>
                                            <p className="u-xl u-bold u-capitalize">{currentPlan || '-'}</p>
                                        </div>
                                        {chip && <span className={`u-chip u-chip--${chip.tone} u-ml-auto`}>{chip.label}</span>}
                                    </div>
                                </div>

                                {billing.usage && <UsageCard usage={billing.usage} />}

                                {!stripeOn && (
                                    <p className="u-muted u-sm u-mb">Online billing isn&apos;t set up on this server yet.</p>
                                )}

                                {actionError && <p className="u-danger u-sm u-mb">{actionError}</p>}

                                {/* Plan cards */}
                                <div className="u-grid">
                                    {plans.map(plan => {
                                        const isCurrent = plan.key === currentPlan
                                        const isThisCheckingOut = checkingOut === plan.key
                                        const label = isThisCheckingOut
                                            ? 'Redirecting to secure checkout…'
                                            : isCurrent ? 'Current plan' : 'Subscribe'
                                        return (
                                            <div key={plan.key} className="card">
                                                <div className="card-content">
                                                    <p className="u-lg u-bold u-mb-sm">{plan.name}</p>
                                                    <button
                                                        className={`btn ${isCurrent ? 'btn-outline' : 'btn-primary'} u-full`}
                                                        disabled={!stripeOn || isCurrent || redirecting}
                                                        onClick={() => handleSubscribe(plan.key)}
                                                    >
                                                        {label}
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {plans.length === 0 && <p className="u-muted u-sm">No plans available.</p>}
                                </div>
                            </>
                        )}
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
