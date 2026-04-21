export function FilterBar({options,active,onChange}) {
    return (
        <div className="filter-tabs-bar" style={{ marginBottom: '1.25rem' }}>
            {options.map(f => (
                <button
                    key={f.key}
                    className={`filter-tab ${active === f.key ? 'active' : ''}`}
                    onClick={() => onChange(f.key)}>
                    {f.label}
                    {f.count !== undefined && (
                        <span className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#b45309', fontSize: '0.7rem', padding: '1px 7px', marginLeft: '4px' }}>
                            {f.count}
                        </span>
                    )}
                </button>
            ))}
        </div>
    )
}
