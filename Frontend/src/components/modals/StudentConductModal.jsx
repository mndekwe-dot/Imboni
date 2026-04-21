import { useState, useEffect } from 'react'
import { TabGroup } from '../ui/TabGroup'
import '../../styles/components.css'

const tabs = [
    { key: 'profile', label: 'Profile',       icon: 'person'  },
    { key: 'log',     label: 'Log Incident',  icon: 'report'  },
]

const negativeCategories = [
    'Misconduct',
    'Attendance Violation',
    'Academic Dishonesty',
    'Bullying / Harassment',
    'Property Damage',
    'Defiance of Authority',
]
const positiveCategories = [
    'Leadership',
    'Academic Excellence',
    'Good Conduct',
    'Community Service',
    'Sportsmanship',
    'Helping Others',
]

const mockHistory = [
    { type: 'negative', icon: 'report',        category: 'Attendance Violation',  desc: 'Missed 2 morning assemblies without excuse', points: -4,  date: 'Mar 3, 2026'  },
    { type: 'positive', icon: 'emoji_events',  category: 'Leadership',             desc: 'Led class project and represented school at event', points: +8, date: 'Feb 20, 2026' },
    { type: 'negative', icon: 'warning',       category: 'Misconduct',             desc: 'Disruptive behaviour during study hour',      points: -3,  date: 'Feb 10, 2026' },
]

function OverviewTab({ student }) {
    return (
        <div>
            {/* Score banner */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--muted)', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--discipline, #7c3aed)', lineHeight: 1 }}>{student.score}</div>
                <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Conduct Score</div>
                    <span className={`conduct-badge ${student.conductClass}`}>{student.conduct}</span>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div><span className="disc-points-pos" style={{ fontSize: '1rem' }}>{student.pos}</span> positive</div>
                    <div><span className="disc-points-neg" style={{ fontSize: '1rem' }}>{student.neg}</span> negative</div>
                </div>
            </div>

            {/* Details grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                {[
                    { label: 'Full Name',       value: student.name       },
                    { label: 'Adm Number',      value: student.adm        },
                    { label: 'Class',           value: student.classChip  },
                    { label: 'Section',         value: student.section    },
                    { label: 'Dormitory',           value: student.house      },
                    { label: 'Standing',        value: student.conduct    },
                ].map(({ label, value }) => (
                    <div key={label} style={{ background: 'var(--muted)', borderRadius: '8px', padding: '0.625rem 0.875rem' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>{label}</div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{value}</div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function ReportTab({ student }) {
    const [type, setType]         = useState('negative')
    const [category, setCategory] = useState('')
    const [desc, setDesc]         = useState('')
    const [points, setPoints]     = useState('')
    const [submitted, setSubmitted] = useState(false)

    const categories = type === 'negative' ? negativeCategories : positiveCategories

    function handleSubmit() {
        if (!category || !desc || !points) return
        // future: send to API
        console.log('Incident logged:', { student: student.name, type, category, desc, points })
        setSubmitted(true)
    }

    function handleReset() {
        setType('negative')
        setCategory('')
        setDesc('')
        setPoints('')
        setSubmitted(false)
    }

    if (submitted) {
        return (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                <span className="material-symbols-rounded" style={{ fontSize: '3rem', color: 'var(--success, #16a34a)' }}>check_circle</span>
                <h3 style={{ margin: '0.75rem 0 0.25rem' }}>Incident Logged</h3>
                <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                    The conduct record for <strong>{student.name}</strong> has been saved and is immediately approved.
                </p>
                <button className="btn btn-secondary" onClick={handleReset}>Log Another</button>
            </div>
        )
    }

    return (
        <div>
            {/* Type toggle */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <button
                    className={`btn btn-sm ${type === 'negative' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                    onClick={() => { setType('negative'); setCategory('') }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>warning</span> Negative Incident
                </button>
                <button
                    className={`btn btn-sm ${type === 'positive' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                    onClick={() => { setType('positive'); setCategory('') }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>star</span> Positive Award
                </button>
            </div>

            <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-input" value={category} onChange={e => setCategory(e.target.value)}>
                    <option value="">Select category...</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>

            <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                    className="form-input form-textarea"
                    rows="3"
                    placeholder="Describe what happened..."
                    value={desc}
                    onChange={e => setDesc(e.target.value)}
                />
            </div>

            <div className="form-group">
                <label className="form-label">Points {type === 'negative' ? '(enter as negative, e.g. -5)' : '(enter as positive, e.g. +5)'}</label>
                <input
                    className="form-input"
                    type="number"
                    placeholder={type === 'negative' ? 'e.g. -5' : 'e.g. +5'}
                    value={points}
                    onChange={e => setPoints(e.target.value)}
                />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                    className="btn btn-primary"
                    onClick={handleSubmit}
                    disabled={!category || !desc || !points}>
                    <span className="material-symbols-rounded">save</span> Submit Record
                </button>
            </div>
        </div>
    )
}

function HistoryTab({ student }) {
    return (
        <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginBottom: '1rem' }}>
                Recent conduct records for <strong>{student.name}</strong>
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {mockHistory.map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', background: 'var(--muted)', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                        <div className={`disc-activity-icon ${item.type === 'negative' ? 'warning' : 'positive'}`}>
                            <span className="material-symbols-rounded">{item.icon}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{item.category}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', margin: '0.15rem 0' }}>{item.desc}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{item.date}</div>
                        </div>
                        <span className={item.points > 0 ? 'disc-points-pos' : 'disc-points-neg'} style={{ fontWeight: 700 }}>
                            {item.points > 0 ? `+${item.points}` : item.points}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}

export function StudentConductModal({ student, onClose }) {
    const [tab, setTab] = useState('profile')

    useEffect(() => {
        if (!student) return
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [student])

    if (!student) return null

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>

                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className={`student-av-sm ${student.avClass}`} style={{ width: '2.5rem', height: '2.5rem', fontSize: '0.9rem' }}>
                            {student.initials}
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>{student.name}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                                {student.classChip} &bull; Adm: {student.adm} &bull; {student.house}
                            </div>
                        </div>
                    </div>
                    <button className="btn-icon-clean" onClick={onClose}>
                        <span className="material-symbols-rounded">close</span>
                    </button>
                </div>

                <div className="modal-tabs">
                    <TabGroup tabs={tabs} value={tab} onChange={setTab} />
                </div>

                <div className="modal-body">
                    {tab === 'profile' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <OverviewTab student={student} />
                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span className="material-symbols-rounded" style={{ fontSize: '1.1rem' }}>history</span> Conduct History
                                </div>
                                <HistoryTab student={student} />
                            </div>
                        </div>
                    )}
                    {tab === 'log' && <ReportTab student={student} />}
                </div>

            </div>
        </div>
    )
}
