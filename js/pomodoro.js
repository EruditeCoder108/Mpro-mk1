/**
 * Pomodoro Timer Module
 * Handles Pomodoro timer functionality for the Erudite Timer application
 */

// Pomodoro settings
// FIREBASE INTEGRATION: These settings should be stored in Firestore users/{userId}/preferences/pomodoroSettings
let POMODORO_SETTINGS = {
    WORK_DURATION: 25 * 60, // FIREBASE: User's work duration preference
    SHORT_BREAK_DURATION: 5 * 60, // FIREBASE: User's short break duration preference
    LONG_BREAK_DURATION: 15 * 60, // FIREBASE: User's long break duration preference
    CYCLES_BEFORE_LONG_BREAK: 4 // FIREBASE: User's cycles before long break preference
};

// Function to load Pomodoro settings from Firebase with localStorage fallback
// FIREBASE INTEGRATION: Load from Firestore users/{userId}/preferences/pomodoroSettings
async function loadPomodoroSettings() {
    try {
        // Load settings from Firebase with localStorage fallback
        const workDuration = await firebaseDataManager.loadUserPreference('pomodoroWorkDuration', 25 * 60);
        const shortBreakDuration = await firebaseDataManager.loadUserPreference('pomodoroShortBreakDuration', 5 * 60);
        const longBreakDuration = await firebaseDataManager.loadUserPreference('pomodoroLongBreakDuration', 15 * 60);
        const cyclesBeforeLongBreak = await firebaseDataManager.loadUserPreference('pomodoroCyclesBeforeLongBreak', 4);
        
        POMODORO_SETTINGS = {
            WORK_DURATION: workDuration,
            SHORT_BREAK_DURATION: shortBreakDuration,
            LONG_BREAK_DURATION: longBreakDuration,
            CYCLES_BEFORE_LONG_BREAK: cyclesBeforeLongBreak
        };
        
    } catch (error) {
        console.error('Error loading Pomodoro settings:', error);
        // Use defaults if loading fails
        POMODORO_SETTINGS = {
            WORK_DURATION: 25 * 60,
            SHORT_BREAK_DURATION: 5 * 60,
            LONG_BREAK_DURATION: 15 * 60,
            CYCLES_BEFORE_LONG_BREAK: 4
        };
    }
    
    // Update the UI with the loaded settings
    updatePomodoroSettingsUI();
}

