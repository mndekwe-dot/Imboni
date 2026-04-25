import { useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/admin.css'
import { adminNavItems, adminSecondaryItems, adminUser } from './adminNav'
import { DashboardContent } from '../../components/layout/DashboardContent'


const settingsNav = [
    { icon: 'info',           label: 'School Info'       },
    { icon: 'calendar_month', label: 'Academic Calendar' },
    { icon: 'payments',       label: 'Fee Structure'      },
    { icon: 'notifications',  label: 'Notifications'     },
    { icon: 'security',       label: 'Access & Roles'    },
    { icon: 'backup',         label: 'Data & Backup'     },
]

const initialFeeStructure = [
    { class: 'S1 / S2', boarder: 'KES 58,000', dayScholar: 'KES 22,000' },
    { class: 'S3 / S4', boarder: 'KES 62,000', dayScholar: 'KES 25,000' },
    { class: 'S5 / S6', boarder: 'KES 68,000', dayScholar: 'KES 28,000' },
]

const initialTerms = [
    { term: 'Term 1', open: '2026-01-05', close: '2026-03-27' },
    { term: 'Term 2', open: '2026-04-28', close: '2026-07-24' },
    { term: 'Term 3', open: '2026-09-01', close: '2026-11-27' },
]

function SaveButton({ label = 'Save Changes', onSave, saved }) {
    return (
        <button
            className={`btn ${saved ? 'btn-outline' : 'btn-primary'}`}
            onClick={onSave}
            style={saved ? { color: 'var(--success)', borderColor: 'var(--success)' } : {}}
        >
            <span className="material-symbols-rounded">{saved ? 'check' : 'save'}</span>
            {saved ? 'Saved!' : label}
        </button>
    )
}

function SchoolInfoSection() {
    const [form, setForm] = useState({
        name:    'Imboni Academy',
        principal: 'Dr. Alphonse Nkurunziza',
        motto:   'Knowledge, Character, Service',
        address: 'P.O. Box 1234, Musanze, Rwanda',
        email:   'admin@imboni.ac.rw',
        phone:   '+250 788 123 456',
    })
    const [saved, setSaved] = useState(false)

    function handleChange(e) {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
        setSaved(false)
    }

    function handleSave() {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
                <label className="form-label">School Name</label>
                <input className="form-input" name="name" value={form.name} onChange={handleChange} />
            </div>
            <div className="form-group">
                <label className="form-label">Principal</label>
                <input className="form-input" name="principal" value={form.principal} onChange={handleChange} />
            </div>
            <div className="form-group">
                <label className="form-label">School Motto</label>
                <input className="form-input" name="motto" value={form.motto} onChange={handleChange} />
            </div>
            <div className="form-group">
                <label className="form-label">Physical Address</label>
                <textarea className="form-input" name="address" rows={3} value={form.address} onChange={handleChange} />
            </div>
            <div className="form-group">
                <label className="form-label">Contact Email</label>
                <input className="form-input" type="email" name="email" value={form.email} onChange={handleChange} />
            </div>
            <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input className="form-input" type="tel" name="phone" value={form.phone} onChange={handleChange} />
            </div>
            <div style={{ paddingTop: '0.5rem' }}>
                <SaveButton label="Save Changes" onSave={handleSave} saved={saved} />
            </div>
        </div>
    )
}

function CalendarSection() {
    const [terms, setTerms] = useState(initialTerms)
    const [saved, setSaved] = useState(false)

    function handleChange(i, field, value) {
        setTerms(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t))
        setSaved(false)
    }

    function handleSave() {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {terms.map((t, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: 'clamp(80px, 15%, 100px) 1fr 1fr', gap: '0.75rem', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{t.term}</span>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Opens</label>
                        <input className="form-input" type="date" value={t.open} onChange={e => handleChange(i, 'open', e.target.value)} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Closes</label>
                        <input className="form-input" type="date" value={t.close} onChange={e => handleChange(i, 'close', e.target.value)} />
                    </div>
                </div>
            ))}
            <div style={{ paddingTop: '0.5rem' }}>
                <SaveButton label="Save Calendar" onSave={handleSave} saved={saved} />
            </div>
        </div>
    )
}

function FeeStructureSection() {
    const [fees, setFees] = useState(initialFeeStructure)
    const [saved, setSaved] = useState(false)

    function handleChange(i, field, value) {
        setFees(prev => prev.map((f, idx) => idx === i ? { ...f, [field]: value } : f))
        setSaved(false)
    }

    function handleSave() {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
    }

    return (
        <div>
            <div className="adm-table-wrap">
                <table className="adm-table">
                    <thead>
                        <tr>
                            <th>Class</th>
                            <th>Boarder (per term)</th>
                            <th>Day Scholar (per term)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {fees.map((row, i) => (
                            <tr key={i}>
                                <td style={{ fontWeight: 600 }}>{row.class}</td>
                                <td>
                                    <input
                                        className="form-input"
                                        style={{ width: '140px' }}
                                        value={row.boarder}
                                        onChange={e => handleChange(i, 'boarder', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <input
                                        className="form-input"
                                        style={{ width: '140px' }}
                                        value={row.dayScholar}
                                        onChange={e => handleChange(i, 'dayScholar', e.target.value)}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div style={{ paddingTop: '1rem' }}>
                <SaveButton label="Update Fee Structure" onSave={handleSave} saved={saved} />
            </div>
        </div>
    )
}

export function AdminSettings() {
    const [activeSection, setActiveSection] = useState('School Info')

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={adminNavItems} secondaryItems={adminSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Settings"
                        subtitle="School-wide configuration and administration preferences"
                        userName={adminUser.userName}
                        userRole={adminUser.userRole}
                        userInitials={adminUser.userInitials}
                        avatarClass={adminUser.avatarClass}
                        notifications={adminUser.notifications}
                    />
                    <DashboardContent>
                        <div className="adm-settings-grid">

                            {/* Left nav */}
                            <nav className="adm-settings-nav">
                                {settingsNav.map(item => (
                                    <button
                                        key={item.label}
                                        className={`adm-settings-nav-item${activeSection === item.label ? ' active' : ''}`}
                                        onClick={() => setActiveSection(item.label)}
                                    >
                                        <span className="material-symbols-rounded">{item.icon}</span>
                                        {item.label}
                                    </button>
                                ))}
                            </nav>

                            {/* Right content */}
                            <div className="card">
                                <div className="card-header">
                                    <h2 className="card-title">{activeSection}</h2>
                                </div>
                                <div className="card-content">

                                    {activeSection === 'School Info'       && <SchoolInfoSection />}
                                    {activeSection === 'Academic Calendar' && <CalendarSection />}
                                    {activeSection === 'Fee Structure'     && <FeeStructureSection />}

                                    {!['School Info', 'Academic Calendar', 'Fee Structure'].includes(activeSection) && (
                                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-foreground)' }}>
                                            <span className="material-symbols-rounded" style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>construction</span>
                                            <p style={{ fontWeight: 600 }}>{activeSection}</p>
                                            <p style={{ fontSize: '0.875rem' }}>Configuration options coming soon.</p>
                                        </div>
                                    )}

                                </div>
                            </div>

                        </div>
                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
