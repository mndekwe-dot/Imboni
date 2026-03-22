# Locking Down Permissions — Concept Guide

> This guide explains what to change, where to change it, and why.
> The code already exists — you are only adding or replacing `permission_classes` lines.

---

## Table of Contents

1. [How DRF Permissions Work](#1-how-drf-permissions-work)
2. [Available Permission Classes](#2-available-permission-classes)
3. [Authentication App — views.py](#3-authentication-app--viewspy)
4. [Student App — views.py](#4-student-app--viewspy)
5. [Discipline App — views.py](#5-discipline-app--viewspy)
6. [Matron App — views.py](#6-matron-app--viewspy)
7. [Testing Checklist](#7-testing-checklist)
8. [Common Errors After Locking](#8-common-errors-after-locking)

---

## 1. How DRF Permissions Work

Every view in Django REST Framework has a `permission_classes` list. Before the view runs, DRF checks every class in that list. If any class says "no", the request is rejected with `403 Forbidden` (if authenticated) or `401 Unauthorized` (if not logged in at all).

`permission_classes = [permissions.AllowAny]` means anyone — logged in or not — can access the view. This is what most views currently have, and it is what we are removing.

`permission_classes = [permissions.IsAuthenticated]` means the user must have a valid JWT access token in the `Authorization: Bearer <token>` header. No token = rejected.

Custom permission classes like `IsStudent` extend this further — the user must be authenticated AND their `role` field must equal the expected value.

When a view has no `permission_classes` line at all, it falls back to whatever `DEFAULT_PERMISSION_CLASSES` is set to in `settings.py`. In most Django projects this is `IsAuthenticated`, but it is safer to be explicit on every view.

---

## 2. Available Permission Classes

These are already written in `Backend/authentication/permissions.py`. You do not need to create them — just import and use them.

| Class | Who can access |
|---|---|
| `IsAuthenticated` | Any logged-in user regardless of role |
| `IsAdminRole` | Only users with role `admin` |
| `IsDOS` | Only users with role `dos` |
| `IsTeacher` | Only users with role `teacher` |
| `IsStudent` | Only users with role `student` |
| `IsParent` | Only users with role `parent` |
| `IsMatron` | Only users with role `matron` |
| `IsDiscipline` | Only users with role `discipline` |
| `IsDOSOrAdmin` | Users with role `dos` or `admin` |
| `IsTeacherOrDOS` | Users with role `teacher`, `dos`, or `admin` |
| `CanInvite` | Users with role `admin`, `dos`, or `discipline` |

### How to import them in a views.py file

At the top of each `views.py` file, add the import line below alongside the other imports. The path is relative to where that `views.py` lives.

For `student/views.py`, `discipline/views.py`, and `matron/views.py` — these are sibling apps so the path is:
```
from authentication.permissions import IsStudent, IsMatron, IsDiscipline
```

Each app imports only what it needs. Student views import `IsStudent`. Discipline views import `IsDiscipline`. Matron views import `IsMatron`.

---

## 3. Authentication App — views.py

**File:** `Backend/authentication/views.py`

This file has several view classes. Each change is described below.

---

### UserViewSet

This is a `ModelViewSet` — a single class that handles list, retrieve, create, update, and delete.

**Current state:**
```
permission_classes = [permissions.AllowAny]
```

**What to change it to:**
```
permission_classes = [permissions.IsAuthenticated]
```

**Why:** Any logged-in user should be able to view their own profile. Admin and DOS users see more via `get_queryset()` which already handles filtering. No unauthenticated access is needed here.

**Note on the `register` action inside this ViewSet:** This action currently does its own registration but since we have the invitation system, it is intentionally unused. You do not need to add `AllowAny` back to the ViewSet just for this action. Leave the ViewSet at `IsAuthenticated`.

---

### AuthViewSet

**Current state:**
```
permission_classes = [permissions.AllowAny]
```

**Do NOT change this.** Login requires `AllowAny` because the user is not authenticated yet when they log in. Both `login` and `logout` live in this ViewSet.

**The problem:** `logout` should require authentication, but changing the ViewSet-level permission would break login. The fix is to override `permission_classes` on the `logout` action specifically using `@action(permission_classes=[permissions.IsAuthenticated])`.

**What to change:** Find the `logout` action inside `AuthViewSet`. On the `@action` decorator line, add `permission_classes=[permissions.IsAuthenticated]` as a parameter. The login action gets no changes.

---

### UserPreferencesViewSet

**Current state:**
```
permission_classes = [permissions.AllowAny]
```

**What to change it to:**
```
permission_classes = [permissions.IsAuthenticated]
```

**Why:** Preferences contain personal settings. Only the owner should read or change them. `get_object()` already returns the current user's preferences, so filtering is handled.

Also remove the fallback line in `get_object()`:
```
return UserPreferences.objects.first()  # Fallback for development
```
Replace it with a proper `401` response or just remove it — once permissions are on, unauthenticated users never reach `get_object()`.

---

### AccountProfileView

**Current state:** No `permission_classes` line at all.

**What to add:**
```
permission_classes = [permissions.IsAuthenticated]
```

Add this line inside the class, below the `serializer_class` line.

Also update `get_object()` — remove the fallback:
```
return User.objects.filter(role='parent').first()
```
Replace it with just `return self.request.user`. Once permissions are on, the user is always authenticated at this point.

---

### AccountAvatarView

**Current state:** No `permission_classes` line.

**What to add:**
```
permission_classes = [permissions.IsAuthenticated]
```

Add this line inside the class below `parser_classes`.

Also update the `patch` method — remove the fallback:
```
user = request.user if request.user.is_authenticated else User.objects.filter(role='parent').first()
```
Replace it with just:
```
user = request.user
```

---

### PasswordResetRequestView, PasswordResetConfirmView, VerifyInvitationView, CompleteRegistrationView, EmailChangeConfirmView

**Current state:** `permission_classes = [permissions.AllowAny]`

**Do NOT change these.** They must remain public:
- Password reset: the user is not logged in when they forget their password
- Verify invitation: the user has no account yet
- Complete registration: the user has no account yet
- Email change confirm: the user clicks from their email, may not be logged in

---

### SendInvitationView, BulkInviteView, InvitationListView, ResendInvitationView, CancelInvitationView

**Current state:** `permission_classes = [CanInvite]`

**Do NOT change these.** `CanInvite` already requires authentication and checks the role. These are already correctly protected.

---

### EmailChangeRequestView

**Current state:** `permission_classes = [permissions.IsAuthenticated]`

**Do NOT change this.** Already correct.

---

## 4. Student App — views.py

**File:** `Backend/student/views.py`

---

### Import line to add at the top

Find the existing imports at the top of the file. Add this line with the other imports:
```
from authentication.permissions import IsStudent
```

---

### StudentDashboardView

**Current state:** No `permission_classes` line.

**What to add inside the class:**
```
permission_classes = [IsStudent]
```

**Why:** The dashboard shows personal academic data. Only the student themselves should see it.

---

### StudentTimetableView and StudentTodayScheduleView

**Current state:** No `permission_classes` line on either.

**What to add to both:**
```
permission_classes = [IsStudent]
```

**Why:** The timetable is per-student. Without this, any anonymous person can query it.

---

### StudentResultsView

**Current state:** No `permission_classes` line.

**What to add:**
```
permission_classes = [IsStudent]
```

**Why:** Exam results are confidential. A student should only see their own results. The view's queryset should filter by the requesting user — check that `get_queryset` or the query uses `self.request.user`.

---

### StudentAttendanceStatsView and StudentAttendanceCalendarView

**Current state:** No `permission_classes` line on either.

**What to add to both:**
```
permission_classes = [IsStudent]
```

**Why:** Attendance records are personal data.

---

### StudentAnnouncementsSimpleView

**Current state:** No `permission_classes` line.

**What to add:**
```
permission_classes = [IsStudent]
```

**Why:** Even though announcements feel "public," in a school system they are only relevant to enrolled students. Keeping them behind `IsStudent` means only active users with valid accounts can read them.

---

### StudentDisciplineView

**Current state:** No `permission_classes` line.

**What to add:**
```
permission_classes = [IsStudent]
```

**Why:** Behavioral records are sensitive. A student can view their own record but should not be able to see others. Check that the queryset filters by `self.request.user`.

---

### StudentActivitiesView, StudentActivityApplyView, StudentActivityWithdrawView, StudentActivityEventsView

**Current state:** No `permission_classes` line on any of these.

**What to add to all four:**
```
permission_classes = [IsStudent]
```

**Why:** Activity enrollment is per-student. Applying or withdrawing from an activity should only be possible by the student themselves.

---

### StudentAssignmentsView and StudentAssignmentSubmitView

**Current state:** No `permission_classes` line on either.

**What to add to both:**
```
permission_classes = [IsStudent]
```

**Why:** Assignment submissions are per-student. Submitting on behalf of another student must not be possible.

---

### StudentProfileView

**Current state:** No `permission_classes` line.

**What to add:**
```
permission_classes = [IsStudent]
```

**Why:** Profile view returns personal student data.

---

## 5. Discipline App — views.py

**File:** `Backend/discipline/views.py`

---

### Import line to add at the top

```
from authentication.permissions import IsDiscipline, IsMatron
```

Both are needed because boarding and dining views allow either role.

---

### DisciplineDashboardView

**What to add:**
```
permission_classes = [IsDiscipline]
```

**Why:** Dashboard contains aggregated behavior data for the whole school. Only the discipline master should see this overview.

---

### DisciplineReportListView and DisciplineReportDetailView

**What to add to both:**
```
permission_classes = [IsDiscipline]
```

**Why:** Behavior reports are created and managed by the discipline master. No other role should be able to list or update them.

---

### DisciplineStudentListView and DisciplineStudentDetailView

**What to add to both:**
```
permission_classes = [IsDiscipline]
```

**Why:** This is the discipline master's view of students — it likely includes disciplinary history. Not for general access.

---

### DisciplineStaffListView and DisciplineStaffDetailView

**What to add to both:**
```
permission_classes = [IsDiscipline]
```

**Why:** Staff management under discipline is internal administration. Only discipline master access.

---

### StudentLeaderListView and StudentLeaderDetailView

**What to add to both:**
```
permission_classes = [IsDiscipline]
```

**Why:** Assigning and managing student leaders is a discipline master responsibility.

---

### BoardingStudentListView and BoardingStudentDetailView

**What to add to both:**
```
permission_classes = [IsDiscipline]
```

**Why:** Boarding management is shared between discipline master and matron. Either role should be allowed.

**Note:** There is currently no combined permission class like `IsDisciplineOrMatron`. You have two options:
- Option A: Use `IsDiscipline` for now and add a combined class later
- Option B: Create a new `IsDisciplineOrMatron` class in `permissions.py` following the same pattern as `IsDOSOrAdmin`

For now, go with Option A (`IsDiscipline`) since the matron app has its own boarding view. When you are ready, the combined class is just two lines in `permissions.py`.

---

### DiningPlanListView

**What to add:**
```
permission_classes = [IsDiscipline]
```

**Why:** Dining plans are managed by the discipline master.

---

### DisciplineActivityListView and DisciplineActivityDetailView

**What to add to both:**
```
permission_classes = [IsDiscipline]
```

**Why:** Extracurricular activities are administered by the discipline master.

---

### DisciplineActivityEventCreateView

**What to add:**
```
permission_classes = [IsDiscipline]
```

**Why:** Creating events within an activity is also a discipline master operation.

---

### DisciplineTimetableView

**What to add:**
```
permission_classes = [IsDiscipline]
```

**Why:** The timetable view for the discipline master's perspective of the school schedule.

---

## 6. Matron App — views.py

**File:** `Backend/matron/views.py`

---

### Import line to add at the top

```
from authentication.permissions import IsMatron
```

---

### MatronDashboardView

**What to add:**
```
permission_classes = [IsMatron]
```

**Why:** The dashboard shows a summary of boarding students under the matron's care. Only matrons should see this.

---

### MatronStudentListView and MatronStudentDetailView

**What to add to both:**
```
permission_classes = [IsMatron]
```

**Why:** Matrons manage the welfare of boarding students. This list is their working view.

---

### MatronIncidentListView and MatronIncidentDetailView

**What to add to both:**
```
permission_classes = [IsMatron]
```

**Why:** Incidents (health, behavior, welfare) filed by the matron are sensitive records. Only the matron and admin should access them. Admin access is handled at the admin panel level, not this endpoint.

---

### MatronScheduleView

**What to add:**
```
permission_classes = [IsMatron]
```

**Why:** The matron's duty schedule is internal.

---

### MatronNightCheckView

**What to add:**
```
permission_classes = [IsMatron]
```

**Why:** Night check records track student presence in dormitories. This is matron-specific data.

---

## 7. Testing Checklist

After making all changes, test each category with Postman.

### Test without a token (should get 401)

| Request | Expected |
|---|---|
| `GET /imboni/users/` | `401 Unauthorized` |
| `GET /imboni/student/dashboard/` | `401 Unauthorized` |
| `GET /imboni/discipline/dashboard/` | `401 Unauthorized` |
| `GET /imboni/matron/dashboard/` | `401 Unauthorized` |

### Test with wrong role (should get 403)

Log in as a `teacher` and try:

| Request | Expected |
|---|---|
| `GET /imboni/student/dashboard/` | `403 Forbidden` |
| `GET /imboni/discipline/dashboard/` | `403 Forbidden` |
| `GET /imboni/matron/dashboard/` | `403 Forbidden` |

### Test with correct role (should get 200)

Log in as `johndoe` (teacher role) — teacher-specific views will work. Log in as `admin123` (admin role) — admin can access user management.

### Test public endpoints still work (should get 200 without token)

| Request | Expected |
|---|---|
| `POST /imboni/auth/login/` | `200 OK` |
| `POST /imboni/auth/password-reset/` | `200 OK` |
| `GET /imboni/auth/register/verify/<uid>/<token>/` | `200 OK` |
| `POST /imboni/auth/register/complete/` | `201 Created` |

---

## 8. Common Errors After Locking

| Error | Cause | Fix |
|---|---|---|
| `401 Unauthorized` on a view that should work | JWT token not sent or expired | Add `Authorization: Bearer <token>` header in Postman. Re-login to get fresh token |
| `403 Forbidden` even with correct role | Permission class checks wrong role field | Check that `request.user.role` equals exactly what the permission class expects (e.g. `'student'` not `'Student'`) |
| `AttributeError: 'AnonymousUser' object has no attribute 'role'` | Permission class tries to read `.role` before checking `is_authenticated` | All custom permission classes should call `request.user.is_authenticated` first — verify this in `permissions.py` |
| `ImportError: cannot import name 'IsStudent'` | Wrong import path | For student/discipline/matron apps, the path is `from authentication.permissions import IsStudent` |
| Fallback returning wrong user data | `get_object()` still has the dev fallback line | Remove the `return User.objects.filter(role=...).first()` fallback lines from `AccountProfileView` and `AccountAvatarView` |
