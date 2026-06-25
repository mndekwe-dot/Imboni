import { useState, useEffect, useCallback } from 'react'
import { getNotifications, markNotificationRead } from '../api/notifications'

export function useNotifications() {
    const [notifications, setNotifications] = useState([])

    const refresh = useCallback(() => {
        getNotifications().then(setNotifications).catch(() => {})
    }, [])

    useEffect(() => { refresh() }, [refresh])

    async function markRead(id) {
        await markNotificationRead(id)
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    }

    return { notifications, markRead, refresh }
}
