import client from "./client";

//  Dashboard 
export const getDosDashboardStats = () => client.get("/imboni/dos/dashboard/stats/");
export const getDosRecentActivity  = (params) => client.get('/imboni/dos/dashboard/recent-activity/', { params })
export const getDosWeeklyTrend     = ()       => client.get('/imboni/dos/dashboard/weekly-trend/')
export const getDosPerformanceByGrade = () => client.get("/imboni/dos/dashboard/performance-by-grade/");

//  Students 
export const getDosStudents = (params) => client.get("/imboni/dos/students/", { params });
export const getDosStudentStats = () => client.get("/imboni/dos/students/stats/");
export const createDosStudent = (data) => client.post("/imboni/dos/students/", data);

//  Teachers 
export const getDosTeachers = (params) => client.get("/imboni/dos/teachers/", { params });
export const getDosTeacherStats = () => client.get("/imboni/dos/teachers/stats/");
export const updateDosTeacher = (id, data) => client.patch(`/imboni/dos/teachers/${id}/`, data);
export const getDosTeacherClasses = (id) => client.get(`/imboni/dos/teachers/${id}/classes/`)
export const assignDosTeacherClasses = (id, classes) => client.patch(`/imboni/dos/teachers/${id}/classes/`, { classes })

//  Results 
export const getDosResults = (params) => client.get("/imboni/dos/results/", { params });
export const approveResult = (id) => client.patch(`/imboni/dos/results/${id}/approve/`);
export const rejectResult = (id, reason) => client.patch(`/imboni/dos/results/${id}/reject/`, { reason });

//  Exam Schedule 
export const getDosExamSchedule    = ()         => client.get('/imboni/dos/exam-schedule/')
export const createDosExamSchedule = (data)     => client.post('/imboni/dos/exam-schedule/', data)
export const updateDosExamSchedule = (id, data) => client.patch(`/imboni/dos/exam-schedule/${id}/`, data)
export const deleteDosExamSchedule = (id)       => client.delete(`/imboni/dos/exam-schedule/${id}/`)
// Auto-generator: preview (no persist) then commit.
export const generateDosExamSchedule       = (data) => client.post('/imboni/dos/exam-schedule/generate/', data)
export const commitDosExamSchedule         = (data) => client.post('/imboni/dos/exam-schedule/generate/commit/', data)

//  Student Leaders 
export const getDosStudentLeaders = () => client.get("/imboni/dos/student-leaders/");

//  Academic Terms 
export const getTerms = () => client.get("/imboni/results/terms/");
export const getCurrentTerm = () => client.get("/imboni/results/terms/current/");

//  School Config 
export const getSchoolConfig = () => client.get("/imboni/dos/school-config/");
export const updateSchoolConfig = (data) => client.put("/imboni/dos/school-config/", data);

// School Settings
export const getSchoolSettings    = () => client.get('/imboni/dos/school-settings/')
export const updateSchoolSettings = (data) => client.patch('/imboni/dos/school-settings/', data)

// Subject Management
export const getSubjects            = () => client.get('/imboni/dos/subjects/')
export const createSubject          = (data) => client.post('/imboni/dos/subjects/', data)
export const updateSubject          = (id, data) => client.patch(`/imboni/dos/subjects/${id}/`, data)
export const deleteSubject          = (id) => client.delete(`/imboni/dos/subjects/${id}/`)
export const renameSubjectCategory  = (old_name, new_name) => client.post('/imboni/dos/subject-categories/rename/', { old_name, new_name })
export const deleteSubjectCategory  = (name) => client.delete('/imboni/dos/subject-categories/delete/', { data: { name } })

// Student Invites
export const inviteDosStudent     = (data) => client.post('/imboni/dos/students/invite/', data)
export const bulkInviteDosStudents = (file) => {
    const form = new FormData()
    form.append('file', file)
    return client.post('/imboni/dos/students/invite/bulk/', form)
}

// Classes
export const getDosClasses = () => client.get('/imboni/dos/classes/')

// Attendance — students
export const getDosWeeklyAttendance = (params) => client.get('/imboni/attendance/class/weekly/', { params })

