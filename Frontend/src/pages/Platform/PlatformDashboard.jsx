import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { platformLogout, platformUser, isPlatformAuthed } from '../../api/platform'
import { OverviewSection } from './sections/OverviewSection'
import { SchoolsSection } from './sections/SchoolsSection'
import { RevenueSection } from './sections/RevenueSection'
import { ExpensesSection } from './sections/ExpensesSection'
import { TicketsSection } from './sections/TicketsSection'
import '../../styles/platform.css'

const TABS = [
    { key: 'overview', label: 'Overview', icon: 'dashboard' },
    { key: 'schools',  label: 'Schools',  icon: 'apartment' },
    { key: 'revenue',  label: 'Revenue',  icon: 'payments' },
    { key: 'expenses', label: 'Expenses', icon: 'receipt_long' },
    { key: 'tickets',  label: 'Support',  icon: 'support_agent' },
]

export function PlatformDashboard() {
    const navigate = useNavigate()
    const [tab, setTab] = useState('overview')
    const me = platformUser()

    useEffect(() => { if (!isPlatformAuthed()) navigate('/platform/login', { replace: true }) }, [navigate])

    function handleLogout() {
        platformLogout()
        navigate('/platform/login', { replace: true })
    }

    return (
        <div className="platform-shell">
            <header className="platform-topbar">
                <div className="platform-brand">
                    <span className="material-symbols-rounded">hub</span>
                    <div>
                        <h1>Imboni Platform</h1>
                        <p>Operator console</p>
                    </div>
                </div>
                <div className="platform-topbar-right">
                    {me?.email && <span className="platform-whoami">{me.email}</span>}
                    <button className="platform-btn" onClick={handleLogout}>Sign out</button>
                </div>
            </header>

            <nav className="platform-tabs">
                {TABS.map(t => (
                    <button
                        key={t.key}
                        className={`platform-tab ${tab === t.key ? 'is-active' : ''}`}
                        onClick={() => setTab(t.key)}
                    >
                        <span className="material-symbols-rounded">{t.icon}</span>
                        {t.label}
                    </button>
                ))}
            </nav>

            <main className="platform-main">
                {tab === 'overview' && <OverviewSection onNavigate={setTab} />}
                {tab === 'schools'  && <SchoolsSection />}
                {tab === 'revenue'  && <RevenueSection />}
                {tab === 'expenses' && <ExpensesSection />}
                {tab === 'tickets'  && <TicketsSection />}
            </main>
        </div>
    )
}
