import { Sidebar } from '../../components/layout/Sidebar'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/student.css'
import { studentNavItems, studentSecondaryItems, studentUser } from './studentNav'
import { DashboardContent } from '../../components/layout/DashboardContent'


const conductStats = [
  { iconClass: 'teal',  icon: 'verified',   value: '87',   valueColor: 'var(--student)',     label: 'Conduct Score / 100' },
  { iconClass: 'green', icon: 'thumb_up',   value: '+12',  valueColor: 'var(--success)',     label: 'Positive Points'     },
  { iconClass: 'red',   icon: 'thumb_down', value: '-5',   valueColor: 'var(--destructive)', label: 'Negative Points'     },
  { iconClass: 'blue',  icon: 'shield',     value: 'Good', valueColor: 'var(--primary)',     label: 'Current Standing'    },
]

const disciplineRecords = [
  { date: 'Mar 5, 2026',  type: 'Positive', typeBg: 'var(--success-light)',     typeColor: 'var(--success)',     description: 'Represented school at Inter-school Debate â€” 2nd place',     issuedBy: 'Mr. Mutabazi',    points: '+5', pointsClass: 'disc-points-pos' },
  { date: 'Feb 20, 2026', type: 'Positive', typeBg: 'var(--success-light)',     typeColor: 'var(--success)',     description: 'Academic Excellence Award â€” Term 1 Top 5',                   issuedBy: 'Dr. Ndagijimana', points: '+4', pointsClass: 'disc-points-pos' },
  { date: 'Jan 30, 2026', type: 'Positive', typeBg: 'var(--success-light)',     typeColor: 'var(--success)',     description: 'Community service â€” cleaned school library voluntarily',       issuedBy: 'Mr. Mutabazi',    points: '+3', pointsClass: 'disc-points-pos' },
  { date: 'Feb 28, 2026', type: 'Negative', typeBg: 'var(--destructive-light)', typeColor: 'var(--destructive)', description: 'Late to Chemistry class without valid reason',                issuedBy: 'Mr. Bizimana',    points: '-2', pointsClass: 'disc-points-neg' },
  { date: 'Jan 22, 2026', type: 'Negative', typeBg: 'var(--destructive-light)', typeColor: 'var(--destructive)', description: 'Incorrect uniform â€” missing school tie',                     issuedBy: 'Mr. Mutabazi',    points: '-3', pointsClass: 'disc-points-neg' },
  { date: 'Jan 15, 2026', type: 'Warning',  typeBg: 'rgba(245,158,11,0.12)',    typeColor: '#f59e0b',            description: 'Noise in dormitory after lights-out â€” verbal warning issued', issuedBy: 'Mrs. Hakizimana', points: 'W',  pointsClass: ''                },
]

const appealSteps = [
  { num: 1, title: 'Submit Written Appeal',            desc: 'Write a formal appeal letter to Mr. Mutabazi within 48 hours of the decision'                          },
  { num: 2, title: 'Discipline Master Review Meeting', desc: 'Meet with Mr. Mutabazi to present your case and provide supporting evidence'                           },
  { num: 3, title: 'Review Panel (if needed)',         desc: 'For serious cases, a panel of senior staff and parent representative will convene'                    },
  { num: 4, title: 'Final Decision',                   desc: 'A written decision is communicated to the student and parent/guardian within 5 school days'          },
]

const conductCategories = [
  { cardClass: 'uniform',  iconClass: 'orange', icon: 'checkroom',       title: 'Uniform & Appearance',      rules: [
    'Full school uniform must be worn every school day',
    'School tie required from Monday to Friday',
    'Hair must be natural â€” no dye, extensions, or elaborate styles',
    'No jewellery except a plain wristwatch',
    'Shoes must be plain black and well-polished',
  ]},
  { cardClass: 'attend',   iconClass: 'amber',  icon: 'schedule',        title: 'Attendance & Punctuality',  rules: [
    'Gates close at 7:25 AM â€” late arrival requires a late pass',
    'All absences must be explained by a signed parent/guardian note',
    'Minimum 85% attendance required per term',
    'Leaving school grounds requires written permission from administration',
  ]},
  { cardClass: 'academic', iconClass: 'green',  icon: 'school',          title: 'Academic Integrity',        rules: [
    'Cheating or copying in any assessment is a serious offence',
    'Plagiarism in assignments will result in a zero mark',
    'Electronic devices are not allowed in examinations',
    'All work submitted must be original and the student\'s own',
  ]},
  { cardClass: 'boarding', iconClass: 'purple', icon: 'home',            title: 'Dormitory & Boarding',      rules: [
    'Lights out at 10:15 PM â€” no exceptions',
    'No visitors of the opposite gender in dormitories at any time',
    'Students are responsible for cleanliness of their rooms',
    'All personal valuables must be stored in locked trunks',
  ]},
  { cardClass: 'digital',  iconClass: 'teal',   icon: 'devices',         title: 'Digital & Technology Use',  rules: [
    'Personal phones are permitted after 4:30 PM only',
    'Phones must be surrendered to matron by 9:30 PM on school nights',
    'Social media posts that disparage the school or staff are prohibited',
    'School computers are for academic use only',
  ]},
  { cardClass: '',         iconClass: '',       icon: 'groups',          title: 'General Conduct',            rules: [
    'Bullying, harassment, or intimidation of any kind is strictly prohibited',
    'Students must address all staff respectfully at all times',
    'Damage to school property will result in repair costs and disciplinary action',
    'Possession of contraband (alcohol, tobacco, drugs) leads to immediate suspension',
  ]},
]

