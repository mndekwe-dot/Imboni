import '../../styles/components.css'

export function TabGroup({ tabs, value, onChange }) {
    return (
        <div className="tab-group">
            {tabs.map(tab => (
                <button
                    key={tab.key}
                    className={`tab-btn ${value === tab.key ? 'active' : ''}`}
                    onClick={() => onChange(tab.key)}>
                    <span className="material-symbols-rounded" style={{ fontSize: '1rem' }}>{tab.icon}</span>
                    {tab.label}
                </button>
            ))}
        </div>
    )
}
