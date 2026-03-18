# Hiding Secrets & Environment Variables — Complete Study Guide
# Related to: Imboni School Management System (Django Backend)

---

## Table of Contents

1. What is a Secret?
2. Why You Must NEVER Hardcode Secrets
3. What Are Environment Variables?
4. How .env Files Work
5. python-decouple — The Tool We Use
6. Step-by-Step: Setting It Up in Your Project
7. Applying It to Your settings.py
8. The .gitignore File — Keeping .env Off GitHub
9. Different .env For Different Environments
10. What If Someone Else Clones Your Project?
11. Secrets in Production (Server)
12. Common Mistakes
13. Cheat Sheet
14. Your Project — Full Before & After

---

## 1. What is a Secret?

A secret is any value that:
- Gives access to something (database, email, payment system)
- Would cause damage if someone else had it
- Is unique to your environment (different on your laptop vs server)

**Secrets in your Imboni project right now:**

| Secret | Where | Risk if leaked |
|---|---|---|
| `SECRET_KEY` | settings.py line 27 | Anyone can forge session tokens, bypass security |
| `DATABASE PASSWORD` | settings.py line 110 | Anyone can read/delete your entire school database |
| `EMAIL_HOST_PASSWORD` | settings.py | Anyone can send emails as your school |

---

## 2. Why You Must NEVER Hardcode Secrets

**Hardcoded** means written directly in your code file:

```python
# BAD — hardcoded
SECRET_KEY = 'django-insecure-(0poduddq...'
'PASSWORD': 'mercermerc123@M',
```

### The Problem

Your code lives on GitHub. GitHub is public (or semi-public). Anyone who can see your code can see these values.

**Real scenario:**
```
You push code to GitHub
    ↓
A bot scans GitHub every minute looking for passwords
    ↓
Bot finds 'PASSWORD': 'mercermerc123@M'
    ↓
Bot tries that password on common database ports
    ↓
Your entire school database is compromised
```

This is not theoretical. GitHub bots scan for secrets 24/7. It happens within minutes of a push.

### Another Problem — One Codebase, Many Environments

Your project runs in at least 3 places:
- Your laptop (development)
- Your teammate's laptop
- The production server

Each of these needs **different** database passwords, different email credentials, different debug settings. If they're hardcoded, you have to change the file every time you switch environments. That's messy and dangerous.

---

## 3. What Are Environment Variables?

Environment variables are values stored **outside your code**, in the operating system or a special file.

Think of it like this:

```
Your code (on GitHub, public):
    settings.py → reads DATABASE_PASSWORD from environment

Your environment (private, not on GitHub):
    DATABASE_PASSWORD = mercermerc123@M
```

The code says "go find a variable called DATABASE_PASSWORD" but never says what the value is. The value lives elsewhere.

### How Django Reads Them

```python
import os

# os.environ.get('KEY', 'default_if_not_found')
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'fallback-value')
```

`os.environ` is a dictionary of all environment variables set on your system.

---

## 4. How .env Files Work

Setting environment variables manually in your operating system is tedious. Instead, we use a `.env` file — a simple text file that holds all your secrets locally.

```
# .env file (lives in your project, NEVER uploaded to GitHub)
DJANGO_SECRET_KEY=django-insecure-(0poduddq...
DB_PASSWORD=mercermerc123@M
EMAIL_HOST_USER=ndekwe22@gmail.com
EMAIL_HOST_PASSWORD=your_app_password
DEBUG=True
```

A library reads this file and loads all the values as environment variables when Django starts. Your code never reads the file directly — it reads the environment variables that were loaded from the file.

```
.env file
    ↓ loaded by python-decouple
Environment variables
    ↓ read by
settings.py
```

### The Golden Rule

```
.env  →  NEVER goes to GitHub
.env.example  →  GOES to GitHub (with fake/empty values to show structure)
```

---

## 5. python-decouple — The Tool We Use

