// js/pie-chart-widget.js
// Pie Chart Widget - Compact task breakdown visualization

// Global variables
let pieChartWidgetChart = null;
let pieChartWidgetEnabled = false;

// --- 1. INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    
    // Load saved settings
    loadPieChartSettings();
    
    // Setup event listeners
    setupPieChartEventListeners();
    
    // Make widget draggable
    makePieChartDraggable(document.getElementById('pie-chart-widget'));
    
    // Setup real-time updates
    setupRealTimeUpdates();
    
});

// --- 2. SETTINGS MANAGEMENT ---
function loadPieChartSettings() {
    try {
        const savedEnabled = localStorage.getItem('pieChartWidgetEnabled');
        if (savedEnabled !== null) {
            pieChartWidgetEnabled = savedEnabled === 'true';
            
            // Update UI
            const toggle = document.getElementById('pie-chart-widget-toggle');
            const widget = document.getElementById('pie-chart-widget');
            
            if (toggle) toggle.checked = pieChartWidgetEnabled;
            if (widget) {
                widget.classList.toggle('hidden', !pieChartWidgetEnabled);
                if (pieChartWidgetEnabled) {
                    loadPieChartData();
                }
            }
        }
    } catch (error) {
        console.error('Error loading pie chart settings:', error);
    }
}

function savePieChartSettings() {
    try {
        localStorage.setItem('pieChartWidgetEnabled', pieChartWidgetEnabled.toString());
    } catch (error) {
        console.error('Error saving pie chart settings:', error);
    }
}

// --- 3. EVENT LISTENERS ---
function setupPieChartEventListeners() {
    // Widget toggle
    const widgetToggle = document.getElementById('pie-chart-widget-toggle');
    const widget = document.getElementById('pie-chart-widget');
    
    if (widgetToggle && widget) {
        widgetToggle.addEventListener('change', () => {
            pieChartWidgetEnabled = widgetToggle.checked;
            widget.classList.toggle('hidden', !pieChartWidgetEnabled);
            
            if (pieChartWidgetEnabled) {
                loadPieChartData();
            } else {
                destroyPieChart();
            }
            
            savePieChartSettings();
        });
    }
    
}

// --- 4. DATA LOADING & PROCESSING ---
async function loadPieChartData() {
    try {
        
        const { hasData, tasks } = await getTodayTaskBreakdown();
        
        if (!hasData || tasks.length === 0) {
            showNoDataMessage();
            return;
        }
        
        hideNoDataMessage();
        renderPieChart(tasks);
        
    } catch (error) {
        console.error('Error loading pie chart data:', error);
        showNoDataMessage();
    }
}

// Reuse the existing getTodayTaskBreakdown function from progress.html
async function getTodayTaskBreakdown() {
    try {
        const today = getFormattedDate();
        let studyData = {};
        
        // Try Firebase first if available
        if (window.firebaseDataManager && firebaseDataManager.user) {
            try {
                studyData = await firebaseDataManager.loadStudyData();
            } catch (error) {
                console.warn('Failed to load study data from Firebase for pie chart, falling back to localStorage:', error);
                const existingData = localStorage.getItem('studyTime');
                studyData = existingData ? JSON.parse(existingData) : {};
            }
        } else {
            const existingData = localStorage.getItem('studyTime');
            studyData = existingData ? JSON.parse(existingData) : {};
        }

        const dayData = studyData[today];
        if (!dayData) {
            return { hasData: false, tasks: [] };
        }

        // Handle different data formats
        let sessions = [];

        if (typeof dayData === 'object' && dayData.sessions) {
            // New format with sessions
            sessions = dayData.sessions;
        } else if (typeof dayData === 'number' && dayData > 0) {
            // Old format - just total hours, no task info
            sessions = [{
                hours: dayData,
                task: null
            }];
        } else {
            return { hasData: false, tasks: [] };
        }

        if (sessions.length === 0) {
            return { hasData: false, tasks: [] };
        }

        // Process sessions to group by task
        const taskMap = new Map();

        sessions.forEach(session => {
            const taskName = session.task ? session.task.taskName : 'No Specific Task';
            const taskColor = session.task ? session.task.taskColor : 'gradient';

            if (taskMap.has(taskName)) {
                taskMap.get(taskName).hours += session.hours;
            } else {
                taskMap.set(taskName, {
                    name: taskName,
                    hours: session.hours,
                    color: taskColor
                });
            }
        });

        const tasks = Array.from(taskMap.values())
            .filter(task => task.hours > 0)
            .sort((a, b) => b.hours - a.hours);
        
        return { hasData: tasks.length > 0, tasks };
    } catch (error) {
        console.error('Error getting today task breakdown:', error);
        return { hasData: false, tasks: [] };
    }
}

function getFormattedDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// --- 5. CHART RENDERING ---
function renderPieChart(tasks) {
    try {
        const canvas = document.getElementById('pie-chart-canvas');
        if (!canvas) {
            console.error('Pie chart canvas not found');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart
        if (pieChartWidgetChart) {
            pieChartWidgetChart.destroy();
        }
        
        const labels = tasks.map(task => task.name);
        const data = tasks.map(task => task.hours);
        
        
        // Create gradient for "No Specific Task" category
        const createGradient = (ctx, color) => {
            if (color === 'gradient') {
                // Create a larger gradient to ensure it covers the entire pie slice
                const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                gradient.addColorStop(0, '#ff6b6b');
                gradient.addColorStop(0.25, '#4ecdc4');
                gradient.addColorStop(0.5, '#45b7d1');
                gradient.addColorStop(0.75, '#96ceb4');
                gradient.addColorStop(1, '#feca57');
                return gradient;
            }
            return color;
        };
        
        const colors = tasks.map(task => {
            const color = createGradient(ctx, task.color);
            return color;
        });
        
        pieChartWidgetChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors,
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    borderWidth: 1.5,
                    hoverBorderWidth: 3,
                    hoverBorderColor: 'rgba(255, 255, 255, 0.6)',
                    hoverBackgroundColor: colors.map(color => {
                        // Slightly brighten colors on hover
                        if (typeof color === 'string') {
                            return color;
                        }
                        return color; // Keep gradients as-is
                    })
                }]
            },
             options: {
                 responsive: true,
                 maintainAspectRatio: false,
                 plugins: {
                    legend: {
                        display: false // Hide legend for compact widget
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(10, 15, 25, 0.98)',
                        titleFont: {
                            family: "'Segoe UI', -apple-system, sans-serif",
                            size: 12,
                            weight: '600'
                        },
                        bodyFont: {
                            family: "'Segoe UI', -apple-system, sans-serif",
                            size: 11,
                            weight: '500'
                        },
                        padding: 12,
                        cornerRadius: 8,
                        borderColor: 'rgba(255, 255, 255, 0.15)',
                        borderWidth: 1.5,
                        displayColors: true,
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                        callbacks: {
                            label: function(context) {
                                const hours = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((hours / total) * 100).toFixed(1);
                                const labelText = context.label === 'No Specific Task' 
                                    ? '🎨 No Specific Task' 
                                    : context.label;
                                return `${labelText}: ${hours.toFixed(1)}h (${percentage}%)`;
                            }
                        }
                    }
                },
                animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: 1000,
                    easing: 'easeOutCubic',
                    delay: (context) => {
                        return context.dataIndex * 100; // Staggered animation
                    }
                },
                hover: {
                    animationDuration: 200,
                    onHover: (event, elements) => {
                        event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
                    }
                },
                elements: {
                    arc: {
                        borderWidth: 1.5,
                        borderColor: 'rgba(255, 255, 255, 0.15)'
                    }
                }
            }
        });
        
        
    } catch (error) {
        console.error('Error rendering pie chart:', error);
        showNoDataMessage();
    }
}

// --- 6. UI HELPERS ---
function showNoDataMessage() {
    const canvas = document.getElementById('pie-chart-canvas');
    const noData = document.getElementById('pie-chart-no-data');
    
    if (canvas) canvas.style.display = 'none';
    if (noData) noData.classList.remove('hidden');
}

function hideNoDataMessage() {
    const canvas = document.getElementById('pie-chart-canvas');
    const noData = document.getElementById('pie-chart-no-data');
    
    if (canvas) canvas.style.display = 'block';
    if (noData) noData.classList.add('hidden');
}

function destroyPieChart() {
    if (pieChartWidgetChart) {
        pieChartWidgetChart.destroy();
        pieChartWidgetChart = null;
    }
}

// --- 7. DRAGGABLE FUNCTIONALITY ---
function makePieChartDraggable(element) {
    if (!element) return;
    
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    // Load saved position
    loadPieChartWidgetPosition(element);
    
    element.onmousedown = (e) => {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        
        document.onmouseup = () => {
            document.onmouseup = null;
            document.onmousemove = null;
            // Save position when dragging ends
            savePieChartWidgetPosition(element);
        };
        
        document.onmousemove = (e) => {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        };
    };
}

function savePieChartWidgetPosition(element) {
    try {
        const position = {
            top: element.style.top,
            left: element.style.left
        };
        localStorage.setItem('pieChartWidgetPosition', JSON.stringify(position));
    } catch (error) {
        console.error('Error saving pie chart widget position:', error);
    }
}

function loadPieChartWidgetPosition(element) {
    try {
        const savedPosition = localStorage.getItem('pieChartWidgetPosition');
        if (savedPosition) {
            const position = JSON.parse(savedPosition);
            if (position.top) element.style.top = position.top;
            if (position.left) element.style.left = position.left;
        }
    } catch (error) {
        console.error('Error loading pie chart widget position:', error);
    }
}

// --- 8. REAL-TIME UPDATES ---
function setupRealTimeUpdates() {
    // Listen for storage changes (when study time is logged)
    window.addEventListener('storage', (e) => {
        if (e.key === 'studyTime' && pieChartWidgetEnabled) {
            setTimeout(() => loadPieChartData(), 50); // Reduced delay for faster updates
        }
    });
    
    // Listen for custom events from timer completion
    document.addEventListener('studyTimeLogged', (e) => {
        if (pieChartWidgetEnabled) {
            // Immediate update for custom events
            loadPieChartData();
        }
    });
    
    // Listen for Firebase data updates
    if (window.firebaseDataManager) {
        // Override the original saveStudyData method to trigger updates
        const originalSaveStudyData = window.firebaseDataManager.saveStudyData;
        if (originalSaveStudyData) {
            window.firebaseDataManager.saveStudyData = async function(...args) {
                const result = await originalSaveStudyData.apply(this, args);
                if (pieChartWidgetEnabled) {
                    // Immediate update for Firebase saves
                    loadPieChartData();
                }
                return result;
            };
        }
    }
}

// --- 9. PUBLIC API ---
// Function to refresh the pie chart data (can be called externally)
function refreshPieChartWidget() {
    if (pieChartWidgetEnabled) {
        loadPieChartData();
    }
}

// Export for external use
window.pieChartWidget = {
    refresh: refreshPieChartWidget,
    isEnabled: () => pieChartWidgetEnabled
};
