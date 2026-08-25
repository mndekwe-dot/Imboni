import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router';
import { ProtectedRoute } from './components/ProtectedRoute';
import { usePortalTheme } from './hooks/usePortalTheme';
import { useSyncStoredLanguage } from './hooks/useLanguage';

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
import { ContractsSection } from './pages/Platform/sections/ContractsSection';
import { Apply } from './pages/Apply';
import { RevenueSection } from './pages/Platform/sections/RevenueSection';
import { ExpensesSection } from './pages/Platform/sections/ExpensesSection';
import { TicketsSection } from './pages/Platform/sections/TicketsSection';
import { HealthSection } from './pages/Platform/sections/HealthSection';
import { ResetPassword } from './pages/ResetPassword';
import { Signup } from './pages/Signup';
import { TeacherRegistration } from './pages/TeacherRegistration';
// Public marketing pages. Eager like the other entry-path pages: a visitor
// arriving on /pricing from a search result should not wait on a second
// round-trip before seeing anything.
import { Pricing } from './pages/Pricing';
import { About } from './pages/About';
import { Contact } from './pages/Contact';
import { Privacy } from './pages/Privacy';
import { Terms } from './pages/Terms';
import { FindSchool } from './pages/FindSchool';

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
const TeacherAssignmentForm = load(() => import('./pages/Teacher/TeacherAssignmentForm'), 'TeacherAssignmentForm');
const TeacherExams = load(() => import('./pages/Teacher/TeacherExams'), 'TeacherExams');
const TeacherExamForm = load(() => import('./pages/Teacher/TeacherExamForm'), 'TeacherExamForm');
const DosExamPapers = load(() => import('./pages/Dos/DosExamPapers'), 'DosExamPapers');
const TeacherTimetable    = load(() => import('./pages/Teacher/TeacherTimetable'), 'TeacherTimetable');
const TeacherResults      = load(() => import('./pages/Teacher/TeacherResults'), 'TeacherResults');
const TeacherStudent      = load(() => import('./pages/Teacher/TeacherStudents'), 'TeacherStudent');

