/*
 * Browser-side Web Push plumbing.
 *
 * Every function here returns a result object rather than throwing, because
 * push has many ordinary ways to be unavailable — an unsupported browser, an
 * http:// origin, a user who said "Block", a server with no VAPID keys — and
 * none of those are errors the user should see as a crash. The caller decides
 * what to show; nothing fails silently.
 */
import { getPushKey, subscribeToPush, unsubscribeFromPush } from '../api/notifications'

/** Web Push needs a service worker, PushManager, and (except on localhost) HTTPS. */
export function isPushSupported() {
    return (
        typeof window !== 'undefined'
        && 'serviceWorker' in navigator
        && 'PushManager' in window
        && 'Notification' in window
    )
}

/** The browser's current permission: 'granted' | 'denied' | 'default' | 'unsupported'. */
export function pushPermission() {
    if (!isPushSupported()) return 'unsupported'
    return Notification.permission
}

/*
 * The VAPID key arrives as base64url text; PushManager wants a Uint8Array.
 * base64url uses - and _ where base64 uses + and /, and drops the padding,
 * so all three have to be put back before atob() will accept it.
 */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const raw = window.atob(base64)
    const output = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
    return output
}

/** The active service worker registration, or null if none is ready. */
async function registration() {
    if (!('serviceWorker' in navigator)) return null
    try {
        return await navigator.serviceWorker.ready
    } catch {
        return null
    }
}

/** Is this browser already subscribed? Returns the subscription or null. */
export async function currentSubscription() {
    const reg = await registration()
    if (!reg) return null
    try {
        return await reg.pushManager.getSubscription()
    } catch {
        return null
    }
}

/**
 * Ask permission, subscribe, and register with the server.
 *
 * Returns { ok, reason } — reason is one of 'unsupported', 'not-configured',
 * 'denied', 'no-service-worker', 'failed', so the caller can show the right
 * message. A denied permission is a decision, not a failure, and is reported
 * separately for exactly that reason.
 */
export async function enablePush() {
    if (!isPushSupported()) return { ok: false, reason: 'unsupported' }

    let publicKey = ''
    try {
        const { data } = await getPushKey()
        if (!data?.configured || !data?.public_key) {
            return { ok: false, reason: 'not-configured' }
        }
        publicKey = data.public_key
    } catch {
        return { ok: false, reason: 'failed' }
    }

    let permission = Notification.permission
    if (permission === 'default') {
        try {
            permission = await Notification.requestPermission()
        } catch {
            return { ok: false, reason: 'failed' }
        }
    }
    if (permission !== 'granted') return { ok: false, reason: 'denied' }

    const reg = await registration()
    if (!reg) return { ok: false, reason: 'no-service-worker' }

    try {
        // Reuse an existing subscription if the browser already has one —
        // subscribing twice with a different key throws InvalidStateError.
        const existing = await reg.pushManager.getSubscription()
        const subscription = existing || await reg.pushManager.subscribe({
            userVisibleOnly: true,              // required by Chrome
            applicationServerKey: urlBase64ToUint8Array(publicKey),
        })

        await subscribeToPush(subscription.toJSON())
        return { ok: true }
    } catch {
        return { ok: false, reason: 'failed' }
    }
}

/**
 * Unsubscribe this browser and tell the server to forget it.
 *
 * The server is told first: if the local unsubscribe succeeded but the server
 * call failed, the backend would keep pushing to a dead endpoint until the
 * push service reported it gone.
 */
export async function disablePush() {
    const subscription = await currentSubscription()
    if (!subscription) return { ok: true }

    try {
        await unsubscribeFromPush(subscription.endpoint)
    } catch {
        return { ok: false, reason: 'failed' }
    }

    try {
        await subscription.unsubscribe()
    } catch {
        // The server row is gone, so nothing more will be sent here. Report
        // success rather than alarming the user about a browser-side detail.
    }
    return { ok: true }
}
