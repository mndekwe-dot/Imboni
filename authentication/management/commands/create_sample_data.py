from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from authentication.models import UserPreferences
from students.models import Student, ParentStudentRelationship
from results.models import Subject, AcademicTerm, Result, Assessment
from attendance.models import AttendanceRecord, AttendanceSummary
from behavior.models import BehaviorReport, ConductGrade
from announcements.models import Announcement, AnnouncementRead
from datetime import date, timedelta
import random

User = get_user_model()


class Command(BaseCommand):
    help = 'Create sample data for testing the school management system'

    def handle(self, *args, **options):
        self.stdout.write('Creating sample data...')
        
        # Create admin user
        admin, created = User.objects.get_or_create(
            username='admin',
            defaults={
                'email': 'admin@imboni.edu',
                'first_name': 'System',
                'last_name': 'Admin',
                'role': 'admin',
                'is_staff': True,
                'is_superuser': True,
            }
        )
        if created:
            admin.set_password('admin123')
            admin.save()
            UserPreferences.objects.get_or_create(user=admin)
            self.stdout.write(self.style.SUCCESS(f'Created admin user: admin / admin123'))
        
        # Create Director of Studies
        dos, created = User.objects.get_or_create(
            username='dos',
            defaults={
                'email': 'dos@imboni.edu',
                'first_name': 'John',
                'last_name': 'Mugabo',
                'role': 'dos',
            }
        )
        if created:
            dos.set_password('dos123')
            dos.save()
            UserPreferences.objects.get_or_create(user=dos)
            self.stdout.write(self.style.SUCCESS(f'Created DOS user: dos / dos123'))
        
        # Create Teachers
        teachers_data = [
            ('teacher1', 'Alice', 'Uwimana', 'teacher1@imboni.edu'),
            ('teacher2', 'Bob', 'Ndayisenga', 'teacher2@imboni.edu'),
            ('teacher3', 'Claire', 'Mukamana', 'teacher3@imboni.edu'),
        ]
        teachers = []
        for username, first_name, last_name, email in teachers_data:
            teacher, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': email,
                    'first_name': first_name,
                    'last_name': last_name,
                    'role': 'teacher',
                }
            )
            if created:
                teacher.set_password('teacher123')
                teacher.save()
                UserPreferences.objects.get_or_create(user=teacher)
            teachers.append(teacher)
        self.stdout.write(self.style.SUCCESS(f'Created {len(teachers)} teachers'))
        
        # Create Parents
        parents_data = [
            ('parent1', 'Jean', 'Habimana', 'parent1@email.com'),
            ('parent2', 'Marie', 'Niyonzima', 'parent2@email.com'),
            ('parent3', 'Pierre', 'Bizimungu', 'parent3@email.com'),
            ('parent4', 'Grace', 'Uwamahoro', 'parent4@email.com'),
            ('parent5', 'Eric', 'Nkunda', 'parent5@email.com'),
        ]
        parents = []
        for username, first_name, last_name, email in parents_data:
            parent, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': email,
                    'first_name': first_name,
                    'last_name': last_name,
                    'role': 'parent',
                    'phone_number': f'078{random.randint(1000000, 9999999)}',
                }
            )
            if created:
                parent.set_password('parent123')
                parent.save()
                UserPreferences.objects.get_or_create(user=parent)
            parents.append(parent)
        self.stdout.write(self.style.SUCCESS(f'Created {len(parents)} parents'))
        
        # Create Students
        students_data = [
            ('student1', 'Emmanuel', 'Habimana', 'S1A001', '1', 'A'),
            ('student2', 'Divine', 'Niyonzima', 'S1B002', '1', 'B'),
            ('student3', 'Patrick', 'Bizimungu', 'S2A001', '2', 'A'),
            ('student4', 'Sandrine', 'Uwamahoro', 'S2B002', '2', 'B'),
            ('student5', 'Claude', 'Nkunda', 'S3A001', '3', 'A'),
            ('student6', 'Aline', 'Mukamana', 'S3B002', '3', 'B'),
            ('student7', 'Felix', 'Ndayisenga', 'S4A001', '4', 'A'),
            ('student8', 'Esther', 'Uwimana', 'S4B002', '4', 'B'),
            ('student9', 'James', 'Mugabo', 'S5A001', '5', 'A'),
            ('student10', 'Joy', 'Iradukunda', 'S5B002', '5', 'B'),
        ]
        students = []
        for i, (username, first_name, last_name, student_id, grade, section) in enumerate(students_data):
            user, user_created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': f'{username}@student.imboni.edu',
                    'first_name': first_name,
                    'last_name': last_name,
                    'role': 'student',
                    'date_of_birth': date(2005 + i % 6, random.randint(1, 12), random.randint(1, 28)),
                }
            )
            if user_created:
                user.set_password('student123')
                user.save()
                UserPreferences.objects.get_or_create(user=user)
            
            student, created = Student.objects.get_or_create(
                student_id=student_id,
                defaults={
                    'user': user,
                    'grade': grade,
                    'section': section,
                    'enrollment_date': date(2023, 1, 15),
                    'status': 'active',
                    'blood_group': random.choice(['A+', 'B+', 'O+', 'AB+', 'A-', 'B-', 'O-', 'AB-']),
                    'current_gpa': round(random.uniform(2.0, 4.0), 2),
                }
            )
            students.append(student)
        self.stdout.write(self.style.SUCCESS(f'Created {len(students)} students'))
        
        # Create Parent-Student Relationships
        for i, student in enumerate(students[:5]):
            parent = parents[i]
            rel, created = ParentStudentRelationship.objects.get_or_create(
                parent=parent,
                student=student,
                defaults={
                    'relationship_type': random.choice(['mother', 'father', 'guardian']),
                    'is_primary_contact': True,
                    'can_pickup': True,
                }
            )
        self.stdout.write(self.style.SUCCESS('Created parent-student relationships'))
        
        # Create Subjects
        subjects_data = [
            ('Mathematics', 'MATH101', 4),
            ('Physics', 'PHY101', 3),
            ('Chemistry', 'CHEM101', 3),
            ('Biology', 'BIO101', 3),
            ('English', 'ENG101', 4),
            ('Kinyarwanda', 'KIN101', 2),
            ('History', 'HIS101', 2),
            ('Geography', 'GEO101', 2),
            ('Computer Science', 'CS101', 3),
        ]
        subjects = []
        for name, code, credits in subjects_data:
            subject, created = Subject.objects.get_or_create(
                code=code,
                defaults={
                    'name': name,
                    'credit_hours': credits,
                }
            )
            subjects.append(subject)
        self.stdout.write(self.style.SUCCESS(f'Created {len(subjects)} subjects'))
        
        # Create Academic Term
        term, created = AcademicTerm.objects.get_or_create(
            term='term1',
            year=2024,
            defaults={
                'name': 'First Term 2024',
                'start_date': date(2024, 1, 8),
                'end_date': date(2024, 4, 12),
                'is_current': True,
            }
        )
        self.stdout.write(self.style.SUCCESS('Created academic term'))
        
        # Create Results for students
        for student in students[:5]:
            for subject in subjects[:5]:
                exam_score = random.uniform(45, 98)
                quiz_avg = random.uniform(50, 95)
                group_work = random.uniform(55, 92)
                final = (exam_score + quiz_avg + group_work) / 3
                
                if final >= 90:
                    grade = 'A'
                elif final >= 80:
                    grade = 'B'
                elif final >= 70:
                    grade = 'C'
                elif final >= 60:
                    grade = 'D'
                else:
                    grade = 'F'
                
                Result.objects.get_or_create(
                    student=student,
                    subject=subject,
                    term=term,
                    defaults={
                        'teacher': random.choice(teachers),
                        'quiz_average': round(quiz_avg, 2),
                        'group_work': round(group_work, 2),
                        'exam_score': round(exam_score, 2),
                        'final_score': round(final, 2),
                        'grade': grade,
                        'status': 'approved',
                    }
                )
        self.stdout.write(self.style.SUCCESS('Created sample results'))
        
        # Create Attendance Records
        today = date.today()
        for student in students:
            for days_ago in range(10):
                record_date = today - timedelta(days=days_ago)
                if record_date.weekday() < 5:  # Weekdays only
                    status_choice = random.choices(
                        ['present', 'absent', 'late', 'excused'],
                        weights=[80, 5, 10, 5]
                    )[0]
                    AttendanceRecord.objects.get_or_create(
                        student=student,
                        date=record_date,
                        defaults={
                            'status': status_choice,
                            'marked_by': random.choice(teachers),
                            'minutes_late': random.randint(1, 15) if status_choice == 'late' else 0,
                        }
                    )
        self.stdout.write(self.style.SUCCESS('Created attendance records'))
        
        # Create Behavior Reports
        behavior_types = [
            ('positive', 'Helped classmate with homework', 'minor'),
            ('positive', 'Excellent class participation', 'minor'),
            ('warning', 'Late to class', 'minor'),
            ('incident', 'Disruptive behavior in class', 'moderate'),
            ('achievement', 'Won science fair competition', 'serious'),
        ]
        for student in students[:5]:
            for _ in range(3):
                report_type, title, severity = random.choice(behavior_types)
                BehaviorReport.objects.create(
                    student=student,
                    report_type=report_type,
                    title=title,
                    description=f'{title} - detailed description here',
                    severity=severity,
                    date=today - timedelta(days=random.randint(1, 30)),
                    reported_by=random.choice(teachers),
                )
        self.stdout.write(self.style.SUCCESS('Created behavior reports'))
        
        # Create Announcements
        announcements_data = [
            ('School Closure Notice', 'The school will be closed on Friday for staff development.', 'urgent', 'all'),
            ('Mid-Term Exams Schedule', 'Mid-term examinations will begin on March 15th.', 'academic', 'all'),
            ('Sports Day Event', 'Annual sports day will be held on Saturday.', 'event', 'all'),
            ('Parent-Teacher Meeting', 'PTA meeting scheduled for next week.', 'general', 'parents'),
        ]
        for title, content, category, audience in announcements_data:
            Announcement.objects.get_or_create(
                title=title,
                defaults={
                    'content': content,
                    'category': category,
                    'target_audience': audience,
                    'author': dos,
                    'status': 'published',
                    'published_at': date.today() - timedelta(days=random.randint(1, 10)),
                }
            )
        self.stdout.write(self.style.SUCCESS('Created announcements'))
        
        self.stdout.write(self.style.SUCCESS('\n=== SAMPLE DATA CREATION COMPLETE ==='))
        self.stdout.write('\nTest Accounts (username / password):')
        self.stdout.write('  Admin: admin / admin123')
        self.stdout.write('  DOS: dos / dos123')
        self.stdout.write('  Teacher: teacher1 / teacher123')
        self.stdout.write('  Parent: parent1 / parent123')
        self.stdout.write('  Student: student1 / student123')
