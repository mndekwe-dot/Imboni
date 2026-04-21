import { Sidebar } from '../../components/layout/Sidebar'
import { FilterBar } from '../../components/ui/FilterBar'
import { DashboardHeader } from '../../components/layout/DashboardHeader'
import { TabGroup } from '../../components/ui/TabGroup'
import { DormitoryModal } from '../../components/modals/DormitoryModal'
import { DisDiningPanel } from './DisDining'
import { disNavItems, disSecondaryItems, disUser } from './disNav'
import { useState } from 'react'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/discipline.css'

// ── Initial dormitory configuration ──
const initialHouseConfig = [
    {
        key: 'karisimbi', name: 'Karisimbi House', gender: 'Boys', staff: 'Mr. Nsabimana Jean', totalRooms: 30, bedsPerRoom: 8,
        chambers: [
            { name: 'Chamber A', roomStart: 1,  roomEnd: 10 },
            { name: 'Chamber B', roomStart: 11, roomEnd: 20 },
            { name: 'Chamber C', roomStart: 21, roomEnd: 30 },
        ],
    },
    {
        key: 'muhabura', name: 'Muhabura House', gender: 'Boys', staff: 'Mr. Rugamba Patrick', totalRooms: 30, bedsPerRoom: 8,
        chambers: [
            { name: 'Chamber A', roomStart: 1,  roomEnd: 8  },
            { name: 'Chamber B', roomStart: 9,  roomEnd: 16 },
            { name: 'Chamber C', roomStart: 17, roomEnd: 24 },
            { name: 'Chamber D', roomStart: 25, roomEnd: 30 },
        ],
    },
    {
        key: 'bisoke', name: 'Bisoke House', gender: 'Girls', staff: 'Mrs. Mukamana Esperance', totalRooms: 30, bedsPerRoom: 8,
        chambers: [
            { name: 'Chamber A', roomStart: 1,  roomEnd: 8  },
            { name: 'Chamber B', roomStart: 9,  roomEnd: 16 },
            { name: 'Chamber C', roomStart: 17, roomEnd: 24 },
            { name: 'Chamber D', roomStart: 25, roomEnd: 30 },
        ],
    },
    {
        key: 'sabyinyo', name: 'Sabyinyo House', gender: 'Girls', staff: 'Ms. Ingabire Celestine', totalRooms: 30, bedsPerRoom: 8,
        chambers: [
            { name: 'Chamber A', roomStart: 1,  roomEnd: 10 },
            { name: 'Chamber B', roomStart: 11, roomEnd: 20 },
            { name: 'Chamber C', roomStart: 21, roomEnd: 30 },
        ],
    },
]


