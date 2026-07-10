import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import '../styles/notifications.css'

export function NotificationDropdown({ notifications, onRead }) {
  const [isOpen, setIsOpen] = useState(false)
  const [items, setItems] = useState(notifications)
  const wrapperRef = useRef(null)
  const navigate = useNavigate()

  const unreadCount = items.filter(n => !n.read).length

  // Re-sync local copy whenever the prop changes — needed because notifications
  // usually arrive asynchronously (API call) after this component's first render.
  useEffect(() => {
    setItems(notifications)
  }, [notifications])

  useEffect(() => {
    function handleOutsideClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    function handleEscape(e) {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  function handleItemClick(item) {
    setItems(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n))
    onRead?.(item.id)   // persist to backend if the caller provided a handler
    navigate(item.path)
    setIsOpen(false)
  }

  return (
    <div className="notif-wrapper" ref={wrapperRef}>
      <button
        className="notification-btn"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(prev => !prev)}
      >
        <span className="material-symbols-rounded" aria-hidden="true">notifications</span>
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span className="notif-unread-count">{unreadCount} new</span>
            )}
          </div>
          <div className="notif-list">
            {items.map(item => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                className={`notif-item ${item.read ? 'notif-read' : 'notif-unread'}`}
                onClick={() => handleItemClick(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleItemClick(item)
                  }
                }}
              >
                <div className="notif-dot" aria-hidden="true" />
                <div className="notif-content">
                  <p className="notif-title">{item.title}</p>
                  <p className="notif-message">{item.message}</p>
                  <span className="notif-time">{item.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
