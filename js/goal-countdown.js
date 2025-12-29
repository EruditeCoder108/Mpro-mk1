/**
 * Goal Countdown Widget
 * Displays a countdown to a user-defined goal with color-coded progress
 */

(function() {
    'use strict';

    // Storage keys
    const STORAGE_PREFIX = 'GOAL_COUNTDOWN_';
    const ENABLED_KEY = `${STORAGE_PREFIX}ENABLED`;
    const GOAL_DATA_KEY = `${STORAGE_PREFIX}DATA`;
    const POSITION_KEY = `${STORAGE_PREFIX}POSITION`;

    // Get user-specific storage key
    function getStorageKey(baseKey) {
        // Check Firebase auth directly instead of firebaseDataManager
        if (typeof auth !== 'undefined' && auth && auth.currentUser) {
            return `${baseKey}_${auth.currentUser.uid}`;
        }
        // Also check firebaseDataManager as fallback
        if (window.firebaseDataManager && firebaseDataManager.user) {
            return `${baseKey}_${firebaseDataManager.user.uid}`;
        }
        return baseKey;
    }

    // Widget state
    let widgetElement = null;
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    let updateInterval = null;
    let isFirebaseReady = false;
    let pendingInitialization = false;

    /**
     * Initialize the goal countdown widget
     */
    function initGoalCountdown() {

        // Get the widget element
        widgetElement = document.getElementById('goal-countdown-widget');
        if (!widgetElement) {
            console.error('Goal countdown widget element not found');
            return;
        }

        // Set up drag functionality early
        setupDragHandlers();

        // Wait for Firebase to be ready before checking user-specific storage
        waitForFirebaseAndInitialize();
    }

    /**
     * Wait for Firebase authentication to be ready, then initialize widget state
     */
    function waitForFirebaseAndInitialize() {
        // Check if Firebase auth is available
        if (typeof auth !== 'undefined' && auth) {
            // Always use the auth state listener to ensure auth is fully initialized
            // The listener fires once immediately with the current auth state (or null)
            const unsubscribe = auth.onAuthStateChanged((user) => {
                if (!isFirebaseReady) {
                    isFirebaseReady = true;
                    pendingInitialization = false;
                    
                    // Initialize widget state now that we know auth status
                    initializeWidgetState();
                    
                    // Unsubscribe after first auth state is known
                    if (unsubscribe) unsubscribe();
                }
            });
            
            // Fallback timeout in case auth listener doesn't fire (should not happen)
            setTimeout(() => {
                if (!isFirebaseReady) {
                    isFirebaseReady = true;
                    pendingInitialization = false;
                    initializeWidgetState();
                }
            }, 3000);
        } else {
            // Firebase auth not loaded yet, retry
            setTimeout(() => {
                if (!isFirebaseReady) {
                    waitForFirebaseAndInitialize();
                }
            }, 200);
        }
    }

    /**
     * Initialize widget state once Firebase is ready
     */
    function initializeWidgetState() {
        // Check if widget is enabled
        const isEnabled = localStorage.getItem(getStorageKey(ENABLED_KEY)) === 'true';
        
        if (isEnabled) {
            const goalData = loadGoalData();
            if (goalData) {
                showWidget();
                updateCountdown();
                startUpdateInterval();
                // Load saved position after showing widget
                loadPosition();
            } else {
                // Widget is enabled but no goal data exists, show modal
                showGoalModal();
            }
        }
    }

    /**
     * Show the widget
     */
    function showWidget() {
        if (widgetElement) {
            widgetElement.classList.add('active');
        }
    }

    /**
     * Hide the widget
     */
    function hideWidget() {
        if (widgetElement) {
            widgetElement.classList.remove('active');
        }
    }

    /**
     * Toggle the widget on/off
     */
    function toggleWidget(enabled) {
        localStorage.setItem(getStorageKey(ENABLED_KEY), enabled.toString());

        if (enabled) {
            const goalData = loadGoalData();
            if (goalData) {
                showWidget();
                updateCountdown();
                startUpdateInterval();
            } else {
                // No goal data, show modal to create one
                showGoalModal();
            }
        } else {
            hideWidget();
            stopUpdateInterval();
        }
    }

    /**
     * Load goal data from localStorage
     */
    function loadGoalData() {
        try {
            const data = localStorage.getItem(getStorageKey(GOAL_DATA_KEY));
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error loading goal data:', error);
            return null;
        }
    }

    /**
     * Save goal data to localStorage
     */
    function saveGoalData(goalName, goalDate) {
        const data = {
            name: goalName,
            date: goalDate,
            createdAt: new Date().toISOString()
        };
        localStorage.setItem(getStorageKey(GOAL_DATA_KEY), JSON.stringify(data));
    }

    /**
     * Delete goal data
     */
    function deleteGoalData() {
        localStorage.removeItem(getStorageKey(GOAL_DATA_KEY));
        hideWidget();
        stopUpdateInterval();
        
        // Turn off the widget in settings
        localStorage.setItem(getStorageKey(ENABLED_KEY), 'false');
        
        // Update the settings toggle if it exists
        const settingsToggle = document.getElementById('goal-countdown-toggle');
        if (settingsToggle) {
            settingsToggle.checked = false;
        }
    }

    /**
     * Update the countdown display
     */
    function updateCountdown() {
        const goalData = loadGoalData();
        if (!goalData) return;

        const now = new Date();
        const goalDate = new Date(goalData.date);
        const startDate = new Date(goalData.createdAt);

        // Calculate days left
        const timeDiff = goalDate.getTime() - now.getTime();
        const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

        // Calculate total duration and percentage
        const totalDuration = goalDate.getTime() - startDate.getTime();
        const timeElapsed = now.getTime() - startDate.getTime();
        const percentageElapsed = (timeElapsed / totalDuration) * 100;

        // Update the display
        const nameElement = widgetElement.querySelector('.goal-name');
        const daysElement = widgetElement.querySelector('.goal-days-left');
        const labelElement = widgetElement.querySelector('.goal-days-label');

        if (nameElement) {
            nameElement.textContent = goalData.name;
            nameElement.title = goalData.name; // Show full name on hover
        }

        if (daysElement) {
            // Remove existing color classes
            daysElement.classList.remove('warning', 'danger');

            if (daysLeft < 0) {
                daysElement.textContent = 'Expired';
                daysElement.classList.add('danger');
            } else if (daysLeft === 0) {
                daysElement.textContent = 'Today!';
                daysElement.classList.add('danger');
            } else {
                daysElement.textContent = daysLeft;

                // Color based on percentage of time elapsed
                if (percentageElapsed > 90) {
                    // Less than 10% time remaining - red
                    daysElement.classList.add('danger');
                } else if (percentageElapsed > 50) {
                    // Less than 50% time remaining - yellow
                    daysElement.classList.add('warning');
                }
                // Otherwise stays green (default)
            }
        }

        if (labelElement && daysLeft > 0) {
            labelElement.textContent = daysLeft === 1 ? 'day left' : 'days left';
        } else if (labelElement && daysLeft === 0) {
            labelElement.textContent = 'It\'s happening!';
        } else if (labelElement) {
            labelElement.textContent = '';
        }
    }

    /**
     * Start the update interval (updates every minute)
     */
    function startUpdateInterval() {
        if (updateInterval) {
            clearInterval(updateInterval);
        }
        // Update every minute
        updateInterval = setInterval(updateCountdown, 60000);
    }

    /**
     * Stop the update interval
     */
    function stopUpdateInterval() {
        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
        }
    }

    /**
     * Show the goal input modal
     */
    function showGoalModal() {
        const existingGoal = loadGoalData();
        
        const modalHTML = `
            <div class="goal-modal-overlay" id="goal-modal-overlay">
                <div class="goal-modal">
                    <h2 class="goal-modal-title">${existingGoal ? 'Edit Your Goal' : 'Set Your Goal'}</h2>
                    <form class="goal-modal-form" id="goal-form">
                        <div class="goal-form-group">
                            <label class="goal-form-label" for="goal-name-input">Goal Name</label>
                            <input 
                                type="text" 
                                id="goal-name-input" 
                                class="goal-form-input" 
                                placeholder="e.g., JEE Mains Exam"
                                maxlength="30"
                                value="${existingGoal ? existingGoal.name : ''}"
                                required
                            />
                        </div>
                        <div class="goal-form-group">
                            <label class="goal-form-label" for="goal-date-input">Target Date</label>
                            <input 
                                type="date" 
                                id="goal-date-input" 
                                class="goal-form-input"
                                value="${existingGoal ? existingGoal.date : ''}"
                                min="${new Date().toISOString().split('T')[0]}"
                                required
                            />
                        </div>
                        <div class="goal-modal-actions">
                            <button type="button" class="goal-modal-btn goal-modal-btn-secondary" id="goal-cancel-btn">
                                Cancel
                            </button>
                            <button type="submit" class="goal-modal-btn goal-modal-btn-primary">
                                ${existingGoal ? 'Update' : 'Start Countdown'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('goal-modal-overlay');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Set up event listeners
        const form = document.getElementById('goal-form');
        const cancelBtn = document.getElementById('goal-cancel-btn');
        const overlay = document.getElementById('goal-modal-overlay');

        form.addEventListener('submit', handleFormSubmit);
        cancelBtn.addEventListener('click', handleModalCancel);
        
        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                handleModalCancel();
            }
        });

        // Focus the name input
        setTimeout(() => {
            document.getElementById('goal-name-input')?.focus();
        }, 100);
    }

    /**
     * Handle form submission
     */
    function handleFormSubmit(e) {
        e.preventDefault();

        const nameInput = document.getElementById('goal-name-input');
        const dateInput = document.getElementById('goal-date-input');

        const goalName = nameInput.value.trim();
        const goalDate = dateInput.value;

        if (!goalName || !goalDate) {
            toast.warning('Please fill in all fields');
            return;
        }

        // Validate date is in the future
        const selectedDate = new Date(goalDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (selectedDate < today) {
            toast.warning('Please select a future date');
            return;
        }

        // Save the goal
        saveGoalData(goalName, goalDate);

        // Update the display
        updateCountdown();

        // Show the widget
        showWidget();
        startUpdateInterval();

        // Enable in settings
        localStorage.setItem(getStorageKey(ENABLED_KEY), 'true');

        // Close the modal
        closeModal();

        // Show success feedback
    }

    /**
     * Handle modal cancel
     */
    function handleModalCancel() {
        const existingGoal = loadGoalData();
        
        // If no goal exists and user cancels, disable the widget
        if (!existingGoal) {
            localStorage.setItem(getStorageKey(ENABLED_KEY), 'false');
            hideWidget();
            
            // Update the settings toggle
            const settingsToggle = document.getElementById('goal-countdown-toggle');
            if (settingsToggle) {
                settingsToggle.checked = false;
            }
        }

        closeModal();
    }

    /**
     * Close the modal
     */
    function closeModal() {
        const overlay = document.getElementById('goal-modal-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.remove();
            }, 300);
        }
    }

    /**
     * Set up drag handlers for the widget
     */
    function setupDragHandlers() {
        if (!widgetElement) return;

        const dragStart = (e) => {
            // Ignore if clicking on delete button
            if (e.target.closest('.goal-delete-btn')) {
                return;
            }

            isDragging = true;
            const rect = widgetElement.getBoundingClientRect();
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);

            dragOffset.x = clientX - rect.left;
            dragOffset.y = clientY - rect.top;

            widgetElement.style.transition = 'none';
            widgetElement.style.cursor = 'grabbing';

            e.preventDefault();
        };

        const dragMove = (e) => {
            if (!isDragging) return;

            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);

            const newX = clientX - dragOffset.x;
            const newY = clientY - dragOffset.y;

            widgetElement.style.left = `${newX}px`;
            widgetElement.style.top = `${newY}px`;
            widgetElement.style.right = 'auto';
            widgetElement.style.bottom = 'auto';

            e.preventDefault();
        };

        const dragEnd = (e) => {
            if (!isDragging) return;

            isDragging = false;
            widgetElement.style.transition = 'all 0.3s ease';
            widgetElement.style.cursor = 'move';

            // Save position
            savePosition();

            document.removeEventListener('mousemove', dragMove);
            document.removeEventListener('mouseup', dragEnd);
            document.removeEventListener('touchmove', dragMove);
            document.removeEventListener('touchend', dragEnd);
        };

        widgetElement.addEventListener('mousedown', (e) => {
            dragStart(e);
            document.addEventListener('mousemove', dragMove);
            document.addEventListener('mouseup', dragEnd);
        });

        widgetElement.addEventListener('touchstart', (e) => {
            dragStart(e);
            document.addEventListener('touchmove', dragMove, { passive: false });
            document.addEventListener('touchend', dragEnd);
        });
    }

    /**
     * Save widget position to localStorage
     */
    function savePosition() {
        const position = {
            left: widgetElement.style.left,
            top: widgetElement.style.top
        };
        localStorage.setItem(getStorageKey(POSITION_KEY), JSON.stringify(position));
    }

    /**
     * Load widget position from localStorage
     */
    function loadPosition() {
        if (!widgetElement) return;
        
        try {
            const saved = localStorage.getItem(getStorageKey(POSITION_KEY));
            if (saved) {
                const position = JSON.parse(saved);
                if (position.left && position.top) {
                    widgetElement.style.left = position.left;
                    widgetElement.style.top = position.top;
                    widgetElement.style.right = 'auto';
                    widgetElement.style.bottom = 'auto';
                }
            }
        } catch (error) {
            console.error('Error loading widget position:', error);
        }
    }

    /**
     * Handle delete button click
     */
    function handleDeleteClick() {
        if (confirm('Are you sure you want to delete this goal?')) {
            deleteGoalData();
        }
    }

    // Expose functions to global scope for settings integration
    window.GoalCountdownWidget = {
        init: initGoalCountdown,
        toggle: toggleWidget,
        showModal: showGoalModal,
        isEnabled: () => localStorage.getItem(getStorageKey(ENABLED_KEY)) === 'true'
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGoalCountdown);
    } else {
        initGoalCountdown();
    }

    // Set up delete button handler (delegated event listener)
    document.addEventListener('click', (e) => {
        if (e.target.closest('.goal-delete-btn')) {
            handleDeleteClick();
        }
    });

})();
