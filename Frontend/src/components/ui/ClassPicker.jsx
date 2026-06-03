import '../../styles/discipline.css'

export function ClassPicker({
    sections = [],
    // dropdown mode props
    section, onSectionChange, year, onYearChange, classVal, onClassChange,
    // chip mode props — pass either `classes` (flat string[]) or let it derive from `sections`
    variant, classes, value, onChange,
}) {
    // ── Chip variant ──────────────────────────────────────────────────────────
    if (variant === 'chips') {
        // sections[].years = [{name:"S1", streams:["A","B"]}, ...]
        const allClasses = classes ?? sections.flatMap(sec =>
            (sec.years || []).flatMap(y =>
                (y.streams || []).map(stream => `${y.name}${stream}`)
            )
        )

        return (
            <div className="disc-chip-picker">
                <span className="disc-chip-picker-label">Class</span>
                <div className="disc-chip-list">
                    <button
                        className={`disc-class-chip${!value ? ' active' : ''}`}
                        onClick={() => onChange('')}
                    >All</button>
                    {allClasses.map(key => (
                        <button
                            key={key}
                            className={`disc-class-chip${value === key ? ' active' : ''}`}
                            onClick={() => onChange(value === key ? '' : key)}
                        >{key}</button>
                    ))}
                </div>
            </div>
        )
    }

    // ── Dropdown variant (default — used by Teacher, Matron, DOS pages) ───────
    // sections[].years = [{name:"S1", streams:["A","B"]}, ...]
    const activeSection = sections.find(s => s.name === section)

    const yearOptions = activeSection
        ? activeSection.years.map(y => y.name)
        : [...new Set(sections.flatMap(s => s.years.map(y => y.name)))]

    const activeYear = activeSection?.years.find(y => y.name === year)
    const classOptions = activeYear
        ? activeYear.streams
        : year
            ? [...new Set(sections.flatMap(s => s.years.filter(y => y.name === year).flatMap(y => y.streams)))]
            : [...new Set(sections.flatMap(s => s.years.flatMap(y => y.streams)))]

    const current = [section, year, classVal].filter(Boolean).join(' · ') || 'All Classes'

    function handleSectionChange(val) {
        onSectionChange(val)
        onYearChange('')
        onClassChange('')
    }

    function handleYearChange(val) {
        onYearChange(val)
        onClassChange('')
    }

    return (
        <div className="disc-picker">
            <div className="disc-picker-group">
                <label className="disc-picker-label">Section</label>
                <select className="disc-picker-select" value={section} onChange={e => handleSectionChange(e.target.value)}>
                    <option value="">All Sections</option>
                    {sections.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
            </div>
            <div className="disc-picker-group">
                <label className="disc-picker-label">Year</label>
                <select className="disc-picker-select" value={year} onChange={e => handleYearChange(e.target.value)}>
                    <option value="">All Years</option>
                    {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>
            <div className="disc-picker-group">
                <label className="disc-picker-label">Class</label>
                <select className="disc-picker-select" value={classVal} onChange={e => onClassChange(e.target.value)}>
                    <option value="">All Classes</option>
                    {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>
            <span className="disc-picker-current">{current}</span>
        </div>
    )
}