function ConductStat({ iconClass, icon, value, valueColor, label }) {
  return (
    <div className="student-stat-card">
      <div className={`stat-icon ${iconClass}`}><span className="material-symbols-rounded">{icon}</span></div>
      <div className="stat-body">
        <div className="stat-value" style={{ color: valueColor }}>{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  )
}

function DisciplineRow({ date, type, typeBg, typeColor, description, issuedBy, points, pointsClass }) {
  return (
    <tr>
      <td>{date}</td>
      <td><span className="badge" style={{ background: typeBg, color: typeColor }}>{type}</span></td>
      <td>{description}</td>
      <td>{issuedBy}</td>
      <td>
        {pointsClass
          ? <span className={pointsClass}>{points}</span>
          : <span className="text-warning-bold">{points}</span>
        }
      </td>
    </tr>
  )
}

function AppealStep({ num, title, desc }) {
  return (
    <div className="appeal-step">
      <div className="appeal-step-num">{num}</div>
      <div className="appeal-step-text">
        <strong>{title}</strong>
        <span>{desc}</span>
      </div>
    </div>
  )
}

function ConductCategory({ cardClass, iconClass, icon, title, rules }) {
  return (
    <div className={`conduct-category-card ${cardClass}`}>
      <div className="conduct-category-header">
        <div className={`conduct-category-icon ${iconClass}`}><span className="material-symbols-rounded">{icon}</span></div>
        <span className="conduct-category-title">{title}</span>
      </div>
      <ul className="rule-list">
        {rules.map((rule, i) => <li key={i}>{rule}</li>)}
      </ul>
    </div>
  )
}

export function StudentDiscipline() {
    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={studentNavItems} secondaryItems={studentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <header className="dashboard-header">
                        <button className="mobile-menu-btn" onClick={() => document.dispatchEvent(new CustomEvent('imboni:open-sidebar'))}><span className="material-symbols-rounded">menu</span></button>
                        <div className="dashboard-header-title">
                            <h1>Discipline</h1>
                            <p>School rules, your discipline record &amp; appeals</p>
                        </div>
                        <div className="dashboard-header-actions">
                            <span className="date-display">Monday, March 09, 2026</span>
                            <div className="header-user">
                                <div className="header-user-info">
                                    <span className="header-user-name">Uwase Amina</span>
                                    <span className="header-user-role">Student Â· S4A</span>
                                </div>
                                <div className="header-user-av student-av">UA</div>
                            </div>
                        </div>
                    </header>

                    <DashboardContent>

                        {/* Discipline Master profile */}
                        <div className="staff-profile-card">
                            <div className="staff-profile-avatar discipline-av">EM</div>
                            <div>
                                <div className="staff-profile-name">Mr. E. Mutabazi</div>
                                <div className="staff-profile-title">Director of Discipline &amp; Student Affairs</div>
                                <div className="staff-profile-meta">
                                    <span className="staff-meta-item"><span className="material-symbols-rounded">location_on</span>Admin Block â€” Office A-5</span>
                                    <span className="staff-meta-item"><span className="material-symbols-rounded">schedule</span>Monâ€“Fri: 7:30 AM â€“ 5:00 PM</span>
                                    <span className="staff-meta-item"><span className="material-symbols-rounded">phone</span>Ext. 204</span>
                                    <span className="staff-meta-item"><span className="material-symbols-rounded">mail</span>e.mutabazi@imboni.ac.rw</span>
                                    <span className="staff-meta-item"><span className="material-symbols-rounded">badge</span>8 years at Imboni Academy</span>
                                </div>
                                <div className="staff-profile-actions">
                                    <a href="/student/messages" className="btn btn-sm btn-primary"><span className="material-symbols-rounded">chat</span> Send Message</a>
                                    <button className="btn btn-sm btn-outline"><span className="material-symbols-rounded">event</span> Request Meeting</button>
                                </div>
                            </div>
                        </div>

                        {/* My conduct standing */}
                        <div className="student-stats-grid mb-1-5">
                            {conductStats.map((stat, i) => (
                                <ConductStat key={i} {...stat} />
                            ))}
                        </div>

                        {/* Discipline records */}
                        <div className="card mb-1-5">
                            <div className="card-header">
                                <h3 className="card-title"><span className="material-symbols-rounded">history</span> My Discipline Records</h3>
                                <div className="filter-tabs-bar mb-0 mt-0">
                                    <button className="filter-tab active">All</button>
                                    <button className="filter-tab">Positive</button>
                                    <button className="filter-tab">Negative</button>
                                    <button className="filter-tab">Warning</button>
                                </div>
                            </div>
                            <div className="card-content">
                                <div className="table-responsive">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Type</th>
                                                <th>Description</th>
                                                <th>Issued By</th>
                                                <th>Points</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {disciplineRecords.map((row, i) => (
                                                <DisciplineRow key={i} {...row} />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Code of conduct */}
                        <div className="mb-3">
                            <h3 className="flex-row-gap-sm" style={{ fontWeight: 700, fontSize: '1rem' }}>
                                <span className="material-symbols-rounded">menu_book</span> Code of Conduct
                            </h3>
                        </div>
                        <div className="conduct-rules-grid">
                            {conductCategories.map((cat, i) => (
                                <ConductCategory key={i} {...cat} />
                            ))}
                        </div>

                        {/* Appeals process */}
                        <div className="card mt-1-5">
                            <div className="card-header">
                                <h3 className="card-title"><span className="material-symbols-rounded">balance</span> Appeals Process</h3>
                            </div>
                            <div className="card-content">
                                <div className="appeal-steps">
                                    {appealSteps.map((step, i) => (
                                        <AppealStep key={i} {...step} />
                                    ))}
                                </div>
                            </div>
                        </div>

                    </DashboardContent>
                </main>
            </div>
        </>
    )
}
