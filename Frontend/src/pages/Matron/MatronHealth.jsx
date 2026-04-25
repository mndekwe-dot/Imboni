import { Sidebar } from '../../components/layout/Sidebar'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/matron.css'
import { matronNavItems, matronSecondaryItems, matronUser } from './matronNav'
import { DashboardContent } from '../../components/layout/DashboardContent'


const healthStats = [
    { iconClass: 'sick',     icon: 'sick',          value: '3',  label: 'In Sick Bay Now'    },
    { iconClass: 'recovery', icon: 'healing',       value: '2',  label: 'Under Observation'  },
    { iconClass: 'visits',   icon: 'calendar_today',value: '18', label: 'Visits This Month'  },
    { iconClass: 'cleared',  icon: 'check_circle',  value: '15', label: 'Cleared This Month' },
]

const sickbayBeds = [
    { bed: 'BED 1', badgeClass: 'occupied',  badge: 'Occupied',    student: 'Ingabire Belise',   condition: 'Fever & headache (38.5 \u00b0C)', since: 'Admitted Mar 23 \u00b7 Day 2', isEmpty: false },
    { bed: 'BED 2', badgeClass: 'recovery',  badge: 'Observation', student: 'Niyomugabo Iris',   condition: 'Sprained ankle \u2014 post-sports', since: 'Admitted Mar 24 \u00b7 Day 1', isEmpty: false },
    { bed: 'BED 3', badgeClass: 'occupied',  badge: 'Occupied',    student: 'Mukamana Brigitte', condition: 'Stomach ache, nausea',             since: 'Admitted Mar 24 \u00b7 Day 1', isEmpty: false },
    { bed: 'BED 4', badgeClass: 'recovery',  badge: 'Observation', student: 'Kayitesi Ursula',   condition: 'Mild allergic reaction',            since: 'Admitted Mar 22 \u00b7 Day 3', isEmpty: false },
    { bed: 'BED 5', badgeClass: 'empty',     badge: 'Available',   student: null,                condition: null,                               since: null,                            isEmpty: true  },
    { bed: 'BED 6', badgeClass: 'empty',     badge: 'Available',   student: null,                condition: null,                               since: null,                            isEmpty: true  },
]

const healthHistory = [
    { date: 'Mar 24, 2026', name: 'Mukamana Brigitte',  conditionTag: 'illness',  complaint: 'Stomach ache, nausea',    temp: '37.8 \u00b0C', action: 'Rest + oral rehydration',          statusClass: 'pending',  status: 'In Sick Bay' },
    { date: 'Mar 24, 2026', name: 'Niyomugabo Iris',    conditionTag: 'injury',   complaint: 'Sprained ankle',          temp: '\u2014',        action: 'Ice pack, compression bandage',    statusClass: 'pending',  status: 'Observation' },
    { date: 'Mar 23, 2026', name: 'Ingabire Belise',    conditionTag: 'illness',  complaint: 'Fever & headache',        temp: '38.5 \u00b0C', action: 'Paracetamol, admitted bed 1',      statusClass: 'pending',  status: 'In Sick Bay' },
    { date: 'Mar 22, 2026', name: 'Kayitesi Ursula',    conditionTag: 'illness',  complaint: 'Skin rash, itching',      temp: '36.9 \u00b0C', action: 'Antihistamine, referred to nurse', statusClass: 'pending',  status: 'Observation' },
    { date: 'Mar 20, 2026', name: 'Uwase Amina',        conditionTag: 'checkup',  complaint: 'Routine wellness check',  temp: '36.6 \u00b0C', action: 'No treatment required',            statusClass: 'reviewed', status: 'Cleared'     },
    { date: 'Mar 18, 2026', name: 'Mukamazimpaka Joy',  conditionTag: 'followup', complaint: 'Post-flu recovery check', temp: '36.8 \u00b0C', action: 'Cleared to return to class',       statusClass: 'reviewed', status: 'Cleared'     },
    { date: 'Mar 15, 2026', name: 'Rugamba Nadine',     conditionTag: 'injury',   complaint: 'Cut on hand (sports)',    temp: '\u2014',        action: 'Wound cleaned, bandaged',          statusClass: 'reviewed', status: 'Cleared'     },
    { date: 'Mar 10, 2026', name: 'Ingabire Belise',    conditionTag: 'illness',  complaint: 'Flu, sore throat',        temp: '39.0 \u00b0C', action: 'Admitted 3 days, antibiotics',     statusClass: 'reviewed', status: 'Cleared'     },
]

const conditionLabels = { illness: 'Illness', injury: 'Injury', checkup: 'Check-up', followup: 'Follow-up' }

function HealthStat({ iconClass, icon, value, label }) {
    return (
        <div className="health-stat-card">
            <div className={`health-stat-icon ${iconClass}`}><span className="material-symbols-rounded">{icon}</span></div>
            <div>
                <div className="health-stat-value">{value}</div>
                <div className="health-stat-label">{label}</div>
            </div>
        </div>
    )
}

