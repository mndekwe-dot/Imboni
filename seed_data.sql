-- =====================================================
-- IMBONI SCHOOL MANAGEMENT SYSTEM - SEED DATA
-- =====================================================
-- This file contains sample data for testing and development
-- Compatible with MySQL Workbench
-- =====================================================
-- 
-- IMPORTANT: Run Django migrations first to create tables:
--   python manage.py makemigrations
--   python manage.py migrate
--
-- =====================================================

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================
-- CLEAR EXISTING DATA (Using DELETE IF EXISTS pattern)
-- =====================================================

-- Delete in reverse dependency order
DELETE FROM `message_read_receipts` WHERE 1=1;
DELETE FROM `messages` WHERE 1=1;
DELETE FROM `conversations_participants` WHERE 1=1;
DELETE FROM `conversations` WHERE 1=1;
DELETE FROM `announcement_reads` WHERE 1=1;
DELETE FROM `announcements` WHERE 1=1;
DELETE FROM `attendance_summaries` WHERE 1=1;
DELETE FROM `attendance_records` WHERE 1=1;
DELETE FROM `conduct_grades` WHERE 1=1;
DELETE FROM `behavior_reports_witnesses` WHERE 1=1;
DELETE FROM `behavior_reports` WHERE 1=1;
DELETE FROM `assessments` WHERE 1=1;
DELETE FROM `results` WHERE 1=1;
DELETE FROM `subject_teacher_assignments` WHERE 1=1;
DELETE FROM `class_assignments` WHERE 1=1;
DELETE FROM `classes` WHERE 1=1;
DELETE FROM `parent_student_relationships` WHERE 1=1;
DELETE FROM `students` WHERE 1=1;
DELETE FROM `subjects` WHERE 1=1;
DELETE FROM `academic_terms` WHERE 1=1;
DELETE FROM `user_preferences` WHERE 1=1;
DELETE FROM `auth_user_groups` WHERE 1=1;
DELETE FROM `auth_user_user_permissions` WHERE 1=1;
DELETE FROM `users` WHERE 1=1;

-- =====================================================
-- USERS TABLE
-- =====================================================

INSERT INTO `users` (`id`, `username`, `email`, `password`, `role`, `phone_number`, `date_of_birth`, `address`, `emergency_contact`, `is_active`, `email_verified`, `is_staff`, `is_superuser`, `first_name`, `last_name`, `created_at`, `updated_at`) VALUES
-- Admin Users
('11111111-1111-1111-1111-111111111111', 'admin', 'admin@imboni.edu', 'pbkdf2_sha256$600000$test$test', 'admin', '+250788000001', '1985-03-15', 'Kigali, Rwanda', '+250788000002', 1, 1, 1, 1, 'System', 'Administrator', NOW(), NOW()),

-- Director of Studies
('22222222-2222-2222-2222-222222222222', 'dos1', 'dos@imboni.edu', 'pbkdf2_sha256$600000$test$test', 'dos', '+250788000011', '1980-06-20', 'Kigali, Rwanda', '+250788000012', 1, 1, 1, 0, 'Jean', 'Bosco', NOW(), NOW()),

-- Teachers
('33333333-3333-3333-3333-333333333331', 'teacher1', 'teacher1@imboni.edu', 'pbkdf2_sha256$600000$test$test', 'teacher', '+250788000101', '1988-01-10', 'Kigali, Rwanda', '+250788000102', 1, 1, 0, 0, 'Marie', 'Uwimana', NOW(), NOW()),
('33333333-3333-3333-3333-333333333332', 'teacher2', 'teacher2@imboni.edu', 'pbkdf2_sha256$600000$test$test', 'teacher', '+250788000103', '1990-04-25', 'Kigali, Rwanda', '+250788000104', 1, 1, 0, 0, 'Pierre', 'Ndayisenga', NOW(), NOW()),
('33333333-3333-3333-3333-333333333333', 'teacher3', 'teacher3@imboni.edu', 'pbkdf2_sha256$600000$test$test', 'teacher', '+250788000105', '1985-09-12', 'Kigali, Rwanda', '+250788000106', 1, 1, 0, 0, 'Grace', 'Mukamana', NOW(), NOW()),
('33333333-3333-3333-3333-333333333334', 'teacher4', 'teacher4@imboni.edu', 'pbkdf2_sha256$600000$test$test', 'teacher', '+250788000107', '1992-11-30', 'Kigali, Rwanda', '+250788000108', 1, 1, 0, 0, 'Emmanuel', 'Habimana', NOW(), NOW()),
('33333333-3333-3333-3333-333333333335', 'teacher5', 'teacher5@imboni.edu', 'pbkdf2_sha256$600000$test$test', 'teacher', '+250788000109', '1987-07-18', 'Kigali, Rwanda', '+250788000110', 1, 1, 0, 0, 'Claudine', 'Nyiraneza', NOW(), NOW()),

