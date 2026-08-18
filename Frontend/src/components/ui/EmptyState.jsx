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
        <div className="empty-state">
            {/* Coloured top strip */}
            <div className="empty-state-strip" />

            {/* Content area */}
            <div className="empty-state-inner">
                {/* Icon circle */}
                <div className="empty-state-icon">
                    <span className="material-symbols-rounded">{icon}</span>
                </div>

                <div className="empty-state-title">{title}</div>

                {description && (
                    <div className="empty-state-desc">{description}</div>
                )}

                {(action || secondAction) && (
                    <div className="empty-state-actions">
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
