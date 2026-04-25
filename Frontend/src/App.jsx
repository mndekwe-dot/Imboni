import { Routes, Route } from 'react-router';
import { LandingPage } from './pages/LandingPage';
import { LogIn } from './pages/login';
import { StudentDashboard } from './pages/Student/StudentDashboard';
import { StudentResults } from './pages/Student/StudentResults';
import { StudentAttendance } from './pages/Student/StudentAttendance';
import { StudentTimetable } from './pages/Student/StudentTimetable';
import { StudentAssignments } from './pages/Student/StudentAssignments';
import { StudentActivities } from './pages/Student/StudentActivities';
import { StudentAnnouncements } from './pages/Student/StudentAnnouncements';
import { StudentMessages } from './pages/Student/StudentMessages';
import { TeacherDashboard } from './pages/Teacher/TeacherDashboard';
import { TeacherClasses } from './pages/Teacher/TeacherClasses';
import { TeacherAttendance } from './pages/Teacher/TeacherAttendance';
import { TeacherMessages } from './pages/Teacher/TeacherMessages';
import { TeacherAnnouncement } from './pages/Teacher/TeacherAnnouncement';
import { ParentDashboard } from './pages/Parent/ParentDashboard';
import { ParentChildren } from './pages/Parent/ParentChildren';
import { ParentResults } from './pages/Parent/ParentResults';
import { ParentAttendance } from './pages/Parent/ParentAttendance';
import { ParentBehaviour } from './pages/Parent/ParentBehaviour';
import { ParentAnnouncements } from './pages/Parent/ParentAnnouncements';
import { ParentMessages } from './pages/Parent/ParentMessages';
import { DisDashboard } from './pages/Dis/DisDashboard';
import { DisActivities } from './pages/Dis/DisActivities';
import { DisReports } from './pages/Dis/DisReports';
import { DisStudents } from './pages/Dis/DisStudents';
import { DisStudentLife } from './pages/Dis/DisStudentLife';
import { DisBoarding } from './pages/Dis/DisBoarding';
import { DisDining } from './pages/Dis/DisDining';
import { DisMessages } from './pages/Dis/DisMessages';
import { DisStaff } from './pages/Dis/DisStaff';
import { DisStudentLeaders } from './pages/Dis/DisStudentLeaders';
import { DisTimetable } from './pages/Dis/DisTimetable';
import { DisAnnouncements } from './pages/Dis/DisAnnouncements';
import { DosDashboard } from './pages/Dos/DosDashboard';
import { DosStudents } from './pages/Dos/DosStudents';
import { DosTeachers } from './pages/Dos/DosTeachers';
import { DosResults } from './pages/Dos/DosResults';
import { DosScheduling } from './pages/Dos/DosScheduling';
import { DosAttendance } from './pages/Dos/DosAttendance';
import { DosTimetable } from './pages/Dos/DosTimetable';
import { DosExamSchedule } from './pages/Dos/DosExamSchedule';
import { DosAnalytics } from './pages/Dos/DosAnalytics';
import { DosStudentLeaders } from './pages/Dos/DosStudentLeaders';
import { DosAnnouncement } from './pages/Dos/DosAnnouncement';
import { DosMessages } from './pages/Dos/DosMessages';
import {MatronDashboard} from './pages/Matron/MatronDashboard';
import {MatronHealth} from './pages/Matron/MatronHealth';
import {MatronIncidents} from './pages/Matron/MatronIncidents';
import {MatronMessages} from './pages/Matron/MatronMessages';
import {MatronStudents} from './pages/Matron/MatronStudents';
import {MatronParentComms} from './pages/Matron/MatronParentComms';
import {MatronSchedule} from './pages/Matron/MatronSchedule';
import { StudentDiscipline } from './pages/Student/StudentDiscipline';
import { TeacherAssignments } from './pages/Teacher/TeacherAssignments';
import { TeacherTimetable } from './pages/Teacher/TeacherTimetable';
import { Account } from './pages/Account';
import { DosSettings } from './pages/Dos/DosSettings';
import { AdminDashboard } from './pages/Admin/AdminDashboard';
import { AdminStaff } from './pages/Admin/AdminStaff';
import { AdminStudents } from './pages/Admin/AdminStudents';
import { AdminFinance } from './pages/Admin/AdminFinance';
import { AdminReports } from './pages/Admin/AdminReports';
import { AdminAnnouncements } from './pages/Admin/AdminAnnouncements';
import { AdminMessages } from './pages/Admin/AdminMessages';
import { AdminSettings } from './pages/Admin/AdminSettings';



