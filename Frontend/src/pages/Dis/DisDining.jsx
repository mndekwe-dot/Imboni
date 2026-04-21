import { Sidebar } from '../../components/layout/Sidebar'
import { FilterBar } from '../../components/ui/FilterBar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { TabGroup } from '../../components/ui/TabGroup'
import { disNavItems, disSecondaryItems, disUser } from './disNav'
import { useState } from 'react'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'

const houseColors = {
    karisimbi: { solid: '#ca8a04', light: 'rgba(234,179,8,0.10)',  text: '#854d0e' },
    muhabura:  { solid: '#16a34a', light: 'rgba(34,197,94,0.10)',  text: '#166534' },
    bisoke:    { solid: '#7c3aed', light: 'rgba(139,92,246,0.10)', text: '#5b21b6' },
    sabyinyo:  { solid: '#ea580c', light: 'rgba(249,115,22,0.10)', text: '#9a3412' },
}

const formOrder = ['F1A','F1B','F1C','F2A','F2B','F2C','F3A','F3B','F3C','F4A','F4B','F4C']

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

const initialSittings = [
    { key: 'karisimbi',   name: 'Karisimbi Sitting', section: 'Section A', staff: 'Mrs. Mukamana',  gender: 'Girls', capacity: 300, tablesCount: 30, seatsPerTable: 10, breakfast: '7:00 AM', lunch: '1:00 PM', dinner: '7:00 PM', incidents: 0 },
    { key: 'muhabura',    name: 'Muhabura Sitting',  section: 'Section B', staff: 'Mr. Habimana',   gender: 'Boys',  capacity: 300, tablesCount: 30, seatsPerTable: 10, breakfast: '7:00 AM', lunch: '1:00 PM', dinner: '7:00 PM', incidents: 2 },
    { key: 'bisoke',   name: 'Bisoke Sitting',    section: 'Section C', staff: 'Ms. Ingabire',   gender: 'Girls', capacity: 300, tablesCount: 30, seatsPerTable: 10, breakfast: '7:00 AM', lunch: '1:00 PM', dinner: '7:00 PM', incidents: 0 },
    { key: 'sabyinyo',name: 'Sabyinyo Sitting',  section: 'Section D', staff: 'Mr. Nsabimana',  gender: 'Boys',  capacity: 300, tablesCount: 30, seatsPerTable: 10, breakfast: '7:00 AM', lunch: '1:00 PM', dinner: '7:00 PM', incidents: 1 },
]

// Sample students already assigned to tables
const initialStudents = [
    // Kigoma Table 1
    { id: 1,  name: 'Uwase Amina',       adm: '2021-F4-001', form: 'F4A', level: 'advanced', sitting: 'karisimbi', table: 1, seat: 1, isChief: true  },
    { id: 2,  name: 'Mukamana Grace',    adm: '2023-F2-011', form: 'F2A', level: 'ordinary', sitting: 'karisimbi', table: 1, seat: 2, isChief: false },
    { id: 3,  name: 'Ingabire Marie',    adm: '2024-F1-002', form: 'F1A', level: 'ordinary', sitting: 'karisimbi', table: 1, seat: 3, isChief: false },
    { id: 4,  name: 'Umubyeyi Faith',    adm: '2024-F1-003', form: 'F1B', level: 'ordinary', sitting: 'karisimbi', table: 1, seat: 4, isChief: false },
    // Kigoma Table 2
    { id: 5,  name: 'Nyiransabimana E.', adm: '2021-F4-015', form: 'F4B', level: 'advanced', sitting: 'karisimbi', table: 2, seat: 1, isChief: true  },
    { id: 6,  name: 'Mukeshimana Alice', adm: '2023-F2-020', form: 'F2A', level: 'ordinary', sitting: 'karisimbi', table: 2, seat: 2, isChief: false },
    { id: 7,  name: 'Uwamariya Mercy',   adm: '2024-F1-010', form: 'F1A', level: 'ordinary', sitting: 'karisimbi', table: 2, seat: 3, isChief: false },
    // Qatar Table 1
    { id: 8,  name: 'Habimana Kevin',    adm: '2021-F4-041', form: 'F4A', level: 'advanced', sitting: 'muhabura',   table: 1, seat: 1, isChief: true  },
    { id: 9,  name: 'Nkurunziza Peter',  adm: '2024-F1-101', form: 'F1B', level: 'ordinary', sitting: 'muhabura',   table: 1, seat: 2, isChief: false },
    { id: 10, name: 'Bizimana James',    adm: '2023-F2-055', form: 'F2B', level: 'ordinary', sitting: 'muhabura',   table: 1, seat: 3, isChief: false },
    { id: 11, name: 'Hakizimana Brian',  adm: '2022-F3-028', form: 'F3A', level: 'advanced', sitting: 'muhabura',   table: 1, seat: 4, isChief: false },
]

