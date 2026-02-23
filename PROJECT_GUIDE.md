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
10. [Configuration Settings](#10-configuration-settings)
11. [API Endpoints](#11-api-endpoints)
12. [Sample Data](#12-sample-data)
13. [Testing Guide](#13-testing-guide)

---

## 1. Project Overview

### 1.1 Introduction
Imboni is a comprehensive School Management System built with Django REST Framework. It provides a robust API backend for managing school operations including:

- User authentication and authorization
- Student management
- Academic results tracking
- Attendance monitoring
- Behavior reporting
- School announcements

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
| `dos` | Director of Studies - manages academics |
| `teacher` | Teachers - manage students, results, attendance |
| `parent` | Parents - view their children's information |
| `student` | Students - view their own information |

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
├── manage.py                    # Django management script
├── benv/                        # Virtual environment
├── Imboni/                      # Main project configuration
│   ├── __init__.py
│   ├── settings.py              # Project settings
│   ├── urls.py                  # Main URL configuration
│   └── wsgi.py
├── authentication/              # User authentication app
│   ├── __init__.py
│   ├── admin.py
│   ├── apps.py
│   ├── models.py                # User and UserPreferences models
│   ├── serializers.py           # User serializers
│   ├── views.py                 # Authentication views
│   ├── urls.py                  # Auth URL routes
│   └── management/
│       └── commands/
│           └── create_sample_data.py
├── students/                    # Student management app
│   ├── __init__.py
│   ├── admin.py
│   ├── apps.py
│   ├── models.py                # Student and ParentStudentRelationship
│   ├── serializers.py           # Student serializers
│   ├── views.py                 # Student views
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
│   └── views.py
└── analytics/                   # Analytics app (placeholder)
    └── models.py
```

---

## 4. Authentication App

### 4.1 Models

#### User Model (`authentication/models.py`)
```python
from django.contrib.auth.models import AbstractUser
from django.db import models
import uuid

class User(AbstractUser):    
    USER_ROLES = (
        ('student', 'Student'),
        ('parent', 'Parent'),
        ('teacher', 'Teacher'),
        ('dos', 'Director of Studies'),
        ('admin', 'Administrator'),
    )
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.CharField(max_length=10, choices=USER_ROLES)
    phone_number = models.CharField(max_length=20, blank=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    address = models.TextField(blank=True)
    emergency_contact = models.CharField(max_length=15, blank=True)
    is_active = models.BooleanField(default=True)
    email_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'users'
```

#### UserPreferences Model
```python
class UserPreferences(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='preferences')
    notification_email = models.BooleanField(default=True)
    notification_sms = models.BooleanField(default=False)
    notification_push = models.BooleanField(default=True)
    language = models.CharField(max_length=10, default='en')
    timezone = models.CharField(max_length=50, default='Africa/Kigali')
    theme = models.CharField(max_length=20, default='light')
    
    class Meta:
        db_table = 'user_preferences'
```

### 4.2 Serializers (`authentication/serializers.py`)

```python
from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User, UserPreferences

class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name', 'full_name',
            'role', 'phone_number', 'avatar', 'date_of_birth', 'address',
            'emergency_contact', 'is_active', 'email_verified', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'email_verified']

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'password_confirm',
            'first_name', 'last_name', 'role', 'phone_number'
        ]
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({
                "password": "Password fields didn't match."
            })
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(**validated_data)
        return user
```

### 4.3 Views (`authentication/views.py`)

```python
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from .models import User, UserPreferences
from .serializers import (
    UserSerializer, UserRegistrationSerializer,
    UserPreferencesSerializer, PasswordChangeSerializer
)

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny]  # Development mode
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get current user profile"""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def register(self, request):
        """Register new user"""
        serializer = UserRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        UserPreferences.objects.get_or_create(user=user)
        return Response({
            'user': UserSerializer(user).data,
            'message': 'User registered successfully'
        }, status=status.HTTP_201_CREATED)

class AuthViewSet(viewsets.ViewSet):
    permission_classes = [permissions.AllowAny]
    
    @action(detail=False, methods=['post'])
    def login(self, request):
        """Login user"""
        username = request.data.get('username')
        password = request.data.get('password')
        user = authenticate(username=username, password=password)
        
        if user:
            refresh = RefreshToken.for_user(user)
            return Response({
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': UserSerializer(user).data
            })
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)
```

### 4.4 URLs (`authentication/urls.py`)

```python
from django.urls import path
from rest_framework_nested import routers
from . import views

router = routers.DefaultRouter()
router.register(r'users', views.UserViewSet, basename='user')
router.register(r'auth', views.AuthViewSet, basename='auth')

user_nested_router = routers.NestedDefaultRouter(router, r'users', lookup='user')
user_nested_router.register(r'preferences', views.UserPreferencesViewSet, basename='user-preferences')

urlpatterns = router.urls + user_nested_router.urls
```

---

## 5. Students App

### 5.1 Models (`students/models.py`)

```python
from django.db import models
from authentication.models import User
import uuid

class Student(models.Model):
    GRADE_CHOICES = [
        ('1', 'Secondary 1'),
        ('2', 'Secondary 2'),
        ('3', 'Secondary 3'),
        ('4', 'Secondary 4'),
        ('5', 'Secondary 5'),
        ('6', 'Secondary 6'),
    ]
    
    SECTION_CHOICES = [
        ('A', 'Section A'),
        ('B', 'Section B'),
        ('C', 'Section C'),
    ]
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('graduated', 'Graduated'),
        ('transferred', 'Transferred'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    student_id = models.CharField(max_length=20, unique=True)
    grade = models.CharField(max_length=2, choices=GRADE_CHOICES)
    section = models.CharField(max_length=1, choices=SECTION_CHOICES)
    enrollment_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    blood_group = models.CharField(max_length=5, blank=True)
    allergies = models.TextField(blank=True)
    medical_conditions = models.TextField(blank=True)
    current_gpa = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    attendance_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=100.00)
    
    class Meta:
        db_table = 'students'
        ordering = ['grade', 'section', 'user__last_name']

class ParentStudentRelationship(models.Model):
    RELATIONSHIP_TYPES = [
        ('mother', 'Mother'),
        ('father', 'Father'),
        ('guardian', 'Legal Guardian'),
        ('other', 'Other'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    parent = models.ForeignKey(User, on_delete=models.CASCADE, related_name='children')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='parents')
    relationship_type = models.CharField(max_length=20, choices=RELATIONSHIP_TYPES)
    is_primary_contact = models.BooleanField(default=False)
    can_pickup = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'parent_student_relationships'
        unique_together = ['parent', 'student']
```

### 5.2 Serializers (`students/serializers.py`)

```python
from rest_framework import serializers
from authentication.models import User, UserPreferences
from .models import Student, ParentStudentRelationship

class StudentSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField(source='user.get_full_name')
    email = serializers.ReadOnlyField(source='user.email')
    grade_section = serializers.ReadOnlyField()
    
    class Meta:
        model = Student
        fields = [
            'id', 'user', 'student_id', 'grade', 'section', 'enrollment_date',
            'status', 'blood_group', 'allergies', 'medical_conditions',
            'current_gpa', 'attendance_percentage', 'full_name', 'email',
            'grade_section', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'attendance_percentage']

class StudentCreateSerializer(serializers.ModelSerializer):
    username = serializers.CharField(write_only=True)
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True, validators=[validate_password])
    first_name = serializers.CharField(write_only=True)
    last_name = serializers.CharField(write_only=True)
    
    class Meta:
        model = Student
        fields = [
            'username', 'email', 'password', 'first_name', 'last_name',
            'student_id', 'grade', 'section', 'enrollment_date', 'status'
        ]
    
    def create(self, validated_data):
        user_data = {
            'username': validated_data.pop('username'),
            'email': validated_data.pop('email'),
            'first_name': validated_data.pop('first_name'),
            'last_name': validated_data.pop('last_name'),
            'role': 'student',
        }
        password = validated_data.pop('password')
        user = User.objects.create_user(**user_data, password=password)
        student = Student.objects.create(user=user, **validated_data)
        return student
```

### 5.3 Views (`students/views.py`)

```python
from rest_framework import viewsets, permissions
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import Student, ParentStudentRelationship
from .serializers import StudentSerializer, StudentCreateSerializer, ParentStudentRelationshipSerializer

class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.select_related('user').all()
    serializer_class = StudentSerializer
    permission_classes = [permissions.AllowAny]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['grade', 'section', 'status']
    search_fields = ['student_id', 'user__first_name', 'user__last_name', 'user__email']
    ordering_fields = ['grade', 'section', 'created_at', 'current_gpa']
    ordering = ['grade', 'section', 'user__last_name']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return StudentCreateSerializer
        return StudentSerializer
```

---

## 6. Results App

### 6.1 Models (`results/models.py`)

```python
class Subject(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True)
    credit_hours = models.IntegerField(default=1)
    is_active = models.BooleanField(default=True)

class AcademicTerm(models.Model):
    TERM_CHOICES = [
        ('term1', 'Term 1'),
        ('term2', 'Term 2'),
        ('term3', 'Term 3'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50)
    term = models.CharField(max_length=10, choices=TERM_CHOICES)
    year = models.IntegerField()
    start_date = models.DateField()
    end_date = models.DateField()
    is_current = models.BooleanField(default=False)

class Result(models.Model):
    GRADE_CHOICES = [
        ('A', 'A - Excellent (90-100)'),
        ('B', 'B - Good (80-89)'),
        ('C', 'C - Satisfactory (70-79)'),
        ('D', 'D - Pass (60-69)'),
        ('F', 'F - Fail (<60)'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='results')
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT)
    term = models.ForeignKey(AcademicTerm, on_delete=models.CASCADE)
    teacher = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    quiz_average = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    group_work = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    exam_score = models.DecimalField(max_digits=5, decimal_places=2)
    final_score = models.DecimalField(max_digits=5, decimal_places=2)
    grade = models.CharField(max_length=2, choices=GRADE_CHOICES)
    status = models.CharField(max_length=20, default='draft')
```

---

## 7. Attendance App

### 7.1 Models (`attendance/models.py`)

```python
class AttendanceRecord(models.Model):
    STATUS_CHOICES = [
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('late', 'Late'),
        ('excused', 'Excused Absence'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='attendance_records')
    date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES)
    time_in = models.TimeField(null=True, blank=True)
    time_out = models.TimeField(null=True, blank=True)
    minutes_late = models.IntegerField(default=0)
    notes = models.TextField(blank=True)
    marked_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    
    class Meta:
        unique_together = ['student', 'date']

class AttendanceSummary(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    month = models.IntegerField()
    year = models.IntegerField()
    total_days = models.IntegerField(default=0)
    present_days = models.IntegerField(default=0)
    absent_days = models.IntegerField(default=0)
    late_days = models.IntegerField(default=0)
    attendance_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    class Meta:
        unique_together = ['student', 'month', 'year']
```

---

## 8. Behavior App

### 8.1 Models (`behavior/models.py`)

```python
class BehaviorReport(models.Model):
    REPORT_TYPE_CHOICES = [
        ('positive', 'Positive Report'),
        ('warning', 'Warning'),
        ('incident', 'Incident'),
        ('achievement', 'Achievement'),
    ]
    SEVERITY_CHOICES = [
        ('minor', 'Minor'),
        ('moderate', 'Moderate'),
        ('serious', 'Serious'),
        ('critical', 'Critical'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='behavior_reports')
    report_type = models.CharField(max_length=20, choices=REPORT_TYPE_CHOICES)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, null=True, blank=True)
    title = models.CharField(max_length=200)
    description = models.TextField()
    date = models.DateField()
    location = models.CharField(max_length=100, blank=True)
    reported_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    action_taken = models.TextField(blank=True)
    follow_up_required = models.BooleanField(default=False)
    parents_notified = models.BooleanField(default=False)

class ConductGrade(models.Model):
    GRADE_CHOICES = [
        ('A', 'A - Excellent'),
        ('B', 'B - Good'),
        ('C', 'C - Satisfactory'),
        ('D', 'D - Needs Improvement'),
        ('F', 'F - Unsatisfactory'),
    ]
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    term = models.ForeignKey('results.AcademicTerm', on_delete=models.CASCADE)
    grade = models.CharField(max_length=1, choices=GRADE_CHOICES)
    positive_count = models.IntegerField(default=0)
    warning_count = models.IntegerField(default=0)
    incident_count = models.IntegerField(default=0)
```

---

## 9. Announcements App

### 9.1 Models (`announcements/models.py`)

```python
class Announcement(models.Model):
    CATEGORY_CHOICES = [
        ('urgent', 'Urgent'),
        ('academic', 'Academic'),
        ('event', 'Event'),
        ('general', 'General'),
    ]
    TARGET_AUDIENCE_CHOICES = [
        ('all', 'All Users'),
        ('teachers', 'Teachers Only'),
        ('parents', 'Parents Only'),
        ('students', 'Students Only'),
        ('grade_specific', 'Specific Grade'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    content = models.TextField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    target_audience = models.CharField(max_length=20, choices=TARGET_AUDIENCE_CHOICES)
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    status = models.CharField(max_length=20, default='draft')
    published_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    attachment = models.FileField(upload_to='announcements/', null=True, blank=True)

class AnnouncementRead(models.Model):
    announcement = models.ForeignKey(Announcement, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    read_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['announcement', 'user']
```

---

## 10. Configuration Settings

### 10.1 Settings.py Key Configurations

```python
# Installed Apps
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
]

# Custom User Model
AUTH_USER_MODEL = 'authentication.User'

# REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',  # Development mode
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
}

# JWT Configuration
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# CORS Configuration
CORS_ALLOW_ALL_ORIGINS = True  # Development only

# Debug Toolbar
INTERNAL_IPS = ['127.0.0.1', 'localhost']

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'Imboni',
        'USER': 'root',
        'PASSWORD': '',
        'HOST': 'localhost',
        'PORT': 3306,
    }
}
```

### 10.2 Main URLs (`Imboni/urls.py`)

```python
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('__debug__/', include('debug_toolbar.urls')),
    path('api/', include('students.urls')),
    path('api/', include('authentication.urls')),
]
```

---

## 11. API Endpoints

### 11.1 Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login/` | User login |
| POST | `/api/auth/logout/` | User logout |
| GET | `/api/users/` | List all users |
| POST | `/api/users/register/` | Register new user |
| GET | `/api/users/me/` | Get current user profile |
| POST | `/api/users/change_password/` | Change password |
| GET | `/api/users/{id}/preferences/` | Get user preferences |

### 11.2 Student Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/students/` | List all students |
| POST | `/api/students/` | Create new student |
| GET | `/api/students/{id}/` | Get student details |
| PUT | `/api/students/{id}/` | Update student |
| DELETE | `/api/students/{id}/` | Delete student |
| GET | `/api/students/{id}/attendance/` | Get student attendance |
| GET | `/api/students/{id}/results/` | Get student results |
| GET | `/api/students/{id}/behavior/` | Get behavior reports |

### 11.3 Query Parameters

Students endpoint supports:
- **Filtering**: `?grade=1&section=A&status=active`
- **Search**: `?search=john`
- **Ordering**: `?ordering=-created_at` or `?ordering=grade`

---

## 12. Sample Data

### 12.1 Creating Sample Data

Run the management command:
```bash
python manage.py create_sample_data
```

### 12.2 Sample Data Created

| Data Type | Count | Details |
|-----------|-------|---------|
| Admin User | 1 | admin / admin123 |
| DOS User | 1 | dos / dos123 |
| Teachers | 3 | teacher1-3 / teacher123 |
| Parents | 5 | parent1-5 / parent123 |
| Students | 10 | student1-10 / student123 |
| Subjects | 9 | Math, Physics, Chemistry, etc. |
| Academic Term | 1 | Term 1, 2024 |
| Results | 25 | Sample results for students |
| Attendance | 100+ | 10 days of records |
| Behavior Reports | 15 | Various types |
| Announcements | 4 | Different categories |

---

## 13. Testing Guide

### 13.1 Using curl

```bash
# Login
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Get students (no auth required in development)
curl http://localhost:8000/api/students/

# Create student
curl -X POST http://localhost:8000/api/students/ \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newstudent",
    "email": "newstudent@school.com",
    "password": "Test@1234",
    "first_name": "New",
    "last_name": "Student",
    "student_id": "S2024001",
    "grade": "1",
    "section": "A",
    "enrollment_date": "2024-01-15"
  }'

# Filter students
curl "http://localhost:8000/api/students/?grade=1&section=A"

# Search students
curl "http://localhost:8000/api/students/?search=john"
```

### 13.2 Using Postman

1. Import the API endpoints
2. Set base URL: `http://localhost:8000/api/`
3. For authenticated requests, add header:
   - Key: `Authorization`
   - Value: `Bearer <your_access_token>`

### 13.3 Browser Testing

Visit these URLs directly:
- http://localhost:8000/api/students/
- http://localhost:8000/api/users/
- http://localhost:8000/admin/ (for Django admin)

---

## Appendix A: Common Issues and Solutions

### Issue 1: ModuleNotFoundError
**Solution**: Activate virtual environment
```bash
.\benv\Scripts\activate  # Windows
source benv/bin/activate  # Linux/Mac
```

### Issue 2: Database Connection Error
**Solution**: Check MySQL is running and credentials in settings.py

### Issue 3: Migration Errors
**Solution**: 
```bash
python manage.py makemigrations --run-syncdb
python manage.py migrate --run-syncdb
```

### Issue 4: Phone Number Too Long
**Solution**: Changed `max_length` from 12 to 20 in User model

---

## Appendix B: Future Enhancements

1. **Enable Authentication**: Change `AllowAny` to `IsAuthenticated` in production
2. **Add Email Verification**: Implement email confirmation flow
3. **Add File Upload**: Profile pictures, assignment submissions
4. **Add Notifications**: Push notifications for parents
5. **Add Reporting**: Generate PDF reports for results
6. **Add API Documentation**: Implement Swagger/OpenAPI
7. **Add Unit Tests**: Comprehensive test coverage
8. **Add Rate Limiting**: Protect API from abuse

---

## Document Information

| Field | Value |
|-------|-------|
| Project Name | Imboni School Management System |
| Version | 1.0.0 |
| Author | Development Team |
| Date Created | February 2024 |
| Last Updated | February 2024 |
| Framework | Django 6.0.1 |
| API Framework | Django REST Framework |

---

*This document provides a comprehensive guide to the Imboni School Management System from initial setup to current implementation.*