// ── Parent ──
const ParentDashboard     = load(() => import('./pages/Parent/ParentDashboard'), 'ParentDashboard');
const ParentAssignments   = load(() => import('./pages/Parent/ParentAssignments'), 'ParentAssignments');
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
const DisParentComms      = load(() => import('./pages/Dis/DisParentComms'), 'DisParentComms');

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
  // Marks <html> with the portal the current route belongs to, so each portal's
  // CSS can be scoped instead of leaking through :root. See usePortalTheme.
  usePortalTheme();

  // Reconciles the signed-in user's language with their account, so the choice
  // follows them to a new device instead of living only in this browser. Guards
  // on the access token itself, so public routes never fire an authed request.
  useSyncStoredLanguage();

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

      {/* Public marketing and legal pages */}
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      {/* Recovery for the subdomain model: a user who lost their school URL. */}
      <Route path="/find-school" element={<FindSchool />} />
      <Route path="/login" element={<LogIn />} />
      <Route path="/reset-password/:uid/:token" element={<ResetPassword />} />

      {/* ── Portal-specific login pages ── */}
      <Route path="/login/student" element={
        <PortalLogin portal="student"
          icon="school"
          placeholder="student@imboni.rw" redirectTo="/student" />
      } />
      <Route path="/login/teacher" element={
        <PortalLogin portal="teacher"
          icon="cast_for_education"
          placeholder="teacher@imboni.rw" redirectTo="/teacher" />
      } />
      <Route path="/login/parent" element={
        <PortalLogin portal="parent"
          icon="family_restroom"
          placeholder="parent@gmail.com" redirectTo="/parent" />
      } />
      <Route path="/login/dos" element={
        <PortalLogin portal="dos"
          icon="analytics"
          placeholder="dos@imboni.rw" redirectTo="/dos" />
      } />
      <Route path="/login/discipline" element={
        <PortalLogin portal="discipline"
          icon="shield_person"
          placeholder="discipline@imboni.rw" redirectTo="/discipline" />
      } />
      <Route path="/login/matron" element={
        <PortalLogin portal="matron"
          icon="health_and_safety"
          placeholder="matron@imboni.rw" redirectTo="/matron" />
      } />
      <Route path="/login/admin" element={
        <PortalLogin portal="admin"
          icon="admin_panel_settings"
          placeholder="admin@imboni.rw" redirectTo="/admin" />
      } />
      {/* ── Platform (vendor) console — all schools; served on the bare domain ── */}
      <Route path="/platform/login" element={<PlatformLogin />} />
      <Route path="/platform" element={<PlatformLayout title="Overview" subtitle="Your platform at a glance"><OverviewSection /></PlatformLayout>} />
      <Route path="/platform/applications" element={<PlatformLayout title="Applications" subtitle="Schools applying to join Imboni"><ApplicationsSection /></PlatformLayout>} />
      <Route path="/platform/schools" element={<PlatformLayout title="Schools" subtitle="All tenant schools"><SchoolsSection /></PlatformLayout>} />
      <Route path="/platform/contracts" element={<PlatformLayout title="Contracts" subtitle="Agreements & their lifecycle"><ContractsSection /></PlatformLayout>} />
      <Route path="/platform/revenue" element={<PlatformLayout title="Revenue" subtitle="Payments received from schools"><RevenueSection /></PlatformLayout>} />
      <Route path="/platform/expenses" element={<PlatformLayout title="Expenses" subtitle="Services & bills you pay for"><ExpensesSection /></PlatformLayout>} />
      <Route path="/platform/support" element={<PlatformLayout title="Support" subtitle="Tickets raised by schools"><TicketsSection /></PlatformLayout>} />
      <Route path="/platform/health" element={<PlatformLayout title="Health" subtitle="Health of all of Imboni"><HealthSection /></PlatformLayout>} />

      {/* ── Public registration routes ── */}
      <Route path="/register/:uid/:token" element={<TeacherRegistration />} />
      {/* ── Student routes ── */}
      <Route path="/student" element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>} />
      <Route path="/student/results" element={<ProtectedRoute role="student"><StudentResults /></ProtectedRoute>} />
      <Route path="/student/attendance" element={<ProtectedRoute role="student"><StudentAttendance /></ProtectedRoute>} />
      <Route path="/student/timetable" element={<ProtectedRoute role="student"><StudentTimetable /></ProtectedRoute>} />
      <Route path="/student/assignments" element={<ProtectedRoute role="student"><StudentAssignments /></ProtectedRoute>} />
      <Route path="/student/quiz/:assignmentId" element={<ProtectedRoute role="student"><StudentQuizPage /></ProtectedRoute>} />
      <Route path="/student/quiz/:assignmentId/review" element={<ProtectedRoute role="student"><StudentQuizReview /></ProtectedRoute>} />
      <Route path="/student/activities" element={<ProtectedRoute role="student"><StudentActivities /></ProtectedRoute>} />
      <Route path="/student/announcements" element={<ProtectedRoute role="student"><StudentAnnouncements /></ProtectedRoute>} />
      <Route path="/student/messages" element={<ProtectedRoute role="student"><StudentMessages /></ProtectedRoute>} />
      {/* ── Teacher routes ── */}
      <Route path="/teacher" element={<ProtectedRoute role="teacher"><TeacherDashboard /></ProtectedRoute>} />
      <Route path="/teacher/classes" element={<ProtectedRoute role="teacher"><TeacherClasses /></ProtectedRoute>} />
      <Route path="/teacher/attendance" element={<ProtectedRoute role="teacher"><TeacherAttendance /></ProtectedRoute>} />
      <Route path="/teacher/announcements" element={<ProtectedRoute role="teacher"><TeacherAnnouncement /></ProtectedRoute>} />
      <Route path="/teacher/messages" element={<ProtectedRoute role="teacher"><TeacherMessages /></ProtectedRoute>} />
      {/* ── Parent routes ── */}
      <Route path="/parent" element={<ProtectedRoute role="parent"><ParentDashboard /></ProtectedRoute>} />
      <Route path="/parent/children" element={<ProtectedRoute role="parent"><ParentChildren /></ProtectedRoute>} />
      <Route path="/parent/results" element={<ProtectedRoute role="parent"><ParentResults /></ProtectedRoute>} />
      <Route path="/parent/assignments" element={<ProtectedRoute role="parent"><ParentAssignments /></ProtectedRoute>} />
      <Route path="/parent/attendance" element={<ProtectedRoute role="parent"><ParentAttendance /></ProtectedRoute>} />
      <Route path="/parent/behaviour" element={<ProtectedRoute role="parent"><ParentBehaviour /></ProtectedRoute>} />
      <Route path="/parent/announcements" element={<ProtectedRoute role="parent"><ParentAnnouncements /></ProtectedRoute>} />
      <Route path="/parent/messages" element={<ProtectedRoute role="parent"><ParentMessages /></ProtectedRoute>} />
      {/* ── Discipline routes ── */}
      <Route path="/discipline" element={<ProtectedRoute role="discipline"><DisDashboard /></ProtectedRoute>} />
      <Route path="/discipline/students" element={<ProtectedRoute role="discipline"><DisStudents /></ProtectedRoute>} />
      <Route path="/discipline/student-life" element={<ProtectedRoute role="discipline"><DisStudentLife /></ProtectedRoute>} />
      <Route path="/discipline/boarding" element={<ProtectedRoute role="discipline"><DisBoarding /></ProtectedRoute>} />
      <Route path="/discipline/staff" element={<ProtectedRoute role="discipline"><DisStaff /></ProtectedRoute>} />
      <Route path="/discipline/announcements" element={<ProtectedRoute role="discipline"><DisAnnouncements /></ProtectedRoute>} />
      <Route path="/discipline/parent-comms" element={<ProtectedRoute role="discipline"><DisParentComms /></ProtectedRoute>} />
      <Route path="/discipline/messages" element={<ProtectedRoute role="discipline"><DisMessages /></ProtectedRoute>} />
      <Route path="/discipline/timetable" element={<ProtectedRoute role="discipline"><DisTimetable /></ProtectedRoute>} />
      {/* legacy routes kept for compatibility */}
      <Route path="/discipline/activities" element={<ProtectedRoute role="discipline"><DisActivities /></ProtectedRoute>} />
      <Route path="/discipline/dining" element={<ProtectedRoute role="discipline"><DisDining /></ProtectedRoute>} />
      <Route path="/discipline/leaders" element={<ProtectedRoute role="discipline"><DisStudentLeaders /></ProtectedRoute>} />
      <Route path="/discipline/settings" element={<ProtectedRoute role="discipline"><DisSettings /></ProtectedRoute>} />
      {/* ── DOS routes ── */}
      <Route path="/dos" element={<ProtectedRoute role="dos"><DosDashboard /></ProtectedRoute>} />
      <Route path="/dos/results" element={<ProtectedRoute role="dos"><DosResults /></ProtectedRoute>} />
      <Route path="/dos/teachers" element={<ProtectedRoute role="dos"><DosTeachers /></ProtectedRoute>} />
      <Route path="/dos/students" element={<ProtectedRoute role="dos"><DosStudents /></ProtectedRoute>} />
      <Route path="/dos/attendance" element={<ProtectedRoute role="dos"><DosAttendance /></ProtectedRoute>} />
      <Route path="/dos/scheduling" element={<ProtectedRoute role="dos"><DosScheduling /></ProtectedRoute>} />
      <Route path="/dos/announcements" element={<ProtectedRoute role="dos"><DosAnnouncement /></ProtectedRoute>} />
      <Route path="/dos/messages" element={<ProtectedRoute role="dos"><DosMessages /></ProtectedRoute>} />
      <Route path="/dos/leaders" element={<ProtectedRoute role="dos"><DosStudentLeaders /></ProtectedRoute>} />
      <Route path="/dos/settings" element={<ProtectedRoute role="dos"><DosSettings /></ProtectedRoute>} />
      {/* legacy routes kept for compatibility */}
      <Route path="/dos/timetable" element={<ProtectedRoute role="dos"><DosTimetable /></ProtectedRoute>} />
      <Route path="/dos/exams" element={<ProtectedRoute role="dos"><DosExamSchedule /></ProtectedRoute>} />
      <Route path="/dos/analytics" element={<ProtectedRoute role="dos"><DosAnalytics /></ProtectedRoute>} />
      {/* ── Matron routes ── */}
      <Route path="/matron" element={<ProtectedRoute role="matron"><MatronDashboard /></ProtectedRoute>} />
      <Route path="/matron/health" element={<ProtectedRoute role="matron"><MatronHealth /></ProtectedRoute>} />
      <Route path="/matron/incidents" element={<ProtectedRoute role="matron"><MatronIncidents /></ProtectedRoute>} />
      <Route path="/matron/messages" element={<ProtectedRoute role="matron"><MatronMessages /></ProtectedRoute>} />
      <Route path="/matron/students" element={<ProtectedRoute role="matron"><MatronStudents /></ProtectedRoute>} />
      <Route path="/matron/schedule" element={<ProtectedRoute role="matron"><MatronSchedule /></ProtectedRoute>} />
      {/* ── Admin routes ── */}
      <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/staff" element={<ProtectedRoute role="admin"><AdminStaff /></ProtectedRoute>} />
      <Route path="/admin/students" element={<ProtectedRoute role="admin"><AdminStudents /></ProtectedRoute>} />
      <Route path="/admin/approvals" element={<ProtectedRoute role="admin"><AdminApprovals /></ProtectedRoute>} />
      <Route path="/admin/reports" element={<ProtectedRoute role="admin"><AdminReports /></ProtectedRoute>} />
      <Route path="/admin/announcements" element={<ProtectedRoute role="admin"><AdminAnnouncements /></ProtectedRoute>} />
      <Route path="/admin/messages" element={<ProtectedRoute role="admin"><AdminMessages /></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute role="admin"><AdminSettings /></ProtectedRoute>} />
      <Route path="/admin/audit" element={<ProtectedRoute role="admin"><AdminAuditLog /></ProtectedRoute>} />
      <Route path="/admin/billing" element={<ProtectedRoute role="admin"><AdminBilling /></ProtectedRoute>} />
      <Route path="/admin/support" element={<ProtectedRoute role="admin"><AdminSupport /></ProtectedRoute>} />
      {/* ── Shared routes ── */}
      <Route path="/profile" element={<ProtectedRoute><Account /></ProtectedRoute>} />
      {/* ── Student extra routes ── */}
      <Route path="/student/discipline" element={<ProtectedRoute role="student"><StudentDiscipline /></ProtectedRoute>} />
      {/* ── Teacher extra routes ── */}
      <Route path="/teacher/assignments" element={<ProtectedRoute role="teacher"><TeacherAssignments /></ProtectedRoute>} />
      <Route path="/teacher/assignments/new" element={<ProtectedRoute role="teacher"><TeacherAssignmentForm /></ProtectedRoute>} />
      <Route path="/teacher/assignments/:id/edit" element={<ProtectedRoute role="teacher"><TeacherAssignmentForm /></ProtectedRoute>} />
      <Route path="/teacher/exams" element={<ProtectedRoute role="teacher"><TeacherExams /></ProtectedRoute>} />
      <Route path="/teacher/exams/new" element={<ProtectedRoute role="teacher"><TeacherExamForm /></ProtectedRoute>} />
      <Route path="/teacher/exams/:id/edit" element={<ProtectedRoute role="teacher"><TeacherExamForm /></ProtectedRoute>} />
      <Route path="/dos/exam-papers" element={<ProtectedRoute role="dos"><DosExamPapers /></ProtectedRoute>} />
      <Route path="/teacher/timetable"   element={<ProtectedRoute role="teacher"><TeacherTimetable /></ProtectedRoute>} />
      <Route path="/teacher/results"     element={<ProtectedRoute role="teacher"><TeacherResults /></ProtectedRoute>} />
      <Route path="/teacher/students"    element={<ProtectedRoute role="teacher"><TeacherStudent /></ProtectedRoute>} />
      {/* ── Not Found route ── */}
      <Route path="*"    element={<NotFound/>} />
    </Routes>
    </Suspense>
    </>
  )
}

export default App
