import { useEffect, useRef } from 'react'

/* ─── Modal ──────────────────────────────────────────────────────────────────
   Wraps the native <dialog> element so we get:
     • Escape key closes the modal (browser-native)
     • Click on backdrop closes the modal
     • Focus is trapped inside while open (browser-native with showModal())
     • ::backdrop pseudo-element for the dimmed overlay

   Props:
     title    — text shown in the modal header
     icon     — Material Symbol name for the header icon (optional)
     onClose  — called when user closes via Escape, backdrop click, or × button
     children — modal body content
     wide     — set true to use a wider max-width (for PeriodManager)
──────────────────────────────────────────────────────────────────────────── */
export function Modal({ title, icon, onClose, children, wide = false }) {
    const dialogRef = useRef(null)

    useEffect(() => {
        const dialog = dialogRef.current
        dialog.showModal()
        /* Native dialog fires 'close' when ESC is pressed — forward to onClose */
        const handleClose = () => onClose()
        dialog.addEventListener('close', handleClose)
        return () => dialog.removeEventListener('close', handleClose)
    }, [onClose])

    /* Backdrop click: e.target is the <dialog> element itself (not its children)
       when the user clicks on the dimmed area outside the white panel */
    function handleBackdropClick(e) {
        if (e.target === dialogRef.current) onClose()
    }

    return (
        <dialog
            ref={dialogRef}
            className={`tt-modal${wide ? ' tt-modal-wide' : ''}`}
            onClick={handleBackdropClick}
        >
            {/* stopPropagation prevents clicks inside from bubbling to the dialog and triggering backdrop close */}
            <div className="tt-modal-inner" onClick={e => e.stopPropagation()}>
                <div className="tt-modal-header">
                    {icon && <span className="material-symbols-rounded">{icon}</span>}
                    <h2 className="tt-modal-title">{title}</h2>
                    <button className="tt-modal-close" onClick={onClose} aria-label="Close dialog">
                        <span className="material-symbols-rounded">close</span>
                    </button>
                </div>
                <div className="tt-modal-body">
                    {children}
                </div>
            </div>
        </dialog>
    )
}
