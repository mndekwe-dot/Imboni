import { useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/student.css'
import { studentNavItems, studentSecondaryItems, studentUser } from './studentNav'
import { DashboardContent } from '../../components/layout/DashboardContent'

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 PATTERN — DATA AS ARRAYS AT THE TOP
//
// Rule: never write the same JSX block more than once.
// If you copy-pasted a <div> 6 times and only changed the text inside,
// that text belongs in an array. The JSX belongs in a small component.
//
// HOW TO SPOT SOMETHING THAT SHOULD BE AN ARRAY:
//   - You see the same HTML structure repeated 3+ times
//   - The only difference between copies is the text/number inside
//   - Example: 6 subject cards that all look the same but different subject name
//
// STEP 1 → data array in this file    (you are here)
// STEP 2 → data array in src/data/   (just move the array, component unchanged)
// STEP 3 → data from API via fetch()  (replace array with useState, component unchanged)
// ─────────────────────────────────────────────────────────────────────────────


// ── NAV (already an array — good, this is the pattern) ──────────────────────


// ── DATA ARRAY 1 — Summary stat cards ────────────────────────────────────────
// Before: 4 copy-pasted <div className="result-summary-card"> blocks
// After:  one array + one small component (ResultSummaryCard) below
//
// Each object = one card. Keys match exactly what the component needs.
const summaryStats = [
    { value: '3.8',  label: 'GPA this Term',    color: null              },
    { value: '87%',  label: 'Average Score',     color: 'var(--student)' },
    { value: '4th',  label: 'Class Position',    color: 'var(--success)' },
    { value: '6',    label: 'Subjects Taken',    color: 'var(--accent)'  },
]


// ── DATA ARRAY 2 — Subject grade cards ───────────────────────────────────────
// Before: 6 copy-pasted <div className="subject-grade-card"> blocks
// After:  one array + one small component (SubjectGradeCard) below
//
// gradeClass → the CSS class that controls the colour (grade-a, grade-b, etc.)
// width      → the bar fill percentage as a string e.g. '95%'
// position   → class rank e.g. '1st in class'
const subjectGrades = [
    { subject: 'English',          grade: 'A+', gradeClass: 'grade-a', score: 95, width: '90%', position: '1st in class',  teacher: 'Ms. Umutoni'       },
    { subject: 'Mathematics',      grade: 'A',  gradeClass: 'grade-a', score: 89, width: '89%', position: '3rd in class',  teacher: 'Mr. Rurangwa'      },
    { subject: 'Physics',          grade: 'B+', gradeClass: 'grade-b', score: 84, width: '84%', position: '5th in class',  teacher: 'Ms. Uwera'         },
    { subject: 'History',          grade: 'B+', gradeClass: 'grade-b', score: 82, width: '82%', position: '4th in class',  teacher: 'Mr. Ntakirutimana' },
    { subject: 'Chemistry',        grade: 'B',  gradeClass: 'grade-b', score: 76, width: '76%', position: '8th in class',  teacher: 'Mr. Bizimana'      },
    { subject: 'Computer Science', grade: 'B',  gradeClass: 'grade-b', score: 78, width: '78%', position: '6th in class',  teacher: 'Mr. Murenzi'       },
]


// ── DATA ARRAY 3 — Assessment table rows ─────────────────────────────────────
// Before: 9 copy-pasted <tr> blocks
// After:  one array + one small component (AssessmentRow) below
//
// badgeStyle → the inline style object for the grade badge colour
//              (in Step 3 this would be computed from the grade letter automatically)
const assessments = [
    { subject: 'Mathematics', assessment: 'CAT 1',      max: 50, score: 45, pct: '90%', grade: 'A',  badgeStyle: { background: 'var(--success-light)',  color: 'var(--success)'  }, date: 'Jan 20' },
    { subject: 'Mathematics', assessment: 'CAT 2',      max: 50, score: 43, pct: '86%', grade: 'A',  badgeStyle: { background: 'var(--success-light)',  color: 'var(--success)'  }, date: 'Feb 14' },
    { subject: 'Mathematics', assessment: 'Quiz 4',     max: 20, score: 17, pct: '85%', grade: 'A',  badgeStyle: { background: 'var(--success-light)',  color: 'var(--success)'  }, date: 'Mar 7'  },
    { subject: 'Physics',     assessment: 'CAT 1',      max: 50, score: 40, pct: '80%', grade: 'B+', badgeStyle: { background: 'var(--student-light)',  color: 'var(--student)'  }, date: 'Jan 25' },
    { subject: 'Physics',     assessment: 'CAT 2',      max: 50, score: 39, pct: '78%', grade: 'B+', badgeStyle: { background: 'var(--student-light)',  color: 'var(--student)'  }, date: 'Mar 5'  },
    { subject: 'English',     assessment: 'Essay 1',    max: 40, score: 37, pct: '93%', grade: 'A+', badgeStyle: { background: 'var(--success-light)',  color: 'var(--success)'  }, date: 'Feb 5'  },
    { subject: 'English',     assessment: 'Essay 2',    max: 40, score: 37, pct: '92%', grade: 'A+', badgeStyle: { background: 'var(--success-light)',  color: 'var(--success)'  }, date: 'Mar 3'  },
    { subject: 'Chemistry',   assessment: 'Lab Report', max: 30, score: 21, pct: '71%', grade: 'B',  badgeStyle: { background: 'var(--warning-light)',  color: 'var(--warning)'  }, date: 'Feb 28' },
    { subject: 'Chemistry',   assessment: 'CAT 1',      max: 50, score: 40, pct: '80%', grade: 'B+', badgeStyle: { background: 'var(--student-light)',  color: 'var(--student)'  }, date: 'Feb 10' },
]


// ─────────────────────────────────────────────────────────────────────────────
// SMALL COMPONENTS — one per repeated block
//
// Rule: a small component is just a function that takes props and returns JSX.
// It lives in the SAME file for now (Step 1).
// In a larger project you would move it to src/components/ — but not yet.
//
// HOW TO READ THE PROPS SYNTAX:
//   function MyCard({ title, value })   ← destructuring: pulls title and value
//                                          out of the props object automatically
//   is the same as:
//   function MyCard(props) { const { title, value } = props }
// ─────────────────────────────────────────────────────────────────────────────


// ── Small component 1 — one summary stat card ────────────────────────────────
// Receives: value (the big number/text), label (small text below), color (optional)
function ResultSummaryCard({ value, label, color }) {
    return (
        <div className="result-summary-card">
            {/* color is optional — if null, no inline style is applied */}
            <div className="result-summary-value" style={color ? { color } : {}}>
                {value}
            </div>
            <div className="result-summary-label">{label}</div>
        </div>
    )
}


// ── Small component 2 — one subject grade card ───────────────────────────────
// Receives: all fields from the subjectGrades array above
function SubjectGradeCard({ subject, grade, gradeClass, width, position, teacher }) {
    return (
        <div className={`subject-grade-card ${gradeClass}`}>
            <div className="subject-grade-top">
                <span className="subject-name-label">{subject}</span>
                <span className="grade-badge">{grade}</span>
            </div>
            <div className="grade-bar-wrap">
                <div className="grade-bar" style={{ width }}></div>
            </div>
            <div className="grade-meta">
                {/* Template literal: backtick strings that embed variables with ${} */}
                <span>{`${width.replace('%', '')}% • ${position}`}</span>
                <span>{teacher}</span>
            </div>
        </div>
    )
}


// ── Small component 3 — one assessment table row ─────────────────────────────
// Receives: all fields from the assessments array above
function AssessmentRow({ subject, assessment, max, score, pct, grade, badgeStyle, date }) {
    return (
        <tr>
            <td><strong>{subject}</strong></td>
            <td>{assessment}</td>
            <td>{max}</td>
            <td>{score}</td>
            <td>{pct}</td>
            <td><span className="badge" style={badgeStyle}>{grade}</span></td>
            <td>{date}</td>
        </tr>
    )
}


// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE COMPONENT
//
// This is now very clean. The JSX here is purely layout/structure.
// All repeated content is replaced with .map() calls.
//
// HOW .map() WORKS:
//   array.map(item => <Component key={item.x} ...item />)
//   - Loops over every item in the array
//   - Returns a new array of JSX elements
//   - key= is required by React — it must be unique per item
//     use an id if available, otherwise the index (item, index) => ... i
//   - ...item is the spread operator: passes every key in the object as a prop
//     { subject: 'Maths', grade: 'A' }  becomes  subject="Maths" grade="A"
// ─────────────────────────────────────────────────────────────────────────────

const TERMS = ['Term 1', 'Term 2', 'Term 3']

export function StudentResults() {
    const [activeTerm, setActiveTerm] = useState('Term 2')

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={studentNavItems} secondaryItems={studentSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="My Results"
                        subtitle="Academic performance — S4A"
                        userName="Uwase Amina" userRole="Student · S4A"
                        userInitials="UA" avatarClass="student-av" notifications={studentUser.notifications}
                    />
                    <DashboardContent>

                        {/* Toolbar container */}
                        <div className="toolbar-card" style={{ width: 'fit-content' }}>
                            {TERMS.map(term => (
                                <button
                                    key={term}
                                    className={`term-tab${activeTerm === term ? ' active' : ''}`}
                                    onClick={() => setActiveTerm(term)}
                                >
                                    {term}
                                </button>
                            ))}
                        </div>

                        {/* Summary stats — 4 cards from array */}
                        <div className="results-summary-grid">
                            {summaryStats.map((stat, index) => (
                                // No id in this data so we use index as key
                                // index = 0, 1, 2, 3 — fine when the list never reorders
                                <ResultSummaryCard
                                    key={index}
                                    value={stat.value}
                                    label={stat.label}
                                    color={stat.color}
                                />
                                // TIP: the above is identical to:
                                // <ResultSummaryCard key={index} {...stat} />
                                // The spread {...stat} passes every key as a prop automatically
                            ))}
                        </div>

                        {/* Subject grade cards — 6 cards from array */}
                        <div className="subject-grades-grid">
                            {subjectGrades.map((subject, index) => (
                                // Using spread here — passes ALL keys from the object as props
                                // subject.subject, subject.grade, subject.width etc.
                                // become: subject="..." grade="..." width="..." etc.
                                <SubjectGradeCard key={index} {...subject} />
                            ))}
                        </div>

                        {/* Detailed assessment table */}
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">Detailed Assessment Breakdown</h3>
                                <span className="badge badge-student">Term 2</span>
                            </div>
                            <div className="card-content">
                                <div className="table-responsive">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Subject</th><th>Assessment</th><th>Max Score</th>
                                                <th>Score</th><th>%</th><th>Grade</th><th>Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {assessments.map((row, index) => (
                                                <AssessmentRow key={index} {...row} />
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
