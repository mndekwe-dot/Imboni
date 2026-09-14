/**
 * The app's one font, for documents printed from a separate window or iframe.
 *
 * A print sheet is a brand-new document: none of index.css reaches it, so the
 * `@font-face` for Inter is not there either. Naming "Inter" in its CSS was
 * therefore a wish, not a font — every sheet actually printed in Segoe UI or
 * Arial, and the DOS exam schedule asked for Arial outright. This declares the
 * same self-hosted file the app uses, by absolute URL, because a document
 * written into `about:blank` does not resolve `/fonts/...` reliably.
 */

export const PRINT_FONT_STACK = '"Inter", "Segoe UI", system-ui, sans-serif'

export function printFontFace(origin = window.location.origin) {
    return `@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 100 900;
  src: url('${origin}/fonts/inter-latin.woff2') format('woff2');
}`
}

/**
 * Print once the font has actually loaded.
 *
 * `load` does not wait for web fonts — they are fetched when text is first laid
 * out — so printing straight from `onload` can capture the fallback face.
 * `document.fonts` is missing only in very old engines; print regardless there.
 */
export function printWhenFontsReady(win) {
    const ready = win.document?.fonts?.ready ?? Promise.resolve()
    return ready.then(() => {
        win.focus?.()
        win.print()
    })
}