// ── Sample students — 2 rooms per house with full data ──
const initialStudents = [
    // Karisimbi House (Boys) Room 1
    { id: 1,  name: 'Bizimana James',     adm: '2021-S5-001', form: 'S5A', level: 'advanced', house: 'karisimbi', room: 1, bed: 1, isLeader: true  },
    { id: 2,  name: 'Mutabazi Kevin',     adm: '2023-S4-011', form: 'S4A', level: 'ordinary', house: 'karisimbi', room: 1, bed: 2, isLeader: false },
    { id: 3,  name: 'Nsabimana Patrick',  adm: '2024-S2-002', form: 'S2B', level: 'ordinary', house: 'karisimbi', room: 1, bed: 3, isLeader: false },
    { id: 4,  name: 'Ishimwe David',      adm: '2024-S1-003', form: 'S1B', level: 'ordinary', house: 'karisimbi', room: 1, bed: 4, isLeader: false },
    { id: 5,  name: 'Gasana Innocent',    adm: '2023-S3-009', form: 'S3B', level: 'ordinary', house: 'karisimbi', room: 1, bed: 5, isLeader: false },
    { id: 6,  name: 'Nzabonimana Claude', adm: '2024-S1-001', form: 'S1A', level: 'ordinary', house: 'karisimbi', room: 1, bed: 6, isLeader: false },
    { id: 7,  name: 'Muhire Providence',  adm: '2022-S3-005', form: 'S3A', level: 'advanced', house: 'karisimbi', room: 1, bed: 7, isLeader: false },
    { id: 8,  name: 'Dusabimana JP',      adm: '2022-S3-012', form: 'S3B', level: 'advanced', house: 'karisimbi', room: 1, bed: 8, isLeader: false },
    // Karisimbi House Room 2
    { id: 9,  name: 'Habimana Samuel',    adm: '2021-S6-015', form: 'S6B', level: 'advanced', house: 'karisimbi', room: 2, bed: 1, isLeader: true  },
    { id: 10, name: 'Nkurunziza Peter',   adm: '2023-S4-020', form: 'S4B', level: 'ordinary', house: 'karisimbi', room: 2, bed: 2, isLeader: false },
    { id: 11, name: 'Tuyishime Angel',    adm: '2024-S1-010', form: 'S1A', level: 'ordinary', house: 'karisimbi', room: 2, bed: 3, isLeader: false },
    { id: 12, name: 'Uwineza Charles',    adm: '2024-S1-011', form: 'S1B', level: 'ordinary', house: 'karisimbi', room: 2, bed: 4, isLeader: false },
    { id: 13, name: 'Ndayishimiye Paul',  adm: '2023-S2-022', form: 'S2B', level: 'ordinary', house: 'karisimbi', room: 2, bed: 5, isLeader: false },
    { id: 14, name: 'Kagame Joseph',      adm: '2024-S1-015', form: 'S1A', level: 'ordinary', house: 'karisimbi', room: 2, bed: 6, isLeader: false },
    { id: 15, name: 'Niyonzima Moses',    adm: '2022-S3-018', form: 'S3A', level: 'advanced', house: 'karisimbi', room: 2, bed: 7, isLeader: false },
    { id: 16, name: 'Rugamba David',      adm: '2022-S3-025', form: 'S3B', level: 'advanced', house: 'karisimbi', room: 2, bed: 8, isLeader: false },
    // Muhabura House (Boys) Room 1
    { id: 17, name: 'Ndagijimana Eric',   adm: '2021-S6-041', form: 'S6A', level: 'advanced', house: 'muhabura',   room: 1, bed: 1, isLeader: true  },
    { id: 18, name: 'Gashumba Eric',      adm: '2024-S1-101', form: 'S1B', level: 'ordinary', house: 'muhabura',   room: 1, bed: 2, isLeader: false },
    { id: 19, name: 'Mugenzi George',     adm: '2023-S2-055', form: 'S2B', level: 'ordinary', house: 'muhabura',   room: 1, bed: 3, isLeader: false },
    { id: 20, name: 'Nsabimana John',     adm: '2022-S3-028', form: 'S3A', level: 'advanced', house: 'muhabura',   room: 1, bed: 4, isLeader: false },
    { id: 21, name: 'Habiyaremye Henry',  adm: '2023-S2-060', form: 'S2B', level: 'ordinary', house: 'muhabura',   room: 1, bed: 5, isLeader: false },
    { id: 22, name: 'Uwimana Isaac',      adm: '2024-S1-105', form: 'S1A', level: 'ordinary', house: 'muhabura',   room: 1, bed: 6, isLeader: false },
    { id: 23, name: 'Nkurunziza Kenneth', adm: '2022-S3-033', form: 'S3B', level: 'advanced', house: 'muhabura',   room: 1, bed: 7, isLeader: false },
    { id: 24, name: 'Ntwari Felix',       adm: '2024-S1-110', form: 'S1A', level: 'ordinary', house: 'muhabura',   room: 1, bed: 8, isLeader: false },
    // Muhabura House Room 2
    { id: 25, name: 'Tuyishime Brian',    adm: '2023-S2-062', form: 'S2A', level: 'ordinary', house: 'muhabura',   room: 2, bed: 1, isLeader: true  },
    { id: 26, name: 'Kagame Ivan',        adm: '2024-S1-115', form: 'S1A', level: 'ordinary', house: 'muhabura',   room: 2, bed: 2, isLeader: false },
    { id: 27, name: 'Habimana Kevin',     adm: '2021-S4-055', form: 'S4B', level: 'advanced', house: 'muhabura',   room: 2, bed: 3, isLeader: false },
    { id: 28, name: 'Munyaneza George',   adm: '2024-S1-120', form: 'S1B', level: 'ordinary', house: 'muhabura',   room: 2, bed: 4, isLeader: false },
    { id: 29, name: 'Hakizimana Brian',   adm: '2022-S3-040', form: 'S3A', level: 'advanced', house: 'muhabura',   room: 2, bed: 5, isLeader: false },
    { id: 30, name: 'Nzeyimana Patrick',  adm: '2023-S2-070', form: 'S2A', level: 'ordinary', house: 'muhabura',   room: 2, bed: 6, isLeader: false },
    { id: 31, name: 'Rurangwa Jean',      adm: '2024-S1-125', form: 'S1B', level: 'ordinary', house: 'muhabura',   room: 2, bed: 7, isLeader: false },
    { id: 32, name: 'Nkurunziza Peter',   adm: '2022-S3-045', form: 'S3B', level: 'advanced', house: 'muhabura',   room: 2, bed: 8, isLeader: false },
]

