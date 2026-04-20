"""
Student Attendance System - Redesigned Flask Backend
Database design improvements:
1. Students do not belong to a fixed section
2. Two-level structure: Course -> Section
3. Teachers manage students via enrollments
4. After login, a teacher only sees their own sections
"""

from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_cors import CORS
import mysql.connector
from mysql.connector import Error
from datetime import datetime, date, timedelta
import json
from functools import wraps

app = Flask(__name__)
app.secret_key = 'your-secret-key-change-this-in-production'
CORS(app)

# ==================== Database Configuration ====================
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '805925808zgy',  # Change to your password
    'database': 'student_attendance_management',
    'charset': 'utf8mb4'
}


# ==================== Database Connection Helpers ====================
def get_db_connection():
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        return connection
    except Error as e:
        print(f"Database connection error: {e}")
        return None


def execute_query(query, params=None, fetch=True):
    connection = get_db_connection()
    if not connection:
        return None
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(query, params or ())
        if fetch:
            result = cursor.fetchall()
        else:
            connection.commit()
            result = cursor.lastrowid
        cursor.close()
        connection.close()
        return result
    except Error as e:
        print(f"Query error: {e}")
        if connection:
            connection.close()
        return None


# ==================== Authentication Decorator ====================
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)

    return decorated_function


# ==================== Routes ====================

@app.route('/')
def index():
    """Home - redirect to dashboard"""
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))


@app.route('/login', methods=['GET', 'POST'])
def login():
    """User login"""
    if request.method == 'POST':
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')

        query = "SELECT * FROM users WHERE username = %s AND password = %s AND status = 'Active'"
        user = execute_query(query, (username, password))

        if user and len(user) > 0:
            session['user_id'] = user[0]['user_id']
            session['username'] = user[0]['username']
            session['name'] = user[0]['full_name']
            session['role'] = user[0]['role']
            return jsonify({'success': True, 'message': 'Login successfully'})
        else:
            return jsonify({'success': False, 'message': 'Username or Password is incorrect'})

    return render_template('login.html')


@app.route('/logout')
def logout():
    """User logout"""
    session.clear()
    return redirect(url_for('login'))


@app.route('/dashboard')
@login_required
def dashboard():
    """Real-time dashboard page"""
    return render_template('dashboard.html',
                           username=session.get('name'),
                           role=session.get('role'))


@app.route('/attendance')
@login_required
def attendance_page():
    """Attendance page - supports quick roll call"""
    return render_template('attendance.html',
                           username=session.get('name'),
                           role=session.get('role'))


@app.route('/students')
@login_required
def students_page():
    """Student management page"""
    return render_template('students.html',
                           username=session.get('name'),
                           role=session.get('role'))


@app.route('/reports')
@login_required
def reports_page():
    """Reports & statistics page"""
    return render_template('reports.html',
                           username=session.get('name'),
                           role=session.get('role'))


# ==================== APIs ====================

