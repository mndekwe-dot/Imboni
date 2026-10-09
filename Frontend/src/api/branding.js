import client from './client'
import { withTransfer } from '../utils/transfers'

/**
 * The school's name and logo. Unauthenticated on purpose — the sign-in screen
 * needs to show whose school it is before anyone has signed in.
 *
 * The backend returns exactly two fields and has a test keeping it that way;
 * do not start reading operational settings from here.
 */
export const getSchoolBranding = () => client.get('/imboni/dos/branding/')

/** Set the school's logo. `file` is a JPG or PNG under 2 MB. */
export const setSchoolLogo = file => {
    const form = new FormData()
    form.append('logo', file)
    return withTransfer({ direction: 'upload', name: file?.name }, progress =>
        client.patch('/imboni/dos/school-settings/', form, progress))
}

/** Take the logo off; the sidebar goes back to the product's own mark. */
export const removeSchoolLogo = () => {
    const form = new FormData()
    form.append('logo', '')
    return client.patch('/imboni/dos/school-settings/', form)
}
