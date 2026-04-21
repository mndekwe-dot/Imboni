import { Sidebar } from '../../components/layout/Sidebar'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/parent.css'
import '../../styles/my-children.css'
import { parentNavItems, parentSecondaryItems, parentUser } from './parentNav'


const children = [
    {
        initials: 'UA', name: 'Uwase Amina', gradeId: 'S4A | Bisoke House | ID: 2024-001', status: 'In School', statusDot: 'online',
        subjects: ['Mathematics', 'Physics', 'English', 'Chemistry', 'Biology'],
        currentLesson: 'Mathematics', currentRoom: 'Room 204 \u2022 Until 02:30 PM', nextLesson: 'English (02:45 PM)',
        fees: [{ label: 'Tuition Fees', value: 'Cleared', valueClass: 'status-paid' }, { label: 'Boarding Fees', value: 'Cleared', valueClass: 'status-paid' }],
        docName: 'Term2_Report_Card.pdf', messageTeacher: 'Message Ms. Claudine Umutoni',
    },
]

function ChildCard({ initials, name, gradeId, status, statusDot, subjects, currentLesson, currentRoom, nextLesson, fees, docName, messageTeacher }) {
    return (
        <div className="card student-card">
            <div className="student-card-header">
                <div className="student-avatar-large">{initials}</div>
                <div className="student-meta">
                    <h3>{name}</h3>
                    <p className="student-id-tag">{gradeId}</p>
                </div>
                <div className="status-indicator">
                    <span className={`dot ${statusDot}`}></span> <span className="status-text">{status}</span>
                </div>
            </div>

            <div className="card-content">
                <section className="detail-section">
                    <h4 className="section-title"><span className="material-symbols-rounded">menu_book</span> Academic Focus</h4>
                    <div className="subject-tags">
                        {subjects.map((s, i) => <span key={i} className="tag">{s}</span>)}
                    </div>
                </section>

                <section className="detail-section">
                    <h4 className="section-title"><span className="material-symbols-rounded">schedule</span> Live Schedule</h4>
                    <div className="current-lesson-card">
                        <div className="lesson-status">NOW</div>
                        <div className="lesson-info">
                            <p className="lesson-name">{currentLesson}</p>
                            <p className="lesson-time">{currentRoom}</p>
                        </div>
                    </div>
                    <p className="next-up"><strong>Next:</strong> {nextLesson}</p>
                </section>

                <section className="detail-section financial-brief">
                    {fees.map((fee, i) => (
                        <div key={i} className="financial-row">
                            <span className="label">{fee.label}:</span>
                            <span className={`value ${fee.valueClass}`}>{fee.value}</span>
                        </div>
                    ))}
                </section>

                <section className="detail-section">
                    <h4 className="section-title"><span className="material-symbols-rounded">folder_open</span> Documents</h4>
                    <div className="document-list">
                        <a href="#" className="doc-item">
                            <span className="material-symbols-rounded">picture_as_pdf</span>
                            <span>{docName}</span>
                        </a>
                    </div>
                </section>

                <hr className="divider" />

                <div className="student-card-footer">
                    <button className="btn btn-primary w-full">
                        <span className="material-symbols-rounded">chat</span> {messageTeacher}
                    </button>
                    <div className="footer-secondary-btns">
                        <button className="btn btn-outline btn-icon"><span className="material-symbols-rounded">visibility</span></button>
                        <button className="btn btn-outline btn-icon"><span className="material-symbols-rounded">edit</span></button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export function ParentChildren() {
    return (
        <>
            <div className="dashboard-layout">
                <Sidebar navItems={parentNavItems} secondaryItems={parentSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <header className="dashboard-header">
                        <button className="mobile-menu-btn" onClick={() => document.dispatchEvent(new CustomEvent('imboni:open-sidebar'))}>
                            <span className="material-symbols-rounded">menu</span>
                        </button>
                        <div className="dashboard-header-title">
                            <h1>My Children</h1>
                        </div>
                        <div className="dashboard-header-actions">
                            <button className="btn btn-primary">
                                <span className="material-symbols-rounded">person_add</span>
                                Add Child
                            </button>
                        </div>
                    </header>

                    <div className="dashboard-content">
                        <div className="add-child-mobile-bar">
                            <button className="btn btn-primary">
                                <span className="material-symbols-rounded">person_add</span>
                                Add Child
                            </button>
                        </div>
                        <div className="student-grid">
                            {children.map((child, index) => (
                                <ChildCard key={index} {...child} />
                            ))}
                        </div>
                    </div>
                </main>
            </div>
        </>
    )
}