// Function to save Pomodoro settings to Firebase with localStorage fallback
async function savePomodoroSettings() {
    try {
        // Get values from the UI
        const pomodoroHours = parseInt(document.getElementById('pomodoro-hours').value) || 0;
        const pomodoroMinutes = parseInt(document.getElementById('pomodoro-minutes').value) || 25;
        const shortBreakMinutes = parseInt(document.getElementById('short-break-minutes').value) || 5;
        const longBreakMinutes = parseInt(document.getElementById('long-break-minutes').value) || 15;
        
        // Calculate new durations in seconds
        const newWorkDuration = (pomodoroHours * 60 + pomodoroMinutes) * 60;
        const newShortBreakDuration = shortBreakMinutes * 60;
        const newLongBreakDuration = longBreakMinutes * 60;
        
        // Check if any duration has actually changed
        const durationsChanged = 
            POMODORO_SETTINGS.WORK_DURATION !== newWorkDuration ||
            POMODORO_SETTINGS.SHORT_BREAK_DURATION !== newShortBreakDuration ||
            POMODORO_SETTINGS.LONG_BREAK_DURATION !== newLongBreakDuration;
        
        // Get sessions per cycle from dropdown
        const sessionsPerCycle = parseInt(document.getElementById('sessions-per-cycle').value) || 4;
        
        // Update settings
        POMODORO_SETTINGS = {
            WORK_DURATION: newWorkDuration,
            SHORT_BREAK_DURATION: newShortBreakDuration,
            LONG_BREAK_DURATION: newLongBreakDuration,
            CYCLES_BEFORE_LONG_BREAK: sessionsPerCycle
        };
        
        // Save to Firebase with localStorage fallback
        await firebaseDataManager.saveUserPreference('pomodoroWorkDuration', POMODORO_SETTINGS.WORK_DURATION);
        await firebaseDataManager.saveUserPreference('pomodoroShortBreakDuration', POMODORO_SETTINGS.SHORT_BREAK_DURATION);
        await firebaseDataManager.saveUserPreference('pomodoroLongBreakDuration', POMODORO_SETTINGS.LONG_BREAK_DURATION);
        await firebaseDataManager.saveUserPreference('pomodoroCyclesBeforeLongBreak', POMODORO_SETTINGS.CYCLES_BEFORE_LONG_BREAK);
        
        
        // If we're in Pomodoro mode, update the current timer
        if (isPomodoroMode && durationsChanged) {
            // If timer is running, pause it first to prevent issues
            const wasRunning = !!pomodoroInterval;
            if (wasRunning) {
                clearInterval(pomodoroInterval);
                pomodoroInterval = null;
            }
            
            // Update the current timer based on the current state
            if (currentPomodoroState === 'work') {
                currentPomodoroSeconds = POMODORO_SETTINGS.WORK_DURATION;
            } else if (currentPomodoroState === 'short-break') {
                currentPomodoroSeconds = POMODORO_SETTINGS.SHORT_BREAK_DURATION;
            } else if (currentPomodoroState === 'long-break') {
                currentPomodoroSeconds = POMODORO_SETTINGS.LONG_BREAK_DURATION;
            }
            
            // Save the updated state
            localStorage.setItem(POMODORO_STORAGE_KEYS.CURRENT_POMODORO_SECONDS, currentPomodoroSeconds);
            
            // Update the UI
            updatePomodoroUI();
            
            // Restart the timer if it was running
            if (wasRunning) {
                startPomodoro();
            }
        }
        
        return true;
    } catch (error) {
        console.error('Error saving Pomodoro settings:', error);
        return false;
    }
}

// Function to update the UI with current Pomodoro settings
function updatePomodoroSettingsUI() {
    try {
        // Calculate hours and minutes from WORK_DURATION
        const workHours = Math.floor(POMODORO_SETTINGS.WORK_DURATION / 3600);
        const workMinutes = Math.floor((POMODORO_SETTINGS.WORK_DURATION % 3600) / 60);
        
        // Update the input fields
        document.getElementById('pomodoro-hours').value = workHours;
        document.getElementById('pomodoro-minutes').value = workMinutes;
        document.getElementById('short-break-minutes').value = POMODORO_SETTINGS.SHORT_BREAK_DURATION / 60;
        document.getElementById('long-break-minutes').value = POMODORO_SETTINGS.LONG_BREAK_DURATION / 60;
        document.getElementById('sessions-per-cycle').value = POMODORO_SETTINGS.CYCLES_BEFORE_LONG_BREAK;
    } catch (error) {
        console.error('Error updating Pomodoro settings UI:', error);
    }
}

// Add event listeners for Pomodoro settings changes
function setupPomodoroSettingsListeners() {
    const pomodoroInputs = [
        'pomodoro-hours', 'pomodoro-minutes', 
        'short-break-minutes', 'long-break-minutes',
        'sessions-per-cycle'
    ];
    
    pomodoroInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            // For dropdown, we only need the change event
            if (id === 'sessions-per-cycle') {
                input.addEventListener('change', () => savePomodoroSettings());
            } else {
                input.addEventListener('change', () => savePomodoroSettings());
                input.addEventListener('blur', () => savePomodoroSettings());
            }
        }
    });
}

// Initialize Pomodoro settings when the page loads
document.addEventListener('DOMContentLoaded', () => {
    loadPomodoroSettings();
    setupPomodoroSettingsListeners();
});

// Audio for session completion
let sessionCompleteSound = null;

