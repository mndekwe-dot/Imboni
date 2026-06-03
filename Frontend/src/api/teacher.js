import client from './client'

// Dashboard
export const getTeacherDashboardStats   = ()       => client.get('/imboni/teacher/dashboard/stats/')
export const getTeacherTodaySchedule    = ()       => client.get('/imboni/teacher/my-timetable/today/')
export const getTeacherClassPerformance = ()       => client.get('/imboni/teacher/class-performance/')
export const getTeacherRecentActivities = ()       => client.get('/imboni/teacher/recent-activities/')

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
export const getTeacherAnnouncements   = (params) => client.get('/imboni/announcements/teacher/', { params })
export const createTeacherAnnouncement = d        => client.post('/imboni/announcements/teacher/', d)

// Messages (no backend yet)
export const getTeacherMessages = () => client.get('/imboni/teacher/messages/')
export const sendTeacherMessage = d  => client.post('/imboni/teacher/messages/', d)
