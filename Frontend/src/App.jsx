import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router';
import { ProtectedRoute } from './components/ProtectedRoute';

// Entry-path pages stay eager so the first paint (landing / login) needs no
// extra round-trip. Everything behind a login is code-split below and loads
// only when that route is visited — see the note in App() for the payoff.
import { LandingPage } from './pages/LandingPage';
import { LogIn } from './pages/login';
import { NotFound } from './pages/NotFound';
import { PortalLogin } from './pages/PortalLogin';
import { PlatformLogin } from './pages/Platform/PlatformLogin';
import { PlatformLayout } from './pages/Platform/PlatformLayout';
import { OverviewSection } from './pages/Platform/sections/OverviewSection';
import { ApplicationsSection } from './pages/Platform/sections/ApplicationsSection';
import { SchoolsSection } from './pages/Platform/sections/SchoolsSection';
import { Apply } from './pages/Apply';
import { RevenueSection } from './pages/Platform/sections/RevenueSection';
import { ExpensesSection } from './pages/Platform/sections/ExpensesSection';
import { TicketsSection } from './pages/Platform/sections/TicketsSection';
import { ResetPassword } from './pages/ResetPassword';
import { Signup } from './pages/Signup';
import { TeacherRegistration } from './pages/TeacherRegistration';

// Lazy helper for named exports (React.lazy expects a default export).
// The import string stays static so the bundler can split each page out.
const load = (factory, name) => lazy(() => factory().then(m => ({ default: m[name] })));

// ── Student ──
const StudentDashboard    = load(() => import('./pages/Student/StudentDashboard'), 'StudentDashboard');
const StudentResults      = load(() => import('./pages/Student/StudentResults'), 'StudentResults');
const StudentAttendance   = load(() => import('./pages/Student/StudentAttendance'), 'StudentAttendance');
const StudentTimetable    = load(() => import('./pages/Student/StudentTimetable'), 'StudentTimetable');
const StudentAssignments  = load(() => import('./pages/Student/StudentAssignments'), 'StudentAssignments');
const StudentQuizReview   = load(() => import('./pages/Student/StudentQuizReview'), 'StudentQuizReview');
const StudentQuizPage     = load(() => import('./pages/Student/StudentQuizPage'), 'StudentQuizPage');
const StudentActivities   = load(() => import('./pages/Student/StudentActivities'), 'StudentActivities');
const StudentAnnouncements = load(() => import('./pages/Student/StudentAnnouncements'), 'StudentAnnouncements');
const StudentMessages     = load(() => import('./pages/Student/StudentMessages'), 'StudentMessages');
const StudentDiscipline   = load(() => import('./pages/Student/StudentDiscipline'), 'StudentDiscipline');

// ── Teacher ──
const TeacherDashboard    = load(() => import('./pages/Teacher/TeacherDashboard'), 'TeacherDashboard');
const TeacherClasses      = load(() => import('./pages/Teacher/TeacherClasses'), 'TeacherClasses');
const TeacherAttendance   = load(() => import('./pages/Teacher/TeacherAttendance'), 'TeacherAttendance');
const TeacherMessages     = load(() => import('./pages/Teacher/TeacherMessages'), 'TeacherMessages');
const TeacherAnnouncement = load(() => import('./pages/Teacher/TeacherAnnouncement'), 'TeacherAnnouncement');
const TeacherAssignments  = load(() => import('./pages/Teacher/TeacherAssignments'), 'TeacherAssignments');
const TeacherTimetable    = load(() => import('./pages/Teacher/TeacherTimetable'), 'TeacherTimetable');
const TeacherResults      = load(() => import('./pages/Teacher/TeacherResults'), 'TeacherResults');
const TeacherStudent      = load(() => import('./pages/Teacher/TeacherStudents'), 'TeacherStudent');

// ── Parent ──
const ParentDashboard     = load(() => import('./pages/Parent/ParentDashboard'), 'ParentDashboard');
const ParentChildren      = load(() => import('./pages/Parent/ParentChildren'), 'ParentChildren');
const ParentResults       = load(() => import('./pages/Parent/ParentResults'), 'ParentResults');
const ParentAttendance    = load(() => import('./pages/Parent/ParentAttendance'), 'ParentAttendance');
const ParentBehaviour     = load(() => import('./pages/Parent/ParentBehaviour'), 'ParentBehaviour');
const ParentAnnouncements = load(() => import('./pages/Parent/ParentAnnouncements'), 'ParentAnnouncements');
const ParentMessages      = load(() => import('./pages/Parent/ParentMessages'), 'ParentMessages');