// Initialize the session complete sound
function initSessionCompleteSound() {
    if (!sessionCompleteSound) {
                    sessionCompleteSound = new Audio('assets/audio/session.mp3');
        sessionCompleteSound.volume = 0.5; // Set volume to 50%
    }
    return sessionCompleteSound;
}

/**
 * Play the session complete sound
 */
function playSessionCompleteSound() {
    try {
        const sound = initSessionCompleteSound();
        sound.currentTime = 0; // Rewind to start
        sound.play().catch(e => console.log('Error playing session complete sound:', e));
    } catch (error) {
        console.error('Error with session complete sound:', error);
    }
}

// Pomodoro state
let isPomodoroMode = false;
let currentPomodoroState = 'work'; // 'work', 'short-break', 'long-break'
let currentPomodoroSeconds = POMODORO_SETTINGS.WORK_DURATION;
let completedPomodoros = 0;
let pomodoroInterval = null;

// Storage keys specific to Pomodoro
const POMODORO_STORAGE_KEYS = {
    IS_POMODORO_MODE: 'isPomodoroMode',
    CURRENT_POMODORO_STATE: 'currentPomodoroState',
    CURRENT_POMODORO_SECONDS: 'currentPomodoroSeconds',
    COMPLETED_POMODOROS: 'completedPomodoros',
    PREVIOUS_TIMER_HOURS: 'previousTimerHours',
    PREVIOUS_TIMER_MINUTES: 'previousTimerMinutes'
};

/**
 * Toggle Pomodoro mode
 */
function togglePomodoroMode() {
    if (isPomodoroMode) {
        exitPomodoroMode();
    } else {
        enterPomodoroMode();
    }
}

/**
 * Enter Pomodoro mode
 * Save current timer settings and setup Pomodoro timer
 */
function enterPomodoroMode() {
    // Pause any running timers instead of resetting them
    try {
        if (typeof pauseTimer === 'function' && timerIsRunning) {
            pauseTimer();
        }
    } catch (error) {
    }
    
    // Save current timer settings
    const hoursValue = document.getElementById('hours').value;
    const minutesValue = document.getElementById('minutes').value;
    
    localStorage.setItem(POMODORO_STORAGE_KEYS.PREVIOUS_TIMER_HOURS, hoursValue);
    localStorage.setItem(POMODORO_STORAGE_KEYS.PREVIOUS_TIMER_MINUTES, minutesValue);
    
    // Set Pomodoro mode flag
    isPomodoroMode = true;
    localStorage.setItem(POMODORO_STORAGE_KEYS.IS_POMODORO_MODE, 'true');
    
    // Reset Pomodoro state
    currentPomodoroState = 'work';
    currentPomodoroSeconds = POMODORO_SETTINGS.WORK_DURATION;
    completedPomodoros = 0;
    
    localStorage.setItem(POMODORO_STORAGE_KEYS.CURRENT_POMODORO_STATE, currentPomodoroState);
    localStorage.setItem(POMODORO_STORAGE_KEYS.CURRENT_POMODORO_SECONDS, currentPomodoroSeconds);
    localStorage.setItem(POMODORO_STORAGE_KEYS.COMPLETED_POMODOROS, completedPomodoros);
    
    // Update UI
    updatePomodoroUI();
    
    // Change button tooltip and appearance
    const pomodoroBtn = document.getElementById('pomodoro-btn');
    pomodoroBtn.querySelector('.btn-tooltip').textContent = 'Exit Pomodoro';
    pomodoroBtn.classList.add('active-mode');
    
    // Hide the trophy in Pomodoro mode
    const trophyContainer = document.querySelector('.trophy-container');
    if (trophyContainer) {
        trophyContainer.style.display = 'none';
    }
    
    // Disable mode toggle button when in Pomodoro mode
    const modeToggleBtn = document.getElementById('mode-toggle');
    if (modeToggleBtn) {
        modeToggleBtn.disabled = true;
        modeToggleBtn.style.opacity = '0.5';
        modeToggleBtn.style.cursor = 'not-allowed';
    }

    // Disable timer style selector when in Pomodoro mode
    if (typeof updateTimerStyleSelectorState === 'function') {
        updateTimerStyleSelectorState();
    }
    
    // Update button states
    if (typeof updateButtonStates === 'function') {
        updateButtonStates();
    }

    // Hide the time selector when in Pomodoro mode
    const timeSelector = document.querySelector('.time-selector');
    if (timeSelector) {
        timeSelector.style.display = 'none';
    }

}

