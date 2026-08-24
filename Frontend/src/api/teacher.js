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
// One assignment, so the edit page works on a refresh or a pasted link
// rather than only when navigated to from the list.
export const getTeacherAssignment     = id         => client.get(`/imboni/teacher/assignments/${id}/`)
/**
 * An assignment may carry a worksheet, and a File cannot travel as JSON - so
 * a payload holding one is sent as multipart instead. Everything else keeps
 * going as JSON, because `questions` is a nested array that FormData would
 * flatten into unusable string keys.
 *
 * A null attachment means "clear the one that is there"; undefined means
 * "leave it alone", so the two are handled differently below.
 */
function assignmentBody(d) {
    const file = d.attachment
    if (!(file instanceof File)) {
        // Never send the string URL the API handed back - DRF would try to
        // parse it as an upload and reject it.
        const { attachment, ...rest } = d
        return attachment === null ? { ...rest, attachment: '' } : rest
    }

    const form = new FormData()
    for (const [key, value] of Object.entries(d)) {
        if (value === undefined || value === null) continue
        if (key === 'attachment') { form.append(key, value); continue }
        // Arrays and objects have to survive the trip intact.
        form.append(key, typeof value === 'object' ? JSON.stringify(value) : value)
    }
    return form
}

export const createTeacherAssignment  = d           => client.post('/imboni/teacher/assignments/', assignmentBody(d))
export const updateTeacherAssignment  = (id, d)    => client.patch(`/imboni/teacher/assignments/${id}/`, assignmentBody(d))
export const deleteTeacherAssignment  = id          => client.delete(`/imboni/teacher/assignments/${id}/`)
// Stop / resume accepting submissions. `closed` was a status the model declared
// but nothing could reach, so an assignment stayed open indefinitely.
export const closeTeacherAssignment   = id          => client.post(`/imboni/teacher/assignments/${id}/close/`)
export const reopenTeacherAssignment  = id          => client.post(`/imboni/teacher/assignments/${id}/reopen/`)
// Hand back a set of marks held until the whole class was done.
export const releaseAssignmentMarks   = id          => client.post(`/imboni/teacher/assignments/${id}/release/`)
// How the class did: average, spread, and per-question for a quiz.
export const getAssignmentStats       = id          => client.get(`/imboni/teacher/assignments/${id}/stats/`)
// One student's quiz, for checking and correcting an auto-mark.
export const getSubmissionReview      = id          => client.get(`/imboni/teacher/submissions/${id}/`)
export const overrideSubmissionMarks  = (id, d)     => client.patch(`/imboni/teacher/submissions/${id}/`, d)
export const getAssignmentSubmissions = id          => client.get(`/imboni/teacher/assignments/${id}/submissions/`)
export const getAssignmentGradeSheet  = id            => client.get(`/imboni/teacher/assignments/${id}/grade/`)
export const saveAssignmentGrades     = (id, records) => client.post(`/imboni/teacher/assignments/${id}/grade/`, { records })

// Performance trends (month-by-month class average)
export const getTeacherPerformanceTrends = (params) => client.get('/imboni/teacher/results/performance-trends/', { params })

// Question Bank
export const getQuestionBank    = (params)  => client.get('/imboni/teacher/question-bank/', { params })
export const saveToQuestionBank = d          => client.post('/imboni/teacher/question-bank/', d)
export const patchQuestionBank  = (id, d)    => client.patch(`/imboni/teacher/question-bank/${id}/`, d)
export const deleteFromQuestionBank = id     => client.delete(`/imboni/teacher/question-bank/${id}/`)

// Student-facing quiz (also used by student portal)
export const getStudentQuizzes  = ()        => client.get('/imboni/quiz/')
export const getQuizForStudent  = id        => client.get(`/imboni/quiz/${id}/`)
export const submitQuizAnswers  = (id, d)   => client.post(`/imboni/quiz/${id}/submit/`, d)
export const getQuizReview      = id        => client.get(`/imboni/quiz/${id}/review/`)

// Exam papers — written here, vetted by the DOS before they can be printed.
export const getTeacherExamPapers  = (params) => client.get('/imboni/teacher/exam-papers/', { params })
export const getTeacherExamPaper   = id       => client.get(`/imboni/teacher/exam-papers/${id}/`)
export const createTeacherExamPaper = d       => client.post('/imboni/teacher/exam-papers/', d)
export const updateTeacherExamPaper = (id, d) => client.patch(`/imboni/teacher/exam-papers/${id}/`, d)
export const deleteTeacherExamPaper = id      => client.delete(`/imboni/teacher/exam-papers/${id}/`)
export const submitTeacherExamPaper = id      => client.post(`/imboni/teacher/exam-papers/${id}/submit/`)