-- Students
('44444444-4444-4444-4444-444444444401', 'student1', 'student1@imboni.edu', 'pbkdf2_sha256$600000$test$test', 'student', '+250788001001', '2008-05-15', 'Kigali, Rwanda', '+250788001002', 1, 1, 0, 0, 'Eric', 'Niyonzima', NOW(), NOW()),
('44444444-4444-4444-4444-444444444402', 'student2', 'student2@imboni.edu', 'pbkdf2_sha256$600000$test$test', 'student', '+250788001003', '2008-08-22', 'Kigali, Rwanda', '+250788001004', 1, 1, 0, 0, 'Divine', 'Ishimwe', NOW(), NOW()),
('44444444-4444-4444-4444-444444444403', 'student3', 'student3@imboni.edu', 'pbkdf2_sha256$600000$test$test', 'student', '+250788001005', '2007-02-10', 'Kigali, Rwanda', '+250788001006', 1, 1, 0, 0, 'Patrick', 'Mazimpaka', NOW(), NOW()),
('44444444-4444-4444-4444-444444444404', 'student4', 'student4@imboni.edu', 'pbkdf2_sha256$600000$test$test', 'student', '+250788001007', '2008-11-05', 'Kigali, Rwanda', '+250788001008', 1, 1, 0, 0, 'Amina', 'Uwase', NOW(), NOW()),
('44444444-4444-4444-4444-444444444405', 'student5', 'student5@imboni.edu', 'pbkdf2_sha256$600000$test$test', 'student', '+250788001009', '2007-06-28', 'Kigali, Rwanda', '+250788001010', 1, 1, 0, 0, 'Brian', 'Ndayambaje', NOW(), NOW()),
('44444444-4444-4444-4444-444444444406', 'student6', 'student6@imboni.edu', 'pbkdf2_sha256$600000$test$test', 'student', '+250788001011', '2008-03-14', 'Kigali, Rwanda', '+250788001012', 1, 1, 0, 0, 'Sandra', 'Ingabire', NOW(), NOW()),
('44444444-4444-4444-4444-444444444407', 'student7', 'student7@imboni.edu', 'pbkdf2_sha256$600000$test$test', 'student', '+250788001013', '2007-09-20', 'Kigali, Rwanda', '+250788001014', 1, 1, 0, 0, 'James', 'Rukundo', NOW(), NOW()),
('44444444-4444-4444-4444-444444444408', 'student8', 'student8@imboni.edu', 'pbkdf2_sha256$600000$test$test', 'student', '+250788001015', '2008-12-01', 'Kigali, Rwanda', '+250788001016', 1, 1, 0, 0, 'Lilian', 'Mutesi', NOW(), NOW()),
('44444444-4444-4444-4444-444444444409', 'student9', 'student9@imboni.edu', 'pbkdf2_sha256$600000$test$test', 'student', '+250788001017', '2007-04-08', 'Kigali, Rwanda', '+250788001018', 1, 1, 0, 0, 'Robert', 'Nsengiyumva', NOW(), NOW()),
('44444444-4444-4444-4444-444444444410', 'student10', 'student10@imboni.edu', 'pbkdf2_sha256$600000$test$test', 'student', '+250788001019', '2008-07-16', 'Kigali, Rwanda', '+250788001020', 1, 1, 0, 0, 'Emma', 'Bizimungu', NOW(), NOW()),

-- Parents
('55555555-5555-5555-5555-555555555501', 'parent1', 'parent1@gmail.com', 'pbkdf2_sha256$600000$test$test', 'parent', '+250788002001', '1980-01-15', 'Kigali, Rwanda', '+250788002002', 1, 1, 0, 0, 'John', 'Niyonzima', NOW(), NOW()),
('55555555-5555-5555-5555-555555555502', 'parent2', 'parent2@gmail.com', 'pbkdf2_sha256$600000$test$test', 'parent', '+250788002003', '1982-03-22', 'Kigali, Rwanda', '+250788002004', 1, 1, 0, 0, 'Mary', 'Mukamana', NOW(), NOW()),
('55555555-5555-5555-5555-555555555503', 'parent3', 'parent3@gmail.com', 'pbkdf2_sha256$600000$test$test', 'parent', '+250788002005', '1978-06-10', 'Kigali, Rwanda', '+250788002006', 1, 1, 0, 0, 'Peter', 'Mazimpaka', NOW(), NOW()),
('55555555-5555-5555-5555-555555555504', 'parent4', 'parent4@gmail.com', 'pbkdf2_sha256$600000$test$test', 'parent', '+250788002007', '1985-09-18', 'Kigali, Rwanda', '+250788002008', 1, 1, 0, 0, 'Sarah', 'Uwase', NOW(), NOW()),
('55555555-5555-5555-5555-555555555505', 'parent5', 'parent5@gmail.com', 'pbkdf2_sha256$600000$test$test', 'parent', '+250788002009', '1983-12-05', 'Kigali, Rwanda', '+250788002010', 1, 1, 0, 0, 'David', 'Ndayambaje', NOW(), NOW());

-- =====================================================
-- USER PREFERENCES TABLE
-- =====================================================

INSERT INTO `user_preferences` (`id`, `user_id`, `notification_email`, `notification_sms`, `notification_push`, `language`, `timezone`, `theme`) VALUES
(UUID(), '11111111-1111-1111-1111-111111111111', 1, 0, 1, 'en', 'Africa/Kigali', 'light'),
(UUID(), '22222222-2222-2222-2222-222222222222', 1, 0, 1, 'en', 'Africa/Kigali', 'light'),
(UUID(), '33333333-3333-3333-3333-333333333331', 1, 0, 1, 'en', 'Africa/Kigali', 'light'),
(UUID(), '33333333-3333-3333-3333-333333333332', 1, 0, 1, 'en', 'Africa/Kigali', 'dark'),
(UUID(), '33333333-3333-3333-3333-333333333333', 1, 0, 1, 'en', 'Africa/Kigali', 'light'),
(UUID(), '44444444-4444-4444-4444-444444444401', 1, 0, 1, 'en', 'Africa/Kigali', 'light'),
(UUID(), '44444444-4444-4444-4444-444444444402', 1, 0, 1, 'en', 'Africa/Kigali', 'light'),
(UUID(), '44444444-4444-4444-4444-444444444403', 1, 0, 1, 'en', 'Africa/Kigali', 'light'),
(UUID(), '55555555-5555-5555-5555-555555555501', 1, 1, 1, 'en', 'Africa/Kigali', 'light'),
(UUID(), '55555555-5555-5555-5555-555555555502', 1, 1, 1, 'en', 'Africa/Kigali', 'light');