const initialUnassigned = [
    { id: 101, name: 'Uwineza Nancy',   adm: '2024-F1-200', form: 'F1A', level: 'ordinary' },
    { id: 102, name: 'Mugenzi Oliver',  adm: '2024-F1-201', form: 'F1B', level: 'ordinary' },
    { id: 103, name: 'Ingabire Purity', adm: '2024-F1-202', form: 'F1A', level: 'ordinary' },
]

const allReports = [
    { typeClass: 'negative', icon: 'restaurant', title: 'Food fight during lunch sitting — Qatar Section',       time: 'Mar 7, 2026 · Qatar Section B'   },
    { typeClass: 'warning',  icon: 'no_food',    title: 'Student left without eating — possible wellness concern', time: 'Mar 6, 2026 · Samiyonga Section D'   },
    { typeClass: 'positive', icon: 'star',       title: 'Exemplary dining conduct — Karisimbi Section commended',  time: 'Mar 4, 2026 · Karisimbi Section A' },
    { typeClass: 'negative', icon: 'report',     title: 'Noise disturbance during dinner — Qatar Section',       time: 'Mar 3, 2026 · Qatar Section B'   },
    { typeClass: 'warning',  icon: 'warning',    title: 'Student found with outside food — Samiyonga Section',       time: 'Mar 1, 2026 · Samiyonga Section D'   },
]

const reportFilterOptions = [
    { key: 'all',      label: 'All Reports' },
    { key: 'negative', label: 'Negative', count: allReports.filter(r => r.typeClass === 'negative').length },
    { key: 'warning',  label: 'Warning'  },
    { key: 'positive', label: 'Positive' },
]

const iconClassMap = { negative: 'warning', warning: 'warning', positive: 'positive' }
const typeLabel    = { negative: 'Negative', warning: 'Warning', positive: 'Positive' }

// ── Auto-assign: spreads students across exactly `tablesToGenerate` tables ──
function generateTableAssignments(students, rules) {
    const shuffled = [...students].sort(() => Math.random() - 0.5)
    const numTables = Math.max(1, Math.min(rules.tablesToGenerate, shuffled.length))
    const tables = []

    for (let t = 0; t < numTables; t++) {
        const start = Math.floor((t / numTables) * shuffled.length)
        const end   = Math.floor(((t + 1) / numTables) * shuffled.length)
        const tableStudents = shuffled.slice(start, end).map((s, i) => ({
            ...s, seat: i + 1, table: t + 1, isChief: false,
        }))
        if (rules.autoChief && tableStudents.length > 0) {
            const sorted = [...tableStudents].sort((a, b) => formOrder.indexOf(b.form) - formOrder.indexOf(a.form))
            tableStudents.forEach(s => { s.isChief = s.id === sorted[0].id })
        }
        if (tableStudents.length > 0) tables.push({ number: t + 1, students: tableStudents })
    }
    return tables
}