@app.route('/api/dashboard/stats', methods=['GET'])
@login_required
def get_dashboard_stats():
    """Get dashboard statistics"""
    today = date.today()
    user_id = session.get('user_id')
    role = session.get('role')

    # Filter by role
    if role == 'teacher':
        # Teacher sees only their sections
        where_clause = "AND s.teacher_id = %s"
        params = [today, user_id]
    else:
        # Admin sees all
        where_clause = ""
        params = [today]

    # Today's stats
    today_stats_query = f"""
        SELECT 
            COUNT(DISTINCT a.student_id) as total_students,
            SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) as present,
            SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) as absent,
            SUM(CASE WHEN a.status = 'Late' THEN 1 ELSE 0 END) as late,
            SUM(CASE WHEN a.status = 'Excused' THEN 1 ELSE 0 END) as excused
        FROM attendance_records a
        JOIN sections s ON a.section_id = s.section_id
        WHERE DATE(a.attendance_date) = %s {where_clause}
    """
    today_stats = execute_query(today_stats_query, tuple(params))

    # Compute attendance rate
    if today_stats and today_stats[0]['total_students'] > 0:
        total = today_stats[0]['total_students']
        present = today_stats[0]['present']
        attendance_rate = round((present / total) * 100, 2) if total > 0 else 0
    else:
        attendance_rate = 0
        today_stats = [{'total_students': 0, 'present': 0, 'absent': 0, 'late': 0, 'excused': 0}]

    # Week trend
    if role == 'teacher':
        week_params = [user_id]
    else:
        week_params = []

    week_trend_query = f"""
        SELECT 
            DATE(a.attendance_date) as date,
            COUNT(DISTINCT a.student_id) as total,
            SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) as present,
            ROUND(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as rate
        FROM attendance_records a
        JOIN sections s ON a.section_id = s.section_id
        WHERE a.attendance_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        {f"AND s.teacher_id = %s" if role == 'teacher' else ""}
        GROUP BY DATE(a.attendance_date)
        ORDER BY date
    """
    week_trend = execute_query(week_trend_query, tuple(week_params) if week_params else None)

    # Course stats (today)
    course_stats_query = f"""
        SELECT 
            c.course_name as Subject,
            COUNT(*) as total,
            SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) as present,
            ROUND(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as rate
        FROM attendance_records a
        JOIN sections s ON a.section_id = s.section_id
        JOIN courses c ON s.course_id = c.course_id
        WHERE DATE(a.attendance_date) = %s {where_clause}
        GROUP BY c.course_name
        ORDER BY rate DESC
    """
    course_stats = execute_query(course_stats_query, tuple(params))

    return jsonify({
        'success': True,
        'today_stats': {
            'total_students': today_stats[0]['total_students'],
            'present': today_stats[0]['present'],
            'absent': today_stats[0]['absent'],
            'late': today_stats[0]['late'],
            'excused': today_stats[0]['excused'],
            'attendance_rate': attendance_rate
        },
        'week_trend': week_trend or [],
        'course_stats': course_stats or []
    })


# ==================== Teacher Courses API ====================

@app.route('/api/teacher/courses', methods=['GET'])
@login_required
def get_teacher_courses():
    """Get list of sections taught by the current teacher"""
    user_id = session.get('user_id')
    role = session.get('role')

    if role == 'admin':
        # Admin can view all sections
        query = """
            SELECT 
                s.section_id,
                c.course_code as Course,
                c.course_name as Subject,
                s.section_code as Section,
                s.semester as Year,
                s.schedule as Time,
                s.room,
                COUNT(e.student_id) as student_count
            FROM sections s
            JOIN courses c ON s.course_id = c.course_id
            LEFT JOIN enrollments e ON s.section_id = e.section_id AND e.status = 'Enrolled'
            WHERE s.status = 'Active'
            GROUP BY s.section_id, c.course_code, c.course_name, s.section_code, s.semester, s.schedule, s.room
            ORDER BY c.course_code, s.section_code
        """
        courses = execute_query(query)
    else:
        # Teacher sees only their sections
        query = """
            SELECT 
                s.section_id,
                c.course_code as Course,
                c.course_name as Subject,
                s.section_code as Section,
                s.semester as Year,
                s.schedule as Time,
                s.room,
                COUNT(e.student_id) as student_count
            FROM sections s
            JOIN courses c ON s.course_id = c.course_id
            LEFT JOIN enrollments e ON s.section_id = e.section_id AND e.status = 'Enrolled'
            WHERE s.teacher_id = %s AND s.status = 'Active'
            GROUP BY s.section_id, c.course_code, c.course_name, s.section_code, s.semester, s.schedule, s.room
            ORDER BY c.course_code, s.section_code
        """
        courses = execute_query(query, (user_id,))

    return jsonify({
        'success': True,
        'courses': courses or []
    })


