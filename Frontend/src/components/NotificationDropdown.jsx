import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import '../styles/notifications.css'

export function NotificationDropdown({ notifications }) {
  const [isOpen, setIsOpen] = useState(false)
  const [items, setItems] = useState(notifications)
  const wrapperRef = useRef(null)
  const navigate = useNavigate()

  const unreadCount = items.filter(n => !n.read).length

  useEffect(() => {
    function handleOutsideClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  function handleItemClick(item) {
    setItems(prev => prev.map(n => n.id === item.id ? { ...n, read: true } : n))
    navigate(item.path)
    setIsOpen(false)
  }

  return (
    <div className="notif-wrapper" ref={wrapperRef}>
      <button className="notification-btn" onClick={() => setIsOpen(prev => !prev)}>
        <span className="material-symbols-rounded">notifications</span>
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
                className={`notif-item ${item.read ? 'notif-read' : 'notif-unread'}`}
                onClick={() => handleItemClick(item)}
              >
                <div className="notif-dot" />
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
