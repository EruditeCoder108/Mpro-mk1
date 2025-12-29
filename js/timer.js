        // Enhanced loading screen functionality
        document.addEventListener('DOMContentLoaded', function() {
            const loader = document.querySelector('.loader');
            
            // Ensure loader is visible initially
            if (loader) {
            loader.style.display = 'flex';
            loader.style.opacity = '1';
            }
        });

        // ========== Existing Timer Logic ==========
        // DOM elements
        const modeToggleBtn = document.getElementById('mode-toggle-btn');
        const hoursSelect = document.getElementById('hours');
        const minutesSelect = document.getElementById('minutes');
        const displayHours = document.getElementById('display-hours');
        const displayMinutes = document.getElementById('display-minutes');
        const displaySeconds = document.getElementById('display-seconds');
        const startBtn = document.getElementById('start-btn');
        const resetBtn = document.getElementById('reset-btn');
        const progressBtn = document.getElementById('progress-btn');
        // Ambient sounds functionality moved to js/ambient-sounds.js
        const pomodoroBtn = document.getElementById('pomodoro-btn'); // Added Pomodoro button reference
        const uploadBgBtn = document.getElementById('upload-bg-btn'); // Background upload button
        const bgUploadInput = document.getElementById('bg-upload-input'); // Hidden file input
        const timerContainer = document.querySelector('.timer-container'); // Timer container for zooming

        // Progress bar elements
        const progressBar = document.getElementById('progress-bar');
        const trophy = document.getElementById('trophy');
        const progressContainer = document.querySelector('.progress-container');

        const timeSelector = document.querySelector('.time-selector');
        const quoteDisplay = document.getElementById('quote-display');

        // Audio initialization
        const starUnlockSound = new Audio('assets/audio/star-unlock.mp3'); // Existing sound for segments
        starUnlockSound.volume = 1.0;
        const successSound = new Audio('assets/audio/success.mp3'); // Existing sound for completion
        successSound.volume = 0.6;

        // Color functionality
        let quoteColor = '#ffffff'; // Default quote color
        let digitColor = '#ffffff'; // Default digit color
        
        // Timer container styling
        let G_timerContainerBaseColorString = '#000000'; // Default base color (black)
        let G_timerContainerAlpha = 0.85; // Default alpha value (0.85)
        
        // Debouncing for Firebase saves to prevent excessive API calls
        const debounceTimeouts = {};
        function debouncedFirebaseSave(key, value, delay = 500) {
            // Clear existing timeout for this key
            if (debounceTimeouts[key]) {
                clearTimeout(debounceTimeouts[key]);
            }
            
            // Set new timeout
            debounceTimeouts[key] = setTimeout(() => {
                if (window.firebaseDataManager && firebaseDataManager.user) {
                    try {
                        firebaseDataManager.saveUserPreference(key, value);
                    } catch (error) {
                        console.warn(`Failed to save ${key} to Firebase, using localStorage:`, error);
                        localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : value);
                    }
                } else {
                    localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : value);
                }
                delete debounceTimeouts[key];
            }, delay);
        }
        
        // Timer size function - defined early for global access
        function updateTimerSize(size) {
            const timerContainer = document.querySelector('.timer-container');
            if (!timerContainer) return;
            
            const scale = size / 100;
            timerContainer.style.transform = `scale(${scale})`;
            timerContainer.style.transformOrigin = 'center';
        }
        
        // Local storage keys
        // FIREBASE INTEGRATION NOTES:
        // - TIMER_DATA, WEEKLY_DATA: Firebase primary (user progress data)
        // - QUOTE_COLOR, DIGIT_COLOR, TIMER_CONTAINER_*: Firebase primary (user preferences)
        // - PERSONAL_QUOTES_LIST: Firebase primary (user content)
        // - CUSTOM_BACKGROUND_IMAGE, CUSTOM_BACKGROUNDS_LIST: Firebase primary (user content)
        // - ROTATING_IMAGE_*: Firebase primary (user preferences)
        // - AMBIENT_COMBINATIONS: Firebase primary (user content)
        // - REMAINING_SECONDS, TIMER_IS_RUNNING, etc.: localStorage only (current session state)
        const STORAGE_KEYS = {
            TIMER_DATA: 'studyTime', // FIREBASE: User's daily study time data
            REMAINING_SECONDS: 'timerRemainingSeconds', // LOCALSTORAGE ONLY: Current session state
            QUOTE_COLOR: 'quoteColor', // FIREBASE: User preference
            DIGIT_COLOR: 'digitColor', // FIREBASE: User preference
            TIMER_CONTAINER_BASE_COLOR_STRING: 'timerContainerBaseColor', // FIREBASE: User preference
            TIMER_CONTAINER_ALPHA: 'timerContainerAlpha', // FIREBASE: User preference
            IS_RUNNING: 'timerIsRunning', // LOCALSTORAGE ONLY: Current session state
            TIMER_IS_RUNNING: 'timerIsRunning', // LOCALSTORAGE ONLY: Current session state
            STOPWATCH_IS_RUNNING: 'stopwatchIsRunning', // LOCALSTORAGE ONLY: Current session state
            START_BTN_TEXT: 'startBtnText', // LOCALSTORAGE ONLY: UI state
            SELECTED_HOURS: 'selectedHours', // LOCALSTORAGE ONLY: Current session state
            SELECTED_MINUTES: 'selectedMinutes', // LOCALSTORAGE ONLY: Current session state
            IS_STOPWATCH_MODE: 'isStopwatchMode', // LOCALSTORAGE ONLY: Current session state
            STOPWATCH_ELAPSED_TIME: 'stopwatchElapsedTime', // LOCALSTORAGE ONLY: Current session state
            TIMER_START_TIME: 'timerStartTime', // LOCALSTORAGE ONLY: Current session state
            INITIAL_TOTAL_SECONDS: 'timerInitialTotalSeconds', // LOCALSTORAGE ONLY: Current session state
            STOPWATCH_START_TIME: 'stopwatchStartTime', // LOCALSTORAGE ONLY: Current session state
            LAST_ACTIVE_DATE: 'lastActiveDate', // LOCALSTORAGE ONLY: Session tracking
            TIMER_PAUSED: 'timerPaused', // LOCALSTORAGE ONLY: Current session state
            WEEKLY_DATA: 'weeklyStudyData', // FIREBASE: User's weekly progress data
            // AMBIENT_COMBINATIONS moved to js/ambient-sounds.js - FIREBASE: User's saved sound mixes
            CUSTOM_BACKGROUND_IMAGE: 'customBackgroundImage', // FIREBASE: User's custom background
            CUSTOM_BACKGROUNDS_LIST: 'customBackgroundsList', // FIREBASE: User's custom background collection
            ROTATING_IMAGE_OPACITY: 'rotatingImageOpacity', // FIREBASE: User preference
            ROTATING_IMAGE_POSITION_LOCKED: 'rotatingImagePositionLocked', // FIREBASE: User preference
            ROTATING_IMAGE_BW_MODE: 'rotatingImageBWMode', // FIREBASE: User preference
            ROTATING_IMAGE_COUNT: 'rotatingImageCount', // FIREBASE: User preference
            ROTATING_IMAGE_ROTATION_DURATION: 'rotatingImageRotationDuration', // FIREBASE: User preference
            ROTATING_IMAGE_SIZE: 'rotatingImageSize', // FIREBASE: User preference
            QUOTE_SOURCE: 'timerQuoteSource', // FIREBASE: User preference
            PERSONAL_QUOTES_LIST: 'timerPersonalQuotesList' // FIREBASE: User's personal quotes
        };

        // State variables
        let wakeLock = null;
        let timerInterval;
        let stopwatchInterval;
        let initialTotalSeconds;
        let remainingSeconds;
        let stopwatchStartTime;
        let stopwatchElapsedTime = 0;
        let timerIsRunning = false;
        let stopwatchIsRunning = false;
        let isStopwatchMode = false;
        let startTime;
        let lastActiveDate = getFormattedDate();
        let timerPaused = false;
        let inactivityTimer; // Timer for auto-hiding controls
        const inactivityTimeoutDuration = 10000; // 10 seconds
        let lastCompletedSegment = -1; // Track completed segments for sound/color
        // Segment color classes instead of direct colors
        const segmentClasses = ['segment-0', 'segment-1', 'segment-2', 'segment-3', 'segment-4', 'segment-5'];

        // Elements to auto-hide
        const elementsToAutoHide = [
            timeSelector,
            document.querySelector('.control-box'), // New control box
            document.querySelector('.control-box-taskbar'), // Taskbar control box
            progressContainer // Progress container
        ];
        
        // Special elements that need custom hide/show logic
        const customCursorElements = [
            document.getElementById('cursor-dot'),
            document.getElementById('cursor-outline')
        ];
        
        const profilePopup = document.getElementById('profile-menu');

        // Default motivational quotes
        const defaultQuotes = [
            "Believe you can and you're halfway there",
            "There are no shortcuts to any place worth going",
            "I find that the harder I work, the more luck I seem to have",
            "You are braver than you believe, stronger than you seem and smarter than you think",
            "It always seems impossible until it's done"
        ];
        
        // Active quotes array - will be populated based on user settings
        let activeQuotesArray = [];
        
        // Quote color will be loaded from localStorage if available
        
        /**
         * Load the active quotes based on user settings
         * FIREBASE INTEGRATION: This function should be updated to:
         * 1. Load personal quotes from Firestore: users/{userId}/personalQuotes
         * 2. Use localStorage as fallback when offline
         * 3. Sync localStorage data to Firebase when connection is restored
         */
        function loadActiveQuotes() {
            const quoteSource = localStorage.getItem(STORAGE_KEYS.QUOTE_SOURCE) || 'default';
            
            if (quoteSource === 'personal') {
                try {
                    const personalQuotesJSON = localStorage.getItem(STORAGE_KEYS.PERSONAL_QUOTES_LIST);
                    if (personalQuotesJSON) {
                        const personalQuotes = JSON.parse(personalQuotesJSON);
                        if (Array.isArray(personalQuotes) && personalQuotes.length > 0) {
                            activeQuotesArray = [...personalQuotes];
                            return;
                        }
                    }
                    // If we get here, there was an issue with personal quotes, so fall back to default
                    console.warn('No valid personal quotes found, using default quotes');
                    localStorage.setItem(STORAGE_KEYS.QUOTE_SOURCE, 'default');
                    activeQuotesArray = [...defaultQuotes];
                } catch (error) {
                    console.error('Error loading personal quotes:', error);
                    localStorage.setItem(STORAGE_KEYS.QUOTE_SOURCE, 'default');
                    activeQuotesArray = [...defaultQuotes];
                }
            } else {
                // Use default quotes
                activeQuotesArray = [...defaultQuotes];
            }
        }

        /**
         * Get current date in YYYY-MM-DD format
         */
        function getFormattedDate() {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        /**
         * Request wake lock to keep screen active
         */
        async function requestWakeLock() {
            if (!timerIsRunning && !stopwatchIsRunning) return;

            if (wakeLock === null && 'wakeLock' in navigator) {
                 try {
                     wakeLock = await navigator.wakeLock.request('screen');
                     wakeLock.addEventListener('release', () => {
                         wakeLock = null;
                     });
                 } catch (err) {
                     console.error(`Failed to acquire wake lock: ${err.name}, ${err.message}`);
                     wakeLock = null;
                 }
            } else if (!('wakeLock' in navigator)) {
                 console.warn('Wake Lock API not supported.');
            }
         }

        /**
         * Release wake lock if held
         */
        async function releaseWakeLock() {
            if (wakeLock !== null) {
                await wakeLock.release();
                wakeLock = null;
            }
        }

        /**
         * Handle visibility change to manage wake lock
         */
         const handleVisibilityChange = () => {
              if (document.visibilityState === 'hidden' && wakeLock !== null) {
              } else if (document.visibilityState === 'visible') {
                  requestWakeLock();
                  if (typeof checkForDateChange === 'function') {
                      checkForDateChange();
                  }
              }
          };
          
          /**
           * Function to check if the date has changed while the app was inactive
           * This is used to handle situations where the timer crosses midnight
           */
          const checkForDateChange = () => {
              const currentDate = new Date().toLocaleDateString();
              const lastKnownDate = localStorage.getItem('lastKnownDate');
              
              if (lastKnownDate && lastKnownDate !== currentDate) {
                  // Optionally handle date change logic here
              }
              
              localStorage.setItem('lastKnownDate', currentDate);
          };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        /**
         * Save timer state before page unload
         */
        window.addEventListener('beforeunload', async () => {
            try {
                await releaseWakeLock();

                localStorage.setItem(STORAGE_KEYS.REMAINING_SECONDS, remainingSeconds || 0);
                localStorage.setItem(STORAGE_KEYS.TIMER_IS_RUNNING, timerIsRunning);
                localStorage.setItem(STORAGE_KEYS.STOPWATCH_IS_RUNNING, stopwatchIsRunning);
                localStorage.setItem(STORAGE_KEYS.START_BTN_TEXT, getStateFromButtonText(startBtn.textContent));
                localStorage.setItem(STORAGE_KEYS.SELECTED_HOURS, hoursSelect.value);
                localStorage.setItem(STORAGE_KEYS.SELECTED_MINUTES, minutesSelect.value);
                localStorage.setItem(STORAGE_KEYS.IS_STOPWATCH_MODE, isStopwatchMode);
                localStorage.setItem(STORAGE_KEYS.STOPWATCH_ELAPSED_TIME, stopwatchElapsedTime || 0);
                localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE_DATE, lastActiveDate);
                localStorage.setItem(STORAGE_KEYS.TIMER_PAUSED, timerPaused);

                if (timerIsRunning && !isStopwatchMode) {
                    localStorage.setItem(STORAGE_KEYS.TIMER_START_TIME, startTime);
                    localStorage.setItem(STORAGE_KEYS.INITIAL_TOTAL_SECONDS, initialTotalSeconds);
                } else if (stopwatchIsRunning && isStopwatchMode) {
                    localStorage.setItem(STORAGE_KEYS.STOPWATCH_START_TIME, stopwatchStartTime);
                }
            } catch (error) {
                console.error('Error saving timer state:', error);
            }
        });

        /**
         * Parses a color string (hex or rgb) and returns an object with r, g, b values
         * @param {string} colorString - The color string to parse (e.g., '#RRGGBB' or 'rgb(r,g,b)')
         * @returns {{r: number, g: number, b: number}} - Object with r, g, b values (0-255)
         */
        function parseColor(colorString) {
            // Default to black if invalid input
            if (!colorString) return { r: 0, g: 0, b: 0 };
            
            // Handle hex color
            if (colorString.startsWith('#')) {
                const hex = colorString.substring(1);
                const bigint = parseInt(hex, 16);
                return {
                    r: (bigint >> 16) & 255,
                    g: (bigint >> 8) & 255,
                    b: bigint & 255
                };
            }
            
            // Handle rgb() color
            const rgbMatch = colorString.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
            if (rgbMatch) {
                return {
                    r: parseInt(rgbMatch[1], 10),
                    g: parseInt(rgbMatch[2], 10),
                    b: parseInt(rgbMatch[3], 10)
                };
            }
            
            // Default to black if format is not recognized
            return { r: 0, g: 0, b: 0 };
        }

        /**
         * Applies the current timer container background style based on base color and alpha
         */
        function G_applyTimerContainerBackgroundStyle() {
            const timerContainer = document.querySelector('.timer-container');
            if (!timerContainer) return;
            
            const rgb = parseColor(G_timerContainerBaseColorString);
            
            // Check if we're in plant mode (style 6) - don't apply background
            const isPlantMode = timerContainer.classList.contains('timer-style-6');
            
            if (isPlantMode) {
                // For plant mode, keep background transparent
                timerContainer.style.backgroundColor = 'transparent';
            } else {
                // Apply background color with alpha using CSS custom properties approach
                // This works with the settings.js opacity system
            timerContainer.style.backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${G_timerContainerAlpha})`;
                timerContainer.style.setProperty('--timer-bg-opacity', G_timerContainerAlpha);
            }
            
            // Ensure container itself is fully opaque
            timerContainer.style.opacity = '1';
        }

        /**
         * Update timer display
         */
        function updateTimerDigitsColor(color) {
            // Update digits
            const digits = document.querySelectorAll('.display span');
            digits.forEach(digit => {
                digit.style.color = color;
                digit.style.textShadow = 'none';
            });
            
            // Update colons (text nodes between span elements)
            const display = document.querySelector('.display');
            if (display) {
                // Loop through all child nodes of the display
                for (let i = 0; i < display.childNodes.length; i++) {
                    const node = display.childNodes[i];
                    // Check if it's a text node that contains a colon
                    if (node.nodeType === Node.TEXT_NODE && node.nodeValue.includes(':')) {
                        // Create a span for the colon if it doesn't exist
                        if (!node.previousSibling || !node.previousSibling.classList || !node.previousSibling.classList.contains('colon')) {
                            const colonSpan = document.createElement('span');
                            colonSpan.className = 'colon';
                            colonSpan.textContent = ':';
                            colonSpan.style.color = color;
                            node.replaceWith(colonSpan);
                        } else {
                            // Update existing colon span
                            node.previousSibling.style.color = color;
                        }
                    }
                }
            }
        }

        function updateColorPickerVisual(colorPicker, colorValue) {
            // Force the color picker to update its visual representation
            if (colorPicker && colorValue) {
                // Create a temporary change event to trigger visual update
                const changeEvent = new Event('change', { bubbles: true });
                colorPicker.dispatchEvent(changeEvent);

                // Also trigger input event for immediate visual feedback
                const inputEvent = new Event('input', { bubbles: true });
                colorPicker.dispatchEvent(inputEvent);

                // For modern color pickers, add a color overlay to ensure visibility
                if (colorPicker.closest('.modern-color-picker')) {
                    const colorPickerContainer = colorPicker.closest('.modern-color-picker');
                    if (colorPickerContainer) {
                        // Add or update a color indicator overlay
                        let colorIndicator = colorPickerContainer.querySelector('.color-indicator');
                        if (!colorIndicator) {
                            colorIndicator = document.createElement('div');
                            colorIndicator.className = 'color-indicator';
                            colorIndicator.style.cssText = `
                                position: absolute;
                                top: 50%;
                                left: 50%;
                                width: 20px;
                                height: 20px;
                                border-radius: 50%;
                                transform: translate(-50%, -50%);
                                pointer-events: none;
                                z-index: 10;
                                border: 2px solid rgba(255, 255, 255, 0.8);
                                box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3);
                            `;
                            colorPickerContainer.appendChild(colorIndicator);
                        }
                        colorIndicator.style.backgroundColor = colorValue;
                    }
                }
            }
        }

        function updateDisplay() {
            let hours = 0;
            let minutes = 0;
            let seconds = 0;
            let elapsedSeconds = 0;

            if (isStopwatchMode) {
                const currentElapsedTime = stopwatchIsRunning ? (Date.now() - stopwatchStartTime) : stopwatchElapsedTime;
                elapsedSeconds = Math.floor(currentElapsedTime / 1000);
                hours = Math.floor(elapsedSeconds / 3600);
                minutes = Math.floor((elapsedSeconds % 3600) / 60);
                seconds = elapsedSeconds % 60;
                
                // Update plant growth for stopwatch mode
                if (typeof updatePlantGrowth === 'function' && plantGrowthState?.isActive) {
                    updatePlantGrowth(elapsedSeconds, 3600); // Use 1 hour as target for stopwatch
                    updateProgressBar(elapsedSeconds / 3600);
                }
            } else {
                // Check if timer has completed (remainingSeconds is 0 and timer is not running)
                if (remainingSeconds === 0 && !timerIsRunning && initialTotalSeconds > 0) {
                    // Timer has completed, always show 00:00:00
                    hours = 0;
                    minutes = 0;
                    seconds = 0;
                } else {
                    const currentRemainingSeconds = (timerIsRunning || timerPaused) ? remainingSeconds : (parseInt(localStorage.getItem(STORAGE_KEYS.REMAINING_SECONDS) || '0'));
                    if (currentRemainingSeconds > 0) {
                        hours = Math.floor(currentRemainingSeconds / 3600);
                        minutes = Math.floor((currentRemainingSeconds % 3600) / 60);
                        seconds = currentRemainingSeconds % 60;
                        elapsedSeconds = initialTotalSeconds - currentRemainingSeconds;
                        
                        // Update plant growth for timer mode
                        if (typeof updatePlantGrowth === 'function' && plantGrowthState?.isActive) {
                            updatePlantGrowth(elapsedSeconds, initialTotalSeconds);
                            updateProgressBar(elapsedSeconds / initialTotalSeconds);
                        }
                    } else {
                        // Show selected time when timer is not running and hasn't completed
                        const selectedHours = parseInt(hoursSelect.value);
                        const selectedMinutes = parseInt(minutesSelect.value);
                        hours = selectedHours;
                        minutes = selectedMinutes;
                        seconds = 0;
                    }
                }
            }

            displayHours.textContent = String(hours).padStart(2, '0');
            displayMinutes.textContent = String(minutes).padStart(2, '0');
            displaySeconds.textContent = String(seconds).padStart(2, '0');
            
            // Update browser tab title with countdown
            updateTabTitle(hours, minutes, seconds);
            
            // Update circular progress for style 10
            if (typeof updateCircularProgress === 'function') {
                updateCircularProgress(hours, minutes, seconds);
            }
            
            // Update circular progress for style 4
            if (typeof updateStyle4Progress === 'function') {
                updateStyle4Progress(elapsedSeconds, initialTotalSeconds);
            }
            
            // Update plant growth progress if timer is running
            if (timerIsRunning && !timerPaused && typeof updatePlantGrowth === 'function' && plantGrowthState?.isActive) {
                const progress = elapsedSeconds / (isStopwatchMode ? 3600 : initialTotalSeconds);
                updateProgressBar(progress);
            }
        }

        /**
         * Update browser tab title with countdown
         * @param {number} hours - Hours remaining/elapsed
         * @param {number} minutes - Minutes remaining/elapsed
         * @param {number} seconds - Seconds remaining/elapsed
         */
        function updateTabTitle(hours, minutes, seconds) {
            // Only update tab title when timer or stopwatch is running
            if ((timerIsRunning && !timerPaused) || stopwatchIsRunning) {
                if (isStopwatchMode) {
                    // For stopwatch, show elapsed time
                    if (hours > 0) {
                        document.title = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} - Stopwatch`;
                    } else {
                        document.title = `${minutes}:${String(seconds).padStart(2, '0')} - Stopwatch`;
                    }
                } else {
                    // For timer, show remaining time
                    if (hours > 0) {
                        document.title = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} - Timer`;
                    } else {
                        document.title = `${minutes}:${String(seconds).padStart(2, '0')} - Timer`;
                    }
                }
            } else {
                // Reset to default title when not running
                document.title = 'Productivity Toolkit';
            }
        }

        /**
         * Play sound with error handling
         * @param {HTMLAudioElement} audioElement - The audio element to play
         */
        // Track user interaction state
        let userHasInteracted = false;
        let audioUnlocked = false;

        // Function to unlock audio and mark user interaction
        function unlockAudio() {
            if (audioUnlocked) return;
            
            userHasInteracted = true;
            
            // Preload and prime audio elements by attempting to play them at 0 volume
            try {
                const testPlay = (audio) => {
                    const originalVolume = audio.volume;
                    audio.volume = 0;
                    audio.play().then(() => {
                        audio.pause();
                        audio.currentTime = 0;
                        audio.volume = originalVolume;
                    }).catch(() => {});
                };
                
                testPlay(starUnlockSound);
                testPlay(successSound);
                
                audioUnlocked = true;
            } catch (e) {
            }
        }

        // Set up listeners to detect user interaction - using capture phase for earlier detection
        ['click', 'keydown', 'touchstart', 'mousedown', 'pointerdown'].forEach(eventType => {
            document.addEventListener(eventType, unlockAudio, { capture: true, passive: true });
        });

        function playSound(audioElement) {
            if (!audioElement) return;
            
            // Try to unlock audio if not already done
            if (!audioUnlocked) {
                unlockAudio();
            }
            
            if (audioElement.context && audioElement.context.state === 'suspended') {
                audioElement.context.resume();
            }

            // Always try to play the sound
            try {
                audioElement.currentTime = 0;
                const playPromise = audioElement.play();
                
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        // Sound played successfully
                    }).catch(error => {
                        // Only log if it's a real error, not just browser policy
                        if (error.name === 'NotAllowedError') {
                            // Try to unlock on next interaction
                            audioUnlocked = false;
                        } else {
                            console.warn(`Sound playback failed: ${error.message}`);
                        }
                    });
                }
            } catch (error) {
                console.warn(`Sound playback error: ${error.message}`);
            }
        }

        /**
         * Update circular progress for timer style 4
         * @param {number} elapsedSeconds - Elapsed time in seconds
         * @param {number} totalSeconds - Total timer duration in seconds
         */
        function updateStyle4Progress(elapsedSeconds, totalSeconds) {
            const timerContainer = document.querySelector('.timer-container');
            if (!timerContainer || !timerContainer.classList.contains('timer-style-4')) {
                return;
            }

            // In stopwatch mode, don't fill the clock - keep it at 0 degrees
            if (isStopwatchMode) {
                timerContainer.style.setProperty('--progress-angle', '0deg');
                return;
            }

            if (!totalSeconds || totalSeconds <= 0) {
                timerContainer.style.setProperty('--progress-angle', '0deg');
                return;
            }

            const progressPercentage = Math.min(100, (elapsedSeconds / totalSeconds) * 100);
            const progressAngle = (progressPercentage / 100) * 360;

            timerContainer.style.setProperty('--progress-angle', `${progressAngle}deg`);
        }

        /**
         * Update progress bar based on timer progress, handle segments, color, and sound
         */
        function updateProgress() {
            if (isStopwatchMode || !initialTotalSeconds || initialTotalSeconds <= 0) {
                progressBar.style.height = '0%';
                trophy.classList.remove('active');
                // Reset to first segment class
                segmentClasses.forEach(cls => progressBar.classList.remove(cls));
                progressBar.classList.add(segmentClasses[0]);
                // lastCompletedSegment = -1; // Reset on mode switch might be needed if timer was running
                return;
            }

            const elapsedSeconds = initialTotalSeconds - remainingSeconds;
            const progressPercentage = Math.min(100, (elapsedSeconds / initialTotalSeconds) * 100);

            progressBar.style.height = `${progressPercentage}%`;

            // Determine current segment (0-4 for 0-99.99%, 5 for 100%)
            const currentSegment = Math.min(4, Math.floor(progressPercentage / 20));
            
            // Play sound and update last completed segment if a new threshold is crossed
            if (currentSegment > lastCompletedSegment && progressPercentage > 0) {
                 // Play sound for all newly completed segments (handles jumping over segments if needed)
                for (let i = lastCompletedSegment + 1; i <= currentSegment; i++) {
                    if(i < 5) { // Only play segment sound up to the 4th segment completion (entering 5th)
                         playSound(starUnlockSound);
                    }
                }
                lastCompletedSegment = currentSegment; 
            }

            // Update class based on the current segment being filled
            // First remove all segment classes
            segmentClasses.forEach(cls => progressBar.classList.remove(cls));
            // Add the current segment class
            progressBar.classList.add(segmentClasses[currentSegment]);
            
            // Update style 4 circular progress
            updateStyle4Progress(elapsedSeconds, initialTotalSeconds);

            // Activate trophy when progress reaches 100%
            if (progressPercentage >= 100 && !trophy.classList.contains('active')) {
                // First, ensure any previous animation is reset
                trophy.style.animation = 'none';
                trophy.offsetHeight; // Trigger reflow
                
                // Add the active class to start the animation
                trophy.classList.add('active');
                
                // Change progress bar to gold segment
                segmentClasses.forEach(cls => progressBar.classList.remove(cls));
                progressBar.classList.add(segmentClasses[5]); // Segment 5 is gold
                
                // Add a subtle pulse effect to the trophy container
                const trophyContainer = document.querySelector('.trophy-container');
                trophyContainer.style.animation = 'pulse 0.5s 3';
                
                // Play success sound with a slight delay to sync with animation
                setTimeout(() => {
                    playSound(successSound);
                }, 300);
                
                lastCompletedSegment = 5; // Mark final completion
                
                // Remove the pulse animation after it completes
                setTimeout(() => {
                    trophyContainer.style.animation = '';
                }, 1500);
                
            } else if (progressPercentage < 100 && trophy.classList.contains('active')) {
                // Reset trophy state if progress goes below 100%
                trophy.classList.remove('active');
                
                // If timer somehow goes back below 100 after completion, reset segment marker
                if(lastCompletedSegment === 5) {
                    lastCompletedSegment = 4;
                    // Also reset the class
                    segmentClasses.forEach(cls => progressBar.classList.remove(cls));
                    progressBar.classList.add(segmentClasses[4]);
                }
            }
        }

        /**
         * Format date as YYYY-MM-DD
         * @param {Date} date - Date to format
         * @returns {string} Formatted date string
         */
        function formatDate(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        /**
         * Log study time to local storage, handling sessions that cross midnight
         * FIREBASE INTEGRATION: This function should be updated to:
         * 1. Save to Firestore user document under 'studyTime' collection
         * 2. Use localStorage as fallback when offline
         * 3. Sync localStorage data to Firebase when connection is restored
         * @param {number} durationSeconds - Study duration in seconds
         * @param {number} [startTime] - Optional start timestamp in milliseconds
         * @param {string} [dateStr] - Optional date string to log time for (default: today or calculated from startTime)
         */
        /**
         * Log study time to local storage, handling sessions that cross midnight
         * @param {number} durationSeconds - Study duration in seconds
         * @param {number} [startTime] - Optional start timestamp in milliseconds
         * @param {string} [dateStr] - Optional date string to log time for (default: today or calculated from startTime)
         */
        async function logStudyTime(durationSeconds, startTime) {
            if (durationSeconds <= 0) return;

            const start = startTime ? new Date(startTime) : new Date(Date.now() - durationSeconds * 1000);
            const end = new Date(start.getTime() + durationSeconds * 1000);

            // Get the currently active task
            const activeTask = selectedTask; // This is the global selectedTask variable

            // Get break data for this session
            const breakData = getBreakSummary();

            // Check if the session crosses midnight
            if (start.toDateString() !== end.toDateString()) {

                // Calculate time for the first day (from start time to midnight)
                const endOfFirstDay = new Date(start);
                endOfFirstDay.setHours(23, 59, 59, 999);
                const firstDaySeconds = (endOfFirstDay - start) / 1000;
                await logSingleDay(formatDate(start), firstDaySeconds, activeTask, breakData);

                // Calculate time for the second day (from midnight to end time)
                const startOfSecondDay = new Date(end);
                startOfSecondDay.setHours(0, 0, 0, 0);
                const secondDaySeconds = (end - startOfSecondDay) / 1000;
                if (secondDaySeconds > 0) {
                    await logSingleDay(formatDate(end), secondDaySeconds, activeTask, breakData);
                }
                    } else {
                // Session is on a single day, log normally with active task info and break data
                await logSingleDay(formatDate(start), durationSeconds, activeTask, breakData);
            }
        }

        /**
         * Helper function to write the study time for a single day to Firebase with localStorage fallback.
         * ENHANCED: Now includes task information and break data along with study time
         * FIREBASE INTEGRATION: Saves to Firestore with localStorage fallback
         * @param {string} dateStr - The date in "YYYY-MM-DD" format.
         * @param {number} seconds - The number of seconds to log for that day.
         * @param {Object|null} activeTask - The currently selected task (null if none selected)
         * @param {Object|null} breakData - Break tracking data for this session (null if no breaks)
         */
        async function logSingleDay(dateStr, seconds, activeTask = null, breakData = null) {
            if (seconds <= 0) return;

            // Get task information
            const taskInfo = activeTask ? {
                taskId: activeTask.id,
                taskName: activeTask.name,
                taskColor: activeTask.color,
                selectedAt: activeTask.selectedAt || new Date().toISOString()
            } : null;

            // Use Firebase data manager for atomic study time logging with task info and break data
            if (window.firebaseDataManager && firebaseDataManager.user) {
                try {
                    await firebaseDataManager.saveStudyTime(dateStr, seconds, taskInfo, breakData);
                    
                    // Dispatch custom event for real-time updates
                    document.dispatchEvent(new CustomEvent('studyTimeLogged', {
                        detail: { dateStr, hours: seconds/3600, task: taskInfo, breaks: breakData }
                    }));
                    return;
                } catch (error) {
                    console.warn('Failed to log to Firebase, falling back to localStorage:', error);
                }
            }
            
            // Fallback to localStorage with enhanced structure
            const hoursToAdd = parseFloat((seconds / 3600).toFixed(4));
            const studyDataKey = 'studyTime';
            let studyData = {};
            
            try {
                const existingData = localStorage.getItem(studyDataKey);
                if (existingData) {
                    studyData = JSON.parse(existingData);
                }
            } catch (error) {
                console.warn('Error parsing existing localStorage study data:', error);
                studyData = {};
            }

            // Enhanced data structure: support both old and new formats
            const existingDayData = studyData[dateStr];

            if (existingDayData && typeof existingDayData === 'object' && !Array.isArray(existingDayData)) {
                // Already using new format - add to existing task sessions
                if (!existingDayData.sessions) {
                    existingDayData.sessions = [];
                }

                // Add this study session with task info and break data
                existingDayData.sessions.push({
                    hours: hoursToAdd,
                    startTime: new Date().toISOString(),
                    task: taskInfo,
                    breaks: breakData || null
                });

                // Update total hours
                existingDayData.totalHours = (existingDayData.totalHours || 0) + hoursToAdd;
            } else {
                // Old format or new day - create new structure
                studyData[dateStr] = {
                    totalHours: (existingDayData || 0) + hoursToAdd,
                    sessions: [{
                        hours: hoursToAdd,
                        startTime: new Date().toISOString(),
                        task: taskInfo,
                        breaks: breakData || null
                    }]
                };
            }
            
            try {
                localStorage.setItem(studyDataKey, JSON.stringify(studyData));
                
                // Dispatch custom event for real-time updates
                document.dispatchEvent(new CustomEvent('studyTimeLogged', {
                    detail: { dateStr, hours: hoursToAdd, task: taskInfo, breaks: breakData }
                }));
            } catch (error) {
                console.error('Failed to save study time to localStorage:', error);
            }
        }
        




        /**
         * Detect whether plant mode (style 6) is currently active
         */
        function isPlantStyleActive() {
            try {
                // Prefer checking the DOM class applied by settings.js
                const container = document.querySelector('.timer-container');
                if (container && container.classList.contains('timer-style-6')) {
                    return true;
                }
                // Fallback: read settings stored by settings.js
                const settingsKey = window.firebaseDataManager && firebaseDataManager.user 
                    ? `TIMER_APP_SETTINGS_${firebaseDataManager.user.uid}` 
                    : 'TIMER_APP_SETTINGS';
                const settingsJson = localStorage.getItem(settingsKey);
                if (settingsJson) {
                    const settingsObj = JSON.parse(settingsJson);
                    const style = settingsObj?.timerStyle;
                    return style === '6' || style === 6;
                }
                // Legacy fallback (older key, if ever set)
                const legacy = localStorage.getItem('selectedTimerStyle');
                return legacy === '6';
            } catch (_) {
                return false;
            }
        }

        /**
         * Start timer with selected time
         */
        function startTimer() {
            if (timerIsRunning || isStopwatchMode) return;

            // Mark user interaction when starting timer
            unlockAudio();

            const selectedHours = parseInt(hoursSelect.value);
            const selectedMinutes = parseInt(minutesSelect.value);
            initialTotalSeconds = selectedHours * 3600 + selectedMinutes * 60;
            
            if (initialTotalSeconds <= 0) {
                timerIsRunning = false;
                // Properly reset the button state instead of just changing textContent
                startBtn.querySelector('.play-icon').style.display = 'block';
                startBtn.querySelector('.pause-icon').style.display = 'none';
                return;
            }
            
            // Only disable time picker if we're actually starting the timer
            if (typeof window.setTimePickerEnabled === 'function') {
                window.setTimePickerEnabled(false);
            }

            timerIsRunning = true;
            timerPaused = false;
            startBtn.querySelector('.play-icon').style.display = 'none';
            startBtn.querySelector('.pause-icon').style.display = 'block';

            remainingSeconds = initialTotalSeconds;
            startTime = Date.now();
            updateDisplay();
            lastCompletedSegment = -1; // Reset segment tracking on new timer start
            updateProgress(); // Initial progress update (sets 0% height and base color)

            timerInterval = setInterval(updateTimerState, 100);
            requestWakeLock();
            localStorage.setItem(STORAGE_KEYS.TIMER_IS_RUNNING, true);
            
            // Start image rotation when timer starts
            if (typeof startImageRotation === 'function') {
                startImageRotation();
            }
            
            // Initialize plant growth if style-6 is active
            if (isPlantStyleActive() && typeof initPlantGrowth === 'function' && (!plantGrowthState || !plantGrowthState.isActive)) {
                initPlantGrowth();
                // Update plant growth to initial state
                updatePlantGrowth(0, initialTotalSeconds);
                updateProgressBar(0);
            }
            localStorage.setItem(STORAGE_KEYS.TIMER_PAUSED, false);
            localStorage.setItem(STORAGE_KEYS.INITIAL_TOTAL_SECONDS, initialTotalSeconds);
            localStorage.setItem(STORAGE_KEYS.TIMER_START_TIME, startTime);
            localStorage.setItem(STORAGE_KEYS.START_BTN_TEXT, getStateFromButtonText(startBtn.textContent));
            localStorage.setItem(STORAGE_KEYS.SELECTED_HOURS, hoursSelect.value);
            localStorage.setItem(STORAGE_KEYS.SELECTED_MINUTES, minutesSelect.value);

            // Update button states when timer starts
            if (typeof window.updateButtonStates === 'function') {
                window.updateButtonStates();
            }
            
            // Dispatch event for health reminders
            document.dispatchEvent(new CustomEvent('timerStarted'));
        }

        /**
         * Update timer state - used by the interval
         */
        function updateTimerState() {
            if (timerIsRunning && !timerPaused) {
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                const newRemainingSeconds = initialTotalSeconds - elapsed;

                if (newRemainingSeconds <= 0) {
                    remainingSeconds = 0;
                    
                    // Check if Pomodoro mode is active. This prevents the Pomodoro "ghost"
                    // from interfering with a normal timer's completion.
                    if (typeof isPomodoroActive === 'function' && isPomodoroActive()) {
                        clearInterval(timerInterval); 
                    } else {
                        // This is a standard timer, so complete it normally.
                        completeTimer();
                    }
                } else {
                    if (newRemainingSeconds !== remainingSeconds) {
                        remainingSeconds = newRemainingSeconds;
                        updateDisplay();
                        updateProgress(); // Update progress bar
                        
                        // Update plant growth based on elapsed time
                        if (typeof updatePlantGrowth === 'function' && plantGrowthState?.isActive) {
                            updatePlantGrowth(elapsed, initialTotalSeconds);
                            updateProgressBar(elapsed / initialTotalSeconds);
                        }
                    }
                }

                checkForDateChange();
                
                // ADD THIS LINE
                lastActiveDate = getFormattedDate();
            }
        }
        
        /**
         * Actions to take when timer completes
         */
        async function completeTimer() {
             clearInterval(timerInterval);
             timerIsRunning = false;
             timerPaused = false;
             remainingSeconds = 0; // Ensure remainingSeconds is set to 0 first
             
             // Immediately update display to show 00:00:00
             updateDisplay();
             
             startBtn.querySelector('.pause-icon').style.display = 'none';
             startBtn.querySelector('.play-icon').style.display = 'block';
             
             // Close break tooltip immediately when timer completes
             if (breakQuitTooltipVisible) {
                 hideBreakTooltip();
             }
             
             // Re-enable time picker when timer completes
            if (typeof window.setTimePickerEnabled === 'function') {
                window.setTimePickerEnabled(true);
            }

            // Update button states when timer completes
            if (typeof window.updateButtonStates === 'function') {
                window.updateButtonStates();
            }
             if (initialTotalSeconds > 0) {
                 // Pass the start time to handle sessions crossing midnight
                 await logStudyTime(initialTotalSeconds, startTime);
             }
             
             // Ensure plant growth shows completion
             if (typeof updatePlantGrowth === 'function' && plantGrowthState?.isActive) {
                 // Force show the final stage
                 plantGrowthState.currentStage = plantGrowthState.totalStages;
                 updatePlantImage();
                 updateProgressBar(1);
             }
             
             updateProgress();
             releaseWakeLock();

             localStorage.setItem(STORAGE_KEYS.TIMER_IS_RUNNING, false);
             localStorage.setItem(STORAGE_KEYS.TIMER_PAUSED, false);
             localStorage.removeItem(STORAGE_KEYS.REMAINING_SECONDS);
             localStorage.removeItem(STORAGE_KEYS.TIMER_START_TIME);
             localStorage.removeItem(STORAGE_KEYS.INITIAL_TOTAL_SECONDS);
             
             // Dispatch event for health reminders
             document.dispatchEvent(new CustomEvent('timerCompleted'));
             
             // Check if Study Together session is active
             if (typeof window.handleStudyTogetherCompletion === 'function') {
                 window.handleStudyTogetherCompletion();
             }
        }

        /**
         * Start stopwatch
         */
        function startStopwatch() {
            if (stopwatchIsRunning || !isStopwatchMode) return;

            // Mark user interaction when starting stopwatch
            unlockAudio();

            stopwatchIsRunning = true;
            startBtn.querySelector('.play-icon').style.display = 'none';
            startBtn.querySelector('.pause-icon').style.display = 'block';
            stopwatchStartTime = Date.now() - stopwatchElapsedTime;
            updateDisplay();

            stopwatchInterval = setInterval(() => {
                if (stopwatchIsRunning) {
                    stopwatchElapsedTime = Date.now() - stopwatchStartTime;
                    if (isStopwatchMode) updateDisplay();
                    checkForDateChange();
                    
                    // ADD THIS LINE
                    lastActiveDate = getFormattedDate();
                }
            }, 100);

            requestWakeLock();
            localStorage.setItem(STORAGE_KEYS.STOPWATCH_IS_RUNNING, true);
            
            // Start image rotation when stopwatch starts
            if (typeof startImageRotation === 'function') {
                startImageRotation();
            }
            localStorage.setItem(STORAGE_KEYS.STOPWATCH_ELAPSED_TIME, stopwatchElapsedTime);

            // Update button states when stopwatch starts
            if (typeof window.updateButtonStates === 'function') {
                window.updateButtonStates();
            }
        }

        /**
         * Pause timer
         */
        function pauseTimer() {
            if (!timerIsRunning) return;
            clearInterval(timerInterval);
            timerIsRunning = false;
            timerPaused = true;
            startBtn.querySelector('.pause-icon').style.display = 'none';
            startBtn.querySelector('.play-icon').style.display = 'block';
            releaseWakeLock();

            localStorage.setItem(STORAGE_KEYS.REMAINING_SECONDS, remainingSeconds);
            localStorage.setItem(STORAGE_KEYS.TIMER_IS_RUNNING, false);
            localStorage.setItem(STORAGE_KEYS.TIMER_PAUSED, true);
            
            // Pause image rotation when timer pauses
            if (typeof pauseImageRotation === 'function') {
                pauseImageRotation();
            }
            
            // Dispatch event for health reminders
            document.dispatchEvent(new CustomEvent('timerPaused'));
        }

        /**
         * Resume timer
         */
        function resumeTimer() {
            if (!initialTotalSeconds || remainingSeconds <= 0 || timerIsRunning || isStopwatchMode) return;
            
            // Mark user interaction when resuming timer
            unlockAudio();
            
            timerIsRunning = true;
            timerPaused = false;
            startBtn.querySelector('.play-icon').style.display = 'none';
            startBtn.querySelector('.pause-icon').style.display = 'block';
            startTime = Date.now() - (initialTotalSeconds - remainingSeconds) * 1000;
            timerInterval = setInterval(updateTimerState, 100);
            requestWakeLock();
            localStorage.setItem(STORAGE_KEYS.TIMER_PAUSED, false);
            localStorage.setItem(STORAGE_KEYS.TIMER_IS_RUNNING, true);
            localStorage.setItem(STORAGE_KEYS.TIMER_START_TIME, startTime);
            
            // Dispatch event for health reminders
            document.dispatchEvent(new CustomEvent('timerResumed'));
        }

        /**
         * Stop stopwatch
         */
        function stopStopwatch() {
            if (!stopwatchIsRunning) return;

            clearInterval(stopwatchInterval);
            stopwatchIsRunning = false;


            if (isStopwatchMode) {
                startBtn.querySelector('.pause-icon').style.display = 'none';
                startBtn.querySelector('.play-icon').style.display = 'block';
            }

            releaseWakeLock();
            
            // Stop image rotation when stopwatch stops
            if (typeof stopImageRotation === 'function') {
                stopImageRotation();
            }

            localStorage.setItem(STORAGE_KEYS.STOPWATCH_IS_RUNNING, false);
            localStorage.setItem(STORAGE_KEYS.STOPWATCH_ELAPSED_TIME, stopwatchElapsedTime);

            // Update display to reset tab title
            updateDisplay();

            // Update button states when stopwatch stops
            if (typeof window.updateButtonStates === 'function') {
                window.updateButtonStates();
            }
        }

        /**
         * Reset timer or stopwatch based on visible mode
         */
        async function resetTimer() {
             if (isStopwatchMode) {
                 const wasRunning = stopwatchIsRunning;
                 clearInterval(stopwatchInterval);
                 stopwatchIsRunning = false;
                 const elapsedSecondsToLog = Math.floor(stopwatchElapsedTime / 1000);
                if (elapsedSecondsToLog > 0) {
                   // Pass the start time to handle sessions crossing midnight
                   const sessionStartTime = stopwatchStartTime || (Date.now() - stopwatchElapsedTime);
                   await logStudyTime(elapsedSecondsToLog, sessionStartTime);
                    // Reset stopwatch timer after logging for saving state
                    stopwatchElapsedTime = 0;
                    stopwatchStartTime = null;

                    localStorage.removeItem(STORAGE_KEYS.STOPWATCH_ELAPSED_TIME);
                    localStorage.removeItem(STORAGE_KEYS.STOPWATCH_START_TIME);
                    localStorage.setItem(STORAGE_KEYS.STOPWATCH_IS_RUNNING, false);

                    if (isStopwatchMode) {
                        startBtn.querySelector('.pause-icon').style.display = 'none';
                        startBtn.querySelector('.play-icon').style.display = 'block';
                        updateDisplay();
                    }
                 } else if (wasRunning) {
                 }
             } else {
                 const wasRunningOrPaused = timerIsRunning || timerPaused;
                 clearInterval(timerInterval);
                 timerIsRunning = false;
                 timerPaused = false;

                 if (wasRunningOrPaused && startTime && initialTotalSeconds > 0 && remainingSeconds !== undefined) {
                     const elapsed = Math.max(0, Math.min(
                         initialTotalSeconds,
                         Math.floor((Date.now() - startTime) / 1000)
                     )) - (initialTotalSeconds - remainingSeconds);
                     const elapsedSecondsToLog = initialTotalSeconds - remainingSeconds;

                     if (elapsedSecondsToLog > 0) {
                         // Pass the start time to handle sessions crossing midnight
                         await logStudyTime(elapsedSecondsToLog, startTime);
                     } else {
                     }
                     // Ensure the time picker selection is reset to 0:00 when resetting a running/paused timer
                     if (hoursSelect) hoursSelect.value = '0';
                     if (minutesSelect) minutesSelect.value = '0';
                     // Persist the reset selection
                     localStorage.setItem(STORAGE_KEYS.SELECTED_HOURS, '0');
                     localStorage.setItem(STORAGE_KEYS.SELECTED_MINUTES, '0');
                     // Update the visual time picker display and scroll columns back to top
                     const timeDisplay = document.getElementById('time-display');
                     if (timeDisplay) {
                         timeDisplay.textContent = '00:00';
                         timeDisplay.classList.add('value-changed');
                         setTimeout(() => timeDisplay.classList.remove('value-changed'), 400);
                         const hoursColumn = document.getElementById('hours-column');
                         const minutesColumn = document.getElementById('minutes-column');
                         if (hoursColumn && minutesColumn) {
                             hoursColumn.scrollTop = 0;
                             minutesColumn.scrollTop = 0;
                             const highlightEvent = new Event('scroll');
                             hoursColumn.dispatchEvent(highlightEvent);
                             minutesColumn.dispatchEvent(highlightEvent);
                         }
                     }
                     // If the custom picker is present, force it to sync with new selects
                     if (typeof window.syncTimePickerFromSelects === 'function') {
                         setTimeout(() => window.syncTimePickerFromSelects(), 0);
                     }
                  } else if (!wasRunningOrPaused) {
                       // Reset hour and minute selectors to zero when timer is in non-running state
                       hoursSelect.value = '0';
                       minutesSelect.value = '0';
                      // Persist the reset selection
                      localStorage.setItem(STORAGE_KEYS.SELECTED_HOURS, '0');
                      localStorage.setItem(STORAGE_KEYS.SELECTED_MINUTES, '0');
                       
                       // Update the time picker display to reflect the reset values
                       const timeDisplay = document.getElementById('time-display');
                       if (timeDisplay) {
                           timeDisplay.textContent = '00:00';
                           // Trigger a visual update effect
                           timeDisplay.classList.add('value-changed');
                           setTimeout(() => timeDisplay.classList.remove('value-changed'), 400);
                           
                           // Reset the scroll positions in the time picker columns to zero
                           const hoursColumn = document.getElementById('hours-column');
                           const minutesColumn = document.getElementById('minutes-column');
                           if (hoursColumn && minutesColumn) {
                               hoursColumn.scrollTop = 0;
                               minutesColumn.scrollTop = 0;
                               // Force the highlight update
                               const highlightEvent = new Event('scroll');
                               hoursColumn.dispatchEvent(highlightEvent);
                               minutesColumn.dispatchEvent(highlightEvent);
                           }
                       }
                       // If the custom picker is present, force it to sync with new selects
                       if (typeof window.syncTimePickerFromSelects === 'function') {
                           setTimeout(() => window.syncTimePickerFromSelects(), 0);
                       }
                  }

                 startTime = null;
                 remainingSeconds = 0;
                 
                 // Reset plant growth state if it exists
                 if (typeof resetPlantGrowth === 'function' && plantGrowthState) {
                     resetPlantGrowth();
                     updatePlantImage();
                     updateProgressBar(0);
                 }
                 initialTotalSeconds = 0;
                 localStorage.removeItem(STORAGE_KEYS.REMAINING_SECONDS);
                 localStorage.removeItem(STORAGE_KEYS.TIMER_START_TIME);
                 localStorage.removeItem(STORAGE_KEYS.INITIAL_TOTAL_SECONDS);
                 localStorage.removeItem(STORAGE_KEYS.TIMER_PAUSED);
                 localStorage.setItem(STORAGE_KEYS.TIMER_IS_RUNNING, false);
                 localStorage.setItem(STORAGE_KEYS.TIMER_PAUSED, false);
                 

                 if (!isStopwatchMode) {
                    startBtn.querySelector('.pause-icon').style.display = 'none';
                    startBtn.querySelector('.play-icon').style.display = 'block';
                    updateDisplay();
                    lastCompletedSegment = -1; // Reset segment tracking
                    updateProgress(); // Reset progress bar visuals

                    // Re-enable time picker
                    if (typeof window.setTimePickerEnabled === 'function') {
                        window.setTimePickerEnabled(true);
                    }
                 }
             }

             // Update button states when timer is reset
             if (typeof window.updateButtonStates === 'function') {
                 window.updateButtonStates();
             }

             // Reset break tracking for new session
             resetBreakTracking();

             releaseWakeLock();
             
             // Dispatch event for health reminders
             document.dispatchEvent(new CustomEvent('timerReset'));
         }

        /**
         * Toggle between timer and stopwatch modes - View Only
         */
        modeToggleBtn.addEventListener('click', () => {
            // Don't allow mode toggle when in Pomodoro mode
            if (typeof isPomodoroActive === 'function' && isPomodoroActive()) {
                return;
            }
            
            // Play mode switch sound
            const modeSwitchSound = new Audio('assets/audio/mode_switch.mp3');
            modeSwitchSound.volume = 0.6;
            modeSwitchSound.play().catch(e => console.log('Could not play mode switch sound:', e));
            
            isStopwatchMode = !isStopwatchMode;
            localStorage.setItem(STORAGE_KEYS.IS_STOPWATCH_MODE, isStopwatchMode);
            updateMode();
            
            // Update button states based on new mode
            if (typeof updateButtonStates === 'function') {
                updateButtonStates();
            }
            if (isStopwatchMode && stopwatchIsRunning) requestWakeLock();
            else if (!isStopwatchMode && (timerIsRunning || timerPaused)) requestWakeLock();
            else releaseWakeLock();
        });

        /**
         * Update UI based on current visible mode
         */
        function updateMode() {
            if (isStopwatchMode) {
                // Hide only the time display container, keep task selector visible
                const timeDisplayContainer = document.querySelector('.time-display-container');
                if (timeDisplayContainer) {
                    timeDisplayContainer.style.display = 'none';
                }
                progressContainer.style.display = 'none'; // Hide progress bar in stopwatch mode
                modeToggleBtn.classList.add('stopwatch-mode');
                startBtn.querySelector('.pause-icon').style.display = 'none';
                startBtn.querySelector('.play-icon').style.display = 'block';

                // Switch to stopwatch icon
                const timerIcon = modeToggleBtn.querySelector('.timer-icon');
                const stopwatchIcon = modeToggleBtn.querySelector('.stopwatch-icon');
                const tooltip = modeToggleBtn.querySelector('.btn-tooltip');
                if (timerIcon) timerIcon.style.display = 'none';
                if (stopwatchIcon) stopwatchIcon.style.display = 'block';
                if (tooltip) tooltip.textContent = 'Switch to Timer';
            } else {
                // Show the time display container in timer mode
                const timeDisplayContainer = document.querySelector('.time-display-container');
                if (timeDisplayContainer) {
                    timeDisplayContainer.style.display = 'block';
                }
                progressContainer.style.display = 'flex'; // Show progress bar in timer mode
                modeToggleBtn.classList.remove('stopwatch-mode');
                if (timerIsRunning) {
                    startBtn.querySelector('.play-icon').style.display = 'none';
                    startBtn.querySelector('.pause-icon').style.display = 'block';
                } else if (timerPaused) {
                    startBtn.querySelector('.pause-icon').style.display = 'none';
                    startBtn.querySelector('.play-icon').style.display = 'block';
                } else {
                    startBtn.querySelector('.pause-icon').style.display = 'none';
                    startBtn.querySelector('.play-icon').style.display = 'block';
                }
                updateProgress(); // Replace updateStars with updateProgress
                
                // Switch to timer icon
                const timerIcon = modeToggleBtn.querySelector('.timer-icon');
                const stopwatchIcon = modeToggleBtn.querySelector('.stopwatch-icon');
                const tooltip = modeToggleBtn.querySelector('.btn-tooltip');
                if (timerIcon) timerIcon.style.display = 'block';
                if (stopwatchIcon) stopwatchIcon.style.display = 'none';
                if (tooltip) tooltip.textContent = 'Switch to Stopwatch';
            }
            
            updateDisplay();
        }

        /**
         * Handle start/pause/resume/stop button click based on visible mode
         */
        startBtn.addEventListener('click', () => {
            // Check if Study Together mode is active and timer is running - prevent pause
            if (typeof window.isInStudyTogetherSession === 'function' && 
                window.isInStudyTogetherSession() && 
                timerIsRunning) {
                return;
            }
            
            // Check if we're in Pomodoro mode
            if (typeof isPomodoroActive === 'function' && isPomodoroActive()) {
                // Handle Pomodoro start/pause
                if (pomodoroInterval) {
                    pausePomodoro();
                } else {
                    startPomodoro();
                }
            } else if (isStopwatchMode) {
                if (stopwatchIsRunning) {
                    stopStopwatch();
                } else {
                    startStopwatch();
                }
            } else {
                if (timerIsRunning) {
                    pauseTimer();
                } else if (timerPaused) {
                    resumeTimer();
                } else {
                    startTimer();
                }
            }
        });

        // Break/Quit Tooltip State
        let breakQuitTooltipEl = null;
        let breakQuitTooltipVisible = false;
        let breakCountdownInterval = null;
        let breakEndAtMs = 0;
        let timerWasPausedBeforeBreak = false;
        let tooltipAutoCloseTimeout = null;

        // Break Tracking for Study Sessions
        let sessionBreakCount = 0;
        let sessionBreaks = [];
        let studyTimeBeforeCurrentBreak = 0;
        let currentBreakStartTime = null;

        function createBreakTooltip() {
            if (breakQuitTooltipEl) return breakQuitTooltipEl;
            const el = document.createElement('div');
            el.className = 'break-quit-tooltip';
            el.innerHTML = `
                <div class="break-tooltip-row">
                    <button type="button" class="break-btn" id="_breakBtn">
                        Break <div class="break-input-container">
                            <input type="number" id="_breakMin" class="break-min-input" min="1" max="60" value="5" aria-label="Break minutes">
                            <div class="break-arrow-btn" id="_breakUp">▲</div>
                            <div class="break-arrow-btn" id="_breakDown">▼</div>
                        </div>m
                    </button>
                    <button type="button" class="quit-btn" id="_quitBtn">QUIT</button>
                </div>
            `;
            document.body.appendChild(el);

            // Wire events
            const brBtn = el.querySelector('#_breakBtn');
            const brInput = el.querySelector('#_breakMin');
            const quitBtn = el.querySelector('#_quitBtn');
            const upBtn = el.querySelector('#_breakUp');
            const downBtn = el.querySelector('#_breakDown');

            brInput.addEventListener('click', e => e.stopPropagation());
            
            // Custom arrow buttons
            upBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                let v = parseInt(brInput.value || '1', 10);
                if (isNaN(v)) v = 1;
                v = Math.min(60, v + 1);
                brInput.value = String(v);
            });
            
            downBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                let v = parseInt(brInput.value || '1', 10);
                if (isNaN(v)) v = 1;
                v = Math.max(1, v - 1);
                brInput.value = String(v);
            });
            brInput.addEventListener('input', () => {
                let v = parseInt(brInput.value, 10);
                if (!isNaN(v)) {
                    v = Math.max(1, Math.min(60, v));
                    brInput.value = String(v);
                }
                // Allow empty input - don't auto-fill
            });

            brBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Check if in Study Together session - handle differently
                if (typeof window.isInStudyTogetherSession === 'function' && window.isInStudyTogetherSession()) {
                    hideBreakTooltip();
                    if (typeof window.handleStudyTogetherBreak === 'function') {
                        window.handleStudyTogetherBreak();
                    }
                    return;
                }
                
                const inputValue = brInput.value.trim();
                if (!inputValue) {
                    return; // Don't start break if no time is entered
                }
                const mins = Math.max(1, Math.min(60, parseInt(inputValue, 10)));
                if (isNaN(mins)) {
                    return; // Don't start break if invalid time
                }
                startBreak(mins);
            });

            quitBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Check if in Study Together session
                if (typeof window.isInStudyTogetherSession === 'function' && window.isInStudyTogetherSession()) {
                    hideBreakTooltip();
                    if (typeof window.handleStudyTogetherQuit === 'function') {
                        window.handleStudyTogetherQuit();
                    }
                    return;
                }
                
                // Clear any active break countdown
                if (breakCountdownInterval) {
                    clearInterval(breakCountdownInterval);
                    breakCountdownInterval = null;
                }
                
                // Log the break before resetting (if break was started)
                if (currentBreakStartTime) {
                    const actualBreakDurationMs = Date.now() - currentBreakStartTime.getTime();
                    const actualBreakDurationMinutes = Math.max(1, Math.floor(actualBreakDurationMs / 60000));
                    const actualBreakDurationSeconds = Math.floor(actualBreakDurationMs / 1000);
                    logBreakEnd(actualBreakDurationMinutes, actualBreakDurationSeconds);
                }
                
                clearBreakState();
                hideBreakTooltip();
                // Normal reset behavior in timer mode
                resetTimer();
                // Re-add outside click listener after QUIT
                setTimeout(() => {
                    document.addEventListener('click', handleOutsideClickOnce, { once: true });
                }, 100);
            });

            breakQuitTooltipEl = el;
            return el;
        }

        function positionBreakTooltip() {
            if (!breakQuitTooltipEl) return;
            const rect = resetBtn.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top; // place above
            breakQuitTooltipEl.style.left = `${x}px`;
            breakQuitTooltipEl.style.top = `${y - 50}px`;
            breakQuitTooltipEl.style.transform = 'translate(-50%, -10px)';
        }

        function showBreakTooltip() {
            // Clear any existing break state first
            if (breakCountdownInterval) {
                clearInterval(breakCountdownInterval);
                breakCountdownInterval = null;
            }
            clearBreakState();
            
            createBreakTooltip();
            positionBreakTooltip();
            breakQuitTooltipEl.classList.add('visible');
            breakQuitTooltipVisible = true;

            // Ensure fresh state
            resetBreakTooltipToFreshState();

            // Set auto-close timer (10 seconds if no break running)
            setTooltipAutoClose();

            // Close on outside click
            setTimeout(() => {
                document.addEventListener('click', handleOutsideClickOnce, { once: true });
                window.addEventListener('resize', positionBreakTooltip);
            }, 0);
        }

        function hideBreakTooltip() {
            if (!breakQuitTooltipEl) return;
            breakQuitTooltipEl.classList.remove('visible');
            breakQuitTooltipVisible = false;
            window.removeEventListener('resize', positionBreakTooltip);
            
            // Clear auto-close timer
            clearTooltipAutoClose();
            
            // Clear any active break countdown when hiding tooltip
            if (breakCountdownInterval) {
                clearInterval(breakCountdownInterval);
                breakCountdownInterval = null;
            }
        }

        function handleOutsideClickOnce(ev) {
            if (!breakQuitTooltipEl) return;
            // Don't close tooltip if break countdown is active
            if (breakCountdownInterval) {
                return;
            }
            if (!breakQuitTooltipEl.contains(ev.target) && ev.target !== resetBtn) {
                hideBreakTooltip();
            }
        }

        function shouldShowBreakTooltip() {
            const pomodoroActive = (typeof isPomodoroActive === 'function' && isPomodoroActive());
            return !isStopwatchMode && timerIsRunning && !pomodoroActive;
        }

        function saveBreakState() {
            try {
                const state = {
                    isOnBreak: !!breakCountdownInterval,
                    breakEndAtMs,
                    timerWasPausedBeforeBreak
                };
                localStorage.setItem('timerBreakState', JSON.stringify(state));
            } catch {}
        }

        function clearBreakState() {
            try { localStorage.removeItem('timerBreakState'); } catch {}
        }

        function clearTooltipAutoClose() {
            if (tooltipAutoCloseTimeout) {
                clearTimeout(tooltipAutoCloseTimeout);
                tooltipAutoCloseTimeout = null;
            }
        }

        function setTooltipAutoClose() {
            clearTooltipAutoClose();
            // Only auto-close if no break is running
            if (!breakCountdownInterval) {
                tooltipAutoCloseTimeout = setTimeout(() => {
                    hideBreakTooltip();
                }, 10000); // 10 seconds
            }
        }

        function resetBreakTooltipToFreshState() {
            if (!breakQuitTooltipEl) return;
            const container = breakQuitTooltipEl.querySelector('.break-tooltip-row');
            if (container) {
                container.innerHTML = `
                    <button type="button" class="break-btn" id="_breakBtn">
                        Break <div class="break-input-container">
                            <input type="number" id="_breakMin" class="break-min-input" min="1" max="60" value="5">
                            <div class="break-arrow-btn" id="_breakUp">▲</div>
                            <div class="break-arrow-btn" id="_breakDown">▼</div>
                        </div>m
                    </button>
                    <button type="button" class="quit-btn" id="_quitBtn">QUIT</button>
                `;
                // rebind events
                const brBtn = breakQuitTooltipEl.querySelector('#_breakBtn');
                const brInput = breakQuitTooltipEl.querySelector('#_breakMin');
                const quitBtn = breakQuitTooltipEl.querySelector('#_quitBtn');
                const upBtn = breakQuitTooltipEl.querySelector('#_breakUp');
                const downBtn = breakQuitTooltipEl.querySelector('#_breakDown');
                
                brInput.addEventListener('click', e => e.stopPropagation());
                
                // Custom arrow buttons
                upBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    let v = parseInt(brInput.value || '1', 10);
                    if (isNaN(v)) v = 1;
                    v = Math.min(60, v + 1);
                    brInput.value = String(v);
                });
                
                downBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    let v = parseInt(brInput.value || '1', 10);
                    if (isNaN(v)) v = 1;
                    v = Math.max(1, v - 1);
                    brInput.value = String(v);
                });
                brInput.addEventListener('input', () => {
                    let v = parseInt(brInput.value, 10);
                    if (!isNaN(v)) {
                        v = Math.max(1, Math.min(60, v));
                        brInput.value = String(v);
                    }
                    // Allow empty input - don't auto-fill
                });
                
                brBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    
                    // Check if in Study Together session - handle differently
                    if (typeof window.isInStudyTogetherSession === 'function' && window.isInStudyTogetherSession()) {
                        hideBreakTooltip();
                        if (typeof window.handleStudyTogetherBreak === 'function') {
                            window.handleStudyTogetherBreak();
                        }
                        return;
                    }
                    
                    const inputValue = brInput.value.trim();
                    if (!inputValue) {
                        return; // Don't start break if no time is entered
                    }
                    const mins = Math.max(1, Math.min(60, parseInt(inputValue, 10)));
                    if (isNaN(mins)) {
                        return; // Don't start break if invalid time
                    }
                    startBreak(mins);
                });
                
                quitBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    
                    // Check if in Study Together session
                    if (typeof window.isInStudyTogetherSession === 'function' && window.isInStudyTogetherSession()) {
                        hideBreakTooltip();
                        if (typeof window.handleStudyTogetherQuit === 'function') {
                            window.handleStudyTogetherQuit();
                        }
                        return;
                    }
                    
                    // Clear any active break countdown
                    if (breakCountdownInterval) {
                        clearInterval(breakCountdownInterval);
                        breakCountdownInterval = null;
                    }
                    
                    // Log the break before resetting (if break was started)
                    if (currentBreakStartTime) {
                        const actualBreakDurationMs = Date.now() - currentBreakStartTime.getTime();
                        const actualBreakDurationMinutes = Math.max(1, Math.floor(actualBreakDurationMs / 60000));
                        const actualBreakDurationSeconds = Math.floor(actualBreakDurationMs / 1000);
                        logBreakEnd(actualBreakDurationMinutes, actualBreakDurationSeconds);
                    }
                    
                    clearBreakState();
                    hideBreakTooltip();
                    resetTimer();
                    // Re-add outside click listener after QUIT
                    setTimeout(() => {
                        document.addEventListener('click', handleOutsideClickOnce, { once: true });
                    }, 100);
                });
            }
        }

        function updateBreakCountdownUI() {
            if (!breakQuitTooltipEl) return;
            const btn = breakQuitTooltipEl.querySelector('#_breakBtn');
            if (!btn) return;
            const remaining = Math.max(0, Math.floor((breakEndAtMs - Date.now()) / 1000));
            const m = Math.floor(remaining / 60);
            const s = remaining % 60;
            btn.classList.add('counting');
            btn.disabled = true;
            btn.innerHTML = `Break ${m}:${String(s).padStart(2,'0')}`;
        }

        function endBreak() {
            if (breakCountdownInterval) {
                clearInterval(breakCountdownInterval);
                breakCountdownInterval = null;
            }
            
            // Calculate actual break duration and log break end
            if (currentBreakStartTime) {
                const actualBreakDurationMs = Date.now() - currentBreakStartTime.getTime();
                const actualBreakDurationMinutes = Math.max(1, Math.floor(actualBreakDurationMs / 60000)); // Ensure at least 1 minute
                const actualBreakDurationSeconds = Math.floor(actualBreakDurationMs / 1000);
                logBreakEnd(actualBreakDurationMinutes, actualBreakDurationSeconds);
            }
            
            // Play sound at full volume
            try {
                const audio = new Audio('assets/sounds/item_delete.mp3');
                audio.volume = 1.0;
                audio.play().catch(()=>{});
            } catch {}

            // Resume timer automatically
            if (!timerIsRunning) {
                resumeTimer();
            }

            // Reset to fresh state
            resetBreakTooltipToFreshState();
            clearBreakState();
            
            // Re-add outside click listener after break ends
            setTimeout(() => {
                document.addEventListener('click', handleOutsideClickOnce, { once: true });
            }, 100);
        }

        function tickBreakCountdown() {
            const remaining = Math.floor((breakEndAtMs - Date.now()) / 1000);
            if (remaining <= 0) {
                endBreak();
                return;
            }
            updateBreakCountdownUI();
            saveBreakState();
        }

        function startBreak(minutes) {
            // Store timer state before break
            timerWasPausedBeforeBreak = timerPaused;
            if (timerIsRunning) {
                pauseTimer();
            }
            const now = Date.now();
            breakEndAtMs = now + minutes * 60 * 1000;
            updateBreakCountdownUI();
            if (breakCountdownInterval) clearInterval(breakCountdownInterval);
            breakCountdownInterval = setInterval(tickBreakCountdown, 1000);
            tickBreakCountdown();
            
            // Log break start for study session tracking
            logBreakStart(minutes);
            
            // Clear auto-close timer when break starts
            clearTooltipAutoClose();
            
            // Remove the outside click listener during break countdown
            document.removeEventListener('click', handleOutsideClickOnce);
        }

        function restoreBreakState() {
            try {
                const raw = localStorage.getItem('timerBreakState');
                if (!raw) return;
                const st = JSON.parse(raw);
                if (!st || !st.isOnBreak || !st.breakEndAtMs) return;
                const remaining = st.breakEndAtMs - Date.now();
                if (remaining <= 0) {
                    clearBreakState();
                    return;
                }
                timerWasPausedBeforeBreak = !!st.timerWasPausedBeforeBreak;
                breakEndAtMs = st.breakEndAtMs;
                showBreakTooltip();
                
                // Continue the existing break countdown, don't start a new one
                updateBreakCountdownUI();
                if (breakCountdownInterval) clearInterval(breakCountdownInterval);
                breakCountdownInterval = setInterval(tickBreakCountdown, 1000);
                tickBreakCountdown();
                
                // Clear auto-close timer for restored break
                clearTooltipAutoClose();
                
                // Remove outside click listener during restored break
                document.removeEventListener('click', handleOutsideClickOnce);
            } catch {}
        }

        // ========== BREAK TRACKING FUNCTIONS ==========
        
        /**
         * Log the start of a break during a study session
         * @param {number} breakDuration - Duration of the break in minutes
         */
        function logBreakStart(breakDuration) {
            if (!timerIsRunning && !timerPaused) {
                return;
            }

            sessionBreakCount++;
            currentBreakStartTime = new Date();
            
            // Calculate study time before this break
            if (startTime) {
                studyTimeBeforeCurrentBreak = Math.floor((currentBreakStartTime - startTime) / 1000);
            } else {
                studyTimeBeforeCurrentBreak = 0;
            }

        }

        /**
         * Log the end of a break during a study session
         * @param {number} breakDurationMinutes - Duration of the break in minutes (for display)
         * @param {number} breakDurationSeconds - Actual duration of the break in seconds (for accurate logging)
         */
        function logBreakEnd(breakDurationMinutes, breakDurationSeconds) {
            if (!currentBreakStartTime) {
                return;
            }

            const breakEndTime = new Date();

            const breakData = {
                breakNumber: sessionBreakCount,
                startTime: currentBreakStartTime.toISOString(),
                endTime: breakEndTime.toISOString(),
                duration: breakDurationSeconds, // Use actual seconds for accurate duration
                studyTimeBeforeBreak: studyTimeBeforeCurrentBreak,
                breakType: 'manual'
            };

            sessionBreaks.push(breakData);
            currentBreakStartTime = null;
            studyTimeBeforeCurrentBreak = 0;

        }

        /**
         * Get summary of all breaks taken in current session
         * @returns {Object} Break summary data
         */
        function getBreakSummary() {
            const totalBreakTime = sessionBreaks.reduce((total, breakData) => total + breakData.duration, 0);
            
            
            return {
                breakCount: sessionBreakCount,
                totalBreakTime: totalBreakTime,
                breaks: [...sessionBreaks] // Copy array to prevent mutation
            };
        }

        /**
         * Reset break tracking for new session
         */
        function resetBreakTracking() {
            sessionBreakCount = 0;
            sessionBreaks = [];
            studyTimeBeforeCurrentBreak = 0;
            currentBreakStartTime = null;
        }

        // Intercept Reset button for Timer mode running
        resetBtn.addEventListener('click', (ev) => {
            const pomodoroActive = (typeof isPomodoroActive === 'function' && isPomodoroActive());
            if (pomodoroActive) {
                resetPomodoro();
                return;
            }
            if (shouldShowBreakTooltip()) {
                ev.stopPropagation();
                ev.preventDefault();
                if (breakQuitTooltipVisible) {
                    hideBreakTooltip();
            } else {
                    showBreakTooltip();
            }
                return;
            }
            // default behavior
            resetTimer();
        });

        progressBtn.addEventListener('click', () => {
             // Show progress loading screen
             const progressLoader = document.getElementById('progress-loader');
             if (progressLoader) {
                 progressLoader.classList.add('show');
             }
             
             // Navigate to progress page after a short delay to show the loading animation
             setTimeout(() => {
            window.location.href = 'progress.html';
             }, 500);
        });

        // Add event listener for flashcards button
        document.getElementById('flashcards-btn').addEventListener('click', () => {
            // Show flashcards loading screen
            const flashcardsLoader = document.getElementById('flashcards-loader');
            if (flashcardsLoader) {
                flashcardsLoader.classList.add('show');
            }
            
            // Navigate to flashcards page after a short delay to show the loading animation
            setTimeout(() => {
            window.location.href = 'flashcards.html';
            }, 500);
        });

        // Add event listener for Study Quest button
        const studyQuestBtn = document.getElementById('study-quest-btn');
        if (studyQuestBtn) {
            studyQuestBtn.addEventListener('click', () => {
                // Check authentication
                if (typeof auth !== 'undefined' && auth && auth.currentUser) {
                    // User is authenticated, navigate to Study Quest
                    window.location.href = 'study-quest.html';
                } else {
                    // User is not authenticated, show toast
                    toast.warning('Please log in first to access Study Quest!');
                }
            });
        }

        // Add event listener for mocktest button
        const mocktestBtn = document.getElementById('mocktest-btn');
        if (mocktestBtn) {
            mocktestBtn.addEventListener('click', () => {
                window.location.href = 'Mocktest.html';
            });
        }

        // Ambient popup event listeners moved to js/ambient-sounds.js

        // Pomodoro button event listener - toggles Pomodoro mode
        pomodoroBtn.addEventListener('click', () => {
            // Play mode switch sound
            const modeSwitchSound = new Audio('assets/audio/mode_switch.mp3');
            modeSwitchSound.volume = 0.6;
            modeSwitchSound.play().catch(e => console.log('Could not play mode switch sound:', e));

            // Toggle Pomodoro mode
            togglePomodoroMode();
        });

        /**
         * Load saved state on page load
         */
        window.addEventListener('load', async () => {
            const loader = document.querySelector('.loader');
            
            try {
                // Initialize Firebase Data Manager
                if (typeof FirebaseDataManager !== 'undefined') {
                    window.firebaseDataManager = new FirebaseDataManager();
                    
                    // AUTH GATE: Wait for Firebase authentication to complete
                    await window.firebaseDataManager.authReady;
                    
                    // Listen for auth state changes to reload preferences
                    if (typeof auth !== 'undefined') {
                        auth.onAuthStateChanged(async (user) => {
                            if (!user) {
                                // User logged out - the FirebaseDataManager will handle clearing data
                                // Page will reload automatically for clean state
                            } else {
                                // User logged in - reload preferences from Firebase
                                await loadUserPreferencesFromFirebase();
                            }
                        });
                    }
                } else {
                    console.warn('FirebaseDataManager not available, using localStorage only');
                }

                
                // Try to unlock audio early (will succeed if user interacted during page load)
                setTimeout(() => {
                    if (!audioUnlocked) {
                        // Audio not unlocked yet - it will unlock on first user interaction
                    }
                }, 1000);
                
                // Initialize plant growth if the style is active
                if (typeof isPlantStyleActive === 'function' && isPlantStyleActive() && typeof initPlantGrowth === 'function') {
                    initPlantGrowth();

                    // Disable stopwatch and pomodoro buttons if plant mode is active
                    if (typeof disableTimerButtons === 'function') {
                        disableTimerButtons();
                    }
                }

                // Initialize button states based on current running state
                if (typeof window.updateButtonStates === 'function') {
                    window.updateButtonStates();
                }
                
                // Load timer state from localStorage
                const savedState = {
                        remainingSeconds: localStorage.getItem(STORAGE_KEYS.REMAINING_SECONDS),
                        timerIsRunning: localStorage.getItem(STORAGE_KEYS.TIMER_IS_RUNNING) === 'true',
                        stopwatchIsRunning: localStorage.getItem(STORAGE_KEYS.STOPWATCH_IS_RUNNING) === 'true',
                        startTime: localStorage.getItem(STORAGE_KEYS.TIMER_START_TIME),
                        initialTotalSeconds: localStorage.getItem(STORAGE_KEYS.INITIAL_TOTAL_SECONDS),
                        selectedHours: localStorage.getItem(STORAGE_KEYS.SELECTED_HOURS),
                        selectedMinutes: localStorage.getItem(STORAGE_KEYS.SELECTED_MINUTES),
                        isStopwatchMode: localStorage.getItem(STORAGE_KEYS.IS_STOPWATCH_MODE) === 'true',
                        stopwatchElapsedTime: localStorage.getItem(STORAGE_KEYS.STOPWATCH_ELAPSED_TIME),
                        stopwatchStartTime: localStorage.getItem(STORAGE_KEYS.STOPWATCH_START_TIME),
                        lastActiveDate: localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE_DATE),
                        timerPaused: localStorage.getItem(STORAGE_KEYS.TIMER_PAUSED) === 'true'
                    };

                lastActiveDate = savedState.lastActiveDate || getFormattedDate();
                const currentDate = getFormattedDate();
                let dateChanged = currentDate !== lastActiveDate;

                if (dateChanged) {
                    console.warn("Date has changed since last active session. Resetting running timers.");
                    savedState.timerIsRunning = false;
                    savedState.stopwatchIsRunning = false;
                    savedState.timerPaused = false;
                    lastActiveDate = currentDate;
                    localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE_DATE, currentDate);
                }

                    timerIsRunning = savedState.timerIsRunning;
                    stopwatchIsRunning = savedState.stopwatchIsRunning;
                    timerPaused = savedState.timerPaused && !timerIsRunning;
                isStopwatchMode = savedState.isStopwatchMode;

                if (savedState.selectedHours) hoursSelect.value = savedState.selectedHours;
                if (savedState.selectedMinutes) minutesSelect.value = savedState.selectedMinutes;

                initialTotalSeconds = savedState.initialTotalSeconds ? parseInt(savedState.initialTotalSeconds, 10) : 0;

                // =================== THE RECALCULATION FIX ===================
                    if (timerIsRunning) {
                    startTime = savedState.startTime ? parseInt(savedState.startTime, 10) : 0;
                    
                    if (startTime > 0 && initialTotalSeconds > 0) {
                        const elapsedSinceStart = Math.floor((Date.now() - startTime) / 1000);
                        const newRemaining = initialTotalSeconds - elapsedSinceStart;

                            if (newRemaining <= 0) {
                                remainingSeconds = 0;
                            await logStudyTime(initialTotalSeconds, startTime);
                            
                                timerIsRunning = false;
                                timerPaused = false;
                                localStorage.setItem(STORAGE_KEYS.TIMER_IS_RUNNING, false);
                                localStorage.setItem(STORAGE_KEYS.TIMER_PAUSED, false);
                                localStorage.removeItem(STORAGE_KEYS.REMAINING_SECONDS);
                            localStorage.removeItem(STORAGE_KEYS.TIMER_START_TIME);
                            localStorage.removeItem(STORAGE_KEYS.INITIAL_TOTAL_SECONDS);
                            startBtn.querySelector('.pause-icon').style.display = 'none';
                            startBtn.querySelector('.play-icon').style.display = 'block';

                            } else {
                                remainingSeconds = newRemaining;
                            
                            startBtn.querySelector('.play-icon').style.display = 'none';
                            startBtn.querySelector('.pause-icon').style.display = 'block';
                            
                                clearInterval(timerInterval);
                                timerInterval = setInterval(updateTimerState, 100);
                                if (!isStopwatchMode) requestWakeLock();
                            }
                        } else {
                        console.warn("Timer was running but start time or initial duration was missing. Resetting.");
                            timerIsRunning = false;
                    }
                } else if (timerPaused) {
                    remainingSeconds = savedState.remainingSeconds ? parseInt(savedState.remainingSeconds, 10) : 0;
                    startBtn.querySelector('.pause-icon').style.display = 'none';
                    startBtn.querySelector('.play-icon').style.display = 'block';
                    } else if (stopwatchIsRunning) {
                     stopwatchStartTime = savedState.stopwatchStartTime ? parseInt(savedState.stopwatchStartTime, 10) : 0;
                     if (stopwatchStartTime > 0) {
                            stopwatchElapsedTime = Date.now() - stopwatchStartTime;
                         
                         startBtn.querySelector('.play-icon').style.display = 'none';
                         startBtn.querySelector('.pause-icon').style.display = 'block';

                            clearInterval(stopwatchInterval);
                            stopwatchInterval = setInterval(() => {
                                if (stopwatchIsRunning) {
                                    stopwatchElapsedTime = Date.now() - stopwatchStartTime;
                                    if (isStopwatchMode) updateDisplay();
                                    checkForDateChange();
                                 
                                 // ADD THIS LINE
                                 lastActiveDate = getFormattedDate();
                                }
                            }, 100);
                            if (isStopwatchMode) requestWakeLock();
                        } else {
                            console.warn("Stopwatch was running but start time missing. Resetting state.");
                            stopwatchIsRunning = false;
                    }
                } else {
                    const selectedH = parseInt(hoursSelect.value || '0');
                    const selectedM = parseInt(minutesSelect.value || '0');
                    remainingSeconds = selectedH * 3600 + selectedM * 60;
                    initialTotalSeconds = remainingSeconds;
                    startBtn.querySelector('.pause-icon').style.display = 'none';
                    startBtn.querySelector('.play-icon').style.display = 'block';
                }
                // =================== END OF FIX ===================

                updateMode();
                updateDisplay();
                    updateProgress();
                
                // Ensure time picker state is properly set after state restoration
                if (typeof window.setTimePickerEnabled === 'function') {
                    window.setTimePickerEnabled(!timerIsRunning);
                } 

                // Load saved colors
                // FIREBASE INTEGRATION: Load user preferences from Firestore with localStorage fallback
                let savedQuoteColor = '#ffffff';
                if (window.firebaseDataManager && firebaseDataManager.user) {
                    try {
                        savedQuoteColor = await firebaseDataManager.loadUserPreference('quoteColor', '#ffffff');
                    } catch (error) {
                        console.warn('Failed to load quote color from Firebase, using user-specific localStorage:', error);
                        // Use user-specific localStorage key as fallback
                        const userKey = `pref_quoteColor_${firebaseDataManager.user.uid}`;
                        savedQuoteColor = localStorage.getItem(userKey) || '#ffffff';
                    }
                } else {
                    // For non-authenticated users, use global key
                    savedQuoteColor = localStorage.getItem(STORAGE_KEYS.QUOTE_COLOR) || '#ffffff';
                }
                
                if (savedQuoteColor) {
                    quoteColor = savedQuoteColor;
                    const quoteColorPicker = document.getElementById('quote-color-picker');
                    if (quoteColorPicker) {
                        quoteColorPicker.value = savedQuoteColor;
                        // Force update of color picker visual representation
                        updateColorPickerVisual(quoteColorPicker, savedQuoteColor);
                    }
                    if (quoteDisplay) {
                        quoteDisplay.style.color = savedQuoteColor;
                    }
                }
                
                // Load saved container background color and alpha
                // FIREBASE INTEGRATION: Load user preferences from Firestore with localStorage fallback
                let savedBaseColor = '#000000';
                let savedAlpha = 0.85;
                
                if (window.firebaseDataManager && firebaseDataManager.user) {
                    try {
                        savedBaseColor = await firebaseDataManager.loadUserPreference('timerContainerBaseColor', '#000000');
                        savedAlpha = await firebaseDataManager.loadUserPreference('timerContainerAlpha', 0.85);
                    } catch (error) {
                        console.warn('Failed to load container styling from Firebase, using user-specific localStorage:', error);
                        // Use user-specific localStorage keys as fallback
                        const userKey = `pref_timerContainerBaseColor_${firebaseDataManager.user.uid}`;
                        const alphaKey = `pref_timerContainerAlpha_${firebaseDataManager.user.uid}`;
                        savedBaseColor = localStorage.getItem(userKey) || '#000000';
                        savedAlpha = parseFloat(localStorage.getItem(alphaKey)) || 0.85;
                    }
                } else {
                    // For non-authenticated users, use global keys
                    savedBaseColor = localStorage.getItem(STORAGE_KEYS.TIMER_CONTAINER_BASE_COLOR_STRING) || '#000000';
                    savedAlpha = parseFloat(localStorage.getItem(STORAGE_KEYS.TIMER_CONTAINER_ALPHA)) || 0.85;
                }
                
                // Get DOM elements
                const containerBgColorPicker = document.getElementById('container-bg-color-picker');
                const timerOpacitySlider = document.getElementById('timer-opacity-slider');
                const timerOpacityValue = document.getElementById('timer-opacity-value');
                
                // Initialize base color
                if (savedBaseColor) {
                    G_timerContainerBaseColorString = savedBaseColor;
                    if (containerBgColorPicker) {
                        containerBgColorPicker.value = savedBaseColor;
                        // Force update of color picker visual representation
                        updateColorPickerVisual(containerBgColorPicker, savedBaseColor);
                    }
                } else if (containerBgColorPicker) {
                    G_timerContainerBaseColorString = containerBgColorPicker.value;
                }
                
                // Initialize alpha
                G_timerContainerAlpha = savedAlpha;
                    if (timerOpacitySlider) {
                        timerOpacitySlider.value = G_timerContainerAlpha;
                    }
                    if (timerOpacityValue) {
                        timerOpacityValue.textContent = Math.round(G_timerContainerAlpha * 100) + '%';
                }
                
                // Apply the styles
                G_applyTimerContainerBackgroundStyle();
                
                // Load saved digit color or use default
                // FIREBASE INTEGRATION: Load user preferences from Firestore with localStorage fallback
                let savedDigitColor = '#ffffff';
                if (window.firebaseDataManager && firebaseDataManager.user) {
                    try {
                        savedDigitColor = await firebaseDataManager.loadUserPreference('digitColor', '#ffffff');
                    } catch (error) {
                        console.warn('Failed to load digit color from Firebase, using user-specific localStorage:', error);
                        // Use user-specific localStorage key as fallback
                        const userKey = `pref_digitColor_${firebaseDataManager.user.uid}`;
                        savedDigitColor = localStorage.getItem(userKey) || '#ffffff';
                    }
                } else {
                    // For non-authenticated users, use global key
                    savedDigitColor = localStorage.getItem(STORAGE_KEYS.DIGIT_COLOR) || '#ffffff';
                }
                const colorToApply = savedDigitColor;

                digitColor = colorToApply;
                const digitColorPicker = document.getElementById('digit-color-picker');
                if (digitColorPicker) {
                    digitColorPicker.value = colorToApply;
                    // Force update of color picker visual representation
                    updateColorPickerVisual(digitColorPicker, colorToApply);
                }
                updateTimerDigitsColor(colorToApply);

                // Set up quote color picker event listener
                // FIREBASE INTEGRATION: Save user preferences to Firestore with localStorage fallback
                const quoteColorPicker = document.getElementById('quote-color-picker');
                if (quoteColorPicker) {
                    quoteColorPicker.addEventListener('input', (e) => {
                        quoteColor = e.target.value;
                        
                        // Update the quote display immediately for responsive UI
                        if (quoteDisplay) {
                            quoteDisplay.style.color = quoteColor;
                        }
                        
                        // Save to Firebase with debouncing to prevent excessive saves
                        debouncedFirebaseSave('quoteColor', quoteColor);
                    });
                }

                // Set up digit color picker event listener (reuse the same element reference)
                // FIREBASE INTEGRATION: Save user preferences to Firestore with localStorage fallback
                if (digitColorPicker) {
                    digitColorPicker.addEventListener('input', (e) => {
                        digitColor = e.target.value;
                        
                        // Update the display immediately for responsive UI
                        updateTimerDigitsColor(digitColor);
                        
                        // Save to Firebase with debouncing to prevent excessive saves
                        debouncedFirebaseSave('digitColor', digitColor);
                    });
                }
                
                // Set up container background color picker event listener
                // FIREBASE INTEGRATION: Save user preferences to Firestore with localStorage fallback
                if (containerBgColorPicker) {
                    const updateColor = (value) => {
                        G_timerContainerBaseColorString = value;
                        
                        // Update the display immediately for responsive UI
                        G_applyTimerContainerBackgroundStyle();
                        
                        // Save to Firebase with debouncing to prevent excessive saves
                        debouncedFirebaseSave('timerContainerBaseColor', G_timerContainerBaseColorString);
                    };
                    
                    containerBgColorPicker.addEventListener('input', (e) => {
                        updateColor(e.target.value);
                    });
                    
                    // Also handle change for color picker
                    containerBgColorPicker.addEventListener('change', (e) => {
                        updateColor(e.target.value);
                    });
                    
                    // Initialize the color picker
                    updateColor(containerBgColorPicker.value);
                }
                
                // Set up timer opacity slider event listener
                // FIREBASE INTEGRATION: Save user preferences to Firestore with localStorage fallback
                if (timerOpacitySlider && timerOpacityValue) {
                    const updateOpacity = (value) => {
                        G_timerContainerAlpha = parseFloat(value);
                        timerOpacityValue.textContent = Math.round(G_timerContainerAlpha * 100) + '%';
                        
                        // Update the display immediately for responsive UI
                        G_applyTimerContainerBackgroundStyle();
                        
                        // Save to Firebase with debouncing to prevent excessive saves
                        debouncedFirebaseSave('timerContainerAlpha', G_timerContainerAlpha);
                    };
                    
                    // Handle input for real-time updates
                    timerOpacitySlider.addEventListener('input', (e) => {
                        updateOpacity(e.target.value);
                    });
                    
                    // Also handle change for when slider is released
                    timerOpacitySlider.addEventListener('change', (e) => {
                        updateOpacity(e.target.value);
                    });
                    
                    // Initialize the display
                    updateOpacity(timerOpacitySlider.value);
                }
                
                // Load active quotes based on user settings, then initialize the quotes display
                loadActiveQuotes();
                initializeQuotes();
                // initializeAmbientPopup() moved to js/ambient-sounds.js
                initializeInactivityDetection(); // Initialize auto-hide
                // Background loading is now handled by background.js
                initializeControlBox(); // Initialize control box double-click
                initializeSettingsPopup();
                addFullscreenListeners();
        // Restore break state on load (if any)
        try { restoreBreakState(); } catch {}
        
        // Initialize timer size control
        const timerSizeSlider = document.getElementById('timer-size-slider');
        const timerSizeValue = document.getElementById('timer-size-value');
        const timerContainer = document.querySelector('.timer-container');
        
        // Load saved size or use default (100%)
        // FIREBASE INTEGRATION: Load user preferences from Firestore with localStorage fallback
        let savedSize = 100;
        if (window.firebaseDataManager && firebaseDataManager.user) {
            try {
                savedSize = await firebaseDataManager.loadUserPreference('timerSize', 100);
            } catch (error) {
                console.warn('Failed to load timer size from Firebase, using localStorage:', error);
                savedSize = parseInt(localStorage.getItem('timerSize')) || 100;
            }
        } else {
            savedSize = parseInt(localStorage.getItem('timerSize')) || 100;
        }
        
        timerSizeSlider.value = savedSize;
        timerSizeValue.textContent = savedSize + '%';
        updateTimerSize(parseInt(savedSize));
        
        // Update size when slider changes
        // FIREBASE INTEGRATION: Save user preferences to Firestore with localStorage fallback
        timerSizeSlider.addEventListener('input', function() {
            const size = parseInt(this.value);
            timerSizeValue.textContent = size + '%';
            updateTimerSize(size);
            
            // Save to Firebase with localStorage fallback
            if (window.firebaseDataManager && firebaseDataManager.user) {
                try {
                    firebaseDataManager.saveUserPreference('timerSize', size);
                } catch (error) {
                    console.warn('Failed to save timer size to Firebase, using localStorage:', error);
            localStorage.setItem('timerSize', size);
                }
            } else {
                localStorage.setItem('timerSize', size);
            }
        });
        
        // updateTimerSize function now defined globally at top of file
                
                // Load Pomodoro state if the function exists
                if (typeof loadPomodoroState === 'function') {
                    await loadPomodoroState();
                }

                // Update button states based on restored mode
                if (typeof updateButtonStates === 'function') {
                    updateButtonStates();
                }


            } catch (error) {
                console.error('Error loading timer state:', error);
                timerIsRunning = false;
                stopwatchIsRunning = false;
                isStopwatchMode = false;
                timerPaused = false;
                stopwatchElapsedTime = 0;
                remainingSeconds = 0;
                initialTotalSeconds = 0;
                clearInterval(timerInterval);
                clearInterval(stopwatchInterval);
                updateMode();
                initializeQuotes();
                // initializeAmbientPopup() moved to js/ambient-sounds.js
            } finally {
                // AUTH-GATED LOADER: Hide loader only after all settings are applied
                if (loader) {
                    setTimeout(function() {
                        loader.style.transition = 'opacity 0.5s ease';
                        loader.style.opacity = '0';
                        setTimeout(function() {
                            loader.style.display = 'none';
                        }, 500);
                    }, 100); // Short delay to ensure rendering is complete
                }
            }
        });

        let currentQuoteIndex = 0;
        let quoteInterval;
        function displayQuote() {
            if (!quoteDisplay) return;
            if (activeQuotesArray.length === 0) return;
            
            // Start fade out
            quoteDisplay.style.transition = 'opacity 0.6s ease-in-out, color 0.3s ease';
            quoteDisplay.style.opacity = 0;
            
            // After fade out, change text and fade in
            setTimeout(() => {
                quoteDisplay.textContent = activeQuotesArray[currentQuoteIndex];
                quoteDisplay.style.color = quoteColor;
                
                // Force reflow to ensure the new text is rendered before fading in
                void quoteDisplay.offsetHeight;
                
                // Fade in with a slight delay to ensure smooth transition
                setTimeout(() => {
                    quoteDisplay.style.opacity = 1;
                }, 50);
                
                currentQuoteIndex = (currentQuoteIndex + 1) % activeQuotesArray.length;
            }, 600); // Start changing text before opacity reaches 0 for smoother transition
        };
        function initializeQuotes() {
            if (!quoteDisplay) return;
            
            // Load active quotes if not already loaded
            if (activeQuotesArray.length === 0) {
                loadActiveQuotes();
            }
            
            // If still no quotes (might happen if personal quotes are empty), return
            if (activeQuotesArray.length === 0) {
                console.warn('No quotes available to display');
                return;
            }
            
            // Display the first quote with the saved color
            quoteDisplay.textContent = activeQuotesArray[0];
            quoteDisplay.style.transition = 'color 0.3s ease';
            quoteDisplay.style.color = quoteColor;
            quoteDisplay.style.opacity = 1;
            currentQuoteIndex = 1 % activeQuotesArray.length;
            
            // Clear previous interval if exists
            clearInterval(quoteInterval);
            
            // Set new interval for quote rotation
            quoteInterval = setInterval(displayQuote, 60000);
        };

        // ========== Video Background Logic - DISABLED (Coming Soon) ==========
        // Video background functionality has been temporarily disabled
        
        /**
         * Load available video wallpapers
         */
        async function loadVideoWallpapers() {
            // Live wallpapers are temporarily disabled
        }


        /**
         * Create a video wallpaper item element
         * @param {string} videoPath - Path to the video file
         * @param {number} index - Wallpaper index for display
         * @returns {HTMLElement} - The created video item element
         */
        function createVideoWallpaperItem(videoPath, index) {
            const videoItem = document.createElement('div');
            videoItem.className = 'live-wallpaper-item';
            videoItem.setAttribute('data-video', videoPath);
            videoItem.title = `Wallpaper ${index}`;
            
            const video = document.createElement('video');
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            video.preload = 'metadata';
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.objectFit = 'cover';
            
            const source = document.createElement('source');
            source.src = videoPath;
            source.type = 'video/mp4';
            
            video.appendChild(source);
            videoItem.appendChild(video);
            
            const span = document.createElement('span');
            span.textContent = `Wallpaper ${index}`;
            span.style.position = 'absolute';
            span.style.bottom = '5px';
            span.style.left = '5px';
            span.style.color = 'white';
            span.style.fontSize = '12px';
            span.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
            videoItem.appendChild(span);
            
            return videoItem;
        }
        
        /**
         * Setup event listeners for a video item
         * @param {HTMLElement} videoItem - The video item element
         */
        function setupVideoItem(videoItem) {
            const video = videoItem.querySelector('video');
            
            // Add hover effects for preview
            videoItem.addEventListener('mouseenter', () => {
                if (video && video.paused) {
                    video.play().catch(e => console.warn('Preview play failed:', e));
                }
            });
            
            videoItem.addEventListener('mouseleave', () => {
                if (video && !video.paused) {
                    video.pause();
                    video.currentTime = 0;
                }
            });
            
            // Handle click to set as background
            videoItem.addEventListener('click', (e) => {
                e.preventDefault();
                const videoSrc = videoItem.getAttribute('data-video');
                if (videoSrc) {
                    // Live wallpapers are disabled - show coming soon message
                }
            });
        }
        
        // Background functions moved to background.js - using BackgroundManager class
        
        // Background loading functions moved to background.js (video functionality disabled)

        // Initialize the app when the DOM is fully loaded
        document.addEventListener('DOMContentLoaded', () => {
            // Live wallpapers are temporarily disabled
            
            // Background functionality now handled by BackgroundManager in background.js
        });
        
        // Background management now handled by BackgroundManager in background.js
        
        
        // ========== Rotating Images Logic ==========
        let imageInterval;
        let currentImageScale = 1.0; // Track image scale
        let imageScaleClicks = 0; // Count double-clicks
        let isDragging = false; // Track if the user is dragging the image
        let dragStartX, dragStartY; // Starting positions for the drag operation
        let containerStartX, containerStartY; // Starting container position
        
        // rotateImages function is now defined in settings.js - removed from here to avoid conflicts
        
        /**
         * Apply the specified size to all rotating images
         * @param {number} size - The size in pixels
         */
        function applyImageSize(size) {
            // Get all rotating images and apply the size
            const images = document.querySelectorAll('.rotating-image');
            images.forEach(img => {
                img.style.maxWidth = size + 'px';
                img.style.maxHeight = size + 'px';
            });
        }

;
        
        // NOTE: The rotating images settings functionality has been moved to settings.js
        
        
        // Handle the start of dragging
        function handleDragStart(event) {
            event.preventDefault();
            
            // Check if position is locked via settings
            const isPositionLocked = localStorage.getItem(STORAGE_KEYS.ROTATING_IMAGE_POSITION_LOCKED) === 'true';
            if (isPositionLocked) return;
            
            // Only handle primary button (left-click)
            if (event.button !== 0) return;
            
            isDragging = true;
            const imageContainer = document.getElementById('rotating-images');
            
            // Get current position
            const style = window.getComputedStyle(imageContainer);
            containerStartX = parseInt(style.left) || 0;
            containerStartY = parseInt(style.top) || 0;
            
            // Record start position of mouse
            dragStartX = event.clientX;
            dragStartY = event.clientY;
            
            resetInactivityTimer(); // Reset inactivity timer
        };
        
        // Handle drag movement
        function handleDragMove(event) {
            if (!isDragging) return;
            
            event.preventDefault();
            const imageContainer = document.getElementById('rotating-images');
            
            // Calculate new position based on mouse movement
            const newX = containerStartX + (event.clientX - dragStartX);
            const newY = containerStartY + (event.clientY - dragStartY);
            
            // Apply new position
            imageContainer.style.left = `${newX}px`;
            imageContainer.style.top = `${newY}px`;
        };
        
        // Handle end of dragging
        function handleDragEnd(event) {
            if (!isDragging) return;
            
            isDragging = false;
            resetInactivityTimer(); // Reset inactivity timer
        };
        
        // Touch event handlers for mobile support
        function handleTouchStart(event) {
            // Check if position is locked via settings
            const isPositionLocked = localStorage.getItem(STORAGE_KEYS.ROTATING_IMAGE_POSITION_LOCKED) === 'true';
            if (isPositionLocked) return;
            
            if (event.touches.length !== 1) return;
            
            event.preventDefault(); // Prevent scrolling while dragging
            
            const touch = event.touches[0];
            
            isDragging = true;
            const imageContainer = document.getElementById('rotating-images');
            
            // Get current position
            const style = window.getComputedStyle(imageContainer);
            containerStartX = parseInt(style.left) || 0;
            containerStartY = parseInt(style.top) || 0;
            
            // Record start position of touch
            dragStartX = touch.clientX;
            dragStartY = touch.clientY;
            
            resetInactivityTimer(); // Reset inactivity timer
        };
        
        function handleTouchMove(event) {
            if (!isDragging || event.touches.length !== 1) return;
            
            event.preventDefault(); // Prevent scrolling while dragging
            
            const touch = event.touches[0];
            const imageContainer = document.getElementById('rotating-images');
            
            // Calculate new position based on touch movement
            const newX = containerStartX + (touch.clientX - dragStartX);
            const newY = containerStartY + (touch.clientY - dragStartY);
            
            // Apply new position
            imageContainer.style.left = `${newX}px`;
            imageContainer.style.top = `${newY}px`;
        };
        
        function handleTouchEnd(event) {
            isDragging = false;
            resetInactivityTimer(); // Reset inactivity timer
        };

        // ========== Control Box Size Toggle Logic ==========
        let controlBoxScaleClicks = 0;
        
        function handleControlBoxDoubleClick(event) {
            // Prevent default double-click behavior
            event.preventDefault();
            
            // Cycle through 3 states: original → slightly larger → even larger → back to original
            controlBoxScaleClicks = (controlBoxScaleClicks + 1) % 3;
            
            switch(controlBoxScaleClicks) {
                case 0: // Back to original
                    this.style.transform = 'scale(1.0)';
                    break;
                case 1: // First increase
                    this.style.transform = 'scale(1.25)';
                    break;
                case 2: // Second increase
                    this.style.transform = 'scale(1.5)';
                    break;
            }
            
            resetInactivityTimer(); // Reset inactivity timer when interacting with control box
        };

        function initializeControlBox() {
            // Create the control box if it doesn't exist
            let controlBox = document.querySelector('.control-box');
            if (!controlBox) {
                controlBox = document.createElement('div');
                controlBox.className = 'control-box';
                controlBox.style.position = 'absolute';
                controlBox.style.top = '20px';
                controlBox.style.right = '20px';
                controlBox.style.width = '40px';
                controlBox.style.height = '40px';
                controlBox.style.zIndex = '50';
                controlBox.style.cursor = 'pointer';
                document.body.appendChild(controlBox);
            }
            
            controlBox.addEventListener('dblclick', handleControlBoxDoubleClick);
        };

        function initializeSettingsPopup() {
            const settingsPopup = document.getElementById('settings-popup');
            const settingsBtn = document.getElementById('settings-btn');
            const closeSettingsBtn = settingsPopup.querySelector('.close-popup-btn');
            
            if (!settingsPopup || !settingsBtn || !closeSettingsBtn) {
                console.error("Settings popup elements not found!");
                return;
            }
            
            // Open settings popup when button is clicked
            settingsBtn.addEventListener('click', () => {
                settingsPopup.style.display = 'block';
                resetInactivityTimer();
                
                // Keep all settings content initially hidden
                document.querySelectorAll('.settings-content').forEach(content => {
                    content.style.display = 'none';
                });
                document.querySelectorAll('.settings-header').forEach(header => {
                    header.classList.remove('settings-header-active');
                });
            });
            
            // Close settings popup when close button is clicked
            closeSettingsBtn.addEventListener('click', () => {
                settingsPopup.style.display = 'none';
                resetInactivityTimer();
            });
            
            // Close settings popup when clicking outside it
            document.addEventListener('click', (event) => {
                if (event.target !== settingsPopup && 
                    !settingsPopup.contains(event.target) && 
                    event.target !== settingsBtn && 
                    !settingsBtn.contains(event.target) &&
                    settingsPopup.style.display === 'block') {
                    settingsPopup.style.display = 'none';
                }
            });
        }

        // Full screen functionality
        function addFullscreenListeners() {
            const fullscreenBtn = document.getElementById('fullscreen-btn');
            const fullscreenIcon = fullscreenBtn?.querySelector('svg');
            const tooltip = fullscreenBtn?.querySelector('.btn-tooltip');
            
            if (fullscreenBtn && fullscreenIcon && tooltip) {
                fullscreenBtn.addEventListener('click', toggleFullscreen);
                
                // Update button state when fullscreen changes
                document.addEventListener('fullscreenchange', updateFullscreenButton);
                document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
                document.addEventListener('mozfullscreenchange', updateFullscreenButton);
                document.addEventListener('MSFullscreenChange', updateFullscreenButton);
                
                // Initial state
                updateFullscreenButton();
            }
        }

        function toggleFullscreen() {
            if (!document.fullscreenElement && 
                !document.webkitFullscreenElement && 
                !document.mozFullScreenElement && 
                !document.msFullscreenElement) {
                // Enter fullscreen
                if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen();
                } else if (document.documentElement.webkitRequestFullscreen) {
                    document.documentElement.webkitRequestFullscreen();
                } else if (document.documentElement.mozRequestFullScreen) {
                    document.documentElement.mozRequestFullScreen();
                } else if (document.documentElement.msRequestFullscreen) {
                    document.documentElement.msRequestFullscreen();
                }
            } else {
                // Exit fullscreen
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
            }
        }

        function updateFullscreenButton() {
            const fullscreenBtn = document.getElementById('fullscreen-btn');
            const fullscreenIcon = fullscreenBtn?.querySelector('svg');
            const tooltip = fullscreenBtn?.querySelector('.btn-tooltip');
            
            if (!fullscreenBtn || !fullscreenIcon || !tooltip) return;
            
            const isFullscreen = !!(document.fullscreenElement || 
                                   document.webkitFullscreenElement || 
                                   document.mozFullScreenElement || 
                                   document.msFullscreenElement);
            
            if (isFullscreen) {
                // Show exit fullscreen icon
                fullscreenIcon.innerHTML = `
                    <defs>
                        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>
                            <feMerge>
                                <feMergeNode in="blur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                    </defs>

                    <!-- Background circle -->
                    <circle cx="50" cy="50" r="45" fill="none" stroke="magenta" stroke-width="2" filter="url(#glow)" />

                    <!-- Inward arrows (collapse fullscreen) -->
                    <path d="M20 30 L35 30 L35 20" stroke="magenta" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
                    <path d="M80 30 L65 30 L65 20" stroke="magenta" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
                    <path d="M20 70 L35 70 L35 80" stroke="magenta" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
                    <path d="M80 70 L65 70 L65 80" stroke="magenta" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
                `;
                tooltip.textContent = 'Exit Full Screen';
            } else {
                // Show enter fullscreen icon
                fullscreenIcon.innerHTML = `
                    <defs>
                        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur"/>
                            <feMerge>
                                <feMergeNode in="blur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                    </defs>
                    
                    <!-- Background circle -->
                    <circle cx="50" cy="50" r="45" fill="none" stroke="cyan" stroke-width="2" filter="url(#glow)" />

                    <!-- Fullscreen corners -->
                    <path d="M20 35 V20 H35" stroke="cyan" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
                    <path d="M80 35 V20 H65" stroke="cyan" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
                    <path d="M20 65 V80 H35" stroke="cyan" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
                    <path d="M80 65 V80 H65" stroke="cyan" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
                `;
                tooltip.textContent = 'Full Screen';
            }
        }
        
        // AMBIENT SOUNDS FUNCTIONALITY MOVED TO js/ambient-sounds.js
        function initializeAmbientPopup() {
             return; // Early return to prevent execution
             const popupContainer = document.getElementById('ambient-popup');
             if (!popupContainer) {
                 console.error("Ambient popup container not found!");
                 return;
             }

             const soundItems = popupContainer.querySelectorAll('.sound-item');
             const combinationNameInput = popupContainer.querySelector('#popup-combinationName');
             const saveCombinationBtn = popupContainer.querySelector('#popup-saveCombinationBtn');
             const savedCombinationsList = popupContainer.querySelector('#popup-savedCombinationsList');
             const masterPlayPauseBtn = popupContainer.querySelector('#popup-masterPlayPauseBtn');
             const resetAllBtn = popupContainer.querySelector('#popup-resetAllBtn');
             const AMBIENT_STORAGE_KEY = STORAGE_KEYS.AMBIENT_COMBINATIONS;

             if (!soundItems.length || !combinationNameInput || !saveCombinationBtn || !savedCombinationsList || !masterPlayPauseBtn || !resetAllBtn) {
                 console.error("One or more ambient sound popup elements are missing!");
                 return;
             }

             let popupAudioContextStarted = false;

             // Reset all sliders explicitly on initialization to ensure they're at zero
             function resetAllSliders() {
                 soundItems.forEach(item => {
                     const slider = item.querySelector('.volume-slider');
                     const audio = item.querySelector('audio');
                     if (slider && audio) {
                         slider.value = 0;
                         audio.volume = 0;
                         audio.pause();
                     }
                 });
                 popupUpdateMasterButtonState(false);
             }

             // Initialize sliders when popup opens
             ambientPopupBtn.addEventListener('click', () => {
                 const isVisible = ambientPopup.style.display === 'block';
                 if (isVisible) {
                     // If opening the popup, ensure sliders are properly initialized
                     soundItems.forEach(item => {
                         const slider = item.querySelector('.volume-slider');
                         const audio = item.querySelector('audio');
                         if (slider && audio) {
                             // Ensure slider and audio volume match
                             slider.value = audio.volume;
                         }
                     });
                 }
             });

             function popupActivateAudioContextIfNeeded() {
                 if (!popupAudioContextStarted) {
                     let needsActivation = false;
                     soundItems.forEach(item => {
                         const audio = item.querySelector('audio');
                         if (audio && !audio.paused && audio.volume > 0) {
                              needsActivation = true;
                         }
                     });

                    if (needsActivation) {
                         try {
                             soundItems.forEach(item => {
                                 const audio = item.querySelector('audio');
                                 if (audio && audio.paused && audio.volume > 0) {
                                     audio.play().catch(e => console.warn(`Popup initial play failed for ${item.dataset.sound}:`, e));
                                 }
                             });
                             popupAudioContextStarted = true;
                         } catch (e) {
                             console.error("Error activating popup audio context:", e);
                         }
                    }
                 }
             }
             popupContainer.addEventListener('click', popupActivateAudioContextIfNeeded, { once: true });
             popupContainer.addEventListener('touchstart', popupActivateAudioContextIfNeeded, { once: true });

             function popupUpdateMasterButtonState(forceState = null) {
                 let isAnySoundPlaying = false;
                 if (forceState !== null) {
                     isAnySoundPlaying = forceState;
                 } else {
                     soundItems.forEach(item => {
                         const audio = item.querySelector('audio');
                         const slider = item.querySelector('.volume-slider');
                          if (audio && slider && parseFloat(slider.value) > 0) {
                              isAnySoundPlaying = true;
                         }
                     });
                 }

                 if (isAnySoundPlaying) {
                     masterPlayPauseBtn.textContent = 'Pause All';
                     masterPlayPauseBtn.dataset.playing = 'true';
                 } else {
                     masterPlayPauseBtn.textContent = 'Play All';
                     masterPlayPauseBtn.dataset.playing = 'false';
                 }
             }

             soundItems.forEach(item => {
                 const slider = item.querySelector('.volume-slider');
                 const audio = item.querySelector('audio');
                 const soundName = item.dataset.sound;

                 if (!slider || !audio || !soundName) {
                     console.error('Missing elements for sound item:', item);
                     return;
                 }

                 // Explicitly set initial values
                 slider.value = 0;
                 audio.volume = 0;
                 audio.pause();
                 audio.load();

                 slider.addEventListener('input', (event) => {
                     const volume = parseFloat(event.target.value);
                     audio.volume = volume;

                     if (volume > 0 && audio.paused) {
                         popupActivateAudioContextIfNeeded();
                         audio.play().catch(error => {
                             console.warn(`Popup audio play prevented for ${soundName}:`, error);
                         });
                     } else if (volume === 0 && !audio.paused) {
                         audio.pause();
                     }
                     popupUpdateMasterButtonState();
                 });

                  audio.onpause = () => {
                      if (audio.volume > 0 && !audio.ended) {
                      }
                       popupUpdateMasterButtonState();
                  };
                  audio.onplay = () => {
                      popupUpdateMasterButtonState();
                  };
             });

             masterPlayPauseBtn.addEventListener('click', () => {
                  const isPlaying = masterPlayPauseBtn.dataset.playing === 'true';
                  popupActivateAudioContextIfNeeded();

                 if (isPlaying) {
                     soundItems.forEach(item => {
                         const audio = item.querySelector('audio');
                         audio.pause();
                     });
                     popupUpdateMasterButtonState(false);
                  } else {
                      let soundPlayed = false;
                      soundItems.forEach(item => {
                          const audio = item.querySelector('audio');
                          const slider = item.querySelector('.volume-slider');
                          if (audio && slider && parseFloat(slider.value) > 0) {
                              audio.play().catch(e => console.warn(`Popup master play prevented for ${item.dataset.sound}:`, e));
                               soundPlayed = true;
                          }
                      });
                      popupUpdateMasterButtonState(soundPlayed);
                  }
              });

              resetAllBtn.addEventListener('click', () => {
                  resetAllSliders();
              });

              function popupGetCurrentSettings() {
                  const settings = {};
                  soundItems.forEach(item => {
                      const soundName = item.dataset.sound;
                      const slider = item.querySelector('.volume-slider');
                      if (soundName && slider) {
                          settings[soundName] = parseFloat(slider.value);
                      }
                  });
                  return settings;
              }

              function popupApplySettings(settings) {
                  let playAttempted = false;
                  soundItems.forEach(item => {
                      const soundName = item.dataset.sound;
                      const slider = item.querySelector('.volume-slider');
                      const audio = item.querySelector('audio');
                      if (soundName && slider && audio && settings.hasOwnProperty(soundName)) {
                          const volume = parseFloat(settings[soundName]);
                          slider.value = volume;
                          audio.volume = volume;

                          if (volume > 0 && audio.paused) {
                              audio.play().catch(e => console.warn(`Popup autoplay prevented on load for ${soundName}:`, e));
                              playAttempted = true;
                          } else if (volume === 0 && !audio.paused) {
                              audio.pause();
                          }
                      } else if (soundName && slider && audio) {
                          slider.value = 0;
                          audio.volume = 0;
                          audio.pause();
                      }
                  });
                  if (playAttempted) {
                      popupActivateAudioContextIfNeeded();
                  }
                  popupUpdateMasterButtonState();
              }

              function popupGetSavedCombinations() {
                  try {
                       return JSON.parse(localStorage.getItem(AMBIENT_STORAGE_KEY) || '{}');
                  } catch (e) {
                      console.error("Error parsing saved combinations:", e);
                      return {};
                  }
              }

              function popupSaveCombinations(combinations) {
                  try {
                      localStorage.setItem(AMBIENT_STORAGE_KEY, JSON.stringify(combinations));
                  } catch (e) {
                      console.error("Error saving combinations:", e);
                      toast.error("Could not save combinations. Local storage might be full or disabled.");
                  }
              }

             function popupRenderSavedList() {
                 const combinations = popupGetSavedCombinations();
                 savedCombinationsList.innerHTML = '';
                 const names = Object.keys(combinations);

                 if (names.length === 0) {
                     savedCombinationsList.innerHTML = '<p style="opacity: 0.7; font-size: 0.9em; text-align: center;">No saved mixes yet.</p>';
                     return;
                 }

                 names.sort().forEach(name => {
                     const itemDiv = document.createElement('div');
                     itemDiv.classList.add('saved-item');
                     const nameSpan = document.createElement('span');
                     nameSpan.textContent = name;

                     itemDiv.appendChild(nameSpan);

                     const buttonsDiv = document.createElement('div');
                     buttonsDiv.classList.add('saved-item-buttons');

                     const loadBtn = document.createElement('button');
                     loadBtn.className = 'load-btn';
                     loadBtn.textContent = 'Load';
                     loadBtn.dataset.name = name;

                     const deleteBtn = document.createElement('button');
                     deleteBtn.className = 'delete-btn';
                     deleteBtn.textContent = 'Delete';
                     deleteBtn.dataset.name = name;

                     buttonsDiv.appendChild(loadBtn);
                     buttonsDiv.appendChild(deleteBtn);
                     itemDiv.appendChild(buttonsDiv);

                     savedCombinationsList.appendChild(itemDiv);
                 });
             }

             saveCombinationBtn.addEventListener('click', () => {
                 const name = combinationNameInput.value.trim();
                 if (!name) {
                     toast.warning('Please enter a name for your mix.');
                     combinationNameInput.focus();
                     return;
                 }

                 const combinations = popupGetSavedCombinations();
                 if (combinations[name]) {
                     if (!confirm(`Mix "${name}" already exists. Overwrite?`)) {
                         return;
                     }
                 }

                 combinations[name] = popupGetCurrentSettings();
                 popupSaveCombinations(combinations);
                 popupRenderSavedList();
                 combinationNameInput.value = '';
             });

             savedCombinationsList.addEventListener('click', (event) => {
                 const target = event.target;
                 const combinationName = target.dataset.name;

                 if (!combinationName) return;

                 if (target.classList.contains('load-btn')) {
                     const combinations = popupGetSavedCombinations();
                     if (combinations[combinationName]) {
                         popupApplySettings(combinations[combinationName]);
                     } else {
                         console.error(`Popup: Mix "${combinationName}" not found.`);
                         popupRenderSavedList();
                     }
                 } else if (target.classList.contains('delete-btn')) {
                     if (confirm(`Are you sure you want to delete mix "${combinationName}"?`)) {
                         const combinations = popupGetSavedCombinations();
                         if (combinations[combinationName]) {
                             delete combinations[combinationName];
                             popupSaveCombinations(combinations);
                             popupRenderSavedList();
                         } else {
                              console.error(`Popup: Mix "${combinationName}" not found for deletion.`);
                              popupRenderSavedList();
                         }
                     }
                 }
             });

             // Reset all sliders on initial load
             resetAllSliders();

             popupRenderSavedList();
             popupUpdateMasterButtonState();

        }

        // ========== Auto-Hide Controls Logic ==========

        /**
         * Hides the controls by adding the 'controls-hidden' class.
         */
        function hideControls() {
            // Hide regular elements
            elementsToAutoHide.forEach(el => el?.classList.add('controls-hidden'));
            
            // Hide custom cursor elements
            customCursorElements.forEach(el => {
                if (el) {
                    el.style.opacity = '0';
                    el.style.transition = 'opacity 0.3s ease';
                }
            });
            
            // Hide profile popup if it's open
            if (profilePopup && profilePopup.style.display === 'block') {
                profilePopup.style.display = 'none';
            }
            
        }

        /**
         * Shows the controls by removing the 'controls-hidden' class.
         */
        function showControls() {
            // Show regular elements
            elementsToAutoHide.forEach(el => el?.classList.remove('controls-hidden'));
            
            // Show custom cursor elements
            customCursorElements.forEach(el => {
                if (el) {
                    el.style.opacity = '1';
                    el.style.transition = 'opacity 0.3s ease';
                }
            });
            
            // Note: Profile popup is not automatically shown - user needs to click profile button
        }

        /**
         * Resets the inactivity timer. Shows controls and starts the timeout again.
         */
        function resetInactivityTimer() {
            showControls();
            clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(hideControls, inactivityTimeoutDuration);
        }

        /**
         * Initializes the inactivity detection listeners.
         */
        function initializeInactivityDetection() {
            // Initial setup
            resetInactivityTimer();

            // Add listeners
            window.addEventListener('mousemove', resetInactivityTimer);
            window.addEventListener('mousedown', resetInactivityTimer);
            window.addEventListener('keypress', resetInactivityTimer);
            window.addEventListener('touchstart', resetInactivityTimer); // For touch devices
         }

         // ========== Background Selection Menu Logic ==========

        /**
         * Stops and hides any currently playing live wallpaper
         * Function moved to background.js - use stopLiveWallpaper() from background.js
         */
        
        /**
         * Applies a background image from a URL or Data URL.
         * @param {string} imageUrl - The URL or Data URL of the image.
         */
        // applyBackground function moved to background.js

        /**
         * Loads and applies the saved background (static only - video functionality disabled).
         */
        // loadCustomBackground function moved to background.js
        
        // setDefaultBackground function moved to background.js

        // Initialize background selection menu elements
        const backgroundMenu = document.getElementById('background-selection-menu');
        const closeMenuBtn = document.querySelector('.close-menu-btn');
        const menuCustomUploadBtn = document.getElementById('menu-custom-upload-btn');
        const gridItems = document.querySelectorAll('.grid-item');
        // Live wallpaper items are disabled - no need to query them
        
        // Store the current background type (static only - video functionality disabled) with user-specific key
        const backgroundTypeKey = window.firebaseDataManager && firebaseDataManager.user 
            ? `backgroundType_${firebaseDataManager.user.uid}` 
            : 'backgroundType';
        let currentBackgroundType = localStorage.getItem(backgroundTypeKey) || 'static';

        // Background menu initialization is now handled in the consolidated section above

        // Grid item selection for static backgrounds
        gridItems.forEach(item => {
            // Pre-load the images for preview
            const previewImg = item.querySelector('img');
            if (previewImg) {
                previewImg.onerror = function() {
                    console.error('Failed to load preview image:', previewImg.src);
                    previewImg.src = 'assets/background-images-webp/Bimg41.webp'; // Fallback to default
                };
            }
            
            item.addEventListener('click', () => {
                const imageUrl = item.getAttribute('data-bg');
                if (imageUrl) {
                    try {
                        // Live wallpapers are disabled - no need to stop them
                        
                        // Store the background type and image URL with user-specific keys
                        currentBackgroundType = 'static';
                        localStorage.setItem(backgroundTypeKey, 'static');
                        
                        const staticImageKey = window.firebaseDataManager && firebaseDataManager.user 
                            ? `backgroundStaticImage_${firebaseDataManager.user.uid}` 
                            : 'backgroundStaticImage';
                        localStorage.setItem(staticImageKey, imageUrl);
                        
                        // Apply the background using BackgroundManager
                        if (window.backgroundManager) {
                            backgroundManager.setBackgroundImage(imageUrl);
                        }
                        
                        backgroundMenu.style.display = 'none';
                    } catch (error) {
                        console.error("Error saving background selection:", error);
                        backgroundMenu.style.display = 'none';
                    }
                }
            });
        });
        
        // Live wallpaper selection - DISABLED (Coming Soon)
        // All live wallpaper functionality has been disabled




        // ========== End Background Upload Logic ==========

        // ========== Zoom Functionality ==========
        
        // Variable to track the current zoom level
        let currentZoom = 1.0;
        const minZoom = 0.5;
        const maxZoom = 2.0;
        const zoomStep = 0.1;
        
        // Function to apply zoom to the timer container
        function applyZoom() {
            timerContainer.style.transform = `scale(${currentZoom})`;
            timerContainer.style.transformOrigin = 'center center';
        }
        
        // ========== End Zoom Functionality ==========

        // Add this to the JavaScript section after the existing event listeners
        
        // Time Picker JavaScript
        // Make sure this runs after the DOM is fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeTimePicker);
        } else {
            initializeTimePicker();
        }
        
        function initializeTimePicker() {
            const timeDisplay = document.getElementById('time-display');
            const pickerPopup = document.getElementById('time-picker-popup');
            const hoursColumn = document.getElementById('hours-column');
            const minutesColumn = document.getElementById('minutes-column');
            const hoursContent = document.getElementById('hours-content');
            const minutesContent = document.getElementById('minutes-content');
            const setTimeBtn = document.getElementById('set-time-btn');
            const cancelTimeBtn = document.getElementById('cancel-time-btn');
            const hoursSelect = document.getElementById('hours');
            const minutesSelect = document.getElementById('minutes');

            const ITEM_HEIGHT = 40; // Must match CSS height of .time-item
            const VISIBLE_ITEMS_PADDING = 2; // Padding items at top and bottom

            let currentHour = parseInt(hoursSelect.value) || 0;
            let currentMinute = parseInt(minutesSelect.value) || 0;
            let isFirstPickerShow = true;

                    // Load saved time values
        // FIREBASE INTEGRATION: This is session state - keep localStorage only
        // No need to sync to Firebase as this is temporary UI state
        const savedTime = JSON.parse(localStorage.getItem('savedTime') || '{}');
        if (savedTime.hours !== undefined) {
            currentHour = parseInt(savedTime.hours);
            hoursSelect.value = currentHour;
        }
        if (savedTime.minutes !== undefined) {
            currentMinute = parseInt(savedTime.minutes);
            minutesSelect.value = currentMinute;
        }

            // Function to enable/disable time picker
            window.setTimePickerEnabled = function(enabled) {
                const timeDisplay = document.getElementById('time-display');
                if (timeDisplay) {
                    timeDisplay.style.pointerEvents = enabled ? 'auto' : 'none';
                    timeDisplay.style.opacity = enabled ? '1' : '0.5';
                    timeDisplay.title = enabled ? 'Click to set time' : 'Stop the timer to change time';
                }
            };

            // Initialize time display
            updateTimeDisplay();

            // Disable time picker if timer is running
            // Check both window variable and localStorage for timer state
            const isTimerRunning = window.timerIsRunning || localStorage.getItem(STORAGE_KEYS.TIMER_IS_RUNNING) === 'true';
            if (isTimerRunning) {
                window.setTimePickerEnabled(false);
            }

            // Function to manage button states based on running mode
            window.updateButtonStates = function() {
                const timerRunning = window.timerIsRunning || localStorage.getItem(STORAGE_KEYS.TIMER_IS_RUNNING) === 'true';
                const stopwatchRunning = window.stopwatchIsRunning || localStorage.getItem(STORAGE_KEYS.STOPWATCH_IS_RUNNING) === 'true';
                const pomodoroRunning = typeof isPomodoroActive === 'function' && isPomodoroActive();

                // Check if we're in stopwatch mode with elapsed time (for button state management)
                const isStopwatchMode = localStorage.getItem(STORAGE_KEYS.IS_STOPWATCH_MODE) === 'true';
                const stopwatchElapsedTime = parseInt(localStorage.getItem(STORAGE_KEYS.STOPWATCH_ELAPSED_TIME) || '0');
                const stopwatchActive = isStopwatchMode && (stopwatchElapsedTime > 0 || stopwatchRunning);

                // Get button elements
                const modeToggleBtn = document.getElementById('mode-toggle-btn');
                const pomodoroBtn = document.getElementById('pomodoro-btn');
                const stopwatchBtn = document.getElementById('mode-toggle-btn'); // Same as mode toggle in stopwatch mode
                const plantModeBtn = document.querySelector('[data-style="6"]'); // Plant mode button

                // Helper function to disable/enable buttons
                function setButtonDisabled(button, disabled, tooltip = '') {
                    if (button) {
                        button.disabled = disabled;
                        button.style.opacity = disabled ? '0.5' : '1';
                        button.style.pointerEvents = disabled ? 'none' : 'auto';
                        if (tooltip) {
                            button.title = tooltip;
                        }
                    }
                }

                // Reset all buttons first
                setButtonDisabled(modeToggleBtn, false);
                setButtonDisabled(pomodoroBtn, false);
                setButtonDisabled(plantModeBtn, false);

                // Apply disable rules based on running state
                if (timerRunning) {
                    // When timer is running: disable mode-toggle and pomodoro buttons
                    setButtonDisabled(modeToggleBtn, true, 'Stop timer to switch modes');
                    setButtonDisabled(pomodoroBtn, true, 'Stop timer to start Pomodoro');
                } else if (stopwatchActive) {
                    // When stopwatch is running or has elapsed time: disable mode-toggle and pomodoro buttons
                    const tooltipText = stopwatchRunning ? 'Stop stopwatch to switch modes' : 'Reset stopwatch to switch modes';
                    const pomodoroTooltip = stopwatchRunning ? 'Stop stopwatch to start Pomodoro' : 'Reset stopwatch to start Pomodoro';
                    const plantTooltip = stopwatchRunning ? 'Stop stopwatch to change to plant mode' : 'Reset stopwatch to change to plant mode';

                    setButtonDisabled(modeToggleBtn, true, tooltipText);
                    setButtonDisabled(pomodoroBtn, true, pomodoroTooltip);
                    // Also disable plant mode when stopwatch is active
                    setButtonDisabled(plantModeBtn, true, plantTooltip);
                } else if (pomodoroRunning) {
                    // When pomodoro is running: disable stopwatch button
                    setButtonDisabled(modeToggleBtn, true, 'Stop Pomodoro to switch modes');
                    // Also disable plant mode when pomodoro is running
                    setButtonDisabled(plantModeBtn, true, 'Stop Pomodoro to change to plant mode');
                }
            };

            // Populate scrollable columns with true infinite scroll
            function populateColumn(contentElement, max, step = 1, isHour = false) {
                contentElement.innerHTML = ''; // Clear previous items

                // Add top padding items
                for (let i = 0; i < VISIBLE_ITEMS_PADDING; i++) {
                    const paddingItem = document.createElement('div');
                    paddingItem.classList.add('time-item', 'padding');
                    contentElement.appendChild(paddingItem);
                }

                // For true infinite scroll, create many cycles of values
                // More cycles = smoother infinite scroll experience
                const cycles = 10; // 10 cycles for very smooth infinite scroll
                const cycleSize = max + 1; // 0-23 (24 values) or 0-59 (60 values)

                for (let cycle = 0; cycle < cycles; cycle++) {
                    for (let value = 0; value <= max; value++) {
                        const item = document.createElement('div');
                        item.classList.add('time-item');
                        item.textContent = String(value).padStart(2, '0');
                        item.dataset.value = value;
                        item.dataset.cycle = cycle;

                        // Add click handler to select time on click
                        item.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const value = parseInt(item.dataset.value);

                            // Update the value immediately
                            if (isHour) {
                                currentHour = value;
                                hoursSelect.value = value;
                            } else {
                                currentMinute = value;
                                minutesSelect.value = value;
                            }

                            // Update the display
                            updateTimeDisplay();

                            // Scroll the item into view
                            item.scrollIntoView({
                                behavior: 'smooth',
                                block: 'center',
                                inline: 'nearest'
                            });

                            // Highlight the selected item
                            if (typeof highlightCenteredItems === 'function') {
                                highlightCenteredItems();
                            }

                            // Trigger change events
                            const changeEvent = new Event('change', { bubbles: true });
                            hoursSelect.dispatchEvent(changeEvent);
                            minutesSelect.dispatchEvent(changeEvent);
                        });

                        contentElement.appendChild(item);
                    }
                }

                // Add bottom padding items
                for (let i = 0; i < VISIBLE_ITEMS_PADDING; i++) {
                    const paddingItem = document.createElement('div');
                    paddingItem.classList.add('time-item', 'padding');
                    contentElement.appendChild(paddingItem);
                }
            }
            
            // Initial population of time columns
            populateColumn(hoursContent, 23, 1, true);
            populateColumn(minutesContent, 59, 1, false);

            // Set initial scroll position to saved values (or 00:00 if no saved values)
            // Use setTimeout to ensure DOM is ready and avoid race conditions
            setTimeout(() => {
                // Scroll to saved values using instant scroll to prevent juggling
                scrollToValue(hoursColumn, currentHour, false); // false = instant scroll
                scrollToValue(minutesColumn, currentMinute, false); // false = instant scroll
                
                // Initial highlight
                highlightCenteredItems();
            }, 50);

            // Get selected value based on scroll position with infinite scroll support
            function getSelectedValue(columnElement) {
                const allItems = Array.from(columnElement.querySelectorAll('.time-item'));
                const scrollTop = columnElement.scrollTop;
                const containerHeight = columnElement.clientHeight;
                
                // Find the item that's visually centered
                let selectedItem = null;
                let minDistance = Infinity;
                
                allItems.forEach((item, index) => {
                    if (item.classList.contains('padding')) return;
                    
                    const itemTop = index * ITEM_HEIGHT;
                    const itemCenter = itemTop + (ITEM_HEIGHT / 2);
                    const containerCenter = scrollTop + (containerHeight / 2);
                    const distance = Math.abs(itemCenter - containerCenter);
                    
                    if (distance < minDistance) {
                        minDistance = distance;
                        selectedItem = item;
                    }
                });

                if (selectedItem) {
                    return parseInt(selectedItem.dataset.value);
                }
                return 0;
            }

            // Store active indices to prevent unnecessary DOM updates
            let activeHourIndex = -1;
            let activeMinuteIndex = -1;

            // Highlight the item centered in the view with infinite scroll support
            function highlightCenteredItems() {
                // Handle hours
                const allHourItems = Array.from(hoursContent.querySelectorAll('.time-item'));
                const hourScrollTop = hoursColumn.scrollTop;
                const containerHeight = hoursColumn.clientHeight;
                
                let selectedHourItem = null;
                let minHourDistance = Infinity;
                let selectedHourIndex = -1;
                
                allHourItems.forEach((item, index) => {
                    if (item.classList.contains('padding')) return;
                    
                    const itemTop = index * ITEM_HEIGHT;
                    const itemCenter = itemTop + (ITEM_HEIGHT / 2);
                    const containerCenter = hourScrollTop + (containerHeight / 2);
                    const distance = Math.abs(itemCenter - containerCenter);
                    
                    if (distance < minHourDistance) {
                        minHourDistance = distance;
                        selectedHourItem = item;
                        selectedHourIndex = index;
                    }
                });

                if (activeHourIndex !== selectedHourIndex && selectedHourItem) {
                    if (allHourItems[activeHourIndex]) {
                        allHourItems[activeHourIndex].classList.remove('active');
                    }
                    selectedHourItem.classList.add('active');
                    activeHourIndex = selectedHourIndex;
                }

                // Handle minutes
                const allMinuteItems = Array.from(minutesContent.querySelectorAll('.time-item'));
                const minuteScrollTop = minutesColumn.scrollTop;
                const minuteContainerHeight = minutesColumn.clientHeight;
                
                let selectedMinuteItem = null;
                let minMinuteDistance = Infinity;
                let selectedMinuteIndex = -1;
                
                allMinuteItems.forEach((item, index) => {
                    if (item.classList.contains('padding')) return;
                    
                    const itemTop = index * ITEM_HEIGHT;
                    const itemCenter = itemTop + (ITEM_HEIGHT / 2);
                    const containerCenter = minuteScrollTop + (minuteContainerHeight / 2);
                    const distance = Math.abs(itemCenter - containerCenter);
                    
                    if (distance < minMinuteDistance) {
                        minMinuteDistance = distance;
                        selectedMinuteItem = item;
                        selectedMinuteIndex = index;
                    }
                });

                if (activeMinuteIndex !== selectedMinuteIndex && selectedMinuteItem) {
                    if (allMinuteItems[activeMinuteIndex]) {
                        allMinuteItems[activeMinuteIndex].classList.remove('active');
                    }
                    selectedMinuteItem.classList.add('active');
                    activeMinuteIndex = selectedMinuteIndex;
                }
            }

            // Handler to update picker state after scroll/interaction
            const updatePickerState = () => {
                highlightCenteredItems();
                applyTimeSelection();
            };

            // Throttled scroll handler for smoother performance during fast scrolling
            let scrollTimeout;
            const throttledScrollHandler = () => {
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    highlightCenteredItems();
                }, 16); // ~60fps throttling
            };

            // Use both scroll and scrollend events for optimal performance
            hoursColumn.addEventListener('scroll', throttledScrollHandler);
            minutesColumn.addEventListener('scroll', throttledScrollHandler);

            // Use 'scrollend' to fire after scrolling and snapping finishes
            hoursColumn.addEventListener('scrollend', updatePickerState);
            minutesColumn.addEventListener('scrollend', updatePickerState);

            // Add keyboard navigation for accessibility
            [hoursColumn, minutesColumn].forEach(column => {
                column.addEventListener('keydown', (e) => {
                    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
                        return;
                    }
                    e.preventDefault();

                    const currentValue = getSelectedValue(column);
                    const isHours = column.id === 'hours-column';
                    const max = isHours ? 23 : 59;
                    let newValue;

                    if (e.key === 'ArrowUp') {
                        newValue = currentValue > 0 ? currentValue - 1 : max; // Loop to max
                    } else { // ArrowDown
                        newValue = currentValue < max ? currentValue + 1 : 0;   // Loop to 0
                    }

                    scrollToValue(column, newValue);
                    // Programmatic scroll might not fire scrollend, so update state manually
                    updatePickerState();
                });
            });

            // Scroll to a specific value (prefer middle cycle for consistency)
            function scrollToValue(columnElement, value, useSmooth = true) {
                const items = Array.from(columnElement.querySelectorAll('.time-item:not(.padding)'));

                // First try to find the item in the middle cycle (cycle 5)
                let targetItem = items.find(item => parseInt(item.dataset.value) === value && parseInt(item.dataset.cycle) === 5);

                // If not found in middle cycle, find any item with that value
                if (!targetItem) {
                    targetItem = items.find(item => parseInt(item.dataset.value) === value);
                }

                if (targetItem) {
                    targetItem.scrollIntoView({
                        behavior: useSmooth ? 'smooth' : 'auto',
                        block: 'center',
                        inline: 'nearest'
                    });
                    highlightCenteredItems();
                }
            }

            // Update the time display with enhanced animation
            function updateTimeDisplay() {
                // Update the display text
                timeDisplay.textContent = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
                
                // Save the current time values
                // FIREBASE INTEGRATION: This is session state - keep localStorage only
                localStorage.setItem('savedTime', JSON.stringify({
                    hours: currentHour,
                    minutes: currentMinute
                }));
                
                // Animate the display when updated with enhanced effect
                timeDisplay.classList.add('value-changed');
                setTimeout(() => timeDisplay.classList.remove('value-changed'), 400);
                
                // Also update the main timer display to reflect the new time
                const hoursDisplay = document.getElementById('display-hours');
                const minutesDisplay = document.getElementById('display-minutes');
                const secondsDisplay = document.getElementById('display-seconds');
                
                if (hoursDisplay && minutesDisplay && secondsDisplay) {
                    // Apply smooth transition
                    [hoursDisplay, minutesDisplay, secondsDisplay].forEach(el => {
                        el.style.transition = 'color 0.3s ease';
                    });
                    
                    // Update the main timer display
                    hoursDisplay.textContent = String(currentHour).padStart(2, '0');
                    minutesDisplay.textContent = String(currentMinute).padStart(2, '0');
                    secondsDisplay.textContent = '00';
                    
                    // Reset remaining seconds based on new values
                    remainingSeconds = currentHour * 3600 + currentMinute * 60;
                    initialTotalSeconds = remainingSeconds;
                }
            }

            // Show the time picker
            function showPicker() {
                // Make sure it's visible and positioned correctly
                pickerPopup.style.display = 'block';
                
                // Set the picker to current values
                // Use instant scroll on first show to prevent rapid scrolling
                scrollToValue(hoursColumn, currentHour, !isFirstPickerShow);
                scrollToValue(minutesColumn, currentMinute, !isFirstPickerShow);
                
                // Mark that picker has been shown at least once
                isFirstPickerShow = false;
                
                // Display the popup with a small delay to ensure proper rendering
                setTimeout(() => {
                    pickerPopup.classList.add('visible');
                    highlightCenteredItems();
                }, 10);
            }

            // Hide the time picker
            function hidePicker() {
                pickerPopup.classList.remove('visible');
                // Hide after animation completes
                setTimeout(() => {
                    if (!pickerPopup.classList.contains('visible')) {
                        pickerPopup.style.display = 'none';
                    }
                }, 300);
            }

            // Expose a sync helper so external code (e.g., reset) can force the picker
            // to reflect the current hidden select values even when popup is closed
            window.syncTimePickerFromSelects = function() {
                try {
                    currentHour = parseInt(hoursSelect.value) || 0;
                    currentMinute = parseInt(minutesSelect.value) || 0;
                    // Keep internal display/save in sync
                    updateTimeDisplay();
                    // Ensure the scroll position will show the correct centered items
                    scrollToValue(hoursColumn, currentHour);
                    scrollToValue(minutesColumn, currentMinute);
                    // Refresh highlighting
                    highlightCenteredItems();
                } catch (e) {
                    console.warn('syncTimePickerFromSelects failed:', e);
                }
            };

            // Open picker on time display click
            timeDisplay.addEventListener('click', (event) => {
                event.stopPropagation();
                if (pickerPopup.classList.contains('visible')) {
                    hidePicker();
                } else {
                    showPicker();
                }
            });
            
            // Ensure time picker works properly on page load
            document.addEventListener('DOMContentLoaded', () => {
                // Initialize time picker display
                updateTimeDisplay();
            });

            // Function to apply time selection - replaces the Set button functionality
            function applyTimeSelection() {
                // Get selected values from scroll position
                const newHour = getSelectedValue(hoursColumn);
                const newMinute = getSelectedValue(minutesColumn);
                
                // Only update if values changed to avoid unnecessary updates
                if (newHour !== currentHour || newMinute !== currentMinute) {
                    currentHour = newHour;
                    currentMinute = newMinute;
                    
                    // Update hidden select elements (for compatibility with existing code)
                    hoursSelect.value = currentHour;
                    minutesSelect.value = currentMinute;
                    
                    // Trigger change events for the selects
                    const changeEvent = new Event('change', { bubbles: true });
                    hoursSelect.dispatchEvent(changeEvent);
                    minutesSelect.dispatchEvent(changeEvent);
                    
                    // Update display with animation
                    updateTimeDisplay();
                }
            }
            
            // Document click handler to close the picker when clicking outside
            document.addEventListener('click', (event) => {
                if (pickerPopup.classList.contains('visible') && 
                    !pickerPopup.contains(event.target) && 
                    !timeDisplay.contains(event.target)) {
                    hidePicker();
                }
            });

            // Close picker when clicking outside
            document.addEventListener('click', (event) => {
                if (!pickerPopup.contains(event.target) && event.target !== timeDisplay) {
                    hidePicker();
                }
            });
            
            // Initialize display (scroll position is set in the setTimeout above)
            updateTimeDisplay();
        }
        
        // Create audio element for tick sound
        const tickSound = new Audio('sounds/tick.mp3');
        
        // Function to play tick sound
        function playTickSound() {
            tickSound.currentTime = 0; // Rewind to the start in case it's already playing
            tickSound.play().catch(e => console.log('Could not play tick sound:', e));
        }
        
        // Add animation and sound when value changes for time selectors
        document.getElementById('hours').addEventListener('change', function() {
            this.classList.add('value-changed');
            setTimeout(() => this.classList.remove('value-changed'), 400);
            playTickSound();
        });
        
        document.getElementById('minutes').addEventListener('change', function() {
            this.classList.add('value-changed');
            setTimeout(() => this.classList.remove('value-changed'), 400);
            playTickSound();
        });

        // Keep the original scrolling behavior but with performance improvements
        document.addEventListener('DOMContentLoaded', () => {
            // Only apply performance optimizations
            document.body.style.webkitFontSmoothing = 'antialiased';
            document.body.style.textRendering = 'optimizeLegibility';
            
            // Initialize highlight functionality for time picker columns
            const timeColumns = document.querySelectorAll('.time-column');
            timeColumns.forEach(column => {
                column.addEventListener('scroll', () => {
                    // Only call highlightCenteredItems if the function exists
                    if (typeof highlightCenteredItems === 'function') {
                        highlightCenteredItems();
                    }
                }, { passive: true });
                // Initial highlight
                if (typeof highlightCenteredItems === 'function') {
                    highlightCenteredItems();
                }
            });
        });

        // Add after the other function overrides we just added

        // Helper function to convert between button states and emojis
        function getButtonTextForState(state) {
            switch(state) {
                case 'Start': return '▶️';
                case 'Pause': return '⏸️';
                case 'Resume': return '▷';
                case 'Stop': return '⏹️';
                default: return '▶️';
            }
        }

        // Helper function to get state from emoji
        function getStateFromButtonText(emoji) {
            switch(emoji) {
                case '▶️': return 'Start';
                case '⏸️': return 'Pause';
                case '▷': return 'Resume';
                case '⏹️': return 'Stop';
                default: return 'Start';
            }
        }

        // Override localStorage save/load for button text
        const originalSaveToStorage = function(key, value) {
            if (key === STORAGE_KEYS.START_BTN_TEXT) {
                localStorage.setItem(key, getStateFromButtonText(value));
            } else {
                localStorage.setItem(key, value);
            }
        };

        // Modify the code that saves the start button text to localStorage
        const originalBeforeUnload = window.onbeforeunload;
        window.addEventListener('beforeunload', async () => {
            try {
                // Save state before unload
                localStorage.setItem(STORAGE_KEYS.START_BTN_TEXT, getStateFromButtonText(startBtn.textContent));
            } catch (error) {
                console.error('Error in custom beforeunload handler:', error);
            }
        });

            // ===== TIMER CONTAINER DRAGGING FUNCTIONALITY =====
    
            // Timer container dragging variables
        // FIREBASE INTEGRATION: Will be loaded in DOMContentLoaded event
        
        // Detect if device is mobile/tablet
        function isMobileOrTablet() {
            return window.innerWidth <= 1024 || 
                   /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        }
        
        let isTimerContainerDraggable = !isMobileOrTablet(); // Disable on mobile by default
        let isTimerContainerDragging = false;
        let timerContainerOffsetX, timerContainerOffsetY;

        // Apply initial container state (position and draggable cursor)
        // FIREBASE INTEGRATION: Load user preferences from Firestore with localStorage fallback
        async function applyInitialContainerState() {
            let savedPos = null;
            
            // Load position from Firebase with localStorage fallback
            if (window.firebaseDataManager && firebaseDataManager.user) {
                try {
                    savedPos = await firebaseDataManager.loadUserPreference('timerContainerPosition', null);
                } catch (error) {
                    console.warn('Failed to load container position from Firebase, falling back to localStorage:', error);
                }
            }
            
            // Fallback to localStorage with user-specific key
            if (!savedPos) {
            try {
                const posKey = window.firebaseDataManager && firebaseDataManager.user 
                    ? `timerContainerPosition_${firebaseDataManager.user.uid}` 
                    : 'timerContainerPosition';
                const posStr = localStorage.getItem(posKey);
                if (posStr) {
                    const pos = JSON.parse(posStr);
                    if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
                        savedPos = pos;
                    }
                }
            } catch (e) {
                    console.error('Error loading saved position from localStorage:', e);
                }
            }

            const timerContainer = document.querySelector('.timer-container');
            if (!timerContainer) return;

                    if (isTimerContainerDraggable && savedPos) {
            // Apply saved position
            timerContainer.style.position = 'absolute';
            timerContainer.style.left = `${savedPos.x}px`;
            timerContainer.style.top = `${savedPos.y}px`;
            timerContainer.style.margin = '0'; // Clear auto margins
            timerContainer.style.cursor = 'move';
        } else if (!isTimerContainerDraggable) {
            // If not draggable, ensure it's centered (respecting scale)
            resetToDefaultPosition(false); // false to not animate on initial load
            timerContainer.style.cursor = 'default';
        } else {
            // Draggable but no saved position, use default centered state
            timerContainer.style.position = '';
            timerContainer.style.left = '';
            timerContainer.style.top = '';
            timerContainer.style.margin = '';
            timerContainer.style.cursor = 'move'; // Still 'move' as it's draggable
        }
        }

        // Function to reset timer position to center, preserving scale
        function resetToDefaultPosition(animate = true) {
            // 1. Store current scale
            let currentScale = 1;
            const currentTransform = window.getComputedStyle(timerContainer).transform;
            if (currentTransform && currentTransform !== 'none') {
                try {
                    const matrix = new DOMMatrixReadOnly(currentTransform);
                    currentScale = matrix.a; // Assuming uniform scaling (matrix.a == matrix.d)
                } catch (e) {
                    console.warn("Could not parse current transform matrix, defaulting scale to 1.", e);
                    // Fallback: try to parse scale from string if DOMMatrix fails
                    const scaleMatch = currentTransform.match(/scale\(([^)]+)\)/);
                    if (scaleMatch && scaleMatch[1]) {
                        const scaleValues = scaleMatch[1].split(',');
                        currentScale = parseFloat(scaleValues[0]);
                    }
                }
            }

            // 2. Reset position, left, top, and the whole transform (momentarily)
            timerContainer.style.position = ''; // Reverts to CSS default (e.g., relative with margin: auto)
            timerContainer.style.left = '';
            timerContainer.style.top = '';
            timerContainer.style.transform = ''; // Crucial: remove current transform to allow CSS centering
            timerContainer.style.margin = '';   // Ensure CSS 'margin: auto' can take effect

            // 3. Force reflow (important for CSS centering to take effect before re-applying scale)
            void timerContainer.offsetHeight;

            // 4. Re-apply *only* the scale part to transform
            timerContainer.style.transform = `scale(${currentScale})`;
            timerContainer.style.transformOrigin = 'center center'; // Ensure scale is from center

            if (animate) {
                timerContainer.style.transition = 'all 0.3s ease';
            } else {
                timerContainer.style.transition = 'none'; // No animation for initial setup
            }
            
            // Clear position from Firebase with localStorage fallback
            if (window.firebaseDataManager && firebaseDataManager.user) {
                try {
                    firebaseDataManager.saveUserPreference('timerContainerPosition', null);
                } catch (error) {
                    console.warn('Failed to clear position in Firebase, using localStorage:', error);
                    const posKey = `timerContainerPosition_${firebaseDataManager.user.uid}`;
                    localStorage.removeItem(posKey);
                }
            } else {
                localStorage.removeItem('timerContainerPosition');
            }
            timerContainer.style.cursor = isTimerContainerDraggable ? 'move' : 'default';
        }

            function startDrag(e) {
        // Prevent dragging on mobile/tablet
        if (!isTimerContainerDraggable || isMobileOrTablet()) return;

        const clientX = e.clientX ?? e.touches?.[0]?.clientX;
        const clientY = e.clientY ?? e.touches?.[0]?.clientY;
        if (clientX === undefined || clientY === undefined) return;

        isTimerContainerDragging = true;

            // If not absolute, set its position based on current visual rect
            if (timerContainer.style.position !== 'absolute') {
                const rect = timerContainer.getBoundingClientRect();
                timerContainer.style.position = 'absolute';
                timerContainer.style.left = `${rect.left}px`;
                timerContainer.style.top = `${rect.top}px`;
                timerContainer.style.margin = '0'; // Clear auto margins
                // The scale transform is preserved
            }

                    // Calculate offset from the element's current CSS `left` and `top`
        timerContainerOffsetX = clientX - parseFloat(timerContainer.style.left);
        timerContainerOffsetY = clientY - parseFloat(timerContainer.style.top);

            timerContainer.style.cursor = 'grabbing';
            timerContainer.style.transition = 'none'; // Disable transitions during drag

            if (e.cancelable) e.preventDefault();
        }

            function drag(e) {
        if (!isTimerContainerDragging) return;

        const clientX = e.clientX ?? e.touches?.[0]?.clientX;
        const clientY = e.clientY ?? e.touches?.[0]?.clientY;
        if (clientX === undefined || clientY === undefined) return;

        timerContainer.style.left = `${clientX - timerContainerOffsetX}px`;
        timerContainer.style.top = `${clientY - timerContainerOffsetY}px`;

        if (e.cancelable) e.preventDefault();
    }

            function stopDrag() {
        if (!isTimerContainerDragging) return;
        isTimerContainerDragging = false;
        timerContainer.style.cursor = isTimerContainerDraggable ? 'move' : 'default';
            // Re-enable transitions for transform only
            timerContainer.style.transition = 'transform 0.3s ease';

            // Save position
            // FIREBASE INTEGRATION: Save user preferences to Firestore with localStorage fallback
            const pos = {
                x: parseFloat(timerContainer.style.left),
                y: parseFloat(timerContainer.style.top)
            };
            
            // Save position to Firebase with localStorage fallback
            if (window.firebaseDataManager && firebaseDataManager.user) {
            try {
                    firebaseDataManager.saveUserPreference('timerContainerPosition', pos);
                } catch (error) {
                    console.warn('Failed to save position to Firebase, using localStorage:', error);
                    const posKey = `timerContainerPosition_${firebaseDataManager.user.uid}`;
                    localStorage.setItem(posKey, JSON.stringify(pos));
                }
            } else {
                localStorage.setItem('timerContainerPosition', JSON.stringify(pos));
            }
        }

        // ===== QUOTE INPUT MANAGEMENT =====
        
        // Handle quote functionality
        // FIREBASE INTEGRATION: Load user content from Firestore with localStorage fallback
        async function initializeQuoteInputs() {
            const quoteContainer = document.getElementById('quote-display');
            const quoteTextarea = document.querySelector('.quote-textarea');
            const quoteSource = document.querySelector('.quote-source');
            
            if (!quoteContainer || !quoteTextarea || !quoteSource) return;
            
            // Load saved quote and source if they exist
            // FIREBASE INTEGRATION: Load from Firestore with localStorage fallback
            let savedQuote = '';
            let savedSource = '';
            
            if (window.firebaseDataManager && firebaseDataManager.user) {
                try {
                    savedQuote = await firebaseDataManager.loadUserPreference('timerQuote', '');
                    savedSource = await firebaseDataManager.loadUserPreference('timerQuoteSourceText', '');
                } catch (error) {
                    console.warn('Failed to load quotes from Firebase, using localStorage:', error);
                    savedQuote = localStorage.getItem('timerQuote') || '';
                    savedSource = localStorage.getItem('timerQuoteSourceText') || '';
                }
            } else {
                savedQuote = localStorage.getItem('timerQuote') || '';
                savedSource = localStorage.getItem('timerQuoteSourceText') || '';
            }
            
            if (savedQuote) {
                quoteTextarea.value = savedQuote;
                // Auto-resize textarea if there's content
                quoteTextarea.style.height = 'auto';
                quoteTextarea.style.height = Math.min(quoteTextarea.scrollHeight, 150) + 'px';
            }
            
            if (savedSource) {
                quoteSource.value = savedSource;
            }
            
            // Make container visible after content is loaded
            setTimeout(() => {
                quoteContainer.classList.add('visible');
            }, 10);
            
            // Save quote when changed
            // FIREBASE INTEGRATION: Save user content to Firestore with localStorage fallback
            quoteTextarea.addEventListener('input', () => {
                const quoteValue = quoteTextarea.value;
                
                // Save to Firebase with localStorage fallback
                if (window.firebaseDataManager && firebaseDataManager.user) {
                    try {
                        firebaseDataManager.saveUserPreference('timerQuote', quoteValue);
                    } catch (error) {
                        console.warn('Failed to save quote to Firebase, using localStorage:', error);
                        localStorage.setItem('timerQuote', quoteValue);
                    }
                } else {
                    localStorage.setItem('timerQuote', quoteValue);
                }
                
                // Auto-resize textarea
                quoteTextarea.style.height = 'auto';
                quoteTextarea.style.height = Math.min(quoteTextarea.scrollHeight, 150) + 'px';
            });
            
            // Save source when changed
            // FIREBASE INTEGRATION: Save user content to Firestore with localStorage fallback
            quoteSource.addEventListener('input', () => {
                const sourceValue = quoteSource.value;
                
                // Save to Firebase with localStorage fallback
                if (window.firebaseDataManager && firebaseDataManager.user) {
                    try {
                        firebaseDataManager.saveUserPreference('timerQuoteSourceText', sourceValue);
                    } catch (error) {
                        console.warn('Failed to save quote source to Firebase, using localStorage:', error);
                        localStorage.setItem('timerQuoteSourceText', sourceValue);
                    }
                } else {
                    localStorage.setItem('timerQuoteSourceText', sourceValue);
                }
            });
        }

        /**
         * Load user preferences from Firebase when user logs in
         */
        async function loadUserPreferencesFromFirebase() {
            if (!window.firebaseDataManager || !firebaseDataManager.user) {
                return;
            }
            
            try {
                
                // Load colors
                const savedQuoteColor = await firebaseDataManager.loadUserPreference('quoteColor', '#ffffff');
                const savedDigitColor = await firebaseDataManager.loadUserPreference('digitColor', '#ffffff');
                const savedBaseColor = await firebaseDataManager.loadUserPreference('timerContainerBaseColor', '#000000');
                const savedAlpha = await firebaseDataManager.loadUserPreference('timerContainerAlpha', 0.85);
                
                // Load button container opacity from Firebase
                const savedButtonOpacity = await firebaseDataManager.loadUserPreference('buttonContainerOpacity', 0.85);
                
                // Apply colors
                quoteColor = savedQuoteColor;
                digitColor = savedDigitColor;
                G_timerContainerBaseColorString = savedBaseColor;
                G_timerContainerAlpha = savedAlpha;
                
                // Update color pickers
                const quoteColorPicker = document.getElementById('quote-color-picker');
                const digitColorPicker = document.getElementById('digit-color-picker');
                const containerBgColorPicker = document.getElementById('container-bg-color-picker');
                
                if (quoteColorPicker) {
                    quoteColorPicker.value = savedQuoteColor;
                    updateColorPickerVisual(quoteColorPicker, savedQuoteColor);
                }
                if (digitColorPicker) {
                    digitColorPicker.value = savedDigitColor;
                    updateColorPickerVisual(digitColorPicker, savedDigitColor);
                }
                if (containerBgColorPicker) {
                    containerBgColorPicker.value = savedBaseColor;
                    updateColorPickerVisual(containerBgColorPicker, savedBaseColor);
                }
                
                // Apply visual updates
                updateTimerDigitsColor(savedDigitColor);
                const quoteDisplay = document.querySelector('.quote-text');
                if (quoteDisplay) quoteDisplay.style.color = savedQuoteColor;
                G_applyTimerContainerBackgroundStyle();
                
                // Load timer size
                const savedSize = await firebaseDataManager.loadUserPreference('timerSize', 100);
                const timerSizeSlider = document.getElementById('timer-size-slider');
                const timerSizeValue = document.getElementById('timer-size-value');
                if (timerSizeSlider && timerSizeValue) {
                    timerSizeSlider.value = savedSize;
                    timerSizeValue.textContent = savedSize + '%';
                    updateTimerSize(parseInt(savedSize));
                }
                
                // Load and apply opacity settings
                const timerOpacitySlider = document.getElementById('timer-opacity-slider');
                const timerOpacityValue = document.getElementById('timer-opacity-value');
                if (timerOpacitySlider && timerOpacityValue) {
                    timerOpacitySlider.value = savedAlpha;
                    timerOpacityValue.textContent = Math.round(savedAlpha * 100) + '%';
                }
                
                // Load and apply button container opacity
                const buttonOpacitySlider = document.getElementById('button-opacity-slider');
                const buttonOpacityValue = document.getElementById('button-opacity-value');
                if (buttonOpacitySlider && buttonOpacityValue) {
                    buttonOpacitySlider.value = savedButtonOpacity;
                    buttonOpacityValue.textContent = Math.round(savedButtonOpacity * 100) + '%';
                }
                
                // Apply both opacities using the settings function
                if (typeof applyContainerOpacity === 'function') {
                    applyContainerOpacity(savedAlpha, savedButtonOpacity);
                }
                
                // Load quotes
                const savedQuote = await firebaseDataManager.loadUserPreference('timerQuote', '');
                const savedSource = await firebaseDataManager.loadUserPreference('timerQuoteSourceText', '');
                
                const quoteTextarea = document.querySelector('.quote-textarea');
                const quoteSourceInput = document.querySelector('.quote-source');
                if (quoteTextarea) quoteTextarea.value = savedQuote;
                if (quoteSourceInput) quoteSourceInput.value = savedSource;
                
                // Load tasks from Firebase when user logs in
                await loadTasksFromFirebase();
                
                // Load selected task after tasks are loaded
                const savedSelectedTask = await loadSelectedTaskFromFirebase();
                if (savedSelectedTask) {
                    selectedTask = savedSelectedTask;
                    updateTaskDisplay();
                }
                
                // Load draggable state and position
                const savedDraggable = await firebaseDataManager.loadUserPreference('timerContainerDraggable', true);
                const savedPosition = await firebaseDataManager.loadUserPreference('timerContainerPosition', null);
                
                // Update global variable and UI
                isTimerContainerDraggable = savedDraggable;
                
                const draggableToggle = document.getElementById('timer-draggable-toggle');
                if (draggableToggle) draggableToggle.checked = savedDraggable;
                
                // Apply position - reuse the existing applyInitialContainerState function
                if (typeof applyInitialContainerState === 'function') {
                    await applyInitialContainerState();
                }
                
            } catch (error) {
                console.error('Error loading user preferences from Firebase:', error);
            }
        }

        // ===== INITIALIZATION =====
        
        // Initialize timer container dragging and quote inputs when DOM is loaded
        document.addEventListener('DOMContentLoaded', async () => {
            // ===== AI ASSISTANT MODAL FUNCTIONALITY =====
            
            // Get AI modal elements
            const aiModal = document.getElementById('ai-assistant-modal');
            const aiOpenBtn = document.getElementById('ai-assistant-btn');
            const aiCloseBtn = document.getElementById('ai-modal-close');
            const aiBackdrop = document.querySelector('.ai-modal-backdrop');
            
            // AI Tab functionality
            const aiTabs = document.querySelectorAll('.ai-tab');
            const aiTabContents = document.querySelectorAll('.ai-tab-content');
            
            // AI Chat elements
            const chatInput = document.getElementById('ai-chat-input');
            const sendBtn = document.getElementById('ai-send-btn');
            const chatMessages = document.getElementById('ai-chat-messages');
            const charCount = document.getElementById('ai-char-count');
            
            // Open AI Modal
            if (aiOpenBtn && aiModal) {
                aiOpenBtn.addEventListener('click', async () => {
                    aiModal.style.display = 'flex';
                    setTimeout(async () => {
                        aiModal.classList.add('show');
                        // Load existing conversation
                        await loadExistingConversation();
                        // Update usage info
                        await updateUsageDisplay();
                        // Ensure chat input is visible and focused
                        setTimeout(() => {
                            if (chatInput) {
                                chatInput.focus();
                                // Scroll to bottom to show input area
                                const chatContainer = document.querySelector('.ai-chat-container');
                                if (chatContainer) {
                                    chatContainer.scrollTop = chatContainer.scrollHeight;
                                }
                            }
                        }, 300);
                    }, 10);
                });
            }

            // New Chat button functionality
            const newChatBtn = document.getElementById('ai-new-chat-btn');
            if (newChatBtn) {
                newChatBtn.addEventListener('click', () => {
                    showNewChatConfirmation();
                });
            }
            
            // Close AI Modal
            const closeAIModal = () => {
                aiModal.classList.remove('show');
                setTimeout(() => {
                    aiModal.style.display = 'none';
                }, 300);
            };
            
            if (aiCloseBtn) {
                aiCloseBtn.addEventListener('click', closeAIModal);
            }
            
            if (aiBackdrop) {
                aiBackdrop.addEventListener('click', closeAIModal);
            }
            
            // Tab switching functionality
            aiTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const targetTab = tab.getAttribute('data-tab');
                    
                    // Remove active class from all tabs and contents
                    aiTabs.forEach(t => t.classList.remove('active'));
                    aiTabContents.forEach(content => content.classList.remove('active'));
                    
                    // Add active class to clicked tab and corresponding content
                    tab.classList.add('active');
                    const targetContent = document.getElementById(targetTab);
                    if (targetContent) {
                        targetContent.classList.add('active');
                    }
                });
            });
            
            // ===== AI CHAT FUNCTIONALITY =====
            
            // Character count and send button state
            if (chatInput && charCount && sendBtn) {
                chatInput.addEventListener('input', () => {
                    try {
                        const text = chatInput.value || '';
                        const length = text.length;

                        charCount.textContent = `${length}/1000`;

                        // Update color based on character count
                        charCount.classList.remove('warning', 'danger');
                        if (length > 800) {
                            charCount.classList.add('danger');
                        } else if (length > 600) {
                            charCount.classList.add('warning');
                        }

                        sendBtn.disabled = length === 0 || length > 1000;

                        // Auto-resize textarea (with safety limits)
                        chatInput.style.height = 'auto';
                        const newHeight = Math.min(Math.max(chatInput.scrollHeight, 44), 120);
                        chatInput.style.height = newHeight + 'px';
                    } catch (error) {
                        console.error('Error in character count handler:', error);
                    }
                });
                
                // Send message on Enter (but allow Shift+Enter for new lines)
                chatInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (!sendBtn.disabled) {
                            sendMessage();
                        }
                    }
                });
            }
            
            // Send button click
            if (sendBtn) {
                sendBtn.addEventListener('click', sendMessage);
            }
            
            // Send message function
            async function sendMessage() {
                const message = chatInput.value.trim();
                if (!message || sendBtn.disabled) return;

                // Check if user is authenticated
                if (!window.firebaseDataManager?.user) {
                    showNotification('Please sign in to use AI features.', 'error');
                    return;
                }

                // Check if Firebase is initialized
                if (!window.firebaseDataManager?.getUserDocRef) {
                    showNotification('Firebase not ready. Please refresh and try again.', 'error');
                    return;
                }

                // Check character limit (1000 characters)
                if (message.length > 1000) {
                    showNotification('Message too long! Please keep it under 1000 characters.', 'error');
                    return;
                }

                // Check daily message limit (10 per day)
                const messageCount = await getDailyMessageCount();
                if (messageCount >= 10) {
                    showNotification('Daily message limit reached! Try again tomorrow.', 'error');
                    return;
                }

                // Disable input and show user message
                chatInput.disabled = true;
                sendBtn.disabled = true;

                // Add user message to chat
                addMessageToChat(message, 'user');

                // Clear input
                chatInput.value = '';
                if (charCount) {
                    charCount.textContent = '0/1000';
                    charCount.classList.remove('warning', 'danger');
                }
                chatInput.style.height = 'auto';

                // Show typing indicator
                const typingId = addTypingIndicator();

                try {
                    // Get conversation context
                    const context = await getConversationContext();
                    const conversationHistory = context ? formatConversationHistory(context) : '';

                    const prompt = `${conversationHistory}
Current message: "${message}"

You are a helpful study assistant. Respond directly to the student's problem.

Keep response under 200 words. Be conversational and actionable.

Rules:
- Only address the student's specific problem
- Don't explain your reasoning or process
- Don't use bullet points or numbered lists always, use them as needed only when appropriate
- Write naturally, like talking to a friend
- Give practical advice and encouragement
- Stay focused on their issue only`;

                    const aiResponse = await askGemini(prompt);

                    // Check response length (200 words max) - more accurate counting
                    const words = aiResponse.trim().split(/\s+/).filter(word => word.length > 0);
                    const wordCount = words.length;
                    const truncatedResponse = wordCount > 200
                        ? words.slice(0, 200).join(' ') + '...'
                        : aiResponse;

                    // Save conversation to memory
                    await saveConversation(message, truncatedResponse);

                    // Remove typing indicator and add AI response
                    removeTypingIndicator(typingId);
                    addMessageToChat(formatAIResponse(truncatedResponse), 'ai');

                } catch (error) {
                    console.error('AI chat failed:', error);
                    removeTypingIndicator(typingId);
                    addMessageToChat('Sorry, I encountered an error. Please try again.', 'ai');
                }

                // Re-enable input
                chatInput.disabled = false;
                chatInput.focus();

                // Ensure chat is scrolled to bottom
                setTimeout(() => {
                    chatMessages.scrollTo({
                        top: chatMessages.scrollHeight,
                        behavior: 'smooth'
                    });
                }, 200);
            }

            // ===== AI FIREBASE USAGE TRACKING FUNCTIONS =====

            // Load existing conversation from Firebase
            async function loadExistingConversation() {
                if (!window.firebaseDataManager?.user || !window.firebaseDataManager?.getUserDocRef) {
                    return;
                }

                try {
                    const context = await getConversationContext();
                    if (context && context.messages && context.messages.length > 0) {
                        const chatMessages = document.getElementById('ai-chat-messages');
                        if (chatMessages) {
                            // Clear existing messages
                            chatMessages.innerHTML = '';
                            
                            // Add all messages from conversation
                            context.messages.forEach(msg => {
                                if (msg.type === 'user') {
                                    addMessageToChat(msg.content, 'user');
                                } else if (msg.type === 'ai') {
                                    addMessageToChat(formatAIResponse(msg.content), 'ai');
                                }
                            });
                            
                            // Scroll to bottom
                            setTimeout(() => {
                                chatMessages.scrollTo({
                                    top: chatMessages.scrollHeight,
                                    behavior: 'smooth'
                                });
                            }, 100);
                        }
                    }
                } catch (error) {
                    console.error('Error loading conversation:', error);
                }
            }

            // Get conversation context from Firebase
            async function getConversationContext() {
                if (!window.firebaseDataManager?.user || !window.firebaseDataManager?.getUserDocRef) {
                    return null;
                }

                try {
                    const userRef = window.firebaseDataManager.getUserDocRef();
                    const userDoc = await userRef.get();

                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        return userData.aiConversation || null;
                    }
                    return null;
                } catch (error) {
                    console.error('Error getting conversation context:', error);
                    return null;
                }
            }

            // Format conversation history for AI prompt
            function formatConversationHistory(context) {
                if (!context || !context.messages || context.messages.length === 0) {
                    return '';
                }

                // Get last 2 exchanges (4 messages total: user-AI-user-AI)
                const recentMessages = context.messages.slice(-4);
                let history = 'Previous conversation context:\n\n';

                for (let i = 0; i < recentMessages.length; i += 2) {
                    const userMsg = recentMessages[i];
                    const aiMsg = recentMessages[i + 1];

                    if (userMsg && aiMsg) {
                        // Truncate long messages for context
                        const userContent = userMsg.content.length > 100
                            ? userMsg.content.substring(0, 100) + '...'
                            : userMsg.content;
                        const aiContent = aiMsg.content.length > 100
                            ? aiMsg.content.substring(0, 100) + '...'
                            : aiMsg.content;

                        history += `Previous user: "${userContent}"\n`;
                        history += `Previous AI: "${aiContent}"\n\n`;
                    }
                }

                return history.trim();
            }

            // Save conversation to Firebase
            async function saveConversation(userMessage, aiResponse) {
                if (!window.firebaseDataManager?.user) return;

                try {
                    const userRef = window.firebaseDataManager.getUserDocRef();

                    // Get existing conversation data
                    const userDoc = await userRef.get();
                    const existingData = userDoc.exists ? userDoc.data() : {};
                    const conversation = existingData.aiConversation || { messages: [] };

                    // Add new messages with regular timestamps
                    const now = new Date();
                    conversation.messages.push({
                        type: 'user',
                        content: userMessage,
                        timestamp: now
                    });
                    conversation.messages.push({
                        type: 'ai',
                        content: aiResponse,
                        timestamp: now
                    });

                    // Keep only last 10 exchanges (20 messages)
                    if (conversation.messages.length > 20) {
                        conversation.messages = conversation.messages.slice(-20);
                    }

                    // Update Firebase document
                    await userRef.update({
                        aiConversation: conversation
                    });

                    // Update daily message count
                    await updateDailyMessageCount();

                    // Update usage display if modal is open
                    await updateUsageDisplay();
                } catch (error) {
                    console.error('Error saving conversation:', error);
                }
            }

            // Get daily message count from Firebase
            async function getDailyMessageCount() {
                if (!window.firebaseDataManager?.user) return 0;

                try {
                    const userDoc = await window.firebaseDataManager.getUserDocRef().get();
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        const aiUsage = userData.aiUsage || {};

                        const today = new Date().toDateString();
                        return aiUsage[today] || 0;
                    }
                    return 0;
                } catch (error) {
                    console.error('Error getting daily message count:', error);
                    return 0;
                }
            }

            // Update daily message count in Firebase
            async function updateDailyMessageCount() {
                if (!window.firebaseDataManager?.user) return;

                try {
                    const userRef = window.firebaseDataManager.getUserDocRef();
                    const today = new Date().toDateString();

                    // Use Firebase increment for atomic updates
                    await userRef.update({
                        [`aiUsage.${today}`]: firebase.firestore.FieldValue.increment(1)
                    });
                } catch (error) {
                    console.error('Error updating daily message count:', error);
                }
            }

            // Update usage display
            async function updateUsageDisplay() {
                try {
                    const usageInfo = document.getElementById('ai-usage-info');
                    const dailyCount = document.getElementById('daily-count');

                    if (usageInfo && dailyCount) {
                        const count = await getDailyMessageCount();
                        dailyCount.textContent = `${count}/10`;

                        // Update color based on usage
                        usageInfo.classList.remove('warning', 'danger');
                        if (count >= 8) {
                            usageInfo.classList.add('danger');
                        } else if (count >= 6) {
                            usageInfo.classList.add('warning');
                        }
                    }
                } catch (error) {
                    console.error('Error updating usage display:', error);
                }
            }

            // Show new chat confirmation dialog
            function showNewChatConfirmation() {
                // Remove existing dialogs
                const existing = document.querySelector('.ai-confirmation-dialog');
                if (existing) existing.remove();

                const dialog = document.createElement('div');
                dialog.className = 'ai-confirmation-dialog';
                dialog.innerHTML = `
                    <div class="ai-dialog-backdrop"></div>
                    <div class="ai-dialog-container">
                        <div class="ai-dialog-header">
                            <h3>Start New Chat?</h3>
                        </div>
                        <div class="ai-dialog-content">
                            <p>This will permanently delete your current conversation history.</p>
                            <p>Are you sure you want to continue?</p>
                        </div>
                        <div class="ai-dialog-buttons">
                            <button id="ai-confirm-new-chat" class="ai-dialog-btn ai-dialog-btn-danger">Yes, Start New</button>
                            <button id="ai-cancel-new-chat" class="ai-dialog-btn ai-dialog-btn-secondary">Cancel</button>
                        </div>
                    </div>
                `;

                document.body.appendChild(dialog);

                // Add event listeners
                const confirmBtn = document.getElementById('ai-confirm-new-chat');
                const cancelBtn = document.getElementById('ai-cancel-new-chat');

                if (confirmBtn) {
                    confirmBtn.addEventListener('click', () => {
                        startNewChat();
                        dialog.remove();
                    });
                }

                if (cancelBtn) {
                    cancelBtn.addEventListener('click', () => {
                        dialog.remove();
                    });
                }

                // Close on backdrop click
                dialog.addEventListener('click', (e) => {
                    if (e.target === dialog) {
                        dialog.remove();
                    }
                });
            }

            // Start new chat - clear conversation and reset UI
            async function startNewChat() {
                if (!window.firebaseDataManager?.user) {
                    showNotification('Please sign in to use AI features.', 'error');
                    return;
                }

                try {
                    const userRef = window.firebaseDataManager.getUserDocRef();

                    // Clear conversation from Firebase
                    await userRef.update({
                        aiConversation: firebase.firestore.FieldValue.delete()
                    });

                    // Clear chat messages from UI
                    if (chatMessages) {
                        chatMessages.innerHTML = `
                            <div class="ai-welcome-message">
                                <div class="ai-avatar">
                                    <svg width="24" height="24" viewBox="0 0 200 200" fill="none">
                                        <circle cx="100" cy="100" r="40" fill="url(#neuralGrad)"/>
                                        <text x="100" y="110" text-anchor="middle" fill="white" font-size="16" font-weight="bold">AI</text>
                                    </svg>
                                </div>
                                <div class="ai-message-content">
                                    <p>Hello! I'm here to help with your studies. What's on your mind?</p>
                                </div>
                            </div>
                        `;
                    }

                    // Reset character count
                    if (charCount) {
                        charCount.textContent = '0/1000';
                        charCount.classList.remove('warning', 'danger');
                    }

                    // Clear input
                    if (chatInput) {
                        chatInput.value = '';
                        chatInput.style.height = 'auto';
                    }

                    // Update usage display
                    await updateUsageDisplay();

                    // Show confirmation
                    showNotification('New chat started! Previous conversation cleared.', 'info');

                } catch (error) {
                    console.error('Error starting new chat:', error);
                    showNotification('Error starting new chat. Please try again.', 'error');
                }
            }

            // Show notification
            function showNotification(message, type = 'info') {
                try {
                    // Remove existing notifications
                    const existing = document.querySelector('.ai-notification');
                    if (existing) existing.remove();

                    const notification = document.createElement('div');
                    notification.className = `ai-notification ai-notification-${type}`;
                    notification.textContent = message;

                    notification.style.cssText = `
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        padding: 12px 20px;
                        border-radius: 8px;
                        color: white;
                        font-weight: 500;
                        z-index: 10001;
                        animation: slideInRight 0.3s ease-out;
                        ${type === 'error' ? 'background: linear-gradient(120deg, #ef4444, #dc2626);' : 'background: linear-gradient(120deg, #3b82f6, #2563eb);'}
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                        max-width: 300px;
                        word-wrap: break-word;
                    `;

                    document.body.appendChild(notification);

                    setTimeout(() => {
                        if (notification.parentNode) {
                            notification.style.animation = 'slideOutRight 0.3s ease-in';
                            setTimeout(() => {
                                if (notification.parentNode) {
                                    notification.remove();
                                }
                            }, 300);
                        }
                    }, 3000);
                } catch (error) {
                    console.error('Error showing notification:', error);
                }
            }

            // Add message to chat
            function addMessageToChat(message, sender) {
                const messageDiv = document.createElement('div');
                messageDiv.className = sender === 'user' ? 'user-message' : 'ai-response-message';
                
                if (sender === 'user') {
                    // Create elements safely without innerHTML for user content
                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'ai-message-content';
                    contentDiv.textContent = message; // Safe - escapes HTML automatically
                    messageDiv.appendChild(contentDiv);
                } else {
                    // AI response - create structure safely
                    const avatarDiv = document.createElement('div');
                    avatarDiv.className = 'ai-avatar';
                    avatarDiv.innerHTML = `
                        <svg width="24" height="24" viewBox="0 0 200 200" fill="none">
                            <circle cx="100" cy="100" r="40" fill="url(#neuralGrad)"/>
                            <text x="100" y="110" text-anchor="middle" fill="white" font-size="16" font-weight="bold">AI</text>
                        </svg>
                    `;
                    
                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'ai-message-content';
                    contentDiv.textContent = message; // Safe - escapes HTML automatically
                    
                    messageDiv.appendChild(avatarDiv);
                    messageDiv.appendChild(contentDiv);
                }
                
                chatMessages.appendChild(messageDiv);
                // Smooth scroll to bottom
                setTimeout(() => {
                    chatMessages.scrollTo({
                        top: chatMessages.scrollHeight,
                        behavior: 'smooth'
                    });
                }, 100);
            }
            
            // Add typing indicator
            function addTypingIndicator() {
                const typingDiv = document.createElement('div');
                typingDiv.className = 'ai-typing-indicator';
                typingDiv.id = 'typing-' + Date.now();
                
                typingDiv.innerHTML = `
                    <div class="ai-avatar">
                        <svg width="24" height="24" viewBox="0 0 200 200" fill="none">
                            <circle cx="100" cy="100" r="40" fill="url(#neuralGrad)"/>
                            <text x="100" y="110" text-anchor="middle" fill="white" font-size="16" font-weight="bold">AI</text>
                        </svg>
                    </div>
                    <div class="ai-typing-dots">
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                    </div>
                `;
                
                chatMessages.appendChild(typingDiv);
                // Smooth scroll to bottom
                setTimeout(() => {
                    chatMessages.scrollTo({
                        top: chatMessages.scrollHeight,
                        behavior: 'smooth'
                    });
                }, 100);
                
                return typingDiv.id;
            }
            
            // Remove typing indicator
            function removeTypingIndicator(typingId) {
                const typingElement = document.getElementById(typingId);
                if (typingElement) {
                    typingElement.remove();
                }
            }
            
            // Format AI response for better display
            function formatAIResponse(text) {
                if (!text) return text;
                
                // Convert markdown-like formatting to HTML
                let formatted = text
                    // Convert **bold** to <strong>
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    // Convert *italic* to <em>
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    // Convert bullet points to proper HTML lists
                    .replace(/^\* (.*$)/gm, '<li>$1</li>')
                    // Convert numbered lists
                    .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
                    // Convert line breaks to <br>
                    .replace(/\n/g, '<br>')
                    // Clean up multiple line breaks
                    .replace(/(<br>){3,}/g, '<br><br>');
                
                // Wrap list items in ul tags if they exist
                if (formatted.includes('<li>')) {
                    formatted = formatted.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
                }
                
                return formatted;
            }
            
            // Load Firebase preference for draggable state with fallback
            if (window.firebaseDataManager && firebaseDataManager.user) {
                try {
                    isTimerContainerDraggable = await firebaseDataManager.loadUserPreference('timerContainerDraggable', true);
                } catch (error) {
                    console.warn('Failed to load draggable state from Firebase, using user-specific localStorage:', error);
                    const userKey = `timerContainerDraggable_${firebaseDataManager.user.uid}`;
                    const saved = localStorage.getItem(userKey);
                    isTimerContainerDraggable = saved !== 'false';
                }
            } else {
                const saved = localStorage.getItem('timerContainerDraggable');
                isTimerContainerDraggable = saved !== 'false';
            }
            
            // Initialize quote inputs
            await initializeQuoteInputs();
            
            // Initialize timer container dragging
            const draggableToggle = document.getElementById('timer-draggable-toggle');
            const resetPositionButton = document.getElementById('reset-timer-position');

            if (timerContainer) {
                // Apply initial container state
                await applyInitialContainerState();

                // Mouse event listeners
                timerContainer.addEventListener('mousedown', startDrag);
                document.addEventListener('mousemove', drag);
                document.addEventListener('mouseup', stopDrag);

                // Touch event listeners
                timerContainer.addEventListener('touchstart', startDrag, { passive: false });
                document.addEventListener('touchmove', drag, { passive: false });
                document.addEventListener('touchend', stopDrag);
                document.addEventListener('touchcancel', stopDrag);

                // Prevent text selection while dragging
                timerContainer.addEventListener('selectstart', (e) => {
                    if (isTimerContainerDragging && e.cancelable) {
                        e.preventDefault();
                    }
                });
            }

            // Toggle draggable state
            if (draggableToggle) {
                draggableToggle.checked = isTimerContainerDraggable;
                draggableToggle.addEventListener('change', (e) => {
                    isTimerContainerDraggable = e.target.checked;
                    
                    // Save to Firebase with localStorage fallback
                    if (window.firebaseDataManager && firebaseDataManager.user) {
                        try {
                            firebaseDataManager.saveUserPreference('timerContainerDraggable', isTimerContainerDraggable);
                        } catch (error) {
                            console.warn('Failed to save draggable state to Firebase, using localStorage:', error);
                    localStorage.setItem('timerContainerDraggable', isTimerContainerDraggable.toString());
                        }
                    } else {
                        localStorage.setItem('timerContainerDraggable', isTimerContainerDraggable.toString());
                    }

                    if (isTimerContainerDraggable) {
                        timerContainer.style.cursor = 'move';
                        // Only change to absolute positioning if user starts dragging
                    } else {
                        // When disabling dragging, just change the cursor and don't reset position
                        timerContainer.style.cursor = 'default';
                        
                        // If you want to keep the current position but make it not draggable,
                        // we need to ensure the position is saved and maintained
                        const currentLeft = timerContainer.style.left;
                        const currentTop = timerContainer.style.top;
                        
                        // If it was positioned absolutely, keep it that way
                        if (timerContainer.style.position === 'absolute' && currentLeft && currentTop) {
                            // Keep the current position but make it not draggable
                            timerContainer.style.position = 'absolute';
                            timerContainer.style.left = currentLeft;
                            timerContainer.style.top = currentTop;
                        }
                    }
                });
            }

            // Reset position button
            if (resetPositionButton) {
                resetPositionButton.addEventListener('click', () => resetToDefaultPosition());
            }
            
            // Handle window resize and orientation changes for mobile
            let resizeTimeout;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    // On mobile, always reset to center on resize/orientation change
                    if (isMobileOrTablet() && timerContainer) {
                        resetToDefaultPosition(false);
                        timerContainer.style.cursor = 'default';
                        isTimerContainerDraggable = false;
                    }
                }, 250);
            });
            
            // Prevent zoom on double-tap for timer container on mobile
            if (timerContainer && isMobileOrTablet()) {
                let lastTouchEnd = 0;
                timerContainer.addEventListener('touchend', (e) => {
                    const now = Date.now();
                    if (now - lastTouchEnd <= 300) {
                        e.preventDefault();
                    }
                    lastTouchEnd = now;
                }, { passive: false });
            }
        });

        // ========== Circular Progress for Style 10 ==========
        
        // Circle calculations for style 10
        const RADIUS_H = 90;
        const RADIUS_M = 78;
        const RADIUS_S = 66;
        const CIRCUMFERENCE_H = 2 * Math.PI * RADIUS_H;
        const CIRCUMFERENCE_M = 2 * Math.PI * RADIUS_M;
        const CIRCUMFERENCE_S = 2 * Math.PI * RADIUS_S;

        /**
         * Initialize circular progress for style 10
         */
        function initCircularProgress() {
            const hoursCircle = document.getElementById('hours-circle');
            const minutesCircle = document.getElementById('minutes-circle');
            const secondsCircle = document.getElementById('seconds-circle');
            
            if (hoursCircle && minutesCircle && secondsCircle) {
                // Set initial stroke-dasharray
                hoursCircle.style.strokeDasharray = CIRCUMFERENCE_H;
                minutesCircle.style.strokeDasharray = CIRCUMFERENCE_M;
                secondsCircle.style.strokeDasharray = CIRCUMFERENCE_S;
                
                // Set initial stroke-dashoffset (full circle)
                hoursCircle.style.strokeDashoffset = CIRCUMFERENCE_H;
                minutesCircle.style.strokeDashoffset = CIRCUMFERENCE_M;
                secondsCircle.style.strokeDashoffset = CIRCUMFERENCE_S;
            }
        }

        /**
         * Update circular progress for style 10
         * @param {number} hours - Current hours
         * @param {number} minutes - Current minutes  
         * @param {number} seconds - Current seconds
         */
        function updateCircularProgress(hours, minutes, seconds) {
            const hoursCircle = document.getElementById('hours-circle');
            const minutesCircle = document.getElementById('minutes-circle');
            const secondsCircle = document.getElementById('seconds-circle');
            
            if (hoursCircle && minutesCircle && secondsCircle) {
                // Calculate progress (0-1)
                const hoursProgress = (hours % 12) / 12; // 12-hour format for circle
                const minutesProgress = minutes / 60;
                const secondsProgress = seconds / 60;
                
                // Update stroke-dashoffset
                hoursCircle.style.strokeDashoffset = CIRCUMFERENCE_H * (1 - hoursProgress);
                minutesCircle.style.strokeDashoffset = CIRCUMFERENCE_M * (1 - minutesProgress);
                secondsCircle.style.strokeDashoffset = CIRCUMFERENCE_S * (1 - secondsProgress);
            }
        }

        /**
         * Show/hide circular progress based on current style
         */
        function toggleCircularProgress() {
            const circularContainer = document.getElementById('circular-progress-container');
            const timerContainer = document.querySelector('.timer-container');
            
            if (circularContainer && timerContainer) {
                const isStyle10 = timerContainer.classList.contains('timer-style-10');
                
                if (isStyle10) {
                    circularContainer.style.display = 'flex';
                    initCircularProgress();
                } else {
                    circularContainer.style.display = 'none';
                }
            }
        }

        // Initialize circular progress on page load
        initCircularProgress();

        // ========== Checklist Loading Screen Functionality ==========
        document.addEventListener('DOMContentLoaded', function() {
            const checklistBtn = document.getElementById('checklist-btn');
            const checklistLoader = document.getElementById('checklist-loader');
            
            if (checklistBtn && checklistLoader) {
                checklistBtn.addEventListener('click', function(e) {
                    e.preventDefault(); // Prevent default navigation
                    
                    // Show loading screen
                    checklistLoader.classList.add('show');
                    
                    // Navigate to checklist page after a short delay
                    setTimeout(() => {
                        window.location.href = 'checklist.html';
                    }, 1500); // 1.5 second delay to show the loading animation
                });
            }
        });

        // ========== Task Management Functionality ==========
        
        // Task Management Variables
        let taskDropdownVisible = false;
        let tasks = [];
        let selectedTask = null; // Currently selected task
        
        // DOM Elements for Task Management
        const taskDisplay = document.getElementById('task-display');
        const taskDropdownPopup = document.getElementById('task-dropdown-popup');
        const addTaskBtn = document.getElementById('add-task-btn');
        const taskModal = document.getElementById('task-modal');
        const taskModalClose = document.getElementById('task-modal-close');
        const taskNameInput = document.getElementById('task-name-input');
        const taskColorPicker = document.getElementById('task-color-picker');
        const taskColorPreview = document.getElementById('task-color-preview');
        const taskCharCount = document.getElementById('task-char-count');
        const taskSaveBtn = document.getElementById('task-save-btn');
        const taskCancelBtn = document.getElementById('task-cancel-btn');
        const taskList = document.getElementById('task-list');
        const noTasksMessage = document.getElementById('no-tasks-message');
        
        // Task Management Functions
        function initializeTaskManagement() {
            try {
                if (taskDisplay) {
                    taskDisplay.addEventListener('click', (e) => {
                            toggleTaskDropdown();
                    });
                }
                
                if (addTaskBtn) {
                    addTaskBtn.addEventListener('click', openTaskModal);
                }
                
                if (taskModalClose) {
                    taskModalClose.addEventListener('click', closeTaskModal);
                }
                
                if (taskCancelBtn) {
                    taskCancelBtn.addEventListener('click', closeTaskModal);
                }
                
                if (taskSaveBtn) {
                    taskSaveBtn.addEventListener('click', saveTask);
                }
                
                if (taskNameInput) {
                    taskNameInput.addEventListener('input', updateTaskCharCount);
                    taskNameInput.addEventListener('keypress', handleTaskInputKeypress);
                }
                
                if (taskColorPicker) {
                    // Color picker is now standalone, no preview needed
                }
                
                // Close dropdown when clicking outside
                document.addEventListener('click', handleTaskOutsideClick);
                
                // Close modal when clicking backdrop
                if (taskModal) {
                    taskModal.addEventListener('click', handleTaskModalBackdropClick);
                }
                
                // Load existing tasks - wait for auth to be ready
                if (window.firebaseDataManager && firebaseDataManager.user) {
                    loadTasksFromFirebase();
                } else {
                    // Load from localStorage if not authenticated
                    loadTasksFromLocalStorage();
                }
                
                // Also listen for auth state changes to reload tasks and selected task (in correct order)
                if (typeof auth !== 'undefined') {
                    auth.onAuthStateChanged(async (user) => {
                        if (user && window.firebaseDataManager) {
                            // User logged in - load tasks first (this function will also load selected task)
                            await loadTasksFromFirebase();
                        } else if (!user) {
                            // User logged out - clear selected task
                            selectedTask = null;
                            tasks = [];
                            updateTaskDisplay();
                            renderTaskList();
                        }
                    });
                }
                
            } catch (error) {
                console.warn('Error initializing task management:', error);
            }
        }
        
        function toggleTaskDropdown() {
            try {
                taskDropdownVisible = !taskDropdownVisible;
                
                if (taskDropdownVisible) {
                    taskDropdownPopup.classList.add('visible');
                    taskDisplay.classList.add('active');
                } else {
                    taskDropdownPopup.classList.remove('visible');
                    taskDisplay.classList.remove('active');
                }
            } catch (error) {
                console.warn('Error toggling task dropdown:', error);
            }
        }
        
        function openTaskModal() {
            try {
                taskModal.style.display = 'flex';
                setTimeout(() => {
                    taskModal.classList.add('show');
                }, 10);
                
                // Reset form
                taskNameInput.value = '';
                taskColorPicker.value = '#4F46E5';
                updateTaskCharCount();
                
                // Focus on input
                taskNameInput.focus();
            } catch (error) {
                console.warn('Error opening task modal:', error);
            }
        }
        
        function closeTaskModal() {
            try {
                taskModal.classList.remove('show');
                setTimeout(() => {
                    taskModal.style.display = 'none';
                }, 300);
            } catch (error) {
                console.warn('Error closing task modal:', error);
            }
        }
        
        function updateTaskCharCount() {
            try {
                const length = taskNameInput.value.length;
                taskCharCount.textContent = length;
                
                // Update classes for warning/danger states
                taskCharCount.classList.remove('warning', 'danger');
                if (length > 80) {
                    taskCharCount.classList.add('danger');
                } else if (length > 60) {
                    taskCharCount.classList.add('warning');
                }
                
                // Enable/disable save button
                taskSaveBtn.disabled = length === 0 || length > 100;
            } catch (error) {
                console.warn('Error updating task char count:', error);
            }
        }
        
        
        function handleTaskInputKeypress(event) {
            if (event.key === 'Enter' && !taskSaveBtn.disabled) {
                saveTask();
            }
        }
        
        function handleTaskOutsideClick(event) {
            try {
                if (taskDropdownVisible && !taskDisplay.contains(event.target) && !taskDropdownPopup.contains(event.target)) {
                    toggleTaskDropdown();
                }
            } catch (error) {
                console.warn('Error handling task outside click:', error);
            }
        }
        
        function handleTaskModalBackdropClick(event) {
            if (event.target === taskModal) {
                closeTaskModal();
            }
        }
        
        async function saveTask() {
            try {
                const taskName = taskNameInput.value.trim();
                const taskColor = taskColorPicker.value;
                
                if (!taskName || taskName.length > 100) {
                    return;
                }
                
                // Disable save button to prevent double submission
                taskSaveBtn.disabled = true;
                taskSaveBtn.textContent = 'Saving...';
                
                const task = {
                    id: Date.now().toString(),
                    name: taskName,
                    color: taskColor,
                    createdAt: new Date(),
                    userId: auth.currentUser ? auth.currentUser.uid : 'anonymous'
                };
                
                // Save to Firebase
                await saveTaskToFirebase(task);
                
                // Add to local array
                tasks.push(task);
                
                // Update UI
                renderTaskList();
                closeTaskModal();
                
            } catch (error) {
                console.error('Error saving task:', error);
                toast.error('Failed to save task. Please try again.');
            } finally {
                taskSaveBtn.disabled = false;
                taskSaveBtn.textContent = 'Save Task';
            }
        }
        
        async function deleteTask(taskId) {
            try {
                // Remove from Firebase
                await deleteTaskFromFirebase(taskId);
                
                // Remove from local array
                tasks = tasks.filter(task => task.id !== taskId);
                
                // Clear selected task if it was deleted
                if (selectedTask && selectedTask.id === taskId) {
                    selectedTask = null;
                    updateTaskDisplay();
                    // Clear selection across storage layers
                    try { localStorage.removeItem('selectedTask'); } catch {}
                    await saveSelectedTaskToFirebase(null);
                }
                
                // Also delete from localStorage to prevent stale re-hydration
                try { deleteTaskFromLocalStorage(taskId); } catch {}

                // Update UI
                renderTaskList();
                
            } catch (error) {
                console.error('Error deleting task:', error);
                toast.error('Failed to delete task. Please try again.');
            }
        }
        
        function selectTask(task) {
            try {
                selectedTask = task;
                updateTaskDisplay();
                renderTaskList(); // Re-render to update selection state
                toggleTaskDropdown(); // Close dropdown after selection
                saveSelectedTaskToFirebase(task); // Save to Firebase
            } catch (error) {
                console.warn('Error selecting task:', error);
            }
        }
        
        function clearTaskSelection() {
            try {
                selectedTask = null;
                updateTaskDisplay();
                renderTaskList(); // Re-render to update selection state
                saveSelectedTaskToFirebase(null); // Save null to Firebase
            } catch (error) {
                console.warn('Error clearing task selection:', error);
            }
        }
        
        function updateTaskDisplay() {
            try {
                const taskDisplayText = document.querySelector('.task-display-text');
                const taskDisplayIcon = document.querySelector('.task-display-icon');
                
                if (selectedTask) {
                    // Show selected task with its color
                    taskDisplayText.textContent = selectedTask.name;
                    taskDisplayText.style.color = selectedTask.color;
                    taskDisplayText.classList.add('selected');
                    // Keep the SVG icon but change color
                    taskDisplayIcon.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 6L9 17l-5-5"/>
                        </svg>
                    `;
                    taskDisplayIcon.style.color = selectedTask.color;
                    taskDisplayIcon.classList.add('selected');
                } else {
                    // Show default "Tasks" text
                    taskDisplayText.textContent = 'Tasks';
                    taskDisplayText.style.color = '';
                    taskDisplayText.classList.remove('selected');
                    // Restore the original SVG icon
                    taskDisplayIcon.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 64 64" role="img" aria-labelledby="tasksIcon">
                            <title id="tasksIcon">Tasks Icon</title>
                            <defs>
                                <!-- Paper gradient -->
                                <linearGradient id="paperGrad" x1="0" x2="1" y1="0" y2="1">
                                    <stop offset="0" stop-color="#ffffff"/>
                                    <stop offset="1" stop-color="#f4f7fb"/>
                                </linearGradient>
                                <!-- Pencil gradient -->
                                <linearGradient id="pencilGrad" x1="0" x2="1">
                                    <stop offset="0" stop-color="#ffb95e"/>
                                    <stop offset="1" stop-color="#ff774d"/>
                                </linearGradient>
                                <!-- Drop shadow -->
                                <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                                    <feDropShadow dx="0" dy="2" stdDeviation="2.2" flood-color="#000" flood-opacity="0.15"/>
                                </filter>
                            </defs>

                            <!-- Background circle -->
                            <circle cx="32" cy="32" r="30" fill="#f0f6ff"/>

                            <!-- Notebook -->
                            <g filter="url(#shadow)">
                                <rect x="14" y="12" width="28" height="40" rx="4" fill="url(#paperGrad)" stroke="#d8e0ed" stroke-width="1.2"/>
                                <!-- Top band -->
                                <rect x="14" y="12" width="28" height="6" rx="3" fill="#f9fbff"/>
                                <!-- Lines -->
                                <g stroke="#b5c6e3" stroke-width="1.2" stroke-linecap="round">
                                    <line x1="18" y1="22" x2="38" y2="22"/>
                                    <line x1="18" y1="28" x2="38" y2="28"/>
                                    <line x1="18" y1="34" x2="38" y2="34"/>
                                    <line x1="18" y1="40" x2="38" y2="40"/>
                                </g>
                                <!-- Check marks -->
                                <g stroke="#3b82f6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="18,22 20,24 24,20"/>
                                    <polyline points="18,34 20,36 24,32"/>
                                </g>
                            </g>

                            <!-- Pencil -->
                            <g transform="translate(30,38) rotate(-35)" filter="url(#shadow)">
                                <!-- Eraser -->
                                <rect x="-6" y="-2" width="5.2" height="8" rx="1.5" fill="#444"/>
                                <!-- Pencil body -->
                                <rect x="-1" y="-2" width="28" height="8" rx="2" fill="url(#pencilGrad)"/>
                                <!-- Metal band -->
                                <rect x="22" y="-2" width="4" height="8" rx="1" fill="#ccd6e9"/>
                                <!-- Tip -->
                                <polygon points="26,-2 34,2 26,6" fill="#f5e0bf"/>
                                <polygon points="26,-2 29,2 26,6" fill="#d2b48c"/>
                            </g>
                        </svg>
                    `;
                    taskDisplayIcon.style.color = '';
                    taskDisplayIcon.classList.remove('selected');
                }
            } catch (error) {
                console.warn('Error updating task display:', error);
            }
        }
        
        function renderTaskList() {
            try {
                if (!taskList) return;
                
                // Clear existing content
                taskList.innerHTML = '';
                
                // Add "None" option at the top
                const noneOption = document.createElement('div');
                noneOption.className = 'task-item none-option';
                if (!selectedTask) {
                    noneOption.classList.add('selected');
                }
                noneOption.innerHTML = `
                    <div class="task-color-indicator" style="background-color: #6B7280;"></div>
                    <div class="task-name" title="No task selected">None</div>
                    <div class="task-spacer"></div>
                `;
                
                // Add click listener for "None" option
                noneOption.addEventListener('click', () => {
                    clearTaskSelection();
                });
                
                taskList.appendChild(noneOption);
                
                if (tasks.length === 0) {
                    taskList.appendChild(noTasksMessage);
                    return;
                }
                
                // Create task items
                tasks.forEach(task => {
                    const taskItem = document.createElement('div');
                    taskItem.className = 'task-item';
                    if (selectedTask && selectedTask.id === task.id) {
                        taskItem.classList.add('selected');
                    }
                    taskItem.innerHTML = `
                        <div class="task-color-indicator" style="background-color: ${task.color}"></div>
                        <div class="task-name" title="${task.name}">${task.name}</div>
                        <button class="task-delete-btn" data-task-id="${task.id}" title="Delete task">×</button>
                    `;
                    
                    // Add task selection event listener
                    taskItem.addEventListener('click', (e) => {
                        // Don't select if clicking on delete button
                        if (e.target.classList.contains('task-delete-btn')) {
                            return;
                        }
                        selectTask(task);
                    });
                    
                    // Add delete event listener
                    const deleteBtn = taskItem.querySelector('.task-delete-btn');
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (confirm('Are you sure you want to delete this task?')) {
                            deleteTask(task.id);
                        }
                    });
                    
                    taskList.appendChild(taskItem);
                });
            } catch (error) {
                console.warn('Error rendering task list:', error);
            }
        }
        
        // Firebase Integration Functions
        async function saveSelectedTaskToFirebase(task) {
            try {
                // Always keep a localStorage mirror for offline-first behavior
                try {
                    if (task) {
                        localStorage.setItem('selectedTask', JSON.stringify(task));
                    } else {
                        localStorage.removeItem('selectedTask');
                    }
                } catch {}

                if (!window.firebaseDataManager || !firebaseDataManager.user) {
                    console.warn('Firebase not available, saved selected task to localStorage only');
                    return;
                }
                
                // Use the same pattern as other user preferences
                if (task) {
                    const taskData = {
                        taskId: task.id,
                        taskName: task.name,
                        taskColor: task.color,
                        selectedAt: new Date().toISOString()
                    };
                    await firebaseDataManager.saveUserPreference('selectedTask', taskData);
                } else {
                    await firebaseDataManager.saveUserPreference('selectedTask', null);
                }
                
            } catch (error) {
                console.warn('Failed to save selected task to Firebase, using localStorage:', error);
                try {
                    if (task) {
                        localStorage.setItem('selectedTask', JSON.stringify(task));
                    } else {
                        localStorage.removeItem('selectedTask');
                    }
                } catch {}
            }
        }
        
        async function loadSelectedTaskFromFirebase() {
            try {
                if (!window.firebaseDataManager || !firebaseDataManager.user) {
                    console.warn('Firebase not available, loading from localStorage');
                    const savedTask = localStorage.getItem('selectedTask');
                    return savedTask ? JSON.parse(savedTask) : null;
                }
                
                // Use the same pattern as other user preferences
                const taskData = await firebaseDataManager.loadUserPreference('selectedTask', null);
                
                if (taskData && taskData.taskId) {
                    // Find the task in the current tasks array
                    const task = tasks.find(t => t.id === taskData.taskId);
                    if (task) {
                        // Refresh local mirror for future offline usage
                        try { localStorage.setItem('selectedTask', JSON.stringify(task)); } catch {}
                        return task;
                    } else {
                        // Task was deleted, clear the selection
                        await saveSelectedTaskToFirebase(null);
                        return null;
                    }
                }
                
                return null;
            } catch (error) {
                console.warn('Failed to load selected task from Firebase, using localStorage:', error);
                const savedTask = localStorage.getItem('selectedTask');
                return savedTask ? JSON.parse(savedTask) : null;
            }
        }
        
        async function saveTaskToFirebase(task) {
            try {
                if (!db) {
                    console.warn('Firebase not available, saving to localStorage');
                    saveTaskToLocalStorage(task);
                    return;
                }
                
                const userId = auth.currentUser ? auth.currentUser.uid : 'anonymous';
                await db.collection('users').doc(userId).collection('timertasks').doc(task.id).set({
                    ...task,
                    userId: userId,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
            } catch (error) {
                console.warn('Failed to save to Firebase, using localStorage:', error);
                saveTaskToLocalStorage(task);
            }
        }
        
        async function deleteTaskFromFirebase(taskId) {
            try {
                if (!db) {
                    console.warn('Firebase not available, deleting from localStorage');
                    deleteTaskFromLocalStorage(taskId);
                    return;
                }
                
                const userId = auth.currentUser ? auth.currentUser.uid : 'anonymous';
                await db.collection('users').doc(userId).collection('timertasks').doc(taskId).delete();
            } catch (error) {
                console.warn('Failed to delete from Firebase, using localStorage:', error);
                deleteTaskFromLocalStorage(taskId);
            }
        }
        
        async function loadTasksFromFirebase() {
            try {
                if (!db) {
                    console.warn('Firebase not available, loading from localStorage');
                    loadTasksFromLocalStorage();
                    return;
                }
                
                if (!auth.currentUser) {
                    console.warn('User not authenticated, loading from localStorage');
                    loadTasksFromLocalStorage();
                    return;
                }
                
                const userId = auth.currentUser.uid;
                const querySnapshot = await db.collection('users').doc(userId).collection('timertasks')
                    .orderBy('createdAt', 'desc')
                    .get();
                
                tasks = [];
                querySnapshot.forEach((doc) => {
                    const taskData = doc.data();
                    tasks.push({
                        id: doc.id,
                        name: taskData.name,
                        color: taskData.color,
                        createdAt: taskData.createdAt?.toDate() || new Date(),
                        userId: taskData.userId
                    });
                });
                
                renderTaskList();
                
                // Load selected task after loading all tasks
                const savedSelectedTask = await loadSelectedTaskFromFirebase();
                if (savedSelectedTask) {
                    selectedTask = savedSelectedTask;
                } else {
                    selectedTask = null;
                }
                updateTaskDisplay();
                
            } catch (error) {
                console.warn('Failed to load from Firebase, using localStorage:', error);
                loadTasksFromLocalStorage();
            }
        }
        
        // LocalStorage Fallback Functions
        function saveTaskToLocalStorage(task) {
            try {
                const storedTasks = JSON.parse(localStorage.getItem('timerTasks') || '[]');
                storedTasks.push(task);
                localStorage.setItem('timerTasks', JSON.stringify(storedTasks));
            } catch (error) {
                console.error('Error saving task to localStorage:', error);
            }
        }
        
        function deleteTaskFromLocalStorage(taskId) {
            try {
                const storedTasks = JSON.parse(localStorage.getItem('timerTasks') || '[]');
                const updatedTasks = storedTasks.filter(task => task.id !== taskId);
                localStorage.setItem('timerTasks', JSON.stringify(updatedTasks));
            } catch (error) {
                console.error('Error deleting task from localStorage:', error);
            }
        }
        
        function loadTasksFromLocalStorage() {
            try {
                const storedTasks = JSON.parse(localStorage.getItem('timerTasks') || '[]');
                tasks = storedTasks.map(task => ({
                    ...task,
                    createdAt: new Date(task.createdAt)
                }));
                renderTaskList();
                
                // Load selected task from localStorage
                const savedSelectedTask = localStorage.getItem('selectedTask');
                if (savedSelectedTask) {
                    const parsed = JSON.parse(savedSelectedTask);
                    // Only restore if task still exists in the list
                    if (parsed && tasks.some(t => t.id === parsed.id)) {
                        selectedTask = parsed;
                        updateTaskDisplay();
                    } else {
                        // Clean up stale selection
                        try { localStorage.removeItem('selectedTask'); } catch {}
                        selectedTask = null;
                        updateTaskDisplay();
                    }
                } else {
                    selectedTask = null;
                    updateTaskDisplay();
                }
                
            } catch (error) {
                console.error('Error loading tasks from localStorage:', error);
                tasks = [];
                renderTaskList();
            }
        }

        // Initialize task management when DOM is loaded
        document.addEventListener('DOMContentLoaded', function() {
            initializeTaskManagement();
        });
    
