import { Sidebar } from '../../components/layout/Sidebar'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/matron.css'
import { matronNavItems, matronSecondaryItems, matronUser } from './matronNav'


const commsStats = [
    { iconClass: 'calls',   icon: 'call',    value: '12', label: 'Calls This Month' },
    { iconClass: 'sms',     icon: 'sms',     value: '27', label: 'SMS Sent'         },
    { iconClass: 'email',   icon: 'mail',    value: '8',  label: 'Emails Sent'      },
    { iconClass: 'pending', icon: 'pending', value: '3',  label: 'Awaiting Reply'   },
]

const commLog = [
    { typeClass: 'call',  typeIcon: 'call', student: 'Ingabire Belise',   parent: 'Mrs. Françoise Ingabire (mother)',   subject: 'Health update \u2014 fever admission',         notes: 'Informed mother that Belise was admitted to sick bay with high fever (38.5 \u00b0C). Mother acknowledged and asked for daily updates. Agreed to review on Mar 26.', meta: 'Mar 23, 2026 \u00b7 15:42 \u00b7 Phone Call \u00b7 Follow-up due Mar 26', statusClass: 'completed', status: 'Completed'     },
    { typeClass: 'sms',   typeIcon: 'sms',  student: 'Kayitesi Ursula',   parent: 'Mr. Aloys Kayitesi (father)',          subject: 'Allergic reaction notification',               notes: 'SMS sent: "Dear Parent, Ursula is currently under observation in the sick bay due to a mild allergic reaction. She has been given antihistamines and is stable. We will keep you updated."', meta: 'Mar 22, 2026 \u00b7 11:05 \u00b7 SMS / WhatsApp', statusClass: 'sent',      status: 'Sent'          },
    { typeClass: 'call',  typeIcon: 'call', student: 'Niyomugabo Iris',   parent: 'Mr. Théophile Niyomugabo (father)',    subject: 'Dormitory conduct concern',                    notes: "Called to discuss Iris's repeated noise violations after lights-out. Father was cooperative and agreed to speak with Iris. No formal disciplinary action taken yet.", meta: 'Mar 18, 2026 \u00b7 17:15 \u00b7 Phone Call', statusClass: 'completed', status: 'Completed'     },
    { typeClass: 'call',  typeIcon: 'call', student: 'Mukamana Brigitte', parent: 'Mrs. Odette Mukamana (mother)',        subject: 'Welfare check \u2014 student seems withdrawn', notes: 'Called to express concern that Brigitte has seemed unusually quiet for the past week. Mother mentioned adjustments at home. Agreed to monitor and connect Brigitte with school counsellor.', meta: 'Mar 15, 2026 \u00b7 10:30 \u00b7 Phone Call \u00b7 Follow-up: counsellor referral', statusClass: 'pending',   status: 'Pending Reply' },
    { typeClass: 'email', typeIcon: 'mail', student: 'Mukamazimpaka Joy', parent: 'Dr. Léonard Mukamazimpaka (father)',   subject: 'End-of-term welfare summary',                  notes: "Email sent with a brief summary of Joy's term \u2014 attendance, health visits (1 flu episode), and positive conduct. Father replied with thanks.", meta: 'Mar 10, 2026 \u00b7 08:00 \u00b7 Email', statusClass: 'completed', status: 'Completed'     },
    { typeClass: 'call',  typeIcon: 'call', student: 'Rugamba Nadine',    parent: 'Mrs. Vestine Rugamba (mother)',        subject: 'Sports injury notification',                   notes: 'Called to inform that Nadine sustained a minor cut on her hand during football practice. Wound has been cleaned and bandaged. No stitches required. Nadine cleared to continue normal activities.', meta: 'Mar 08, 2026 \u00b7 16:55 \u00b7 Phone Call', statusClass: 'completed', status: 'Completed'     },
    { typeClass: 'call',  typeIcon: 'call', student: 'Uwase Amina',       parent: 'Mrs. Chantal Uwase (mother)',          subject: 'Missing weekend permission slip',              notes: "Called to confirm weekend leave permission for Amina. Mother confirmed and said she'd email the signed form. Form received on Mar 02.", meta: 'Mar 01, 2026 \u00b7 09:15 \u00b7 Phone Call', statusClass: 'completed', status: 'Completed'     },
]

function CommsStat({ iconClass, icon, value, label }) {
    return (
        <div className="comms-stat-card">
            <div className={`comms-stat-icon ${iconClass}`}><span className="material-symbols-rounded">{icon}</span></div>
            <div>
                <div className="comms-stat-value">{value}</div>
                <div className="comms-stat-label">{label}</div>
            </div>
        </div>
    )
}