-- =====================================================
-- SUBJECTS TABLE
-- =====================================================

INSERT INTO `subjects` (`id`, `name`, `code`, `description`, `credit_hours`, `is_active`, `created_at`) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'Mathematics', 'MATH101', 'Core mathematics covering algebra, geometry, and calculus', 4, 1, NOW()),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'Physics', 'PHY101', 'Fundamental physics concepts and applications', 4, 1, NOW()),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'Chemistry', 'CHEM101', 'Introduction to chemical principles and reactions', 4, 1, NOW()),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'Biology', 'BIO101', 'Study of living organisms and life processes', 4, 1, NOW()),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', 'English', 'ENG101', 'English language and literature', 4, 1, NOW()),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6', 'Kinyarwanda', 'KIN101', 'Rwandan national language studies', 3, 1, NOW()),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa7', 'French', 'FRE101', 'French language studies', 3, 1, NOW()),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa8', 'History', 'HIS101', 'World and African history', 3, 1, NOW()),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa9', 'Geography', 'GEO101', 'Physical and human geography', 3, 1, NOW()),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa10', 'Computer Science', 'CS101', 'Introduction to programming and computing', 3, 1, NOW());

-- =====================================================
-- ACADEMIC TERMS TABLE
-- =====================================================

INSERT INTO `academic_terms` (`id`, `name`, `term`, `year`, `start_date`, `end_date`, `is_current`) VALUES
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'Term 1 2024', 'term1', 2024, '2024-01-08', '2024-04-05', 0),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'Term 2 2024', 'term2', 2024, '2024-04-22', '2024-07-26', 0),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'Term 3 2024', 'term3', 2024, '2024-08-12', '2024-11-15', 0),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'Term 1 2025', 'term1', 2025, '2025-01-06', '2025-04-04', 1),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5', 'Term 2 2025', 'term2', 2025, '2025-04-21', '2025-07-25', 0);

-- =====================================================
-- STUDENTS TABLE
-- =====================================================

INSERT INTO `students` (`id`, `user_id`, `student_id`, `grade`, `section`, `enrollment_date`, `status`, `blood_group`, `allergies`, `medical_conditions`, `current_gpa`, `attendance_percentage`, `created_at`, `updated_at`) VALUES
('cccccccc-cccc-cccc-cccc-ccccccccccc1', '44444444-4444-4444-4444-444444444401', 'STD2024001', '1', 'A', '2024-01-08', 'active', 'O+', 'None', 'None', 85.50, 95.00, NOW(), NOW()),
('cccccccc-cccc-cccc-cccc-ccccccccccc2', '44444444-4444-4444-4444-444444444402', 'STD2024002', '1', 'A', '2024-01-08', 'active', 'A+', 'Peanuts', 'None', 78.25, 92.50, NOW(), NOW()),
('cccccccc-cccc-cccc-cccc-ccccccccccc3', '44444444-4444-4444-4444-444444444403', 'STD2024003', '1', 'B', '2024-01-08', 'active', 'B+', 'None', 'Asthma', 92.00, 98.00, NOW(), NOW()),
('cccccccc-cccc-cccc-cccc-ccccccccccc4', '44444444-4444-4444-4444-444444444404', 'STD2024004', '1', 'B', '2024-01-08', 'active', 'AB+', 'None', 'None', 88.75, 94.50, NOW(), NOW()),
('cccccccc-cccc-cccc-cccc-ccccccccccc5', '44444444-4444-4444-4444-444444444405', 'STD2024005', '2', 'A', '2023-01-09', 'active', 'O-', 'Dairy', 'None', 75.00, 90.00, NOW(), NOW()),
('cccccccc-cccc-cccc-cccc-ccccccccccc6', '44444444-4444-4444-4444-444444444406', 'STD2024006', '2', 'A', '2023-01-09', 'active', 'A+', 'None', 'None', 82.50, 96.50, NOW(), NOW()),
('cccccccc-cccc-cccc-cccc-ccccccccccc7', '44444444-4444-4444-4444-444444444407', 'STD2024007', '2', 'B', '2023-01-09', 'active', 'B-', 'None', 'None', 79.00, 88.00, NOW(), NOW()),
('cccccccc-cccc-cccc-cccc-ccccccccccc8', '44444444-4444-4444-4444-444444444408', 'STD2024008', '2', 'B', '2023-01-09', 'active', 'O+', 'None', 'None', 91.25, 97.00, NOW(), NOW()),
('cccccccc-cccc-cccc-cccc-ccccccccccc9', '44444444-4444-4444-4444-444444444409', 'STD2024009', '3', 'A', '2022-01-10', 'active', 'A-', 'Penicillin', 'None', 86.75, 93.50, NOW(), NOW()),
('cccccccc-cccc-cccc-cccc-cccccccccc10', '44444444-4444-4444-4444-444444444410', 'STD2024010', '3', 'A', '2022-01-10', 'active', 'B+', 'None', 'None', 89.00, 95.50, NOW(), NOW());

-- =====================================================
-- PARENT-STUDENT RELATIONSHIPS TABLE
-- =====================================================