function BedCard({ bed, badgeClass, badge, student, condition, since, isEmpty }) {
    return (
        <div className={`bed-card ${badgeClass}`}>
            <span className={`bed-badge ${badgeClass}`}>{badge}</span>
            <div className="bed-number">{bed}</div>
            {isEmpty ? (
                <div className="bed-empty-label">&mdash; Empty &mdash;</div>
            ) : (
                <>
                    <div className="bed-student">{student}</div>
                    <div className="bed-condition">{condition}</div>
                    <div className="bed-since">{since}</div>
                    <div className="btn-row-sm" style={{ marginTop: '0.75rem' }}>
                        <button className="btn btn-outline btn-sm">Update</button>
                        <button className="btn btn-sm" style={{ background: 'var(--success-light)', color: 'var(--success)', border: 'none' }}>Discharge</button>
                    </div>
                </>
            )}
        </div>
    )
}

function HealthHistoryRow({ date, name, conditionTag, complaint, temp, action, statusClass, status }) {
    return (
        <tr>
            <td>{date}</td>
            <td><strong>{name}</strong></td>
            <td><span className={`condition-tag ${conditionTag}`}>{conditionLabels[conditionTag]}</span></td>
            <td>{complaint}</td>
            <td>{temp}</td>
            <td>{action}</td>
            <td><span className={`matron-report-status ${statusClass}`}>{status}</span></td>
        </tr>
    )
}

export const MatronHealth = () => {
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
                            <h1>Health &amp; Wellness</h1>
                            <p>Sick bay management and student health records &mdash; Karisimbi House</p>
                        </div>
                        <div className="dashboard-header-actions">
                            <span className="date-display">Tuesday, March 24, 2026</span>
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

                        <div className="health-stats">
                            {healthStats.map((stat, index) => (
                                <HealthStat key={index} {...stat} />
                            ))}
                        </div>

                        <div className="card mb-1-5">
                            <div className="card-header">
                                <h3 className="card-title"><span className="material-symbols-rounded">bed</span> Sick Bay &mdash; Current Residents</h3>
                                <span className="settings-info-text" style={{ alignSelf: 'center' }}>6 beds total &middot; 3 occupied &middot; 3 free</span>
                            </div>
                            <div className="card-content">
                                <div className="sickbay-grid">
                                    {sickbayBeds.map((bed, index) => (
                                        <BedCard key={index} {...bed} />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="card mb-1-5">
                            <div className="card-header">
                                <h3 className="card-title"><span className="material-symbols-rounded">add_circle</span> Log Health Visit</h3>
                            </div>
                            <div className="card-content">
                                <div className="health-form-grid">
                                    <div>
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
                                    <div>
                                        <label>Visit Type</label>
                                        <select>
                                            <option>Sick Bay Admission</option>
                                            <option>Routine Check-up</option>
                                            <option>Medication Dispensed</option>
                                            <option>Follow-up Visit</option>
                                            <option>Injury</option>
                                            <option>Discharge</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>Date &amp; Time</label>
                                        <input type="datetime-local" defaultValue="2026-03-24T09:00" />
                                    </div>
                                    <div>
                                        <label>Temperature (&deg;C) &mdash; optional</label>
                                        <input type="number" step="0.1" min="35" max="42" placeholder="e.g. 37.4" />
                                    </div>
                                    <div className="full">
                                        <label>Complaint / Condition</label>
                                        <input type="text" placeholder="Brief description of presenting complaint&hellip;" />
                                    </div>
                                    <div className="full">
                                        <label>Action Taken / Treatment</label>
                                        <textarea placeholder="Medication given, rest ordered, parent notified, referred to hospital&hellip;"></textarea>
                                    </div>
                                    <div>
                                        <label>Admit to Sick Bay?</label>
                                        <select>
                                            <option>No &mdash; outpatient visit</option>
                                            <option>Yes &mdash; assign to bed</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>Notify Parent?</label>
                                        <select>
                                            <option>No</option>
                                            <option>Yes &mdash; send SMS</option>
                                            <option>Yes &mdash; call parent</option>
                                            <option>Yes &mdash; both</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="btn-row mt-1-5">
                                    <button className="btn btn-primary"><span className="material-symbols-rounded">save</span> Save Record</button>
                                    <button className="btn btn-outline">Clear</button>
                                </div>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title"><span className="material-symbols-rounded">history</span> Health Visit History</h3>
                                <div className="btn-row-sm">
                                    <select className="btn btn-outline btn-sm select-xs">
                                        <option>All Students</option>
                                        <option>Ingabire Belise</option>
                                        <option>Niyomugabo Iris</option>
                                        <option>Mukamana Brigitte</option>
                                        <option>Kayitesi Ursula</option>
                                    </select>
                                    <button className="btn btn-outline btn-sm"><span className="material-symbols-rounded">download</span> Export</button>
                                </div>
                            </div>
                            <div className="card-content">
                                <div className="table-responsive">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Student</th>
                                                <th>Type</th>
                                                <th>Complaint</th>
                                                <th>Temp</th>
                                                <th>Action</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {healthHistory.map((row, index) => (
                                                <HealthHistoryRow key={index} {...row} />
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
