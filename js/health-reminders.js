/**
 * Health Reminders Module
 * Provides subtle health notifications during timer sessions:
 * - 20-20-20 Rule: Every 20 minutes, look 20 feet away for 20 seconds
 * - Posture Check: Every 45 minutes
 * - Hydration Reminder: Every 60 minutes
 */

class HealthReminders {
    constructor() {
        // Timer intervals (in milliseconds)
        this.intervals = {
            eyeStrain: 20 * 60 * 1000,    // 20 minutes
            posture: 45 * 60 * 1000,      // 45 minutes
            hydration: 60 * 60 * 1000     // 60 minutes        
        };

        // Elapsed time trackers
        this.elapsed = {
            eyeStrain: 0,
            posture: 0,
            hydration: 0
        };

        // Timer references
        this.trackingInterval = null;
        this.countdownInterval = null;
        
        // State
        this.isActive = false;
        this.isPaused = false;
        this.lastTickTime = null;
        this.activeCountdown = null;
        
        // Settings
        this.settings = this.loadSettings();
        
        // Sound
        this.notificationSound = new Audio('sounds/health-notification.mp3');
        this.notificationSound.volume = 0.3;
        
        // Toast container
        this.toastContainer = null;
        this.activeToasts = new Map();
        
        // Initialize
        this.init();
    }

    init() {
        // Create toast container
        this.toastContainer = document.createElement('div');
        this.toastContainer.className = 'health-toast-container';
        document.body.appendChild(this.toastContainer);
        
        // Listen for timer state changes
        this.setupTimerListeners();
        
    }

    loadSettings() {
        return {
            eyeStrainEnabled: localStorage.getItem('healthReminder_eyeStrain') !== 'false',
            postureEnabled: localStorage.getItem('healthReminder_posture') !== 'false',
            hydrationEnabled: localStorage.getItem('healthReminder_hydration') !== 'false',
            soundEnabled: localStorage.getItem('healthReminder_sound') !== 'false'
        };
    }

    saveSettings() {
        localStorage.setItem('healthReminder_eyeStrain', this.settings.eyeStrainEnabled);
        localStorage.setItem('healthReminder_posture', this.settings.postureEnabled);
        localStorage.setItem('healthReminder_hydration', this.settings.hydrationEnabled);
        localStorage.setItem('healthReminder_sound', this.settings.soundEnabled);
    }

    setupTimerListeners() {
        // Listen for timer start/stop events through custom events
        document.addEventListener('timerStarted', () => this.start());
        document.addEventListener('timerPaused', () => this.pause());
        document.addEventListener('timerResumed', () => this.resume());
        document.addEventListener('timerReset', () => this.reset());
        document.addEventListener('timerCompleted', () => this.stop());
        
        // Also check timer state periodically as fallback
        this.checkTimerState();
    }

    checkTimerState() {
        // This is a fallback to detect timer state from localStorage
        setInterval(() => {
            const timerRunning = localStorage.getItem('timerIsRunning') === 'true';
            const timerPaused = localStorage.getItem('timerPaused') === 'true';
            
            if (timerRunning && !timerPaused && !this.isActive) {
                this.start();
            } else if ((timerPaused || !timerRunning) && this.isActive && !this.isPaused) {
                if (timerPaused) {
                    this.pause();
                } else {
                    this.stop();
                }
            }
        }, 1000);
    }

    start() {
        if (this.isActive) return;
        
        this.isActive = true;
        this.isPaused = false;
        this.lastTickTime = Date.now();
        
        // Start tracking elapsed time
        this.trackingInterval = setInterval(() => this.tick(), 1000);
    }

    pause() {
        if (!this.isActive || this.isPaused) return;
        
        this.isPaused = true;
        
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
            this.trackingInterval = null;
        }
        
