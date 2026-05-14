import { Routes, Route } from 'react-router';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { LogIn } from './pages/login';
import { PortalLogin } from './pages/PortalLogin';
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
import { TeacherResults } from './pages/Teacher/TeacherResults';
import { TeacherStudent } from './pages/Teacher/TeacherStudents';
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

      {/* ── Portal-specific login pages ── */}
      <Route path="/login/student" element={
        <PortalLogin portal="student" label="Student Portal"
          subtitle="Access your results, timetable, assignments and activities"
          icon="school" accentColor="#0891b2"
          placeholder="student@imboni.rw" redirectTo="/student" />
      } />
      <Route path="/login/teacher" element={
        <PortalLogin portal="teacher" label="Teacher Portal"
          subtitle="Manage your classes, mark attendance and enter results"
          icon="cast_for_education" accentColor="#7c3aed"
          placeholder="teacher@imboni.rw" redirectTo="/teacher" />
      } />
      <Route path="/login/parent" element={
        <PortalLogin portal="parent" label="Parent Portal"
          subtitle="Monitor your child's academic progress and school life"
          icon="family_restroom" accentColor="#f97316"
          placeholder="parent@gmail.com" redirectTo="/parent" />
      } />
      <Route path="/login/dos" element={
        <PortalLogin portal="dos" label="Director of Studies"
          subtitle="Academic oversight, scheduling, results approval and analytics"
          icon="analytics" accentColor="#003d7a"
          placeholder="dos@imboni.rw" redirectTo="/dos" />
      } />
      <Route path="/login/discipline" element={
        <PortalLogin portal="discipline" label="Discipline Portal"
          subtitle="Student behaviour, boarding management and activities"
          icon="shield_person" accentColor="#dc2626"
          placeholder="discipline@imboni.rw" redirectTo="/discipline" />
      } />
      <Route path="/login/matron" element={
        <PortalLogin portal="matron" label="Matron Portal"
          subtitle="Student health, welfare and dormitory management"
          icon="health_and_safety" accentColor="#be185d"
          placeholder="matron@imboni.rw" redirectTo="/matron" />
      } />
      <Route path="/login/admin" element={
        <PortalLogin portal="admin" label="Administration"
          subtitle="School administration, staff management and system settings"
          icon="admin_panel_settings" accentColor="#4f46e5"
          placeholder="admin@imboni.rw" redirectTo="/admin" />
      } />
      {/* ── Student routes ── */}
      <Route path="/student" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
      <Route path="/student/results" element={<ProtectedRoute><StudentResults /></ProtectedRoute>} />
      <Route path="/student/attendance" element={<ProtectedRoute><StudentAttendance /></ProtectedRoute>} />
      <Route path="/student/timetable" element={<ProtectedRoute><StudentTimetable /></ProtectedRoute>} />
      <Route path="/student/assignments" element={<ProtectedRoute><StudentAssignments /></ProtectedRoute>} />
      <Route path="/student/activities" element={<ProtectedRoute><StudentActivities /></ProtectedRoute>} />
      <Route path="/student/announcements" element={<ProtectedRoute><StudentAnnouncements /></ProtectedRoute>} />
      <Route path="/student/messages" element={<ProtectedRoute><StudentMessages /></ProtectedRoute>} />
      {/* ── Teacher routes ── */}
      <Route path="/teacher" element={<ProtectedRoute><TeacherDashboard /></ProtectedRoute>} />
      <Route path="/teacher/classes" element={<ProtectedRoute><TeacherClasses /></ProtectedRoute>} />
      <Route path="/teacher/attendance" element={<ProtectedRoute><TeacherAttendance /></ProtectedRoute>} />
      <Route path="/teacher/announcements" element={<ProtectedRoute><TeacherAnnouncement /></ProtectedRoute>} />
      <Route path="/teacher/messages" element={<ProtectedRoute><TeacherMessages /></ProtectedRoute>} />
      {/* ── Parent routes ── */}
      <Route path="/parent" element={<ProtectedRoute><ParentDashboard /></ProtectedRoute>} />
      <Route path="/parent/children" element={<ProtectedRoute><ParentChildren /></ProtectedRoute>} />
      <Route path="/parent/results" element={<ProtectedRoute><ParentResults /></ProtectedRoute>} />
      <Route path="/parent/attendance" element={<ProtectedRoute><ParentAttendance /></ProtectedRoute>} />
      <Route path="/parent/behaviour" element={<ProtectedRoute><ParentBehaviour /></ProtectedRoute>} />
      <Route path="/parent/announcements" element={<ProtectedRoute><ParentAnnouncements /></ProtectedRoute>} />
      <Route path="/parent/messages" element={<ProtectedRoute><ParentMessages /></ProtectedRoute>} />
      {/* ── Discipline routes ── */}
      <Route path="/discipline" element={<ProtectedRoute><DisDashboard /></ProtectedRoute>} />
      <Route path="/discipline/students" element={<ProtectedRoute><DisStudents /></ProtectedRoute>} />
      <Route path="/discipline/student-life" element={<ProtectedRoute><DisStudentLife /></ProtectedRoute>} />
      <Route path="/discipline/boarding" element={<ProtectedRoute><DisBoarding /></ProtectedRoute>} />
      <Route path="/discipline/staff" element={<ProtectedRoute><DisStaff /></ProtectedRoute>} />
      <Route path="/discipline/announcements" element={<ProtectedRoute><DisAnnouncements /></ProtectedRoute>} />
      <Route path="/discipline/messages" element={<ProtectedRoute><DisMessages /></ProtectedRoute>} />
      <Route path="/discipline/timetable" element={<ProtectedRoute><DisTimetable /></ProtectedRoute>} />
      {/* legacy routes kept for compatibility */}
      <Route path="/discipline/activities" element={<ProtectedRoute><DisActivities /></ProtectedRoute>} />
      <Route path="/discipline/reports" element={<ProtectedRoute><DisReports /></ProtectedRoute>} />
      <Route path="/discipline/dining" element={<ProtectedRoute><DisDining /></ProtectedRoute>} />
      <Route path="/discipline/leaders" element={<ProtectedRoute><DisStudentLeaders /></ProtectedRoute>} />
      {/* ── DOS routes ── */}
      <Route path="/dos" element={<ProtectedRoute><DosDashboard /></ProtectedRoute>} />
      <Route path="/dos/results" element={<ProtectedRoute><DosResults /></ProtectedRoute>} />
      <Route path="/dos/teachers" element={<ProtectedRoute><DosTeachers /></ProtectedRoute>} />
      <Route path="/dos/students" element={<ProtectedRoute><DosStudents /></ProtectedRoute>} />
      <Route path="/dos/attendance" element={<ProtectedRoute><DosAttendance /></ProtectedRoute>} />
      <Route path="/dos/scheduling" element={<ProtectedRoute><DosScheduling /></ProtectedRoute>} />
      <Route path="/dos/announcements" element={<ProtectedRoute><DosAnnouncement /></ProtectedRoute>} />
      <Route path="/dos/messages" element={<ProtectedRoute><DosMessages /></ProtectedRoute>} />
      <Route path="/dos/leaders" element={<ProtectedRoute><DosStudentLeaders /></ProtectedRoute>} />
      <Route path="/dos/settings" element={<ProtectedRoute><DosSettings /></ProtectedRoute>} />
      {/* legacy routes kept for compatibility */}
      <Route path="/dos/timetable" element={<ProtectedRoute><DosTimetable /></ProtectedRoute>} />
      <Route path="/dos/exams" element={<ProtectedRoute><DosExamSchedule /></ProtectedRoute>} />
      <Route path="/dos/analytics" element={<ProtectedRoute><DosAnalytics /></ProtectedRoute>} />
      {/* ── Matron routes ── */}
      <Route path="/matron" element={<ProtectedRoute><MatronDashboard /></ProtectedRoute>} />
      <Route path="/matron/health" element={<ProtectedRoute><MatronHealth /></ProtectedRoute>} />
      <Route path="/matron/incidents" element={<ProtectedRoute><MatronIncidents /></ProtectedRoute>} />
      <Route path="/matron/messages" element={<ProtectedRoute><MatronMessages /></ProtectedRoute>} />
      <Route path="/matron/students" element={<ProtectedRoute><MatronStudents /></ProtectedRoute>} />
      <Route path="/matron/parent-communication" element={<ProtectedRoute><MatronParentComms /></ProtectedRoute>} />
      <Route path="/matron/schedule" element={<ProtectedRoute><MatronSchedule /></ProtectedRoute>} />
      {/* ── Admin routes ── */}
      <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/staff" element={<ProtectedRoute><AdminStaff /></ProtectedRoute>} />
      <Route path="/admin/students" element={<ProtectedRoute><AdminStudents /></ProtectedRoute>} />
      <Route path="/admin/finance" element={<ProtectedRoute><AdminFinance /></ProtectedRoute>} />
      <Route path="/admin/reports" element={<ProtectedRoute><AdminReports /></ProtectedRoute>} />
      <Route path="/admin/announcements" element={<ProtectedRoute><AdminAnnouncements /></ProtectedRoute>} />
      <Route path="/admin/messages" element={<ProtectedRoute><AdminMessages /></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute><AdminSettings /></ProtectedRoute>} />
      {/* ── Shared routes ── */}
      <Route path="/profile" element={<ProtectedRoute><Account /></ProtectedRoute>} />
      {/* ── Student extra routes ── */}
      <Route path="/student/discipline" element={<ProtectedRoute><StudentDiscipline /></ProtectedRoute>} />
      {/* ── Teacher extra routes ── */}
      <Route path="/teacher/assignments" element={<ProtectedRoute><TeacherAssignments /></ProtectedRoute>} />
      <Route path="/teacher/timetable"   element={<ProtectedRoute><TeacherTimetable /></ProtectedRoute>} />
      <Route path="/teacher/results"     element={<ProtectedRoute><TeacherResults /></ProtectedRoute>} />
      <Route path="/teacher/students"    element={<ProtectedRoute><TeacherStudent /></ProtectedRoute>} />
    </Routes>
  )
}

export default App
