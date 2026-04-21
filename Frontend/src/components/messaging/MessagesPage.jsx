import { useState } from 'react'
import { Sidebar } from '../layout/Sidebar'
import { DashboardHeader } from '../layout/DashboardHeader'
import { ConversationItem } from './ConversationItem'
import { ChatBubble } from './ChatBubble'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/pages.css'

/**
 * MessagesPage — shared full-page messaging layout used by every portal.
 *
 * Each portal page passes its own nav, user info, conversations, messages,
 * and filter tabs. The chrome (sidebar, header, two-panel layout, thread
 * composer) is rendered here once and shared across all portals.
 *
 * Props:
 *   navItems            {array}   Sidebar primary nav links
 *   secondaryItems      {array}   Sidebar secondary nav links (Profile, Logout)
 *
 *   title               {string}  Page heading, default 'Messages'
 *   subtitle            {string}  Header subtitle
 *   userName            {string}  Current user's display name
 *   userRole            {string}  Current user's role label
 *   userInitials        {string}  Current user's avatar initials
 *   avatarClass         {string}  CSS class for the header avatar
 *
 *   conversations       {array}   Array of ConversationItem props objects
 *   tabs                {array}   Filter tab labels, e.g. ['All', 'Unread', 'Parents']
 *
 *   messages            {array}   Array of ChatBubble props objects for active thread
 *   activeContact       {object}  Active thread contact info (see shape below)
 *   composerPlaceholder {string}  Input placeholder text
 *
 *   extraPanel          {node}    Optional JSX rendered below the thread panel
 *                                 (e.g. Teacher's Quick Replies card)
 *
 * activeContact shape:
 *   { initials, avatarClass, name, typeTag, typeClass, subtitle, isOnline }
 */
export function MessagesPage({
    navItems,
    secondaryItems,

    title = 'Messages',
    subtitle,
    userName,
    userRole,
    userInitials,
    avatarClass,

    conversations = [],
    tabs = ['All'],

    messages = [],
    activeContact = {},
    composerPlaceholder = 'Type your message...',

    extraPanel,
}) {
    const [activeTab, setActiveTab] = useState(0)
    const [showThread, setShowThread] = useState(false)

    const {
        initials:  contactInitials,
        avatarClass: contactAvatarClass = '',
        name:      contactName,
        typeTag:   contactTypeTag,
        typeClass: contactTypeClass = '',
        subtitle:  contactSubtitle,
        isOnline:  contactIsOnline = false,
    } = activeContact

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={navItems} secondaryItems={secondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={title}
                        subtitle={subtitle}
                        userName={userName}
                        userRole={userRole}
                        userInitials={userInitials}
                        avatarClass={avatarClass}
                    />
                    <div className="dashboard-content" style={{ padding: '1.5rem' }}>
                        <div className={`msg-page-wrap${showThread ? ' thread-open' : ''}`}>

                            {/* ── Left panel: conversation list ──────────────── */}
                            <div className="conv-panel">
                                <div className="conv-panel-header">
                                    <h3>Messages</h3>
                                    <button className="btn btn-sm btn-primary">
                                        <span className="material-symbols-rounded">edit</span>
                                        New
                                    </button>
                                </div>

                                <div className="conv-search">
                                    <div className="conv-search-inner">
                                        <span className="material-symbols-rounded">search</span>
                                        <input type="text" placeholder="Search messages..." />
                                    </div>
                                </div>

                                <div className="conv-filters">
                                    {tabs.map((tab, i) => (
                                        <button
                                            key={tab}
                                            className={`conv-filter-btn${activeTab === i ? ' active' : ''}`}
                                            onClick={() => setActiveTab(i)}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>

                                <div className="conv-list">
                                    {conversations.map((conv, i) => (
                                        <ConversationItem key={i} {...conv} onClick={() => setShowThread(true)} />
                                    ))}
                                </div>
                            </div>

                            {/* ── Right column: thread + optional extra panel ─ */}
                            <div className="msg-right-col">
                                <div className="thread-panel">

                                    {/* Thread header */}
                                    <div className="thread-head">
                                        <button className="back-btn" aria-label="Back to conversations" onClick={() => setShowThread(false)}>
                                            <span className="material-symbols-rounded">arrow_back</span>
                                        </button>
                                        <div
                                            className={`thread-head-avatar ${contactAvatarClass}`}
                                            style={{ position: 'relative' }}
                                        >
                                            {contactIsOnline && (
                                                <div style={{
                                                    position: 'absolute', bottom: '1px', right: '1px',
                                                    width: '11px', height: '11px', borderRadius: '50%',
                                                    background: '#22c55e', border: '2px solid white',
                                                }} />
                                            )}
                                            {contactInitials}
                                        </div>
                                        <div className="thread-head-info">
                                            <div className="thread-head-name">
                                                {contactName}
                                                {contactTypeTag && (
                                                    <span className={`conv-type-tag ${contactTypeClass}`}>
                                                        {contactTypeTag}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="thread-head-status">
                                                {contactIsOnline && <span className="dot-online"></span>}
                                                {contactSubtitle || (contactIsOnline ? 'Active now' : '')}
                                            </div>
                                        </div>
                                        <div className="thread-actions">
                                            <button className="thread-action-btn" title="View profile">
                                                <span className="material-symbols-rounded">person</span>
                                            </button>
                                            <button className="thread-action-btn" title="More options">
                                                <span className="material-symbols-rounded">more_vert</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Message thread */}
                                    <div className="thread-body">
                                        {messages.map((msg, i) => (
                                            <ChatBubble key={i} {...msg} />
                                        ))}
                                    </div>

                                    {/* Composer */}
                                    <div className="thread-composer">
                                        <button className="composer-icon-btn" title="Attach file">
                                            <span className="material-symbols-rounded">attach_file</span>
                                        </button>
                                        <input
                                            type="text"
                                            className="composer-input"
                                            placeholder={composerPlaceholder}
                                        />
                                        <button className="composer-icon-btn" title="Emoji">
                                            <span className="material-symbols-rounded">emoji_emotions</span>
                                        </button>
                                        <button className="btn btn-primary send-btn" title="Send">
                                            <span className="material-symbols-rounded">send</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Extra panel slot — Teacher uses this for Quick Replies */}
                                {extraPanel}
                            </div>

                        </div>
                    </div>
                </main>
            </div>
        </>
    )
}