@app.route('/api/attendance/class-roster', methods=['GET'])
@login_required
def get_class_roster():
    """Get class roster by section"""
    # Get section info from query params
    section_id = request.args.get('section_id')

    # Fallback to old params if section_id not provided
    if not section_id:
        course_code = request.args.get('course')
        section_code = request.args.get('section')

        if not course_code or not section_code:
            return jsonify({'success': False, 'message': 'Missing section information'})

        # Lookup section_id
        section_query = """
            SELECT s.section_id 
            FROM sections s
            JOIN courses c ON s.course_id = c.course_id
            WHERE c.course_code = %s AND s.section_code = %s AND s.status = 'Active'
        """
        section_result = execute_query(section_query, (course_code, section_code))

        if not section_result:
            return jsonify({'success': False, 'message': 'Section not found'})

        section_id = section_result[0]['section_id']

    # Authorization
    user_id = session.get('user_id')
    role = session.get('role')

    if role != 'admin':
        # Verify the section belongs to the current teacher
        auth_query = "SELECT section_id FROM sections WHERE section_id = %s AND teacher_id = %s"
        auth_result = execute_query(auth_query, (section_id, user_id))
        if not auth_result:
            return jsonify({'success': False, 'message': 'Unauthorized access to this section'})

    # Get roster and today's status
    roster_query = """
        SELECT 
            st.student_id,
            st.school_id as s_schoolid,
            CONCAT(st.first_name, ' ', st.last_name) as full_name,
            st.year_level,
            st.email,
            a.status as today_status,
            a.attendance_time
        FROM enrollments e
        JOIN students st ON e.student_id = st.student_id
        LEFT JOIN attendance_records a ON st.student_id = a.student_id 
            AND a.section_id = %s 
            AND DATE(a.attendance_date) = CURDATE()
        WHERE e.section_id = %s AND e.status = 'Enrolled' AND st.status = 'Active'
        ORDER BY st.last_name, st.first_name
    """
    students = execute_query(roster_query, (section_id, section_id))

    # Format time
    if students:
        for student in students:
            if student.get('attendance_time'):
                student['attendance_time'] = str(student['attendance_time'])

    return jsonify({
        'success': True,
        'students': students or [],
        'section_id': section_id
    })


