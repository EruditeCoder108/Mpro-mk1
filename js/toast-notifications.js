/**
 * Minimal Toast Notification System
 * Clean, subtle, Mac-style design
 * Position: Top-left
 */

class Toast {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // Wait for DOM to be ready before creating container
        if (document.body) {
            this.createContainer();
        } else {
            // DOM not ready yet, wait for it
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.createContainer());
            } else {
                this.createContainer();
            }
        }
    }

    createContainer() {
        // Create toast container if it doesn't exist
        if (!document.getElementById('toast-container')) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('toast-container');
        }
    }

    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} type - Type: 'success', 'error', 'warning', 'info'
     * @param {number} duration - Duration in milliseconds (default: auto based on type)
     */
    show(message, type = 'info', duration = null) {
        // Ensure container exists before showing toast
        if (!this.container) {
            console.warn('Toast container not ready yet, retrying...');
            setTimeout(() => this.show(message, type, duration), 100);
            return;
        }

        // Auto duration based on type
        if (!duration) {
            duration = type === 'error' ? 5000 : type === 'warning' ? 4000 : 3000;
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Icon based on type
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
        `;

        // Add to container
        this.container.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('toast-show'), 10);

        // Auto remove
        setTimeout(() => {
            toast.classList.remove('toast-show');
            toast.classList.add('toast-hide');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    success(message, duration) {
        this.show(message, 'success', duration);
    }

    error(message, duration) {
        this.show(message, 'error', duration);
    }

    warning(message, duration) {
        this.show(message, 'warning', duration);
    }

    info(message, duration) {
        this.show(message, 'info', duration);
    }
}

// Create global toast instance
const toast = new Toast();

// Also expose as window.toast for easy access
window.toast = toast;