// Attendance — teachers
export const getDosTeacherWeeklyAttendance = (params) => client.get('/imboni/attendance/teacher/weekly/', { params })
export const markDosTeacherAttendance      = (data)   => client.post('/imboni/attendance/teacher/mark/', data)

// Student Detail & Actions
export const getDosStudentDetail    = (id)        => client.get(`/imboni/dos/students/${id}/`)
export const suspendDosStudent      = (id, data)  => client.patch(`/imboni/dos/students/${id}/suspend/`, data)
export const changeDosStudentClass  = (id, data)  => client.patch(`/imboni/dos/students/${id}/change-class/`, data)
export const appointStudentLeader   = (id, data)  => client.post(`/imboni/dos/students/${id}/appoint-leader/`, data)
export const removeStudentLeader    = (id, role)  => client.delete(`/imboni/dos/students/${id}/remove-leader/${role}/`)

// Timetable
export const getDosRooms     = ()           => client.get('/imboni/dos/rooms/')
export const createDosRoom   = (name)       => client.post('/imboni/dos/rooms/', { name })
export const deleteDosRoom   = (id)         => client.delete(`/imboni/dos/rooms/${id}/`)
export const getDosTimetable = (classId) => client.get('/imboni/dos/timetable/',{params :{class_id : classId}})
export const saveDosSlot = (data) => client.post('/imboni/dos/timetable/',data)
export const updateDosSlot = (id,data) => client.patch(`/imboni/dos/timetable/${id}/`,data)
export const deleteDosSlot = (id) => client.delete(`/imboni/dos/timetable/${id}/`)
export const getDosTeachersBySubjectAndClass = (subjectId,classId)=>client.get('/imboni/dos/teachers/',{params:{subject_id:subjectId,class_id:classId}})
// Auto-generator: preview (no persist) then commit the weekly timetable.
export const generateDosTimetable = (data) => client.post('/imboni/dos/timetable/generate/', data)
export const commitDosTimetable   = (data) => client.post('/imboni/dos/timetable/generate/commit/', data)

// Report cards (PDF / ZIP downloads)
export const downloadStudentReportCard = (id, termId) =>
    client.get(`/imboni/dos/reports/student/${id}/`, {
        params: termId ? { term_id: termId } : {},
        responseType: 'blob',
    })
export const downloadClassReportCards = (classId, termId) =>
    client.get(`/imboni/dos/reports/class/${classId}/`, {
        params: termId ? { term_id: termId } : {},
        responseType: 'blob',
    })

// Analytics
export const getDosAnalytics        = (params)     => client.get('/imboni/dos/analytics/', { params })
export const getAtRiskStudents      = (params)     => client.get('/imboni/analytics/performance/at-risk/', { params })
export const getChronicAbsence      = (params)     => client.get('/imboni/analytics/attendance/chronic-absence/', { params })
export const getDosAttendanceStats  = ()           => client.get('/imboni/dos/attendance/overview/')

// Announcements
export const getDosAnnouncements    = (params)     => client.get('/imboni/dos/announcements/', { params })
export const createDosAnnouncement  = (data)       => client.post('/imboni/dos/announcements/', data)
export const updateDosAnnouncement  = (id, data)   => client.patch(`/imboni/dos/announcements/${id}/`, data)
export const deleteDosAnnouncement  = (id)         => client.delete(`/imboni/dos/announcements/${id}/`)

// Tasks
export const getDosTasks    = ()      => client.get('/imboni/tasks/')
export const createDosTask  = d       => client.post('/imboni/tasks/', d)
export const updateDosTask  = (id, d) => client.patch(`/imboni/tasks/${id}/`, d)
export const deleteDosTask  = id      => client.delete(`/imboni/tasks/${id}/`)

// Activity (Club) Management
export const getDosActivities   = ()           => client.get('/imboni/dos/activities/')
export const patchDosActivity   = (id, data)   => client.patch(`/imboni/dos/activities/${id}/`, data)
export const deleteDosActivity  = (id)         => client.delete(`/imboni/dos/activities/${id}/`)
