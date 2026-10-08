import client from './client'

// The counts beside sidebar entries ({ messages, announcements, assignments?,
// grading? }) in one call. See NavBadgesView on the backend.
export const getNavBadges = () => client.get('/imboni/nav-badges/')
