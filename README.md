# Imboni — School Management System

> **Status: Active Development** — Core features are functional. The frontend is currently built with HTML/CSS/JS and will be migrated to **React** in the next phase.

**Imboni Education Connects** is a full-stack, multi-role school management platform built to digitise academic operations for secondary schools. It provides dedicated portals for every stakeholder in a school — from the Director of Studies down to students and parents — each with role-appropriate data, actions, and workflows.

---

## Screenshots

> Screenshots below show the current HTML/CSS prototype. The React frontend is in progress.

**Director of Studies — Dashboard**
![DOS Dashboard](<Screenshot 2026-03-24 144243.png>)

**Student Portal — Timetable & Results**
![Student Portal](<Screenshot 2026-03-24 144355.png>)

**Parent Portal — My Children**
![Parent Portal](<Screenshot 2026-03-24 144408.png>)

**Mobile View — Responsive Design**
![Mobile View](<Screenshot 2026-03-24 144429.png>)

---

## Portals

| Role | Key Responsibilities |
|---|---|
| Director of Studies | Analytics, results approval, timetables, exam schedules, attendance overview |
| Teacher | Class attendance, results entry, announcements, student management |
| Student | Timetable, results, announcements, assignments, attendance record |
| Parent | Monitor children's results, attendance, behaviour, announcements |
| Discipline Master | Behaviour records, boarding, dining, student leaders, activities |
| Matron | Student welfare, incidents, health schedule, messaging |

---

## Features

### Authentication & Access Control
- Invitation-based registration — users are invited by an admin, not self-registered
- Role-based permissions (DOS, Teacher, Student, Parent, Discipline, Matron)
- JWT token authentication
- Password reset via email with secure token links
- Multi-channel invitation delivery (email + SMS)

### Director of Studies Portal
- **Dashboard** — school-wide KPIs at a glance
- **Analytics** — attendance trends, result distributions, class comparisons
- **Results Approval** — review and approve teacher-submitted results before publication
- **Teacher Management** — view all teaching staff, subjects, and attendance
- **Student Management** — full student directory with academic standing
- **Attendance** — weekly attendance register per class and per teacher, filterable by subject and year group
- **Exam Schedule** — plan, edit, and publish exam timetables for Ordinary (S1–S3) and Advanced (S4–S6) levels with room allocation and CSV export
- **Timetable** — weekly class timetable management
- **Announcements** — create and publish school-wide announcements by audience

### Teacher Portal
- Class roster and student profiles
- Mark attendance per lesson
- Enter and submit academic results
- View and post announcements
- Direct messaging

### Student Portal
- Personal weekly timetable
- Results history and performance trends
- Upcoming exam schedule (filtered to their class)
- Announcement inbox (school-wide + class-specific)
- Attendance record
- Assignments tracker
- Discipline record

### Parent Portal
- Monitor multiple children from one account
- View each child's results, attendance, behaviour reports
- Receive school announcements
- Direct communication with school

### Discipline Portal
- Student behaviour incident recording
- Boarding and dining management
- Activity scheduling
- Student leader management
- Staff communication

### Matron Portal
- Student welfare tracking
- Health and schedule management
- Incident reporting
- Messaging

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Framework | Django (Python 3.13) |
| API | Django REST Framework |
| Authentication | JWT (SimpleJWT) |
| Database | PostgreSQL (SQLite for development) |
| Email | Django email with SMTP |

### Frontend — Current
| Layer | Technology |
|---|---|
| Markup | Semantic HTML5 |
| Styling | Custom CSS — CSS variables, clamp(), responsive grid |
| Scripting | Vanilla JavaScript |
| Icons | Google Material Symbols Rounded |
| Typography | Inter (Google Fonts) |

### Frontend — Planned (Next Phase)
| Layer | Technology |
|---|---|
| Framework | React |
| State Management | TBD |
| Styling | TBD (CSS Modules or Tailwind) |
| Routing | React Router |

### Infrastructure (recommended)
| Component | Tool |
|---|---|
| Web server | Nginx |
| Application server | Gunicorn |
| Database | PostgreSQL 15 |
| CDN & DDoS protection | Cloudflare |
| SSL | Let's Encrypt via Certbot |

---

## Project Structure

```
Imboni/
├── Backend/
│   ├── Imboni/              # Django project settings & URL routing
│   ├── apps/                # All Django applications
│   │   ├── authentication/  # User models, JWT auth, invitation system, permissions
│   │   ├── analytics/       # School-wide analytics endpoints
│   │   ├── announcements/   # Announcement CRUD and audience targeting
│   │   ├── attendance/      # Student and teacher attendance records
│   │   ├── behavior/        # Discipline and behaviour incidents
│   │   ├── discipline/      # Discipline master app
│   │   ├── dos/             # Director of Studies views and reports
│   │   ├── matron/          # Matron portal views
│   │   ├── messages/        # Internal messaging system
│   │   ├── parents/         # Parent portal and child linking
│   │   ├── results/         # Academic results and approval workflow
│   │   ├── student/         # Student portal views
│   │   └── teacher/         # Teacher portal views
│   └── templates/           # Email templates, PDF report templates
│
└── Frontend/                # HTML/CSS/JS prototype (React migration in progress)
    ├── css/                 # Modular CSS files
    ├── js/                  # Shared JavaScript logic
    ├── Dos/                 # Director of Studies pages
    ├── Teacher/             # Teacher pages
    ├── Student/             # Student pages
    ├── Parent/              # Parent pages
    ├── Discipline/          # Discipline pages
    └── Matron/              # Matron pages
```

---

## Getting Started

### Prerequisites
- Python 3.11+
- pip
- Git

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/mndekwe-dot/Imboni.git
cd Imboni

# 2. Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # Linux/macOS
venv\Scripts\activate           # Windows

# 3. Install dependencies
pip install -r Backend/requirements.txt

# 4. Set up environment variables
cp .env.example .env
# Edit .env with your values

# 5. Run migrations
cd Backend
python manage.py migrate

# 6. Create a superuser
python manage.py createsuperuser

# 7. Start the development server
python manage.py runserver
```

The API will be available at `http://127.0.0.1:8000/`

---

## Roadmap

- [x] Multi-role authentication with invitation system
- [x] Director of Studies portal — analytics, results approval, exam schedule, attendance
- [x] Teacher, Student, Parent, Discipline, Matron portals
- [x] Responsive frontend (mobile + tablet + desktop)
- [ ] React frontend migration
- [ ] Multi-tenant support (one platform, multiple schools)
- [ ] MTN Mobile Money billing integration
- [ ] Real-time notifications
- [ ] PDF report generation

---

## Design Decisions

**Why invitation-based auth instead of open registration?**
A school is a closed community. Teachers, students, and parents should be added by an administrator — not self-register. This prevents unauthorized access and ensures every account is verified.

**Why Django REST Framework?**
Django's ORM and DRF together make it easy to write clean, testable, permission-aware API endpoints. The permission system maps cleanly onto the multi-role structure of a school.

**Why vanilla JS for the current frontend?**
The prototype was built with HTML/CSS/JS to move fast and validate the UI without framework overhead. The React migration will bring proper component reuse, state management, and a better developer experience as the codebase grows.

---

## Author

Built by **NDEKWE Dieu Merci**
Rwanda | 2025–2026

---

## License

This project is private and not licensed for redistribution.