// ── Section config editor ──
function SectionConfigEditor({ sitting, onSave }) {
    const [local, setLocal] = useState({ ...sitting })
    return (
        <div style={{ background: 'var(--muted)', padding: '1rem 1.5rem', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Configure Section
            </div>
            <div className="form-row-2" style={{ marginBottom: '0.75rem' }}>
                <div className="form-group">
                    <label className="form-label">Sitting Name</label>
                    <input type="text" className="form-input" value={local.name}
                        onChange={e => setLocal(l => ({ ...l, name: e.target.value }))} />
                </div>
                <div className="form-group">
                    <label className="form-label">Section</label>
                    <input type="text" className="form-input" value={local.section}
                        onChange={e => setLocal(l => ({ ...l, section: e.target.value }))} />
                </div>
                <div className="form-group">
                    <label className="form-label">Duty Staff</label>
                    <input type="text" className="form-input" value={local.staff}
                        onChange={e => setLocal(l => ({ ...l, staff: e.target.value }))} />
                </div>
                <div className="form-group">
                    <label className="form-label">Seat Capacity</label>
                    <input type="number" className="form-input" min={1} value={local.capacity}
                        onChange={e => setLocal(l => ({ ...l, capacity: Number(e.target.value) }))} />
                </div>
                <div className="form-group">
                    <label className="form-label">Tables</label>
                    <input type="number" className="form-input" min={1} value={local.tablesCount}
                        onChange={e => setLocal(l => ({ ...l, tablesCount: Number(e.target.value) }))} />
                </div>
                <div className="form-group">
                    <label className="form-label">Seats Per Table</label>
                    <input type="number" className="form-input" min={1} value={local.seatsPerTable}
                        onChange={e => setLocal(l => ({ ...l, seatsPerTable: Number(e.target.value) }))} />
                </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary btn-sm" onClick={() => onSave(local)}>
                    <span className="material-symbols-rounded">save</span> Save
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => onSave(sitting)}>Cancel</button>
            </div>
        </div>
    )
}

// ── Student row inside a table block ──
function DiningStudentRow({ student, mode, availableTables, onAppointChief, onMoveTable }) {
    return (
        <div className="student-row">
            <div className={`student-av-sm ${student.level === 'advanced' ? 'patron' : 'matron'}`}>
                {getInitials(student.name)}
            </div>
            <div className="student-row-info">
                <span className="student-row-name">
                    {student.name}
                    {student.isChief && (
                        <span className="badge" style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', fontSize: '0.65rem', marginLeft: '0.4rem', padding: '1px 6px' }}>
                            Table Chief
                        </span>
                    )}
                </span>
                <span className="student-row-meta">
                    Seat {student.seat} &bull; {student.adm} &bull; {student.form} &bull;&nbsp;
                    <span style={{ color: student.level === 'advanced' ? '#0891b2' : '#0d9488', fontWeight: 600 }}>
                        {student.level.charAt(0).toUpperCase() + student.level.slice(1)}
                    </span>
                </span>
            </div>
            {mode === 'edit' && (
                <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0, flexWrap: 'wrap' }}>
                    {!student.isChief && (
                        <button className="btn btn-outline btn-sm" onClick={() => onAppointChief(student.id)}>
                            <span className="material-symbols-rounded" style={{ fontSize: '0.875rem' }}>star</span> Chief
                        </button>
                    )}
                    <select
                        className="form-input"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', height: 'auto', width: 'auto' }}
                        value={student.table}
                        onChange={e => onMoveTable(student.id, Number(e.target.value))}>
                        {availableTables.map(t => (
                            <option key={t} value={t}>Table {t}</option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    )
}

// ── Table block (collapsible) ──
function TableBlock({ tableNum, students, seatsPerTable, mode, availableTables, onAppointChief, onMoveTable }) {
    const chief = students.find(s => s.isChief)
    return (
        <details className="class-accordion">
            <summary className="class-summary">
                <div className="class-summary-left">
                    <span className="material-symbols-rounded expand-icon">chevron_right</span>
                    <span className="class-label">Table {tableNum}</span>
                    {chief && (
                        <span style={{ fontSize: '0.7rem', color: '#f97316', marginLeft: '0.5rem' }}>
                            Chief: {chief.name}
                        </span>
                    )}
                </div>
                <div className="class-summary-right">
                    <span className="class-count">{students.length}/{seatsPerTable} seats</span>
                </div>
            </summary>
            <div className="student-roster">
                {students.map(s => (
                    <DiningStudentRow
                        key={s.id}
                        student={s}
                        mode={mode}
                        availableTables={availableTables}
                        onAppointChief={onAppointChief}
                        onMoveTable={onMoveTable}
                    />
                ))}
                {students.length < seatsPerTable && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', padding: '0.4rem 0', fontStyle: 'italic' }}>
                        {seatsPerTable - students.length} seat{seatsPerTable - students.length > 1 ? 's' : ''} available
                    </div>
                )}
            </div>
        </details>
    )
}


export function DisDiningPanel() {
    const [mode, setMode]               = useState('view')   // 'view' | 'edit' | 'assign'
    const [sittings, setSittings]       = useState(initialSittings)
    const [students, setStudents]       = useState(initialStudents)
    const [unassigned, setUnassigned]   = useState(initialUnassigned)
    const [editingKey, setEditingKey]   = useState(null)
    const [confirmDelete, setConfirmDelete] = useState(null) // key of sitting pending delete
    const [pendingAssign, setPendingAssign] = useState({})
    const [preview, setPreview]         = useState(null)
    const [rules, setRules]             = useState({ tablesToGenerate: 90, autoChief: true })
    const [reportFilter, setReportFilter] = useState('all')

    // Get tables for a sitting from students array
    function getTablesForSitting(sittingKey) {
        const ss = students.filter(s => s.sitting === sittingKey)
        const tableNums = [...new Set(ss.map(s => s.table))].sort((a, b) => a - b)
        return tableNums.map(t => ({
            number: t,
            students: ss.filter(s => s.table === t).sort((a, b) => a.seat - b.seat),
        }))
    }

    // Delete a dining sitting and all its students
    function deleteSitting(key) {
        setSittings(prev => prev.filter(s => s.key !== key))
        setStudents(prev => prev.filter(s => s.sitting !== key))
        setConfirmDelete(null)
        setEditingKey(null)
    }

    // Save sitting config changes
    function saveSitting(key, changes) {
        setSittings(prev => prev.map(s => s.key === key ? { ...s, ...changes } : s))
        setEditingKey(null)
    }

    // Appoint chief — removes existing chief in same table first
    function appointChief(studentId) {
        setStudents(prev => {
            const target = prev.find(s => s.id === studentId)
            return prev.map(s => {
                if (s.sitting === target.sitting && s.table === target.table) {
                    return { ...s, isChief: s.id === studentId }
                }
                return s
            })
        })
    }

    // Move student to a different table in the same sitting
    function moveTable(studentId, newTable) {
        setStudents(prev => {
            const target = prev.find(s => s.id === studentId)
            if (target.table === newTable) return prev
            const sitting = sittings.find(s => s.key === target.sitting)
            const tableStudents = prev.filter(s => s.sitting === target.sitting && s.table === newTable)
            if (tableStudents.length >= sitting.seatsPerTable) return prev
            return prev.map(s =>
                s.id === studentId
                    ? { ...s, table: newTable, seat: tableStudents.length + 1, isChief: false }
                    : s
            )
        })
    }

    // Assign unassigned student to a specific sitting/table
    function assignStudent(studentId, sittingKey, tableNum) {
        const student = unassigned.find(s => s.id === studentId)
        const sitting = sittings.find(s => s.key === sittingKey)
        const tableStudents = students.filter(s => s.sitting === sittingKey && s.table === tableNum)
        if (tableStudents.length >= sitting.seatsPerTable) return
        setStudents(prev => [...prev, { ...student, sitting: sittingKey, table: tableNum, seat: tableStudents.length + 1, isChief: false }])
        setUnassigned(prev => prev.filter(s => s.id !== studentId))
    }

    // Generate auto-assign preview for a sitting
    function handleGenerate(sittingKey) {
        const sittingStudents = students.filter(s => s.sitting === sittingKey)
        const generated = generateTableAssignments(sittingStudents, rules)
        setPreview({ sitting: sittingKey, tables: generated })
    }

    // Apply previewed assignments
    function applyPreview() {
        if (!preview) return
        setStudents(prev =>
            prev.map(s => {
                if (s.sitting !== preview.sitting) return s
                for (const table of preview.tables) {
                    const found = table.students.find(ps => ps.id === s.id)
                    if (found) return { ...s, table: found.table, seat: found.seat, isChief: found.isChief }
                }
                return s
            })
        )
        setPreview(null)
    }

    const visible = reportFilter === 'all'
        ? allReports
        : allReports.filter(r => r.typeClass === reportFilter)

    const totalCapacity  = sittings.reduce((sum, s) => sum + s.capacity, 0)
    const totalIncidents = sittings.reduce((sum, s) => sum + s.incidents, 0)
    const totalChiefs    = students.filter(s => s.isChief).length

    return (
        <div className="dashboard-content">

                        {/* Stats */}
                        <div className="disc-stat-grid">
                            {[
                                { iconClass: 'info',    icon: 'restaurant',         value: '3',                            label: 'Meal Sittings / Day', trend: 'Breakfast · Lunch · Dinner', trendClass: 'positive' },
                                { iconClass: 'success', icon: 'chair',              value: totalCapacity.toLocaleString(), label: 'Dining Capacity',     trend: 'Across all sections',        trendClass: 'positive' },
                                { iconClass: 'warning', icon: 'report',             value: totalIncidents,                 label: 'Conduct Reports',     trend: 'This week',                  trendClass: totalIncidents > 0 ? 'negative' : 'positive' },
                                { iconClass: 'info',    icon: 'supervisor_account', value: totalChiefs,                    label: 'Table Chiefs',         trend: 'Appointed',                  trendClass: 'positive' },
                            ].map((stat, i) => (
                                <div key={i} className="disc-stat-card">
                                    <div className={`disc-stat-icon ${stat.iconClass}`}>
                                        <span className="material-symbols-rounded">{stat.icon}</span>
                                    </div>
                                    <div>
                                        <div className="disc-stat-value">{stat.value}</div>
                                        <div className="disc-stat-label">{stat.label}</div>
                                        <div className={`disc-stat-trend ${stat.trendClass}`}>{stat.trend}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Mode toggle */}
                        <div style={{ marginBottom: '1.25rem' }}>
                            <TabGroup
                                tabs={[
                                    { key: 'view',   label: 'View',          icon: 'visibility' },
                                    { key: 'edit',   label: 'Edit Sections', icon: 'edit'       },
                                    { key: 'assign', label: 'Auto-Assign',   icon: 'shuffle'    },
                                ]}
                                value={mode}
                                onChange={key => { setMode(key); setPreview(null); setConfirmDelete(null) }}
                            />
                        </div>

                        {/* Auto-assign panel */}
                        {mode === 'assign' && (
                            <div className="card" style={{ marginBottom: '1.5rem' }}>
                                <div className="card-header">
                                    <h3 className="card-title">
                                        <span className="material-symbols-rounded">shuffle</span> Auto-Assign Rules
                                    </h3>
                                </div>
                                <div className="card-content">
                                    <div className="form-row-2" style={{ marginBottom: '1rem' }}>
                                        <div className="form-group">
                                            <label className="form-label">Number of Tables to Generate</label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                min={1}
                                                max={90}
                                                value={rules.tablesToGenerate}
                                                onChange={e => setRules(r => ({ ...r, tablesToGenerate: Math.min(90, Math.max(1, Number(e.target.value))) }))}
                                            />
                                            <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '4px', display: 'block' }}>Max: 90 tables</span>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Options</label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer', marginTop: '0.25rem' }}>
                                                <input type="checkbox" checked={rules.autoChief}
                                                    onChange={e => setRules(r => ({ ...r, autoChief: e.target.checked }))} />
                                                Auto-appoint most senior student as Umutware w'Imeza
                                            </label>
                                        </div>
                                    </div>

                                    {/* Generate buttons — can be clicked multiple times to reshuffle */}
                                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                                        {sittings.map(s => (
                                            <button key={s.key} className="btn btn-primary btn-sm" onClick={() => handleGenerate(s.key)}>
                                                <span className="material-symbols-rounded">shuffle</span> Generate for {s.name}
                                            </button>
                                        ))}
                                    </div>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>
                                        You can generate multiple times — each run reshuffles the assignments.
                                    </p>

                                    {/* Preview */}
                                    {preview && (
                                        <div style={{ marginTop: '1.5rem' }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                                                Preview — {sittings.find(s => s.key === preview.sitting)?.name}&nbsp;
                                                <span style={{ fontWeight: 400, color: '#64748b' }}>({preview.tables.length} tables)</span>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem', maxHeight: '360px', overflowY: 'auto' }}>
                                                {preview.tables.map(table => (
                                                    <div key={table.number} style={{ background: 'var(--muted)', borderRadius: '8px', padding: '0.75rem' }}>
                                                        <div style={{ fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                                                            Table {table.number}
                                                            {table.students.find(s => s.isChief) && (
                                                                <span style={{ color: '#f97316', fontSize: '0.68rem', marginLeft: '0.4rem' }}>
                                                                    ★ {table.students.find(s => s.isChief)?.name}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {table.students.map(s => (
                                                            <div key={s.id} style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', padding: '2px 0' }}>
                                                                Seat {s.seat} — {s.name} ({s.form}){s.isChief ? ' ★' : ''}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                                                <button className="btn btn-primary" onClick={applyPreview}>
                                                    <span className="material-symbols-rounded">check</span> Confirm & Apply
                                                </button>
                                                <button className="btn btn-outline" onClick={() => setPreview(null)}>Discard</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Unassigned students */}
                        {unassigned.length > 0 && (
                            <div className="card" style={{ marginBottom: '1.5rem' }}>
                                <div className="card-header">
                                    <h3 className="card-title">
                                        <span className="material-symbols-rounded">person_off</span> Unassigned Students
                                    </h3>
                                    <span className="approval-count-badge">{unassigned.length} students</span>
                                </div>
                                <div className="card-content">
                                    {unassigned.map(s => (
                                        <div key={s.id} className="student-row">
                                            <div className="student-av-sm matron">{getInitials(s.name)}</div>
                                            <div className="student-row-info">
                                                <span className="student-row-name">{s.name}</span>
                                                <span className="student-row-meta">{s.adm} &bull; {s.form} &bull; {s.level}</span>
                                            </div>
                                            {mode === 'edit' && (
                                                <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', flexShrink: 0 }}>
                                                    <select
                                                        className="form-input"
                                                        style={{ fontSize: '0.75rem', width: 'auto', height: 'auto', padding: '0.25rem 0.5rem' }}
                                                        value={pendingAssign[s.id] || ''}
                                                        onChange={e => setPendingAssign(prev => ({ ...prev, [s.id]: e.target.value }))}>
                                                        <option value="">Select table...</option>
                                                        {sittings.map(h => (
                                                            <optgroup key={h.key} label={h.name}>
                                                                {getTablesForSitting(h.key).map(t => (
                                                                    <option key={t.number} value={`${h.key}:${t.number}`}>
                                                                        Table {t.number} ({t.students.length}/{h.seatsPerTable})
                                                                    </option>
                                                                ))}
                                                            </optgroup>
                                                        ))}
                                                    </select>
                                                    <button
                                                        className="btn btn-primary btn-sm"
                                                        disabled={!pendingAssign[s.id]}
                                                        onClick={() => {
                                                            const val = pendingAssign[s.id]
                                                            if (!val) return
                                                            const [sittingKey, tableNum] = val.split(':')
                                                            assignStudent(s.id, sittingKey, Number(tableNum))
                                                            setPendingAssign(prev => { const n = { ...prev }; delete n[s.id]; return n })
                                                        }}>
                                                        <span className="material-symbols-rounded" style={{ fontSize: '0.875rem' }}>check</span> Assign
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* House dining cards + table lists */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem', marginBottom: '1.75rem' }}>
                            {sittings.map(sitting => {
                                const col = houseColors[sitting.key] ?? { solid: '#64748b', light: 'rgba(100,116,139,0.1)', text: '#334155' }
                                const isEditingThis  = editingKey === sitting.key
                                const isConfirmingDelete = confirmDelete === sitting.key
                                const schedule = `${sitting.breakfast} · ${sitting.lunch} · ${sitting.dinner}`
                                const tables = getTablesForSitting(sitting.key)
                                const tableNums = tables.map(t => t.number)
                                const chiefs = students.filter(s => s.sitting === sitting.key && s.isChief).length

                                return (
                                    <div
                                        key={sitting.key}
                                        style={{
                                            background: 'var(--card)',
                                            border: '2px solid var(--border)',
                                            borderRadius: '12px',
                                            overflow: 'hidden',
                                            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                                        }}>

                                        {/* Top accent bar */}
                                        <div style={{ background: col.solid, height: '5px' }} />

                                        {/* Header */}
                                        <div style={{ background: col.light, padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                                                <div style={{ width: 46, height: 46, borderRadius: '10px', background: col.solid, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <span className="material-symbols-rounded" style={{ fontSize: '1.5rem', color: '#fff' }}>restaurant</span>
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 800, fontSize: '1.05rem', color: col.text }}>{sitting.name}</div>
                                                    <div style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', marginTop: '2px' }}>
                                                        <span className="material-symbols-rounded" style={{ fontSize: '0.85rem', verticalAlign: 'middle' }}>manage_accounts</span>
                                                        {' '}{sitting.section} · {sitting.staff}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Header actions */}
                                            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
                                                <span className={`disc-badge ${sitting.key}`}>{sitting.gender}</span>
                                                {mode === 'edit' && !isConfirmingDelete && (
                                                    <>
                                                        <button
                                                            className="btn btn-outline btn-sm"
                                                            onClick={() => setEditingKey(isEditingThis ? null : sitting.key)}>
                                                            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>settings</span>
                                                            {isEditingThis ? 'Cancel' : 'Configure'}
                                                        </button>
                                                        <button
                                                            className="btn btn-sm"
                                                            style={{ background: 'var(--destructive-light)', color: 'var(--destructive)', border: '1px solid var(--destructive)' }}
                                                            onClick={() => setConfirmDelete(sitting.key)}>
                                                            <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>delete</span>
                                                        </button>
                                                    </>
                                                )}
                                                {isConfirmingDelete && (
                                                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--destructive)', fontWeight: 600 }}>Delete section?</span>
                                                        <button
                                                            className="btn btn-sm"
                                                            style={{ background: 'var(--destructive)', color: '#fff', border: 'none' }}
                                                            onClick={() => deleteSitting(sitting.key)}>
                                                            Yes, Delete
                                                        </button>
                                                        <button className="btn btn-outline btn-sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Inline config editor */}
                                        {isEditingThis && (
                                            <SectionConfigEditor
                                                sitting={sitting}
                                                onSave={changes => saveSitting(sitting.key, changes)}
                                            />
                                        )}

                                        {/* Body */}
                                        <div style={{ padding: '1.25rem 1.5rem' }}>

                                            {/* Stat row */}
                                            <div style={{ display: 'flex', marginBottom: '1.1rem' }}>
                                                {[
                                                    { value: sitting.capacity,  label: 'Seats'     },
                                                    { value: tables.length,     label: 'Tables'    },
                                                    { value: chiefs,            label: 'Chiefs'    },
                                                    { value: sitting.incidents, label: 'Incidents' },
                                                ].map((stat, i, arr) => (
                                                    <div key={stat.label} style={{ flex: 1, textAlign: 'center', borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none', padding: '0 0.4rem' }}>
                                                        <div style={{
                                                            fontSize: '1.5rem', fontWeight: 800, lineHeight: 1,
                                                            color: stat.label === 'Incidents' && stat.value > 0 ? '#dc2626'
                                                                 : stat.label === 'Chiefs'   && stat.value > 0 ? '#f97316'
                                                                 : i === 0 ? col.text : 'inherit',
                                                        }}>
                                                            {stat.value}
                                                        </div>
                                                        <div style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                            {stat.label}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Schedule */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--muted-foreground)', padding: '0.6rem 0.75rem', background: 'var(--muted)', borderRadius: '8px', marginBottom: '0.9rem' }}>
                                                <span className="material-symbols-rounded" style={{ fontSize: '1rem', color: col.solid }}>schedule</span>
                                                {schedule}
                                            </div>

                                            {/* Table list (only if students assigned) */}
                                            {tables.length > 0 && (
                                                <div style={{ marginBottom: '0.9rem' }}>
                                                    {tables.map(table => (
                                                        <TableBlock
                                                            key={table.number}
                                                            tableNum={table.number}
                                                            students={table.students}
                                                            seatsPerTable={sitting.seatsPerTable}
                                                            mode={mode}
                                                            availableTables={tableNums}
                                                            onAppointChief={appointChief}
                                                            onMoveTable={moveTable}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                            {tables.length === 0 && (
                                                <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', fontStyle: 'italic', marginBottom: '0.9rem' }}>
                                                    No students assigned yet. Use Auto-Assign or switch to Edit mode.
                                                </p>
                                            )}

                                            {/* Actions */}
                                            <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                                                <button className="btn btn-outline btn-sm" style={{ flex: 1 }}>
                                                    <span className="material-symbols-rounded">chair</span> View Seating
                                                </button>
                                                <button className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                                                    <span className="material-symbols-rounded">report</span> Log Incident
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Recent reports */}
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title">
                                    <span className="material-symbols-rounded">history</span> Dining Conduct Reports
                                </h3>
                                <button className="btn btn-outline btn-sm">
                                    <span className="material-symbols-rounded">download</span> Export
                                </button>
                            </div>
                            <div className="card-content">
                                <FilterBar options={reportFilterOptions} active={reportFilter} onChange={setReportFilter} />
                                <div className="disc-activity-list">
                                    {visible.map((report, i) => (
                                        <div key={i} className="disc-activity-item">
                                            <div className={`disc-activity-icon ${iconClassMap[report.typeClass]}`}>
                                                <span className="material-symbols-rounded">{report.icon}</span>
                                            </div>
                                            <div className="disc-activity-details">
                                                <p className="disc-activity-title">{report.title}</p>
                                                <p className="disc-activity-time">
                                                    {report.time} &bull; <span className={`incident-type-tag ${report.typeClass}`}>{typeLabel[report.typeClass]}</span>
                                                </p>
                                            </div>
                                            <button className="btn btn-outline btn-sm">View</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                    </div>
    )
}

export function DisDining() {
    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Dining"
                        subtitle="Dining hall assignments, mealtime conduct and duty rosters — Term 2, 2026"
                    />
                    <DisDiningPanel />
                </main>
            </div>
        </>
    )
}
