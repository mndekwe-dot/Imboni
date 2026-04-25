import { Sidebar } from '../../components/layout/Sidebar'
import { FilterBar } from '../../components/ui/FilterBar'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/matron.css'
import { useState } from 'react'
import { matronNavItems, matronSecondaryItems, matronUser } from './matronNav'
import { DashboardContent } from '../../components/layout/DashboardContent'


const pastReports = [
    { date: 'Mar 9, 2026',  name: 'Kayitesi Ursula',   type: 'Missing from Roll Call', severityStyle: { background: 'rgba(245,158,11,0.12)', color: '#f59e0b' },               severity: 'Medium',   statusClass: 'pending',  status: 'Pending'  },
    { date: 'Mar 1, 2026',  name: 'Niyomugabo Iris',   type: 'Dormitory Violation',     severityStyle: { background: 'rgba(245,158,11,0.12)', color: '#f59e0b' },               severity: 'Medium',   statusClass: 'reviewed', status: 'Reviewed' },
    { date: 'Feb 24, 2026', name: 'Ingabire Belise',   type: 'Positive Conduct',        severityStyle: { background: 'var(--success-light)', color: 'var(--success)' },        severity: 'Positive', statusClass: 'reviewed', status: 'Reviewed' },
    { date: 'Feb 15, 2026', name: 'Rugamba Nadine',    type: 'Health Concern',          severityStyle: { background: 'var(--destructive-light)', color: 'var(--destructive)' }, severity: 'High',    statusClass: 'reviewed', status: 'Reviewed' },
    { date: 'Jan 28, 2026', name: 'Niyomugabo Iris',   type: 'Noise after curfew',      severityStyle: { background: 'var(--muted)', color: 'var(--muted-text)' },              severity: 'Low',      statusClass: 'reviewed', status: 'Reviewed' },
]

const filterOptions = [
    { key: 'all',       label: 'All Reports',  },
    { key: 'pending',   label: 'Pending', count: pastReports.filter(r => r.statusClass === 'pending').length },
    { key: 'reviewed',  label: 'Reviewed'      },
]

function PastReportRow({ date, name, type, severityStyle, severity, statusClass, status }) {
    return (
        <tr>
            <td>{date}</td>
            <td><strong>{name}</strong></td>
            <td>{type}</td>
            <td><span className="badge" style={severityStyle}>{severity}</span></td>
            <td><span className={`matron-report-status ${statusClass}`}>{status}</span></td>
        </tr>
    )
}

export function MatronIncidents() {
    const [filter,setFilter]= useState('all')
    const visible= filter === 'all'
        ? pastReports
        : pastReports.filter(r => r.statusClass === filter)
    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>

            <div className="dashboard-layout">
                <Sidebar navItems={matronNavItems} secondaryItems={matronSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <header className="dashboard-header">
                        <button className="mobile-menu-btn" onClick={() => document.dispatchEvent(new CustomEvent('imboni:open-sidebar'))}><span className="material-symbols-rounded">menu</span></button>
                        <div className="dashboard-header-title">
                            <h1>Report Incident</h1>
                            <p>Submit incident reports directly to the Director of Discipline</p>
                        </div>
                        <div className="dashboard-header-actions">
                            <span className="date-display">Monday, March 09, 2026</span>
                            <div className="header-user">
                                <div className="header-user-info">
                                    <span className="header-user-name">Mrs. Gloriose Hakizimana</span>
                                    <span className="header-user-role">Matron</span>
                                </div>
                                <div className="header-user-av matron-av">GH</div>
                            </div>
                        </div>
                    </header>

                    <DashboardContent>

                        <div className="incident-form-card">
                            <div className="incident-form-title">
                                <span className="material-symbols-rounded">report</span> New Incident Report &mdash; Karisimbi House &rarr; Discipline Master
                            </div>
                            <div className="incident-form-grid">
                                <div className="form-field">
                                    <label>Student</label>
                                    <select>
                                        <option value="">â€” Select student â€”</option>
                                        <option>Uwase Amina (S4A)</option>
                                        <option>Niyomugabo Iris (S2A)</option>
                                        <option>Kayitesi Ursula (S3B)</option>
                                        <option>Mukamazimpaka Joy (S5A)</option>
                                        <option>Ingabire Belise (S4A)</option>
                                        <option>Mukamana Brigitte (S4A)</option>
                                        <option>Rugamba Nadine (S1B)</option>
                                    </select>
                                </div>
                                <div className="form-field">
                                    <label>Incident Type</label>
                                    <select>
                                        <option>Dormitory Violation</option>
                                        <option>Missing / Absent from Roll Call</option>
                                        <option>Health Concern</option>
                                        <option>Misconduct</option>
                                        <option>Positive Conduct</option>
                                        <option>Other</option>
                                    </select>
                                </div>
                                <div className="form-field">
                                    <label>Severity</label>
                                    <select>
                                        <option>Low</option>
                                        <option>Medium</option>
                                        <option>High</option>
                                        <option>Critical &mdash; Requires Immediate Action</option>
                                    </select>
                                </div>
                                <div className="form-field">
                                    <label>Date &amp; Time of Incident</label>
                                    <input type="datetime-local" defaultValue="2026-03-09T22:00" />
                                </div>
                                <div className="form-field form-field-full">
                                    <label>Description</label>
                                    <textarea placeholder="Describe the incident in detail â€” what happened, where, who was involved, any witnesses..."></textarea>
                                </div>
                                <div className="form-field form-field-full">
                                    <label>Action Taken (if any)</label>
                                    <textarea placeholder="What immediate action did you take? (e.g. verbal warning, parent called, student confined to dorm)" style={{ minHeight: '60px' }} />
                                </div>
                            </div>
                            <div className="btn-row">
                                <button className="btn btn-primary"><span className="material-symbols-rounded">send</span> Submit to Discipline</button>
                                <button className="btn btn-outline">Clear Form</button>
                            </div>
                        </div>

                        <FilterBar
                            options={filterOptions}
                            active={filter}
                            onChange={setFilter}
                        />
                        
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title"><span className="material-symbols-rounded">history</span> My Past Reports</h3>
                                <button className="btn btn-outline btn-sm"><span className="material-symbols-rounded">download</span> Export</button>
                            </div>
                            <div className="card-content">
                                <div className="table-responsive">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Student</th>
                                                <th>Type</th>
                                                <th>Severity</th>
                                                <th>Discipline Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visible.map((report, index) => (
                                                <PastReportRow key={index} {...report} />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
