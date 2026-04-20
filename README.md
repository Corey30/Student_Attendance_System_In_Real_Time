# Student Attendance Management System

A lightweight system for **class attendance tracking**, analytics, and reporting.  
Frontend is pure HTML/CSS/Vanilla JS with Chart.js; backend is Flask + MySQL.

## Features

- **Dashboard**
  - Today’s attendance summary
  - **Weekly trend** line chart
  - **Course attendance rate** bar chart
  - Recent attendance records
- **Attendance**
  - Load roster by section + date
  - One-click marking: ✓ Present / Late / ✗ Absent
  - “Mark all present” and instant UI updates
- **Students**
  - Search & filter by year/section
  - Detail modal: profile, enrollments, personal stats & history
  - CSV export
- **Reports**
  - Five report types (trend, detail, class/month/semester/ranking/warning)
  - Low-attendance warning (< 75%)
  - CSV export

## Tech Stack

- **Frontend:** HTML, CSS, Vanilla JS, Chart.js  
- **Backend:** Python Flask  
- **Database:** MySQL 8.0 (InnoDB, full ACID), UTF-8 `utf8mb4`

## 📁 Project Structure

```
.
├─ app.py                  # Flask entrypoint (routes & APIs)
├─ database.sql            # Full schema, views, and sample data
├─ templates/
│  ├─ login.html
│  ├─ dashboard.html
│  ├─ attendance.html
│  ├─ Reports.html
│  └─ Students.html
├─ static/
│  ├─ css/style.css
│  └─ js/
│     ├─ dashboard.js
│     ├─ attendance.js
│     ├─ reports.js
│     └─ students.js
└─ README.md
```

## Getting Started

### 1) Database

1. Install **MySQL 8.0** and ensure you have a user with create privileges.
2. Initialize the DB (creates `student_attendance_management` and seed data):
   ```bash
   mysql -u <user> -p < database.sql
   ```

**Sample accounts (for local demo):**
- Admin: `admin / admin123`
- Teachers: `hemn / pass123`, `baha / pass123`, `omar / pass123`

> Replace all sample credentials for production.

### 2) Backend

1. Install dependencies (example):
   ```bash
   pip install Flask mysql-connector-python
   # or use your preferred driver/ORM
   ```
2. Update DB connection settings in `app.py`.
3. Run:
   ```bash
   python app.py
   ```
4. Open `http://127.0.0.1:5000/` and log in with a demo account.

##  Core API (excerpt)

- `GET /api/dashboard/stats` — today stats, weekly trend, course rates  
- `GET /api/attendance/recent?limit=15` — recent records  
- `POST /api/attendance/record` — batch submit/update attendance  
- `GET /api/teacher/courses` — sections for the logged-in teacher (uses view `v_teacher_sections`)  
- `GET /api/attendance/class-roster` — today’s roster + status  
- `GET /api/students/my-students[?section_id=]` — students under the teacher  
- `GET /api/students/detail/<school_id>` — student profile  
- `GET /api/students/<school_id>/attendance-stats` — per-student stats  
- `GET /api/students/<school_id>/attendance-history?limit=20` — per-student history

## Database Design Highlights

- Engine: **InnoDB**, charset **utf8mb4** (full Unicode including emoji).
- Keys & constraints: proper **PRIMARY**, **FOREIGN**, **UNIQUE**.
- Indexed high-frequency fields (date/status/section/student).
- **Core table `attendance_records`:**
  - FKs → `sections`, `students`, `users` (teacher)
  - Separate **date** and **time** columns for flexible stats
  - **UNIQUE** `(student_id, section_id, attendance_date)` prevents duplicates
  - Multiple indexes for date/status/section queries
  - Cascading rules to preserve referential integrity

##  Demo Accounts

- Admin: `admin / admin123`  
- Teachers: `hemn / pass123`, `baha / pass123`, `omar / pass123`  
*(Sample only; rotate for production.)*