// ── Discipline ──
const DisDashboard        = load(() => import('./pages/Dis/DisDashboard'), 'DisDashboard');
const DisActivities       = load(() => import('./pages/Dis/DisActivities'), 'DisActivities');
const DisStudents         = load(() => import('./pages/Dis/DisStudents'), 'DisStudents');
const DisStudentLife      = load(() => import('./pages/Dis/DisStudentLife'), 'DisStudentLife');
const DisBoarding         = load(() => import('./pages/Dis/DisBoarding'), 'DisBoarding');
const DisDining           = load(() => import('./pages/Dis/DisDining'), 'DisDining');
const DisMessages         = load(() => import('./pages/Dis/DisMessages'), 'DisMessages');
const DisStaff            = load(() => import('./pages/Dis/DisStaff'), 'DisStaff');
const DisStudentLeaders   = load(() => import('./pages/Dis/DisStudentLeaders'), 'DisStudentLeaders');
const DisTimetable        = load(() => import('./pages/Dis/DisTimetable'), 'DisTimetable');
const DisAnnouncements    = load(() => import('./pages/Dis/DisAnnouncements'), 'DisAnnouncements');
const DisSettings         = load(() => import('./pages/Dis/DisSettings'), 'DisSettings');

// ── DOS ──
const DosDashboard        = load(() => import('./pages/Dos/DosDashboard'), 'DosDashboard');
const DosStudents         = load(() => import('./pages/Dos/DosStudents'), 'DosStudents');
const DosTeachers         = load(() => import('./pages/Dos/DosTeachers'), 'DosTeachers');
const DosResults          = load(() => import('./pages/Dos/DosResults'), 'DosResults');
const DosScheduling       = load(() => import('./pages/Dos/DosScheduling'), 'DosScheduling');
const DosAttendance       = load(() => import('./pages/Dos/DosAttendance'), 'DosAttendance');
const DosTimetable        = load(() => import('./pages/Dos/DosTimetable'), 'DosTimetable');
const DosExamSchedule     = load(() => import('./pages/Dos/DosExamSchedule'), 'DosExamSchedule');
const DosAnalytics        = load(() => import('./pages/Dos/DosAnalytics'), 'DosAnalytics');
const DosStudentLeaders   = load(() => import('./pages/Dos/DosStudentLeaders'), 'DosStudentLeaders');
const DosAnnouncement     = load(() => import('./pages/Dos/DosAnnouncement'), 'DosAnnouncement');
const DosMessages         = load(() => import('./pages/Dos/DosMessages'), 'DosMessages');
const DosSettings         = load(() => import('./pages/Dos/DosSettings'), 'DosSettings');

// ── Matron ──
const MatronDashboard     = load(() => import('./pages/Matron/MatronDashboard'), 'MatronDashboard');
const MatronHealth        = load(() => import('./pages/Matron/MatronHealth'), 'MatronHealth');
const MatronIncidents     = load(() => import('./pages/Matron/MatronIncidents'), 'MatronIncidents');
const MatronMessages      = load(() => import('./pages/Matron/MatronMessages'), 'MatronMessages');
const MatronStudents      = load(() => import('./pages/Matron/MatronStudents'), 'MatronStudents');
const MatronParentComms   = load(() => import('./pages/Matron/MatronParentComms'), 'MatronParentComms');
const MatronSchedule      = load(() => import('./pages/Matron/MatronSchedule'), 'MatronSchedule');

// ── Admin ──
const AdminDashboard      = load(() => import('./pages/Admin/AdminDashboard'), 'AdminDashboard');
const AdminStaff          = load(() => import('./pages/Admin/AdminStaff'), 'AdminStaff');
const AdminStudents       = load(() => import('./pages/Admin/AdminStudents'), 'AdminStudents');
const AdminApprovals      = load(() => import('./pages/Admin/AdminApprovals'), 'AdminApprovals');
const AdminReports        = load(() => import('./pages/Admin/AdminReports'), 'AdminReports');
const AdminAnnouncements  = load(() => import('./pages/Admin/AdminAnnouncements'), 'AdminAnnouncements');
const AdminMessages       = load(() => import('./pages/Admin/AdminMessages'), 'AdminMessages');
const AdminSettings       = load(() => import('./pages/Admin/AdminSettings'), 'AdminSettings');
const AdminAuditLog       = load(() => import('./pages/Admin/AdminAuditLog'), 'AdminAuditLog');
const AdminBilling        = load(() => import('./pages/Admin/AdminBilling'), 'AdminBilling');
const AdminSupport        = load(() => import('./pages/Admin/AdminSupport'), 'AdminSupport');

// ── Shared ──
const Account             = load(() => import('./pages/Account'), 'Account');

function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-label="Loading">
      <div className="route-fallback-spinner" />
    </div>
  );
}

