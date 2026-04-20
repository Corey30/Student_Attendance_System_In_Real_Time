// ==================== Student Management Page JavaScript ====================

let allStudents = [];
let filteredStudents = [];
let currentSectionId = null;
let currentYearFilter = '';

// ==================== Initialization ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('Student Management page loading...');

    // Load teacher sections
    loadSections();

    // Load all students
    loadStudents();

    // Bind events
    bindEvents();
});

// ==================== Bind Events ====================
function bindEvents() {
    // Search box
    document.getElementById('searchInput').addEventListener('input', function(e) {
        filterStudents(e.target.value);
    });

    // Apply filter button
    document.getElementById('applyFilterBtn').addEventListener('click', function() {
        currentSectionId = document.getElementById('filterSection').value;
        currentYearFilter = document.getElementById('filterYear').value;
        loadStudents();
    });

    // Year level filter change
    document.getElementById('filterYear').addEventListener('change', function() {
        currentYearFilter = this.value;
        displayStudents(allStudents);
    });

    // Export button
    document.getElementById('exportBtn').addEventListener('click', exportToExcel);

    // Modal close
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('studentDetailModal');
        if (event.target === modal) {
            closeModal();
        }
    });
}

// ==================== Load Sections ====================
async function loadSections() {
    try {
        const response = await fetch('/api/teacher/courses');
        const data = await response.json();

        if (data.success) {
            const select = document.getElementById('filterSection');
            select.innerHTML = '<option value="">-- All My Students --</option>';

            data.courses.forEach(course => {
                const option = document.createElement('option');
                option.value = course.section_id;
                option.textContent = `${course.Subject} - Section ${course.Section}`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading sections:', error);
    }
}

// ==================== Load Students ====================
async function loadStudents() {
    try {
        let url = '/api/students/my-students';
        if (currentSectionId) {
            url += `?section_id=${currentSectionId}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
            allStudents = data.students;
            displayStudents(allStudents);
        } else {
            showNotification('Failed to load students', 'error');
        }
    } catch (error) {
        console.error('Error loading students:', error);
        showNotification('Failed to load students', 'error');
    }
}

// ==================== Display Students ====================
function displayStudents(students) {
    const tbody = document.getElementById('studentsTableBody');

    // Apply year filter
    let displayList = students;
    if (currentYearFilter) {
        displayList = students.filter(s => s.year_level === currentYearFilter);
    }

    document.getElementById('studentCount').textContent = displayList.length;

    if (!displayList || displayList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">No students found</td></tr>';
        return;
    }

    tbody.innerHTML = displayList.map(student => {
        const rate = parseFloat(student.attendance_rate) || 0;  // fix: parseFloat
        const rateClass = rate >= 90 ? 'status-present' : rate >= 75 ? 'status-late' : 'status-absent';

        return `
            <tr>
                <td>${student.school_id}</td>
                <td>${student.first_name} ${student.last_name}</td>
                <td>${student.year_level}</td>
                <td>${student.major || 'N/A'}</td>
                <td>${student.email || 'N/A'}</td>
                <td>
                    <span class="status-badge ${rateClass}">
                        ${rate.toFixed(1)}%
                    </span>
                </td>
                <td>
                    <button class="btn-view" onclick="viewStudentDetails('${student.school_id}')">
                        👁️ View Details
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ==================== Search Filter ====================
function filterStudents(searchText) {
    if (!searchText.trim()) {
        displayStudents(allStudents);
        return;
    }

    const searchLower = searchText.toLowerCase();
    const filtered = allStudents.filter(student => {
        return student.school_id.toLowerCase().includes(searchLower) ||
               `${student.first_name} ${student.last_name}`.toLowerCase().includes(searchLower) ||
               (student.email && student.email.toLowerCase().includes(searchLower));
    });

    displayStudents(filtered);
}

// ==================== View Student Details ====================
async function viewStudentDetails(schoolId) {
    try {
        // Open modal
        document.getElementById('studentDetailModal').style.display = 'block';

        // Load basic info
        const studentResponse = await fetch(`/api/students/detail/${schoolId}`);
        const studentData = await studentResponse.json();

        if (studentData.success) {
            const student = studentData.student;
            document.getElementById('detailSchoolId').textContent = student.school_id;
            document.getElementById('detailFullName').textContent = `${student.first_name} ${student.last_name}`;
            document.getElementById('detailYearLevel').textContent = student.year_level;
            document.getElementById('detailMajor').textContent = student.major || 'N/A';
            document.getElementById('detailEmail').textContent = student.email || 'N/A';
            document.getElementById('detailGender').textContent = student.gender || 'N/A';
        }

        // Load enrollments
        const enrollmentResponse = await fetch(`/api/students/${schoolId}/enrollments`);
        const enrollmentData = await enrollmentResponse.json();

        if (enrollmentData.success) {
            displayEnrollments(enrollmentData.enrollments);
        }

        // Load attendance stats
        const statsResponse = await fetch(`/api/students/${schoolId}/attendance-stats`);
        const statsData = await statsResponse.json();

        if (statsData.success) {
            displayAttendanceStats(statsData.stats);
        }

        // Load attendance history
        const historyResponse = await fetch(`/api/students/${schoolId}/attendance-history?limit=20`);
        const historyData = await historyResponse.json();

        if (historyData.success) {
            displayAttendanceHistory(historyData.records);
        }

    } catch (error) {
        console.error('Error loading student details:', error);
        showNotification('Failed to load student details', 'error');
    }
}

// ==================== Display Enrollments ====================
function displayEnrollments(enrollments) {
    const container = document.getElementById('enrolledCourses');

    if (!enrollments || enrollments.length === 0) {
        container.innerHTML = '<p style="color: #999;">No enrollments found</p>';
        return;
    }

    container.innerHTML = enrollments.map(e => `
        <div class="enrollment-item">
            <strong>${e.course_code}</strong> - ${e.course_name}
            <br>
            <small>Section ${e.section_code} | ${e.semester}</small>
        </div>
    `).join('');
}

// ==================== Display Attendance Stats ====================
function displayAttendanceStats(stats) {
    document.getElementById('totalClasses').textContent = stats.total || 0;
    document.getElementById('presentCount').textContent = stats.present || 0;
    document.getElementById('absentCount').textContent = stats.absent || 0;
    document.getElementById('lateCount').textContent = stats.late || 0;

    const rate = parseFloat(stats.attendance_rate) || 0;  // fix: parseFloat
    document.getElementById('attendanceRate').textContent = rate.toFixed(1) + '%';
}

// ==================== Display Attendance History ====================
function displayAttendanceHistory(records) {
    const tbody = document.getElementById('attendanceHistory');

    if (!records || records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading">No attendance records found</td></tr>';
        return;
    }

    tbody.innerHTML = records.map(record => {
        const statusClass = getStatusClass(record.status);
        return `
            <tr>
                <td>${record.attendance_date}</td>
                <td>${record.course_code}</td>
                <td>${record.section_code}</td>
                <td><span class="status-badge ${statusClass}">${record.status}</span></td>
            </tr>
        `;
    }).join('');
}

// ==================== Close Modal ====================
function closeModal() {
    document.getElementById('studentDetailModal').style.display = 'none';
}

// ==================== Export to Excel ====================
function exportToExcel() {
    try {
        // Prepare data to export
        let dataToExport = allStudents;
        if (currentYearFilter) {
            dataToExport = allStudents.filter(s => s.year_level === currentYearFilter);
        }

        // Build CSV
        let csvContent = 'Student ID,First Name,Last Name,Year Level,Major,Email,Attendance Rate\n';

        dataToExport.forEach(student => {
            const rate = parseFloat(student.attendance_rate) || 0;  // fix: parseFloat
            csvContent += `${student.school_id},${student.first_name},${student.last_name},${student.year_level},${student.major || 'N/A'},${student.email || 'N/A'},${rate.toFixed(1)}%\n`;
        });

        // Download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', `students_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification('Export successful!', 'success');
    } catch (error) {
        console.error('Export error:', error);
        showNotification('Export failed', 'error');
    }
}

// ==================== Helpers ====================
function getStatusClass(status) {
    const statusMap = {
        'Present': 'status-present',
        'Absent': 'status-absent',
        'Late': 'status-late',
        'Excused': 'status-excused'
    };
    return statusMap[status] || '';
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    notification.style.cssText = `
        position: fixed;
        top: 90px;
        right: 30px;
        padding: 15px 25px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 3000;
        animation: slideInRight 0.3s ease-out;
        font-size: 14px;
        font-weight: 500;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    .search-input {
        padding: 10px 15px;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        font-size: 14px;
        width: 300px;
        margin-right: 10px;
    }

    .search-input:focus {
        outline: none;
        border-color: #667eea;
    }

    .page-actions {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .student-count {
        font-size: 16px;
        font-weight: 600;
        color: #667eea;
    }

    .btn-view {
        padding: 6px 12px;
        background: #667eea;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        transition: all 0.2s;
    }

    .btn-view:hover {
        background: #5568d3;
        transform: translateY(-1px);
    }

    .student-info-card {
        background: white;
        padding: 20px;
        border-radius: 10px;
        margin-bottom: 20px;
        border: 1px solid #e0e0e0;
    }

    .student-info-card h3 {
        margin-bottom: 15px;
        color: #333;
        font-size: 16px;
    }

    .info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;
    }

    .info-item {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    .info-item .label {
        font-size: 12px;
        color: #999;
        font-weight: 600;
    }

    .info-item span:last-child {
        font-size: 14px;
        color: #333;
    }

    .stat-card-mini {
        background: #f8f9fa;
        padding: 15px;
        border-radius: 8px;
        text-align: center;
    }

    .stat-label {
        font-size: 12px;
        color: #666;
        margin-bottom: 8px;
    }

    .stat-value {
        font-size: 24px;
        font-weight: bold;
        color: #333;
    }

    .enrollment-item {
        padding: 12px;
        background: #f8f9fa;
        border-radius: 6px;
        margin-bottom: 10px;
        border-left: 3px solid #667eea;
    }

    .modal-body {
        max-height: 70vh;
        overflow-y: auto;
    }

    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);
