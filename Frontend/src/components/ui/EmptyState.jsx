/*
  EmptyState — shared empty/no-results component used across all portals.

  Props:
    icon        — Material Symbol name (default: 'inbox')
    title       — bold heading text
    description — softer subtext below the title
    action      — { label, icon, onClick } for the primary button (optional)
    secondAction— { label, icon, onClick } for a secondary outline button (optional)
*/
export function EmptyState({ icon = 'inbox', title, description, action, secondAction }) {
    return (
        <div style={{
            borderRadius: 16,
            overflow: 'hidden',
            border: '1px solid var(--border)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}>
            {/* Coloured top strip */}
            <div style={{
                height: 6,
                background: 'linear-gradient(90deg, var(--primary) 0%, var(--portal-accent, var(--primary)) 100%)',
            }} />

            {/* Content area */}
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '3.5rem 1.5rem',
                background: 'var(--card)',
                textAlign: 'center',
            }}>
                {/* Icon circle */}
                <div style={{
                    width: 80, height: 80, borderRadius: '50%',
                    marginBottom: '1.25rem', flexShrink: 0,
                    background: 'var(--primary-light, #e8f2ff)',
                    border: '3px solid rgba(var(--primary-rgb, 0,61,122), 0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <span className="material-symbols-rounded" style={{ fontSize: '2.2rem', color: 'var(--primary)' }}>
                        {icon}
                    </span>
                </div>

                <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: 8 }}>
                    {title}
                </div>

                {description && (
                    <div style={{
                        fontSize: '0.84rem', color: 'var(--muted-foreground)',
                        marginBottom: '1.75rem', maxWidth: 340, lineHeight: 1.6,
                    }}>
                        {description}
                    </div>
                )}

                {(action || secondAction) && (
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {secondAction && (
                            <button className="btn btn-outline" onClick={secondAction.onClick}>
                                {secondAction.icon && <span className="material-symbols-rounded icon-sm">{secondAction.icon}</span>}
                                {secondAction.label}
                            </button>
                        )}
                        {action && (
                            <button className="btn btn-primary" onClick={action.onClick}>
                                {action.icon && <span className="material-symbols-rounded icon-sm">{action.icon}</span>}
                                {action.label}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
