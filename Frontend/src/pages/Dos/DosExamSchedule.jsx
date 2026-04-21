import { Sidebar } from '../../components/layout/Sidebar'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/dos.css'
import { dosNavItems, dosSecondaryItems, dosUser } from './dosNav'


const examRows = [
    { num: 1, subject: 'Mathematics',          code: 'MAT 401', classes: 'S4A \u00b7 S4B \u00b7 S4C', date: 'Mon, 16 Mar 2026', time: '8:00 \u2013 11:00', duration: '3 hrs',   rooms: ['Hall A', 'Hall B'],   invigilator: 'Mr. Rurangwa',    statusClass: 'badge-upcoming', status: 'Upcoming' },
    { num: 2, subject: 'English Language',     code: 'ENG 401', classes: 'S4A \u00b7 S4B \u00b7 S4C', date: 'Tue, 17 Mar 2026', time: '8:00 \u2013 10:30', duration: '2.5 hrs', rooms: ['Hall A', 'Hall B'],   invigilator: 'Ms. Uwera',       statusClass: 'badge-upcoming', status: 'Upcoming' },
    { num: 3, subject: 'Physics',              code: 'PHY 401', classes: 'S4A \u00b7 S4B',             date: 'Wed, 18 Mar 2026', time: '8:00 \u2013 11:00', duration: '3 hrs',   rooms: ['Room 8', 'Room 9'],   invigilator: 'Mr. Ntakirutimana', statusClass: 'badge-upcoming', status: 'Upcoming' },
    { num: 4, subject: 'Chemistry',            code: 'CHE 401', classes: 'S4A \u00b7 S4B \u00b7 S4C', date: 'Thu, 19 Mar 2026', time: '8:00 \u2013 11:00', duration: '3 hrs',   rooms: ['Hall A', 'Lab 2'],    invigilator: 'Ms. Umutoni',     statusClass: 'badge-upcoming', status: 'Upcoming' },
    { num: 5, subject: 'Biology',              code: 'BIO 401', classes: 'S4A \u00b7 S4C',             date: 'Fri, 20 Mar 2026', time: '8:00 \u2013 11:00', duration: '3 hrs',   rooms: ['Hall B', 'Lab 3'],    invigilator: 'Ms. Ingabire',    statusClass: 'badge-upcoming', status: 'Upcoming' },
    { num: 6, subject: 'Kinyarwanda',          code: 'KIN 401', classes: 'S4A \u00b7 S4B \u00b7 S4C', date: 'Mon, 23 Mar 2026', time: '8:00 \u2013 10:30', duration: '2.5 hrs', rooms: ['Hall A', 'Hall B'],   invigilator: 'Mr. Bizimana',    statusClass: 'badge-draft',    status: 'Draft'    },
    { num: 7, subject: 'History',              code: 'HIS 301', classes: 'S3A \u00b7 S3B \u00b7 S3C', date: 'Tue, 17 Mar 2026', time: '2:00 \u2013 4:30',  duration: '2.5 hrs', rooms: ['Room 10', 'Room 11'], invigilator: 'Mr. Nsabimana',   statusClass: 'badge-upcoming', status: 'Upcoming' },
]

function ExamRow({ num, subject, code, classes, date, time, duration, rooms, invigilator, statusClass, status }) {
    return (
        <tr>
            <td>{num}</td>
            <td>
                <div className="es-subject-name">{subject}</div>
                <div className="es-subject-code">{code}</div>
            </td>
            <td>{classes}</td>
            <td className="es-nowrap">{date}</td>
            <td>
                <span className="es-time-chip">
                    <span className="material-symbols-rounded">schedule</span>{time}
                </span>
            </td>
            <td>{duration}</td>
            <td>{rooms.map((r, i) => <span key={i} className="es-room-chip">{r}</span>)}</td>
            <td>{invigilator}</td>
            <td><span className={`badge ${statusClass}`}>{status}</span></td>
            <td>
                <div className="es-row-actions">
                    <button className="es-icon-btn"><span className="material-symbols-rounded">edit</span></button>
                    <button className="es-icon-btn"><span className="material-symbols-rounded">visibility</span></button>
                    <button className="es-icon-btn danger"><span className="material-symbols-rounded">delete</span></button>
                </div>
            </td>
        </tr>
    )
}

export function DosExamSchedule() {
    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={dosNavItems} secondaryItems={dosSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <header className="dashboard-header">
                        <button className="mobile-menu-btn">
                            <span className="material-symbols-rounded">menu</span>
                        </button>
                        <div className="dashboard-header-title">
                            <h1>Exam Schedule</h1>
                            <p>Create and manage examination timetables</p>
                        </div>
                        <div className="dashboard-header-actions">
                            <span className="date-display">Monday, March 09, 2026</span>
                            <button className="btn btn-primary">+ Add Exam</button>
                            <div className="header-user">
                                <div className="header-user-info">
                                    <span className="header-user-name">Dr. Jean-Claude Ndagijimana</span>
                                    <span className="header-user-role">Director of Studies</span>
                                </div>
                                <div className="header-user-av dos-av">JN</div>
                            </div>
                        </div>
                    </header>

                    <div className="dashboard-content">
                        {/* Page Tabs */}
                        <nav className="es-tabs">
                            <button className="es-tab active">
                                <span className="material-symbols-rounded">calendar_month</span> Current Schedule
                            </button>
                            <button className="es-tab">
                                <span className="material-symbols-rounded">edit_calendar</span> Plan / Edit
                            </button>
                            <button className="es-tab">
                                <span className="material-symbols-rounded">meeting_room</span> Room Planner
                            </button>
                            <button className="es-tab">
                                <span className="material-symbols-rounded">send</span> Publish
                            </button>
                        </nav>

                        <div className="card mt-1-5">
                            <div className="card-header">
                                <h2 className="card-title">Term 1 &middot; 2026 Exam Schedule</h2>
                                <div className="es-card-actions">
                                    <span className="badge badge-published">Published</span>
                                    <button className="btn btn-secondary btn-sm">
                                        <span className="material-symbols-rounded">download</span> Export CSV
                                    </button>
                                    <button className="btn btn-secondary btn-sm">
                                        <span className="material-symbols-rounded">print</span> Print / PDF
                                    </button>
                                </div>
                            </div>
                            <div className="card-content">
                                {/* Level filter */}
                                <div className="att-mode-bar">
                                    <button className="att-mode-btn active">All Levels</button>
                                    <button className="att-mode-btn">
                                        <span className="material-symbols-rounded">school</span> Ordinary (S1\u2013S3)
                                    </button>
                                    <button className="att-mode-btn">
                                        <span className="material-symbols-rounded">workspace_premium</span> Advanced (S4\u2013S6)
                                    </button>
                                </div>

                                <div className="es-table-wrap">
                                    <table className="es-table">
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Subject</th>
                                                <th>Class(es)</th>
                                                <th>Date</th>
                                                <th>Time</th>
                                                <th>Duration</th>
                                                <th>Room(s)</th>
                                                <th>Invigilator</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {examRows.map((row, index) => (
                                                <ExamRow key={index} {...row} />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </>
    )
}
