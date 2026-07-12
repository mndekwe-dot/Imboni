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
// past_due / suspended / trial each get their own note. Colours come from inline
// styles so we don't depend on a bespoke stylesheet class for the amber/red look.

function StatusBanner({ status, onTrial }) {
    if (status === 'past_due') {
        return (
            <div className="card mb-1-5" style={{ borderLeft: '4px solid #d97706', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="material-symbols-rounded" style={{ color: '#d97706', fontSize: '1.5rem' }}>warning</span>
                    <div>
                        <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Payment overdue</p>
                        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
                            We couldn&apos;t process your latest payment. Update your subscription to avoid losing access.
                        </p>
                    </div>
                </div>
            </div>
        )
    }
    if (status === 'suspended') {
        return (
            <div className="card mb-1-5" style={{ borderLeft: '4px solid var(--danger, #dc2626)', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="material-symbols-rounded" style={{ color: 'var(--danger, #dc2626)', fontSize: '1.5rem' }}>block</span>
                    <div>
                        <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Account suspended</p>
                        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
                            Subscribe to restore access for your school.
                        </p>
                    </div>
                </div>
            </div>
        )
    }
    if (onTrial) {
        return (
            <div className="card mb-1-5" style={{ borderLeft: '4px solid var(--primary)', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="material-symbols-rounded" style={{ color: 'var(--primary)', fontSize: '1.5rem' }}>schedule</span>
                    <div>
                        <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>You&apos;re on a free trial</p>
                        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>
                            Subscribe to a plan to keep access once your trial ends.
                        </p>
                    </div>
                </div>
            </div>
        )
    }
    return null
}

const STATUS_CHIP = {
    trial:    { label: 'Trial',    bg: 'rgba(79,70,229,0.12)',  fg: 'var(--primary)' },
    active:   { label: 'Active',   bg: 'rgba(22,163,74,0.12)',  fg: 'var(--success, #16a34a)' },
    past_due: { label: 'Past due', bg: 'rgba(217,119,6,0.14)',  fg: '#d97706' },
    suspended:{ label: 'Suspended',bg: 'rgba(220,38,38,0.12)',  fg: 'var(--danger, #dc2626)' },
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminBilling() {
    const { notifications: liveNotifications, markRead } = useNotifications()

    const [billing, setBilling] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error,   setError]   = useState('')

    // Which plan's checkout is currently being started (null = none in flight).
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
                return   // keep the "redirecting" state while the browser navigates
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
                        {loading && (
                            <p style={{ color: 'var(--muted-foreground)' }}>Loading billing…</p>
                        )}

                        {!loading && error && (
                            <div className="card" style={{ borderLeft: '4px solid var(--danger, #dc2626)', padding: '1rem 1.25rem' }}>
                                <p style={{ color: 'var(--danger, #dc2626)', fontWeight: 500 }}>{error}</p>
                            </div>
                        )}

                        {!loading && !error && billing && (
                            <>
                                <StatusBanner status={billing.status} onTrial={billing.on_trial} />

                                {/* Current plan summary */}
                                <div className="card" style={{ marginBottom: '1.25rem' }}>
                                    <div className="card-content" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                        <div>
                                            <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Current plan</p>
                                            <p style={{ fontSize: '1.35rem', fontWeight: 700, textTransform: 'capitalize' }}>{currentPlan || '—'}</p>
                                        </div>
                                        {chip && (
                                            <span style={{
                                                marginLeft: 'auto', padding: '0.28rem 0.7rem', borderRadius: '999px',
                                                fontSize: '0.78rem', fontWeight: 600,
                                                background: chip.bg, color: chip.fg,
                                            }}>
                                                {chip.label}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {!stripeOn && (
                                    <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                                        Online billing isn&apos;t set up on this server yet.
                                    </p>
                                )}

                                {actionError && (
                                    <p style={{ color: 'var(--danger, #dc2626)', fontSize: '0.875rem', marginBottom: '1rem' }}>{actionError}</p>
                                )}

                                {/* Plan cards */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                                    {plans.map(plan => {
                                        const isCurrent = plan.key === currentPlan
                                        const isThisCheckingOut = checkingOut === plan.key
                                        const label = isThisCheckingOut
                                            ? 'Redirecting to secure checkout…'
                                            : isCurrent ? 'Current plan' : 'Subscribe'
                                        return (
                                            <div key={plan.key} className="card">
                                                <div className="card-content">
                                                    <p style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem' }}>{plan.name}</p>
                                                    <button
                                                        className={`btn ${isCurrent ? 'btn-outline' : 'btn-primary'}`}
                                                        style={{ width: '100%' }}
                                                        disabled={!stripeOn || isCurrent || redirecting}
                                                        onClick={() => handleSubscribe(plan.key)}
                                                    >
                                                        {label}
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {plans.length === 0 && (
                                        <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem' }}>No plans available.</p>
                                    )}
                                </div>
                            </>
                        )}
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
