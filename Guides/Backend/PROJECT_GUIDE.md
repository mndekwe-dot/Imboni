# Imboni School Management System - Complete Project Guide

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Project Setup](#2-project-setup)
3. [Project Structure](#3-project-structure)
4. [Authentication App](#4-authentication-app)
5. [Students App](#5-students-app)
6. [Results App](#6-results-app)
7. [Attendance App](#7-attendance-app)
8. [Behavior App](#8-behavior-app)
9. [Announcements App](#9-announcements-app)
10. [Teacher App](#10-teacher-app)
11. [DOS App](#11-dos-app)
12. [Configuration Settings](#12-configuration-settings)
13. [API Endpoints](#13-api-endpoints)
14. [Sample Data](#14-sample-data)
15. [Testing Guide](#15-testing-guide)

---

## 1. Project Overview

### 1.1 Introduction
Imboni is a comprehensive School Management System built with Django REST Framework. It provides a robust API backend for managing school operations including:

- User authentication and authorization
- Student management (including bulk enrollment and CSV import)
- Academic results tracking
- Attendance monitoring
- Behavior reporting
- School announcements
- Teacher portal (dashboard, students, attendance, results, announcements)
- DOS (Director of Studies) portal (dashboard, teacher management, student management)

### 1.2 Technology Stack
| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.x | Programming Language |
| Django | 6.0.1 | Web Framework |
| Django REST Framework | Latest | API Framework |
| MySQL | 8.x | Database |
| Simple JWT | Latest | Authentication |
| django-cors-headers | Latest | CORS Support |
| django-filter | Latest | Filtering Support |

### 1.3 User Roles
| Role | Description |
|------|-------------|
| `admin` | System administrator with full access |
| `dos` | Director of Studies — manages academics, teachers, and students |
| `teacher` | Teachers — manage students, results, attendance, announcements |
| `parent` | Parents — view their children's information |
| `student` | Students — view their own information |

---

## 2. Project Setup

### 2.1 Prerequisites
- Python 3.8 or higher
- MySQL Server
- pip (Python package manager)
- Virtual environment (recommended)

### 2.2 Initial Setup Commands

```bash
# Create project directory
mkdir Imboni
cd Imboni

# Create virtual environment
python -m venv benv

# Activate virtual environment
# On Windows:
benv\Scripts\activate
# On Linux/Mac:
source benv/bin/activate

# Install dependencies
pip install django
pip install djangorestframework
pip install djangorestframework-simplejwt
pip install django-cors-headers
pip install django-filter
pip install mysqlclient
pip install django-debug-toolbar
pip install drf-nested-routers

# Create Django project
django-admin startproject Imboni .

# Create Django apps
python manage.py startapp authentication
python manage.py startapp students
python manage.py startapp results
python manage.py startapp attendance
python manage.py startapp behavior
python manage.py startapp announcements
python manage.py startapp analytics
python manage.py startapp teacher
python manage.py startapp dos
```

### 2.3 Database Setup

Create MySQL database:
```sql
CREATE DATABASE Imboni CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2.4 Running Migrations

```bash
# Create migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Create superuser (optional)
python manage.py createsuperuser

# Run development server
python manage.py runserver
```

---

## 3. Project Structure

```
Imboni/
├── manage.py
├── benv/                        # Virtual environment
├── Imboni/                      # Main project configuration
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── authentication/              # User authentication app
│   ├── models.py                # User (with employment_type) + UserPreferences
│   ├── serializers.py
│   ├── views.py
│   └── urls.py
├── students/                    # Student management app
│   ├── models.py                # Student, ParentStudentRelationship, Fee, StudentDocument
│   ├── serializers.py
│   ├── views.py
│   └── urls.py
├── results/                     # Academic results app
│   ├── models.py                # Subject, AcademicTerm, Result, Assessment
│   └── views.py
├── attendance/                  # Attendance tracking app
│   ├── models.py                # AttendanceRecord, AttendanceSummary
│   └── views.py
├── behavior/                    # Behavior management app
│   ├── models.py                # BehaviorReport, ConductGrade
│   └── views.py
├── announcements/               # School announcements app
│   ├── models.py                # Announcement, AnnouncementRead
│   ├── serializers.py           # AnnouncementSerializer, AnnouncementWriteSerializer
│   ├── views.py                 # Teacher announcement views
│   └── urls.py
├── teacher/                     # Teacher portal app
│   ├── models.py                # SubjectTeacherAssignment, Timetable, Task, Reminder, etc.
│   ├── serializers.py
│   ├── views.py
│   └── urls.py
├── dos/                         # Director of Studies portal app
│   ├── models.py
│   ├── serializers.py
│   ├── views.py
│   └── urls.py
└── analytics/                   # Analytics app (placeholder)
    └── models.py
```

---

## 4. Authentication App

### 4.1 Models (`authentication/models.py`)

#### User Model
```python
class User(AbstractUser):
    USER_ROLES = (
        ('student', 'Student'),
        ('parent', 'Parent'),
        ('teacher', 'Teacher'),
        ('dos', 'Director of Studies'),
        ('admin', 'Administrator'),
    )

    EMPLOYMENT_CHOICES = [
        ('full_time', 'Full-Time'),
        ('part_time', 'Part-Time'),
    ]

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role            = models.CharField(max_length=10, choices=USER_ROLES)
    employment_type = models.CharField(max_length=10, choices=EMPLOYMENT_CHOICES,
                                       default='full_time', blank=True)  # added in migration 0002
    phone_number    = models.CharField(max_length=20, blank=True)
    avatar          = models.ImageField(upload_to='avatars/', null=True, blank=True)
    date_of_birth   = models.DateField(null=True, blank=True)
    address         = models.TextField(blank=True)
    emergency_contact = models.CharField(max_length=15, blank=True)
    is_active       = models.BooleanField(default=True)
    email_verified  = models.BooleanField(default=False)
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'users'
```

#### UserPreferences Model
```python
class UserPreferences(models.Model):
    user               = models.OneToOneField(User, on_delete=models.CASCADE)
    notification_email = models.BooleanField(default=True)
    notification_sms   = models.BooleanField(default=False)
    notification_push  = models.BooleanField(default=True)
    language           = models.CharField(max_length=10, default='en')
    timezone           = models.CharField(max_length=50, default='Africa/Kigali')
    theme              = models.CharField(max_length=20, default='light')

    class Meta:
        db_table = 'user_preferences'
```

### 4.2 Migrations
| Migration | Description |
|-----------|-------------|
| `0001_initial` | Initial User and UserPreferences models |
| `0002_add_employment_type` | Added `employment_type` field to User |

---

## 5. Students App

### 5.1 Models (`students/models.py`)

- **`Student`** — grade, section, student_id, status, medical info, attendance_percentage
- **`ParentStudentRelationship`** — links a parent `User` to their `Student` children (relationship_type: mother/father/guardian)
- **`Fee`** — per-student fee records (tuition, transport, lunch, uniform, activity)
- **`StudentDocument`** — documents attached to a student (newsletter, consent form, report, certificate)

---

## 6. Results App

### 6.1 Models (`results/models.py`)

- **`Subject`** — name, code, credit_hours
- **`AcademicTerm`** — term (term1/term2/term3), year, start_date, end_date, is_current
- **`Result`** — quiz_average, group_work, exam_score, final_score, grade (A-F), status (draft/submitted/approved/rejected), teacher_comment, dos_comment
- **`Assessment`** — individual quiz/homework/project scores per student per subject

---

## 7. Attendance App

### 7.1 Models (`attendance/models.py`)

- **`AttendanceRecord`** — per-student per-day record (present/absent/late/excused)
- **`AttendanceSummary`** — monthly rollup per student (total_days, present_days, absent_days, attendance_percentage)

---

## 8. Behavior App

### 8.1 Models (`behavior/models.py`)

- **`BehaviorReport`** — report_type (positive/warning/incident/achievement), severity, title, description, parents_notified
- **`ConductGrade`** — term conduct grade (A-F) with positive/warning/incident counts

---

## 9. Announcements App

### 9.1 Models (`announcements/models.py`)

- **`Announcement`** — title, content, category (urgent/academic/event/general), target_audience, status (draft/published), published_at, expires_at
- **`AnnouncementRead`** — tracks which users have read which announcements

### 9.2 Teacher Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/imboni/announcements/teacher/` | List announcements (`?tab=all\|academic\|events\|general\|drafts`) |
| POST | `/imboni/announcements/teacher/` | Create announcement |
| GET | `/imboni/announcements/teacher/<uuid:pk>/` | Get single announcement |
| PATCH | `/imboni/announcements/teacher/<uuid:pk>/` | Update announcement |
| DELETE | `/imboni/announcements/teacher/<uuid:pk>/` | Delete announcement |
| GET | `/imboni/announcements/teacher/templates/` | Get 6 quick templates |
| GET | `/imboni/announcements/teacher/audience-options/` | Get target audience options |

---

## 10. Teacher App

### 10.1 Overview
The `teacher` app powers the full teacher portal. It uses a mix of `DefaultRouter` (for simple CRUD models) and `APIView` (for aggregation/computed views).

### 10.2 Models (`teacher/models.py`)
- **`SubjectTeacherAssignment`** — links a teacher to a subject + class for a term
- **`Timetable`** — weekly schedule entries per teacher
- **`Task`** — teacher to-do items
- **`Reminder`** — teacher reminders

### 10.3 API Endpoints

#### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/imboni/teacher/dashboard/stats/` | Stat cards (students, attendance, pending results, classes) |
| GET | `/imboni/teacher/my-timetable/` | Full weekly timetable |
| GET | `/imboni/teacher/my-timetable/today/` | Today's schedule with status |
| GET | `/imboni/teacher/my-classes/` | Class grid (`?search= ?grade_filter= ?high_performers=`) |
| GET | `/imboni/teacher/my-classes/homework-status/` | Homework submission progress bars |
| GET | `/imboni/teacher/class-performance/` | Class performance progress bars |
| GET | `/imboni/teacher/recent-activities/` | Recent activity feed |
| GET | `/imboni/teacher/deadlines/` | Upcoming deadlines (`?month=&year=`) |

#### Students Page
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/imboni/teacher/students/` | Student list (`?search= ?class_id= ?performance= ?attendance=`) |
| GET | `/imboni/teacher/students/performance-distribution/` | Performance histogram |
| GET | `/imboni/teacher/students/attendance-trends/` | Attendance trends (last 4 weeks) |

#### Attendance Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/imboni/teacher/attendance/stats/` | Attendance stat cards (`?class_id=&date=`) |
| GET | `/imboni/teacher/attendance/students/` | Students list for marking (`?class_id=&date=`) |
| POST | `/imboni/teacher/attendance/mark/` | Bulk save attendance records |
| GET | `/imboni/teacher/attendance/patterns/` | Day-of-week patterns chart |

#### Results Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/imboni/teacher/results/list/` | Results table (`?class_id=&assessment_title=`) |
| POST | `/imboni/teacher/results/bulk-save/` | Bulk save / add results |
| GET | `/imboni/teacher/results/grade-distribution/` | Grade distribution analysis |
| GET | `/imboni/teacher/results/performance-trends/` | Performance trends line graph |

---

## 11. DOS App

### 11.1 Overview
The `dos` app is a **dedicated app for the Director of Studies portal**. Each role has its own app to avoid one app doing multiple roles.

All views use `APIView` because they aggregate data from multiple models and return computed responses — not simple single-model CRUD.

### 11.2 API Endpoints

#### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/imboni/dos/dashboard/stats/` | Stat cards (total students, teaching staff, avg performance, pending approvals) |
| GET | `/imboni/dos/dashboard/recent-activity/` | Unified activity feed (approvals, new teachers, pending) |
| GET | `/imboni/dos/dashboard/performance-overview/` | School average + attendance rate progress bars |
| GET | `/imboni/dos/dashboard/performance-by-grade/` | Average score per grade bar chart |

#### Teacher Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/imboni/dos/teachers/stats/` | Stat cards (total, full-time/part-time split, student-teacher ratio) |
| GET | `/imboni/dos/teachers/` | Teacher list (`?search= ?employment_type= ?subject_id=`) |
| POST | `/imboni/dos/teachers/` | Add a new teacher |
| GET | `/imboni/dos/teachers/by-subject/` | Teachers grouped by subject |
| GET | `/imboni/dos/teachers/workload-distribution/` | Workload chart (1-2, 3-4, 5+ classes) |
| GET | `/imboni/dos/teachers/performance-ratings/` | Teacher ratings (Excellent/Good/Average/Needs Improvement) |

#### Student Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/imboni/dos/students/stats/` | Stat cards (total, active, new admissions, avg performance) |
| GET | `/imboni/dos/students/` | Student list (`?search= ?grade= ?status=`) |
| POST | `/imboni/dos/students/` | Add a single student |
| POST | `/imboni/dos/students/bulk-create/` | Bulk create students (JSON list) — for term-start enrollment |
| POST | `/imboni/dos/students/import-csv/` | Import students from CSV file — ideal for 500+ students |
| GET | `/imboni/dos/students/enrollment-by-grade/` | Enrollment count per grade |
| GET | `/imboni/dos/students/performance-distribution/` | Performance donut chart |
| GET | `/imboni/dos/students/enrollment-trends/` | Enrollment by year line chart |

### 11.3 Bulk Enrollment (Term Start)

**JSON bulk create** — `POST /imboni/dos/students/bulk-create/`
```json
{
    "default_password": "Imboni@2025",
    "students": [
        {"first_name": "Alice", "last_name": "Uwase", "email": "alice@school.rw",
         "grade": "6", "section": "A", "enrollment_date": "2025-01-10"},
        ...
    ]
}
```

**CSV import** — `POST /imboni/dos/students/import-csv/` (multipart/form-data)

Required CSV columns: `first_name`, `last_name`, `email`, `grade`, `section`
Optional column: `enrollment_date` (falls back to form field or today)

Both return:
```json
{"created": 480, "skipped": 5, "failed": 2, "errors": [{"row": 3, "email": "x@y.com", "error": "..."}]}
```

Key behaviors:
- `default_password` — one password for all students; they change it on first login
- Duplicate emails are **skipped** (not failed) — safe to re-upload the same file
- Each row is wrapped in `transaction.atomic()` — one bad row does not cancel the rest

---

## 12. Configuration Settings

### 12.1 INSTALLED_APPS
```python
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    # Local apps
    'authentication',
    'debug_toolbar',
    'students',
    'results',
    'attendance',
    'behavior',
    'announcements',
    'analytics',
    'teacher',
    'messages.apps.MessagesConfig',
    'dos',
]
```

### 12.2 Main URLs (`Imboni/urls.py`)
```python
urlpatterns = [
    path('admin/',      admin.site.urls),
    path('__debug__/', include('debug_toolbar.urls')),
    path('imboni/',    include('students.urls')),
    path('imboni/',    include('authentication.urls')),
    path('imboni/',    include('results.urls')),
    path('imboni/',    include('messages.urls')),
    path('imboni/',    include('teacher.urls')),
    path('imboni/',    include('attendance.urls')),
    path('imboni/',    include('behavior.urls')),
    path('imboni/',    include('announcements.urls')),
    path('imboni/',    include('dos.urls')),
]
```

### 12.3 REST Framework Configuration
```python
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',  # Development — change to IsAuthenticated in production
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
}
```

### 12.4 JWT Configuration
```python
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME':  timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS':  True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}
```

---

## 13. API Endpoints — Full Summary

### 13.1 Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/imboni/auth/login/` | Login — returns JWT access + refresh token |
| POST | `/imboni/auth/logout/` | Logout |
| GET | `/imboni/users/me/` | Current user profile |
| POST | `/imboni/users/register/` | Register new user |
| POST | `/imboni/users/change_password/` | Change password |

### 13.2 Teacher Portal (~25 endpoints)
See [Section 10.3](#103-api-endpoints) for full list.

Base path: `/imboni/teacher/`

Pages covered: Dashboard, Students, Attendance Management, Results Management, Announcements

### 13.3 DOS Portal (~16 endpoints)
See [Section 11.2](#112-api-endpoints) for full list.

Base path: `/imboni/dos/`

Pages covered: Dashboard, Teacher Management, Student Management (including bulk enrollment)

### 13.4 Students
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/imboni/students/` | List all students |
| POST | `/imboni/students/` | Create student |
| GET | `/imboni/students/<id>/` | Student detail |
| GET | `/imboni/students/<id>/attendance/` | Student attendance |
| GET | `/imboni/students/<id>/results/` | Student results |
| GET | `/imboni/students/<id>/behavior/` | Student behavior reports |

---

## 14. Sample Data

### 14.1 Creating Sample Data

```bash
python manage.py create_sample_data
```

### 14.2 Sample Users Created

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | admin123 |
| DOS | dos | dos123 |
| Teachers | teacher1, teacher2, teacher3 | teacher123 |
| Parents | parent1–parent5 | parent123 |
| Students | student1–student10 | student123 |

---

## 15. Testing Guide

### 15.1 Login and get token
```bash
curl -X POST http://localhost:8000/imboni/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "dos", "password": "dos123"}'
```

### 15.2 DOS — Add teacher
```bash
curl -X POST http://localhost:8000/imboni/dos/teachers/ \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Jean", "last_name": "Habimana",
    "email": "jean@school.rw", "phone_number": "+250788000001",
    "employment_type": "full_time", "password": "Teacher@2025"
  }'
```

### 15.3 DOS — Bulk enroll students (JSON)
```bash
curl -X POST http://localhost:8000/imboni/dos/students/bulk-create/ \
  -H "Content-Type: application/json" \
  -d '{
    "default_password": "Imboni@2025",
    "students": [
      {"first_name":"Alice","last_name":"Uwase","email":"alice@school.rw",
       "grade":"6","section":"A","enrollment_date":"2025-01-10"},
      {"first_name":"Bob","last_name":"Nkurunziza","email":"bob@school.rw",
       "grade":"5","section":"B","enrollment_date":"2025-01-10"}
    ]
  }'
```

### 15.4 DOS — Import students from CSV
```bash
curl -X POST http://localhost:8000/imboni/dos/students/import-csv/ \
  -F "file=@students.csv" \
  -F "default_password=Imboni@2025"
```

### 15.5 Teacher — Mark attendance
```bash
curl -X POST http://localhost:8000/imboni/teacher/attendance/mark/ \
  -H "Content-Type: application/json" \
  -d '{
    "class_id": "<uuid>", "date": "2025-03-05",
    "records": [
      {"student_id": "<uuid>", "status": "present"},
      {"student_id": "<uuid>", "status": "absent"}
    ]
  }'
```

---

## Appendix A: Architecture Decisions

### Why APIView instead of generics for DOS/Teacher views?
Generic views (`ListCreateAPIView`, etc.) require **one queryset + one serializer**. DOS and Teacher views aggregate data from multiple models (Results, Attendance, User, Student simultaneously) and use different serializers for GET vs POST. `APIView` gives full control without fighting the abstraction.

### Why DRF Router for some Teacher views but not others?
The `DefaultRouter` is used for simple CRUD ViewSets (TeacherViewSet, TaskViewSet, ReminderViewSet). Custom aggregation views (dashboard stats, attendance patterns, etc.) use `path()` + `APIView` since routers only work with ViewSets.

### Why a dedicated `dos` app?
Each user role has its own app (`teacher`, `dos`, future: `parent`, `student`). This keeps each app focused on one responsibility and prevents one app from doing multiple roles.

### Bulk enrollment design
At term start, DOS cannot create 500+ students one-by-one. Two endpoints address this:
- `bulk-create/` — JSON payload, good for form-based UI
- `import-csv/` — CSV file, good for spreadsheet imports

---

## Appendix B: Pending Work

| Item | Priority | Notes |
|------|----------|-------|
| Authentication endpoints | Critical | Login/logout/token refresh exist but permissions are disabled |
| Role-based permissions (`IsDOS`, `IsTeacher`) | Critical | All `permission_classes` are commented out |
| Parent portal | High | `ParentStudentRelationship` model exists, app not yet created |
| Student portal | High | Students viewing own grades/attendance |
| Report card generation | Medium | PDF export end of term |
| Timetable management | Medium | Class schedules |
| Optimization pass | Low | Remove duplicate `grade_label` dict, consolidate student ID logic |

---

## Document Information

| Field | Value |
|-------|-------|
| Project Name | Imboni School Management System |
| Version | 1.1.0 |
| Framework | Django 6.0.1 |
| API Framework | Django REST Framework |
| Last Updated | March 2026 |

---

*This document covers all implemented endpoints and architecture decisions up to and including the DOS portal (Teacher Management + Student Management with bulk enrollment).*
