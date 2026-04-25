import { useEffect, useRef } from 'react'

/*
  Global Modal — wraps native <dialog> for use across all portals.

  Props:
    title     — header text
    icon      — Material Symbol name (optional)
    onClose   — called on ESC, backdrop click, or × button
    children  — body content
    footer    — optional footer content (buttons)
    size      — 'default' | 'wide' | 'lg'  (default: 'default')
*/
export function Modal({ title, icon, onClose, children, footer, size = 'default' }) {
    const dialogRef = useRef(null)

    useEffect(() => {
        const dialog = dialogRef.current
        dialog.showModal()
        const handleClose = () => onClose()
        dialog.addEventListener('close', handleClose)
        return () => dialog.removeEventListener('close', handleClose)
    }, [onClose])

    function handleBackdropClick(e) {
        if (e.target === dialogRef.current) onClose()
    }

    const sizeClass = size === 'wide' ? ' tt-modal-wide' : size === 'lg' ? ' tt-modal-lg' : ''

    return (
        <dialog
            ref={dialogRef}
            className={`tt-modal${sizeClass}`}
            onClick={handleBackdropClick}
        >
            <div className="tt-modal-inner" onClick={e => e.stopPropagation()}>
                <div className="tt-modal-header">
                    {icon && <span className="material-symbols-rounded">{icon}</span>}
                    <h2 className="tt-modal-title">{title}</h2>
                    <button className="tt-modal-close" onClick={onClose} aria-label="Close">
                        <span className="material-symbols-rounded">close</span>
                    </button>
                </div>

                <div className="tt-modal-body">
                    {children}
                </div>

                {footer && (
                    <div className="tt-modal-footer">
                        {footer}
                    </div>
                )}
            </div>
        </dialog>
    )
}
