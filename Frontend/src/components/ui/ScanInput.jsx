import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * One box for scanning barcodes, wherever a barcode gets scanned.
 *
 * The typing path is the primary one, not the fallback. A USB or Bluetooth
 * barcode scanner presents itself as a KEYBOARD: it types the digits into
 * whatever has focus and presses Enter. That is what a school actually buys --
 * they cost a few thousand francs, they work on any machine, they need no
 * driver and no permission prompt -- so a plain focused <input> in a <form>
 * already is a scanner interface, and the whole job here is keeping focus in
 * the box between scans. The next book is already in the person's hand.
 *
 * The camera is the enhancement, for a phone at the shelves with no scanner
 * plugged into it. It uses the browser's own BarcodeDetector where that
 * exists, and where it does not the button simply is not rendered -- rather
 * than loading a decoder library to make one button work on Safari.
 */
export function ScanInput({
    onScan,
    busy = false,
    label,
    placeholder,
    autoFocus = true,
    camera = true,
    children,
}) {
    const { t } = useTranslation()
    const [code, setCode] = useState('')
    const [scanning, setScanning] = useState(false)
    const [cameraError, setCameraError] = useState('')
    const inputRef = useRef(null)
    const videoRef = useRef(null)
    const streamRef = useRef(null)

    // Feature-detected once. `BarcodeDetector` is in Chrome and Android
    // browsers and absent from Firefox and Safari, so this is the difference
    // between a button that works and a button that does nothing.
    const [canUseCamera] = useState(
        () => camera && typeof window !== 'undefined' && 'BarcodeDetector' in window)

    const refocus = useCallback(() => {
        // Guarded: on a phone, focusing an input opens the on-screen keyboard
        // over the camera view, which is the opposite of helpful.
        if (!scanning) inputRef.current?.focus()
    }, [scanning])

    function submit(event) {
        event?.preventDefault()
        const value = code.trim()
        if (!value || busy) return
        setCode('')
        Promise.resolve(onScan(value)).finally(refocus)
    }

    const stopCamera = useCallback(() => {
        streamRef.current?.getTracks().forEach(track => track.stop())
        streamRef.current = null
        setScanning(false)
    }, [])

    // Whatever happens -- navigating away, closing the modal, an error -- the
    // camera light goes out. A page that leaves the camera running after the
    // librarian has moved on is the kind of thing that gets an app banned from
    // a school.
    useEffect(() => stopCamera, [stopCamera])

    async function startCamera() {
        setCameraError('')
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' },
            })
            streamRef.current = stream
            setScanning(true)
            // The <video> only exists once `scanning` is true, so the stream is
            // attached on the next frame rather than to a null ref.
            requestAnimationFrame(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream
                    videoRef.current.play?.().catch(() => {})
                }
            })
        } catch {
            setCameraError(t('library.scan.cameraDenied'))
        }
    }

    useEffect(() => {
        if (!scanning) return undefined
        const Detector = window.BarcodeDetector
        const detector = new Detector({
            // An ISBN is EAN-13; the school's own labels are Code 128; QR is
            // there because some books now carry one and phones read it.
            formats: ['ean_13', 'ean_8', 'code_128', 'qr_code'],
        })
        let alive = true

        const tick = async () => {
            if (!alive || !videoRef.current) return
            try {
                const found = await detector.detect(videoRef.current)
                if (found.length && found[0].rawValue) {
                    const value = found[0].rawValue
                    stopCamera()
                    Promise.resolve(onScan(value)).finally(refocus)
                    return
                }
            } catch {
                // A frame that cannot be decoded is the normal case, not an
                // error: the camera is pointed at a shelf most of the time.
            }
            if (alive) setTimeout(tick, 250)
        }
        const started = setTimeout(tick, 400)
        return () => { alive = false; clearTimeout(started) }
    }, [scanning, onScan, refocus, stopCamera])

    return (
        <div className="scan-box">
            <form onSubmit={submit} className="toolbar-card">
                <input
                    ref={inputRef}
                    className="form-input scan-field"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    placeholder={placeholder ?? t('library.scan.placeholder')}
                    aria-label={label ?? t('library.scan.label')}
                    autoFocus={autoFocus}
                    autoComplete="off"
                    // A scanner sends its digits fast and a phone would offer
                    // to autocorrect them; both are off.
                    autoCorrect="off"
                    spellCheck={false}
                    disabled={busy}
                />
                <button type="submit" className="btn btn-primary btn-sm"
                    disabled={busy || !code.trim()}>
                    <span className="material-symbols-rounded" aria-hidden="true">barcode_scanner</span>
                    {t('library.scan.submit')}
                </button>
                {canUseCamera && !scanning && (
                    <button type="button" className="btn btn-outline btn-sm" onClick={startCamera}>
                        <span className="material-symbols-rounded" aria-hidden="true">photo_camera</span>
                        {t('library.scan.useCamera')}
                    </button>
                )}
                {scanning && (
                    <button type="button" className="btn btn-outline btn-sm" onClick={stopCamera}>
                        <span className="material-symbols-rounded" aria-hidden="true">stop_circle</span>
                        {t('library.scan.stopCamera')}
                    </button>
                )}
                {children}
            </form>

            {scanning && (
                <div className="scan-viewfinder">
                    <video ref={videoRef} muted playsInline />
                    <p className="u-muted u-sm">{t('library.scan.pointAtBarcode')}</p>
                </div>
            )}
            {cameraError && <p className="u-muted u-sm">{cameraError}</p>}
        </div>
    )
}
