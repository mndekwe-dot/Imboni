/*
  EmptyState — shared empty/no-results component used across all portals.

  Props:
    icon        — Material Symbol name (default: 'inbox')
    title       — bold heading text
    description — softer subtext below the title
    action      — { label, icon, onClick } for the primary button (optional)
    secondAction— { label, icon, onClick } for a secondary outline button (optional)
    children    — rendered in the action row, for an action that is a <Link>
                  rather than a button (`action` only builds a <button>, and a
                  navigation dressed as one loses middle-click and "open in new
                  tab")
*/
export function EmptyState({ icon = 'inbox', title, description, action, secondAction, children }) {
    return (
        <div className="empty-state">
            {/* Coloured top strip */}
            <div className="empty-state-strip" />

            {/* Content area */}
            <div className="empty-state-inner">
                {/* Icon circle */}
                <div className="empty-state-icon">
                    <span className="material-symbols-rounded" aria-hidden="true">{icon}</span>
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