function CommEntry({ typeClass, typeIcon, student, parent, subject, notes, meta, statusClass, status }) {
    return (
        <div className="comm-entry">
            <div className={`comm-type-icon ${typeClass}`}><span className="material-symbols-rounded">{typeIcon}</span></div>
            <div className="comm-body">
                <div className="comm-header">
                    <span className="comm-student">{student}</span>
                    <span className="comm-parent">&rarr; {parent}</span>
                </div>
                <div className="comm-subject">{subject}</div>
                <div className="comm-notes">{notes}</div>
                <div className="comm-meta">{meta}</div>
            </div>
            <div className="comm-right">
                <span className={`comm-status-badge ${statusClass}`}>{status}</span>
            </div>
        </div>
    )
}

export function MatronParentComms() {
    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>

            <div className="dashboard-layout">
                <Sidebar navItems={matronNavItems} secondaryItems={matronSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <header className="dashboard-header">
                        <button className="mobile-menu-btn"><span className="material-symbols-rounded">menu</span></button>
                        <div className="dashboard-header-title">
                            <h1>Parent Communications</h1>
                            <p>Log and track all parent contact &mdash; Karisimbi House</p>
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

                    <div className="dashboard-content">

                        <div className="comms-stats">
                            {commsStats.map((stat, index) => (
                                <CommsStat key={index} {...stat} />
                            ))}
                        </div>

                        <div className="card mb-1-5">
                            <div className="card-header">
                                <h3 className="card-title"><span className="material-symbols-rounded">add_comment</span> Log New Communication</h3>
                            </div>
                            <div className="card-content">
                                <div className="comms-form-grid">
                                    <div>
                                        <label>Student</label>
                                        <select>
                                            <option value="">— Select student —</option>
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
                                        <label>Parent / Guardian Contacted</label>
                                        <input type="text" placeholder="e.g. Mr. John Doe (father)" />
                                    </div>
                                    <div>
                                        <label>Communication Type</label>
                                        <select>
                                            <option>Phone Call</option>
                                            <option>SMS / WhatsApp</option>
                                            <option>Email</option>
                                            <option>In-Person Visit</option>
                                            <option>Letter</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>Date &amp; Time</label>
                                        <input type="datetime-local" defaultValue="2026-03-24T10:00" />
                                    </div>
                                    <div>
                                        <label>Reason / Subject</label>
                                        <input type="text" placeholder="e.g. Health update, Conduct concern, Welfare check&hellip;" />
                                    </div>
                                    <div>
                                        <label>Outcome / Status</label>
                                        <select>
                                            <option>Completed &mdash; parent informed</option>
                                            <option>No Answer &mdash; will retry</option>
                                            <option>Message Left</option>
                                            <option>Awaiting Parent Reply</option>
                                            <option>SMS Sent</option>
                                            <option>Email Sent</option>
                                        </select>
                                    </div>
                                    <div className="full">
                                        <label>Notes</label>
                                        <textarea placeholder="Summary of what was discussed or agreed upon&hellip;"></textarea>
                                    </div>
                                    <div>
                                        <label>Follow-up Required?</label>
                                        <select>
                                            <option>No</option>
                                            <option>Yes &mdash; follow up in 1 day</option>
                                            <option>Yes &mdash; follow up in 3 days</option>
                                            <option>Yes &mdash; follow up next week</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label>Urgency</label>
                                        <select>
                                            <option>Routine</option>
                                            <option>Important</option>
                                            <option>Urgent</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
                                    <button className="btn btn-primary"><span className="material-symbols-rounded">save</span> Save Log</button>
                                    <button className="btn btn-outline">Clear</button>
                                </div>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title"><span className="material-symbols-rounded">history</span> Communication Log</h3>
                                <button className="btn btn-outline btn-sm"><span className="material-symbols-rounded">download</span> Export</button>
                            </div>
                            <div className="card-content">
                                <div className="comms-filter-bar">
                                    <select>
                                        <option>All Types</option>
                                        <option>Phone Call</option>
                                        <option>SMS / WhatsApp</option>
                                        <option>Email</option>
                                        <option>In-Person Visit</option>
                                    </select>
                                    <select>
                                        <option>All Statuses</option>
                                        <option>Completed</option>
                                        <option>Pending Reply</option>
                                        <option>No Answer</option>
                                        <option>Sent</option>
                                    </select>
                                    <select>
                                        <option>All Students</option>
                                        <option>Ingabire Belise</option>
                                        <option>Niyomugabo Iris</option>
                                        <option>Mukamana Brigitte</option>
                                        <option>Kayitesi Ursula</option>
                                        <option>Uwase Amina</option>
                                        <option>Mukamazimpaka Joy</option>
                                        <option>Rugamba Nadine</option>
                                    </select>
                                    <select>
                                        <option>This Month</option>
                                        <option>Last Month</option>
                                        <option>Last 3 Months</option>
                                        <option>All Time</option>
                                    </select>
                                </div>

                                <div className="comms-list">
                                    {commLog.map((entry, index) => (
                                        <CommEntry key={index} {...entry} />
                                    ))}
                                </div>
                            </div>
                        </div>

                    </div>
                </main>
            </div>
        </>
    )
}