@app.route('/api/attendance/quick-mark', methods=['POST'])
@login_required
def quick_mark_attendance():
    """Quickly mark attendance"""
    data = request.get_json()

    required_fields = ['s_schoolid', 'status']
    for field in required_fields:
        if field not in data:
            return jsonify({'success': False, 'message': f'Missing required field: {field}'})

    # Get section_id (prefer section_id; otherwise lookup by course/section)
    section_id = data.get('section_id')

    if not section_id:
        course_code = data.get('course')
        section_code = data.get('section')

        if not course_code or not section_code:
            return jsonify({'success': False, 'message': 'Missing section information'})

        section_query = """
            SELECT s.section_id 
            FROM sections s
            JOIN courses c ON s.course_id = c.course_id
            WHERE c.course_code = %s AND s.section_code = %s
        """
        section_result = execute_query(section_query, (course_code, section_code))

        if not section_result:
            return jsonify({'success': False, 'message': 'Section not found'})

        section_id = section_result[0]['section_id']

    # Authorization
    user_id = session.get('user_id')
    role = session.get('role')

    if role != 'admin':
        auth_query = "SELECT section_id FROM sections WHERE section_id = %s AND teacher_id = %s"
        auth_result = execute_query(auth_query, (section_id, user_id))
        if not auth_result:
            return jsonify({'success': False, 'message': 'Unauthorized'})

    # Get student
    student_query = "SELECT student_id FROM students WHERE school_id = %s"
    student = execute_query(student_query, (data['s_schoolid'],))

    if not student:
        return jsonify({'success': False, 'message': 'Student not found'})

    student_id = student[0]['student_id']
    status = data['status']
    now = datetime.now()

    # Check if a record already exists for today
    check_query = """
        SELECT attendance_id 
        FROM attendance_records 
        WHERE section_id = %s AND student_id = %s AND DATE(attendance_date) = CURDATE()
    """
    existing = execute_query(check_query, (section_id, student_id))

    if existing:
        # Update record
        update_query = """
            UPDATE attendance_records 
            SET status = %s, attendance_time = %s, recorded_by = %s
            WHERE attendance_id = %s
        """
        result = execute_query(update_query,
                               (status, now.time(), user_id, existing[0]['attendance_id']),
                               fetch=False)
        message = 'Attendance updated'
    else:
        # Insert new record
        insert_query = """
            INSERT INTO attendance_records 
            (section_id, student_id, attendance_date, attendance_time, status, recorded_by)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        result = execute_query(insert_query,
                               (section_id, student_id, now.date(), now.time(), status, user_id),
                               fetch=False)
        message = 'Attendance recorded'

    if result is not None:
        return jsonify({'success': True, 'message': message, 'status': status})
    else:
        return jsonify({'success': False, 'message': 'Operation failed'})


@app.route('/api/attendance/recent', methods=['GET'])
@login_required
def get_recent_attendance():
    """Get recent attendance records"""
    limit = request.args.get('limit', 15, type=int)
    user_id = session.get('user_id')
    role = session.get('role')

    if role == 'teacher':
        # Teacher sees only their sections
        query = """
            SELECT 
                a.attendance_id,
                a.attendance_date as Date,
                a.attendance_time as Time,
                st.school_id as s_schoolid,
                CONCAT(st.first_name, ' ', st.last_name) as s_Name,
                c.course_code as Course,
                c.course_name as Subject,
                a.status as STATUS,
                a.remarks as Remarks
            FROM attendance_records a
            JOIN students st ON a.student_id = st.student_id
            JOIN sections s ON a.section_id = s.section_id
            JOIN courses c ON s.course_id = c.course_id
            WHERE s.teacher_id = %s
            ORDER BY a.attendance_date DESC, a.attendance_time DESC
            LIMIT %s
        """
        records = execute_query(query, (user_id, limit))
    else:
        # Admin sees all records
        query = """
            SELECT 
                a.attendance_id,
                a.attendance_date as Date,
                a.attendance_time as Time,
                st.school_id as s_schoolid,
                CONCAT(st.first_name, ' ', st.last_name) as s_Name,
                c.course_code as Course,
                c.course_name as Subject,
                a.status as STATUS,
                a.remarks as Remarks
            FROM attendance_records a
            JOIN students st ON a.student_id = st.student_id
            JOIN sections s ON a.section_id = s.section_id
            JOIN courses c ON s.course_id = c.course_id
            ORDER BY a.attendance_date DESC, a.attendance_time DESC
            LIMIT %s
        """
        records = execute_query(query, (limit,))

    # Convert date/time to string
    if records:
        for record in records:
            if isinstance(record['Date'], date):
                record['Date'] = record['Date'].strftime('%Y-%m-%d')
            if record['Time']:
                record['Time'] = str(record['Time'])

    return jsonify({
        'success': True,
        'records': records or []
    })


@app.route('/api/courses', methods=['GET'])
@login_required
def get_courses():
    """Get courses list"""
    user_id = session.get('user_id')
    role = session.get('role')

    if role == 'admin':
        query = """
            SELECT DISTINCT c.course_code as Subject, c.course_name as Course
            FROM courses c
            WHERE c.status = 'Active'
            ORDER BY c.course_code
        """
        courses = execute_query(query)
    else:
        query = """
            SELECT DISTINCT c.course_code as Subject, c.course_name as Course
            FROM courses c
            JOIN sections s ON c.course_id = s.course_id
            WHERE s.teacher_id = %s AND c.status = 'Active'
            ORDER BY c.course_code
        """
        courses = execute_query(query, (user_id,))

    return jsonify({
        'success': True,
        'courses': courses or []
    })


@app.route('/api/students', methods=['GET'])
@login_required
def get_students():
    """Get student list"""
    section_id = request.args.get('section_id')

    if section_id:
        # Students of a specific section
        query = """
            SELECT 
                st.student_id,
                st.school_id,
                st.first_name,
                st.last_name,
                st.email,
                st.year_level,
                st.major
            FROM students st
            JOIN enrollments e ON st.student_id = e.student_id
            WHERE e.section_id = %s AND e.status = 'Enrolled' AND st.status = 'Active'
            ORDER BY st.last_name, st.first_name
        """
        students = execute_query(query, (section_id,))
    else:
        # All students
        query = """
            SELECT 
                student_id,
                school_id,
                first_name,
                last_name,
                email,
                year_level,
                major
            FROM students
            WHERE status = 'Active'
            ORDER BY last_name, first_name
        """
        students = execute_query(query)

    return jsonify({
        'success': True,
        'students': students or []
    })

# ==================== Students Management API ====================

@app.route('/api/students/my-students', methods=['GET'])
@login_required
def get_my_students():
    """Get all students taught by the current teacher - fixed version"""
    user_id = session.get('user_id')
    role = session.get('role')
    section_id = request.args.get('section_id')

    if role == 'admin':
        # Admin sees all students
        if section_id:
            where_clause = "WHERE e.section_id = %s"
            params = [section_id]
        else:
            where_clause = ""
            params = []

        # Admin version: attendance rate across all courses (no teacher filter)
        query = f"""
            SELECT DISTINCT
                st.student_id,
                st.school_id,
                st.first_name,
                st.last_name,
                st.email,
                st.year_level,
                st.major,
                st.gender,
                COALESCE(
                    (SELECT ROUND(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2)
                     FROM attendance_records a
                     WHERE a.student_id = st.student_id), 0
                ) as attendance_rate
            FROM students st
            JOIN enrollments e ON st.student_id = e.student_id
            JOIN sections s ON e.section_id = s.section_id
            {where_clause}
            AND e.status = 'Enrolled' AND st.status = 'Active'
            ORDER BY st.last_name, st.first_name
        """
    else:
        # Teacher sees only their students
        if section_id:
            where_clause = "WHERE s.teacher_id = %s AND e.section_id = %s"
            params = [user_id, section_id]
        else:
            where_clause = "WHERE s.teacher_id = %s"
            params = [user_id]

        # Teacher version: attendance rate only in their own sections
        query = f"""
            SELECT DISTINCT
                st.student_id,
                st.school_id,
                st.first_name,
                st.last_name,
                st.email,
                st.year_level,
                st.major,
                st.gender,
                COALESCE(
                    (SELECT ROUND(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2)
                     FROM attendance_records a
                     JOIN sections sec ON a.section_id = sec.section_id
                     WHERE a.student_id = st.student_id 
                     AND sec.teacher_id = %s), 0
                ) as attendance_rate
            FROM students st
            JOIN enrollments e ON st.student_id = e.student_id
            JOIN sections s ON e.section_id = s.section_id
            {where_clause}
            AND e.status = 'Enrolled' AND st.status = 'Active'
            ORDER BY st.last_name, st.first_name
        """
        # Important: add teacher_id param for subquery
        params.append(user_id)

    students = execute_query(query, tuple(params) if params else None)

    return jsonify({
        'success': True,
        'students': students or []
    })


@app.route('/api/students/detail/<school_id>', methods=['GET'])
@login_required
def get_student_detail(school_id):
    """Get student detail"""
    query = """
        SELECT 
            student_id,
            school_id,
            first_name,
            last_name,
            email,
            phone,
            year_level,
            major,
            gender,
            date_of_birth
        FROM students
        WHERE school_id = %s AND status = 'Active'
    """
    student = execute_query(query, (school_id,))

    if not student:
        return jsonify({'success': False, 'message': 'Student not found'})

    return jsonify({
        'success': True,
        'student': student[0]
    })


@app.route('/api/students/<school_id>/enrollments', methods=['GET'])
@login_required
def get_student_enrollments(school_id):
    """Get student enrollments"""
    query = """
        SELECT 
            c.course_code,
            c.course_name,
            s.section_code,
            s.semester,
            s.year
        FROM students st
        JOIN enrollments e ON st.student_id = e.student_id
        JOIN sections s ON e.section_id = s.section_id
        JOIN courses c ON s.course_id = c.course_id
        WHERE st.school_id = %s AND e.status = 'Enrolled'
        ORDER BY c.course_code
    """
    enrollments = execute_query(query, (school_id,))

    return jsonify({
        'success': True,
        'enrollments': enrollments or []
    })


@app.route('/api/students/<school_id>/attendance-stats', methods=['GET'])
@login_required
def get_student_attendance_stats(school_id):
    """Get student attendance statistics"""
    query = """
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) as present,
            SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) as absent,
            SUM(CASE WHEN a.status = 'Late' THEN 1 ELSE 0 END) as late,
            SUM(CASE WHEN a.status = 'Excused' THEN 1 ELSE 0 END) as excused,
            ROUND(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as attendance_rate
        FROM students st
        JOIN attendance_records a ON st.student_id = a.student_id
        WHERE st.school_id = %s
    """
    stats = execute_query(query, (school_id,))

    if stats and stats[0]['total'] > 0:
        return jsonify({
            'success': True,
            'stats': stats[0]
        })
    else:
        return jsonify({
            'success': True,
            'stats': {
                'total': 0,
                'present': 0,
                'absent': 0,
                'late': 0,
                'excused': 0,
                'attendance_rate': 0
            }
        })


@app.route('/api/students/<school_id>/attendance-history', methods=['GET'])
@login_required
def get_student_attendance_history(school_id):
    """Get student attendance history"""
    limit = request.args.get('limit', 20, type=int)

    query = """
        SELECT 
            a.attendance_date,
            c.course_code,
            c.course_name,
            s.section_code,
            a.status
        FROM students st
        JOIN attendance_records a ON st.student_id = a.student_id
        JOIN sections s ON a.section_id = s.section_id
        JOIN courses c ON s.course_id = c.course_id
        WHERE st.school_id = %s
        ORDER BY a.attendance_date DESC
        LIMIT %s
    """
    records = execute_query(query, (school_id, limit))

    # Format date
    if records:
        for record in records:
            if isinstance(record['attendance_date'], date):
                record['attendance_date'] = record['attendance_date'].strftime('%Y-%m-%d')

    return jsonify({
        'success': True,
        'records': records or []
    })


# ==================== Reports API ====================

@app.route('/api/reports/section/<int:section_id>', methods=['GET'])
@login_required
def get_section_report(section_id):
    """Generate section attendance report"""
    user_id = session.get('user_id')
    role = session.get('role')

    # Authorization
    if role != 'admin':
        auth_query = "SELECT section_id FROM sections WHERE section_id = %s AND teacher_id = %s"
        auth_result = execute_query(auth_query, (section_id, user_id))
        if not auth_result:
            return jsonify({'success': False, 'message': 'Unauthorized'})

    # Student attendance stats for section
    students_query = """
        SELECT 
            st.school_id,
            CONCAT(st.first_name, ' ', st.last_name) as full_name,
            COUNT(a.attendance_id) as total_classes,
            SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) as present_count,
            SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) as absent_count,
            SUM(CASE WHEN a.status = 'Late' THEN 1 ELSE 0 END) as late_count,
            ROUND(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) * 100.0 / 
                  NULLIF(COUNT(a.attendance_id), 0), 2) as attendance_rate
        FROM students st
        JOIN enrollments e ON st.student_id = e.student_id
        LEFT JOIN attendance_records a ON st.student_id = a.student_id AND a.section_id = %s
        WHERE e.section_id = %s AND e.status = 'Enrolled' AND st.status = 'Active'
        GROUP BY st.student_id, st.school_id, st.first_name, st.last_name
        ORDER BY attendance_rate DESC, st.last_name
    """
    students = execute_query(students_query, (section_id, section_id))

    # Summary stats
    total_students = len(students) if students else 0
    overall_rate = sum(s['attendance_rate'] or 0 for s in students) / total_students if total_students > 0 else 0
    at_risk_count = sum(1 for s in students if (s['attendance_rate'] or 0) < 75)

    # Classes held
    classes_query = """
        SELECT COUNT(DISTINCT attendance_date) as classes_held
        FROM attendance_records
        WHERE section_id = %s
    """
    classes_result = execute_query(classes_query, (section_id,))
    classes_held = classes_result[0]['classes_held'] if classes_result else 0

    # Trend data
    trend_query = """
        SELECT 
            DATE(attendance_date) as date,
            ROUND(SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as rate
        FROM attendance_records
        WHERE section_id = %s
        GROUP BY DATE(attendance_date)
        ORDER BY date DESC
        LIMIT 14
    """
    trend = execute_query(trend_query, (section_id,))

    # Format dates
    if trend:
        for t in trend:
            if isinstance(t['date'], date):
                t['date'] = t['date'].strftime('%Y-%m-%d')
        trend.reverse()  # ascending by time

    return jsonify({
        'success': True,
        'summary': {
            'overall_rate': overall_rate,
            'total_students': total_students,
            'classes_held': classes_held,
            'at_risk_count': at_risk_count
        },
        'students': students or [],
        'trend': trend or []
    })


@app.route('/api/reports/rankings/<int:section_id>', methods=['GET'])
@login_required
def get_rankings_report(section_id):
    """Generate rankings report"""
    user_id = session.get('user_id')
    role = session.get('role')

    # Authorization
    if role != 'admin':
        auth_query = "SELECT section_id FROM sections WHERE section_id = %s AND teacher_id = %s"
        auth_result = execute_query(auth_query, (section_id, user_id))
        if not auth_result:
            return jsonify({'success': False, 'message': 'Unauthorized'})

    query = """
        SELECT 
            st.school_id,
            CONCAT(st.first_name, ' ', st.last_name) as full_name,
            COUNT(a.attendance_id) as total_classes,
            ROUND(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) * 100.0 / 
                  NULLIF(COUNT(a.attendance_id), 0), 2) as attendance_rate
        FROM students st
        JOIN enrollments e ON st.student_id = e.student_id
        LEFT JOIN attendance_records a ON st.student_id = a.student_id AND a.section_id = %s
        WHERE e.section_id = %s AND e.status = 'Enrolled' AND st.status = 'Active'
        GROUP BY st.student_id, st.school_id, st.first_name, st.last_name
        HAVING COUNT(a.attendance_id) > 0
        ORDER BY attendance_rate DESC, st.last_name
    """
    rankings = execute_query(query, (section_id, section_id))

    return jsonify({
        'success': True,
        'rankings': rankings or []
    })


@app.route('/api/reports/warnings/<int:section_id>', methods=['GET'])
@login_required
def get_warnings_report(section_id):
    """Generate low-attendance warnings report"""
    user_id = session.get('user_id')
    role = session.get('role')

    # Authorization
    if role != 'admin':
        auth_query = "SELECT section_id FROM sections WHERE section_id = %s AND teacher_id = %s"
        auth_result = execute_query(auth_query, (section_id, user_id))
        if not auth_result:
            return jsonify({'success': False, 'message': 'Unauthorized'})

    query = """
        SELECT 
            st.school_id,
            CONCAT(st.first_name, ' ', st.last_name) as full_name,
            c.course_code,
            s.section_code,
            COUNT(a.attendance_id) as total_classes,
            SUM(CASE WHEN a.status != 'Present' THEN 1 ELSE 0 END) as classes_missed,
            ROUND(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) * 100.0 / 
                  NULLIF(COUNT(a.attendance_id), 0), 2) as attendance_rate
        FROM students st
        JOIN enrollments e ON st.student_id = e.student_id
        JOIN sections s ON e.section_id = s.section_id
        JOIN courses c ON s.course_id = c.course_id
        LEFT JOIN attendance_records a ON st.student_id = a.student_id AND a.section_id = %s
        WHERE e.section_id = %s AND e.status = 'Enrolled' AND st.status = 'Active'
        GROUP BY st.student_id, st.school_id, st.first_name, st.last_name, c.course_code, s.section_code
        HAVING attendance_rate < 75 AND COUNT(a.attendance_id) > 0
        ORDER BY attendance_rate ASC
    """
    warnings = execute_query(query, (section_id, section_id))

    return jsonify({
        'success': True,
        'warnings': warnings or []
    })


@app.route('/api/reports/summary', methods=['GET'])
@login_required
def get_summary_report():
    """Generate summary report"""
    user_id = session.get('user_id')
    role = session.get('role')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    report_type = request.args.get('type', 'monthly')

    if not start_date or not end_date:
        return jsonify({'success': False, 'message': 'Missing date range'})

    # Role filter
    if role == 'admin':
        where_clause = ""
        params = [start_date, end_date]
    else:
        where_clause = "AND s.teacher_id = %s"
        params = [start_date, end_date, user_id]

    # Course stats
    courses_query = f"""
        SELECT 
            c.course_name,
            COUNT(DISTINCT a.student_id) as total_students,
            COUNT(a.attendance_id) as total_records,
            ROUND(SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as attendance_rate
        FROM attendance_records a
        JOIN sections s ON a.section_id = s.section_id
        JOIN courses c ON s.course_id = c.course_id
        WHERE a.attendance_date BETWEEN %s AND %s
        {where_clause}
        GROUP BY c.course_id, c.course_name
        ORDER BY c.course_name
    """
    courses = execute_query(courses_query, tuple(params))

    # Totals
    total_classes = sum(c['total_records'] for c in courses) if courses else 0
    total_students = max((c['total_students'] for c in courses), default=0)
    average_rate = sum(c['attendance_rate'] for c in courses) / len(courses) if courses else 0

    return jsonify({
        'success': True,
        'summary': {
            'average_rate': average_rate,
            'total_classes': total_classes,
            'total_students': total_students
        },
        'courses': courses or []
    })



# ==================== Error Handlers ====================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'message': 'Page not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'message': 'Internal server error'}), 500



# ==================== App Bootstrap ====================

if __name__ == '__main__':
    print("=" * 50)
    print("Student Attendance System starting...")
    print("=" * 50)
    print(f"Visit: http://127.0.0.1:5000")
    print("Please make sure the MySQL database is running")
    print("=" * 50)
    print("Teacher Accounts:")
    print("  hemn / pass123 (CPS3740)")
    print("  baha / pass123 (CPS3320)")
    print("  omar / pass123 (CPS3440)")
    print("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=5000)
