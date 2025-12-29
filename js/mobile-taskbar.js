/**
 * Mobile Taskbar Enhancements
 * Adds smooth scrolling and visual feedback for mobile taskbar
 */

(function() {
    'use strict';
    
    // Check if device is mobile/tablet
    function isMobileOrTablet() {
        return window.innerWidth <= 1024 || 
               /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
    
    // Initialize mobile taskbar features
    function initMobileTaskbar() {
        if (!isMobileOrTablet()) return;
        
        const taskbar = document.querySelector('.control-box-taskbar');
        if (!taskbar) return;
        
        // Get all buttons
        const buttons = taskbar.querySelectorAll('.btn-icon, .btn-progress');
        const buttonCount = buttons.length;
        
        // Calculate buttons per page (4-5 buttons visible)
        const taskbarWidth = taskbar.offsetWidth;
        const buttonWidth = 54; // Button width + gap
        const buttonsPerPage = Math.floor(taskbarWidth / buttonWidth);
        
        
        // Add momentum scrolling
        let isScrolling = false;
        let startX = 0;
        let scrollLeft = 0;
        
        taskbar.addEventListener('touchstart', (e) => {
            isScrolling = true;
            startX = e.touches[0].pageX - taskbar.offsetLeft;
            scrollLeft = taskbar.scrollLeft;
        }, { passive: true });
        
        taskbar.addEventListener('touchmove', (e) => {
            if (!isScrolling) return;
            const x = e.touches[0].pageX - taskbar.offsetLeft;
            const walk = (x - startX) * 1.5; // Scroll speed multiplier
            taskbar.scrollLeft = scrollLeft - walk;
        }, { passive: true });
        
        taskbar.addEventListener('touchend', () => {
            isScrolling = false;
        }, { passive: true });
        
        // Update gradient indicators based on scroll position
        updateScrollIndicators();
        taskbar.addEventListener('scroll', updateScrollIndicators, { passive: true });
        
        function updateScrollIndicators() {
            const scrollLeft = taskbar.scrollLeft;
            const scrollWidth = taskbar.scrollWidth;
            const clientWidth = taskbar.clientWidth;
            const maxScroll = scrollWidth - clientWidth;
            
            // Show/hide left gradient
            if (scrollLeft > 10) {
                taskbar.classList.add('has-scroll-left');
            } else {
                taskbar.classList.remove('has-scroll-left');
            }
            
            // Show/hide right gradient
            if (scrollLeft < maxScroll - 10) {
                taskbar.classList.add('has-scroll-right');
            } else {
                taskbar.classList.remove('has-scroll-right');
            }
        }
        
        // Add visual feedback for button taps
        buttons.forEach(button => {
            button.addEventListener('touchstart', function() {
                this.style.transform = 'scale(0.92)';
                this.style.transition = 'transform 0.1s ease';
            }, { passive: true });
            
            button.addEventListener('touchend', function() {
                this.style.transform = 'scale(1)';
            }, { passive: true });
            
            button.addEventListener('touchcancel', function() {
                this.style.transform = 'scale(1)';
            }, { passive: true });
        });
        
        // Add haptic feedback if available
        if ('vibrate' in navigator) {
            buttons.forEach(button => {
                button.addEventListener('click', () => {
                    navigator.vibrate(10); // Subtle 10ms vibration
                });
            });
        }
        
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobileTaskbar);
    } else {
        initMobileTaskbar();
    }
    
    // Re-initialize on window resize (orientation change)
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (isMobileOrTablet()) {
                initMobileTaskbar();
            }
        }, 300);
    });
    
})();