/**
 * Exit Pomodoro mode
 * Restore previous timer settings
 */
function exitPomodoroMode() {
    // Clear any active Pomodoro timer
    if (pomodoroInterval) {
        clearInterval(pomodoroInterval);
        pomodoroInterval = null;
    }
    
    // Set Pomodoro mode flag
    isPomodoroMode = false;
    localStorage.setItem(POMODORO_STORAGE_KEYS.IS_POMODORO_MODE, 'false');
    
    // Restore previous timer settings
    const previousHours = localStorage.getItem(POMODORO_STORAGE_KEYS.PREVIOUS_TIMER_HOURS) || '0';
    const previousMinutes = localStorage.getItem(POMODORO_STORAGE_KEYS.PREVIOUS_TIMER_MINUTES) || '30';
    
    const hoursSelect = document.getElementById('hours');
    const minutesSelect = document.getElementById('minutes');
    
    // Safely set selector values
    if (hoursSelect) hoursSelect.value = previousHours;
    if (minutesSelect) minutesSelect.value = previousMinutes;
    
    // Update UI
    if (typeof updateDisplay === 'function') {
        updateDisplay();
    } else {
        // Fallback if updateDisplay isn't available
        const displayHours = document.getElementById('display-hours');
        const displayMinutes = document.getElementById('display-minutes');
        if (displayHours) displayHours.textContent = previousHours.padStart(2, '0');
        if (displayMinutes) displayMinutes.textContent = previousMinutes.padStart(2, '0');
    }
    
    // Update progress display if available
    if (typeof updateProgress === 'function') {
        updateProgress();
    }
    
    // Re-enable mode toggle button when exiting Pomodoro mode
    const modeToggleBtn = document.getElementById('mode-toggle');
    if (modeToggleBtn) {
        modeToggleBtn.disabled = false;
        modeToggleBtn.style.opacity = '1';
        modeToggleBtn.style.cursor = 'pointer';
    }

    // Re-enable timer style selector when exiting Pomodoro mode
    if (typeof updateTimerStyleSelectorState === 'function') {
        updateTimerStyleSelectorState();
    }
    
    // Update button states
    if (typeof updateButtonStates === 'function') {
        updateButtonStates();
    }

    // Show the time selector when exiting Pomodoro mode
    const timeSelector = document.querySelector('.time-selector');
    if (timeSelector) {
        timeSelector.style.display = ''; // Reset to default display
    }
    
    // Update Pomodoro button appearance
    const pomodoroBtn = document.getElementById('pomodoro-btn');
    if (pomodoroBtn) {
        pomodoroBtn.querySelector('.btn-tooltip').textContent = 'Pomodoro';
        pomodoroBtn.classList.remove('active-mode');
    }
    
    // Show the trophy container when exiting Pomodoro mode
    const trophyContainer = document.querySelector('.trophy-container');
    if (trophyContainer) {
        trophyContainer.style.display = ''; // Reset to default display
    }
    
    // Remove all Pomodoro state classes from timer container
    const timerContainer = document.querySelector('.timer-container');
    if (timerContainer) {
        timerContainer.classList.remove('pomodoro-work', 'pomodoro-break', 'pomodoro-long-break');
    }
    
    if (pomodoroBtn) {
        pomodoroBtn.classList.remove('active-mode');
    }
    
}

/**
 * Update UI for Pomodoro mode
 */
