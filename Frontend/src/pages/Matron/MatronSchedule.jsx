import { Sidebar } from '../../components/layout/Sidebar'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/matron.css'
import { matronNavItems, matronSecondaryItems, matronUser } from './matronNav'
import { DashboardContent } from '../../components/layout/DashboardContent'


const scheduleStats = [
    { iconClass: 'info',     icon: 'calendar_view_week', value: '7',      label: 'Days in Schedule'  },
    { iconClass: 'success',  icon: 'event_available',    value: '42',     label: 'Total Activities'  },
    { iconClass: 'warning',  icon: 'update',             value: '2',      label: 'Changes This Week' },
    { iconClass: 'positive', icon: 'verified',           value: 'Term 1', label: 'Current Term'      },
]

const scheduleChanges = [
    { dotClass: 'pending',  title: 'Wed Mar 11 \u2014 Games moved from 16:30 to 17:00 (field maintenance)', meta: 'Updated by Mr. E. Mutabazi \u00b7 Mar 08, 2026', statusClass: 'pending',  status: 'New'     },
    { dotClass: 'pending',  title: 'Sat Mar 14 \u2014 Visiting hours extended to 16:00 (parent day)',        meta: 'Updated by Mr. E. Mutabazi \u00b7 Mar 08, 2026', statusClass: 'pending',  status: 'New'     },
    { dotClass: 'reviewed', title: 'Week 8 \u2014 Evening prep extended to 21:30 (exam preparation period)', meta: 'Updated by Mr. E. Mutabazi \u00b7 Mar 01, 2026', statusClass: 'reviewed', status: 'Applied' },
]

const weekdayRows = [
    { time: '05:30', label: 'Wake-up',    cellClass: 'other',     subject: 'Wake Up',                teacher: 'All Students',       room: 'Dormitories'          },
    { time: '05:45', label: 'Prep',       cellClass: 'lang',      subject: 'Morning Prep & Showers', teacher: 'Matron supervision',  room: 'Rooms 1\u201310 first' },
    { time: '06:45', label: 'Breakfast',  cellClass: 'science',   subject: 'Breakfast',              teacher: 'All Students',       room: 'Dining Hall'          },
    { time: '07:15', label: 'Assembly',   cellClass: 'english',   subject: 'Morning Assembly',       teacher: 'All students',       room: 'Main Hall'            },
    { time: '07:30', label: 'Lessons',    cellClass: 'math',      subject: 'Lessons Begin',          teacher: 'All classrooms',     room: 'As per class TT'      },
    { time: '13:00', label: 'Lunch',      isBreak: true,          breakText: 'Lunch Break \u2014 Dining Hall \u2014 1 hour' },
    { time: '14:00', label: 'Afternoon',  cellClass: 'math',      subject: 'Afternoon Lessons',      teacher: 'All classrooms',     room: 'As per class TT'      },
    { time: '16:30', label: 'Games',      cellClass: 'humanities',subject: 'Games & Clubs',          teacher: 'Sports Master',      room: 'Grounds / Halls'      },
    { time: '18:00', label: 'Supper',     cellClass: 'science',   subject: 'Supper',                 teacher: 'All Students',       room: 'Dining Hall'          },
    { time: '19:00', label: 'Prep',       cellClass: 'english',   subject: 'Evening Prep',           teacher: 'Supervised study',   room: 'Classrooms / Library' },
    { time: '21:00', label: 'Dorm',       cellClass: 'lang',      subject: 'Return to Dorm',         teacher: 'Matron supervision', room: 'All dormitories'      },
    { time: '21:30', label: 'Lights Out', isBreak: true,          breakText: 'Lights Out \u2014 Juniors (S1\u2013S2) \u00b7 22:00 Seniors (S3\u2013S6) \u00b7 22:15 Curfew Roll Call' },
]

