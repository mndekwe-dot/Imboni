# SMTP Complete Study Guide
### For Django Backend Developers — School Management System Context

---

## Table of Contents
1. [What is SMTP?](#1-what-is-smtp)
2. [How Email Works — The Full Journey](#2-how-email-works)
3. [Key Terms You Must Know](#3-key-terms)
4. [Ports — 25, 465, 587, 2525](#4-ports)
5. [Encryption — TLS vs SSL](#5-encryption)
6. [Authentication — How Servers Trust You](#6-authentication)
7. [Django Email Backends](#7-django-email-backends)
8. [Development Setup](#8-development-setup)
9. [Testing Setup — Mailtrap](#9-testing-setup)
10. [Production Setup — Gmail](#10-production-setup)
11. [Environment Variables — Never Hardcode Passwords](#11-environment-variables)
12. [Sending Emails in Django Code](#12-sending-emails-in-code)
13. [Password Reset Flow — Full Implementation](#13-password-reset-flow)
14. [Email Templates in Django](#14-email-templates)
15. [Common Errors and Fixes](#15-common-errors)
16. [Professional Email Services](#16-professional-email-services)
17. [Security Best Practices](#17-security-best-practices)
18. [Checklist — Dev to Production](#18-checklist)

---

## 1. What is SMTP?

**SMTP = Simple Mail Transfer Protocol**

SMTP is the standard protocol used to **send** emails across the internet. It was created in 1982 and is still the backbone of all email delivery today.

### Analogy
Think of SMTP like a postal system:
```
Your App        = The person writing a letter
SMTP Server     = The post office
Email Address   = The recipient's home address
SMTP Protocol   = The rules the post office follows
```

### What SMTP Does vs Does NOT Do
| SMTP Does | SMTP Does NOT Do |
|---|---|
| Send emails from your app | Receive emails |
| Authenticate your identity | Store emails |
| Route emails to the right server | Display emails to users |
| Retry failed deliveries | Handle IMAP/POP3 (reading email) |

> **Note:** IMAP and POP3 are the protocols for *reading* email.
> Your Django app only needs SMTP for *sending*.

---

## 2. How Email Works — The Full Journey

When your Django app sends a "Password Reset" email, here is exactly what happens:

```
Step 1:  Django calls send_mail()
           ↓
Step 2:  Django connects to SMTP server (e.g. smtp.gmail.com:587)
           ↓
Step 3:  SMTP server asks: "Who are you?"
           ↓
Step 4:  Django sends EMAIL_HOST_USER + EMAIL_HOST_PASSWORD
           ↓
Step 5:  SMTP server says: "Authenticated. Give me the email."
           ↓
Step 6:  Django sends: From, To, Subject, Body
           ↓
Step 7:  Gmail's SMTP server looks up the recipient's mail server
         (e.g. student@outlook.com → finds outlook.com's mail server)
           ↓
Step 8:  Gmail delivers the email to Outlook's mail server
           ↓
Step 9:  Student opens Outlook → sees the email
```

### DNS MX Records — How Servers Find Each Other
Every domain has a DNS MX (Mail Exchange) record that points to its mail server:
```
school.com     MX → mail.school.com
gmail.com      MX → smtp.gmail.com
outlook.com    MX → smtp-mail.outlook.com
```
When Gmail delivers to `student@school.com`, it looks up `school.com`'s MX record to find where to send the email.

---

## 3. Key Terms You Must Know

| Term | Meaning |
|---|---|
| **SMTP** | Protocol for sending email |
| **SMTP Server** | The service that accepts and forwards your email |
| **EMAIL_HOST** | The address of the SMTP server (e.g. smtp.gmail.com) |
| **EMAIL_PORT** | The door number to connect through (587, 465, 25) |
| **EMAIL_HOST_USER** | Your login username (usually your email address) |
| **EMAIL_HOST_PASSWORD** | Your password or App Password |
| **EMAIL_USE_TLS** | Whether to encrypt the connection (True = yes) |
| **EMAIL_USE_SSL** | Alternative encryption method |
| **DEFAULT_FROM_EMAIL** | The "From:" name shown in the recipient's inbox |
| **Relay** | When one SMTP server forwards email to another |
| **Bounce** | When an email cannot be delivered and is returned |
| **Spam filter** | System that blocks unwanted or suspicious emails |
| **App Password** | A special password Gmail generates for third-party apps |
| **MX Record** | DNS record that points to a domain's mail server |
| **TLS** | Transport Layer Security — encryption for the connection |

---

## 4. Ports

A port is like a specific door on a server. Different services use different doors.

| Port | Protocol | Used For | Status |
|---|---|---|---|
| **25** | SMTP | Server-to-server email delivery | Blocked by most ISPs |
| **465** | SMTPS | SMTP over SSL (older standard) | Still works, being phased out |
| **587** | SMTP+STARTTLS | The modern standard for apps | **Recommended** |
| **2525** | SMTP | Alternative when 587 is blocked | Used by Mailtrap |

### Why Port 587?
- It's the IANA-assigned port for "email submission" (apps sending email)
- It requires authentication (you must log in)
- It uses STARTTLS (upgrades to encrypted connection automatically)
- Gmail, Outlook, Yahoo — all support it

### Your Django Setting
```python
EMAIL_PORT = 587       # Modern standard — use this
EMAIL_USE_TLS = True   # Required with port 587
```

---

## 5. Encryption — TLS vs SSL

### Why Encryption Matters
Without encryption, your email and password travel across the internet as plain text. Anyone on the network can read them.

```
Without encryption:
Your app → internet → SMTP server
(Password visible: "mypassword123")

With TLS:
Your app → encrypted tunnel → SMTP server
(Password visible: "x9$#@kL!m3nQ...")
```

### TLS (Transport Layer Security) — Modern Standard
```python
EMAIL_PORT    = 587
EMAIL_USE_TLS = True   # Starts plain, upgrades to encrypted (STARTTLS)
EMAIL_USE_SSL = False  # Leave False when using TLS
```

### SSL (Secure Sockets Layer) — Older Standard
```python
EMAIL_PORT    = 465
EMAIL_USE_SSL = True   # Encrypted from the start
EMAIL_USE_TLS = False  # Leave False when using SSL
```

### Which to Use?
**Always use TLS (port 587) unless your specific provider requires SSL.**
Gmail, Outlook, Mailtrap all support TLS on port 587.

> **Important:** Never set both `EMAIL_USE_TLS = True` AND `EMAIL_USE_SSL = True`.
> Django will raise an error.

---

## 6. Authentication — How Servers Trust You

SMTP servers require you to prove your identity before accepting emails.

### Username + Password
```python
EMAIL_HOST_USER     = 'ndekwe22@gmail.com'
EMAIL_HOST_PASSWORD = 'your_app_password'
```
The SMTP server checks these against its records. If they match, you can send email.

### Gmail — Why You Need an App Password

Google blocks normal password login for apps because it's less secure. Instead:

1. Go to **myaccount.google.com**
2. Click **Security**
3. Turn on **2-Step Verification** (required)
4. Go back to Security → **App Passwords**
5. Select app: **Mail**, device: **Other** → type "Django"
6. Google gives you a 16-character password like: `abcd efgh ijkl mnop`
7. Use this (without spaces) as `EMAIL_HOST_PASSWORD`

```python
EMAIL_HOST_PASSWORD = 'abcdefghijklmnop'  # The App Password, not your real password
```

### Why Not Use Your Real Gmail Password?
- If your code gets leaked (GitHub, etc.), your entire Google account is compromised
- App Passwords can be revoked individually without changing your main password
- Google enforces this for security

---

## 7. Django Email Backends

Django has multiple "backends" — ways of handling email. You switch between them based on your environment.

### Backend 1 — Console (Development)
```python
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
```
- Prints emails to your terminal
- Nothing is sent
- Zero configuration
- **Use this during development**

Terminal output looks like:
```
Content-Type: text/plain; charset="utf-8"
MIME-Version: 1.0
Subject: Password Reset
From: Imboni School <no-reply@imboni.com>
To: student@gmail.com

Click here to reset your password:
http://imboni.com/reset/abc123/
```

### Backend 2 — SMTP (Production)
```python
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
```
- Actually sends real emails
- Requires full configuration (host, port, user, password)
- **Use this in production**

### Backend 3 — File (Debugging)
```python
EMAIL_BACKEND = 'django.core.mail.backends.filebased.EmailBackend'
EMAIL_FILE_PATH = '/tmp/emails/'  # Saves emails as files here
```
- Saves emails as .log files
- Useful when you want to inspect emails without a terminal

### Backend 4 — Locmem (Testing)
```python
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
```
- Stores emails in memory (`django.core.mail.outbox`)
- Used in automated tests to check emails were sent
- Nothing is saved or sent

### Backend 5 — Dummy (Silence)
```python
EMAIL_BACKEND = 'django.core.mail.backends.dummy.EmailBackend'
```
- Silently discards all emails
- No output, no sending
- Useful when you want to disable email entirely

---

## 8. Development Setup

This is what your project currently uses:

```python
# settings.py

if DEBUG:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
```

### Why This is Perfect for Development
- No Gmail account needed
- No internet connection needed
- No accidental emails to real users
- Emails appear instantly in your terminal
- You can see the full email content including HTML

### How to Test It
```python
# In Django shell: python manage.py shell
from django.core.mail import send_mail

send_mail(
    subject='Test Email',
    message='This is a test.',
    from_email='imboni@school.com',
    recipient_list=['student@gmail.com'],
)
```

You'll see the email printed in your terminal. No real email is sent.

---

## 9. Testing Setup — Mailtrap

Mailtrap is a fake inbox for testing. It catches all emails so they never reach real users, but you can see them in a real inbox UI.

### Why Mailtrap is Better Than Console for Testing
- Tests the actual SMTP connection (finds real configuration bugs)
- Shows you exactly how the email looks in an inbox
- Shows HTML rendering, attachments, spam score
- Team members can all see the same emails
- Free tier available at **mailtrap.io**

### Setup
```python
EMAIL_BACKEND       = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST          = 'sandbox.smtp.mailtrap.io'
EMAIL_PORT          = 2525
EMAIL_USE_TLS       = True
EMAIL_HOST_USER     = os.environ.get('MAILTRAP_USER')
EMAIL_HOST_PASSWORD = os.environ.get('MAILTRAP_PASSWORD')
DEFAULT_FROM_EMAIL  = 'Imboni School <no-reply@imboni.com>'
```

### How It Works
```
Django → Mailtrap's server → Mailtrap inbox (trapped here)
                                    ↑
                         You see it in Mailtrap dashboard
                         but it never goes to the real recipient
```

---

## 10. Production Setup — Gmail

### Full Configuration
```python
# settings.py

if not DEBUG:
    EMAIL_BACKEND       = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST          = 'smtp.gmail.com'
    EMAIL_PORT          = 587
    EMAIL_USE_TLS       = True
    EMAIL_USE_SSL       = False
    EMAIL_HOST_USER     = os.environ.get('EMAIL_HOST_USER')
    EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD')  # App Password

DEFAULT_FROM_EMAIL = 'Imboni School <ndekwe22@gmail.com>'
```

### Gmail Sending Limits
| Account Type | Daily Limit |
|---|---|
| Free Gmail | 500 emails/day |
| Google Workspace | 2,000 emails/day |

For a school system with hundreds of students, you may hit this limit.
When you do, move to a professional service (see Section 16).

---

## 11. Environment Variables — Never Hardcode Passwords

### What Are Environment Variables?
Variables stored on the operating system, outside of your code.

```
settings.py (your code, on GitHub)     → reads from environment
.env file (local machine, NOT on GitHub) → stores real values
Server environment (production server)  → stores real values
```

### Setting Up .env File (Local Development)
Install python-dotenv:
```bash
pip install python-dotenv
```

Create `.env` file in your `Backend/` folder:
```
EMAIL_HOST_USER=ndekwe22@gmail.com
EMAIL_HOST_PASSWORD=abcdefghijklmnop
SECRET_KEY=your-django-secret-key
```

Load it in `settings.py`:
```python
from dotenv import load_dotenv
load_dotenv()

EMAIL_HOST_USER     = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
```

### CRITICAL — Add .env to .gitignore
```
# .gitignore
.env
*.env
```

**Never commit your `.env` file.** It contains passwords.

---

## 12. Sending Emails in Django Code

### Method 1 — send_mail() (Simple)
```python
from django.core.mail import send_mail

send_mail(
    subject='Welcome to Imboni School',
    message='Your account has been created.',
    from_email='no-reply@imboni.com',
    recipient_list=['student@gmail.com'],
    fail_silently=False,  # True = ignore errors, False = raise exception
)
```

### Method 2 — send_mass_mail() (Multiple Emails at Once)
```python
from django.core.mail import send_mass_mail

emails = (
    ('Subject 1', 'Message 1', 'from@imboni.com', ['parent1@gmail.com']),
    ('Subject 2', 'Message 2', 'from@imboni.com', ['parent2@gmail.com']),
)
send_mass_mail(emails)
```
More efficient than calling `send_mail()` in a loop — opens one SMTP connection.

### Method 3 — EmailMessage (Full Control)
```python
from django.core.mail import EmailMessage

email = EmailMessage(
    subject='Your Result Report',
    body='Please find your result attached.',
    from_email='results@imboni.com',
    to=['student@gmail.com'],
    cc=['parent@gmail.com'],
    bcc=['admin@imboni.com'],
)
email.attach_file('/path/to/report.pdf')  # Add attachment
email.send()
```

### Method 4 — EmailMultiAlternatives (HTML + Plain Text)
```python
from django.core.mail import EmailMultiAlternatives

subject = 'Password Reset'
text_content = 'Click here to reset your password: http://imboni.com/reset/abc'
html_content = '<p>Click <a href="http://imboni.com/reset/abc">here</a> to reset.</p>'

email = EmailMultiAlternatives(subject, text_content, 'from@imboni.com', ['to@gmail.com'])
email.attach_alternative(html_content, 'text/html')
email.send()
```
Always send both plain text AND HTML. Some email clients don't render HTML.

---

## 13. Password Reset Flow — Full Implementation

This is the most common use of SMTP in school systems.

### The Complete Flow
```
1. User visits /forgot-password/ page
2. User enters their email
3. Frontend sends: POST /imboni/auth/password-reset/
4. Backend generates a secure token
5. Backend sends email with a link containing the token
6. User clicks the link in their email
7. Frontend sends: POST /imboni/auth/password-reset/confirm/
   Body: { uid, token, new_password }
8. Backend verifies the token
9. Backend sets the new password
10. User logs in with new password
```

### Backend Code

```python
# authentication/views.py

from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.core.mail import send_mail
from django.conf import settings


class PasswordResetRequestView(APIView):
    """
    POST /imboni/auth/password-reset/
    Body: { "email": "user@school.com" }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip()

        # Always return 200 even if email not found
        # (prevents attackers from discovering which emails are registered)
        user = User.objects.filter(email=email).first()
        if user:
            token = default_token_generator.make_token(user)
            uid   = urlsafe_base64_encode(force_bytes(user.pk))

            # Build the reset link (frontend URL)
            reset_link = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}/"

            send_mail(
                subject='Password Reset — Imboni School',
                message=f'Click here to reset your password:\n\n{reset_link}\n\nThis link expires in 1 hour.',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=True,
            )

        return Response({
            'detail': 'If this email is registered, a reset link has been sent.'
        })


class PasswordResetConfirmView(APIView):
    """
    POST /imboni/auth/password-reset/confirm/
    Body: { "uid": "...", "token": "...", "new_password": "..." }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        uid          = request.data.get('uid')
        token        = request.data.get('token')
        new_password = request.data.get('new_password')

        if not all([uid, token, new_password]):
            return Response({'detail': 'uid, token and new_password are required.'}, status=400)

        # Decode the user ID
        try:
            pk   = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=pk)
        except (User.DoesNotExist, ValueError, TypeError):
            return Response({'detail': 'Invalid reset link.'}, status=400)

        # Verify the token (tokens expire after PASSWORD_RESET_TIMEOUT seconds)
        if not default_token_generator.check_token(user, token):
            return Response({'detail': 'Reset link has expired or already been used.'}, status=400)

        # Set new password
        user.set_password(new_password)
        user.save()

        return Response({'detail': 'Password reset successful. You can now log in.'})
```

### Token Expiry
Django's `default_token_generator` tokens expire based on:
```python
# settings.py
PASSWORD_RESET_TIMEOUT = 3600  # 1 hour in seconds (default is 259200 = 3 days)
```

### Add to urls.py
```python
path('auth/password-reset/', PasswordResetRequestView.as_view()),
path('auth/password-reset/confirm/', PasswordResetConfirmView.as_view()),
```

---

## 14. Email Templates in Django

Instead of plain text, send beautiful HTML emails using Django templates.

### Create Template File
`Backend/templates/emails/password_reset.html`:
```html
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; }
        .container { max-width: 600px; margin: 40px auto; background: white; padding: 40px; border-radius: 8px; }
        .logo { color: #2563eb; font-size: 24px; font-weight: bold; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">Imboni School</div>
        <h2>Password Reset Request</h2>
        <p>Hello {{ user.first_name }},</p>
        <p>We received a request to reset your password. Click the button below:</p>
        <a href="{{ reset_link }}" class="button">Reset My Password</a>
        <p>This link expires in <strong>1 hour</strong>.</p>
        <p>If you didn't request this, ignore this email.</p>
        <hr>
        <small>Imboni School Management System</small>
    </div>
</body>
</html>
```

### Send the HTML Template
```python
from django.template.loader import render_to_string
from django.core.mail import EmailMultiAlternatives

def send_password_reset_email(user, reset_link):
    context = {
        'user': user,
        'reset_link': reset_link,
    }

    html_content  = render_to_string('emails/password_reset.html', context)
    plain_content = f"Hello {user.first_name},\n\nReset your password here:\n{reset_link}\n\nThis link expires in 1 hour."

    email = EmailMultiAlternatives(
        subject='Password Reset — Imboni School',
        body=plain_content,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user.email],
    )
    email.attach_alternative(html_content, 'text/html')
    email.send()
```

---

## 15. Common Errors and Fixes

### Error 1 — Connection Refused
```
ConnectionRefusedError: [Errno 111] Connection refused
```
**Cause:** `EMAIL_HOST = 'localhost'` but no mail server is running locally.
**Fix:** Switch to `console.EmailBackend` for development, or set a real SMTP host.

---

### Error 2 — Authentication Failed
```
SMTPAuthenticationError: (535, b'5.7.8 Username and Password not accepted')
```
**Cause:** Wrong password, or using your real Gmail password instead of App Password.
**Fix:** Generate a Gmail App Password and use that instead.

---

### Error 3 — SSL Wrong Version
```
ssl.SSLError: [SSL: WRONG_VERSION_NUMBER]
```
**Cause:** Using `EMAIL_USE_SSL = True` with port 587, or mixing TLS and SSL.
**Fix:**
```python
EMAIL_PORT    = 587
EMAIL_USE_TLS = True
EMAIL_USE_SSL = False  # Never both True at the same time
```

---

### Error 4 — Timeout
```
TimeoutError: timed out
```
**Cause:** Firewall blocking port 587, or wrong `EMAIL_HOST`.
**Fix:** Try port 2525, or check your network/firewall settings.

---

### Error 5 — Email Sending Works But Lands in Spam
**Causes:**
- Sending from a free Gmail without SPF/DKIM records
- Missing `DEFAULT_FROM_EMAIL`
- Sending bulk emails quickly

**Fix:**
- Use a professional service (SendGrid, Mailgun) for bulk emails
- Set up SPF and DKIM DNS records for your domain
- Always set `DEFAULT_FROM_EMAIL` to a real address

---

### Error 6 — TEMPLATES Not Configured
```
TemplateDoesNotExist: emails/password_reset.html
```
**Fix:** Add templates directory to settings:
```python
TEMPLATES = [{
    'DIRS': [os.path.join(BASE_DIR, 'templates')],
    ...
}]
```

---

## 16. Professional Email Services

When Gmail's 500 email/day limit is not enough for your school.

| Service | Free Tier | Best For | Price |
|---|---|---|---|
| **SendGrid** | 100/day free | Transactional + marketing | $19.95/mo for 50k |
| **Mailgun** | 1,000/month free | Developers, APIs | $35/mo for 50k |
| **Amazon SES** | 62,000/month free (on EC2) | High volume, cheap | $0.10 per 1,000 |
| **Resend** | 3,000/month free | Modern, developer-friendly | $20/mo for 50k |
| **Postmark** | 100/month free | Transactional only | $15/mo for 10k |

### SendGrid Example (when you're ready)
```python
EMAIL_BACKEND       = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST          = 'smtp.sendgrid.net'
EMAIL_PORT          = 587
EMAIL_USE_TLS       = True
EMAIL_HOST_USER     = 'apikey'                          # Always literally 'apikey'
EMAIL_HOST_PASSWORD = os.environ.get('SENDGRID_API_KEY')  # Your SendGrid API key
DEFAULT_FROM_EMAIL  = 'Imboni School <no-reply@imboni.com>'
```

---

## 17. Security Best Practices

### 1. Never Hardcode Credentials
```python
# BAD — never do this
EMAIL_HOST_PASSWORD = 'mypassword123'

# GOOD — read from environment
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD')
```

### 2. Always Use TLS
```python
EMAIL_USE_TLS = True  # Encrypts the connection
```

### 3. Use fail_silently Carefully
```python
send_mail(..., fail_silently=True)   # Silently ignores errors — use for notifications
send_mail(..., fail_silently=False)  # Raises exceptions — use for critical emails like password reset
```

### 4. Don't Reveal if Email Exists
```python
# BAD — tells attacker which emails are registered
if not User.objects.filter(email=email).exists():
    return Response({'error': 'Email not found'}, status=404)

# GOOD — always return the same response
return Response({'detail': 'If this email is registered, a reset link was sent.'})
```

### 5. Token Expiry for Password Reset
```python
PASSWORD_RESET_TIMEOUT = 3600  # 1 hour — don't use multi-day tokens
```

### 6. Rate Limit Password Reset Requests
Prevent attackers from spamming your SMTP with thousands of requests:
```python
# Use django-ratelimit or throttle the view
from rest_framework.throttling import AnonRateThrottle

class PasswordResetRequestView(APIView):
    throttle_classes = [AnonRateThrottle]  # 100 requests/day per IP by default
```

---

## 18. Checklist — Dev to Production

### Development Checklist
- [ ] `EMAIL_BACKEND = console.EmailBackend`
- [ ] No real credentials in settings.py
- [ ] `DEBUG = True`

### Pre-Production (Staging) Checklist
- [ ] Mailtrap configured and working
- [ ] Password reset email sends and link works
- [ ] HTML email renders correctly in Mailtrap inbox
- [ ] Token expiry tested (old links rejected)
- [ ] Spam score checked in Mailtrap

### Production Checklist
- [ ] `EMAIL_BACKEND = smtp.EmailBackend`
- [ ] Gmail App Password generated (or SendGrid key created)
- [ ] Credentials in environment variables (NOT in settings.py)
- [ ] `.env` file in `.gitignore`
- [ ] `DEFAULT_FROM_EMAIL` set to a real address
- [ ] `EMAIL_USE_TLS = True`
- [ ] `PASSWORD_RESET_TIMEOUT` set (3600 = 1 hour)
- [ ] Rate limiting on password reset endpoint
- [ ] FRONTEND_URL set in settings for reset links
- [ ] Tested end-to-end: request → email → click link → new password → login

---

## Quick Reference

```python
# ==============================
# Development — prints to terminal
# ==============================
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# ==============================
# Testing — Mailtrap
# ==============================
EMAIL_BACKEND       = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST          = 'sandbox.smtp.mailtrap.io'
EMAIL_PORT          = 2525
EMAIL_USE_TLS       = True
EMAIL_HOST_USER     = os.environ.get('MAILTRAP_USER')
EMAIL_HOST_PASSWORD = os.environ.get('MAILTRAP_PASSWORD')

# ==============================
# Production — Gmail
# ==============================
EMAIL_BACKEND       = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST          = 'smtp.gmail.com'
EMAIL_PORT          = 587
EMAIL_USE_TLS       = True
EMAIL_USE_SSL       = False
EMAIL_HOST_USER     = os.environ.get('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD')

# ==============================
# Always set this
# ==============================
DEFAULT_FROM_EMAIL = 'Imboni School <no-reply@imboni.com>'
```

---

*Study Guide created for Imboni School Management System*
*Django 5.x | djangorestframework-simplejwt | Python 3.13*