`python-decouple` is a library that reads your `.env` file and makes values available in `settings.py`.

### Why python-decouple over raw os.environ?

| Feature | `os.environ` | `python-decouple` |
|---|---|---|
| Reads .env file | ❌ No | ✅ Yes |
| Type casting (str to bool) | ❌ Manual | ✅ Automatic |
| Default values | ✅ Yes | ✅ Yes |
| Clean syntax | Okay | Cleaner |

### Install It

```bash
pip install python-decouple
```

### Basic Usage

```python
from decouple import config

SECRET_KEY = config('DJANGO_SECRET_KEY')
DEBUG       = config('DEBUG', default=False, cast=bool)
DB_PASSWORD = config('DB_PASSWORD')
```

`config('KEY')` — reads the KEY from .env or environment variables
`default=` — value to use if KEY is not found
`cast=bool` — converts the string "True" to a real Python `True`

---

## 6. Step-by-Step: Setting It Up in Your Project

### Step 1 — Install python-decouple

```bash
cd Backend
pip install python-decouple
pip freeze > requirements.txt
```

### Step 2 — Create the .env file

Create a file named `.env` inside your `Backend/` folder (same level as `manage.py`):

```
# Backend/.env

# Django
DJANGO_SECRET_KEY=django-insecure-(0poduddq(b$#ut=h)brljaxe1xm-4er)==lv_23ek!f9+y0ia
DEBUG=True

# Database
DB_NAME=imboni_db
DB_USER=postgres
DB_PASSWORD=mercermerc123@M
DB_HOST=localhost
DB_PORT=5432

# Email (development — leave empty, uses console backend)
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
DEFAULT_FROM_EMAIL=Imboni School <ndekwe22@gmail.com>

# Frontend URL (for password reset links)
FRONTEND_URL=http://localhost:3000
```

### Step 3 — Create .env.example

This file goes to GitHub so teammates know what variables are needed:

```
# Backend/.env.example

# Django
DJANGO_SECRET_KEY=your-secret-key-here
DEBUG=True

# Database
DB_NAME=your_db_name
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_HOST=localhost
DB_PORT=5432

# Email
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
DEFAULT_FROM_EMAIL=Your School <noreply@yourschool.com>

# Frontend
FRONTEND_URL=http://localhost:3000
```

### Step 4 — Update .gitignore

```
# Add these lines to .gitignore
.env
.env.local
.env.production
*.pyc
__pycache__/
media/
```

### Step 5 — Update settings.py

Replace all hardcoded values with `config()` calls (see Section 7).

### Step 6 — Verify it works

```bash
cd Backend
python manage.py check
python manage.py runserver
```

If it starts without errors — done.

---

## 7. Applying It to Your settings.py

### Current state of your settings.py (the problems)

```python
# Line 27 — SECRET_KEY hardcoded as fallback
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'django-insecure-(0poduddq...')

# Line 110 — DATABASE PASSWORD hardcoded
'PASSWORD': 'mercermerc123@M',

# Line 237 — partially done
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
```

### After applying python-decouple

```python
from decouple import config, Csv

# ✅ Secret Key
SECRET_KEY = config('DJANGO_SECRET_KEY')

# ✅ Debug
DEBUG = config('DEBUG', default=False, cast=bool)

# ✅ Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME':     config('DB_NAME'),
        'USER':     config('DB_USER'),
        'PASSWORD': config('DB_PASSWORD'),
        'HOST':     config('DB_HOST', default='localhost'),
        'PORT':     config('DB_PORT', default='5432'),
    }
}

# ✅ Email
EMAIL_HOST_USER     = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL  = config('DEFAULT_FROM_EMAIL', default='noreply@imboni.com')

# ✅ Frontend URL (for password reset links)
FRONTEND_URL = config('FRONTEND_URL', default='http://localhost:3000')
```

---

## 8. The .gitignore File — Keeping .env Off GitHub

