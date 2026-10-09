import client from './client'
import { withTransfer } from '../utils/transfers'

/** The first file in a FormData, for naming the transfer in the tray. */
export function fileNameIn(body) {
    if (typeof FormData === 'undefined' || !(body instanceof FormData)) return ''
    for (const value of body.values()) if (value instanceof File) return value.name
    return ''
}

/**
 * Send a request body, showing it in the transfer tray when it carries a file.
 *
 * Several of these endpoints take JSON for a plain form and multipart only when
 * a file is picked (assignments, materials, hand-ins). Only the multipart case
 * is a transfer worth showing; a small JSON save would just flash in and out.
 */
export function sendBody(method, url, body, config) {
    if (typeof FormData !== 'undefined' && body instanceof FormData && fileNameIn(body)) {
        return withTransfer({ direction: 'upload', name: fileNameIn(body) },
            progress => client[method](url, body, { ...config, ...progress }))
    }
    // Called exactly as before when there is no file: same arguments, nothing
    // extra, so a plain save is untouched by the transfer tray.
    return config === undefined ? client[method](url, body) : client[method](url, body, config)
}
