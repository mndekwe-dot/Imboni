# Imboni — School Management System

**Imboni Education Connects** is a full-stack, multi-role school management platform built to digitise academic operations for secondary schools. It provides dedicated portals for every stakeholder in a school — from the Director of Studies down to students and parents — each with role-appropriate data, actions, and workflows.

---

## Live Portals

| Role | Portal | Key Responsibilities |
|---|---|---|
| Director of Studies | `Dos/dos.html` | Analytics, results approval, timetables, exam schedules, attendance overview |
| Teacher | `Teacher/teacher.html` | Class attendance, results entry, announcements, student management |
| Student | `Student/student.html` | Timetable, results, announcements, assignments, attendance record |
| Parent | `Parent/parent.html` | Monitor children's results, attendance, behaviour, announcements |
| Discipline Master | `Discipline/discipline.html` | Behaviour records, boarding, dining, student leaders, activities |
| Matron | `Matron/matron.html` | Student welfare, incidents, health schedule, messaging |

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
- **Attendance** — weekly attendance register per class (students) and per teacher, filterable by subject and year group
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
| Framework | Django 4.x (Python 3.13) |
| API | Django REST Framework |
| Authentication | JWT (SimpleJWT) |
| Database | PostgreSQL (SQLite for development) |
| Email | Django email with SMTP |
| Task Queue | Celery + Redis *(planned)* |

### Frontend
| Layer | Technology |
|---|---|
| Markup | Semantic HTML5 |
| Styling | Custom CSS (no framework) — CSS variables, clamp(), responsive grid |
| Scripting | Vanilla JavaScript — no framework dependencies |
| Icons | Google Material Symbols Rounded |
| Typography | Inter (Google Fonts) |

### Infrastructure (recommended)
| Component | Tool |
|---|---|
| Web server | Nginx |
| Application server | Gunicorn |
| Database | PostgreSQL 15 |
| CDN & DDoS protection | Cloudflare (free tier) |
| SSL | Let's Encrypt via Certbot |

---

## Project Structure

```
Imboni/
├── Backend/
│   ├── Imboni/              # Django project settings & URL routing
│   ├── authentication/      # User models, JWT auth, invitation system, permissions
│   ├── analytics/           # School-wide analytics endpoints
│   ├── announcements/       # Announcement CRUD and audience targeting
│   ├── attendance/          # Student and teacher attendance records
│   ├── behavior/            # Discipline and behaviour incidents
│   ├── discipline/          # Discipline master app
│   ├── dos/                 # Director of Studies views and reports
│   ├── matron/              # Matron portal views
│   ├── messages/            # Internal messaging system
│   ├── parents/             # Parent portal and child linking
│   ├── results/             # Academic results and approval workflow
│   ├── student/             # Student portal views
│   ├── teacher/             # Teacher portal views
│   └── templates/           # Email templates, PDF report templates
│
└── Frontend/
    ├── css/                 # Modular CSS files
    │   ├── globals.css      # CSS variables, design tokens, dark mode
    │   ├── layout.css       # Sidebar, header, dashboard shell
    │   ├── components.css   # Shared UI components (cards, badges, tables, forms)
    │   ├── dos.css          # DOS portal styles
    │   ├── discipline.css   # Discipline portal styles
    │   ├── student.css      # Student portal styles
    │   ├── parent.css       # Parent portal styles
    │   ├── teacher.css      # Teacher portal styles
    │   ├── matron.css       # Matron portal styles
    │   └── my-children.css  # Parent children management
    ├── js/
    │   └── dashboard.js     # Sidebar, mobile menu, theme toggle, shared UI logic
    ├── Dos/                 # Director of Studies pages (11 pages)
    ├── Teacher/             # Teacher pages (8 pages)
    ├── Student/             # Student pages (9 pages)
    ├── Parent/              # Parent pages (7 pages)
    ├── Discipline/          # Discipline pages (10 pages)
    ├── Matron/              # Matron pages (5 pages)
    └── images/              # Logo and assets
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
git clone https://github.com/YOUR_USERNAME/imboni.git
cd imboni

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

# 6. Create a superuser (school admin)
python manage.py createsuperuser

# 7. Start the development server
python manage.py runserver
```

The API will be available at `http://127.0.0.1:8000/`
Open any HTML file in the `Frontend/` folder in your browser.

---

## Design Decisions

**Why vanilla JS and CSS instead of React/Vue?**
Schools in low-bandwidth environments need pages that load fast with no JavaScript bundle to download and parse. Vanilla HTML/CSS/JS loads instantly on any connection. The CSS is written entirely with custom properties (variables) so it is easy to theme and maintain without a preprocessor.

**Why invitation-based auth instead of open registration?**
A school is a closed community. Teachers, students, and parents should be added by an administrator — not self-register. This prevents unauthorized access and ensures every account is verified.

**Why Django REST Framework?**
Django's ORM and DRF together make it easy to write clean, testable, permission-aware API endpoints quickly. The permission system maps cleanly onto the multi-role structure of a school.

---

## Author

Built by **[Your Name]**
Rwanda | 2025–2026

---

## License

This project is private and not licensed for redistribution.
