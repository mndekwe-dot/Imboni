/**
 * ConversationItem — one row in the conversation list panel.
 *
 * Used by every portal's Messages page.
 *
 * Props:
 *   initials       {string}  Avatar letters, e.g. 'GM'
 *   avatarClass    {string}  CSS class for avatar colour, e.g. 'teacher', 'parent'
 *   avatarStyle    {object}  Optional inline style override (e.g. custom background)
 *   name           {string}  Contact display name
 *   typeTag        {string}  Badge label, e.g. 'Teacher', 'Parent' (omit to hide)
 *   typeClass      {string}  CSS class for the badge colour
 *   time           {string}  Timestamp string, e.g. '10 min', 'Yesterday'
 *   preview        {string}  Message snippet
 *   isUnread       {boolean} Highlights the row and shows an unread dot
 *   isActive       {boolean} Shows the selected/open state
 *   isOnline       {boolean} Shows a green presence indicator on the avatar
 */
export function ConversationItem({
    initials,
    avatarClass = '',
    avatarStyle,
    name,
    typeTag,
    typeClass = '',
    time,
    preview,
    isUnread = false,
    isActive = false,
    isOnline = false,
    onClick,
}) {
    return (
        <div className={`conv-item${isActive ? ' active' : ''}${isUnread ? ' unread' : ''}`} onClick={onClick}>
            <div
                className={`conv-avatar ${avatarClass}`}
                style={{ position: 'relative', ...(avatarStyle || {}) }}
            >
                {initials}
                {isOnline && (
                    <span style={{
                        position: 'absolute', bottom: '1px', right: '1px',
                        width: '10px', height: '10px', borderRadius: '50%',
                        background: '#22c55e', border: '2px solid white', display: 'block',
                    }} />
                )}
            </div>
            <div className="conv-body">
                <div className="conv-top">
                    <span className="conv-name">{name}</span>
                    {typeTag && (
                        <span className={`conv-type-tag ${typeClass}`}>{typeTag}</span>
                    )}
                    <span className="conv-time">{time}</span>
                </div>
                <div className="conv-bottom">
                    <span className="conv-preview">{preview}</span>
                    {isUnread && <span className="unread-dot"></span>}
                </div>
            </div>
        </div>
    )
}
