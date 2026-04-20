// ==================== Global Variables ====================
let weekTrendChart = null;
let courseStatsChart = null;
let refreshInterval = null;

// ==================== Initialization ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard loading...');

    // Load initial data
    loadDashboardData();
    loadRecentRecords();
    loadCourses();

    // Auto refresh (every 30s)
    refreshInterval = setInterval(() => {
        loadDashboardData();
        loadRecentRecords();
    }, 30000);

    // Bind events
    bindEvents();
});

// ==================== Bind Events ====================
function bindEvents() {
    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', function() {
        loadDashboardData();
        loadRecentRecords();
        showNotification('Data refreshed', 'success');
    });

    // Add attendance button
    document.getElementById('addAttendanceBtn').addEventListener('click', function() {
        openModal();
    });

    // Modal close buttons
    document.querySelector('.close').addEventListener('click', closeModal);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);

    // Click outside modal to close
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('addAttendanceModal');
        if (event.target === modal) {
            closeModal();
        }
    });

    // Form submit
    document.getElementById('addAttendanceForm').addEventListener('submit', handleAddAttendance);
}

// ==================== Load Dashboard Data ====================
async function loadDashboardData() {
    try {
        const response = await fetch('/api/dashboard/stats');
        const data = await response.json();

        if (data.success) {
            // Update stat cards
            updateStatCards(data.today_stats);

            // Update charts
            updateWeekTrendChart(data.week_trend);
            updateCourseStatsChart(data.course_stats);

            // Update last updated time
            updateLastUpdateTime();
        } else {
            console.error('Failed to load data:', data.message);
        }
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// ==================== Update Stat Cards ====================
function updateStatCards(stats) {
    document.getElementById('attendanceRate').textContent = stats.attendance_rate + '%';
    document.getElementById('presentCount').textContent = stats.present;
    document.getElementById('absentCount').textContent = stats.absent;
    document.getElementById('lateCount').textContent = stats.late;
}

// ==================== Update Weekly Trend Chart ====================
function updateWeekTrendChart(data) {
    const ctx = document.getElementById('weekTrendChart').getContext('2d');

    // Prepare data
    const labels = data.map(item => {
        const date = new Date(item.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const rates = data.map(item => item.rate || 0);
    const totals = data.map(item => item.total || 0);

    // Destroy old chart
    if (weekTrendChart) {
        weekTrendChart.destroy();
    }

    // Create new chart
    weekTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Attendance Rate (%)',
                data: rates,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const index = context.dataIndex;
                            return 'Total: ' + totals[index];
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
}

// ==================== Update Course Stats Chart ====================
function updateCourseStatsChart(data) {
    const ctx = document.getElementById('courseStatsChart').getContext('2d');

    // If no data
    if (!data || data.length === 0) {
        if (courseStatsChart) {
            courseStatsChart.destroy();
        }
        return;
    }

    // Only show first 8 courses
    const displayData = data.slice(0, 8);
    const labels = displayData.map(item => item.Subject.substring(0, 20) + (item.Subject.length > 20 ? '...' : ''));
    const rates = displayData.map(item => item.rate || 0);

    // Colors
    const colors = [
        '#4CAF50', '#2196F3', '#FF9800', '#9C27B0',
        '#00BCD4', '#FFEB3B', '#E91E63', '#607D8B'
    ];

    // Destroy old
    if (courseStatsChart) {
        courseStatsChart.destroy();
    }

    // Create new
    courseStatsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Attendance Rate (%)',
                data: rates,
                backgroundColor: colors,
                borderColor: colors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const index = context.dataIndex;
                            const item = displayData[index];
                            return `Present: ${item.present}/${item.total}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
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

// ==================== Display Recent Attendance Records ====================
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

// ==================== Load Courses ====================
async function loadCourses() {
    try {
        const response = await fetch('/api/courses');
        const data = await response.json();

        if (data.success) {
            const select = document.getElementById('subject');
            select.innerHTML = '<option value="">Please select a course</option>';

            data.courses.forEach(course => {
                const option = document.createElement('option');
                option.value = course.Subject;
                option.textContent = `${course.Subject} (${course.Course})`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading courses:', error);
    }
}

// ==================== Open Modal ====================
function openModal() {
    document.getElementById('addAttendanceModal').style.display = 'block';
}

// ==================== Close Modal ====================
function closeModal() {
    document.getElementById('addAttendanceModal').style.display = 'none';
    document.getElementById('addAttendanceForm').reset();
}

// ==================== Handle Add Attendance ====================
async function handleAddAttendance(e) {
    e.preventDefault();

    const formData = {
        s_schoolid: document.getElementById('studentId').value.trim(),
        subject: document.getElementById('subject').value,
        status: document.getElementById('status').value,
        remarks: document.getElementById('remarks').value.trim()
    };

    try {
        const response = await fetch('/api/attendance/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Attendance record added successfully!', 'success');
            closeModal();

            // Refresh data
            loadDashboardData();
            loadRecentRecords();
        } else {
            showNotification(data.message || 'Add failed', 'error');
        }
    } catch (error) {
        console.error('Error adding attendance:', error);
        showNotification('Add failed, please try again later', 'error');
    }
}

// ==================== Update Last Update Time ====================
function updateLastUpdateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('lastUpdate').textContent = timeString;
}

// ==================== Notification ====================
function showNotification(message, type = 'info') {
    // Create element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // Styles
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

    // Auto-remove after 3s
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// ==================== Cleanup on page unload ====================
window.addEventListener('beforeunload', function() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }
    if (weekTrendChart) {
        weekTrendChart.destroy();
    }
    if (courseStatsChart) {
        courseStatsChart.destroy();
    }
});
