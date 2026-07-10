import { useState, useEffect, useRef, useCallback } from 'react'
import { Sidebar } from '../layout/Sidebar'
import { DashboardHeader } from '../layout/DashboardHeader'
import { ConversationItem } from './ConversationItem'
import { ChatBubble } from './ChatBubble'
import {
    getConversations, getMessages, sendMessage,
    getMessageContacts, startConversation,
} from '../../api/messages'
import '../../styles/layout.css'
import '../../styles/components.css'
import '../../styles/pages.css'

const POLL_MS = 20000

function initialsOf(name = '') {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?'
}

// Backend roles map directly to the avatar/tag CSS colour classes.
function roleClass(role) {
    return ['teacher', 'parent', 'student', 'discipline', 'matron', 'dos', 'admin'].includes(role)
        ? role : ''
}

function relativeTime(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/**
 * LiveMessages — real, API-backed messaging page shared by every portal.
 * Each portal passes only its nav + current-user info; all data flow
 * (conversations, threads, composer, new-message contacts) is handled here.
 */
export function LiveMessages({
    navItems, secondaryItems,
    title = 'Messages', subtitle,
    userName, userRole, userInitials, avatarClass,
}) {
    const [conversations, setConversations] = useState([])
    const [loadingConvs, setLoadingConvs] = useState(true)
    const [selectedId, setSelectedId] = useState(null)
    const [messages, setMessages] = useState([])
    const [loadingThread, setLoadingThread] = useState(false)
    const [draft, setDraft] = useState('')
    const [sending, setSending] = useState(false)
    const [showThread, setShowThread] = useState(false)
    const [error, setError] = useState(null)

    // New-message modal
    const [showNew, setShowNew] = useState(false)
    const [contacts, setContacts] = useState([])
    const [contactSearch, setContactSearch] = useState('')

    const threadBodyRef = useRef(null)

    const loadConversations = useCallback(async () => {
        try {
            const data = await getConversations()
            const list = Array.isArray(data) ? data : (data?.results ?? [])
            setConversations(list)
            setError(null)
        } catch {
            setError('Could not load messages. Check your connection.')
        } finally {
            setLoadingConvs(false)
        }
    }, [])

    // Initial load + polling for new conversations/unread
    useEffect(() => {
        loadConversations()
        const t = setInterval(loadConversations, POLL_MS)
        return () => clearInterval(t)
    }, [loadConversations])

    const loadThread = useCallback(async (id) => {
        setLoadingThread(true)
        try {
            const data = await getMessages(id)
            setMessages(Array.isArray(data) ? data : (data?.results ?? []))
            // Reading the thread marks messages read server-side; refresh the
            // list so the unread badge clears.
            loadConversations()
        } catch {
            setError('Could not open this conversation.')
        } finally {
            setLoadingThread(false)
        }
    }, [loadConversations])

    function selectConversation(id) {
        setSelectedId(id)
        setShowThread(true)
        loadThread(id)
    }

    // Keep the thread scrolled to the newest message
    useEffect(() => {
        if (threadBodyRef.current) {
            threadBodyRef.current.scrollTop = threadBodyRef.current.scrollHeight
        }
    }, [messages])

    async function handleSend() {
        const content = draft.trim()
        if (!content || !selectedId || sending) return
        setSending(true)
        try {
            await sendMessage(selectedId, content)
            setDraft('')
            await loadThread(selectedId)
        } catch {
            setError('Message not sent. Try again.')
        } finally {
            setSending(false)
        }
    }

    async function openNewMessage() {
        setShowNew(true)
        setContactSearch('')
        try {
            setContacts(await getMessageContacts())
        } catch {
            setContacts([])
        }
    }

    useEffect(() => {
        if (!showNew) return
        const t = setTimeout(async () => {
            try { setContacts(await getMessageContacts(contactSearch)) } catch { /* keep previous */ }
        }, 250)
        return () => clearTimeout(t)
    }, [contactSearch, showNew])

    async function startWith(contact) {
        try {
            const conv = await startConversation(contact.id)
            setShowNew(false)
            await loadConversations()
            selectConversation(conv.id)
        } catch {
            setError('Could not start that conversation.')
        }
    }

    const activeConv = conversations.find(c => c.id === selectedId)
    const other = activeConv?.other_participant

    return (
        <>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={navItems} secondaryItems={secondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={title} subtitle={subtitle}
                        userName={userName} userRole={userRole}
                        userInitials={userInitials} avatarClass={avatarClass}
                    />
                    <div className="dashboard-content" style={{ padding: '1.5rem' }}>
                        {error && <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{error}</div>}
                        <div className={`msg-page-wrap${showThread ? ' thread-open' : ''}`}>

                            {/* ── Conversation list ── */}
                            <div className="conv-panel">
                                <div className="conv-panel-header">
                                    <h3>Messages</h3>
                                    <button className="btn btn-sm btn-primary" onClick={openNewMessage}>
                                        <span className="material-symbols-rounded">edit</span>
                                        New
                                    </button>
                                </div>

                                <div className="conv-list">
                                    {loadingConvs ? (
                                        <p style={{ padding: '1.5rem', color: 'var(--muted-foreground)' }}>Loading…</p>
                                    ) : conversations.length === 0 ? (
                                        <p style={{ padding: '1.5rem', color: 'var(--muted-foreground)' }}>
                                            No conversations yet. Tap “New” to start one.
                                        </p>
                                    ) : conversations.map(conv => {
                                        const name = conv.other_participant?.name || conv.subject || 'Conversation'
                                        return (
                                            <ConversationItem
                                                key={conv.id}
                                                initials={initialsOf(name)}
                                                avatarClass={roleClass(conv.other_participant?.role)}
                                                name={name}
                                                typeTag={conv.other_participant?.role_label}
                                                typeClass={roleClass(conv.other_participant?.role)}
                                                time={relativeTime(conv.last_message?.created_at || conv.updated_at)}
                                                preview={conv.last_message?.content || 'No messages yet'}
                                                isUnread={conv.unread_count > 0}
                                                isActive={conv.id === selectedId}
                                                onClick={() => selectConversation(conv.id)}
                                            />
                                        )
                                    })}
                                </div>
                            </div>

                            {/* ── Thread ── */}
                            <div className="msg-right-col">
                                <div className="thread-panel">
                                    {!selectedId ? (
                                        <div className="thread-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)' }}>
                                            Select a conversation to read it.
                                        </div>
                                    ) : (
                                        <>
                                            <div className="thread-head">
                                                <button className="back-btn" aria-label="Back to conversations" onClick={() => setShowThread(false)}>
                                                    <span className="material-symbols-rounded">arrow_back</span>
                                                </button>
                                                <div className={`thread-head-avatar ${roleClass(other?.role)}`}>
                                                    {initialsOf(other?.name)}
                                                </div>
                                                <div className="thread-head-info">
                                                    <div className="thread-head-name">
                                                        {other?.name || 'Conversation'}
                                                        {other?.role_label && (
                                                            <span className={`conv-type-tag ${roleClass(other?.role)}`}>{other.role_label}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="thread-body" ref={threadBodyRef}>
                                                {loadingThread && messages.length === 0 ? (
                                                    <p style={{ color: 'var(--muted-foreground)' }}>Loading…</p>
                                                ) : messages.length === 0 ? (
                                                    <p style={{ color: 'var(--muted-foreground)' }}>No messages yet — say hello.</p>
                                                ) : messages.map(m => (
                                                    <ChatBubble
                                                        key={m.id}
                                                        type={m.is_mine ? 'sent' : 'received'}
                                                        text={m.content}
                                                        time={relativeTime(m.created_at)}
                                                        senderInitials={m.is_mine ? undefined : initialsOf(m.sender_name)}
                                                        senderAvatarClass={roleClass(other?.role)}
                                                    />
                                                ))}
                                            </div>

                                            <div className="thread-composer">
                                                <input
                                                    type="text"
                                                    className="composer-input"
                                                    placeholder="Type your message…"
                                                    value={draft}
                                                    onChange={e => setDraft(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
                                                />
                                                <button className="btn btn-primary send-btn" title="Send"
                                                    onClick={handleSend} disabled={sending || !draft.trim()}>
                                                    <span className="material-symbols-rounded">send</span>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>

            {/* ── New message: contacts picker ── */}
            {showNew && (
                <div className="modal-overlay" onClick={() => setShowNew(false)}>
                    <div className="modal-box modal-box-sm" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-header-left">
                                <span className="material-symbols-rounded">edit</span>
                                <h2 className="modal-title">New Message</h2>
                            </div>
                            <button className="btn-icon-clean" onClick={() => setShowNew(false)}>
                                <span className="material-symbols-rounded">close</span>
                            </button>
                        </div>
                        <div className="modal-body">
                            <input
                                className="form-input"
                                placeholder="Search people you can message…"
                                value={contactSearch}
                                onChange={e => setContactSearch(e.target.value)}
                                autoFocus
                                style={{ marginBottom: '0.75rem' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: 320, overflowY: 'auto' }}>
                                {contacts.length === 0 ? (
                                    <p style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>No contacts found.</p>
                                ) : contacts.map(c => (
                                    <button key={c.id}
                                        onClick={() => startWith(c)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '0.6rem', textAlign: 'left',
                                            padding: '0.5rem 0.6rem', borderRadius: 8, border: '1px solid var(--border)',
                                            background: 'transparent', cursor: 'pointer',
                                        }}>
                                        <span className={`conv-avatar ${roleClass(c.role)}`} style={{ width: 34, height: 34, fontSize: '0.8rem' }}>
                                            {initialsOf(c.name)}
                                        </span>
                                        <span style={{ flex: 1 }}>
                                            <span style={{ fontWeight: 600, fontSize: '0.875rem', display: 'block' }}>{c.name}</span>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{c.role_label}</span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