const weekendRows = [
    { time: '06:30', label: 'Wake-up',   sat: { cellClass: 'other',     subject: 'Wake Up',                  teacher: 'All Students',       room: 'Dormitories'      }, sun: { cellClass: 'other',     subject: 'Wake Up',              teacher: 'All Students',    room: 'Dormitories'      } },
    { time: '07:00', label: 'Breakfast', sat: { cellClass: 'science',   subject: 'Breakfast',                teacher: 'All Students',       room: 'Dining Hall'      }, sun: { cellClass: 'science',   subject: 'Breakfast',            teacher: 'All Students',    room: 'Dining Hall'      } },
    { time: '08:00', label: 'Duties',    sat: { cellClass: 'lang',      subject: 'Dorm Cleaning & Duties',   teacher: 'Matron supervision', room: 'All areas'        }, sun: { cellClass: 'english',   subject: 'Chapel / Church Service',teacher: 'Chaplain',      room: 'Chapel'           } },
    { time: '10:00', label: 'Activity',  sat: { cellClass: 'humanities',subject: 'Sports & Recreation',      teacher: 'Sports Master',      room: 'Grounds'          }, sun: { cellClass: 'humanities',subject: 'Free Time / Visiting', teacher: 'Matron on duty', room: 'Designated areas' } },
    { time: '13:00', label: 'Lunch',     sat: { cellClass: 'science',   subject: 'Lunch',                    teacher: 'All Students',       room: 'Dining Hall'      }, sun: { cellClass: 'science',   subject: 'Lunch',                teacher: 'All Students',    room: 'Dining Hall'      } },
    { time: '14:00', label: 'Afternoon', sat: { cellClass: 'humanities',subject: 'Club Activities',          teacher: 'Club patrons',       room: 'Various venues'   }, sun: { cellClass: 'math',      subject: 'Prep / Study',         teacher: 'Self-directed',   room: 'Library / Dorms'  } },
    { time: '18:00', label: 'Supper',    sat: { cellClass: 'science',   subject: 'Supper',                   teacher: 'All Students',       room: 'Dining Hall'      }, sun: { cellClass: 'science',   subject: 'Supper',               teacher: 'All Students',    room: 'Dining Hall'      } },
    { time: '21:00', label: 'Lights Out',isBreak: true, breakText: 'Return to Dorm \u00b7 Lights Out 21:30 (all) \u00b7 Roll Call 21:45' },
]

function ScheduleStat({ iconClass, icon, value, label }) {
    return (
        <div className="disc-stat-card">
            <div className={`disc-stat-icon ${iconClass}`}><span className="material-symbols-rounded">{icon}</span></div>
            <div>
                <div className="disc-stat-value">{value}</div>
                <div className="disc-stat-label">{label}</div>
            </div>
        </div>
    )
}

function ScheduleChange({ dotClass, title, meta, statusClass, status }) {
    return (
        <div className="matron-report-row">
            <div className={`matron-report-dot ${dotClass}`}></div>
            <div>
                <div className="matron-report-title">{title}</div>
                <div className="matron-report-meta">{meta}</div>
            </div>
            <span className={`matron-report-status ${statusClass}`}>{status}</span>
        </div>
    )
}

function TtCell({ cellClass, subject, teacher, room }) {
    return (
        <td className={`tt-cell ${cellClass}`}>
            <div className="tt-subject">{subject}</div>
            <div className="tt-teacher">{teacher}</div>
            <div className="tt-room">{room}</div>
        </td>
    )
}

function WeekdayRow({ time, label, isBreak, breakText, cellClass, subject, teacher, room }) {
    if (isBreak) {
        return (
            <tr className="tt-break-row">
                <td className="tt-time-cell"><strong>{time}</strong><span>{label}</span></td>
                <td colSpan={5} className="tt-break-cell">{breakText}</td>
            </tr>
        )
    }
    return (
        <tr>
            <td className="tt-time-cell"><strong>{time}</strong><span>{label}</span></td>
            {[0,1,2,3,4].map(i => <TtCell key={i} cellClass={cellClass} subject={subject} teacher={teacher} room={room} />)}
        </tr>
    )
}

function WeekendRow({ time, label, isBreak, breakText, sat, sun }) {
    if (isBreak) {
        return (
            <tr className="tt-break-row">
                <td className="tt-time-cell"><strong>{time}</strong><span>{label}</span></td>
                <td colSpan={2} className="tt-break-cell">{breakText}</td>
            </tr>
        )
    }
    return (
        <tr>
            <td className="tt-time-cell"><strong>{time}</strong><span>{label}</span></td>
            <TtCell {...sat} />
            <TtCell {...sun} />
        </tr>
    )
}