// ── Unassigned students pool ──
const initialUnassigned = [
    { id: 101, name: 'Uwamahoro Christine', adm: '2024-S1-200', form: 'S1A', level: 'ordinary' },
    { id: 102, name: 'Mukamazimpaka Sandra', adm: '2024-S1-201', form: 'S1B', level: 'ordinary' },
    { id: 103, name: 'Umutoni Diane',       adm: '2024-S2-202', form: 'S2A', level: 'ordinary' },
    { id: 104, name: 'Uwase Valerie',       adm: '2021-S4-203', form: 'S4A', level: 'advanced' },
]

const houseFilterOptions = [
    { key: 'all',       label: 'All Houses'  },
    { key: 'karisimbi',    label: 'Karisimbi'   },
    { key: 'muhabura',     label: 'Muhabura'    },
    { key: 'bisoke',    label: 'Bisoke'      },
    { key: 'sabyinyo', label: 'Sabyinyo'    },
]

// Form seniority order for auto leader appointment
const formOrder = ['S1A','S1B','S1C','S2A','S2B','S2C','S3A','S3B','S3C','S4A','S4B','S4C','S5A','S5B','S5C','S6A','S6B','S6C']

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

// ── Auto-assign logic ──
function generateRoomAssignments(students, rules) {
    const ordinary = [...students.filter(s => s.level === 'ordinary')].sort(() => Math.random() - 0.5)
    const advanced = [...students.filter(s => s.level === 'advanced')].sort(() => Math.random() - 0.5)
    const rooms = []
    let roomNum = 1
    let ordIdx = 0
    let advIdx = 0

    while (ordIdx < ordinary.length || advIdx < advanced.length) {
        const roomStudents = []
        let ordCount = 0
        let advCount = 0

        while (roomStudents.length < rules.bedsPerRoom) {
            if (ordCount < rules.ordinaryPerRoom && ordIdx < ordinary.length) {
                roomStudents.push({ ...ordinary[ordIdx++], bed: roomStudents.length + 1, isLeader: false, room: roomNum })
                ordCount++
            } else if (advCount < rules.advancedPerRoom && advIdx < advanced.length) {
                roomStudents.push({ ...advanced[advIdx++], bed: roomStudents.length + 1, isLeader: false, room: roomNum })
                advCount++
            } else if (ordIdx < ordinary.length) {
                roomStudents.push({ ...ordinary[ordIdx++], bed: roomStudents.length + 1, isLeader: false, room: roomNum })
            } else if (advIdx < advanced.length) {
                roomStudents.push({ ...advanced[advIdx++], bed: roomStudents.length + 1, isLeader: false, room: roomNum })
            } else {
                break
            }
        }

        if (rules.autoLeader && roomStudents.length > 0) {
            const sorted = [...roomStudents].sort((a, b) => formOrder.indexOf(b.form) - formOrder.indexOf(a.form))
            const leaderId = sorted[0].id
            roomStudents.forEach(s => { if (s.id === leaderId) s.isLeader = true })
        }

        rooms.push({ number: roomNum, students: roomStudents })
        roomNum++
    }

    return rooms
}

