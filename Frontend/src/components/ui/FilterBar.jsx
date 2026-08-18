export function FilterBar({options,active,onChange}) {
    return (
        <div className="filter-tabs-bar filter-tabs-bar--spaced">
            {options.map(f => (
                <button
                    key={f.key}
                    className={`filter-tab ${active === f.key ? 'active' : ''}`}
                    onClick={() => onChange(f.key)}>
                    {f.label}
                    {f.count !== undefined && (
                        <span className="badge badge-amber">
                            {f.count}
                        </span>
                    )}
                </button>
            ))}
        </div>
    )
}
