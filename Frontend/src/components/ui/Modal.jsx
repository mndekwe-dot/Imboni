import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

/*
  Global Modal — wraps native <dialog> for use across all portals.

  Props:
    title     — header text
    icon      — Material Symbol name (optional)
    onClose   — called on ESC, backdrop click, or × button
    children  — body content
    footer    — optional footer content (buttons)
    size      — 'default' | 'wide' | 'lg'  (default: 'default')
    unsavedMessage — when set, leaving by ESC, backdrop or × asks first, so a
                     half-filled form is not lost to a stray click
*/
export function Modal({ title, icon, onClose, children, footer, size = 'default', unsavedMessage }) {
    const { t } = useTranslation()
    const dialogRef = useRef(null)
    const messageRef = useRef(unsavedMessage)
    messageRef.current = unsavedMessage

    // True when it is fine to leave: nothing unsaved, or the user said so.
    const mayLeave = () => !messageRef.current || window.confirm(messageRef.current)

    useEffect(() => {
        const dialog = dialogRef.current
        dialog.showModal()
        const handleClose = () => onClose()
        // ESC arrives as 'cancel' before the dialog closes, so it can be refused.
        const handleCancel = e => { if (!mayLeave()) e.preventDefault() }
        dialog.addEventListener('close', handleClose)
        dialog.addEventListener('cancel', handleCancel)
        return () => {
            dialog.removeEventListener('close', handleClose)
            dialog.removeEventListener('cancel', handleCancel)
        }
    }, [onClose])

    function requestClose() {
        if (mayLeave()) onClose()
    }

    function handleBackdropClick(e) {
        if (e.target === dialogRef.current) requestClose()
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
                    {icon && <span className="material-symbols-rounded" aria-hidden="true">{icon}</span>}
                    <h2 className="tt-modal-title">{title}</h2>
                    <button className="tt-modal-close" onClick={requestClose} aria-label={t('common.close')}>
                        <span className="material-symbols-rounded" aria-hidden="true">close</span>
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
