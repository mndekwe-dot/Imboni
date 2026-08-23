import client from './client'

/**
 * The school's name and logo. Unauthenticated on purpose — the sign-in screen
 * needs to show whose school it is before anyone has signed in.
 *
 * The backend returns exactly two fields and has a test keeping it that way;
 * do not start reading operational settings from here.
 */
export const getSchoolBranding = () => client.get('/imboni/dos/branding/')