// ── House config editor (sub-component) ──
function HouseConfigEditor({ config, onSave }) {
    const [local, setLocal] = useState({ ...config })
    return (
        <div style={{ background: 'var(--muted)', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Configure Dormitory
            </div>
            <div className="form-row-2" style={{ marginBottom: '0.75rem' }}>
                <div className="form-group">
                    <label className="form-label">Dormitory Name</label>
                    <input type="text" className="form-input" value={local.name}
                        onChange={e => setLocal(l => ({ ...l, name: e.target.value }))} />
                </div>
                <div className="form-group">
                    <label className="form-label">Matron / Patron</label>
                    <input type="text" className="form-input" value={local.staff}
                        onChange={e => setLocal(l => ({ ...l, staff: e.target.value }))} />
                </div>
                <div className="form-group">
                    <label className="form-label">Total Rooms</label>
                    <input type="number" className="form-input" min={1} value={local.totalRooms}
                        onChange={e => setLocal(l => ({ ...l, totalRooms: Number(e.target.value) }))} />
                </div>
                <div className="form-group">
                    <label className="form-label">Beds Per Room</label>
                    <input type="number" className="form-input" min={1} max={20} value={local.bedsPerRoom}
                        onChange={e => setLocal(l => ({ ...l, bedsPerRoom: Number(e.target.value) }))} />
                </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary btn-sm" onClick={() => onSave(local)}>
                    <span className="material-symbols-rounded">save</span> Save
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => onSave(config)}>Cancel</button>
            </div>
        </div>
    )
}

// ── Student row (used in room blocks) ──
function StudentRow({ student, mode, availableRooms, onAppointLeader, onMoveStudent }) {
    return (
        <div className="student-row">
            <div className={`student-av-sm ${student.level === 'advanced' ? 'patron' : 'matron'}`}>
                {getInitials(student.name)}
            </div>
            <div className="student-row-info">
                <span className="student-row-name">
                    {student.name}
                    {student.isLeader && (
                        <span className="badge" style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', fontSize: '0.65rem', marginLeft: '0.4rem', padding: '1px 6px' }}>
                            Room Leader
                        </span>
                    )}
                </span>
                <span className="student-row-meta">
                    Bed {student.bed} &bull; {student.adm} &bull; {student.form} &bull;&nbsp;
                    <span style={{ color: student.level === 'advanced' ? '#0891b2' : '#0d9488', fontWeight: 600 }}>
                        {student.level.charAt(0).toUpperCase() + student.level.slice(1)}
                    </span>
                </span>
            </div>
            {mode === 'edit' && (
                <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0, flexWrap: 'wrap' }}>
                    {!student.isLeader && (
                        <button className="btn btn-outline btn-sm" onClick={() => onAppointLeader(student.id)}>
                            <span className="material-symbols-rounded" style={{ fontSize: '0.875rem' }}>star</span> Leader
                        </button>
                    )}
                    <select
                        className="form-input"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', height: 'auto', width: 'auto' }}
                        value={student.room}
                        onChange={e => onMoveStudent(student.id, Number(e.target.value))}>
                        {availableRooms.map(r => (
                            <option key={r} value={r}>Room {r}</option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    )
}

// ── Room block (collapsible) ──
function RoomBlock({ roomNum, students, bedsPerRoom, mode, availableRooms, onAppointLeader, onMoveStudent }) {
    const leader = students.find(s => s.isLeader)
    const ordinary = students.filter(s => s.level === 'ordinary').length
    const advanced = students.filter(s => s.level === 'advanced').length
    return (
        <details className="class-accordion">
            <summary className="class-summary">
                <div className="class-summary-left">
                    <span className="material-symbols-rounded expand-icon">chevron_right</span>
                    <span className="class-label">Room {roomNum}</span>
                    {leader && (
                        <span style={{ fontSize: '0.7rem', color: '#f97316', marginLeft: '0.5rem' }}>
                            Leader: {leader.name}
                        </span>
                    )}
                </div>
                <div className="class-summary-right">
                    <span className="class-count">{students.length}/{bedsPerRoom} beds</span>
                    <span className="class-room-range">{ordinary} Ord &bull; {advanced} Adv</span>
                </div>
            </summary>
            <div className="student-roster">
                {students.map(s => (
                    <StudentRow
                        key={s.id}
                        student={s}
                        mode={mode}
                        availableRooms={availableRooms}
                        onAppointLeader={onAppointLeader}
                        onMoveStudent={onMoveStudent}
                    />
                ))}
                {students.length < bedsPerRoom && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', padding: '0.4rem 0', fontStyle: 'italic' }}>
                        {bedsPerRoom - students.length} bed{bedsPerRoom - students.length > 1 ? 's' : ''} available
                    </div>
                )}
            </div>
        </details>
    )
}

// ── Main component ──
export function DisBoarding() {
    const [boardingTab, setBoardingTab]   = useState('dormitories') // 'dormitories' | 'dining'
    const [mode, setMode]               = useState('view')  // 'view' | 'edit' | 'assign'
    const [houseFilter, setHouseFilter] = useState('all')
    const [students, setStudents]       = useState(initialStudents)
    const [unassigned, setUnassigned]   = useState(initialUnassigned)
    const [houseConfig, setHouseConfig] = useState(initialHouseConfig)
    const [dormModal, setDormModal]     = useState(null)    // null | 'add' | dormitory-object
    const [preview, setPreview]         = useState(null)     // auto-assign preview result
    const [pendingAssign, setPendingAssign] = useState({})  // { [studentId]: "houseKey:roomNum" }
    const [confirmDelete, setConfirmDelete] = useState(null) // house key pending delete
    const [rules, setRules]             = useState({
        bedsPerRoom:      8,
        ordinaryPerRoom:  4,
        advancedPerRoom:  4,
        mixForms:         true,
        autoLeader:       true,
    })

    // Get sorted rooms for a house from students array
    function getRoomsForHouse(houseKey) {
        const houseStudents = students.filter(s => s.house === houseKey)
        const roomNums = [...new Set(houseStudents.map(s => s.room))].sort((a, b) => a - b)
        return roomNums.map(r => ({
            number: r,
            students: houseStudents.filter(s => s.room === r).sort((a, b) => a.bed - b.bed),
        }))
    }

    function deleteHouse(houseKey) {
        setHouseConfig(prev => prev.filter(h => h.key !== houseKey))
        setStudents(prev => prev.filter(s => s.house !== houseKey))
        setConfirmDelete(null)
    }

    function handleDormSave(data) {
        if (dormModal === 'add') {
            setHouseConfig(prev => [...prev, data])
        } else {
            setHouseConfig(prev => prev.map(h => h.key === data.key ? data : h))
        }
        setDormModal(null)
    }

    // Appoint leader — removes existing leader in same room first
    function appointLeader(studentId) {
        setStudents(prev => {
            const target = prev.find(s => s.id === studentId)
            return prev.map(s => {
                if (s.house === target.house && s.room === target.room) {
                    return { ...s, isLeader: s.id === studentId }
                }
                return s
            })
        })
    }

    // Move student to a different room in the same house
    function moveStudent(studentId, newRoom) {
        setStudents(prev => {
            const target = prev.find(s => s.id === studentId)
            if (target.room === newRoom) return prev
            const config = houseConfig.find(h => h.key === target.house)
            const roomStudents = prev.filter(s => s.house === target.house && s.room === newRoom)
            if (roomStudents.length >= config.bedsPerRoom) return prev // room full
            return prev.map(s =>
                s.id === studentId
                    ? { ...s, room: newRoom, bed: roomStudents.length + 1, isLeader: false }
                    : s
            )
        })
    }

    // Assign an unassigned student to a specific house/room
    function assignStudent(studentId, houseKey, roomNum) {
        const student = unassigned.find(s => s.id === studentId)
        const config = houseConfig.find(h => h.key === houseKey)
        const roomStudents = students.filter(s => s.house === houseKey && s.room === roomNum)
        if (roomStudents.length >= config.bedsPerRoom) return
        setStudents(prev => [...prev, { ...student, house: houseKey, room: roomNum, bed: roomStudents.length + 1, isLeader: false }])
        setUnassigned(prev => prev.filter(s => s.id !== studentId))
    }

    // Generate auto-assign preview for a specific house
    function handleGenerate(houseKey) {
        const houseStudents = students.filter(s => s.house === houseKey)
        const generated = generateRoomAssignments(houseStudents, rules)
        setPreview({ house: houseKey, rooms: generated })
    }

    // Apply previewed assignments to state
    function applyPreview() {
        if (!preview) return
        setStudents(prev =>
            prev.map(s => {
                if (s.house !== preview.house) return s
                for (const room of preview.rooms) {
                    const found = room.students.find(ps => ps.id === s.id)
                    if (found) return { ...s, room: found.room, bed: found.bed, isLeader: found.isLeader }
                }
                return s
            })
        )
        setPreview(null)
    }

    const visibleHouses = houseFilter === 'all'
        ? houseConfig
        : houseConfig.filter(h => h.key === houseFilter)

    const totalAssigned = students.length
    const totalCapacity = houseConfig.reduce((sum, h) => sum + h.totalRooms * h.bedsPerRoom, 0)

    return (
        <>
            {dormModal === 'add' && (
                <DormitoryModal onSave={handleDormSave} onClose={() => setDormModal(null)} />
            )}
            {dormModal && dormModal !== 'add' && (
                <DormitoryModal dormitory={dormModal} onSave={handleDormSave} onClose={() => setDormModal(null)} />
            )}
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={disNavItems} secondaryItems={disSecondaryItems} />

                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title="Boarding"
                        subtitle="Dormitory rooms, student assignments and room leadership — Term 2, 2026"
                    />

                    <div className="dashboard-content">

                        {/* Section tab — Dormitories / Dining */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <TabGroup
                                tabs={[
                                    { key: 'dormitories', label: 'Dormitories', icon: 'hotel'      },
                                    { key: 'dining',      label: 'Dining',      icon: 'restaurant' },
                                ]}
                                value={boardingTab}
                                onChange={setBoardingTab}
                            />
                        </div>

                        {boardingTab === 'dining' && <DisDiningPanel />}

                        {boardingTab === 'dormitories' && <>

                        {/* Stats */}
                        <div className="disc-stat-grid">
                            <div className="disc-stat-card">
                                <div className="disc-stat-icon info"><span className="material-symbols-rounded">hotel</span></div>
                                <div>
                                    <div className="disc-stat-value">{totalAssigned}</div>
                                    <div className="disc-stat-label">Assigned Boarders</div>
                                    <div className="disc-stat-trend positive">of {totalCapacity} capacity</div>
                                </div>
                            </div>
                            <div className="disc-stat-card">
                                <div className="disc-stat-icon warning"><span className="material-symbols-rounded">person_off</span></div>
                                <div>
                                    <div className="disc-stat-value">{unassigned.length}</div>
                                    <div className="disc-stat-label">Unassigned</div>
                                    <div className="disc-stat-trend negative">Need room assignment</div>
                                </div>
                            </div>
                            <div className="disc-stat-card">
                                <div className="disc-stat-icon success"><span className="material-symbols-rounded">meeting_room</span></div>
                                <div>
                                    <div className="disc-stat-value">{houseConfig.reduce((s, h) => s + h.totalRooms, 0)}</div>
                                    <div className="disc-stat-label">Total Rooms</div>
                                    <div className="disc-stat-trend positive">30 per house</div>
                                </div>
                            </div>
                            <div className="disc-stat-card">
                                <div className="disc-stat-icon positive"><span className="material-symbols-rounded">supervisor_account</span></div>
                                <div>
                                    <div className="disc-stat-value">8</div>
                                    <div className="disc-stat-label">Matrons & Patrons</div>
                                    <div className="disc-stat-trend positive">2 per dormitory</div>
                                </div>
                            </div>
                        </div>

                        {/* Mode toggle + Add Dormitory */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1 }}>
                                <TabGroup
                                    tabs={[
                                        { key: 'view',   label: 'View',             icon: 'visibility' },
                                        { key: 'edit',   label: 'Edit Assignments', icon: 'edit'       },
                                        { key: 'assign', label: 'Auto-Assign',      icon: 'shuffle'    },
                                    ]}
                                    value={mode}
                                    onChange={key => { setMode(key); setPreview(null); setConfirmDelete(null) }}
                                />
                            </div>
                            <button className="btn btn-primary btn-sm" onClick={() => setDormModal('add')}>
                                <span className="material-symbols-rounded">add_home</span> Add Dormitory
                            </button>
                        </div>

                        {/* House filter */}
                        <FilterBar options={houseFilterOptions} active={houseFilter} onChange={setHouseFilter} />

                        {/* ── AUTO-ASSIGN PANEL ── */}
                        {mode === 'assign' && (
                            <div className="card mb-1-5">
                                <div className="card-header">
                                    <h3 className="card-title">
                                        <span className="material-symbols-rounded">shuffle</span> Auto-Assign Rules
                                    </h3>
                                </div>
                                <div className="card-content">
                                    <div className="form-row-2" style={{ marginBottom: '1rem' }}>
                                        <div className="form-group">
                                            <label className="form-label">Beds Per Room</label>
                                            <input type="number" className="form-input" min={1} max={20}
                                                value={rules.bedsPerRoom}
                                                onChange={e => setRules(r => ({ ...r, bedsPerRoom: Number(e.target.value) }))} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Ordinary Students Per Room</label>
                                            <input type="number" className="form-input" min={0} max={rules.bedsPerRoom}
                                                value={rules.ordinaryPerRoom}
                                                onChange={e => setRules(r => ({
                                                    ...r,
                                                    ordinaryPerRoom: Number(e.target.value),
                                                    advancedPerRoom: r.bedsPerRoom - Number(e.target.value),
                                                }))} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Advanced Students Per Room</label>
                                            <input type="number" className="form-input" min={0} max={rules.bedsPerRoom}
                                                value={rules.advancedPerRoom}
                                                onChange={e => setRules(r => ({
                                                    ...r,
                                                    advancedPerRoom: Number(e.target.value),
                                                    ordinaryPerRoom: r.bedsPerRoom - Number(e.target.value),
                                                }))} />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Options</label>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                                                    <input type="checkbox" checked={rules.mixForms}
                                                        onChange={e => setRules(r => ({ ...r, mixForms: e.target.checked }))} />
                                                    Mix different forms per room
                                                </label>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                                                    <input type="checkbox" checked={rules.autoLeader}
                                                        onChange={e => setRules(r => ({ ...r, autoLeader: e.target.checked }))} />
                                                    Auto-appoint most senior student as room leader
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Generate buttons per visible house */}
                                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                        {visibleHouses.map(h => (
                                            <button key={h.key} className="btn btn-primary btn-sm" onClick={() => handleGenerate(h.key)}>
                                                <span className="material-symbols-rounded">shuffle</span> Generate for {h.name}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Preview */}
                                    {preview && (
                                        <div style={{ marginTop: '1.5rem' }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                                                Preview — {houseConfig.find(h => h.key === preview.house)?.name} &nbsp;
                                                <span style={{ fontWeight: 400, color: '#64748b' }}>({preview.rooms.length} rooms)</span>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem', maxHeight: '380px', overflowY: 'auto' }}>
                                                {preview.rooms.map(room => (
                                                    <div key={room.number} style={{ background: 'var(--muted)', borderRadius: '8px', padding: '0.75rem' }}>
                                                        <div style={{ fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                                                            Room {room.number}
                                                            {room.students.find(s => s.isLeader) && (
                                                                <span style={{ color: '#f97316', fontSize: '0.68rem', marginLeft: '0.4rem' }}>
                                                                    ★ {room.students.find(s => s.isLeader)?.name}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {room.students.map(s => (
                                                            <div key={s.id} style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', padding: '2px 0' }}>
                                                                Bed {s.bed} — {s.name} ({s.form}, {s.level}){s.isLeader ? ' ★' : ''}
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

                        {/* ── UNASSIGNED POOL ── */}
                        {unassigned.length > 0 && (
                            <div className="card mb-1-5">
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
                                                        <option value="">Select room...</option>
                                                        {houseConfig.map(h => (
                                                            <optgroup key={h.key} label={h.name}>
                                                                {getRoomsForHouse(h.key).map(r => (
                                                                    <option key={r.number} value={`${h.key}:${r.number}`}>
                                                                        Room {r.number} ({r.students.length}/{h.bedsPerRoom})
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
                                                            const [houseKey, roomNum] = val.split(':')
                                                            assignStudent(s.id, houseKey, Number(roomNum))
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

                        {/* ── HOUSE SUMMARY CARDS ── */}
                        {(() => {
                            const houseColors = {
                                karisimbi: { solid: '#ca8a04', light: 'rgba(234,179,8,0.10)',  text: '#854d0e' },
                                muhabura:  { solid: '#16a34a', light: 'rgba(34,197,94,0.10)',  text: '#166534' },
                                bisoke:    { solid: '#7c3aed', light: 'rgba(139,92,246,0.10)', text: '#5b21b6' },
                                sabyinyo:  { solid: '#ea580c', light: 'rgba(249,115,22,0.10)', text: '#9a3412' },
                            }
                            return (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem', marginBottom: '1.75rem' }}>
                                    {houseConfig.map(house => {
                                        const col = houseColors[house.key]
                                        const assigned = students.filter(s => s.house === house.key).length
                                        const capacity = house.totalRooms * house.bedsPerRoom
                                        const pct = Math.round((assigned / capacity) * 100)
                                        const roomsFilled = getRoomsForHouse(house.key).length
                                        const leaders = students.filter(s => s.house === house.key && s.isLeader).length
                                        const isActive = houseFilter === house.key
                                        return (
                                            <div
                                                key={house.key}
                                                onClick={() => setHouseFilter(isActive ? 'all' : house.key)}
                                                style={{
                                                    background: 'var(--card)',
                                                    border: `2px solid ${isActive ? col.solid : 'var(--border)'}`,
                                                    borderRadius: '12px',
                                                    overflow: 'hidden',
                                                    cursor: 'pointer',
                                                    boxShadow: isActive ? `0 4px 18px ${col.solid}33` : '0 1px 4px rgba(0,0,0,0.05)',
                                                    transition: 'box-shadow 0.18s, border-color 0.18s',
                                                }}>

                                                {/* Top accent bar */}
                                                <div style={{ background: col.solid, height: '5px' }} />

                                                {/* Header */}
                                                <div style={{ background: col.light, padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                                                        <div style={{ width: 46, height: 46, borderRadius: '10px', background: col.solid, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                            <span className="material-symbols-rounded" style={{ fontSize: '1.5rem', color: '#fff' }}>hotel</span>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: col.text }}>{house.name}</div>
                                                            <div style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', marginTop: '2px' }}>
                                                                <span className="material-symbols-rounded" style={{ fontSize: '0.85rem', verticalAlign: 'middle' }}>manage_accounts</span>
                                                                {' '}{house.staff}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span className={`disc-badge ${house.key}`} style={{ flexShrink: 0 }}>{house.gender}</span>
                                                </div>

                                                {/* Body */}
                                                <div style={{ padding: '1.25rem 1.5rem' }}>

                                                    {/* Stat row */}
                                                    <div style={{ display: 'flex', gap: '0', marginBottom: '1.1rem' }}>
                                                        {[
                                                            { value: assigned,             label: 'Assigned' },
                                                            { value: capacity - assigned,  label: 'Available' },
                                                            { value: roomsFilled,          label: 'Rooms used' },
                                                            { value: leaders,              label: 'Leaders' },
                                                        ].map((stat, i, arr) => (
                                                            <div key={stat.label} style={{ flex: 1, textAlign: 'center', borderRight: i < arr.length - 1 ? '1px solid var(--border)' : 'none', padding: '0 0.5rem' }}>
                                                                <div style={{ fontSize: '1.75rem', fontWeight: 800, lineHeight: 1, color: i === 0 ? col.text : 'inherit' }}>{stat.value}</div>
                                                                <div style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', marginTop: '3px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{stat.label}</div>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Progress bar */}
                                                    <div style={{ background: 'var(--muted)', borderRadius: '99px', height: '8px', overflow: 'hidden', marginBottom: '0.3rem' }}>
                                                        <div style={{ width: `${pct}%`, height: '100%', background: col.solid, borderRadius: '99px', transition: 'width 0.4s' }} />
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>
                                                        <span>{pct}% occupied</span>
                                                        <span>{house.totalRooms} rooms &times; {house.bedsPerRoom} beds</span>
                                                    </div>

                                                    {/* Footer */}
                                                    <div style={{ marginTop: '0.9rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: isActive ? col.solid : 'var(--muted-foreground)' }}>
                                                        {isActive ? '▼ Viewing rooms below' : 'Click to view rooms'}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )
                        })()}

                        {/* ── HOUSE BLOCKS ── */}
                        {visibleHouses.map(house => {
                            const rooms = getRoomsForHouse(house.key)
                            const allRoomNums = rooms.map(r => r.number)
                            const config = houseConfig.find(h => h.key === house.key)
                            const assigned = students.filter(s => s.house === house.key).length

                            return (
                                <div key={house.key} className="house-block" style={{ marginBottom: '1.5rem' }}>
                                    <div className={`house-block-header ${house.key}`}>
                                        <div className="house-block-info">
                                            <span className="material-symbols-rounded">hotel</span>
                                            <div>
                                                <h2>{house.name}</h2>
                                                <p>
                                                    {house.gender} &bull; {house.staff} &bull;&nbsp;
                                                    {assigned} / {house.totalRooms * house.bedsPerRoom} boarders &bull;&nbsp;
                                                    {house.chambers?.length ?? 0} chambers &bull;&nbsp;
                                                    {house.totalRooms} rooms &times; {house.bedsPerRoom} beds
                                                </p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <span className={`disc-badge ${house.key}`}>{house.gender}</span>
                                            <button
                                                className="btn btn-outline btn-sm"
                                                onClick={() => setDormModal(config)}>
                                                <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>settings</span>
                                                Configure
                                            </button>
                                            {mode === 'edit' && confirmDelete !== house.key && (
                                                <button
                                                    className="btn btn-outline btn-sm"
                                                    onClick={() => setConfirmDelete(house.key)}>
                                                    <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>delete</span>
                                                    Delete
                                                </button>
                                            )}
                                            {confirmDelete === house.key && (
                                                <>
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>Delete dormitory?</span>
                                                    <button className="btn btn-primary btn-sm" onClick={() => deleteHouse(house.key)}>Yes, Delete</button>
                                                    <button className="btn btn-outline btn-sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="house-block-body">
                                        {rooms.length === 0 ? (
                                            <p style={{ color: 'var(--muted-foreground)', fontSize: '0.875rem', padding: '1rem' }}>
                                                No students assigned yet. Use Auto-Assign or switch to Edit mode to assign students.
                                            </p>
                                        ) : config.chambers ? (
                                            config.chambers.map(ch => {
                                                const chamberRooms = rooms.filter(r => r.number >= ch.roomStart && r.number <= ch.roomEnd)
                                                if (chamberRooms.length === 0) return null
                                                return (
                                                    <div key={ch.name} style={{ marginBottom: '1rem' }}>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0.4rem 0.5rem', marginBottom: '0.25rem', borderBottom: '1px solid var(--border)' }}>
                                                            <span className="material-symbols-rounded" style={{ fontSize: '0.9rem', verticalAlign: 'middle', marginRight: '0.3rem' }}>meeting_room</span>
                                                            {ch.name} &bull; {chamberRooms.length} room{chamberRooms.length !== 1 ? 's' : ''} &bull; {chamberRooms.reduce((n, r) => n + r.students.length, 0)} boarders
                                                        </div>
                                                        {chamberRooms.map(room => (
                                                            <RoomBlock
                                                                key={room.number}
                                                                roomNum={room.number}
                                                                students={room.students}
                                                                bedsPerRoom={config.bedsPerRoom}
                                                                mode={mode}
                                                                availableRooms={allRoomNums}
                                                                onAppointLeader={appointLeader}
                                                                onMoveStudent={moveStudent}
                                                            />
                                                        ))}
                                                    </div>
                                                )
                                            })
                                        ) : (
                                            rooms.map(room => (
                                                <RoomBlock
                                                    key={room.number}
                                                    roomNum={room.number}
                                                    students={room.students}
                                                    bedsPerRoom={config.bedsPerRoom}
                                                    mode={mode}
                                                    availableRooms={allRoomNums}
                                                    onAppointLeader={appointLeader}
                                                    onMoveStudent={moveStudent}
                                                />
                                            ))
                                        )}
                                    </div>
                                </div>
                            )
                        })}

                        </>}

                    </div>
                </main>
            </div>
        </>
    )
}