function updatePomodoroUI() {
    // Set the timer display
    const hours = Math.floor(currentPomodoroSeconds / 3600);
    const minutes = Math.floor((currentPomodoroSeconds % 3600) / 60);
    const seconds = currentPomodoroSeconds % 60;
    
    // Safely access display elements
    const displayHours = document.getElementById('display-hours');
    const displayMinutes = document.getElementById('display-minutes');
    const displaySeconds = document.getElementById('display-seconds');
    
    if (displayHours) displayHours.textContent = String(hours).padStart(2, '0');
    if (displayMinutes) displayMinutes.textContent = String(minutes).padStart(2, '0');
    if (displaySeconds) displaySeconds.textContent = String(seconds).padStart(2, '0');
    
    // Update visual indicator for Pomodoro state
    const timerContainer = document.querySelector('.timer-container');
    
    // Remove existing state classes
    timerContainer.classList.remove('pomodoro-work', 'pomodoro-break', 'pomodoro-long-break');
    
    // Add appropriate state class
    if (currentPomodoroState === 'work') {
        timerContainer.classList.add('pomodoro-work');
        document.title = `${minutes}:${String(seconds).padStart(2, '0')} - Work Session`;
    } else if (currentPomodoroState === 'short-break') {
        timerContainer.classList.add('pomodoro-break');
        document.title = `${minutes}:${String(seconds).padStart(2, '0')} - Short Break`;
    } else if (currentPomodoroState === 'long-break') {
        timerContainer.classList.add('pomodoro-long-break');
        document.title = `${minutes}:${String(seconds).padStart(2, '0')} - Long Break`;
    }
    
    // Update progress indicator
    updatePomodoroProgress();
}

/**
 * Update progress indicator for Pomodoro sessions
 */
function updatePomodoroProgress() {
    const progressBar = document.getElementById('progress-bar');
    if (!progressBar) return;
    
    // Calculate different progress percentages based on the current state
    let totalDuration;
    
    if (currentPomodoroState === 'work') {
        totalDuration = POMODORO_SETTINGS.WORK_DURATION;
    } else if (currentPomodoroState === 'short-break') {
        totalDuration = POMODORO_SETTINGS.SHORT_BREAK_DURATION;
    } else if (currentPomodoroState === 'long-break') {
        totalDuration = POMODORO_SETTINGS.LONG_BREAK_DURATION;
    }
    
    const elapsedTime = totalDuration - currentPomodoroSeconds;
    const progressPercentage = (elapsedTime / totalDuration) * 100;
    
    // For Pomodoro mode, we use height instead of width for the progress bar
    progressBar.style.height = `${progressPercentage}%`;
    progressBar.style.width = '100%'; // Ensure full width
    
    // Color the progress bar based on state
    if (currentPomodoroState === 'work') {
        progressBar.style.backgroundColor = '#ff5252'; // Red for work
    } else if (currentPomodoroState === 'short-break') {
        progressBar.style.backgroundColor = '#4caf50'; // Green for short break
    } else if (currentPomodoroState === 'long-break') {
        progressBar.style.backgroundColor = '#2196f3'; // Blue for long break
    }
}

/**
 * Start Pomodoro timer
 */
function startPomodoro() {
    if (pomodoroInterval) {
        clearInterval(pomodoroInterval);
    }
    
    // Show the play/pause button appropriately
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.querySelector('.play-icon').style.display = 'none';
        startBtn.querySelector('.pause-icon').style.display = 'block';
    }
    
    // Update button states when Pomodoro starts
    if (typeof window.updateButtonStates === 'function') {
        window.updateButtonStates();
    }

    pomodoroInterval = setInterval(() => {
        if (currentPomodoroSeconds > 0) {
            currentPomodoroSeconds--;
            updatePomodoroUI();
            localStorage.setItem(POMODORO_STORAGE_KEYS.CURRENT_POMODORO_SECONDS, currentPomodoroSeconds);
        } else {
            // Timer completed
            clearInterval(pomodoroInterval);
            pomodoroInterval = null;
            
            // Play completion sound
            try {
                const successSound = document.querySelector('audio[src*="success.mp3"]');
                if (successSound && typeof playSound === 'function') {
                    playSound(successSound);
                } else if (successSound) {
                    successSound.volume = 0.6;
                    successSound.play().catch(e => console.log('Error playing sound:', e));
                }
            } catch (error) {
            }
            
            // Handle session completion
            handlePomodoroSessionComplete();
        }
    }, 1000);
    
}

