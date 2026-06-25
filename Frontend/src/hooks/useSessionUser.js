// Derives the logged-in user's display name/role/initials/avatar from the real
// session (localStorage 'imboni_user', set at login) instead of hardcoded fake data.
const ROLE_DISPLAY = {
    dos:        { label: 'Director of Studies',    avatarClass: 'dos-av' },
    admin:      { label: 'School Principal',       avatarClass: 'admin-av' },
    discipline: { label: 'Director of Discipline', avatarClass: 'discipline-av' },
    matron:     { label: 'Matron',                 avatarClass: 'matron-av' },
    parent:     { label: 'Parent',                 avatarClass: 'parent-av' },
    student:    { label: 'Student',                avatarClass: 'student-av' },
    teacher:    { label: 'Teacher',                avatarClass: 'teacher-av' },
}

export function useSessionUser() {
    const stored = JSON.parse(localStorage.getItem('imboni_user') || '{}')
    const firstName = stored.first_name || ''
    const lastName = stored.last_name || ''
    const display = ROLE_DISPLAY[stored.role] || { label: stored.role || 'User', avatarClass: '' }

    return {
        userName: stored.full_name || `${firstName} ${lastName}`.trim() || display.label,
        userRole: display.label,
        userInitials: `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || display.label[0] || 'U',
        avatarClass: display.avatarClass,
    }
}