INSERT INTO `parent_student_relationships` (`id`, `parent_id`, `student_id`, `relationship_type`, `is_primary_contact`, `can_pickup`, `created_at`) VALUES
(UUID(), '55555555-5555-5555-5555-555555555501', 'cccccccc-cccc-cccc-cccc-ccccccccccc1', 'father', 1, 1, NOW()),
(UUID(), '55555555-5555-5555-5555-555555555502', 'cccccccc-cccc-cccc-cccc-ccccccccccc1', 'mother', 0, 1, NOW()),
(UUID(), '55555555-5555-5555-5555-555555555502', 'cccccccc-cccc-cccc-cccc-ccccccccccc2', 'mother', 1, 1, NOW()),
(UUID(), '55555555-5555-5555-5555-555555555503', 'cccccccc-cccc-cccc-cccc-ccccccccccc3', 'father', 1, 1, NOW()),
(UUID(), '55555555-5555-5555-5555-555555555504', 'cccccccc-cccc-cccc-cccc-ccccccccccc4', 'mother', 1, 1, NOW()),
(UUID(), '55555555-5555-5555-5555-555555555505', 'cccccccc-cccc-cccc-cccc-ccccccccccc5', 'father', 1, 1, NOW()),
(UUID(), '55555555-5555-5555-5555-555555555501', 'cccccccc-cccc-cccc-cccc-ccccccccccc6', 'father', 1, 1, NOW()),
(UUID(), '55555555-5555-5555-5555-555555555503', 'cccccccc-cccc-cccc-cccc-ccccccccccc7', 'father', 1, 1, NOW()),
(UUID(), '55555555-5555-5555-5555-555555555504', 'cccccccc-cccc-cccc-cccc-ccccccccccc8', 'mother', 1, 1, NOW()),
(UUID(), '55555555-5555-5555-5555-555555555505', 'cccccccc-cccc-cccc-cccc-ccccccccccc9', 'father', 1, 1, NOW());

-- =====================================================
-- CLASSES TABLE
-- =====================================================

INSERT INTO `classes` (`id`, `name`, `grade`, `section`, `class_teacher_id`, `max_students`, `room_number`, `is_active`, `created_at`, `updated_at`) VALUES
('dddddddd-dddd-dddd-dddd-dddddddddd01', 'Secondary 1A', '1', 'A', '33333333-3333-3333-3333-333333333331', 40, 'Room 101', 1, NOW(), NOW()),
('dddddddd-dddd-dddd-dddd-dddddddddd02', 'Secondary 1B', '1', 'B', '33333333-3333-3333-3333-333333333332', 40, 'Room 102', 1, NOW(), NOW()),
('dddddddd-dddd-dddd-dddd-dddddddddd03', 'Secondary 2A', '2', 'A', '33333333-3333-3333-3333-333333333333', 40, 'Room 201', 1, NOW(), NOW()),
('dddddddd-dddd-dddd-dddd-dddddddddd04', 'Secondary 2B', '2', 'B', '33333333-3333-3333-3333-333333333334', 40, 'Room 202', 1, NOW(), NOW()),
('dddddddd-dddd-dddd-dddd-dddddddddd05', 'Secondary 3A', '3', 'A', '33333333-3333-3333-3333-333333333335', 40, 'Room 301', 1, NOW(), NOW());

-- =====================================================
-- CLASS ASSIGNMENTS TABLE
-- =====================================================

