/*
  EmptyState — shared empty/no-results component used across all portals.

  Props:
    icon        — Material Symbol name (default: 'inbox')
    title       — bold heading text
    description — softer subtext below the title
    action      — { label, icon, onClick } for the primary button (optional)
    secondAction— { label, icon, onClick } for a secondary outline button (optional)
    compact     — a smaller picture and less padding, for an empty card on a
                  dashboard rather than an empty page
    children    — rendered in the action row, for an action that is a <Link>
                  rather than a button (`action` only builds a <button>, and a
                  navigation dressed as one loses middle-click and "open in new
                  tab")
*/
export function EmptyState({ icon = 'inbox', title, description, action, secondAction, children, compact = false }) {
    return (
        <div className={`empty-state${compact ? ' is-compact' : ''}`}>
            {/* Coloured top strip */}
            <div className="empty-state-strip" />

            {/* Content area */}
            <div className="empty-state-inner">
                {/* Icon circle */}
                <div className="empty-state-art" aria-hidden="true">
                    {/* Soft shapes behind the icon: an empty page reads as a
                        place with something to do, not a missing piece. */}
                    <svg viewBox="0 0 160 120" width="160" height="120" focusable="false">
                        <ellipse cx="80" cy="64" rx="62" ry="46" className="empty-art-blob" />
                        <circle cx="24" cy="34" r="6" className="empty-art-dot" />
                        <circle cx="138" cy="26" r="4" className="empty-art-dot" />
                        <circle cx="132" cy="96" r="7" className="empty-art-ring" />
                        <path d="M30 92h10M35 87v10" className="empty-art-plus" />
                        <path d="M118 52h8M122 48v8" className="empty-art-plus" />
                    </svg>
                    <div className="empty-state-icon">
                        <span className="material-symbols-rounded">{icon}</span>
                    </div>
                </div>

                <div className="empty-state-title">{title}</div>

                {description && (
                    <div className="empty-state-desc">{description}</div>
                )}

                {(action || secondAction || children) && (
                    <div className="empty-state-actions">
                        {children}
                        {secondAction && (
                            <button className="btn btn-outline" onClick={secondAction.onClick}>
                                {secondAction.icon && <span className="material-symbols-rounded icon-sm" aria-hidden="true">{secondAction.icon}</span>}
                                {secondAction.label}
                            </button>
                        )}
                        {action && (
                            <button className="btn btn-primary" onClick={action.onClick}>
                                {action.icon && <span className="material-symbols-rounded icon-sm" aria-hidden="true">{action.icon}</span>}
                                {action.label}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
