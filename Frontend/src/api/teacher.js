import client from './client'

// Dashboard
export const getTeacherDashboardStats   = ()       => client.get('/imboni/teacher/dashboard/stats/')
export const getTeacherTodaySchedule    = ()       => client.get('/imboni/teacher/my-timetable/today/')
export const getTeacherTimetable        = ()       => client.get('/imboni/teacher/my-timetable/')
export const getClassTimetable          = classId  => client.get('/imboni/dos/timetable/', { params: { class_id: classId } })
export const getTeacherClassPerformance = ()       => client.get('/imboni/teacher/class-performance/')
export const getTeacherRecentActivities = (params) => client.get('/imboni/teacher/recent-activities/', { params })

// Tasks
export const getTeacherTasks   = ()      => client.get('/imboni/teacher/tasks/')
export const createTeacherTask = d       => client.post('/imboni/teacher/tasks/', d)
export const updateTeacherTask = (id, d) => client.patch(`/imboni/teacher/tasks/${id}/`, d)
export const deleteTeacherTask = id      => client.delete(`/imboni/teacher/tasks/${id}/`)

// Classes + Students
export const getTeacherMyClasses = (params) => client.get('/imboni/teacher/my-classes/', { params })
export const getTeacherStudents  = (params) => client.get('/imboni/teacher/students/', { params })

// Attendance
export const getTeacherAttendanceStats    = (params) => client.get('/imboni/teacher/attendance/stats/', { params })
export const getTeacherAttendanceStudents = (params) => client.get('/imboni/teacher/attendance/students/', { params })
export const markTeacherAttendance        = d        => client.post('/imboni/teacher/attendance/mark/', d)

// Results
export const getTeacherResultList = (params) => client.get('/imboni/teacher/results/list/', { params })
export const bulkSaveResults      = d        => client.post('/imboni/teacher/results/bulk-save/', d)

// Announcements
export const getTeacherAnnouncements        = (params) => client.get('/imboni/announcements/teacher/', { params })
export const createTeacherAnnouncement      = d        => client.post('/imboni/announcements/teacher/', d)
export const updateTeacherAnnouncement      = (id, d)  => client.patch(`/imboni/announcements/teacher/${id}/`, d)
export const deleteTeacherAnnouncement      = id       => client.delete(`/imboni/announcements/teacher/${id}/`)
export const getTeacherAudienceOptions      = ()       => client.get('/imboni/announcements/teacher/audience-options/')

// Messages (no backend yet)
export const getTeacherMessages = () => client.get('/imboni/teacher/messages/')
export const sendTeacherMessage = d  => client.post('/imboni/teacher/messages/', d)

// Subjects (for assignment / mark-entry form dropdowns)
export const getTeacherSubjects = () => client.get('/imboni/teacher/subjects/')

// Assignments
export const getTeacherAssignments    = (params)   => client.get('/imboni/teacher/assignments/', { params })
export const createTeacherAssignment  = d           => client.post('/imboni/teacher/assignments/', d)
export const updateTeacherAssignment  = (id, d)    => client.patch(`/imboni/teacher/assignments/${id}/`, d)
export const deleteTeacherAssignment  = id          => client.delete(`/imboni/teacher/assignments/${id}/`)
export const getAssignmentSubmissions = id          => client.get(`/imboni/teacher/assignments/${id}/submissions/`)
export const getAssignmentGradeSheet  = id            => client.get(`/imboni/teacher/assignments/${id}/grade/`)
export const saveAssignmentGrades     = (id, records) => client.post(`/imboni/teacher/assignments/${id}/grade/`, { records })

// Question Bank
export const getQuestionBank    = (params)  => client.get('/imboni/teacher/question-bank/', { params })
export const saveToQuestionBank = d          => client.post('/imboni/teacher/question-bank/', d)
export const deleteFromQuestionBank = id     => client.delete(`/imboni/teacher/question-bank/${id}/`)

// Student-facing quiz (also used by student portal)
export const getStudentQuizzes  = ()        => client.get('/imboni/quiz/')
export const getQuizForStudent  = id        => client.get(`/imboni/quiz/${id}/`)
export const submitQuizAnswers  = (id, d)   => client.post(`/imboni/quiz/${id}/submit/`, d)
export const getQuizReview      = id        => client.get(`/imboni/quiz/${id}/review/`)
