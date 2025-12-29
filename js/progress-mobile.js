/**
 * Progress Page - Mobile View Generator
 * Creates vertical day-by-day cards for mobile devices
 */

(function() {
    'use strict';
    
    // Check if device is mobile/tablet
    function isMobile() {
        return window.innerWidth <= 768;
    }
    
    /**
     * Generate mobile week view with vertical day cards
     */
    async function generateMobileWeekView() {
        if (!isMobile()) return;
        
        // Check if mobile view already exists
        let mobileView = document.getElementById('mobile-week-view');
        if (!mobileView) {
            // Create mobile view container
            mobileView = document.createElement('div');
            mobileView.id = 'mobile-week-view';
            
            // Insert after stats container
            const contentArea = document.querySelector('.content-area');
            if (contentArea) {
                contentArea.appendChild(mobileView);
            }
        }
        
        // Clear existing content
        mobileView.innerHTML = '';
        
        // Get study data
        let studyData = {};
        try {
            if (window.firebaseDataManager && firebaseDataManager.user) {
                studyData = await firebaseDataManager.loadUserData('studyData', {});
            } else {
                const saved = localStorage.getItem('studyData');
                if (saved) {
                    studyData = JSON.parse(saved);
                }
            }
        } catch (error) {
            console.error('Error loading study data:', error);
        }
        
        // Get current week (Monday to Sunday)
        const days = [];
        const today = new Date();
        
        // Get Monday of current week
        const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay; // If Sunday, go back 6 days
        
        const monday = new Date(today);
        monday.setDate(today.getDate() + mondayOffset);
        
        // Generate Monday through Sunday
        for (let i = 0; i < 7; i++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            days.push(date);
        }
        
        // Generate day cards
        days.forEach((date, index) => {
            const dateStr = formatDate(date);
            const hours = studyData[dateStr] || 0;
            const isToday = dateStr === formatDate(new Date());
            
            const card = createDayCard(date, hours, isToday, index);
            mobileView.appendChild(card);
        });
        
    }
    
    /**
     * Create a day card element
     */
    function createDayCard(date, hours, isToday, index) {
        const card = document.createElement('div');
        card.className = 'mobile-day-card';
        if (isToday) {
            card.classList.add('today');
        }
        
        // Day name and date
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        const dayName = dayNames[date.getDay()];
        const dateStr = `${monthNames[date.getMonth()]} ${date.getDate()}`;
        
        // Calculate progress (goal: 5.7 hours)
        const goal = 5.7;
        const percentage = Math.min((hours / goal) * 100, 100);
        
        // Determine progress level
        let progressClass = 'low';
        let statusText = 'Below target';
        
        if (percentage >= 100) {
            progressClass = 'high';
            statusText = 'Goal achieved! 🎉';
        } else if (percentage >= 70) {
            progressClass = 'medium';
            statusText = 'Good progress';
        } else if (percentage >= 40) {
            progressClass = 'medium';
            statusText = 'Keep going';
        }
        
        if (hours === 0) {
            statusText = 'No study time';
        }
        
        // Build card HTML
        card.innerHTML = `
            <div class="day-header">
                <div class="day-name ${isToday ? 'today' : ''}">
                    ${isToday ? '📍 ' : ''}${dayName}
                    <span class="day-date">${dateStr}</span>
                </div>
                <div class="day-hours">${hours.toFixed(1)}h</div>
            </div>
            <div class="day-progress-bar">
                <div class="day-progress-fill ${progressClass}" style="width: ${percentage}%"></div>
            </div>
            <div class="day-details">
                <span class="day-percentage">${percentage.toFixed(0)}% of goal</span>
                <span class="day-status">${statusText}</span>
            </div>
        `;
        
        // Add tap feedback
        card.addEventListener('touchstart', function() {
            this.style.transform = 'scale(0.98)';
        });
        
        card.addEventListener('touchend', function() {
            this.style.transform = 'scale(1)';
        });
        
        return card;
    }
    
    /**
     * Format date as YYYY-MM-DD
     */
    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    /**
     * Initialize mobile view
     */
    function initMobileView() {
        if (!isMobile()) return;
        
        // Generate mobile view
        generateMobileWeekView();
        
        // Refresh on window resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (isMobile()) {
                    generateMobileWeekView();
                }
            }, 300);
        });
        
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobileView);
    } else {
        initMobileView();
    }
    
    // Expose function globally for updates
    window.refreshMobileWeekView = generateMobileWeekView;
    
})();