INSERT INTO `class_assignments` (`id`, `class_obj_id`, `student_id`, `term_id`, `assigned_date`) VALUES
(UUID(), 'dddddddd-dddd-dddd-dddd-dddddddddd01', 'cccccccc-cccc-cccc-cccc-ccccccccccc1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', '2025-01-06'),
(UUID(), 'dddddddd-dddd-dddd-dddd-dddddddddd01', 'cccccccc-cccc-cccc-cccc-ccccccccccc2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', '2025-01-06'),
(UUID(), 'dddddddd-dddd-dddd-dddd-dddddddddd02', 'cccccccc-cccc-cccc-cccc-ccccccccccc3', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', '2025-01-06'),
(UUID(), 'dddddddd-dddd-dddd-dddd-dddddddddd02', 'cccccccc-cccc-cccc-cccc-ccccccccccc4', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', '2025-01-06'),
(UUID(), 'dddddddd-dddd-dddd-dddd-dddddddddd03', 'cccccccc-cccc-cccc-cccc-ccccccccccc5', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', '2025-01-06'),
(UUID(), 'dddddddd-dddd-dddd-dddd-dddddddddd03', 'cccccccc-cccc-cccc-cccc-ccccccccccc6', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', '2025-01-06'),
(UUID(), 'dddddddd-dddd-dddd-dddd-dddddddddd04', 'cccccccc-cccc-cccc-cccc-ccccccccccc7', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', '2025-01-06'),
(UUID(), 'dddddddd-dddd-dddd-dddd-dddddddddd04', 'cccccccc-cccc-cccc-cccc-ccccccccccc8', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', '2025-01-06'),
(UUID(), 'dddddddd-dddd-dddd-dddd-dddddddddd05', 'cccccccc-cccc-cccc-cccc-ccccccccccc9', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', '2025-01-06'),
(UUID(), 'dddddddd-dddd-dddd-dddd-dddddddddd05', 'cccccccc-cccc-cccc-cccc-cccccccccc10', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', '2025-01-06');

-- =====================================================
-- SUBJECT TEACHER ASSIGNMENTS TABLE
-- =====================================================

INSERT INTO `subject_teacher_assignments` (`id`, `teacher_id`, `subject_id`, `class_obj_id`, `term_id`) VALUES
(UUID(), '33333333-3333-3333-3333-333333333331', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'dddddddd-dddd-dddd-dddd-dddddddddd01', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4'),
(UUID(), '33333333-3333-3333-3333-333333333331', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'dddddddd-dddd-dddd-dddd-dddddddddd02', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4'),
(UUID(), '33333333-3333-3333-3333-333333333332', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'dddddddd-dddd-dddd-dddd-dddddddddd01', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4'),
(UUID(), '33333333-3333-3333-3333-333333333332', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'dddddddd-dddd-dddd-dddd-dddddddddd02', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4'),
(UUID(), '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'dddddddd-dddd-dddd-dddd-dddddddddd03', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4'),
(UUID(), '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'dddddddd-dddd-dddd-dddd-dddddddddd03', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4'),
(UUID(), '33333333-3333-3333-3333-333333333334', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', 'dddddddd-dddd-dddd-dddd-dddddddddd04', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4'),
(UUID(), '33333333-3333-3333-3333-333333333334', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6', 'dddddddd-dddd-dddd-dddd-dddddddddd04', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4'),
(UUID(), '33333333-3333-3333-3333-333333333335', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa7', 'dddddddd-dddd-dddd-dddd-dddddddddd05', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4'),
(UUID(), '33333333-3333-3333-3333-333333333335', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa8', 'dddddddd-dddd-dddd-dddd-dddddddddd05', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4');

-- =====================================================
-- RESULTS TABLE
-- =====================================================

INSERT INTO `results` (`id`, `student_id`, `subject_id`, `term_id`, `teacher_id`, `quiz_average`, `group_work`, `exam_score`, `final_score`, `grade`, `teacher_comment`, `dos_comment`, `status`, `submitted_at`, `approved_by`, `approved_at`, `rejection_reason`, `created_at`, `updated_at`) VALUES
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', '33333333-3333-3333-3333-333333333331', 85.00, 88.00, 90.00, 87.67, 'B', 'Excellent performance in algebra', 'Keep up the good work', 'approved', NOW(), '22222222-2222-2222-2222-222222222222', NOW(), '', NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', '33333333-3333-3333-3333-333333333332', 78.00, 82.00, 85.00, 81.67, 'B', 'Good understanding of physics concepts', '', 'approved', NOW(), '22222222-2222-2222-2222-222222222222', NOW(), '', NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', '33333333-3333-3333-3333-333333333331', 72.00, 75.00, 78.00, 75.00, 'C', 'Needs improvement in geometry', 'Extra tutoring recommended', 'approved', NOW(), '22222222-2222-2222-2222-222222222222', NOW(), '', NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', '33333333-3333-3333-3333-333333333333', 92.00, 95.00, 98.00, 95.00, 'A', 'Outstanding performance', 'Exceptional student', 'approved', NOW(), '22222222-2222-2222-2222-222222222222', NOW(), '', NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc4', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', '33333333-3333-3333-3333-333333333333', 88.00, 85.00, 90.00, 87.67, 'B', 'Good understanding of biology', '', 'approved', NOW(), '22222222-2222-2222-2222-222222222222', NOW(), '', NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc5', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', '33333333-3333-3333-3333-333333333334', 65.00, 70.00, 68.00, 67.67, 'D', 'Needs to work on essay writing', '', 'submitted', NOW(), NULL, NULL, '', NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc6', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', '33333333-3333-3333-3333-333333333334', 82.00, 85.00, 88.00, 85.00, 'B', 'Good comprehension skills', '', 'approved', NOW(), '22222222-2222-2222-2222-222222222222', NOW(), '', NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc7', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', '33333333-3333-3333-3333-333333333334', 75.00, 78.00, 72.00, 75.00, 'C', 'Average performance', '', 'draft', NULL, NULL, NULL, '', NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc8', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa7', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', '33333333-3333-3333-3333-333333333335', 90.00, 92.00, 95.00, 92.33, 'A', 'Excellent French skills', 'Outstanding', 'approved', NOW(), '22222222-2222-2222-2222-222222222222', NOW(), '', NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc9', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa8', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', '33333333-3333-3333-3333-333333333335', 78.00, 80.00, 82.00, 80.00, 'B', 'Good historical analysis', '', 'approved', NOW(), '22222222-2222-2222-2222-222222222222', NOW(), '', NOW(), NOW());

-- =====================================================
-- ASSESSMENTS TABLE
-- =====================================================

INSERT INTO `assessments` (`id`, `student_id`, `subject_id`, `term_id`, `title`, `assessment_type`, `date`, `max_score`, `score_obtained`, `percentage`, `teacher_notes`, `created_at`) VALUES
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'Algebra Quiz 1', 'quiz', '2025-01-15', 20.00, 18.00, 90.00, 'Excellent work on linear equations', NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'Geometry Homework', 'homework', '2025-01-20', 50.00, 45.00, 90.00, 'Good understanding of triangles', NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'Algebra Quiz 1', 'quiz', '2025-01-15', 20.00, 15.00, 75.00, 'Needs more practice', NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'Chemistry Lab Report', 'lab', '2025-01-18', 100.00, 95.00, 95.00, 'Excellent lab work', NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc4', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'Biology Project', 'project', '2025-01-22', 100.00, 88.00, 88.00, 'Good research on cells', NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc5', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'Essay Writing', 'homework', '2025-01-25', 50.00, 35.00, 70.00, 'Work on grammar', NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc6', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'Essay Writing', 'homework', '2025-01-25', 50.00, 42.00, 84.00, 'Good structure and content', NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc8', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa7', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'French Presentation', 'presentation', '2025-01-28', 100.00, 92.00, 92.00, 'Excellent pronunciation', NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc9', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa8', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'History Quiz', 'quiz', '2025-01-30', 30.00, 24.00, 80.00, 'Good knowledge of African history', NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-cccccccccc10', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa9', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'Map Reading Test', 'quiz', '2025-02-01', 40.00, 36.00, 90.00, 'Excellent map skills', NOW());

-- =====================================================
-- ATTENDANCE RECORDS TABLE
-- =====================================================

INSERT INTO `attendance_records` (`id`, `student_id`, `date`, `status`, `time_in`, `time_out`, `minutes_late`, `notes`, `marked_by`, `created_at`, `updated_at`) VALUES
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc1', '2025-01-06', 'present', '07:30:00', '16:00:00', 0, '', '33333333-3333-3333-3333-333333333331', NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc1', '2025-01-07', 'present', '07:35:00', '16:00:00', 0, '', '33333333-3333-3333-3333-333333333331', NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc1', '2025-01-08', 'late', '08:15:00', '16:00:00', 45, 'Traffic delay', '33333333-3333-3333-3333-333333333331', NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc2', '2025-01-06', 'present', '07:25:00', '16:00:00', 0, '', '33333333-3333-3333-3333-333333333331', NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc2', '2025-01-07', 'absent', NULL, NULL, 0, 'Sick - fever', '33333333-3333-3333-3333-333333333331', NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc2', '2025-01-08', 'present', '07:40:00', '16:00:00', 0, '', '33333333-3333-3333-3333-333333333331', NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc3', '2025-01-06', 'present', '07:20:00', '16:00:00', 0, '', '33333333-3333-3333-3333-333333333332', NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc3', '2025-01-07', 'present', '07:28:00', '16:00:00', 0, '', '33333333-3333-3333-3333-333333333332', NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc3', '2025-01-08', 'present', '07:30:00', '16:00:00', 0, '', '33333333-3333-3333-3333-333333333332', NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc4', '2025-01-06', 'excused', NULL, NULL, 0, 'Medical appointment', '33333333-3333-3333-3333-333333333332', NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc4', '2025-01-07', 'present', '07:45:00', '16:00:00', 0, '', '33333333-3333-3333-3333-333333333332', NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc5', '2025-01-06', 'present', '07:35:00', '16:00:00', 0, '', '33333333-3333-3333-3333-333333333333', NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc5', '2025-01-07', 'late', '08:00:00', '16:00:00', 30, '', '33333333-3333-3333-3333-333333333333', NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc6', '2025-01-06', 'present', '07:30:00', '16:00:00', 0, '', '33333333-3333-3333-3333-333333333333', NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc7', '2025-01-06', 'present', '07:40:00', '16:00:00', 0, '', '33333333-3333-3333-3333-333333333334', NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc8', '2025-01-06', 'present', '07:25:00', '16:00:00', 0, '', '33333333-3333-3333-3333-333333333334', NOW(), NOW());

-- =====================================================
-- ATTENDANCE SUMMARIES TABLE
-- =====================================================

INSERT INTO `attendance_summaries` (`id`, `student_id`, `month`, `year`, `total_days`, `present_days`, `absent_days`, `late_days`, `excused_days`, `attendance_percentage`, `updated_at`) VALUES
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc1', 1, 2025, 20, 18, 1, 1, 0, 90.00, NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc2', 1, 2025, 20, 17, 2, 1, 0, 85.00, NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc3', 1, 2025, 20, 20, 0, 0, 0, 100.00, NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc4', 1, 2025, 20, 18, 0, 1, 1, 90.00, NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc5', 1, 2025, 20, 17, 1, 2, 0, 85.00, NOW());

-- =====================================================
-- BEHAVIOR REPORTS TABLE
-- =====================================================

INSERT INTO `behavior_reports` (`id`, `student_id`, `report_type`, `severity`, `title`, `description`, `date`, `location`, `reported_by`, `action_taken`, `follow_up_required`, `follow_up_date`, `follow_up_completed`, `parents_notified`, `parent_notification_date`, `created_at`, `updated_at`) VALUES
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc1', 'positive', NULL, 'Excellent Academic Performance', 'Student achieved highest marks in mathematics competition', '2025-01-20', 'Classroom', '33333333-3333-3333-3333-333333333331', 'Awarded certificate of excellence', 0, NULL, 0, 1, NOW(), NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc2', 'warning', 'minor', 'Late Submission of Assignment', 'Failed to submit homework on time for 3 consecutive days', '2025-01-18', 'Classroom', '33333333-3333-3333-3333-333333333331', 'Verbal warning given', 0, NULL, 0, 1, NOW(), NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc3', 'achievement', NULL, 'Science Fair Winner', 'Won first place in the school science fair', '2025-01-25', 'School Hall', '33333333-3333-3333-3333-333333333333', 'Certificate and prize awarded', 0, NULL, 0, 1, NOW(), NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc5', 'incident', 'moderate', 'Disruption in Class', 'Talking loudly during lesson and disturbing other students', '2025-01-22', 'Classroom', '33333333-3333-3333-3333-333333333333', 'Detention assigned', 1, '2025-02-05', 0, 1, NOW(), NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc7', 'positive', NULL, 'Helping Classmates', 'Helped classmates understand difficult concepts', '2025-01-28', 'Classroom', '33333333-3333-3333-3333-333333333334', 'Praised in front of class', 0, NULL, 0, 0, NULL, NOW(), NOW());

-- =====================================================
-- CONDUCT GRADES TABLE
-- =====================================================

INSERT INTO `conduct_grades` (`id`, `student_id`, `term_id`, `grade`, `positive_count`, `warning_count`, `incident_count`, `achievement_count`, `comment`, `created_at`, `updated_at`) VALUES
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'A', 2, 0, 0, 1, 'Excellent conduct throughout the term', NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'B', 0, 1, 0, 0, 'Good behavior with minor issues', NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc3', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'A', 1, 0, 0, 1, 'Outstanding student', NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc5', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'C', 0, 0, 1, 0, 'Needs to improve classroom behavior', NOW(), NOW()),
(UUID(), 'cccccccc-cccc-cccc-cccc-ccccccccccc7', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'B', 1, 0, 0, 0, 'Good helpful attitude', NOW(), NOW());

-- =====================================================
-- ANNOUNCEMENTS TABLE
-- =====================================================

INSERT INTO `announcements` (`id`, `title`, `content`, `category`, `target_audience`, `target_grade`, `author_id`, `status`, `published_at`, `expires_at`, `created_at`, `updated_at`) VALUES
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', 'Welcome Back to School!', 'We are excited to welcome all students back for Term 1 2025. Classes begin on January 6th, 2025.', 'general', 'all', '', '22222222-2222-2222-2222-222222222222', 'published', NOW(), '2025-02-28 23:59:59', NOW(), NOW()),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2', 'Parent-Teacher Meeting', 'All parents are invited to attend the parent-teacher meeting scheduled for January 25th, 2025 at 10:00 AM in the school hall.', 'event', 'parents', '', '22222222-2222-2222-2222-222222222222', 'published', NOW(), '2025-01-25 23:59:59', NOW(), NOW()),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3', 'Mid-Term Examinations', 'Mid-term examinations will be held from February 15th to February 22nd, 2025. Students are advised to prepare accordingly.', 'academic', 'all', '', '22222222-2222-2222-2222-222222222222', 'published', NOW(), '2025-02-22 23:59:59', NOW(), NOW()),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee4', 'Sports Day Announcement', 'Annual sports day will be held on February 28th, 2025. All students are encouraged to participate.', 'event', 'students', '', '33333333-3333-3333-3333-333333333331', 'published', NOW(), '2025-02-28 23:59:59', NOW(), NOW()),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee5', 'Urgent: School Closure', 'Due to unforeseen circumstances, the school will be closed on January 15th, 2025. Classes will resume on January 16th.', 'urgent', 'all', '', '11111111-1111-1111-1111-111111111111', 'published', NOW(), '2025-01-16 23:59:59', NOW(), NOW()),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee6', 'Science Fair Results', 'Congratulations to all participants of the Science Fair. Special mention to Patrick Mazimpaka for winning first place!', 'academic', 'all', '', '33333333-3333-3333-3333-333333333333', 'published', NOW(), '2025-03-31 23:59:59', NOW(), NOW()),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee7', 'Grade 1 Study Trip', 'Grade 1 students will have a study trip to the National Museum on February 10th, 2025. Permission slips required.', 'event', 'grade_specific', '1', '33333333-3333-3333-3333-333333333331', 'published', NOW(), '2025-02-10 23:59:59', NOW(), NOW()),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee8', 'Staff Meeting', 'All teachers are required to attend a staff meeting on January 20th, 2025 at 3:00 PM in the staff room.', 'general', 'teachers', '', '22222222-2222-2222-2222-222222222222', 'published', NOW(), '2025-01-20 23:59:59', NOW(), NOW());

-- =====================================================
-- ANNOUNCEMENT READS TABLE
-- =====================================================

INSERT INTO `announcement_reads` (`id`, `announcement_id`, `user_id`, `read_at`) VALUES
(UUID(), 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', '44444444-4444-4444-4444-444444444401', NOW()),
(UUID(), 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', '44444444-4444-4444-4444-444444444402', NOW()),
(UUID(), 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1', '55555555-5555-5555-5555-555555555501', NOW()),
(UUID(), 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2', '55555555-5555-5555-5555-555555555501', NOW()),
(UUID(), 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2', '55555555-5555-5555-5555-555555555502', NOW()),
(UUID(), 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3', '44444444-4444-4444-4444-444444444401', NOW()),
(UUID(), 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3', '44444444-4444-4444-4444-444444444403', NOW()),
(UUID(), 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee5', '44444444-4444-4444-4444-444444444401', NOW()),
(UUID(), 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee5', '55555555-5555-5555-5555-555555555501', NOW()),
(UUID(), 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee6', '44444444-4444-4444-4444-444444444403', NOW());

-- =====================================================
-- CONVERSATIONS TABLE
-- =====================================================

INSERT INTO `conversations` (`id`, `subject`, `is_group`, `created_at`, `updated_at`) VALUES
('ffffffff-ffff-ffff-ffff-fffffffffff1', 'Regarding Eric\'s Progress', 0, NOW(), NOW()),
('ffffffff-ffff-ffff-ffff-fffffffffff2', 'Parent-Teacher Meeting', 0, NOW(), NOW()),
('ffffffff-ffff-ffff-ffff-fffffffffff3', 'Science Fair Discussion', 1, NOW(), NOW()),
('ffffffff-ffff-ffff-ffff-fffffffffff4', 'Homework Help', 0, NOW(), NOW()),
('ffffffff-ffff-ffff-ffff-fffffffffff5', 'School Event Planning', 1, NOW(), NOW());

-- =====================================================
-- CONVERSATION PARTICIPANTS (Many-to-Many)
-- =====================================================

INSERT INTO `conversations_participants` (`conversation_id`, `user_id`) VALUES
('ffffffff-ffff-ffff-ffff-fffffffffff1', '55555555-5555-5555-5555-555555555501'),
('ffffffff-ffff-ffff-ffff-fffffffffff1', '33333333-3333-3333-3333-333333333331'),
('ffffffff-ffff-ffff-ffff-fffffffffff2', '55555555-5555-5555-5555-555555555502'),
('ffffffff-ffff-ffff-ffff-fffffffffff2', '33333333-3333-3333-3333-333333333332'),
('ffffffff-ffff-ffff-ffff-fffffffffff3', '33333333-3333-3333-3333-333333333331'),
('ffffffff-ffff-ffff-ffff-fffffffffff3', '33333333-3333-3333-3333-333333333332'),
('ffffffff-ffff-ffff-ffff-fffffffffff3', '33333333-3333-3333-3333-333333333333'),
('ffffffff-ffff-ffff-ffff-fffffffffff4', '44444444-4444-4444-4444-444444444401'),
('ffffffff-ffff-ffff-ffff-fffffffffff4', '33333333-3333-3333-3333-333333333331'),
('ffffffff-ffff-ffff-ffff-fffffffffff5', '22222222-2222-2222-2222-222222222222'),
('ffffffff-ffff-ffff-ffff-fffffffffff5', '33333333-3333-3333-3333-333333333331'),
('ffffffff-ffff-ffff-ffff-fffffffffff5', '33333333-3333-3333-3333-333333333332');

-- =====================================================
-- MESSAGES TABLE
-- =====================================================

INSERT INTO `messages` (`id`, `conversation_id`, `sender_id`, `content`, `is_read`, `read_at`, `created_at`) VALUES
(UUID(), 'ffffffff-ffff-ffff-ffff-fffffffffff1', '55555555-5555-5555-5555-555555555501', 'Hello, I wanted to discuss Eric\'s recent performance in mathematics.', 1, NOW(), NOW()),
(UUID(), 'ffffffff-ffff-ffff-ffff-fffffffffff1', '33333333-3333-3333-3333-333333333331', 'Good afternoon Mr. Niyonzima. Eric has been doing very well. He scored 90% in the last quiz.', 1, NOW(), NOW()),
(UUID(), 'ffffffff-ffff-ffff-ffff-fffffffffff1', '55555555-5555-5555-5555-555555555501', 'That\'s great to hear! Thank you for your support.', 1, NOW(), NOW()),
(UUID(), 'ffffffff-ffff-ffff-ffff-fffffffffff2', '55555555-5555-5555-5555-555555555502', 'Will there be a parent-teacher meeting this month?', 1, NOW(), NOW()),
(UUID(), 'ffffffff-ffff-ffff-ffff-fffffffffff2', '33333333-3333-3333-3333-333333333332', 'Yes, it\'s scheduled for January 25th at 10:00 AM.', 1, NOW(), NOW()),
(UUID(), 'ffffffff-ffff-ffff-ffff-fffffffffff3', '33333333-3333-3333-3333-333333333331', 'The science fair preparations are going well.', 0, NULL, NOW()),
(UUID(), 'ffffffff-ffff-ffff-ffff-fffffffffff3', '33333333-3333-3333-3333-333333333332', 'Great! My students are ready with their projects.', 0, NULL, NOW()),
(UUID(), 'ffffffff-ffff-ffff-ffff-fffffffffff4', '44444444-4444-4444-4444-444444444401', 'Teacher, I need help with the algebra homework.', 0, NULL, NOW()),
(UUID(), 'ffffffff-ffff-ffff-ffff-fffffffffff4', '33333333-3333-3333-3333-333333333331', 'Sure Eric, what specific problem are you struggling with?', 0, NULL, NOW()),
(UUID(), 'ffffffff-ffff-ffff-ffff-fffffffffff5', '22222222-2222-2222-2222-222222222222', 'Let\'s discuss the upcoming sports day arrangements.', 0, NULL, NOW());

-- =====================================================
-- MESSAGE READ RECEIPTS TABLE
-- =====================================================

INSERT INTO `message_read_receipts` (`id`, `message_id`, `user_id`, `read_at`) VALUES
(UUID(), (SELECT id FROM messages WHERE content = 'Hello, I wanted to discuss Eric\'s recent performance in mathematics.' LIMIT 1), '33333333-3333-3333-3333-333333333331', NOW()),
(UUID(), (SELECT id FROM messages WHERE content = 'Good afternoon Mr. Niyonzima. Eric has been doing very well. He scored 90% in the last quiz.' LIMIT 1), '55555555-5555-5555-5555-555555555501', NOW()),
(UUID(), (SELECT id FROM messages WHERE content = 'That\'s great to hear! Thank you for your support.' LIMIT 1), '33333333-3333-3333-3333-333333333331', NOW()),
(UUID(), (SELECT id FROM messages WHERE content = 'Will there be a parent-teacher meeting this month?' LIMIT 1), '33333333-3333-3333-3333-333333333332', NOW()),
(UUID(), (SELECT id FROM messages WHERE content = 'Yes, it\'s scheduled for January 25th at 10:00 AM.' LIMIT 1), '55555555-5555-5555-5555-555555555502', NOW());

-- =====================================================
-- RE-ENABLE FOREIGN KEY CHECKS
-- =====================================================

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- SEED DATA SUMMARY
-- =====================================================
-- 
-- Users: 21 total
--   - 1 Administrator
--   - 1 Director of Studies
--   - 5 Teachers
--   - 10 Students
--   - 5 Parents
--
-- Subjects: 10
-- Academic Terms: 5
-- Students: 10
-- Parent-Student Relationships: 10
-- Classes: 5
-- Class Assignments: 10
-- Subject-Teacher Assignments: 10
-- Results: 10
-- Assessments: 10
-- Attendance Records: 16
-- Attendance Summaries: 5
-- Behavior Reports: 5
-- Conduct Grades: 5
-- Announcements: 8
-- Announcement Reads: 10
-- Conversations: 5
-- Messages: 10
--
-- =====================================================
