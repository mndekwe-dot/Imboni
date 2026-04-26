# Imboni — School Management System

> **Status: Active Development** — React frontend complete. Django REST API backend in progress.

**Imboni Education Connects** is a full-stack, multi-role school management platform built to digitise academic operations for secondary schools. It provides dedicated portals for every stakeholder — from the Director of Studies down to students and parents — each with role-appropriate data, actions, and workflows.

---

## Screenshots

**Landing Page**
![Landing Page](/Screenshots/Screenshot%202026-03-24%20144243.png)

**Director of Studies — Dashboard**
![DOS Dashboard](/Screenshots/Screenshot%202026-03-24%20144355.png)

**Student Portal — Results**
![Student Portal](/Screenshots/Screenshot%202026-03-24%20144408.png)

**Mobile View — Responsive Design**
![Mobile View](/Screenshots/Screenshot%202026-03-24%20144429.png)

---

## Portals

| Role | Key Responsibilities |
|---|---|
| Director of Studies | Analytics, results approval, timetables, exam schedules, attendance overview |
| Teacher | Classes, attendance, results entry, assignments, timetable, messaging |
| Student | Timetable, results, assignments, attendance record, activities, discipline |
| Parent | Monitor children's results, attendance, behaviour, announcements |
| Discipline Master | Behaviour records, boarding, dining, student leaders, activities |
| Matron | Student welfare, health, incidents, schedule, messaging |

---

## Features

### Authentication & Access Control
- Invitation-based registration — users are invited by an admin, not self-registered
- Role-based permissions (DOS, Teacher, Student, Parent, Discipline, Matron)
- JWT token authentication
- Password reset via email with secure token links

### Director of Studies Portal
- **Dashboard** — school-wide KPIs at a glance
- **Analytics** — attendance trends, result distributions, class comparisons
- **Results Approval** — review and approve teacher-submitted results before publication
- **Teacher Management** — view all teaching staff, subjects, and class assignments
- **Student Management** — full student directory with academic standing
- **Attendance** — weekly attendance register per class, filterable by subject and year group
- **Exam Schedule** — plan and publish exam timetables for O-Level (S1–S3) and A-Level (S4–S6) with room allocation
- **Timetable** — weekly class timetable management
- **Announcements** — create and publish school-wide announcements by audience

### Teacher Portal
- Class roster and student profiles
- Mark attendance per lesson with daily/weekly/monthly/report views
- Enter and submit academic results per assignment
- Create and manage paper and online (auto-marked) assignments
- Weekly timetable view
- Direct messaging with parents and staff

### Student Portal
- Personal weekly timetable
- Results history and performance trends
- Assignment tracker (upcoming, submitted, graded)
- Attendance record
- School announcements
- Discipline record
- Co-curricular activities

### Parent Portal
- Monitor multiple children from one account
- View each child's results, attendance, behaviour reports
- Receive school announcements
- Direct communication with school

### Discipline Portal
- Student behaviour incident recording and management
- Boarding and dormitory management
- Dining schedule and meal planning
- Activity scheduling and tracking
- Student leader management
- Staff communication

### Matron Portal
- Student welfare and sick bay tracking
- Health and wellness records
- Incident reporting with parent notifications
- Daily schedule management
- Messaging with parents

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

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 19 |
| Routing | React Router v7 |
| Styling | Custom CSS — CSS variables, responsive grid, no UI library |
| Charts | Recharts |
| Icons | Google Material Symbols Rounded |
| Typography | Inter (Google Fonts) |
| Build tool | Vite |

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
│   └── apps/
│       ├── authentication/  # User models, JWT auth, invitation system
│       ├── analytics/       # School-wide analytics endpoints
│       ├── announcements/   # Announcement CRUD and audience targeting
│       ├── attendance/      # Student and teacher attendance records
│       ├── behavior/        # Discipline and behaviour incidents
│       ├── discipline/      # Discipline master app
│       ├── dos/             # Director of Studies views and reports
│       ├── matron/          # Matron portal views
│       ├── messages/        # Internal messaging system
│       ├── parents/         # Parent portal and child linking
│       ├── results/         # Academic results and approval workflow
│       ├── student/         # Student portal views
│       └── teacher/         # Teacher portal views
│
└── Frontend/                # React + Vite application
    ├── src/
    │   ├── assets/          # Images and static files
    │   ├── components/      # Shared layout and UI components
    │   │   ├── layout/      # Sidebar, DashboardHeader, WelcomeBanner, etc.
    │   │   └── ui/          # DataTable, Modal, ClassPicker, FilterBar, etc.
    │   ├── pages/           # Page components per portal
    │   │   ├── Admin/
    │   │   ├── Dis/         # Discipline portal
    │   │   ├── Dos/         # Director of Studies
    │   │   ├── Matron/
    │   │   ├── Parent/
    │   │   ├── Student/
    │   │   └── Teacher/
    │   └── styles/          # Per-portal and shared CSS files
    └── index.html
```

---

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- pip, npm

### Backend

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

API available at `http://127.0.0.1:8000/`

### Frontend

```bash
cd Frontend
npm install
npm run dev
```

App available at `http://localhost:5173/`

---

## Roadmap

- [x] Multi-role authentication with invitation system
- [x] Director of Studies portal — analytics, results approval, exam schedule, timetable
- [x] Teacher portal — classes, attendance, results, assignments, timetable, messaging
- [x] Student, Parent, Discipline, Matron portals
- [x] React frontend — all portals fully built
- [x] Responsive design (mobile + tablet + desktop)
- [x] Shared component library (DataTable, Modal, ClassPicker, FilterBar, etc.)
- [ ] React frontend connected to Django REST API
- [ ] Real-time notifications (WebSockets)
- [ ] PDF report generation
- [ ] Multi-tenant support (one platform, multiple schools)
- [ ] MTN Mobile Money billing integration

---

## Design Decisions

**Why invitation-based auth instead of open registration?**
A school is a closed community. Teachers, students, and parents should be added by an administrator — not self-register. This prevents unauthorized access and ensures every account is tied to a real person.

**Why Django REST Framework?**
Django's ORM and DRF together make it easy to write clean, testable, permission-aware API endpoints. The permission system maps cleanly onto the multi-role structure of a school.

**Why custom CSS instead of Tailwind or a UI library?**
The design system uses CSS variables throughout, giving full control over every token (color, spacing, radius, shadow) per portal. No third-party class names leak into the markup, and the bundle stays small.

---

## Author

Built by **NDEKWE Dieu Merci**
Rwanda | 2025–2026

---

## License

This project is private and not licensed for redistribution.
