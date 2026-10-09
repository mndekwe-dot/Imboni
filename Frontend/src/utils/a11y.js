/**
 * Props that make a clickable non-button reachable from the keyboard.
 *
 * A `<div onClick>` works for a mouse and nobody else: Tab skips it and Enter
 * does nothing. Spread these on it instead of a bare onClick. Prefer a real
 * <button> or <a> where the markup allows; this is for rows and cards that
 * hold other content and cannot be one.
 *
 *   <div {...asButton(() => open(item))}>
 */
function onActivate(handler) {
    return e => {
        // Let a real button or link inside the row keep its own keys.
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handler(e)
        }
    }
}

export const asButton = handler => ({ role: 'button', tabIndex: 0, onClick: handler, onKeyDown: onActivate(handler) })

/** A table row keeps its row role; it only gains focus and the keys. */
export const asRow = handler => ({ tabIndex: 0, onClick: handler, onKeyDown: onActivate(handler) })
