import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Sidebar } from '../layout/Sidebar'
import { DashboardHeader } from '../layout/DashboardHeader'
import { ConversationItem } from './ConversationItem'
import { ChatBubble } from './ChatBubble'
import { formatDateShort, formatTime } from '../../utils/date'
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

// `t` is passed in rather than captured: this sits outside the component, and
// both the clock time and the word "Yesterday" have to follow the active
// language, not the browser's.
function relativeTime(iso, t) {
    if (!iso) return ''
    const d = new Date(iso)
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    if (sameDay) return formatTime(d)
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
    if (d.toDateString() === yesterday.toDateString()) return t('common.yesterday')
    return formatDateShort(d)
}

/**
 * LiveMessages — real, API-backed messaging page shared by every portal.
 * Each portal passes only its nav + current-user info; all data flow
 * (conversations, threads, composer, new-message contacts) is handled here.
 */
export function LiveMessages({
    navItems, secondaryItems,
    title, subtitle,
    userName, userRole, userInitials, avatarClass,
}) {
    const { t } = useTranslation()
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

    /* Arriving with someone already in mind: `?with=<user id>`.
     *
     * A "Message" button elsewhere in the app (a staff card, a class list) used
     * to land people on the conversation LIST, where they still had to open the
     * new-message dialog and find by name the person they had just been looking
     * at. This opens the thread with them directly.
     *
     * `startConversation` reuses an existing thread, so this neither duplicates
     * a conversation nor sends anything — it opens the room. The parameter is
     * then dropped from the URL so a later refresh does not re-run it, and
     * `selectedId` guards against the poll re-triggering it mid-session.
     */
    const [searchParams, setSearchParams] = useSearchParams()
    const openWith = searchParams.get('with')
    useEffect(() => {
        if (!openWith || selectedId) return
        let cancelled = false
        startConversation(openWith)
            .then(async conv => {
                if (cancelled || !conv?.id) return
                await loadConversations()
                selectConversation(conv.id)
            })
            .catch(() => {
                if (!cancelled) setError('Could not open that conversation.')
            })
            .finally(() => {
                if (!cancelled) setSearchParams({}, { replace: true })
            })
        return () => { cancelled = true }
        // selectConversation is redefined every render; the guard above is what
        // keeps this to one run.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [openWith])

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
            <a href="#main-content" className="skip-link">{t('common.skipToContent')}</a>
            <div className="sidebar-overlay"></div>
            <div className="dashboard-layout">
                <Sidebar navItems={navItems} secondaryItems={secondaryItems} />
                <main className="dashboard-main" id="main-content">
                    <DashboardHeader
                        title={title} subtitle={subtitle}
                        userName={userName} userRole={userRole}
                        userInitials={userInitials} avatarClass={avatarClass}
                    />
                    <div className="dashboard-content msg-content-pad">
                        {error && <div className="alert alert-danger lm-alert">{error}</div>}
                        <div className={`msg-page-wrap${showThread ? ' thread-open' : ''}`}>

                            {/* ── Conversation list ── */}
                            <div className="conv-panel">
                                <div className="conv-panel-header">
                                    <h3>{t('messaging.title')}</h3>
                                    <button className="btn btn-sm btn-primary" onClick={openNewMessage}>
                                        <span className="material-symbols-rounded" aria-hidden="true">edit</span>
                                        {t('messaging.new')}
                                    </button>
                                </div>

                                <div className="conv-list">
                                    {loadingConvs ? (
                                        <p className="lm-note">{t('common.loading')}</p>
                                    ) : conversations.length === 0 ? (
                                        <p className="lm-note">
                                            {t('messaging.noConversations')}
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
                                                time={relativeTime(conv.last_message?.created_at || conv.updated_at, t)}
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
                                        <div className="thread-body lm-thread-empty">
                                            <span className="material-symbols-rounded lm-empty-icon" aria-hidden="true">forum</span>
                                            <p className="lm-empty-title">{t('messaging.selectConversation')}</p>
                                            <button className="btn btn-primary btn-sm" onClick={openNewMessage}>
                                                <span className="material-symbols-rounded" aria-hidden="true">edit</span>
                                                {t('messaging.newMessage')}
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="thread-head">
                                                <button className="back-btn" aria-label={t('messaging.backToConversations')} onClick={() => setShowThread(false)}>
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
                                                    <p className="lm-thread-note">{t('common.loading')}</p>
                                                ) : messages.length === 0 ? (
                                                    <p className="lm-thread-note">No messages yet. Say hello.</p>
                                                ) : messages.map(m => (
                                                    <ChatBubble
                                                        key={m.id}
                                                        type={m.is_mine ? 'sent' : 'received'}
                                                        text={m.content}
                                                        time={relativeTime(m.created_at, t)}
                                                        senderInitials={m.is_mine ? undefined : initialsOf(m.sender_name)}
                                                        senderAvatarClass={roleClass(other?.role)}
                                                    />
                                                ))}
                                            </div>

                                            <div className="thread-composer">
                                                <input
                                                    type="text"
                                                    className="composer-input"
                                                    placeholder={t('messaging.typeMessage')}
                                                    value={draft}
                                                    onChange={e => setDraft(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
                                                />
                                                <button className="btn btn-primary send-btn" title={t('common.send')}
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
                                <h2 className="modal-title">{t('messaging.newMessage')}</h2>
                            </div>
                            <button className="btn-icon-clean" onClick={() => setShowNew(false)}>
                                <span className="material-symbols-rounded">close</span>
                            </button>
                        </div>
                        <div className="modal-body">
                            <input
                                className="form-input lm-contact-search"
                                placeholder={t('messaging.searchPeople')}
                                value={contactSearch}
                                onChange={e => setContactSearch(e.target.value)}
                                autoFocus
                            />
                            <div className="lm-contact-list">
                                {contacts.length === 0 ? (
                                    <p className="lm-contact-empty">No contacts found.</p>
                                ) : contacts.map(c => (
                                    <button key={c.id} type="button" className="lm-contact" onClick={() => startWith(c)}>
                                        <span className={`conv-avatar ${roleClass(c.role)}`}>
                                            {initialsOf(c.name)}
                                        </span>
                                        <span className="lm-contact-main">
                                            <span className="lm-contact-name">{c.name}</span>
                                            <span className="lm-contact-role">{c.role_label}</span>
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