export function MatronSchedule() {
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
                            <h1>Boarding Schedule</h1>
                            <p>Timetable sent by the Discipline Master &mdash; Karisimbi House</p>
                        </div>
                        <div className="dashboard-header-actions">
                            <span className="date-display">Monday, March 09, 2026</span>
                            <button className="notification-btn">
                                <span className="material-symbols-rounded">notifications</span>
                                <span className="notification-badge">1</span>
                            </button>
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

                        <div className="disc-welcome-banner mb-5">
                            <span className="material-symbols-rounded" style={{ fontSize: '1.5rem' }}>verified</span>
                            <div>
                                <div className="banner-title">Schedule issued by Mr. E. Mutabazi &mdash; Director of Discipline</div>
                                <div className="banner-sub">Last updated: Monday, March 09, 2026 &middot; Term 1, Week 9 &middot; Read-only &mdash; contact Discipline Master to request changes</div>
                            </div>
                        </div>

                        <div className="disc-picker mb-5">
                            <div className="disc-picker-group">
                                <label className="disc-picker-label">Week</label>
                                <select className="disc-picker-select" defaultValue="week9">
                                    <option value="week7">Week 7 (Feb 23 &ndash; Feb 27)</option>
                                    <option value="week8">Week 8 (Mar 02 &ndash; Mar 06)</option>
                                    <option value="week9">Week 9 (Mar 09 &ndash; Mar 13) &mdash; Current</option>
                                    <option value="week10">Week 10 (Mar 16 &ndash; Mar 20)</option>
                                    <option value="week11">Week 11 (Mar 23 &ndash; Mar 27)</option>
                                </select>
                            </div>
                            <div className="disc-picker-group">
                                <label className="disc-picker-label">Day</label>
                                <select className="disc-picker-select" defaultValue="all">
                                    <option value="all">All Days</option>
                                    <option value="mon">Monday</option>
                                    <option value="tue">Tuesday</option>
                                    <option value="wed">Wednesday</option>
                                    <option value="thu">Thursday</option>
                                    <option value="fri">Friday</option>
                                    <option value="sat">Saturday</option>
                                    <option value="sun">Sunday</option>
                                </select>
                            </div>
                            <span className="disc-picker-current">Week 9 &mdash; All Days</span>
                            <button className="btn btn-outline btn-sm ml-auto">
                                <span className="material-symbols-rounded">print</span> Print
                            </button>
                        </div>

                        <div className="disc-stat-grid mb-5">
                            {scheduleStats.map((stat, index) => (
                                <ScheduleStat key={index} {...stat} />
                            ))}
                        </div>

                        <div className="card mb-1-5">
                            <div className="card-header">
                                <h3 className="card-title">
                                    <span className="material-symbols-rounded">calendar_view_week</span> Week 9 &mdash; Monday to Friday
                                </h3>
                                <span className="did-direct-badge">
                                    <span className="material-symbols-rounded">lock</span>
                                    Read-only
                                </span>
                            </div>
                            <div className="card-content">
                                <div className="tt-wrap">
                                    <table className="tt-table">
                                        <thead>
                                            <tr>
                                                <th className="tt-time-head">Time</th>
                                                <th className="tt-day-head">Monday</th>
                                                <th className="tt-day-head">Tuesday</th>
                                                <th className="tt-day-head">Wednesday</th>
                                                <th className="tt-day-head">Thursday</th>
                                                <th className="tt-day-head">Friday</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {weekdayRows.map((row, index) => (
                                                <WeekdayRow key={index} {...row} />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="card mb-1-5">
                            <div className="card-header">
                                <h3 className="card-title">
                                    <span className="material-symbols-rounded">weekend</span> Week 9 &mdash; Weekend (Sat &amp; Sun)
                                </h3>
                                <span className="did-direct-badge">
                                    <span className="material-symbols-rounded">lock</span>
                                    Read-only
                                </span>
                            </div>
                            <div className="card-content">
                                <div className="tt-wrap">
                                    <table className="tt-table">
                                        <thead>
                                            <tr>
                                                <th className="tt-time-head">Time</th>
                                                <th className="tt-day-head">Saturday</th>
                                                <th className="tt-day-head">Sunday</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {weekendRows.map((row, index) => (
                                                <WeekendRow key={index} {...row} />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title"><span className="material-symbols-rounded">history</span> Recent Schedule Changes</h3>
                            </div>
                            <div className="card-content">
                                <div className="matron-report-list">
                                    {scheduleChanges.map((change, index) => (
                                        <ScheduleChange key={index} {...change} />
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
