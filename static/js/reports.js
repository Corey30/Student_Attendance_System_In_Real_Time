// ==================== Reports & Statistics Page JavaScript ====================

let trendChart = null;
let comparisonChart = null;
let currentReportData = null;

// ==================== Initialization ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('Reports & Statistics page loading...');

    // Load sections
    loadSections();

    // Set default dates
    setDefaultDates();

    // Bind events
    bindEvents();
});

// ==================== Bind Events ====================
function bindEvents() {
    // Report type change
    document.getElementById('reportType').addEventListener('change', function() {
        handleReportTypeChange(this.value);
    });

    // Generate report button
    document.getElementById('generateReportBtn').addEventListener('click', generateReport);

    // Export buttons
    document.getElementById('exportSectionBtn')?.addEventListener('click', () => exportReport('section'));
    document.getElementById('exportRankingsBtn')?.addEventListener('click', () => exportReport('rankings'));
    document.getElementById('exportWarningsBtn')?.addEventListener('click', () => exportReport('warnings'));
}

// ==================== Report Type Change ====================
function handleReportTypeChange(type) {
    const sectionGroup = document.getElementById('sectionSelectGroup');

    // Hide all report sections
    document.getElementById('sectionReportSection').style.display = 'none';
    document.getElementById('rankingsReportSection').style.display = 'none';
    document.getElementById('warningsReportSection').style.display = 'none';

    // All report types require section selection
    sectionGroup.style.display = 'block';
}