function App() {
  // Every portal page above is code-split: the browser downloads a page's chunk
  // only when its route is first visited, instead of shipping all 7 portals in
  // one bundle up front. Suspense shows RouteFallback during that brief fetch.
  return (
    <>
    {/* Keyboard users can jump past the sidebar straight to page content.
        Every portal page renders <main id="main-content">. */}
    <a href="#main-content" className="skip-link">Skip to main content</a>
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/apply" element={<Apply />} />
      <Route path="/login" element={<LogIn />} />
      <Route path="/reset-password/:uid/:token" element={<ResetPassword />} />

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
      {/* ── Platform (vendor) console — all schools; served on the bare domain ── */}
      <Route path="/platform/login" element={<PlatformLogin />} />
      <Route path="/platform" element={<PlatformLayout title="Overview" subtitle="Your platform at a glance"><OverviewSection /></PlatformLayout>} />
      <Route path="/platform/applications" element={<PlatformLayout title="Applications" subtitle="Schools applying to join Imboni"><ApplicationsSection /></PlatformLayout>} />
      <Route path="/platform/schools" element={<PlatformLayout title="Schools" subtitle="All tenant schools"><SchoolsSection /></PlatformLayout>} />
      <Route path="/platform/revenue" element={<PlatformLayout title="Revenue" subtitle="Payments received from schools"><RevenueSection /></PlatformLayout>} />
      <Route path="/platform/expenses" element={<PlatformLayout title="Expenses" subtitle="Services & bills you pay for"><ExpensesSection /></PlatformLayout>} />
      <Route path="/platform/support" element={<PlatformLayout title="Support" subtitle="Tickets raised by schools"><TicketsSection /></PlatformLayout>} />

      {/* ── Public registration routes ── */}
      <Route path="/register/:uid/:token" element={<TeacherRegistration />} />
      {/* ── Student routes ── */}
      <Route path="/student" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
      <Route path="/student/results" element={<ProtectedRoute><StudentResults /></ProtectedRoute>} />
      <Route path="/student/attendance" element={<ProtectedRoute><StudentAttendance /></ProtectedRoute>} />
      <Route path="/student/timetable" element={<ProtectedRoute><StudentTimetable /></ProtectedRoute>} />
      <Route path="/student/assignments" element={<ProtectedRoute><StudentAssignments /></ProtectedRoute>} />
      <Route path="/student/quiz/:assignmentId" element={<ProtectedRoute><StudentQuizPage /></ProtectedRoute>} />
      <Route path="/student/quiz/:assignmentId/review" element={<ProtectedRoute><StudentQuizReview /></ProtectedRoute>} />
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
      <Route path="/discipline/dining" element={<ProtectedRoute><DisDining /></ProtectedRoute>} />
      <Route path="/discipline/leaders" element={<ProtectedRoute><DisStudentLeaders /></ProtectedRoute>} />
      <Route path="/discipline/settings" element={<ProtectedRoute><DisSettings /></ProtectedRoute>} />
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
      <Route path="/admin/approvals" element={<ProtectedRoute><AdminApprovals /></ProtectedRoute>} />
      <Route path="/admin/reports" element={<ProtectedRoute><AdminReports /></ProtectedRoute>} />
      <Route path="/admin/announcements" element={<ProtectedRoute><AdminAnnouncements /></ProtectedRoute>} />
      <Route path="/admin/messages" element={<ProtectedRoute><AdminMessages /></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute><AdminSettings /></ProtectedRoute>} />
      <Route path="/admin/audit" element={<ProtectedRoute><AdminAuditLog /></ProtectedRoute>} />
      <Route path="/admin/billing" element={<ProtectedRoute><AdminBilling /></ProtectedRoute>} />
      <Route path="/admin/support" element={<ProtectedRoute><AdminSupport /></ProtectedRoute>} />
      {/* ── Shared routes ── */}
      <Route path="/profile" element={<ProtectedRoute><Account /></ProtectedRoute>} />
      {/* ── Student extra routes ── */}
      <Route path="/student/discipline" element={<ProtectedRoute><StudentDiscipline /></ProtectedRoute>} />
      {/* ── Teacher extra routes ── */}
      <Route path="/teacher/assignments" element={<ProtectedRoute><TeacherAssignments /></ProtectedRoute>} />
      <Route path="/teacher/timetable"   element={<ProtectedRoute><TeacherTimetable /></ProtectedRoute>} />
      <Route path="/teacher/results"     element={<ProtectedRoute><TeacherResults /></ProtectedRoute>} />
      <Route path="/teacher/students"    element={<ProtectedRoute><TeacherStudent /></ProtectedRoute>} />
      {/* ── Not Found route ── */}
      <Route path="*"    element={<NotFound/>} />
    </Routes>
    </Suspense>
    </>
  )
}

export default App
