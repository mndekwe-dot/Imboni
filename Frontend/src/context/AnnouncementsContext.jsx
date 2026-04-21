import { createContext, useContext, useState } from 'react'

const initialAnnouncements = [
    { id: 'a1',  source: 'teacher', audience: 'students', type: 'urgent',     icon: 'priority_high',    title: 'Exam Schedule Change — Physics Exam Moved to Mar 14',     date: 'Mar 8, 2026 · 3:45 PM',   body: 'The Physics Examination originally scheduled for March 12 has been moved to March 14, 2026. All students must confirm receipt with Ms. Uwera. Venue remains Room 302.',       author: 'Ms. Uwera (Physics)',                   isUnread: true  },
    { id: 'a2',  source: 'dos',     audience: 'all',      type: 'school',     icon: 'school',            title: 'Term 2 Parent-Teacher Conference — March 20',             date: 'Mar 7, 2026 · 10:00 AM',  body: 'The Term 2 Parent-Teacher Conference will be held on Friday, March 20, 2026 from 8:00 AM to 4:00 PM. Parents are invited to meet with subject teachers to discuss student progress.', author: 'Dr. Ndagijimana (DOS)',                isUnread: true  },
    { id: 'a3',  source: 'teacher', audience: 'students', type: 'class',      icon: 'class',             title: 'S4A Extra Mathematics Revision — This Week',              date: 'Mar 6, 2026 · 2:00 PM',   body: 'Mr. Rurangwa will hold extra revision sessions for S4A this week — Tuesday and Thursday, 3:30–5:00 PM in Room 201. Attendance strongly encouraged for upcoming CATs.',  author: 'Mr. Rurangwa (Mathematics)',            isUnread: true  },
    { id: 'a4',  source: 'dos',     audience: 'all',      type: 'activities', icon: 'emoji_events',      title: 'Inter-School Science Competition — Registration Open',    date: 'Mar 5, 2026 · 11:30 AM',  body: 'Applications open for the Annual Inter-School Science Competition on April 5, 2026. Submit project proposals to Ms. Uwera or Mr. Bizimana by March 18. All science subjects eligible.', author: 'Dr. Ndagijimana (DOS)',           isUnread: true  },
    { id: 'a5',  source: 'teacher', audience: 'students', type: 'class',      icon: 'assignment',        title: 'English Essay Submission Reminder — Due Mar 15',          date: 'Mar 3, 2026 · 9:00 AM',   body: 'English Literature persuasive essay is due March 15. Submit via student portal or hand to Ms. Umutoni before 5:00 PM.',                                                    author: 'Ms. Umutoni (English)',                 isUnread: false },
    { id: 'a6',  source: 'admin',   audience: 'all',      type: 'school',     icon: 'local_library',     title: 'Library Extended Hours During Exam Period',               date: 'Feb 28, 2026 · 8:00 AM',  body: 'Library open until 7:00 PM from March 10–21. Students must present school ID to access after 4:30 PM.',                                                                  author: 'School Administration',                 isUnread: false },
    { id: 'a7',  source: 'dis',     audience: 'students', type: 'activities', icon: 'sports_basketball', title: 'Basketball Match vs. Groupe Scolaire Officiel — Mar 15',  date: 'Feb 25, 2026 · 4:00 PM',  body: 'Girls Basketball Team vs. Groupe Scolaire Officiel — Saturday, March 15 at 10:00 AM on Main Sports Ground. Team members report to Coach Nkurunziza by 8:30 AM.',          author: 'Coach Nkurunziza (Sports)',             isUnread: false },
    { id: 'a8',  source: 'dis',     audience: 'students', type: 'boarding',   icon: 'hotel',             title: 'Dormitory Curfew Reminder — Lights Out at 10:00 PM',      date: 'Feb 20, 2026 · 5:00 PM',  body: 'All boarders — curfew is strictly 10:00 PM, lights out 10:15 PM. Violations will result in discipline points deduction. Dormitory supervisors conduct nightly checks.',        author: 'Mr. Mutabazi (Director of Discipline)', isUnread: false },
    { id: 'a9',  source: 'admin',   audience: 'all',      type: 'school',     icon: 'music_note',        title: 'Umuco Fest — Cultural Night — March 28',                  date: 'Feb 18, 2026 · 11:00 AM', body: 'School Choir and Drama Club present Umuco Fest on Friday, March 28 at 5:00 PM in the School Auditorium. Celebrating Rwandan culture, music and arts. All students and parents welcome. Admission free.', author: 'Ms. Ingabire (Drama & Arts)', isUnread: false },
]

const AnnouncementsContext = createContext(null)

export function AnnouncementsProvider({ children }) {
    const [announcements, setAnnouncements] = useState(initialAnnouncements)

    function addAnnouncement({ title, body, category, audience, author, source }) {
        const now = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        setAnnouncements(prev => [
            {
                id:       `ann-${Date.now()}`,
                source,
                audience,
                type:     category.toLowerCase(),
                icon:     'campaign',
                title,
                body,
                author,
                date:     now,
                isUnread: true,
            },
            ...prev,
        ])
    }

    return (
        <AnnouncementsContext.Provider value={{ announcements, addAnnouncement }}>
            {children}
        </AnnouncementsContext.Provider>
    )
}

export function useAnnouncements() {
    return useContext(AnnouncementsContext)
}
