SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";
SET FOREIGN_KEY_CHECKS = 0;

-- Create database
CREATE DATABASE IF NOT EXISTS `student_attendance_management` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `student_attendance_management`;

-- Drop tables if exist
DROP TABLE IF EXISTS `attendance_records`;
DROP TABLE IF EXISTS `enrollments`;
DROP TABLE IF EXISTS `sections`;
DROP TABLE IF EXISTS `courses`;
DROP TABLE IF EXISTS `students`;
DROP TABLE IF EXISTS `users`;

-- =====================================================
-- 1. Users Table (Teachers and Administrators)
-- =====================================================
CREATE TABLE `users` (
  `user_id` INT(11) NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(50) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `phone` VARCHAR(25) DEFAULT NULL,
  `role` ENUM('admin', 'teacher') DEFAULT 'teacher',
  `status` ENUM('Active', 'Inactive') DEFAULT 'Active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- 2. Students Table (without fixed section assignment)
-- =====================================================
CREATE TABLE `students` (
  `student_id` INT(11) NOT NULL AUTO_INCREMENT,
  `school_id` VARCHAR(25) NOT NULL,
  `first_name` VARCHAR(50) NOT NULL,
  `last_name` VARCHAR(50) NOT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `phone` VARCHAR(25) DEFAULT NULL,
  `year_level` ENUM('Freshman', 'Sophomore', 'Junior', 'Senior') NOT NULL,
  `major` VARCHAR(100) DEFAULT NULL,
  `gender` ENUM('Male', 'Female', 'Other') DEFAULT NULL,
  `date_of_birth` DATE DEFAULT NULL,
  `status` ENUM('Active', 'Inactive', 'Graduated') DEFAULT 'Active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`student_id`),
  UNIQUE KEY `school_id` (`school_id`),
  KEY `idx_name` (`first_name`, `last_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- 3. Courses Table (course definitions)
-- =====================================================
CREATE TABLE `courses` (
  `course_id` INT(11) NOT NULL AUTO_INCREMENT,
  `course_code` VARCHAR(20) NOT NULL,
  `course_name` VARCHAR(200) NOT NULL,
  `credits` INT(2) DEFAULT 3,
  `department` VARCHAR(100) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `status` ENUM('Active', 'Inactive') DEFAULT 'Active',
  PRIMARY KEY (`course_id`),
  UNIQUE KEY `course_code` (`course_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- 4. Sections Table (specific class sections)
-- =====================================================
CREATE TABLE `sections` (
  `section_id` INT(11) NOT NULL AUTO_INCREMENT,
  `course_id` INT(11) NOT NULL,
  `section_code` VARCHAR(10) NOT NULL COMMENT 'e.g., 01, 02, 03',
  `semester` VARCHAR(20) NOT NULL COMMENT 'e.g., Fall 2024, Spring 2025',
  `year` INT(4) NOT NULL,
  `teacher_id` INT(11) NOT NULL,
  `schedule` VARCHAR(100) DEFAULT NULL COMMENT 'e.g., MWF 10:00-11:30',
  `room` VARCHAR(50) DEFAULT NULL,
  `max_students` INT(11) DEFAULT 40,
  `status` ENUM('Active', 'Completed', 'Cancelled') DEFAULT 'Active',
  PRIMARY KEY (`section_id`),
  KEY `idx_course` (`course_id`),
  KEY `idx_teacher` (`teacher_id`),
  KEY `idx_semester` (`semester`, `year`),
  CONSTRAINT `sections_ibfk_1` FOREIGN KEY (`course_id`) REFERENCES `courses`(`course_id`) ON DELETE CASCADE,
  CONSTRAINT `sections_ibfk_2` FOREIGN KEY (`teacher_id`) REFERENCES `users`(`user_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- 5. Enrollments Table (many-to-many relationship)
-- =====================================================
CREATE TABLE `enrollments` (
  `enrollment_id` INT(11) NOT NULL AUTO_INCREMENT,
  `student_id` INT(11) NOT NULL,
  `section_id` INT(11) NOT NULL,
  `enrollment_date` DATE NOT NULL,
  `status` ENUM('Enrolled', 'Dropped', 'Completed') DEFAULT 'Enrolled',
  PRIMARY KEY (`enrollment_id`),
  UNIQUE KEY `unique_enrollment` (`student_id`, `section_id`),
  KEY `idx_student` (`student_id`),
  KEY `idx_section` (`section_id`),
  CONSTRAINT `enrollments_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE CASCADE,
  CONSTRAINT `enrollments_ibfk_2` FOREIGN KEY (`section_id`) REFERENCES `sections`(`section_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =====================================================
-- 6. Attendance Records Table
-- =====================================================
CREATE TABLE `attendance_records` (
  `attendance_id` INT(11) NOT NULL AUTO_INCREMENT,
  `section_id` INT(11) NOT NULL,
  `student_id` INT(11) NOT NULL,
  `attendance_date` DATE NOT NULL,
  `attendance_time` TIME DEFAULT NULL,
  `status` ENUM('Present', 'Absent', 'Late', 'Excused') NOT NULL,
  `remarks` TEXT DEFAULT NULL,
  `recorded_by` INT(11) DEFAULT NULL COMMENT 'Teacher user_id',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`attendance_id`),
  KEY `idx_section_date` (`section_id`, `attendance_date`),
  KEY `idx_student` (`student_id`),
  KEY `idx_date` (`attendance_date`),
  CONSTRAINT `attendance_records_ibfk_1` FOREIGN KEY (`section_id`) REFERENCES `sections`(`section_id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_records_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `students`(`student_id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_records_ibfk_3` FOREIGN KEY (`recorded_by`) REFERENCES `users`(`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- Sample Data Insertion
-- =====================================================

-- 1. Insert teacher users (3 teachers + 1 administrator)
INSERT INTO `users` (`username`, `password`, `full_name`, `email`, `phone`, `role`) VALUES
('admin', 'admin123', 'System Administrator', 'admin@university.edu', '1234567890', 'admin'),
('hemn', 'pass123', 'Dr. Hemn Barzan Abdalla', 'hemn@university.edu', '5551001001', 'teacher'),
('baha', 'pass123', 'Dr. Baha Ihnaini', 'baha@university.edu', '5551002002', 'teacher'),
('omar', 'pass123', 'Dr. Omar Dib', 'omar@university.edu', '5551003003', 'teacher');

-- 2. Insert course information
INSERT INTO `courses` (`course_code`, `course_name`, `credits`, `department`) VALUES
('CPS3740', 'Database Systems', 3, 'Computer Science'),
('CPS3320', 'Python Programming', 3, 'Computer Science'),
('CPS3440', 'Computer Algorithm', 3, 'Computer Science');

-- 3. Insert sections (2 sections per course, assigned to respective teachers)
-- Fall 2025 semester
INSERT INTO `sections` (`course_id`, `section_code`, `semester`, `year`, `teacher_id`, `schedule`, `room`) VALUES
-- CPS3740 - Database Systems (Hemn teaches 2 sections)
(1, '01', 'Fall 2025', 2025, 2, 'MWF 09:00-10:30', 'GHK301'),
(1, '02', 'Fall 2025', 2025, 2, 'TTH 13:00-14:30', 'GHK302'),
-- CPS3320 - Python Programming (Baha teaches 2 sections)
(2, '01', 'Fall 2025', 2025, 3, 'MWF 10:30-12:00', 'GHK303'),
(2, '02', 'Fall 2025', 2025, 3, 'TTH 09:00-10:30', 'GHK304'),
-- CPS3440 - Computer Algorithm (Omar teaches 2 sections)
(3, '01', 'Fall 2025', 2025, 4, 'MWF 13:00-14:30', 'GHK305'),
(3, '02', 'Fall 2025', 2025, 4, 'TTH 10:30-12:00', 'GHK306');

-- 4. Insert students (40 students)
INSERT INTO `students` (`school_id`, `first_name`, `last_name`, `email`, `year_level`, `major`, `gender`) VALUES
-- Freshman students (10 students)
('CS2024001', 'Gao', 'Gaoyuan', 'zhangga@student.edu', 'Freshman', 'Computer Science', 'Male'),
('CS2024002', 'Zhou', 'Chenchen', 'zhoucc@student.edu', 'Freshman', 'Computer Science', 'Female'),
('CS2024003', 'Omar', 'Ibrahim', 'omar.ibrahim@student.edu', 'Freshman', 'Computer Science', 'Male'),
('CS2024004', 'Fatima', 'Hassan', 'fatima.hassan@student.edu', 'Freshman', 'Computer Science', 'Female'),
('CS2024005', 'Youssef', 'Khalil', 'youssef.khalil@student.edu', 'Freshman', 'Computer Science', 'Male'),
('CS2024006', 'Noor', 'Ahmad', 'noor.ahmad@student.edu', 'Freshman', 'Computer Science', 'Female'),
('CS2024007', 'Karim', 'Saleh', 'karim.saleh@student.edu', 'Freshman', 'Computer Science', 'Male'),
('CS2024008', 'Layla', 'Mahmoud', 'layla.mahmoud@student.edu', 'Freshman', 'Computer Science', 'Female'),
('CS2024009', 'Hassan', 'Mustafa', 'hassan.mustafa@student.edu', 'Freshman', 'Computer Science', 'Male'),
('CS2024010', 'Amina', 'Omar', 'amina.omar@student.edu', 'Freshman', 'Computer Science', 'Female'),

-- Sophomore students (10 students)
('CS2023001', 'Zaid', 'Abdullah', 'zaid.abdullah@student.edu', 'Sophomore', 'Computer Science', 'Male'),
('CS2023002', 'Rana', 'Said', 'rana.said@student.edu', 'Sophomore', 'Computer Science', 'Female'),
('CS2023003', 'Tariq', 'Fares', 'tariq.fares@student.edu', 'Sophomore', 'Computer Science', 'Male'),
('CS2023004', 'Hala', 'Nasser', 'hala.nasser@student.edu', 'Sophomore', 'Computer Science', 'Female'),
('CS2023005', 'Rami', 'Younis', 'rami.younis@student.edu', 'Sophomore', 'Computer Science', 'Male'),
('CS2023006', 'Salma', 'Jaber', 'salma.jaber@student.edu', 'Sophomore', 'Computer Science', 'Female'),
('CS2023007', 'Fadi', 'Karam', 'fadi.karam@student.edu', 'Sophomore', 'Computer Science', 'Male'),
('CS2023008', 'Dina', 'Mansour', 'dina.mansour@student.edu', 'Sophomore', 'Computer Science', 'Female'),
('CS2023009', 'Nabil', 'Sharif', 'nabil.sharif@student.edu', 'Sophomore', 'Computer Science', 'Male'),
('CS2023010', 'Lina', 'Shaker', 'lina.shaker@student.edu', 'Sophomore', 'Computer Science', 'Female'),

-- Junior students (10 students)
('CS2022001', 'Majed', 'Habib', 'majed.habib@student.edu', 'Junior', 'Computer Science', 'Male'),
('CS2022002', 'Yasmin', 'Habash', 'yasmin.habash@student.edu', 'Junior', 'Computer Science', 'Female'),
('CS2022003', 'Wael', 'Bakri', 'wael.bakri@student.edu', 'Junior', 'Computer Science', 'Male'),
('CS2022004', 'Maya', 'Salem', 'maya.salem@student.edu', 'Junior', 'Computer Science', 'Female'),
('CS2022005', 'Sami', 'Darwish', 'sami.darwish@student.edu', 'Junior', 'Computer Science', 'Male'),
('CS2022006', 'Rania', 'Khouri', 'rania.khouri@student.edu', 'Junior', 'Computer Science', 'Female'),
('CS2022007', 'Bassam', 'Nader', 'bassam.nader@student.edu', 'Junior', 'Computer Science', 'Male'),
('CS2022008', 'Nada', 'Tawfik', 'nada.tawfik@student.edu', 'Junior', 'Computer Science', 'Female'),
('CS2022009', 'Imad', 'Aziz', 'imad.aziz@student.edu', 'Junior', 'Computer Science', 'Male'),
('CS2022010', 'Sana', 'Rashid', 'sana.rashid@student.edu', 'Junior', 'Computer Science', 'Female'),
('CS2022011', 'Cai', 'Enze', 'cez@student.edu', 'Junior', 'Computer Science', 'male'),


-- Senior students (10 students)
('CS2021001', 'Jamal', 'Haddad', 'jamal.haddad@student.edu', 'Senior', 'Computer Science', 'Male'),
('CS2021002', 'Leila', 'Ghanem', 'leila.ghanem@student.edu', 'Senior', 'Computer Science', 'Female'),
('CS2021003', 'Adnan', 'Qasim', 'adnan.qasim@student.edu', 'Senior', 'Computer Science', 'Male'),
('CS2021004', 'Samira', 'Zahir', 'samira.zahir@student.edu', 'Senior', 'Computer Science', 'Female'),
('CS2021005', 'Rafiq', 'Majid', 'rafiq.majid@student.edu', 'Senior', 'Computer Science', 'Male'),
('CS2021006', 'Amal', 'Farid', 'amal.farid@student.edu', 'Senior', 'Computer Science', 'Female'),
('CS2021007', 'Walid', 'Hamid', 'walid.hamid@student.edu', 'Senior', 'Computer Science', 'Male'),
('CS2021008', 'Reem', 'Nazir', 'reem.nazir@student.edu', 'Senior', 'Computer Science', 'Female'),
('CS2021009', 'Munir', 'Jalil', 'munir.jalil@student.edu', 'Senior', 'Computer Science', 'Male'),
('CS2021010', 'Suha', 'Wadi', 'suha.wadi@student.edu', 'Senior', 'Computer Science', 'Female');

-- 5. Insert student enrollments
-- CPS3740 Section 01 enrollment (12 students: mixed freshmen and sophomores)
INSERT INTO `enrollments` (`student_id`, `section_id`, `enrollment_date`, `status`) VALUES
(1, 1, '2025-09-01', 'Enrolled'),
(2, 1, '2025-09-01', 'Enrolled'),
(3, 1, '2025-09-01', 'Enrolled'),
(4, 1, '2025-09-01', 'Enrolled'),
(5, 1, '2025-09-01', 'Enrolled'),
(6, 1, '2025-09-01', 'Enrolled'),
(7, 1, '2025-09-01', 'Enrolled'),
(8, 1, '2025-09-01', 'Enrolled'),
(11, 1, '2025-09-01', 'Enrolled'),
(12, 1, '2025-09-01', 'Enrolled'),
(13, 1, '2025-09-01', 'Enrolled'),
(14, 1, '2025-09-01', 'Enrolled');

-- CPS3740 Section 02 enrollment (10 students: juniors and seniors)
INSERT INTO `enrollments` (`student_id`, `section_id`, `enrollment_date`, `status`) VALUES
(21, 2, '2025-09-01', 'Enrolled'),
(22, 2, '2025-09-01', 'Enrolled'),
(23, 2, '2025-09-01', 'Enrolled'),
(24, 2, '2025-09-01', 'Enrolled'),
(25, 2, '2025-09-01', 'Enrolled'),
(31, 2, '2025-09-01', 'Enrolled'),
(32, 2, '2025-09-01', 'Enrolled'),
(33, 2, '2025-09-01', 'Enrolled'),
(34, 2, '2025-09-01', 'Enrolled'),
(35, 2, '2025-09-01', 'Enrolled');

-- CPS3320 Section 01 enrollment (11 students: freshmen and sophomores)
INSERT INTO `enrollments` (`student_id`, `section_id`, `enrollment_date`, `status`) VALUES
(1, 3, '2025-09-01', 'Enrolled'),
(3, 3, '2025-09-01', 'Enrolled'),
(5, 3, '2025-09-01', 'Enrolled'),
(7, 3, '2025-09-01', 'Enrolled'),
(9, 3, '2025-09-01', 'Enrolled'),
(11, 3, '2025-09-01', 'Enrolled'),
(13, 3, '2025-09-01', 'Enrolled'),
(15, 3, '2025-09-01', 'Enrolled'),
(17, 3, '2025-09-01', 'Enrolled'),
(19, 3, '2025-09-01', 'Enrolled'),
(21, 3, '2025-09-01', 'Enrolled');

-- CPS3320 Section 02 enrollment (9 students: juniors)
INSERT INTO `enrollments` (`student_id`, `section_id`, `enrollment_date`, `status`) VALUES
(22, 4, '2025-09-01', 'Enrolled'),
(23, 4, '2025-09-01', 'Enrolled'),
(24, 4, '2025-09-01', 'Enrolled'),
(25, 4, '2025-09-01', 'Enrolled'),
(26, 4, '2025-09-01', 'Enrolled'),
(27, 4, '2025-09-01', 'Enrolled'),
(28, 4, '2025-09-01', 'Enrolled'),
(29, 4, '2025-09-01', 'Enrolled'),
(30, 4, '2025-09-01', 'Enrolled');

-- CPS3440 Section 01 enrollment (10 students: mixed all years)
INSERT INTO `enrollments` (`student_id`, `section_id`, `enrollment_date`, `status`) VALUES
(1, 5, '2025-09-01', 'Enrolled'),
(2, 5, '2025-09-01', 'Enrolled'),
(9, 5, '2025-09-01', 'Enrolled'),
(10, 5, '2025-09-01', 'Enrolled'),
(19, 5, '2025-09-01', 'Enrolled'),
(20, 5, '2025-09-01', 'Enrolled'),
(29, 5, '2025-09-01', 'Enrolled'),
(30, 5, '2025-09-01', 'Enrolled'),
(37, 5, '2025-09-01', 'Enrolled'),
(38, 5, '2025-09-01', 'Enrolled');

-- CPS3440 Section 02 enrollment (8 students: seniors)
INSERT INTO `enrollments` (`student_id`, `section_id`, `enrollment_date`, `status`) VALUES
(31, 6, '2025-09-01', 'Enrolled'),
(32, 6, '2025-09-01', 'Enrolled'),
(33, 6, '2025-09-01', 'Enrolled'),
(34, 6, '2025-09-01', 'Enrolled'),
(35, 6, '2025-09-01', 'Enrolled'),
(36, 6, '2025-09-01', 'Enrolled'),
(39, 6, '2025-09-01', 'Enrolled'),
(40, 6, '2025-09-01', 'Enrolled');

-- 6. Insert sample attendance records (recent data for testing)
-- CPS3740 Section 01 - Recent attendance
INSERT INTO `attendance_records` (`section_id`, `student_id`, `attendance_date`, `attendance_time`, `status`, `recorded_by`) VALUES
-- Today
(1, 1, CURDATE(), '09:05:00', 'Present', 2),
(1, 2, CURDATE(), '09:05:00', 'Present', 2),
(1, 3, CURDATE(), '09:05:00', 'Present', 2),
(1, 4, CURDATE(), '09:05:00', 'Present', 2),
(1, 5, CURDATE(), NULL, 'Absent', 2),
(1, 6, CURDATE(), '09:05:00', 'Present', 2),
(1, 7, CURDATE(), '09:05:00', 'Present', 2),
(1, 8, CURDATE(), '09:15:00', 'Late', 2),
(1, 11, CURDATE(), '09:05:00', 'Present', 2),
(1, 12, CURDATE(), '09:05:00', 'Present', 2),
-- Yesterday
(1, 1, DATE_SUB(CURDATE(), INTERVAL 1 DAY), '09:05:00', 'Present', 2),
(1, 2, DATE_SUB(CURDATE(), INTERVAL 1 DAY), '09:05:00', 'Present', 2),
(1, 3, DATE_SUB(CURDATE(), INTERVAL 1 DAY), '09:05:00', 'Present', 2),
(1, 4, DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL, 'Absent', 2),
(1, 5, DATE_SUB(CURDATE(), INTERVAL 1 DAY), '09:05:00', 'Present', 2),
-- 3 days ago
(1, 1, DATE_SUB(CURDATE(), INTERVAL 3 DAY), '09:05:00', 'Present', 2),
(1, 2, DATE_SUB(CURDATE(), INTERVAL 3 DAY), '09:05:00', 'Present', 2),
(1, 3, DATE_SUB(CURDATE(), INTERVAL 3 DAY), '09:20:00', 'Late', 2),
(1, 6, DATE_SUB(CURDATE(), INTERVAL 3 DAY), '09:05:00', 'Present', 2);

-- CPS3320 Section 01 - Recent attendance
INSERT INTO `attendance_records` (`section_id`, `student_id`, `attendance_date`, `attendance_time`, `status`, `recorded_by`) VALUES
-- Today
(3, 1, CURDATE(), '10:35:00', 'Present', 3),
(3, 3, CURDATE(), '10:35:00', 'Present', 3),
(3, 5, CURDATE(), NULL, 'Absent', 3),
(3, 7, CURDATE(), '10:40:00', 'Late', 3),
(3, 11, CURDATE(), '10:35:00', 'Present', 3),
(3, 13, CURDATE(), '10:35:00', 'Present', 3),
(3, 15, CURDATE(), '10:35:00', 'Present', 3),
-- Yesterday
(3, 1, DATE_SUB(CURDATE(), INTERVAL 1 DAY), '10:35:00', 'Present', 3),
(3, 3, DATE_SUB(CURDATE(), INTERVAL 1 DAY), '10:35:00', 'Present', 3),
(3, 5, DATE_SUB(CURDATE(), INTERVAL 1 DAY), '10:35:00', 'Present', 3),
(3, 7, DATE_SUB(CURDATE(), INTERVAL 1 DAY), '10:35:00', 'Present', 3);

-- CPS3440 Section 01 - Recent attendance
INSERT INTO `attendance_records` (`section_id`, `student_id`, `attendance_date`, `attendance_time`, `status`, `recorded_by`) VALUES
-- Today
(5, 1, CURDATE(), '13:05:00', 'Present', 4),
(5, 2, CURDATE(), '13:05:00', 'Present', 4),
(5, 9, CURDATE(), '13:10:00', 'Late', 4),
(5, 10, CURDATE(), '13:05:00', 'Present', 4),
(5, 19, CURDATE(), NULL, 'Absent', 4),
(5, 20, CURDATE(), '13:05:00', 'Present', 4),
(5, 29, CURDATE(), '13:05:00', 'Present', 4),
-- Yesterday
(5, 1, DATE_SUB(CURDATE(), INTERVAL 1 DAY), '13:05:00', 'Present', 4),
(5, 2, DATE_SUB(CURDATE(), INTERVAL 1 DAY), '13:05:00', 'Present', 4),
(5, 9, DATE_SUB(CURDATE(), INTERVAL 1 DAY), NULL, 'Absent', 4);

-- =====================================================
-- Create Views: Simplify queries
-- =====================================================

-- Drop existing views
DROP VIEW IF EXISTS v_teacher_sections;
DROP VIEW IF EXISTS v_section_roster;
DROP VIEW IF EXISTS v_today_attendance_summary;
DROP VIEW IF EXISTS v_student_attendance_history;
DROP VIEW IF EXISTS v_week_attendance_trend;

-- 1. Teacher sections view (shows all sections taught by teachers)
CREATE VIEW v_teacher_sections AS
SELECT
    u.user_id,
    u.username,
    u.full_name as teacher_name,
    s.section_id,
    c.course_code,
    c.course_name,
    s.section_code,
    s.semester,
    s.year,
    s.schedule,
    s.room,
    COUNT(DISTINCT e.student_id) as enrolled_students
FROM users u
JOIN sections s ON u.user_id = s.teacher_id
JOIN courses c ON s.course_id = c.course_id
LEFT JOIN enrollments e ON s.section_id = e.section_id AND e.status = 'Enrolled'
WHERE u.role = 'teacher' AND s.status = 'Active'
GROUP BY u.user_id, u.username, u.full_name, s.section_id, c.course_code,
         c.course_name, s.section_code, s.semester, s.year, s.schedule, s.room;

-- 2. Section roster view
CREATE VIEW v_section_roster AS
SELECT
    sec.section_id,
    c.course_code,
    c.course_name,
    sec.section_code,
    sec.semester,
    sec.year,
    st.student_id,
    st.school_id,
    CONCAT(st.first_name, ' ', st.last_name) as full_name,
    st.first_name,
    st.last_name,
    st.year_level,
    st.email,
    e.enrollment_date
FROM sections sec
JOIN courses c ON sec.course_id = c.course_id
JOIN enrollments e ON sec.section_id = e.section_id
JOIN students st ON e.student_id = st.student_id
WHERE e.status = 'Enrolled' AND sec.status = 'Active' AND st.status = 'Active'
ORDER BY c.course_code, sec.section_code, st.last_name, st.first_name;

-- 3. Today's attendance summary view
CREATE VIEW v_today_attendance_summary AS
SELECT
    s.section_id,
    c.course_code,
    c.course_name,
    s.section_code,
    u.full_name as teacher_name,
    COUNT(DISTINCT e.student_id) as total_students,
    COUNT(DISTINCT CASE WHEN a.status = 'Present' THEN a.student_id END) as present_count,
    COUNT(DISTINCT CASE WHEN a.status = 'Absent' THEN a.student_id END) as absent_count,
    COUNT(DISTINCT CASE WHEN a.status = 'Late' THEN a.student_id END) as late_count,
    COUNT(DISTINCT CASE WHEN a.status = 'Excused' THEN a.student_id END) as excused_count,
    ROUND(COUNT(DISTINCT CASE WHEN a.status = 'Present' THEN a.student_id END) * 100.0 /
          NULLIF(COUNT(DISTINCT e.student_id), 0), 2) as attendance_rate
FROM sections s
JOIN courses c ON s.course_id = c.course_id
JOIN users u ON s.teacher_id = u.user_id
LEFT JOIN enrollments e ON s.section_id = e.section_id AND e.status = 'Enrolled'
LEFT JOIN attendance_records a ON s.section_id = a.section_id
    AND a.attendance_date = CURDATE()
    AND a.student_id = e.student_id
WHERE s.status = 'Active'
GROUP BY s.section_id, c.course_code, c.course_name, s.section_code, u.full_name;

-- 4. Student attendance history view
CREATE VIEW v_student_attendance_history AS
SELECT
    st.student_id,
    st.school_id,
    CONCAT(st.first_name, ' ', st.last_name) as full_name,
    c.course_code,
    c.course_name,
    s.section_code,
    COUNT(a.attendance_id) as total_classes,
    SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) as present_count,
    SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) as absent_count,
    SUM(CASE WHEN a.status = 'Late' THEN 1 ELSE 0 END) as late_count,
    SUM(CASE WHEN a.status = 'Excused' THEN 1 ELSE 0 END) as excused_count,
    ROUND(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) * 100.0 /
          NULLIF(COUNT(a.attendance_id), 0), 2) as attendance_rate
FROM students st
JOIN enrollments e ON st.student_id = e.student_id
JOIN sections s ON e.section_id = s.section_id
JOIN courses c ON s.course_id = c.course_id
LEFT JOIN attendance_records a ON s.section_id = a.section_id AND st.student_id = a.student_id
WHERE e.status = 'Enrolled' AND st.status = 'Active'
GROUP BY st.student_id, st.school_id, st.first_name, st.last_name,
         c.course_code, c.course_name, s.section_code;

-- 5. Weekly attendance trend view
CREATE VIEW v_week_attendance_trend AS
SELECT
    a.attendance_date,
    DATE_FORMAT(a.attendance_date, '%W') as day_name,
    COUNT(DISTINCT a.section_id) as sections_with_attendance,
    COUNT(a.attendance_id) as total_records,
    SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) as present_count,
    SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) as absent_count,
    SUM(CASE WHEN a.status = 'Late' THEN 1 ELSE 0 END) as late_count,
    ROUND(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) * 100.0 /
          NULLIF(COUNT(a.attendance_id), 0), 2) as attendance_rate
FROM attendance_records a
WHERE a.attendance_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
GROUP BY a.attendance_date
ORDER BY a.attendance_date;

COMMIT;