/**
 * Pause Pomodoro timer
 */
function pausePomodoro() {
    if (pomodoroInterval) {
        clearInterval(pomodoroInterval);
        pomodoroInterval = null;
        
        // Update button appearance
        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
            startBtn.querySelector('.pause-icon').style.display = 'none';
            startBtn.querySelector('.play-icon').style.display = 'block';
        }
        

        // Update button states when Pomodoro pauses
        if (typeof window.updateButtonStates === 'function') {
            window.updateButtonStates();
        }
    }
}

/**
 * Reset current Pomodoro session
 */
function resetPomodoro() {
    // Clear interval if running
    if (pomodoroInterval) {
        clearInterval(pomodoroInterval);
        pomodoroInterval = null;
    }
    
    // Reset to beginning of current session type
    if (currentPomodoroState === 'work') {
        currentPomodoroSeconds = POMODORO_SETTINGS.WORK_DURATION;
    } else if (currentPomodoroState === 'short-break') {
        currentPomodoroSeconds = POMODORO_SETTINGS.SHORT_BREAK_DURATION;
    } else if (currentPomodoroState === 'long-break') {
        currentPomodoroSeconds = POMODORO_SETTINGS.LONG_BREAK_DURATION;
    }
    
    // Update UI
    updatePomodoroUI();
    
    // Reset button states
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        startBtn.querySelector('.pause-icon').style.display = 'none';
        startBtn.querySelector('.play-icon').style.display = 'block';
    }
    
    // Save state
    localStorage.setItem(POMODORO_STORAGE_KEYS.CURRENT_POMODORO_SECONDS, currentPomodoroSeconds);
    

    // Update button states when Pomodoro resets
    if (typeof window.updateButtonStates === 'function') {
        window.updateButtonStates();
    }
}

/**
 * Handle Pomodoro session completion
 */
function handlePomodoroSessionComplete() {
    // Play session complete sound
    playSessionCompleteSound();
    
    if (currentPomodoroState === 'work') {
        // Log completed work session (25 minutes)
        if (typeof logStudyTime === 'function') {
            logStudyTime(POMODORO_SETTINGS.WORK_DURATION);
        } else {
        }
        
        // Increment completed pomodoros counter
        completedPomodoros++;
        localStorage.setItem(POMODORO_STORAGE_KEYS.COMPLETED_POMODOROS, completedPomodoros);
        
        // Determine whether to take a short break or long break
        if (completedPomodoros % POMODORO_SETTINGS.CYCLES_BEFORE_LONG_BREAK === 0) {
            // Time for a long break after 4 completed work sessions
            currentPomodoroState = 'long-break';
            currentPomodoroSeconds = POMODORO_SETTINGS.LONG_BREAK_DURATION;
            showLongBreakOptions();
        } else {
            // Take a short break
            currentPomodoroState = 'short-break';
            currentPomodoroSeconds = POMODORO_SETTINGS.SHORT_BREAK_DURATION;
            startPomodoro(); // Automatically start the break
        }
    } else if (currentPomodoroState === 'short-break' || currentPomodoroState === 'long-break') {
        // Break finished, start a work session
        currentPomodoroState = 'work';
        currentPomodoroSeconds = POMODORO_SETTINGS.WORK_DURATION;
        // Play sound again when break ends and work session starts
        setTimeout(playSessionCompleteSound, 100);
        startPomodoro(); // Automatically start the work session
    }
    
    // Save updated state
    localStorage.setItem(POMODORO_STORAGE_KEYS.CURRENT_POMODORO_STATE, currentPomodoroState);
    localStorage.setItem(POMODORO_STORAGE_KEYS.CURRENT_POMODORO_SECONDS, currentPomodoroSeconds);
    
    // Update UI
    updatePomodoroUI();
}