`.gitignore` is a file that tells Git which files to ignore — never track, never upload.

### Check if .env is already ignored

```bash
cat .gitignore | grep .env
```

### If not, add it

```
# .gitignore
.env
.env.*
!.env.example   ← this means "except .env.example — that one IS allowed"
```

### Verify it's ignored

```bash
git status
```

The `.env` file should NOT appear in the list. If it does, it's not ignored and will be uploaded.

### What if .env was already committed to GitHub?

If you accidentally pushed `.env` before, just removing it from git tracking is not enough — it's in the history. You need to:

```bash
# Remove it from git tracking (keeps the file on disk)
git rm --cached .env
git commit -m "remove .env from tracking"
git push

# Now change ALL the passwords that were exposed
# Rotate your SECRET_KEY
# Change your database password
# Revoke and regenerate any API keys
```

---

## 9. Different .env For Different Environments

Each environment has its own `.env` file:

```
Backend/
    .env                ← your laptop (development)
    .env.example        ← goes to GitHub (template only)

Production server:
    Environment variables set directly on the server (no .env file)
```

### Development .env

```
DEBUG=True
DB_PASSWORD=mercermerc123@M
DB_HOST=localhost
EMAIL_HOST_USER=              ← empty, uses console backend
```

### Production (set on server, not a file)

```
DEBUG=False
DB_PASSWORD=super_strong_production_password
DB_HOST=your-db-server.com
EMAIL_HOST_USER=ndekwe22@gmail.com
EMAIL_HOST_PASSWORD=gmail_app_password
```

---

## 10. What If Someone Else Clones Your Project?

They will get:
- ✅ All your code
- ✅ `.env.example` (the template)
- ❌ NOT your `.env` (it's ignored)

They need to:
```bash
# 1. Clone the repo
git clone https://github.com/you/imboni.git

# 2. Copy the example
cp .env.example .env

# 3. Fill in their own values
nano .env   # or open in VS Code

# 4. Install dependencies
pip install -r requirements.txt

# 5. Run
python manage.py runserver
```

This is the professional workflow used in every real Django project.

---

## 11. Secrets in Production (Server)

When you deploy, you do NOT copy your `.env` file to the server. Instead you set environment variables directly on the server.

### On Linux/Ubuntu server

```bash
# Set permanently in /etc/environment or ~/.bashrc
export DJANGO_SECRET_KEY="your-production-secret-key"
export DB_PASSWORD="your-production-db-password"
export DEBUG="False"
```

### On cloud platforms (Railway, Render, Heroku, etc.)

Every cloud platform has a UI where you type in your environment variables:

```
Render dashboard → Your service → Environment → Add Variable
    KEY:   DJANGO_SECRET_KEY
    VALUE: your-production-secret-key
```

No `.env` file involved. The platform injects the variables when your app starts.

---

## 12. Common Mistakes

### Mistake 1 — Committing .env by accident

```bash
git add .   ← this adds EVERYTHING including .env
```

**Fix:** Always use specific file names or check `git status` before committing.

### Mistake 2 — Leaving a hardcoded fallback

```python
# DANGEROUS — if SECRET_KEY env var is missing, uses the hardcoded fallback
SECRET_KEY = config('DJANGO_SECRET_KEY', default='django-insecure-hardcoded-value')
```

In production, if the environment variable is missing Django will silently use the insecure fallback. Remove the default for critical secrets:

```python
# SAFE — crashes immediately if SECRET_KEY is not set
SECRET_KEY = config('DJANGO_SECRET_KEY')  # no default = required
```

### Mistake 3 — Using the same SECRET_KEY everywhere

Generate a new unique SECRET_KEY for production. Never use the development key in production.

```bash
# Generate a new SECRET_KEY
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### Mistake 4 — Sharing .env over Slack/email

If you need to share credentials with a teammate, use a proper secrets manager (1Password, Bitwarden, Doppler). Never paste `.env` in a chat message.

### Mistake 5 — Forgetting to add new secrets to .env.example

Every time you add a new `config('NEW_KEY')` to settings.py, add the key (with empty or fake value) to `.env.example`.

---

## 13. Cheat Sheet

```
INSTALL
    pip install python-decouple

CREATE FILES
    Backend/.env          ← real values, never on GitHub
    Backend/.env.example  ← fake values, goes to GitHub

.gitignore
    .env
    .env.*
    !.env.example

SYNTAX IN settings.py
    from decouple import config

    config('KEY')                          # required — crashes if missing
    config('KEY', default='fallback')      # optional with fallback
    config('KEY', default=False, cast=bool) # cast string to boolean
    config('KEY', default=5432, cast=int)  # cast string to integer

TYPES OF VALUES
    String  →  config('DB_HOST', default='localhost')
    Boolean →  config('DEBUG', default=False, cast=bool)
    Integer →  config('DB_PORT', default=5432, cast=int)

CHECK IF .env IS IGNORED
    git status    ← .env should NOT appear

GENERATE NEW SECRET KEY
    python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

IF YOU ACCIDENTALLY COMMITTED .env
    git rm --cached .env
    git commit -m "remove .env from tracking"
    git push
    → then change ALL exposed passwords immediately
```

---

## 14. Your Project — Full Before & After

### BEFORE (current state — dangerous)

```python
# settings.py — secrets are visible to anyone who sees the code

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'django-insecure-(0poduddq(b$#ut=h)brljaxe1xm-4er)==lv_23ek!f9+y0ia')

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'imboni_db',
        'USER': 'postgres',
        'PASSWORD': 'mercermerc123@M',   # ← EXPOSED
        'HOST': 'localhost',
        'PORT': '5432',
    }
}
```

### AFTER (safe — secrets are in .env)

```python
# settings.py — no secrets here
from decouple import config

