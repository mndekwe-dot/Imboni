export function AnnouncementItem({
    type = 'general',
    icon = 'campaign',
    title,
    date,
    body,
    author,
    audience,
    isUnread = false,
    onClick,
}) {
    const badgeLabel = type.charAt(0).toUpperCase() + type.slice(1)
    const itemClass = `ann-item ${type}${isUnread ? ' unread' : ' read-item'}`

    return (
        <div className={itemClass} onClick={onClick} style={{ cursor: onClick ? 'pointer' : undefined }}>
            <div className="ann-item-top">
                <div className={`ann-item-icon ${type}`}>
                    <span className="material-symbols-rounded">{icon}</span>
                </div>
                <div className="ann-item-head">
                    <div className="ann-item-title">{title}</div>
                    <div className="ann-item-meta">
                        <span className={`ann-type-badge ${type}`}>{badgeLabel}</span>
                        <span className="ann-dot"></span>
                        <span>{date}</span>
                        {audience && <><span className="ann-dot"></span><span>{audience}</span></>}
                        {isUnread && <span className="ann-new-dot"></span>}
                    </div>
                </div>
            </div>
            <div className="ann-item-body">{body}</div>
            <div className="ann-item-footer">
                {author
                    ? <span className="ann-item-author">
                        <span className="material-symbols-rounded">person</span>{author}
                      </span>
                    : <span />
                }
                <button
                    className="ann-read-btn"
                    onClick={e => e.stopPropagation()}
                >
                    {isUnread ? 'Mark Read' : '✓ Read'}
                </button>
            </div>
        </div>
    )
}
