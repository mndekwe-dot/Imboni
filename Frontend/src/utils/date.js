export function formatSchoolDate(timezone = 'Africa/Kigali'){
    return new Date().toLocaleDateString('en-us',{
        timeZone:timezone,
        weekday:'long',
        year:'numeric',
        month:'long',
        day:'2-digit',
    })
}