        // Pause any active countdown
        if (this.activeCountdown) {
            this.pauseCountdown();
        }
    }

    resume() {
        if (!this.isActive || !this.isPaused) return;
        
        this.isPaused = false;
        this.lastTickTime = Date.now();
        
        // Resume tracking
        this.trackingInterval = setInterval(() => this.tick(), 1000);
        
        // Resume countdown if there was one
        if (this.activeCountdown) {
            this.resumeCountdown();
        }
    }

    stop() {
        this.isActive = false;
        this.isPaused = false;
        
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
            this.trackingInterval = null;
        }
        
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        
        this.activeCountdown = null;
    }

    reset() {
        this.stop();
        this.elapsed = {
            eyeStrain: 0,
            posture: 0,
            hydration: 0
        };
        
        // Clear all toasts
        this.activeToasts.forEach((toast, id) => {
            this.dismissToast(id);
        });
    }

    tick() {
        if (this.isPaused) return;
        
        const now = Date.now();
        const delta = now - this.lastTickTime;
        this.lastTickTime = now;
        
        // Update elapsed times
        Object.keys(this.elapsed).forEach(key => {
            this.elapsed[key] += delta;
        });
        
        // Check for reminders
        this.checkReminders();
    }

    checkReminders() {
        // Eye strain (20-20-20 rule)
        if (this.settings.eyeStrainEnabled && 
            this.elapsed.eyeStrain >= this.intervals.eyeStrain &&
            !this.activeCountdown) {
            this.elapsed.eyeStrain = 0;
            this.showEyeStrainReminder();
        }
        
        // Posture check
        if (this.settings.postureEnabled && 
            this.elapsed.posture >= this.intervals.posture) {
            this.elapsed.posture = 0;
            this.showPostureReminder();
        }
        
        // Hydration reminder
        if (this.settings.hydrationEnabled && 
            this.elapsed.hydration >= this.intervals.hydration) {
            this.elapsed.hydration = 0;
            this.showHydrationReminder();
        }
    }

    showEyeStrainReminder() {
        this.playSound();
        
        const toastId = 'eye-strain-' + Date.now();
        const toast = this.createToast({
            id: toastId,
            type: 'eye-strain',
            icon: '🤓',
            title: '20-20-20 Rule',
            message: 'Look 20 feet away for 20 seconds',
            hasCountdown: true,
            countdownSeconds: 20,
            persistent: true
        });
        
        this.showToast(toast);
        this.startCountdown(toastId, 20);
    }

    showPostureReminder() {
        this.playSound();
        
        const toastId = 'posture-' + Date.now();
        const toast = this.createToast({
            id: toastId,
            type: 'posture',
            icon: '🧘',
            title: 'Posture Check',
            message: 'Sit up straight and adjust your posture',
            autoDismiss: 8000
        });
        
        this.showToast(toast);
    }

    showHydrationReminder() {
        this.playSound();
        
        const toastId = 'hydration-' + Date.now();
        const toast = this.createToast({
            id: toastId,
            type: 'hydration',
            icon: '💧',
            title: 'Hydration Time',
            message: 'Take a moment to drink some water',
            autoDismiss: 8000
        });
        
        this.showToast(toast);
    }

    createToast({ id, type, icon, title, message, hasCountdown, countdownSeconds, persistent, autoDismiss }) {
        const toast = document.createElement('div');
        toast.className = `health-toast ${type}`;
        toast.setAttribute('data-toast-id', id);
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'polite');
        
        let html = `
            <div class="health-toast-header">
                <div class="health-toast-icon">${icon}</div>
                <div class="health-toast-content">
                    <div class="health-toast-title">${title}</div>
                    <div class="health-toast-message">${message}</div>
                </div>
                ${!persistent ? '<div class="health-toast-close" role="button" aria-label="Close">✕</div>' : ''}
            </div>
        `;
        
        if (hasCountdown) {
            html += `
                <div class="health-toast-countdown">
                    <div class="health-toast-timer">
                        <div class="health-toast-timer-number">${countdownSeconds}</div>
                        <div class="health-toast-timer-label">seconds</div>
                    </div>
                    <div class="health-toast-progress">
                        <div class="health-toast-progress-bar" style="width: 100%"></div>
                    </div>
                </div>
            `;
        }
        
        toast.innerHTML = html;
        
        // Add close handler
        if (!persistent) {
            const closeBtn = toast.querySelector('.health-toast-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.dismissToast(id));
            }
        }
        
        // Store auto-dismiss timer
        if (autoDismiss && !hasCountdown) {
            setTimeout(() => this.dismissToast(id), autoDismiss);
        }
        
        return toast;
    }

    showToast(toast) {
        const id = toast.getAttribute('data-toast-id');
        this.toastContainer.appendChild(toast);
        this.activeToasts.set(id, toast);
        
        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
    }

    dismissToast(id) {
        const toast = this.activeToasts.get(id);
        if (!toast) return;
        
        toast.classList.remove('show');
        toast.classList.add('hide');
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            this.activeToasts.delete(id);
        }, 400);
    }

    startCountdown(toastId, seconds) {
        this.activeCountdown = {
            toastId,
            remaining: seconds,
            total: seconds,
            paused: false
        };
        
        this.countdownInterval = setInterval(() => {
            if (this.activeCountdown.paused) return;
            
            this.activeCountdown.remaining--;
            this.updateCountdownUI();
            
            if (this.activeCountdown.remaining <= 0) {
                this.completeCountdown();
            }
        }, 1000);
    }

    pauseCountdown() {
        if (this.activeCountdown) {
            this.activeCountdown.paused = true;
        }
    }

    resumeCountdown() {
        if (this.activeCountdown) {
            this.activeCountdown.paused = false;
        }
    }

    updateCountdownUI() {
        if (!this.activeCountdown) return;
        
        const toast = this.activeToasts.get(this.activeCountdown.toastId);
        if (!toast) return;
        
        const timerNumber = toast.querySelector('.health-toast-timer-number');
        const progressBar = toast.querySelector('.health-toast-progress-bar');
        
        if (timerNumber) {
            timerNumber.textContent = this.activeCountdown.remaining;
        }
        
        if (progressBar) {
            const percentage = (this.activeCountdown.remaining / this.activeCountdown.total) * 100;
            progressBar.style.width = percentage + '%';
        }
    }

    completeCountdown() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        
        if (this.activeCountdown) {
            const toastId = this.activeCountdown.toastId;
            this.activeCountdown = null;
            
            // Show completion message briefly then dismiss
            const toast = this.activeToasts.get(toastId);
            if (toast) {
                const message = toast.querySelector('.health-toast-message');
                if (message) {
                    message.textContent = 'Great job! Your eyes thank you 👍';
                }
                
                setTimeout(() => this.dismissToast(toastId), 3000);
            }
        }
    }

    playSound() {
        if (this.settings.soundEnabled) {
            try {
                this.notificationSound.currentTime = 0;
                this.notificationSound.play().catch(err => {
                });
            } catch (err) {
            }
        }
    }

    // Public methods for settings
    toggleEyeStrain(enabled) {
        this.settings.eyeStrainEnabled = enabled;
        this.saveSettings();
    }

    togglePosture(enabled) {
        this.settings.postureEnabled = enabled;
        this.saveSettings();
    }

    toggleHydration(enabled) {
        this.settings.hydrationEnabled = enabled;
        this.saveSettings();
    }

    toggleSound(enabled) {
        this.settings.soundEnabled = enabled;
        this.saveSettings();
    }

    getSettings() {
        return { ...this.settings };
    }
}

// Initialize health reminders when DOM is ready
let healthReminders;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        healthReminders = new HealthReminders();
        window.healthReminders = healthReminders;
    });
} else {
    healthReminders = new HealthReminders();
    window.healthReminders = healthReminders;
}
