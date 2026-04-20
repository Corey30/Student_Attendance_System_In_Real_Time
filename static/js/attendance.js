// ==================== Attendance Records Page JavaScript ====================

let currentSectionId = null;
let currentRoster = [];

// ==================== Initialization ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('Loading attendance records page...');

    // Load teacher courses
    loadTeacherCourses();

    // Load recent attendance records
    loadRecentRecords();

    // Bind events
    bindEvents();
});

// ==================== Bind Events ====================
function bindEvents() {
    // Course selection change
    document.getElementById('courseSelect').addEventListener('change', function() {
        const selectedValue = this.value;
        document.getElementById('loadRosterBtn').disabled = !selectedValue;

        if (selectedValue) {
            try {
                const sectionInfo = JSON.parse(selectedValue);
                currentSectionId = sectionInfo.section_id;
                displayCourseInfo(sectionInfo);
            } catch (e) {
                console.error('Failed to parse course info:', e);
            }
        } else {
            currentSectionId = null;
            document.getElementById('courseInfo').style.display = 'none';
            document.getElementById('rosterSection').style.display = 'none';
        }
    });

    // Load roster button
    document.getElementById('loadRosterBtn').addEventListener('click', loadClassRoster);

    // Mark all present button
    document.getElementById('markAllPresentBtn').addEventListener('click', markAllPresent);

    // Clear all button
    document.getElementById('clearAllBtn').addEventListener('click', clearAll);
}

// ==================== Load Teacher Courses ====================
async function loadTeacherCourses() {
    try {
        const response = await fetch('/api/teacher/courses');
        const data = await response.json();

        if (data.success) {
            const select = document.getElementById('courseSelect');
            select.innerHTML = '<option value="">-- Please Select a Course --</option>';

            data.courses.forEach(course => {
                const sectionData = {
                    section_id: course.section_id,
                    course_code: course.Course,
                    course_name: course.Subject,
                    section_code: course.Section,
                    semester: course.Year
                };

                const option = document.createElement('option');
                option.value = JSON.stringify(sectionData);
                option.textContent = `${course.Subject} - Section ${course.Section}`;
                if (course.Time) {
                    option.textContent += ` (${course.Time})`;
                }
                option.textContent += ` [${course.student_count} students]`;
                select.appendChild(option);
            });
        } else {
            showNotification('Failed to load courses', 'error');
        }
    } catch (error) {
        console.error('Error loading courses:', error);
        showNotification('Failed to load courses', 'error');
    }
}

// ==================== Display Course Info ====================
function displayCourseInfo(info) {
    document.getElementById('infoYear').textContent = info.semester;
    document.getElementById('infoCourse').textContent = info.course_code;
    document.getElementById('infoSection').textContent = info.section_code;
    document.getElementById('infoSubject').textContent = info.course_name;
    document.getElementById('courseInfo').style.display = 'flex';
}

