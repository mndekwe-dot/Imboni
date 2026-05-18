import client from "./client";

//  Dashboard 
export const getDosDashboardStats = () => client.get("/imboni/dos/dashboard/stats/");
export const getDosRecentActivity = () => client.get("/imboni/dos/dashboard/recent-activity/");
export const getDosPerformanceByGrade = () => client.get("/imboni/dos/dashboard/performance-by-grade/");

//  Students 
export const getDosStudents = (params) => client.get("/imboni/dos/students/", { params });
export const getDosStudentStats = () => client.get("/imboni/dos/students/stats/");
export const createDosStudent = (data) => client.post("/imboni/dos/students/", data);

//  Teachers 
export const getDosTeachers = (params) => client.get("/imboni/dos/teachers/", { params });
export const getDosTeacherStats = () => client.get("/imboni/dos/teachers/stats/");
export const createDosTeacher = (data) => client.post("/imboni/dos/teachers/", data);
export const updateDosTeacher = (id, data) => client.patch(`/imboni/dos/teachers/${id}/`, data);

//  Results 
export const getDosResults = (params) => client.get("/imboni/dos/results/", { params });
export const approveResult = (id) => client.patch(`/imboni/dos/results/${id}/approve/`);
export const rejectResult = (id, reason) => client.patch(`/imboni/dos/results/${id}/reject/`, { reason });

//  Exam Schedule 
export const getDosExamSchedule = () => client.get("/imboni/dos/exam-schedule/");
export const createDosExamSchedule = (data) => client.post("/imboni/dos/exam-schedule/", data);
export const deleteDosExamSchedule = (id) =>  client.delete(`/imboni/dos/exam-schedule/${id}/`);

//  Student Leaders 
export const getDosStudentLeaders = () => client.get("/imboni/dos/student-leaders/");

//  Academic Terms 
export const getTerms = () => client.get("/imboni/results/terms/");
export const getCurrentTerm = () => client.get("/imboni/results/terms/current/");

//  School Config 
export const getSchoolConfig = () => client.get("/imboni/dos/school-config/");
export const updateSchoolConfig = (data) => client.put("/imboni/dos/school-config/", data);

// school Setting
export const getSchoolSettings    = () => client.get('/imboni/dos/school-settings/')
export const updateSchoolSettings = (data) => client.patch('/imboni/dos/school-settings/', data)