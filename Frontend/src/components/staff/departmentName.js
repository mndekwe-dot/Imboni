// The departments a school starts with, as the server seeds them. A built-in
// department still carrying its seeded name is translated; one the school has
// renamed, or added, is shown as the school wrote it.
const SEEDED = {
    academic: 'Academic', administration: 'Administration', finance: 'Finance',
    boarding: 'Boarding & welfare', discipline: 'Discipline', library: 'Library',
    health: 'Health', kitchen: 'Kitchen & catering', security: 'Security',
    maintenance: 'Maintenance & grounds', cleaning: 'Cleaning', transport: 'Transport',
}

export function departmentName(t, code, name) {
    if (!name) return ''
    return SEEDED[code] === name ? t(`staff.departments.${code}`, { defaultValue: name }) : name
}
