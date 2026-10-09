/*
 * Reading a picked picture into the page, safely.
 *
 * Question and exam-paper pictures are stored inside the JSON the page saves
 * (a data URI), so a paper prints the same wherever it is opened. That makes the
 * picture part of the request body, and an unchecked one is how a phone photo of
 * several MB made saving a paper fail outright, with nothing on screen to say
 * why. This checks the type and the size BEFORE the file is read, and turns
 * every refusal into something the caller can show.
 */

export const MAX_IMAGE_MB = 1

// SVG is left out on purpose: it can carry script, and nothing here needs it.
const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export class ImageError extends Error {
    constructor(kind) {
        super(kind)
        this.kind = kind
    }
}

/** Resolves to a data URI, or rejects with an ImageError of kind
 *  'notSupported' | 'tooLarge' | 'readFailed'. */
export function readImageAsDataUrl(file, { maxMB = MAX_IMAGE_MB } = {}) {
    return new Promise((resolve, reject) => {
        if (!file || !ALLOWED.includes(file.type)) return reject(new ImageError('notSupported'))
        if (file.size > maxMB * 1024 * 1024) return reject(new ImageError('tooLarge'))

        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new ImageError('readFailed'))
        reader.readAsDataURL(file)
    })
}

/** The sentence to show for a failed pick, in the user's language. */
export function imageErrorText(err, t, maxMB = MAX_IMAGE_MB) {
    if (err?.kind === 'tooLarge') return t('common.imageTooLarge', { max: maxMB })
    if (err?.kind === 'notSupported') return t('common.imageNotSupported')
    return t('common.imageReadFailed')
}