SECRET_KEY = config('DJANGO_SECRET_KEY')
DEBUG       = config('DEBUG', default=False, cast=bool)

DATABASES = {
    'default': {
        'ENGINE':   'django.db.backends.postgresql',
        'NAME':     config('DB_NAME'),
        'USER':     config('DB_USER'),
        'PASSWORD': config('DB_PASSWORD'),
        'HOST':     config('DB_HOST', default='localhost'),
        'PORT':     config('DB_PORT', default='5432'),
    }
}

EMAIL_HOST_USER     = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
```

```
# Backend/.env — stays on your laptop only
DJANGO_SECRET_KEY=django-insecure-(0poduddq(b$#ut=h)brljaxe1xm-4er)==lv_23ek!f9+y0ia
DEBUG=True
DB_NAME=imboni_db
DB_USER=postgres
DB_PASSWORD=mercermerc123@M
DB_HOST=localhost
DB_PORT=5432
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
DEFAULT_FROM_EMAIL=Imboni School <ndekwe22@gmail.com>
FRONTEND_URL=http://localhost:3000
```

```
# Backend/.env.example — goes to GitHub, safe to share
DJANGO_SECRET_KEY=generate-a-new-one
DEBUG=True
DB_NAME=your_db_name
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_HOST=localhost
DB_PORT=5432
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
DEFAULT_FROM_EMAIL=Your School <noreply@school.com>
FRONTEND_URL=http://localhost:3000
```

---

## Summary

```
Secret in code  →  Anyone who sees code sees the secret  →  DANGEROUS
Secret in .env  →  Only people with the file see it      →  SAFE
Secret on server →  Only the server knows it             →  PRODUCTION STANDARD
```

The rule is simple:
- If it's a password, key, or token → put it in .env
- If it's logic, configuration, or structure → put it in code

Your Imboni project has 3 secrets to move right now:
1. DJANGO_SECRET_KEY
2. DB_PASSWORD (mercermerc123@M)
3. EMAIL_HOST_PASSWORD (when you add it)