// ==================== Load Sections ====================
async function loadSections() {
    try {
        const response = await fetch('/api/teacher/courses');
        const data = await response.json();

        if (data.success) {
            const select = document.getElementById('reportSection');
            select.innerHTML = '<option value="">-- Select Section --</option>';

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

// ==================== Set Default Dates ====================
function setDefaultDates() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    document.getElementById('startDate').valueAsDate = firstDay;
    document.getElementById('endDate').valueAsDate = today;
}

// ==================== Generate Report ====================
async function generateReport() {
    const reportType = document.getElementById('reportType').value;
    const sectionId = document.getElementById('reportSection').value;

    if (!sectionId) {
        showNotification('Please select a section', 'error');
        return;
    }

    switch(reportType) {
        case 'section':
            await generateSectionReport(sectionId);
            break;
        case 'ranking':
            await generateRankingsReport(sectionId);
            break;
        case 'warnings':
            await generateWarningsReport(sectionId);
            break;
    }
}

// ==================== Generate Section Report ====================
async function generateSectionReport(sectionId) {
    try {
        const response = await fetch(`/api/reports/section/${sectionId}`);
        const data = await response.json();

        if (data.success) {
            currentReportData = data;
            displaySectionReport(data);
            document.getElementById('sectionReportSection').style.display = 'block';
            showNotification('Report generated successfully', 'success');
        } else {
            showNotification(data.message || 'Failed to generate report', 'error');
        }
    } catch (error) {
        console.error('Error generating report:', error);
        showNotification('Failed to generate report', 'error');
    }
}

// ==================== Display Section Report ====================
function displaySectionReport(data) {
    // Update stat cards - fix: add parseFloat and null checks
    const overallRate = document.getElementById('overallRate');
    const totalStudents = document.getElementById('totalStudents');
    const classesHeld = document.getElementById('classesHeld');
    const atRiskCount = document.getElementById('atRiskCount');

    if (overallRate) overallRate.textContent = parseFloat(data.summary.overall_rate || 0).toFixed(1) + '%';
    if (totalStudents) totalStudents.textContent = data.summary.total_students || 0;
    if (classesHeld) classesHeld.textContent = data.summary.classes_held || 0;
    if (atRiskCount) atRiskCount.textContent = data.summary.at_risk_count || 0;

    // Update trend chart
    updateTrendChart(data.trend);

    // Update details table
    displaySectionTable(data.students);
}

// ==================== Update Trend Chart ====================
function updateTrendChart(trendData) {
    const canvas = document.getElementById('trendChart');

    // Null check
    if (!canvas) {
        console.error('Element #trendChart not found');
        return;
    }

    const ctx = canvas.getContext('2d');

    if (trendChart) {
        trendChart.destroy();
    }

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: trendData.map(d => d.date),
            datasets: [{
                label: 'Attendance Rate (%)',
                data: trendData.map(d => parseFloat(d.rate) || 0),  // fix: parseFloat
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true
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

// ==================== Display Section Table ====================
function displaySectionTable(students) {
    const tbody = document.getElementById('sectionReportBody');

    // Null check
    if (!tbody) {
        console.error('Element #sectionReportBody not found');
        showNotification('Page element missing. Please refresh the page.', 'error');
        return;
    }

    if (!students || students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">No data available</td></tr>';
        return;
    }

    tbody.innerHTML = students.map(student => {
        const rate = parseFloat(student.attendance_rate) || 0;  // fix: parseFloat
        const statusClass = rate >= 90 ? 'status-present' : rate >= 75 ? 'status-late' : 'status-absent';
        const statusText = rate >= 90 ? 'Excellent' : rate >= 75 ? 'Good' : 'At Risk';

        return `
            <tr>
                <td>${student.school_id}</td>
                <td>${student.full_name}</td>
                <td>${student.total_classes}</td>
                <td>${student.present_count}</td>
                <td>${student.absent_count}</td>
                <td>${student.late_count}</td>
                <td><strong>${rate.toFixed(1)}%</strong></td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            </tr>
        `;
    }).join('');
}

// ==================== Generate Rankings Report ====================
async function generateRankingsReport(sectionId) {
    try {
        const response = await fetch(`/api/reports/rankings/${sectionId}`);
        const data = await response.json();

        if (data.success) {
            currentReportData = data;
            displayRankingsReport(data);
            document.getElementById('rankingsReportSection').style.display = 'block';
            showNotification('Rankings generated successfully', 'success');
        } else {
            showNotification(data.message || 'Failed to generate rankings', 'error');
        }
    } catch (error) {
        console.error('Error generating rankings:', error);
        showNotification('Failed to generate rankings', 'error');
    }
}

// ==================== Display Rankings Report ====================
function displayRankingsReport(data) {
    // Show top 10 students
    const topContainer = document.getElementById('topStudents');
    const tableBody = document.getElementById('rankingsBody');

    // Null check
    if (!topContainer || !tableBody) {
        console.error('Element #topStudents or #rankingsBody not found');
        showNotification('Page element missing. Please refresh the page.', 'error');
        return;
    }

    if (!data.rankings || data.rankings.length === 0) {
        topContainer.innerHTML = '<p class="loading">No rankings data available</p>';
        tableBody.innerHTML = '<tr><td colspan="5" class="loading">No rankings data available</td></tr>';
        return;
    }

    // Display top 10 (card style)
    const top10 = data.rankings.slice(0, 10);
    topContainer.innerHTML = top10.map((student, index) => {
        const rate = parseFloat(student.attendance_rate) || 0;
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';

        return `
            <div class="ranking-item">
                <div class="rank-badge">${medal} #${index + 1}</div>
                <div class="student-name">
                    ${student.full_name} (${student.school_id})
                    <br>
                    <small>${student.total_classes} classes attended</small>
                </div>
                <div class="rate-badge">${rate.toFixed(1)}%</div>
            </div>
        `;
    }).join('');

    // Display full ranking table
    tableBody.innerHTML = data.rankings.map((student, index) => {
        const rate = parseFloat(student.attendance_rate) || 0;
        const statusClass = rate >= 90 ? 'status-present' : rate >= 75 ? 'status-late' : 'status-absent';

        return `
            <tr>
                <td><strong>#${index + 1}</strong></td>
                <td>${student.school_id}</td>
                <td>${student.full_name}</td>
                <td>${student.total_classes}</td>
                <td><span class="status-badge ${statusClass}">${rate.toFixed(1)}%</span></td>
            </tr>
        `;
    }).join('');
}

// ==================== Generate Warnings Report ====================
async function generateWarningsReport(sectionId) {
    try {
        const response = await fetch(`/api/reports/warnings/${sectionId}`);
        const data = await response.json();

        if (data.success) {
            currentReportData = data;
            displayWarningsReport(data);
            document.getElementById('warningsReportSection').style.display = 'block';
            showNotification('Warnings report generated', 'success');
        } else {
            showNotification(data.message || 'Failed to generate warnings', 'error');
        }
    } catch (error) {
        console.error('Error generating warnings report:', error);
        showNotification('Failed to generate warnings', 'error');
    }
}

// ==================== Display Warnings Report ====================
function displayWarningsReport(data) {
    const tbody = document.getElementById('warningsBody');

    // Null check
    if (!tbody) {
        console.error('Element #warningsBody not found');
        showNotification('Page element missing. Please refresh the page.', 'error');
        return;
    }

    if (!data.warnings || data.warnings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">No students at risk</td></tr>';
        return;
    }

    tbody.innerHTML = data.warnings.map(student => {
        const rate = parseFloat(student.attendance_rate) || 0;  // fix: parseFloat
        const riskLevel = rate < 50 ? 'Critical' : rate < 65 ? 'High' : 'Medium';
        const riskClass = rate < 50 ? 'status-absent' : rate < 65 ? 'status-late' : 'status-warning';

        return `
            <tr>
                <td>${student.school_id}</td>
                <td>${student.full_name}</td>
                <td>${student.course_code}</td>
                <td>${student.section_code}</td>
                <td><strong>${rate.toFixed(1)}%</strong></td>
                <td>${student.classes_missed}</td>
                <td><span class="status-badge ${riskClass}">${riskLevel}</span></td>
            </tr>
        `;
    }).join('');

    // Display warning info
    const warningInfo = document.querySelector('.warning-info');
    if (warningInfo) {
        warningInfo.innerHTML = `
            <strong>⚠️ ${data.warnings.length} student(s) need attention</strong>
            <p>These students have attendance rates below 75% and may be at risk of academic difficulties.</p>
        `;
    }
}

// ==================== Generate Summary Report ====================
async function generateSummaryReport(reportType) {
    try {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        console.log('Report type:', reportType);
        console.log('Start date:', startDate);
        console.log('End date:', endDate);

        if (!startDate || !endDate) {
            showNotification('Please select date range', 'error');
            return;
        }

        // Build API URL
        const apiUrl = `/api/reports/summary?type=${reportType}&start=${startDate}&end=${endDate}`;
        console.log('API URL:', apiUrl);

        const response = await fetch(apiUrl);
        const data = await response.json();

        console.log('Server response:', data);

        if (data.success) {
            currentReportData = data;
            displaySummaryReport(data);
            document.getElementById('summaryReportSection').style.display = 'block';
            showNotification('Summary report generated', 'success');
        } else {
            showNotification(data.message || 'Failed to generate summary', 'error');
        }
    } catch (error) {
        console.error('Error generating summary report:', error);
        showNotification('Failed to generate summary: ' + error.message, 'error');
    }
}

// ==================== Display Summary Report ====================
function displaySummaryReport(data) {
    // Show stat cards - fix: add parseFloat and null checks
    const statsContainer = document.getElementById('summaryStats');

    // Null check
    if (!statsContainer) {
        console.error('Element #summaryStats not found');
        showNotification('Page element missing. Please refresh the page.', 'error');
        return;
    }

    statsContainer.innerHTML = `
        <div class="stat-card">
            <div class="stat-icon" style="background: #4CAF50;">📊</div>
            <div class="stat-info">
                <h3>Average Rate</h3>
                <div class="stat-value">${parseFloat(data.summary.average_rate || 0).toFixed(1)}%</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon" style="background: #2196F3;">📅</div>
            <div class="stat-info">
                <h3>Total Classes</h3>
                <div class="stat-value">${data.summary.total_classes || 0}</div>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon" style="background: #667eea;">👥</div>
            <div class="stat-info">
                <h3>Total Students</h3>
                <div class="stat-value">${data.summary.total_students || 0}</div>
            </div>
        </div>
    `;

    // Update comparison chart
    updateComparisonChart(data.courses);
}

// ==================== Update Comparison Chart ====================
function updateComparisonChart(courses) {
    const canvas = document.getElementById('comparisonChart');

    // Null check
    if (!canvas) {
        console.error('Element #comparisonChart not found');
        return;
    }

    const ctx = canvas.getContext('2d');

    if (comparisonChart) {
        comparisonChart.destroy();
    }

    const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#00BCD4', '#FFEB3B'];

    comparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: courses.map(c => c.course_name),
            datasets: [{
                label: 'Attendance Rate (%)',
                data: courses.map(c => parseFloat(c.attendance_rate) || 0),  // fix: parseFloat
                backgroundColor: colors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
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

// ==================== Export Report ====================
function exportReport(reportType) {
    if (!currentReportData) {
        showNotification('No data to export', 'error');
        return;
    }

    let csvContent = '';
    let filename = '';

    switch(reportType) {
        case 'section':
            csvContent = generateSectionCSV(currentReportData);
            filename = 'section_report';
            break;
        case 'rankings':
            csvContent = generateRankingsCSV(currentReportData);
            filename = 'rankings_report';
            break;
        case 'warnings':
            csvContent = generateWarningsCSV(currentReportData);
            filename = 'warnings_report';
            break;
    }

    downloadCSV(csvContent, filename);
}

// ==================== CSV Generators ====================
function generateSectionCSV(data) {
    let csv = 'Student ID,Name,Total Classes,Present,Absent,Late,Attendance Rate\n';
    data.students.forEach(s => {
        const rate = parseFloat(s.attendance_rate) || 0;  // fix: parseFloat
        csv += `${s.school_id},${s.full_name},${s.total_classes},${s.present_count},${s.absent_count},${s.late_count},${rate.toFixed(1)}%\n`;
    });
    return csv;
}

function generateRankingsCSV(data) {
    let csv = 'Rank,Student ID,Name,Total Classes,Attendance Rate\n';
    data.rankings.forEach((s, i) => {
        const rate = parseFloat(s.attendance_rate) || 0;  // fix: parseFloat
        csv += `${i+1},${s.school_id},${s.full_name},${s.total_classes},${rate.toFixed(1)}%\n`;
    });
    return csv;
}

function generateWarningsCSV(data) {
    let csv = 'Student ID,Name,Course,Section,Attendance Rate,Classes Missed,Risk Level\n';
    data.warnings.forEach(s => {
        const rate = parseFloat(s.attendance_rate) || 0;  // fix: parseFloat
        const risk = rate < 50 ? 'Critical' : rate < 65 ? 'High' : 'Medium';
        csv += `${s.school_id},${s.full_name},${s.course_code},${s.section_code},${rate.toFixed(1)}%,${s.classes_missed},${risk}\n`;
    });
    return csv;
}

function generateSummaryCSV(data) {
    let csv = 'Course,Attendance Rate\n';
    data.courses.forEach(c => {
        const rate = parseFloat(c.attendance_rate) || 0;  // fix: parseFloat
        csv += `${c.course_name},${rate.toFixed(1)}%\n`;
    });
    return csv;
}

// ==================== Download CSV ====================
function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('Export successful!', 'success');
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

// Add page-specific styles
const style = document.createElement('style');
style.textContent = `
    .warning-info {
        background: #fff3e0;
        border-left: 4px solid #FF9800;
        padding: 15px;
        margin-bottom: 20px;
        border-radius: 4px;
    }

    .ranking-item {
        display: flex;
        align-items: center;
        padding: 12px;
        background: #f8f9fa;
        border-radius: 6px;
        margin-bottom: 8px;
        gap: 15px;
    }

    .rank-badge {
        font-size: 20px;
        font-weight: bold;
        min-width: 40px;
    }

    .student-name {
        flex: 1;
        font-weight: 500;
    }

    .rate-badge {
        background: #667eea;
        color: white;
        padding: 4px 12px;
        border-radius: 15px;
        font-weight: bold;
        font-size: 14px;
    }

    .status-warning {
        background: #FF9800;
        color: white;
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
