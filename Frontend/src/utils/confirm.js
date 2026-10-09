import i18n from '../i18n'

/**
 * Ask before something that cannot be undone, in the app's own dialog.
 *
 * Replaces `window.confirm`, which is unstyled, untranslatable beyond the
 * message, and looks different in every browser. Resolves true on confirm and
 * false on Cancel, Escape or a click outside. Built on a native <dialog>, so
 * focus is trapped, the page behind is inert and focus returns to where it was.
 *
 *   if (!(await confirmDialog(t('x.deleteConfirm'), { danger: true }))) return
 */
export function confirmDialog(message, { confirmLabel, danger = false } = {}) {
    return new Promise(resolve => {
        const t = i18n.t.bind(i18n)
        const opener = document.activeElement
        const dialog = document.createElement('dialog')
        dialog.className = 'tt-modal confirm-dialog'
        dialog.setAttribute('aria-label', message)

        const inner = document.createElement('div')
        inner.className = 'tt-modal-inner'
        const body = document.createElement('div')
        body.className = 'tt-modal-body'
        const text = document.createElement('p')
        text.className = 'confirm-dialog-text'
        text.textContent = message
        body.append(text)

        const footer = document.createElement('div')
        footer.className = 'tt-modal-footer'
        const cancel = document.createElement('button')
        cancel.type = 'button'
        cancel.className = 'btn btn-outline'
        cancel.textContent = t('common.cancel')
        const ok = document.createElement('button')
        ok.type = 'button'
        ok.className = `btn ${danger ? 'btn-destructive' : 'btn-primary'}`
        ok.textContent = confirmLabel || t('common.confirm')
        footer.append(cancel, ok)
        inner.append(body, footer)
        dialog.append(inner)

        let answer = false
        const finish = value => { answer = value; dialog.close() }
        cancel.addEventListener('click', () => finish(false))
        ok.addEventListener('click', () => finish(true))
        dialog.addEventListener('click', e => { if (e.target === dialog) finish(false) })
        dialog.addEventListener('close', () => {
            dialog.remove()
            if (opener && typeof opener.focus === 'function') opener.focus()
            resolve(answer)
        })

        document.body.append(dialog)
        dialog.showModal()
        // The safe choice gets focus: Enter must not delete by accident.
        cancel.focus()
    })
}
