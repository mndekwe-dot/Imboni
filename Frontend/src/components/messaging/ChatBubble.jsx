/**
 * ChatBubble — one message in the thread body.
 *
 * Handles three content types:
 *   1. Plain text message (default)
 *   2. File attachment  — pass attachment: { fileName, fileSize }
 *
 * Props:
 *   type               'sent' | 'received'
 *   text               {string}  Message body (omit for attachments)
 *   time               {string}  Timestamp string
 *   ticks              {string|null}  'seen' → blue ✓✓, '' → grey ✓✓, null → hidden
 *   dateSep            {string|null}  Date separator label shown above this bubble
 *   senderInitials     {string}  Initials shown in received-message avatar
 *   senderAvatarClass  {string}  CSS class for received-message avatar colour
 *   attachment         {object|null}  { fileName, fileSize } for file bubbles
 */
export function ChatBubble({
    type = 'sent',
    text,
    time,
    ticks = null,
    dateSep = null,
    senderInitials,
    senderAvatarClass = '',
    attachment = null,
}) {
    return (
        <>
            {dateSep && (
                <div className="date-sep"><span>{dateSep}</span></div>
            )}
            <div className={`msg-row ${type}`}>
                {type === 'received' && (
                    <div className={`msg-avatar ${senderAvatarClass}`}>
                        {senderInitials}
                    </div>
                )}
                <div className="msg-bubble">
                    {attachment ? (
                        /* File attachment bubble */
                        <div className="msg-attach">
                            <span className="material-symbols-rounded">description</span>
                            <div className="msg-attach-main">
                                <div className="msg-attach-name">
                                    {attachment.fileName}
                                </div>
                                <div className="msg-attach-size">{attachment.fileSize}</div>
                            </div>
                            <button type="button" className="msg-attach-btn" title="Download">
                                <span className="material-symbols-rounded">download</span>
                            </button>
                        </div>
                    ) : (
                        <p className="msg-text">{text}</p>
                    )}
                    <div className="msg-meta">
                        <span className="msg-time">{time}</span>
                        {ticks != null && (
                            <span className={`read-ticks${ticks === 'seen' ? ' seen' : ''}`}>✓✓</span>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}