// ==================== Load Class Roster ====================
async function loadClassRoster() {
    if (!currentSectionId) {
        showNotification('Please select a course first', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/attendance/class-roster?section_id=${currentSectionId}`);
        const data = await response.json();

        if (data.success) {
            currentRoster = data.students;
            displayRoster(data.students);
            document.getElementById('rosterSection').style.display = 'block';
            showNotification(`Loaded ${data.students.length} students`, 'success');
        } else {
            showNotification(data.message || 'Failed to load roster', 'error');
        }
    } catch (error) {
        console.error('Error loading roster:', error);
        showNotification('Failed to load roster', 'error');
    }
}

// ==================== Display Roster ====================
function displayRoster(students) {
    const tbody = document.getElementById('rosterTableBody');

    if (!students || students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading">No students found in this class</td></tr>';
        return;
    }

    tbody.innerHTML = students.map((student, index) => {
        const statusClass = getStatusClass(student.today_status);
        const statusText = student.today_status ? getStatusText(student.today_status) : 'Not Marked';

        return `
            <tr>
                <td>${index + 1}</td>
                <td>${student.s_schoolid}</td>
                <td>${student.full_name}</}</td>
                <td class="quick-mark-buttons">
                    <button class="btn-quick-mark btn-present" 
                            onclick="quickMark('${student.s_schoolid}', 'Present')"
                            title="Mark Present">
                        ✓
                    </button>
                    <button class="btn-quick-mark btn-late" 
                            onclick="quickMark('${student.s_schoolid}', 'Late')"
                            title="Mark Late">
                        ⏰
                    </button>
                    <button class="btn-quick-mark btn-absent" 
                            onclick="quickMark('${student.s_schoolid}', 'Absent')"
                            title="Mark Absent">
                        ✗
                    </button>
                </td>
                <td>
                    <span class="status-badge ${statusClass}" id="status-${student.s_schoolid}">
                        ${statusText}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

// ==================== Quick Mark Attendance ====================
async function quickMark(studentId, status) {
    if (!currentSectionId) {
        showNotification('Please select a course first', 'error');
        return;
    }

    const requestData = {
        s_schoolid: studentId,
        status: status,
        section_id: currentSectionId
    };

    try {
        const response = await fetch('/api/attendance/quick-mark', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });

        const data = await response.json();

        if (data.success) {
            // Update status badge on UI
            const statusBadge = document.getElementById(`status-${studentId}`);
            if (statusBadge) {
                statusBadge.className = 'status-badge ' + getStatusClass(status);
                statusBadge.textContent = getStatusText(status);
            }

            // Refresh recent records
            loadRecentRecords();

            // Short success toast
            const notification = document.createElement('div');
            notification.className = 'mini-notification';
            notification.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                background: ${status === 'Present' ? '#4CAF50' : status === 'Late' ? '#FF9800' : '#f44336'};
                color: white;
                padding: 10px 20px;
                border-radius: 5px;
                z-index: 2000;
                animation: fadeInOut 1.5s;
            `;
            notification.textContent = `✓ ${getStatusText(status)}`;
            document.body.appendChild(notification);
            setTimeout(() => document.body.removeChild(notification), 1500);
        } else {
            showNotification(data.message || 'Failed to mark attendance', 'error');
        }
    } catch (error) {
        console.error('Error marking attendance:', error);
        showNotification('Failed to mark attendance', 'error');
    }
}

// ==================== Mark All Present ====================
async function markAllPresent() {
    if (!currentRoster || currentRoster.length === 0) {
        showNotification('No students to mark', 'error');
        return;
    }

    if (!confirm(`Are you sure you want to mark all ${currentRoster.length} students as Present?`)) {
        return;
    }

    let successCount = 0;

    for (const student of currentRoster) {
        const requestData = {
            s_schoolid: student.s_schoolid,
            status: 'Present',
            section_id: currentSectionId
        };

        try {
            const response = await fetch('/api/attendance/quick-mark', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(requestData)
            });

            const data = await response.json();
            if (data.success) {
                successCount++;

                // Update UI
                const statusBadge = document.getElementById(`status-${student.s_schoolid}`);
                if (statusBadge) {
                    statusBadge.className = 'status-badge status-present';
                    statusBadge.textContent = getStatusText('Present');
                }
            }
        } catch (error) {
            console.error(`Failed to mark student ${student.s_schoolid}:`, error);
        }
    }

    showNotification(`Successfully marked ${successCount}/${currentRoster.length} students as Present`, 'success');
    loadRecentRecords();
}

// ==================== Clear All ====================
function clearAll() {
    if (!confirm('Are you sure you want to reload the roster? This will refresh the page.')) {
        return;
    }

    loadClassRoster();
}

// ==================== Load Recent Attendance Records ====================
async function loadRecentRecords() {
    try {
        const response = await fetch('/api/attendance/recent?limit=15');
        const data = await response.json();

        if (data.success) {
            displayRecentRecords(data.records);
        }
    } catch (error) {
        console.error('Error loading attendance records:', error);
    }
}

// ==================== Display Attendance Records ====================
function displayRecentRecords(records) {
    const tbody = document.getElementById('recentRecordsBody');

    if (!records || records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">No records yet</td></tr>';
        return;
    }

    tbody.innerHTML = records.map(record => {
        const statusClass = getStatusClass(record.STATUS);
        return `
            <tr>
                <td>${record.Date}</td>
                <td>${record.Time || '--'}</td>
                <td>${record.s_schoolid}</td>
                <td>${record.s_Name}</td>
                <td>${record.Course}</td>
                <td>${record.Subject}</td>
                <td><span class="status-badge ${statusClass}">${getStatusText(record.STATUS)}</span></td>
                <td>${record.Remarks || '--'}</td>
            </tr>
        `;
    }).join('');
}

// ==================== Get Status Class ====================
function getStatusClass(status) {
    const statusMap = {
        'Present': 'status-present',
        'Absent': 'status-absent',
        'Late': 'status-late',
        'Excused': 'status-excused'
    };
    return statusMap[status] || '';
}

// ==================== Get Status Text ====================
function getStatusText(status) {
    const textMap = {
        'Present': '✓ Present',
        'Absent': '✗ Absent',
        'Late': '⏰ Late',
        'Excused': '📝 Excused'
    };
    return textMap[status] || status;
}

// ==================== Notification ====================
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
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    @keyframes fadeInOut {
        0% { opacity: 0; transform: translateY(-10px); }
        20% { opacity: 1; transform: translateY(0); }
        80% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-10px); }
    }
`;
document.head.appendChild(style);