function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LogIn />} />
      {/* ── Student routes ── */}
      <Route path="/student" element={<StudentDashboard />} />
      <Route path="/student/results" element={<StudentResults />} />
      <Route path="/student/attendance" element={<StudentAttendance />} />
      <Route path="/student/timetable" element={<StudentTimetable />} />
      <Route path="/student/assignments" element={<StudentAssignments />} />
      <Route path="/student/activities" element={<StudentActivities />} />
      <Route path="/student/announcements" element={<StudentAnnouncements />} />
      <Route path="/student/messages" element={<StudentMessages />} />
      {/* ── Teacher routes ── */}
      <Route path="/teacher" element={<TeacherDashboard />} />
      <Route path="/teacher/classes" element={<TeacherClasses />} />
      <Route path="/teacher/attendance" element={<TeacherAttendance />} />
      <Route path="/teacher/announcements" element={<TeacherAnnouncement />} />
      <Route path="/teacher/messages" element={<TeacherMessages />} />
      {/* ── Parent routes ── */}
      <Route path="/parent" element={<ParentDashboard />} />
      <Route path="/parent/children" element={<ParentChildren />} />
      <Route path="/parent/results" element={<ParentResults />} />
      <Route path="/parent/attendance" element={<ParentAttendance />} />
      <Route path="/parent/behaviour" element={<ParentBehaviour />} />
      <Route path="/parent/announcements" element={<ParentAnnouncements />} />
      <Route path="/parent/messages" element={<ParentMessages />} />
      {/* ── Discipline routes ── */}
      <Route path="/discipline" element={<DisDashboard />} />
      <Route path="/discipline/students" element={<DisStudents />} />
      <Route path="/discipline/student-life" element={<DisStudentLife />} />
      <Route path="/discipline/boarding" element={<DisBoarding />} />
      <Route path="/discipline/staff" element={<DisStaff />} />
      <Route path="/discipline/announcements" element={<DisAnnouncements />} />
      <Route path="/discipline/messages" element={<DisMessages />} />
      <Route path="/discipline/timetable" element={<DisTimetable />} />
      {/* legacy routes kept for compatibility */}
      <Route path="/discipline/activities" element={<DisActivities />} />
      <Route path="/discipline/reports" element={<DisReports />} />
      <Route path="/discipline/dining" element={<DisDining />} />
      <Route path="/discipline/leaders" element={<DisStudentLeaders />} />
      {/* ── DOS routes ── */}
      <Route path="/dos" element={<DosDashboard />} />
      <Route path="/dos/results" element={<DosResults />} />
      <Route path="/dos/teachers" element={<DosTeachers />} />
      <Route path="/dos/students" element={<DosStudents />} />
      <Route path="/dos/attendance" element={<DosAttendance />} />
      <Route path="/dos/scheduling" element={<DosScheduling />} />
      <Route path="/dos/announcements" element={<DosAnnouncement />} />
      <Route path="/dos/messages" element={<DosMessages />} />
      <Route path="/dos/leaders" element={<DosStudentLeaders />} />
      <Route path="/dos/settings" element={<DosSettings />} />
      {/* legacy routes kept for compatibility */}
      <Route path="/dos/timetable" element={<DosTimetable />} />
      <Route path="/dos/exams" element={<DosExamSchedule />} />
      <Route path="/dos/analytics" element={<DosAnalytics />} />
      {/* ── Matron routes ── */}
      <Route path="/matron" element={<MatronDashboard />} />
      <Route path="/matron/health" element={<MatronHealth />} />
      <Route path="/matron/incidents" element={<MatronIncidents />} />
      <Route path="/matron/messages" element={<MatronMessages />} />
      <Route path="/matron/students" element={<MatronStudents />} />
      <Route path="/matron/parent-communication" element={<MatronParentComms />} />
      <Route path="/matron/schedule" element={<MatronSchedule />} />
      {/* ── Admin routes ── */}
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/staff" element={<AdminStaff />} />
      <Route path="/admin/students" element={<AdminStudents />} />
      <Route path="/admin/finance" element={<AdminFinance />} />
      <Route path="/admin/reports" element={<AdminReports />} />
      <Route path="/admin/announcements" element={<AdminAnnouncements />} />
      <Route path="/admin/messages" element={<AdminMessages />} />
      <Route path="/admin/settings" element={<AdminSettings />} />
      {/* ── Shared routes ── */}
      <Route path="/profile" element={<Account />} />
      {/* ── Student extra routes ── */}
      <Route path="/student/discipline" element={<StudentDiscipline />} />
      {/* ── Teacher extra routes ── */}
      <Route path="/teacher/assignments" element={<TeacherAssignments />} />
      <Route path="/teacher/timetable" element={<TeacherTimetable />} />
    </Routes>
  )
}

export default App
