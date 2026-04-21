export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const EXTRA_SLOTS = [
    { id: 'morning',     label: 'Morning',      time: '5:30 – 7:00'  },
    { id: 'assembly',    label: 'Assembly',     time: '7:15 – 7:30'  },
    { id: 'lunch',       label: 'Lunch',        time: '1:00 – 2:00'  },
    { id: 'afterschool', label: 'After School', time: '2:00 – 4:00'  },
    { id: 'evening',     label: 'Evening',      time: '4:30 – 6:30'  },
    { id: 'dinner',      label: 'Dinner',       time: '7:00 – 8:00'  },
    { id: 'lightsout',   label: 'Lights Out',   time: '9:00 – 10:00' },
]

// Schedule data: slotId -> dayName -> cell
// Add future weeks by adding a new key e.g. '2026-W15'
export const extraSchedules = {
    'default': {
        morning: {
            Monday:    { type: 'boarding',  subject: 'Wake-up & Prep',    teacher: 'All Matrons',         room: 'Dormitories'     },
            Tuesday:   { type: 'boarding',  subject: 'Wake-up & Prep',    teacher: 'All Matrons',         room: 'Dormitories'     },
            Wednesday: { type: 'boarding',  subject: 'Wake-up & Prep',    teacher: 'All Matrons',         room: 'Dormitories'     },
            Thursday:  { type: 'boarding',  subject: 'Wake-up & Prep',    teacher: 'All Matrons',         room: 'Dormitories'     },
            Friday:    { type: 'boarding',  subject: 'Wake-up & Prep',    teacher: 'All Matrons',         room: 'Dormitories'     },
            Saturday:  { type: 'boarding',  subject: 'Wake-up & Prep',    teacher: 'All Matrons',         room: 'Dormitories'     },
            Sunday:    { type: 'empty',     label: 'Rest Day'                                                                     },
        },
        assembly: {
            Monday:    { type: 'social',    subject: 'Morning Assembly',  teacher: 'Mr. Eric Mutabazi',          room: 'Quadrangle'      },
            Tuesday:   { type: 'social',    subject: 'Morning Assembly',  teacher: 'Mr. Eric Mutabazi',          room: 'Quadrangle'      },
            Wednesday: { type: 'social',    subject: 'Morning Assembly',  teacher: 'Mr. Eric Mutabazi',          room: 'Quadrangle'      },
            Thursday:  { type: 'social',    subject: 'Morning Assembly',  teacher: 'Mr. Eric Mutabazi',          room: 'Quadrangle'      },
            Friday:    { type: 'social',    subject: 'Morning Assembly',  teacher: 'Mr. Eric Mutabazi',          room: 'Quadrangle'      },
            Saturday:  { type: 'empty',     label: '—'                                                                            },
            Sunday:    { type: 'empty',     label: '—'                                                                            },
        },
        lunch: {
            Monday:    { type: 'dining',    subject: 'Lunch Sitting',     teacher: 'Duty Staff',          room: 'Dining Hall'     },
            Tuesday:   { type: 'dining',    subject: 'Lunch Sitting',     teacher: 'Duty Staff',          room: 'Dining Hall'     },
            Wednesday: { type: 'dining',    subject: 'Lunch Sitting',     teacher: 'Duty Staff',          room: 'Dining Hall'     },
            Thursday:  { type: 'dining',    subject: 'Lunch Sitting',     teacher: 'Duty Staff',          room: 'Dining Hall'     },
            Friday:    { type: 'dining',    subject: 'Lunch Sitting',     teacher: 'Duty Staff',          room: 'Dining Hall'     },
            Saturday:  { type: 'dining',    subject: 'Lunch Sitting',     teacher: 'Duty Staff',          room: 'Dining Hall'     },
            Sunday:    { type: 'dining',    subject: 'Lunch Sitting',     teacher: 'Duty Staff',          room: 'Dining Hall'     },
        },
        afterschool: {
            Monday:    { type: 'sports',    subject: 'Football Training', teacher: 'Mr. Emmanuel Nshimiyimana',          room: 'Sports Field'    },
            Tuesday:   { type: 'academic',  subject: 'Debate Club',       teacher: 'Ms. Claudine Umutoni',           room: 'Library'         },
            Wednesday: { type: 'sports',    subject: 'Basketball',        teacher: 'Mr. Gaspard Nkurunziza',         room: 'Court'           },
            Thursday:  { type: 'academic',  subject: 'Science Club',      teacher: 'Mr. Théophile Bizimana',         room: 'Lab 2'           },
            Friday:    { type: 'arts',      subject: 'Drama Club',        teacher: 'Ms. Sylvie Ingabire',          room: 'School Hall'     },
            Saturday:  { type: 'sports',    subject: 'Athletics',         teacher: 'Mr. Emmanuel Nshimiyimana',          room: 'Track'           },
            Sunday:    { type: 'social',    subject: 'Community Service', teacher: 'Mr. Janvier Ntakirutimana',         room: 'Community Hall'  },
        },
        evening: {
            Monday:    { type: 'academic',  subject: 'Evening Prep',      teacher: 'House Staff',         room: 'Dormitories'     },
            Tuesday:   { type: 'sports',    subject: 'Football Training', teacher: 'Mr. Emmanuel Nshimiyimana',          room: 'Sports Field'    },
            Wednesday: { type: 'academic',  subject: 'Evening Prep',      teacher: 'House Staff',         room: 'Dormitories'     },
            Thursday:  { type: 'sports',    subject: 'Basketball',        teacher: 'Mr. Gaspard Nkurunziza',         room: 'Court'           },
            Friday:    { type: 'academic',  subject: 'Evening Prep',      teacher: 'House Staff',         room: 'Dormitories'     },
            Saturday:  { type: 'arts',      subject: 'Drama Rehearsal',   teacher: 'Ms. Sylvie Ingabire',          room: 'School Hall'     },
            Sunday:    { type: 'empty',     label: 'Free Time'                                                                    },
        },
        dinner: {
            Monday:    { type: 'dining',    subject: 'Dinner Sitting',    teacher: 'Duty Staff',          room: 'Dining Hall'     },
            Tuesday:   { type: 'dining',    subject: 'Dinner Sitting',    teacher: 'Duty Staff',          room: 'Dining Hall'     },
            Wednesday: { type: 'dining',    subject: 'Dinner Sitting',    teacher: 'Duty Staff',          room: 'Dining Hall'     },
            Thursday:  { type: 'dining',    subject: 'Dinner Sitting',    teacher: 'Duty Staff',          room: 'Dining Hall'     },
            Friday:    { type: 'dining',    subject: 'Dinner Sitting',    teacher: 'Duty Staff',          room: 'Dining Hall'     },
            Saturday:  { type: 'dining',    subject: 'Dinner Sitting',    teacher: 'Duty Staff',          room: 'Dining Hall'     },
            Sunday:    { type: 'dining',    subject: 'Dinner Sitting',    teacher: 'Duty Staff',          room: 'Dining Hall'     },
        },
        lightsout: {
            Monday:    { type: 'boarding',  subject: 'Curfew / Rounds',   teacher: 'All Dormitory Staff', room: 'All Dormitories' },
            Tuesday:   { type: 'boarding',  subject: 'Curfew / Rounds',   teacher: 'All Dormitory Staff', room: 'All Dormitories' },
            Wednesday: { type: 'boarding',  subject: 'Curfew / Rounds',   teacher: 'All Dormitory Staff', room: 'All Dormitories' },
            Thursday:  { type: 'boarding',  subject: 'Curfew / Rounds',   teacher: 'All Dormitory Staff', room: 'All Dormitories' },
            Friday:    { type: 'boarding',  subject: 'Curfew / Rounds',   teacher: 'All Dormitory Staff', room: 'All Dormitories' },
            Saturday:  { type: 'boarding',  subject: 'Curfew / Rounds',   teacher: 'All Dormitory Staff', room: 'All Dormitories' },
            Sunday:    { type: 'boarding',  subject: 'Curfew / Rounds',   teacher: 'All Dormitory Staff', room: 'All Dormitories' },
        },
    }
    // Add future weeks here:
    // '2026-W15': { morning: { ... }, ... }
}