/**
 * Show options dialog after completing a pomodoro cycle
 */
function showLongBreakOptions() {
    // Create modal dialog
    const modal = document.createElement('div');
    modal.className = 'pomodoro-modal';
    modal.innerHTML = `
        <div class="pomodoro-modal-content">
            <h2>Cycle Complete</h2>
            <div class="pomodoro-modal-buttons">
                <button id="next-cycle" class="btn-primary">Next Cycle</button>
                <button id="stop-pomodoro" class="btn-secondary">Stop Pomodoro</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    document.getElementById('next-cycle').addEventListener('click', () => {
        // Start long break before next cycle
        currentPomodoroState = 'long-break';
        currentPomodoroSeconds = POMODORO_SETTINGS.LONG_BREAK_DURATION;
        completedPomodoros = 0; // Reset completed pomodoros for the new cycle
        
        // Save state
        localStorage.setItem(POMODORO_STORAGE_KEYS.CURRENT_POMODORO_STATE, currentPomodoroState);
        localStorage.setItem(POMODORO_STORAGE_KEYS.CURRENT_POMODORO_SECONDS, currentPomodoroSeconds);
        localStorage.setItem(POMODORO_STORAGE_KEYS.COMPLETED_POMODOROS, completedPomodoros);
        
        // Update UI and start the long break
        updatePomodoroUI();
        startPomodoro();
        modal.remove();
    });
    
    document.getElementById('stop-pomodoro').addEventListener('click', () => {
        modal.remove();
        exitPomodoroMode();
    });
}

/**
 * Load saved Pomodoro state from localStorage
 */
async function loadPomodoroState() {
    // First load the settings
    await loadPomodoroSettings();
    const savedIsPomodoroMode = localStorage.getItem(POMODORO_STORAGE_KEYS.IS_POMODORO_MODE);
    
    if (savedIsPomodoroMode === 'true') {
        isPomodoroMode = true;
        currentPomodoroState = localStorage.getItem(POMODORO_STORAGE_KEYS.CURRENT_POMODORO_STATE) || 'work';
        currentPomodoroSeconds = parseInt(localStorage.getItem(POMODORO_STORAGE_KEYS.CURRENT_POMODORO_SECONDS) || POMODORO_SETTINGS.WORK_DURATION);
        completedPomodoros = parseInt(localStorage.getItem(POMODORO_STORAGE_KEYS.COMPLETED_POMODOROS) || 0);
        
        // Update UI
        updatePomodoroUI();
        
        // Update button appearance
        const pomodoroBtn = document.getElementById('pomodoro-btn');
        if (pomodoroBtn) {
            pomodoroBtn.querySelector('.btn-tooltip').textContent = 'Exit Pomodoro';
            pomodoroBtn.classList.add('active-mode');
        }
        
        // Disable mode toggle button when in Pomodoro mode
        const modeToggleBtn = document.getElementById('mode-toggle');
        if (modeToggleBtn) {
            modeToggleBtn.disabled = true;
            modeToggleBtn.style.opacity = '0.5';
            modeToggleBtn.style.cursor = 'not-allowed';
        }
        
        // Hide the time selector when in Pomodoro mode
        const timeSelector = document.querySelector('.time-selector');
        if (timeSelector) {
            timeSelector.style.display = 'none';
        }
        
        // Hide the trophy container in Pomodoro mode
        const trophyContainer = document.querySelector('.trophy-container');
        if (trophyContainer) {
            trophyContainer.style.display = 'none';
        }

        // Disable timer style selector when in Pomodoro mode
        if (typeof updateTimerStyleSelectorState === 'function') {
            updateTimerStyleSelectorState();
        }
        
        // Update button states
        if (typeof updateButtonStates === 'function') {
            updateButtonStates();
        }

    }
}

/**
 * Check if we're in Pomodoro mode
 * @returns {boolean} Whether Pomodoro mode is active
 */
function isPomodoroActive() {
    return isPomodoroMode;
}
