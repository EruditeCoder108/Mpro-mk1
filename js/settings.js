/**
 * Timer Settings Management System
 * Handles all settings-related functionality for the timer application
 */

// Default settings values
// FIREBASE INTEGRATION: These settings should be stored in Firestore users/{userId}/preferences/
const DEFAULT_SETTINGS = {
    timerStyle: '1', // FIREBASE: User's timer style preference
    timerContainerOpacity: 0.85, // FIREBASE: User's timer container opacity preference
    buttonContainerOpacity: 0.85, // FIREBASE: User's button container opacity preference
    timerPositionLocked: true, // FIREBASE: User's timer position lock preference
    // Rotating images settings
    rotatingImageOpacity: 0.5, // FIREBASE: User's rotating image opacity preference
    rotatingImagePositionLocked: true, // FIREBASE: User's rotating image position lock preference
    rotatingImageCount: 1, // FIREBASE: User's rotating image count preference
    rotatingImageRotationDuration: 3, // FIREBASE: User's rotating image rotation duration preference
    rotatingImageSize: 120, // FIREBASE: User's rotating image size preference
    useDefaultRotatingImages: null, // FIREBASE: User's default image usage preference
    // Motivational quotes settings
    showQuotes: true, // FIREBASE: User's quote visibility preference
    quoteSource: 'default', // FIREBASE: User's quote source preference
    personalQuotes: [] // FIREBASE: User's personal quotes collection
};

// Settings storage key - will be made user-specific when user is authenticated
const SETTINGS_STORAGE_KEY = 'TIMER_APP_SETTINGS'; // FIREBASE: User's settings data

/**
 * Get user-specific settings storage key
 * @returns {string} The storage key for current user or global key if no user
 */
function getSettingsStorageKey() {
    if (window.firebaseDataManager && firebaseDataManager.user) {
        return `TIMER_APP_SETTINGS_${firebaseDataManager.user.uid}`;
    }
    return SETTINGS_STORAGE_KEY;
}

// Key for storing personal rotating images
const PERSONAL_ROTATING_IMAGES_KEY = 'PERSONAL_ROTATING_IMAGES'; // FIREBASE: User's personal images

// Flag to prevent race conditions during user interactions
let isUserInteracting = false;
let userInteractionTimeout = null;



// File size limit for rotating images (10MB)
const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

// Maximum number of personal rotating images
const MAX_PERSONAL_IMAGES = 5; // Set back to 5 images maximum

/**
 * Mark that user is interacting to prevent race conditions
 * @param {number} duration - How long to mark as interacting (default 500ms)
 */
function markUserInteracting(duration = 500) {
    isUserInteracting = true;
    
    // Clear existing timeout
    if (userInteractionTimeout) {
        clearTimeout(userInteractionTimeout);
    }
    
    // Set timeout to clear the flag
    userInteractionTimeout = setTimeout(() => {
        isUserInteracting = false;
    }, duration);
}



/**
 * Add a new quote field to the personal quotes list
 * @param {string} quoteText - Optional text to pre-fill the quote field
 */
function addQuoteField(quoteText = '') {
    const quoteInputList = document.getElementById('personal-quotes-input-list');
    const quotesCount = quoteInputList.querySelectorAll('.quote-input-container').length;
    const MAX_PERSONAL_QUOTES = 20;
    
    // Don't add more than the maximum
    if (quotesCount >= MAX_PERSONAL_QUOTES) return;
    
    // Create the container
    const container = document.createElement('div');
    container.className = 'quote-input-container';
    
    // Create the textarea
    const textarea = document.createElement('textarea');
    textarea.className = 'quote-textarea';
    textarea.placeholder = 'Enter your quote...';
    textarea.value = quoteText || '';
    
    // Add a remove button (only if it's not the first quote field)
    if (quotesCount > 0) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'quote-remove-btn';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remove this quote';
        removeBtn.addEventListener('click', function() {
            container.remove();
            
            // Re-enable the add button if it was disabled
            const addQuoteBtn = document.getElementById('add-new-quote-field-btn');
            if (addQuoteBtn && addQuoteBtn.disabled) {
                addQuoteBtn.disabled = false;
            }
        });
        
        container.appendChild(removeBtn);
    }
    
    container.appendChild(textarea);
    quoteInputList.appendChild(container);
    
    // Focus the new textarea
    textarea.focus();
}

/**
 * Get all personal quotes from the input fields
 * @returns {string[]} Array of non-empty quotes
 */
function getPersonalQuotes() {
    const quoteInputList = document.getElementById('personal-quotes-input-list');
    const textareas = quoteInputList.querySelectorAll('.quote-textarea');
    const quotes = [];
    
    textareas.forEach(textarea => {
        const quote = textarea.value.trim();
        if (quote) {
            quotes.push(quote);
        }
    });
    
    return quotes;
}

/**
 * Save personal quotes to settings and localStorage
 */
async function savePersonalQuotes() {
    const quotes = getPersonalQuotes();
    
    // Update settings
    await saveAppSettings({ personalQuotes: quotes });
    
    // Save to localStorage for timer.js to access
    localStorage.setItem('timerPersonalQuotesList', JSON.stringify(quotes));
    
    // Show feedback to user
    showSaveConfirmation('Quotes saved successfully!', 'success');
    
    // Reload quotes if we're using personal quotes
    if (document.getElementById('quote-mode-custom') && document.getElementById('quote-mode-custom').checked && typeof loadActiveQuotes === 'function') {
        loadActiveQuotes();
        initializeQuotes();
    }
}

/**
 * Load personal quotes from settings to the UI
 */
function loadPersonalQuotes() {
    const settings = loadSettings();
    const quoteInputList = document.getElementById('personal-quotes-input-list');
    const addQuoteBtn = document.getElementById('add-new-quote-field-btn');
    
    // Clear existing quote fields
    quoteInputList.innerHTML = '';
    
    // Add fields for saved quotes
    if (settings.personalQuotes && settings.personalQuotes.length > 0) {
        settings.personalQuotes.forEach(quote => {
            addQuoteField(quote);
        });
    } else {
        // If no saved quotes, add one empty field
        addQuoteField();
    }
    
    // Update the add button state
    const quotesCount = quoteInputList.querySelectorAll('.quote-input-container').length;
    addQuoteBtn.disabled = quotesCount >= 20;
}

/**
 * Show a confirmation message after saving
 * @param {string} message - The message to display
 * @param {string} type - 'success' or 'error'
 */
function showSaveConfirmation(message, type = 'success') {
    // Check if there's already a confirmation message
    let confirmationEl = document.getElementById('quotes-save-confirmation');
    
    // If not, create one
    if (!confirmationEl) {
        confirmationEl = document.createElement('div');
        confirmationEl.id = 'quotes-save-confirmation';
        confirmationEl.style.marginTop = '10px';
        confirmationEl.style.padding = '8px 12px';
        confirmationEl.style.borderRadius = '4px';
        confirmationEl.style.textAlign = 'center';
        confirmationEl.style.fontSize = '0.9em';
        confirmationEl.style.transition = 'opacity 0.3s ease';
        
        // Insert after the quotes actions
        const quotesActions = document.querySelector('.quotes-actions');
        if (quotesActions) {
            quotesActions.after(confirmationEl);
        }
    }
    
    // Set styles based on message type
    if (type === 'success') {
        confirmationEl.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
        confirmationEl.style.color = '#34d399';
        confirmationEl.style.border = '1px solid rgba(16, 185, 129, 0.3)';
    } else {
        confirmationEl.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
        confirmationEl.style.color = '#f87171';
        confirmationEl.style.border = '1px solid rgba(239, 68, 68, 0.3)';
    }
    
    // Set the message
    confirmationEl.textContent = message;
    
    // Make sure it's visible
    confirmationEl.style.opacity = '1';
    
    // Hide after 3 seconds
    setTimeout(() => {
        confirmationEl.style.opacity = '0';
        setTimeout(() => {
            confirmationEl.remove();
        }, 300);
    }, 3000);
}

/**
 * Initialize settings when page loads
 */
async function initializeSettings() {
    
    // AUTH GATE: Wait for Firebase authentication to complete before loading settings
    if (window.firebaseDataManager) {
        await window.firebaseDataManager.authReady;
    }
    
    // Load saved settings or use defaults
    const settings = loadSettings();
    
    // Apply saved settings to UI
    applySettings(settings);
    
    // Set up event listeners for settings controls
    setupSettingsEventListeners();
    
    // Set up section toggle functionality
    setupSettingsSectionToggles();

    // Update timer style selector state based on current mode
    updateTimerStyleSelectorState();
    
    // Update button states based on current mode
    updateButtonStates();
    
    // Make sure the rotation interval is started (after a short delay to ensure DOM is ready)
    setTimeout(() => {
        // Force an initial rotation to ensure the correct image is showing
        rotateImages();
        // Start the rotation interval
        updateRotationInterval();
    }, 1000);
    
    
    // FIREBASE INTEGRATION: Re-apply settings after Firebase loads user data
    if (window.firebaseDataManager) {
        // If Firebase is already initialized and user is authenticated, reload settings
        if (firebaseDataManager.user) {
            // Wait a bit longer for Firebase to fully initialize
            setTimeout(async () => {
                await reloadSettingsFromFirebase();
            }, 500);
        } else {
            // Listen for auth state changes to reload settings when user logs in
            firebase.auth().onAuthStateChanged(async (user) => {
                if (user) {
                    // User just logged in, reload settings from Firebase
                    setTimeout(async () => {
                        await reloadSettingsFromFirebase();
                    }, 100);
                }
            });
        }
    }
}

/**
 * Load settings from localStorage or use defaults
 * @returns {Object} The current settings
 */
function loadSettings() {
    try {
        const storageKey = getSettingsStorageKey();
        const savedSettings = localStorage.getItem(storageKey);
        if (savedSettings) {
            let parsedSettings = JSON.parse(savedSettings);

            // Fix for opacity issue: if old low opacity values exist, use defaults instead
            if (parsedSettings.timerContainerOpacity && parsedSettings.timerContainerOpacity < 0.5) {
                parsedSettings.timerContainerOpacity = DEFAULT_SETTINGS.timerContainerOpacity;
            }
            if (parsedSettings.buttonContainerOpacity && parsedSettings.buttonContainerOpacity < 0.5) {
                parsedSettings.buttonContainerOpacity = DEFAULT_SETTINGS.buttonContainerOpacity;
            }

            return { ...DEFAULT_SETTINGS, ...parsedSettings };
        }
    } catch (error) {
        console.error("Error loading settings:", error);
    }

    return { ...DEFAULT_SETTINGS };
}

/**
 * Reload settings from Firebase when user authenticates
 * This ensures Firebase settings override localStorage defaults
 */
async function reloadSettingsFromFirebase() {
    if (!window.firebaseDataManager || !firebaseDataManager.user) {
        return;
    }
    
    try {
        
        const currentSettings = loadSettings();
        let settingsChanged = false;
        
        // Load button container opacity from Firebase 
        const savedButtonOpacity = await firebaseDataManager.loadUserPreference('buttonContainerOpacity', null);
        if (savedButtonOpacity !== null) {
            currentSettings.buttonContainerOpacity = savedButtonOpacity;
            settingsChanged = true;
            
            // Apply the updated opacity
            applyContainerOpacity(currentSettings.timerContainerOpacity, savedButtonOpacity);
            
            // Update the UI slider
            const buttonOpacitySlider = document.getElementById('button-opacity-slider');
            const buttonOpacityValue = document.getElementById('button-opacity-value');
            if (buttonOpacitySlider && buttonOpacityValue) {
                buttonOpacitySlider.value = savedButtonOpacity;
                buttonOpacityValue.textContent = Math.round(savedButtonOpacity * 100) + '%';
            }
        }
        
        // Load rotating images settings from Firebase
        const savedUseDefaultRotatingImages = await firebaseDataManager.loadUserPreference('useDefaultRotatingImages', undefined);
        if (savedUseDefaultRotatingImages !== undefined) {
            currentSettings.useDefaultRotatingImages = savedUseDefaultRotatingImages;
            settingsChanged = true;
        }
        
        const savedRotatingImageOpacity = await firebaseDataManager.loadUserPreference('rotatingImageOpacity', null);
        if (savedRotatingImageOpacity !== null) {
            currentSettings.rotatingImageOpacity = savedRotatingImageOpacity;
            settingsChanged = true;
        }
        
        const savedRotatingImagePositionLocked = await firebaseDataManager.loadUserPreference('rotatingImagePositionLocked', null);
        if (savedRotatingImagePositionLocked !== null) {
            currentSettings.rotatingImagePositionLocked = savedRotatingImagePositionLocked;
            settingsChanged = true;
        }
        
        const savedRotatingImageSize = await firebaseDataManager.loadUserPreference('rotatingImageSize', null);
        if (savedRotatingImageSize !== null) {
            currentSettings.rotatingImageSize = savedRotatingImageSize;
            settingsChanged = true;
        }
        
        // Load quote settings from Firebase
        const savedQuoteSource = await firebaseDataManager.loadUserPreference('quoteSource', null);
        if (savedQuoteSource !== null) {
            currentSettings.quoteSource = savedQuoteSource;
            settingsChanged = true;
        }
        
        const savedShowQuotes = await firebaseDataManager.loadUserPreference('showQuotes', null);
        if (savedShowQuotes !== null) {
            currentSettings.showQuotes = savedShowQuotes;
            settingsChanged = true;
        }
        
        // Save the updated settings back to localStorage if anything changed
        if (settingsChanged) {
            const storageKey = getSettingsStorageKey();
            localStorage.setItem(storageKey, JSON.stringify(currentSettings));
            
            // Re-apply the settings to update the UI
            await applySettings(currentSettings);
        }
        
    } catch (error) {
        console.error('Error reloading settings from Firebase:', error);
    }
}

/**
 * Save settings to localStorage
 * @param {Object} settings - The settings to save
 */
// FIREBASE INTEGRATION: This function should save settings to Firestore
async function saveAppSettings(settings) {
    try {
        const mergedSettings = { ...loadSettings(), ...settings };
        // FIREBASE INTEGRATION: Save to Firestore users/{userId}/preferences/
        const storageKey = getSettingsStorageKey();
        localStorage.setItem(storageKey, JSON.stringify(mergedSettings));
        
        // Save critical settings to Firebase if user is authenticated
        if (window.firebaseDataManager && firebaseDataManager.user) {
            // Save rotating images settings to Firebase
            if (settings.useDefaultRotatingImages !== undefined) {
                await firebaseDataManager.saveUserPreference('useDefaultRotatingImages', settings.useDefaultRotatingImages);
            }
            if (settings.rotatingImageOpacity !== undefined) {
                await firebaseDataManager.saveUserPreference('rotatingImageOpacity', settings.rotatingImageOpacity);
            }
            if (settings.rotatingImagePositionLocked !== undefined) {
                await firebaseDataManager.saveUserPreference('rotatingImagePositionLocked', settings.rotatingImagePositionLocked);
            }
            if (settings.rotatingImageSize !== undefined) {
                await firebaseDataManager.saveUserPreference('rotatingImageSize', settings.rotatingImageSize);
            }
            
            // Save quote settings to Firebase
            if (settings.quoteSource !== undefined) {
                await firebaseDataManager.saveUserPreference('quoteSource', settings.quoteSource);
            }
            if (settings.showQuotes !== undefined) {
                await firebaseDataManager.saveUserPreference('showQuotes', settings.showQuotes);
            }
        }
        
        return mergedSettings;
    } catch (error) {
        console.error("Error saving settings:", error);
        return null;
    }
}

/**
 * Apply settings to the UI and functionality
 * @param {Object} settings - The settings to apply
 */
async function applySettings(settings) {
    // Check if user is currently interacting - if so, don't overwrite their changes
    if (isUserInteracting) {
        return;
    }
    
    
    // Apply timer style
    applyTimerStyle(settings.timerStyle);
    
    // Apply opacity settings
    applyContainerOpacity(settings.timerContainerOpacity, settings.buttonContainerOpacity);
    
    // Apply rotating images settings
    applyRotatingImagesSettings(settings);
    
    // Update settings form with current values
    updateSettingsForm(settings);
}

/**
 * Apply rotating images settings
 * @param {Object} settings - Settings containing rotating images properties
 */
async function applyRotatingImagesSettings(settings) {
    
    // Check if rotating images are disabled
    if (settings.useDefaultRotatingImages === null) {
        // Clear the rotating images container
        const imageContainer = document.getElementById('rotating-images');
        if (imageContainer) {
            imageContainer.innerHTML = '';
            imageContainer.style.display = 'none';
        }
        // Stop any active rotation
        stopImageRotation();
        return;
    }
    
    // Show the rotating images container
    const imageContainer = document.getElementById('rotating-images');
    if (imageContainer) {
        imageContainer.style.display = 'block';
    }
    
    // Apply saved position if it exists
    if (imageContainer && settings.rotatingImagePosition) {
        const { x, y } = settings.rotatingImagePosition;
        imageContainer.style.position = 'fixed';
        imageContainer.style.left = `${x}px`;
        imageContainer.style.top = `${y}px`;
    }
    
    // Apply image source setting (personal images or none)
    // This needs to be done first as it creates the image elements
    await applyImageSource(settings.useDefaultRotatingImages === false);
    
    // Short delay to ensure images are loaded before applying other settings
    setTimeout(() => {
        // Apply opacity setting
        applyImageOpacity(settings.rotatingImageOpacity);
        
        // Apply position lock setting
        applyPositionLock(settings.rotatingImagePositionLocked);
        
        
        // Apply image size setting
        applyImageSize(settings.rotatingImageSize);
        
        // Initialize rotation but don't start it
        updateRotationInterval(); 
        
    }, 100);
}
/**
 * Apply opacity to rotating images
 * @param {number} opacity - Opacity value (0-1)
 */
function applyImageOpacity(opacity) {
    const images = document.querySelectorAll('.rotating-image');
    images.forEach(img => {
        img.style.opacity = opacity;
    });
}

/**
 * Lock or unlock rotating images position
 * @param {boolean} isLocked - Whether position is locked
 */
function applyPositionLock(isLocked) {
    const imageContainer = document.getElementById('rotating-images');
    if (imageContainer) {
        // Update cursor style
        imageContainer.style.cursor = isLocked ? 'default' : 'move';
        
        if (isLocked) {
            // When locked, remove the ability to start a drag
            imageContainer.onmousedown = null;
            imageContainer.ontouchstart = null;
        } else {
            // When unlocked, set up the drag handlers
            setupImageDragHandlers();
        }
    }
}

/**
 * Set up drag event handlers for the rotating images container
 */
function setupImageDragHandlers() {
    const imageContainer = document.getElementById('rotating-images');
    if (!imageContainer) return;

    let isDragging = false;
    let offsetX, offsetY;

    // These functions will be attached to the document to ensure smooth dragging
    // even if the cursor moves outside the image container.
    const dragMove = (e) => {
        if (!isDragging) return;
        e.preventDefault(); // Prevent text selection, etc.

        // Get clientX/clientY from either mouse or touch event
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);

        if (clientX && clientY) {
            // Update position based on mouse movement
            imageContainer.style.position = 'fixed';
            imageContainer.style.left = `${clientX - offsetX}px`;
            imageContainer.style.top = `${clientY - offsetY}px`;
        }
    };

    const dragEnd = (e) => {
        if (!isDragging) return;
        isDragging = false;
        
        // Restore styles and cursor
        imageContainer.style.transition = 'all 0.3s ease';
        imageContainer.style.zIndex = '';
        imageContainer.style.cursor = 'move'; // Back to the 'move' cursor

        // Save the final position
        saveRotatingImagePosition(
            parseFloat(imageContainer.style.left),
            parseFloat(imageContainer.style.top)
        );
        
        // Remove the document-level event listeners
        document.removeEventListener('mousemove', dragMove);
        document.removeEventListener('mouseup', dragEnd);
        document.removeEventListener('touchmove', dragMove);
        document.removeEventListener('touchend', dragEnd);
    };

    // Main function to start the drag, attached to the image container
    const dragStart = (e) => {
        // Only start drag if position is not locked
        const settings = loadSettings();
        if (settings.rotatingImagePositionLocked) return;
        
        isDragging = true;
        
        // Get the initial mouse position and element's position
        const rect = imageContainer.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        
        if (!clientX || !clientY) return;
        
        offsetX = clientX - rect.left;
        offsetY = clientY - rect.top;

        // Apply styles for during the drag
        imageContainer.style.transition = 'none'; // CRITICAL for smooth dragging
        imageContainer.style.zIndex = '1000';
        imageContainer.style.cursor = 'grabbing';
        
        // Add listeners to the entire document
        document.addEventListener('mousemove', dragMove);
        document.addEventListener('mouseup', dragEnd);
        document.addEventListener('touchmove', dragMove, { passive: false });
        document.addEventListener('touchend', dragEnd);
        
        // Prevent default to avoid text selection and other browser behaviors
        e.preventDefault();
    };

    // Attach the initial mousedown event listener
    imageContainer.onmousedown = dragStart;
    // Add touch support as well
    imageContainer.ontouchstart = dragStart;
}

/**
 * Save the position of the rotating images container
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 */
async function saveRotatingImagePosition(x, y) {
    if (isNaN(x) || isNaN(y)) return;
    
    const settings = loadSettings();
    settings.rotatingImagePosition = { x, y };
    await saveAppSettings(settings);
}

/**
 * Load the saved position of the rotating images container
 * @returns {Object} Position object with x and y coordinates
 */
function loadRotatingImagePosition() {
    const settings = loadSettings();
    return settings.rotatingImagePosition || { x: 20, y: 20 }; // Default position
}


/**
 * Apply size to rotating images
 * @param {number} size - Size in pixels (no limits applied)
 */
async function applyImageSize(size) {
    
    // First save the setting to ensure persistence
    await saveAppSettings({ rotatingImageSize: size });
    
    // Get all images
    const images = document.querySelectorAll('.rotating-image');
    
    // If no images found yet, will be applied later
    if (images.length === 0) {
        return;
    }
    
    // Apply to all existing images - no size limits
    images.forEach(img => {
        img.style.width = size + 'px';
        img.style.height = 'auto';
        img.style.maxWidth = 'none';
        img.style.maxHeight = 'none';
    });
    
    // Update the UI slider if it exists
    const sizeSlider = document.getElementById('rotating-image-size-slider');
    if (sizeSlider && parseInt(sizeSlider.value) !== size) {
        sizeSlider.value = size;
    }
    
    // Update the size display if it exists
    const sizeValue = document.getElementById('rotating-image-size-value');
    if (sizeValue) {
        sizeValue.textContent = size + 'px';
    }
}

/**
 * Rotate through the available images
 * @param {boolean} [forceInitialization=false] - If true, just ensures one image is active without rotation
 */
function rotateImages(forceInitialization = false) {
    const images = document.querySelectorAll('.rotating-image');
    if (images.length === 0) return;
    
    // Get the settings
    const settings = loadSettings();
    const maxImages = Math.min(settings.rotatingImageCount, images.length);
    
    // Handle single image case (or when max is set to 1)
    if (images.length === 1 || maxImages <= 1) {
        // Ensure the first image is active
        if (images[0] && !images[0].classList.contains('active')) {
            images[0].classList.add('active');
        }
        return;
    }
    
    // Find the current active image index
    let currentIndex = -1;
    for (let i = 0; i < images.length; i++) {
        if (images[i].classList.contains('active')) {
            currentIndex = i;
            break;
        }
    }
    
    // If no active image is found or during initialization, set the first one as active
    if (currentIndex === -1 || forceInitialization) {
        // First deactivate all images for clean initialization
        images.forEach(img => img.classList.remove('active'));
        
        // Then activate the first one
        if (images[0]) {
            images[0].classList.add('active');
        }
        return;
    }
    
    // Only proceed with rotation if we're not just initializing
    if (!forceInitialization) {
        // Calculate the next image index, ensuring we only use up to maxImages
        let nextIndex = (currentIndex + 1) % Math.min(maxImages, images.length);
        
        // Check if we need to rotate (don't rotate if only 1 image or if paused)
        if (nextIndex === currentIndex || !window.rotationState.isActive) return;
        
        // First deactivate all images for clean transition
        images.forEach(img => img.classList.remove('active'));
        
        // Then activate the next image
        images[nextIndex].classList.add('active');
        
        // Update the last rotation time
        window.rotationState.lastRotationTime = Date.now();
        
        // Only log rotation if we actually rotated
        if (settings.useDefaultRotatingImages === false) {
        }
    }
}

// Track rotation state and timing information
window.rotationState = {
    isActive: false,
    lastRotationTime: 0,
    fixedDurationMins: 3, // Fixed at 3 minutes
    get durationMs() { return this.fixedDurationMins * 60 * 1000; }
};

/**
 * Update the image rotation interval configuration - but doesn't start it
 */
function updateRotationInterval() {
    // Clear any existing interval
    if (window.imageInterval) {
        clearInterval(window.imageInterval);
        window.imageInterval = null;
    }
    
    
    // Images will only start rotating when startImageRotation() is called
}

/**
 * Start the image rotation - called when timer/stopwatch starts
 */
function startImageRotation() {
    // If already active, don't restart
    if (window.rotationState.isActive) return;
    
    // Clear any existing interval to be safe
    if (window.imageInterval) {
        clearInterval(window.imageInterval);
    }
    
    // Initialize last rotation time if it's 0
    if (window.rotationState.lastRotationTime === 0) {
        window.rotationState.lastRotationTime = Date.now();
    }
    
    // Set the new interval
    window.imageInterval = setInterval(rotateImages, window.rotationState.durationMs);
    window.rotationState.isActive = true;
    
    
    // Run an immediate rotation if using personal images and we have multiple to rotate
    const settings = loadSettings();
    if (!settings.useDefaultRotatingImages) {
        const images = document.querySelectorAll('.rotating-image');
        if (images.length > 1) {
            // Wait a small delay before first rotation
            setTimeout(rotateImages, 3000);
        }
    }
}

/**
 * Pause the image rotation - called when timer/stopwatch pauses
 */
function pauseImageRotation() {
    if (!window.rotationState.isActive) return;
    
    // Clear the interval
    if (window.imageInterval) {
        clearInterval(window.imageInterval);
        window.imageInterval = null;
    }
    
    window.rotationState.isActive = false;
    
    // Store the last rotation time
    window.rotationState.lastRotationTime = Date.now();
    
}

/**
 * Stop the image rotation - called when timer/stopwatch stops
 */
function stopImageRotation() {
    if (!window.rotationState.isActive && !window.imageInterval) return;
    
    // Clear the interval
    if (window.imageInterval) {
        clearInterval(window.imageInterval);
        window.imageInterval = null;
    }
    
    window.rotationState.isActive = false;
    window.rotationState.lastRotationTime = 0; // Reset timing info
    
    
    // Optional: reset to the first image in the series
    const settings = loadSettings();
    if (!settings.useDefaultRotatingImages) {
        const images = document.querySelectorAll('.rotating-image');
        if (images.length > 1) {
            // Reset to first image
            images.forEach((img, index) => {
                img.classList.toggle('active', index === 0);
            });
        }
    }
}

/**
 * Apply image source setting (personal images or none)
 * @param {boolean} usePersonal - Whether to use personal images (false means no images)
 */
async function applyImageSource(usePersonal) {
    
    // Clear the rotating images container
    const imageContainer = document.getElementById('rotating-images');
    if (!imageContainer) return;
    
    // Always stop rotation and clear interval before changing images
    if (typeof stopImageRotation === 'function') {
        stopImageRotation();
    } else if (window.imageInterval) {
        clearInterval(window.imageInterval);
        window.imageInterval = null;
    }
    
    // If not using personal images, we're done
    if (!usePersonal) {
        imageContainer.innerHTML = '';
        return;
    }
    
    // Remove all existing images with a clean transition
    imageContainer.style.opacity = '0.3';
    setTimeout(async () => {
        // Clear container
        imageContainer.innerHTML = '';
        
        // Load personal images from localStorage
        const personalImages = await getPersonalImagesWithMetadata();
        
        // Add personal images - only first one is active initially
        personalImages.forEach((imageObj, index) => {
            const img = document.createElement('img');
            // Use storageUrl if available, otherwise fallback to dataUrl
            const imageUrl = imageObj.storageUrl || imageObj.dataUrl;
            img.src = imageUrl;
            img.alt = imageObj.name || `Personal Image ${index + 1}`;
            img.className = 'rotating-image'; // None active initially
            img.id = `rotate-img-${index + 1}`;
            imageContainer.appendChild(img);
        });
        
        // Fade back in with a smooth transition
        imageContainer.style.opacity = '1';
        
        // Initialize display with the first image only (no rotation yet)
        rotateImages(true); // Force initialization mode
        
        // Apply saved settings to the newly loaded images
        const settings = loadSettings();
        applyImageSize(settings.rotatingImageSize);
        applyImageOpacity(settings.rotatingImageOpacity);
        applyPositionLock(settings.rotatingImagePositionLocked);
        
        // This overrides any default CSS from the HTML file
        
        // Update the image count setting based on the number of images
        const imageCount = imageContainer.querySelectorAll('.rotating-image').length;
        await saveAppSettings({ rotatingImageCount: imageCount });
        
        // Update the hidden slider value
        const imageCountSlider = document.getElementById('rotating-image-count-slider');
        if (imageCountSlider) {
            imageCountSlider.value = imageCount;
        }
        
        // For debugging - update the count display (though it's hidden)
        const imageCountValue = document.getElementById('rotating-image-count-value');
        if (imageCountValue) {
            imageCountValue.textContent = imageCount;
        }
        
        
        // Configure rotation but don't start it yet - it will only start when timer/stopwatch starts
        updateRotationInterval();
        
        // Get timer/stopwatch running state
        const timerIsRunning = localStorage.getItem('timerIsRunning') === 'true';
        const stopwatchIsRunning = localStorage.getItem('stopwatchIsRunning') === 'true';
        
        // Only start rotation if a timer/stopwatch is already running
        if ((timerIsRunning || stopwatchIsRunning) && usePersonal && imageCount > 1) {
            if (typeof startImageRotation === 'function') {
                // Short delay to ensure smooth transition
                setTimeout(() => {
                    startImageRotation();
                }, 500);
            }
        }
    }, 300); // Short delay for opacity transition
}

/**
 * Get personal images from localStorage (legacy support)
 * @returns {Array} Array of image data URLs
 */
function getPersonalImages() {
    try {
        const savedImages = localStorage.getItem(PERSONAL_ROTATING_IMAGES_KEY);
        return savedImages ? JSON.parse(savedImages) : [];
    } catch (error) {
        console.error('Error loading personal images:', error);
        return [];
    }
}

/**
 * Get personal images with metadata from Firebase Storage with localStorage fallback
 * @returns {Promise<Array>} Array of image objects with metadata
 */
async function getPersonalImagesWithMetadata() {
    try {
        // Try to get from Firebase first if user is authenticated
        if (firebaseDataManager && firebaseDataManager.user && firebaseStorageManager) {
            try {
                const firebaseImages = await firebaseStorageManager.listFiles('rotatingImages');
                
                if (firebaseImages && firebaseImages.length > 0) {
                    // Convert Firebase files to our expected format
                    const images = firebaseImages.map((file, index) => ({
                        storageUrl: file.downloadURL,
                        name: file.name,
                        size: file.size,
                        uploadDate: file.uploadedAt,
                        type: file.type,
                        order: index,
                        // Include data URL for backward compatibility (will be null for Firebase images)
                        dataUrl: null
                    }));
                    
                    return images;
                }
            } catch (error) {
                console.warn('Failed to load images from Firebase, falling back to localStorage:', error);
            }
        }
        
        // Fallback to localStorage
        const dataUrls = getPersonalImages();
        return dataUrls.map((dataUrl, index) => ({
            dataUrl,
            order: index,
            name: `Image ${index + 1}`,
            size: 0,
            uploadDate: new Date().toISOString(),
            type: 'image/jpeg',
            storageUrl: null // No Firebase URL for localStorage images
        }));
    } catch (error) {
        console.error('Error loading personal images with metadata:', error);
        return [];
    }
}

/**
 * Save personal images to localStorage
 * @param {Array} images - Array of image data URLs
 */
async function savePersonalImages(images) {
    try {
        // Limit to maximum number of images
        const limitedImages = images.slice(0, MAX_PERSONAL_IMAGES);
        localStorage.setItem(PERSONAL_ROTATING_IMAGES_KEY, JSON.stringify(limitedImages));
        
        // Update image source if using personal images
        const settings = loadSettings();
        if (settings.useDefaultRotatingImages === false) {
            await applyImageSource(true);
        }
        
        return true;
    } catch (error) {
        console.error('Error saving personal images:', error);
        return false;
    }
}



/**
 * Add a personal image to the collection using Firebase Storage with localStorage fallback
 * @param {File} file - The image file to add
 * @returns {Promise<boolean>} A promise that resolves to whether the operation was successful
 */
async function addPersonalImage(file) {
    try {
        // Check file size
        if (file.size > MAX_IMAGE_FILE_SIZE) {
            toast.warning(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the maximum limit of ${MAX_IMAGE_FILE_SIZE / 1024 / 1024}MB.`);
            return false;
        }

        // Get existing images
        const existingImages = await getPersonalImagesWithMetadata();
        
        // Check if we've reached the maximum number of images
        if (existingImages.length >= MAX_PERSONAL_IMAGES) {
            toast.warning(`Maximum number of images (${MAX_PERSONAL_IMAGES})reached. Please remove some before adding more.`);
            return false;
        }

        // Try Firebase Storage first if user is authenticated
        if (firebaseDataManager && firebaseDataManager.user && firebaseStorageManager) {
            try {
                
                // Show upload progress (you can add a progress indicator later)
                const uploadResult = await firebaseStorageManager.uploadFile(
                    file, 
                    'rotatingImages', 
                    'image',
                    (progress) => {
                        // TODO: Update progress indicator in UI
                    }
                );
                
                
                // Update the UI if using personal images
                const settings = loadSettings();
                if (settings.useDefaultRotatingImages === false) {
                    await applyImageSource(true);
                }
                
                return true;
                
            } catch (error) {
                console.warn('Firebase upload failed, falling back to localStorage:', error);
                // Fall through to localStorage method
            }
        }
        
        // Fallback to localStorage method
        
        // Convert file to data URL for localStorage
                const dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = (error) => reject(error);
                    reader.readAsDataURL(file);
                });
        
        const newImage = {
                    dataUrl,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    uploadDate: new Date().toISOString()
                };
        
        // Add the new image to the collection
        existingImages.push(newImage);
        
        // Save to localStorage
        const dataUrls = existingImages.map(img => img.dataUrl).filter(url => url); // Filter out null dataUrls
        const success = await savePersonalImages(dataUrls);
        
        if (success) {
            // Update the UI if using personal images
            const settings = loadSettings();
            if (settings.useDefaultRotatingImages === false) {
                await applyImageSource(true);
            }
            
            return true;
        } else {
            console.error('Failed to save image collection');
            return false;
        }
    } catch (error) {
        console.error('Error adding personal image:', error);
        return false;
    }
}

/**
 * Remove a personal image from Firebase Storage with localStorage fallback
 * @param {number} index - The index of the image to remove
 * @returns {Promise<boolean>} Whether the operation was successful
 */
async function removePersonalImage(index) {
    try {
        // Get existing images with metadata
        const existingImages = await getPersonalImagesWithMetadata();
            
            // Check if the index is valid
            if (index < 0 || index >= existingImages.length) {
                console.error('Invalid image index:', index);
                return false;
            }
            
        const imageToRemove = existingImages[index];
        
        // Try to remove from Firebase Storage first if it's a Firebase image
        if (firebaseDataManager && firebaseDataManager.user && firebaseStorageManager && imageToRemove.storageUrl) {
            try {
                // Extract filename from the image name
                const filename = imageToRemove.name;
                await firebaseStorageManager.deleteFile('rotatingImages', filename);
                
                // Update the UI if using personal images
                const settings = loadSettings();
                if (!settings.useDefaultRotatingImages) {
                    await applyImageSource(false);
                }
                
                return true;
                
            } catch (error) {
                console.warn('Failed to delete from Firebase, falling back to localStorage:', error);
                // Fall through to localStorage method
            }
        }
        
        // Fallback to localStorage method for local images
        const localImages = getPersonalImages();
        
        // Check if the index is valid for localStorage images
        if (index < 0 || index >= localImages.length) {
            console.error('Invalid localStorage image index:', index);
            return false;
        }
        
        // Remove the image from localStorage
        localImages.splice(index, 1);
            
                    // Save the updated collection
        const success = await savePersonalImages(localImages);
        
        if (success) {
        }
        
        return success;
        
    } catch (error) {
        console.error('Error removing personal image:', error);
        return false;
    }
}









// Track plant growth state
let plantGrowthState = {
    currentStage: 0,
    totalStages: 5, // seed.png, stage1.png to stage5.png
    lastUpdateTime: 0,
    stageDuration: 0,
    isActive: false,
    plantInterval: null
};

/**
 * Update the plant growth stage based on timer progress
 * @param {number} elapsedTime - Time elapsed in seconds
 * @param {number} totalTime - Total timer duration in seconds
 */
function updatePlantGrowth(elapsedTime, totalTime) {
    if (totalTime <= 0 || !document.querySelector('.timer-container').classList.contains('timer-style-6')) {
        return;
    }

    // Calculate progress percentage
    const progress = Math.min(elapsedTime / totalTime, 1);
    
    // Calculate the current stage based on the progress bar segments
    // Each segment represents 1/5th of the progress
    const segmentWidth = 1 / plantGrowthState.totalStages;
    let newStage;
    
    // Special case: when progress is 100%, show the final stage
    if (progress >= 1) {
        newStage = plantGrowthState.totalStages; // This will show stage5.png
    } else {
        newStage = Math.min(
            Math.floor(progress / segmentWidth),
            plantGrowthState.totalStages - 1
        );
    }
    
    // Update plant stage if it has changed
    if (newStage !== plantGrowthState.currentStage) {
        plantGrowthState.currentStage = newStage;
        updatePlantImage();
    }
    
    // Always update progress bar to ensure smooth animation
    updateProgressBar(progress);
}

/**
 * Update the plant image based on current growth stage with smooth fade transition
 */
function updatePlantImage() {
    const plantImage = document.getElementById('plant-growth-image');
    if (!plantImage) return;
    
    // Start fade out
    plantImage.classList.add('fade-out');
    
    // After fade out completes, change image and fade in
    setTimeout(() => {
        // Update the image source based on current stage
        if (plantGrowthState.currentStage === 0) {
            plantImage.src = 'assets/images-webp/seed.webp';
        } else {
            plantImage.src = `assets/images-webp/stage${plantGrowthState.currentStage}.webp`;
        }
        
        // Ensure the new image is loaded before fading in
        plantImage.onload = function() {
            // Remove fade-out and add fade-in class
            plantImage.classList.remove('fade-out');
            plantImage.classList.add('fade-in');
            
            // Remove fade-in class after animation completes
            setTimeout(() => {
                if (plantImage) {
                    plantImage.classList.remove('fade-in');
                }
            }, 500);
        };
        
        // In case the image is cached and onload doesn't fire
        if (plantImage.complete) {
            plantImage.onload();
        }
    }, 300); // Match this with CSS transition time
    
    // Update active stage indicator
    updateActiveStageIndicator();
}

/**
 * Update the progress bar based on current progress
 * @param {number} progress - Progress value between 0 and 1
 */
function updateProgressBar(progress) {
    const progressBar = document.querySelector('.plant-progress-bar');
    if (!progressBar) return;
    
    // Update the progress bar width
    progressBar.style.setProperty('--progress', `${progress * 100}%`);
    
    // Update the pseudo-element width
    const progressFill = progressBar.querySelector('::after');
    if (progressFill) {
        progressFill.style.width = `${progress * 100}%`;
    }
}

/**
 * Update the active stage indicator in the progress bar
 */
function updateActiveStageIndicator() {
    const stages = document.querySelectorAll('.progress-stage');
    if (!stages.length) return;
    
    stages.forEach((stage, index) => {
        if (index <= plantGrowthState.currentStage) {
            stage.classList.add('active');
        } else {
            stage.classList.remove('active');
        }
    });
}

/**
 * Reset plant growth to initial state
 */
function resetPlantGrowth() {
    plantGrowthState.currentStage = 0;
    plantGrowthState.lastUpdateTime = 0;
    plantGrowthState.isActive = false;
    
    if (plantGrowthState.plantInterval) {
        clearInterval(plantGrowthState.plantInterval);
        plantGrowthState.plantInterval = null;
    }
    
    // Reset plant image
    const plantImage = document.getElementById('plant-growth-image');
    if (plantImage) {
        plantImage.src = 'assets/images-webp/seed.webp';
    }
    
    // Reset progress bar
    updateProgressBar(0);
    
    // Reset active stages
    const stages = document.querySelectorAll('.progress-stage');
    stages.forEach(stage => stage.classList.remove('active'));
}

/**
 * Initialize plant growth for style-6
 */
function initPlantGrowth() {
    resetPlantGrowth();
    
    // Show the plant growth container
    const plantContainer = document.getElementById('plant-growth-container');
    if (plantContainer) {
        plantContainer.style.display = 'flex';
    }
    
    // Mark as active
    plantGrowthState.isActive = true;
    
    // Set initial seed image
    updatePlantImage();
    
    // Initialize progress bar
    updateProgressBar(0);
    
    // Force an immediate update if there's an active timer
    if (typeof remainingSeconds !== 'undefined' && typeof initialTotalSeconds !== 'undefined' && initialTotalSeconds > 0) {
        const elapsed = initialTotalSeconds - remainingSeconds;
        updatePlantGrowth(elapsed, initialTotalSeconds);
    }
}

/**
 * Apply timer style based on selection
 * @param {string} styleId - The style ID (1-9)
 */
function applyTimerStyle(styleId) {
    // Check if we're already using this style to avoid unnecessary re-application
    const timerContainer = document.querySelector('.timer-container');
    const currentStyle = Array.from(timerContainer.classList).find(cls => cls.startsWith('timer-style-'));
    const currentStyleId = currentStyle ? currentStyle.replace('timer-style-', '') : null;
    
    if (currentStyleId === styleId) {
        return;
    }
    

    // Prevent switching to plant mode (style 6) when stopwatch is active
    if (styleId === '6') {
        // Check if stopwatch mode is active using localStorage
        const isStopwatchActive = localStorage.getItem('isStopwatchMode') === 'true';
        if (isStopwatchActive) {
            showToast('Plant mode can only be applied when Timer mode is on', 'warning', 4000);

            // Reset the dropdown to current style
            const timerStyleSelect = document.getElementById('timer-style-select');
            if (timerStyleSelect) {
                timerStyleSelect.value = currentStyleId || '1';
            }
            return;
        }
    }
    
    // Remove all style classes
    timerContainer.classList.remove(
        'timer-style-1', 'timer-style-2', 'timer-style-3', 
        'timer-style-4', 'timer-style-5', 'timer-style-6',
        'timer-style-7', 'timer-style-8', 'timer-style-9', 'timer-style-10'
    );
    
    // Add selected style class
    timerContainer.classList.add(`timer-style-${styleId}`);
    
    // If switching away from plant mode, clear any inline styles that might interfere
    if (currentStyleId === '6' && styleId !== '6') {
        // Clear inline styles that plant mode might have set
        timerContainer.style.backgroundColor = '';
        timerContainer.style.color = '';
        timerContainer.style.fontFamily = '';
        timerContainer.style.fontSize = '';
        timerContainer.style.fontWeight = '';
        timerContainer.style.border = '';
        timerContainer.style.boxShadow = '';
        timerContainer.style.padding = '';
    }
    
    // Apply current opacity settings to the new style
    // Get opacity values from UI sliders instead of loadSettings() to avoid race conditions
    const timerOpacitySlider = document.getElementById('timer-opacity-slider');
    const buttonOpacitySlider = document.getElementById('button-opacity-slider');
    const currentTimerOpacity = timerOpacitySlider ? parseFloat(timerOpacitySlider.value) : 0.85;
    const currentButtonOpacity = buttonOpacitySlider ? parseFloat(buttonOpacitySlider.value) : 0.85;

    applyContainerOpacity(currentTimerOpacity, currentButtonOpacity);
    
    // Handle plant growth container visibility and state
    const plantContainer = document.getElementById('plant-growth-container');
    if (plantContainer) {
        if (styleId === '6') {
            // Show and initialize plant growth for style-6
            plantContainer.style.display = 'flex';
            
            // Initialize plant growth if not already active
            if (!plantGrowthState?.isActive) {
                initPlantGrowth();
                
                // If there's an active timer, update plant growth progress
                if (typeof remainingSeconds !== 'undefined' && typeof initialTotalSeconds !== 'undefined' && initialTotalSeconds > 0) {
                    const elapsed = initialTotalSeconds - remainingSeconds;
                    updatePlantGrowth(elapsed, initialTotalSeconds);
                    updateProgressBar(elapsed / initialTotalSeconds);
                }
            }
            
            // Disable stopwatch and pomodoro buttons for plant mode
            disableTimerButtons();
        } else {
            // Hide and clean up plant growth for other styles
            plantContainer.style.display = 'none';
            
            // Reset plant growth state when switching away from style-6
            if (plantGrowthState?.isActive) {
                resetPlantGrowth();
            }
            
            // Re-enable stopwatch and pomodoro buttons for other styles
            enableTimerButtons();
        }
    }
    
    // Handle circular progress container visibility for style-10
    if (typeof toggleCircularProgress === 'function') {
        toggleCircularProgress();
    }
}

/**
 * Disable stopwatch and pomodoro buttons when in plant mode
 */
function disableTimerButtons() {
    const modeToggleBtn = document.getElementById('mode-toggle-btn');
    const pomodoroBtn = document.getElementById('pomodoro-btn');
    
    if (modeToggleBtn) {
        modeToggleBtn.disabled = true;
        modeToggleBtn.style.opacity = '0.5';
        modeToggleBtn.style.cursor = 'not-allowed';
        modeToggleBtn.title = 'Stopwatch disabled in Plant Mode';
    }
    
    if (pomodoroBtn) {
        pomodoroBtn.disabled = true;
        pomodoroBtn.style.opacity = '0.5';
        pomodoroBtn.style.cursor = 'not-allowed';
        pomodoroBtn.title = 'Pomodoro disabled in Plant Mode';
    }
    
}

/**
 * Enable stopwatch and pomodoro buttons when switching away from plant mode
 */
function enableTimerButtons() {
    const modeToggleBtn = document.getElementById('mode-toggle-btn');
    const pomodoroBtn = document.getElementById('pomodoro-btn');

    if (modeToggleBtn) {
        modeToggleBtn.disabled = false;
        modeToggleBtn.style.opacity = '1';
        modeToggleBtn.style.cursor = 'pointer';
        modeToggleBtn.title = 'Timer/Stopwatch';
    }

    if (pomodoroBtn) {
        pomodoroBtn.disabled = false;
        pomodoroBtn.style.opacity = '1';
        pomodoroBtn.style.cursor = 'pointer';
        pomodoroBtn.title = 'Pomodoro';
    }

}

// Function to disable pomodoro button when stopwatch is active
function disablePomodoroButton() {
    const pomodoroBtn = document.getElementById('pomodoro-btn');
    
    if (pomodoroBtn) {
        pomodoroBtn.disabled = true;
        pomodoroBtn.style.opacity = '0.5';
        pomodoroBtn.style.cursor = 'not-allowed';
        pomodoroBtn.title = 'Pomodoro disabled in Stopwatch mode';
    }
}

// Function to enable pomodoro button
function enablePomodoroButton() {
    const pomodoroBtn = document.getElementById('pomodoro-btn');
    
    if (pomodoroBtn) {
        pomodoroBtn.disabled = false;
        pomodoroBtn.style.opacity = '1';
        pomodoroBtn.style.cursor = 'pointer';
        pomodoroBtn.title = 'Pomodoro';
    }
}

// Function to disable stopwatch button when pomodoro is active
function disableStopwatchButton() {
    const modeToggleBtn = document.getElementById('mode-toggle-btn');
    
    if (modeToggleBtn) {
        modeToggleBtn.disabled = true;
        modeToggleBtn.style.opacity = '0.5';
        modeToggleBtn.style.cursor = 'not-allowed';
        modeToggleBtn.title = 'Stopwatch disabled in Pomodoro mode';
    }
}

// Function to enable stopwatch button
function enableStopwatchButton() {
    const modeToggleBtn = document.getElementById('mode-toggle-btn');
    
    if (modeToggleBtn) {
        modeToggleBtn.disabled = false;
        modeToggleBtn.style.opacity = '1';
        modeToggleBtn.style.cursor = 'pointer';
        modeToggleBtn.title = 'Timer/Stopwatch';
    }
}

// Function to update button states based on current mode
function updateButtonStates() {
    const isStopwatchActive = localStorage.getItem('isStopwatchMode') === 'true';
    const isPomodoroActive = localStorage.getItem('isPomodoroMode') === 'true';
    
    if (isStopwatchActive) {
        disablePomodoroButton();
        enableStopwatchButton();
    } else if (isPomodoroActive) {
        disableStopwatchButton();
        enablePomodoroButton();
    } else {
        enablePomodoroButton();
        enableStopwatchButton();
    }
}

/**
 * Disable or enable timer style selector based on pomodoro mode
 * @param {boolean} disable - Whether to disable the selector
 */
function toggleTimerStyleSelector(disable = false) {
    const timerStyleSelect = document.getElementById('timer-style-select');
    if (timerStyleSelect) {
        timerStyleSelect.disabled = disable;
        timerStyleSelect.style.opacity = disable ? '0.5' : '1';
        timerStyleSelect.style.cursor = disable ? 'not-allowed' : 'pointer';

        // Add or remove disabled class for styling
        if (disable) {
            timerStyleSelect.classList.add('disabled');
        } else {
            timerStyleSelect.classList.remove('disabled');
        }
    }
}

/**
 * Check and update timer style selector state based on current mode
 */
function updateTimerStyleSelectorState() {
    // Check if pomodoro mode is active
    const isPomodoroActive = typeof window.isPomodoroActive === 'function' && window.isPomodoroActive();
    toggleTimerStyleSelector(isPomodoroActive);
}

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - The type of toast ('info', 'success', 'warning', 'error')
 * @param {number} duration - How long to show the toast in milliseconds (default: 3000)
 */
function showToast(message, type = 'info', duration = 3000) {
    // Remove any existing toast
    const existingToast = document.getElementById('settings-toast');
    if (existingToast) {
        existingToast.remove();
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.id = 'settings-toast';
    toast.className = `settings-toast settings-toast-${type}`;
    toast.textContent = message;

    // Style the toast
    Object.assign(toast.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '12px 20px',
        borderRadius: '8px',
        color: 'white',
        fontSize: '14px',
        fontWeight: '500',
        zIndex: '10000',
        maxWidth: '300px',
        wordWrap: 'break-word',
        opacity: '0',
        transform: 'translateY(-20px)',
        transition: 'all 0.3s ease',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        pointerEvents: 'none'
    });

    // Set background color based on type
    switch (type) {
        case 'success':
            toast.style.backgroundColor = '#10b981';
            break;
        case 'warning':
            toast.style.backgroundColor = '#f59e0b';
            break;
        case 'error':
            toast.style.backgroundColor = '#ef4444';
            break;
        default: // info
            toast.style.backgroundColor = '#3b82f6';
    }

    // Add to page
    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }, 10);

    // Animate out and remove
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, duration);
}

/**
 * Apply opacity settings to containers using CSS custom properties.
 * @param {number} timerOpacity - Opacity for timer container (0-1)
 * @param {number} buttonOpacity - Opacity for button container (0-1)
 */
function applyContainerOpacity(timerOpacity, buttonOpacity) {
    // Apply timer container opacity using CSS custom properties
    const timerContainer = document.querySelector('.timer-container');
    if (timerContainer) {
        // Check if we're in plant mode (style 6) - don't apply opacity to transparent background
        const isPlantMode = timerContainer.classList.contains('timer-style-6');
        
        if (isPlantMode) {
            // For plant mode, keep background transparent
            timerContainer.style.backgroundColor = 'transparent';
        } else {
            // For other styles, preserve existing background color and use CSS custom properties
            // Don't clear backgroundColor - let the timer.js color picker control it
            timerContainer.style.setProperty('--timer-bg-opacity', timerOpacity);
        }
    }
    
    // Apply button container opacity (this logic remains the same)
    const buttonContainer = document.querySelector('.control-box-taskbar');
    if (buttonContainer) {
        // Preserve the existing gradient but adjust opacity
        buttonContainer.style.background = `linear-gradient(120deg, rgba(18,22,32,${buttonOpacity}) 0%, rgba(22,26,36,${buttonOpacity}) 100%)`;
    }
}

/**
 * Toggle quotes visibility and center timer digits when quotes are hidden
 * @param {boolean} showQuotes - Whether to show quotes
 */
function toggleQuotesVisibility(showQuotes) {
    const quoteContainer = document.getElementById('quote-display');
    const timerContainer = document.querySelector('.timer-container');
    
    if (quoteContainer) {
        if (showQuotes) {
            quoteContainer.style.display = 'block';
            quoteContainer.style.opacity = '1';
            // Remove centering when quotes are shown
            timerContainer.classList.remove('quotes-hidden');
        } else {
            quoteContainer.style.display = 'none';
            quoteContainer.style.opacity = '0';
            // Add centering class when quotes are hidden
            timerContainer.classList.add('quotes-hidden');
        }
    }
}

/**
 * Update settings form with current values
 * @param {Object} settings - The current settings
 */
function updateSettingsForm(settings) {
    // Update timer style dropdown
    const timerStyleSelect = document.getElementById('timer-style-select');
    if (timerStyleSelect) {
        timerStyleSelect.value = settings.timerStyle;
    }
    
    // Update compact quote mode radio buttons
    const quoteModeOff = document.getElementById('quote-mode-off');
    const quoteModeDefault = document.getElementById('quote-mode-default');
    const quoteModeCustom = document.getElementById('quote-mode-custom');
    const quoteColorDisplay = document.getElementById('quote-color-display');
    const quoteColorPicker = document.getElementById('quote-color-picker');
    
    if (quoteModeOff && quoteModeDefault && quoteModeCustom) {
        const showQuotes = settings.showQuotes !== false; // Default to true if not set
        const quoteSource = settings.quoteSource || 'default';
        
        // Uncheck all first
        quoteModeOff.checked = false;
        quoteModeDefault.checked = false;
        quoteModeCustom.checked = false;
        
        // Set the correct one based on settings
        if (!showQuotes) {
            quoteModeOff.checked = true;
        } else if (quoteSource === 'personal') {
            quoteModeCustom.checked = true;
        } else {
            quoteModeDefault.checked = true;
        }
        
        // Apply the visibility setting
        toggleQuotesVisibility(showQuotes);
    }
    
    // Update color display
    if (quoteColorDisplay && quoteColorPicker) {
        quoteColorDisplay.style.backgroundColor = quoteColorPicker.value;
    }
    
    // Update opacity sliders
    const timerOpacitySlider = document.getElementById('timer-opacity-slider');
    if (timerOpacitySlider) {
        timerOpacitySlider.value = settings.timerContainerOpacity;
        document.getElementById('timer-opacity-value').textContent = 
            Math.round(settings.timerContainerOpacity * 100) + '%';
    }
    
    const buttonOpacitySlider = document.getElementById('button-opacity-slider');
    if (buttonOpacitySlider) {
        buttonOpacitySlider.value = settings.buttonContainerOpacity;
        document.getElementById('button-opacity-value').textContent = 
            Math.round(settings.buttonContainerOpacity * 100) + '%';
    }
    
    // Update rotating images settings
    updateRotatingImagesForm(settings);
}

/**
 * Update rotating images settings form with current values
 * @param {Object} settings - The current settings
 */
function updateRotatingImagesForm(settings) {
    // Update opacity slider
    const opacitySlider = document.getElementById('rotating-image-opacity-slider');
    if (opacitySlider) {
        opacitySlider.value = settings.rotatingImageOpacity;
        document.getElementById('rotating-image-opacity-value').textContent = 
            Math.round(settings.rotatingImageOpacity * 100) + '%';
    }
    
    // Update image count slider
    const imageCountSlider = document.getElementById('rotating-image-count-slider');
    if (imageCountSlider) {
        imageCountSlider.value = settings.rotatingImageCount;
        document.getElementById('rotating-image-count-value').textContent = settings.rotatingImageCount;
    }
    
    // Update hidden duration field (fixed at 3 minutes)
    const durationSlider = document.getElementById('rotating-image-duration-slider');
    if (durationSlider) {
        durationSlider.value = 3; // Fixed at 3 minutes
    }
    
    // Update image size slider
    const imageSizeSlider = document.getElementById('rotating-image-size-slider');
    if (imageSizeSlider) {
        imageSizeSlider.value = settings.rotatingImageSize;
        document.getElementById('rotating-image-size-value').textContent = 
            settings.rotatingImageSize + 'px';
    }
    
    // Update position lock toggle
    const lockPositionToggle = document.getElementById('rotating-image-lock-position-toggle');
    if (lockPositionToggle) {
        lockPositionToggle.checked = settings.rotatingImagePositionLocked;
    }
    
    
    // Update image source radio buttons
    const noImagesRadio = document.getElementById('no-images-radio');
    const personalImagesRadio = document.getElementById('personal-images-radio');
    
    if (noImagesRadio && personalImagesRadio) {
        // Handle the case where rotating images are disabled
        if (settings.useDefaultRotatingImages === null) {
            noImagesRadio.checked = true;
            personalImagesRadio.checked = false;
            
            // Hide controls container
            const controlsContainer = document.getElementById('rotating-images-controls-container');
            if (controlsContainer) {
                controlsContainer.style.display = 'none';
            }
            
            // Hide personal images section
            const personalImagesSection = document.getElementById('personal-images-section');
            if (personalImagesSection) {
                personalImagesSection.style.display = 'none';
            }
        } else {
            noImagesRadio.checked = false;
            personalImagesRadio.checked = true;
            
            // Show controls container
            const controlsContainer = document.getElementById('rotating-images-controls-container');
            if (controlsContainer) {
                controlsContainer.style.display = 'block';
            }
            
            // Show personal images section
            const personalImagesSection = document.getElementById('personal-images-section');
            if (personalImagesSection) {
                personalImagesSection.style.display = 'block';
            }
            
            // Populate personal images grid
            populatePersonalImagesGrid();
        }
    }
}

/**
 * Populate the personal images grid with saved images
 */
async function populatePersonalImagesGrid() {
    const gridContainer = document.getElementById('personal-images-grid');
    if (!gridContainer) return;
    
    // Clear the grid
    gridContainer.innerHTML = '';
    
            // Get personal images from localStorage
    const personalImages = await getPersonalImagesWithMetadata();
    
    // Create slots for existing images
    personalImages.forEach((imageObj, index) => {
        const slot = document.createElement('div');
        slot.className = 'image-slot has-image';
        slot.dataset.index = index;
        
        // Create image element
        const img = document.createElement('img');
        // Use storageUrl if available, otherwise fallback to dataUrl
        const imageUrl = imageObj.storageUrl || imageObj.dataUrl;
        img.src = imageUrl;
        img.alt = imageObj.name || `Personal Image ${index + 1}`;
        slot.appendChild(img);
        
        // Create remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-image';
        removeBtn.innerHTML = '×';
        removeBtn.title = 'Remove image';
        removeBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to remove this image?')) {
                await removePersonalImage(index);
                // Repopulate the grid after a short delay to ensure the image is removed
                setTimeout(() => {
                    populatePersonalImagesGrid().catch(console.error);
                    // Update rotating images if using personal images
                    const settings = loadSettings();
                    if (settings.useDefaultRotatingImages === false) {
                        applyImageSource(true).catch(console.error);
                    }
                }, 100);
            }
        });
        slot.appendChild(removeBtn);
        
        // Add click handler to preview the image
        slot.addEventListener('click', (e) => {
            if (e.target === removeBtn) return; // Don't preview when clicking remove button
            // You could add a preview functionality here if desired
        });
        
        gridContainer.appendChild(slot);
    });
    
    // Create empty slots up to maximum if we have less than the max
    const remainingSlots = MAX_PERSONAL_IMAGES - personalImages.length;
    if (remainingSlots > 0) {
        for (let i = 0; i < remainingSlots; i++) {
            const slot = document.createElement('div');
            slot.className = 'image-slot';
            slot.title = 'Click to upload image';
            
            // Create add icon
            const addIcon = document.createElement('div');
            addIcon.className = 'add-icon';
            addIcon.textContent = '+';
            slot.appendChild(addIcon);
            
            // Add click handler to trigger file input
            slot.addEventListener('click', () => {
                const fileInput = document.getElementById('personal-image-input');
                if (fileInput) {
                    fileInput.value = ''; // Reset the input to allow selecting the same file again
                    fileInput.click();
                }
            });
            
            gridContainer.appendChild(slot);
        }
    }
}

/**
 * Set up event listeners for settings controls
 */
function setupSettingsEventListeners() {
    // Compact Quote Mode Selection event listeners
    const quoteModeOff = document.getElementById('quote-mode-off');
    const quoteModeDefault = document.getElementById('quote-mode-default');
    const quoteModeCustom = document.getElementById('quote-mode-custom');
    const personalQuotesManager = document.getElementById('personal-quotes-manager');
    const addQuoteBtn = document.getElementById('add-new-quote-field-btn');
    const saveQuotesBtn = document.getElementById('save-personal-quotes-btn');
    const quoteInputList = document.getElementById('personal-quotes-input-list');
    const quoteColorPicker = document.getElementById('quote-color-picker');
    const quoteColorDisplay = document.getElementById('quote-color-display');
    
    // Maximum number of personal quotes
    const MAX_PERSONAL_QUOTES = 20;
    
    // Load and initialize quote mode selection
    const settings = loadSettings();
    const showQuotes = settings.showQuotes !== false; // Default to true if not set
    const quoteSource = settings.quoteSource || 'default';
    
    // Set initial radio button state based on current settings
    if (quoteSource === 'off' || !showQuotes) {
        quoteModeOff.checked = true;
        personalQuotesManager.style.display = 'none';
    } else if (quoteSource === 'personal') {
        quoteModeCustom.checked = true;
        personalQuotesManager.style.display = 'block';
        loadPersonalQuotes();
    } else {
        quoteModeDefault.checked = true;
        personalQuotesManager.style.display = 'none';
    }
    
    // Update color display
    if (quoteColorDisplay && quoteColorPicker) {
        quoteColorDisplay.style.backgroundColor = quoteColorPicker.value;
    }
    
    // Quote mode radio buttons change event
    quoteModeOff.addEventListener('change', async function() {
        if (this.checked) {
            personalQuotesManager.style.display = 'none';
            await saveAppSettings({ showQuotes: false, quoteSource: 'off' });
            // Update localStorage directly for timer.js to access
            localStorage.setItem('timerQuoteSource', 'off');
            // Hide quotes
            toggleQuotesVisibility(false);
        }
    });
    
    quoteModeDefault.addEventListener('change', async function() {
        if (this.checked) {
            personalQuotesManager.style.display = 'none';
            await saveAppSettings({ showQuotes: true, quoteSource: 'default' });
            // Update localStorage directly for timer.js to access
            localStorage.setItem('timerQuoteSource', 'default');
            // Show quotes and reload default quotes
            toggleQuotesVisibility(true);
            if (typeof loadActiveQuotes === 'function') {
                loadActiveQuotes();
                initializeQuotes();
            }
        }
    });
    
    quoteModeCustom.addEventListener('change', async function() {
        if (this.checked) {
            personalQuotesManager.style.display = 'block';
            await saveAppSettings({ showQuotes: true, quoteSource: 'personal' });
            // Update localStorage directly for timer.js to access
            localStorage.setItem('timerQuoteSource', 'personal');
            loadPersonalQuotes();
            // Show quotes and reload personal quotes if they exist
            toggleQuotesVisibility(true);
            const personalQuotes = getPersonalQuotes();
            if (personalQuotes.length > 0) {
                if (typeof loadActiveQuotes === 'function') {
                    loadActiveQuotes();
                    initializeQuotes();
                }
            }
        }
    });
    
    // Color picker event listener
    if (quoteColorPicker && quoteColorDisplay) {
        quoteColorPicker.addEventListener('change', function() {
            const color = this.value;
            quoteColorDisplay.style.backgroundColor = color;
            // Save color setting (you may need to add this to your settings system)
            // saveAppSettings({ quoteColor: color });
        });
        
        // Click on color circle to open color picker
        quoteColorDisplay.addEventListener('click', function() {
            quoteColorPicker.click();
        });
    }
    
    // Add new quote field button
    addQuoteBtn.addEventListener('click', function() {
        const quotesCount = quoteInputList.querySelectorAll('.quote-input-container').length;
        if (quotesCount < MAX_PERSONAL_QUOTES) {
            addQuoteField();
            
            // Disable button if max reached
            if (quotesCount + 1 >= MAX_PERSONAL_QUOTES) {
                addQuoteBtn.disabled = true;
            }
        }
    });
    
    // Save personal quotes button
    saveQuotesBtn.addEventListener('click', function() {
        savePersonalQuotes();
    });
    
    // Initialize first quote field if needed
    if (quoteInputList.children.length === 0) {
        addQuoteField();
    }
    // Timer style dropdown change event
    const timerStyleSelect = document.getElementById('timer-style-select');
    if (timerStyleSelect) {
        timerStyleSelect.addEventListener('change', (e) => {
            const newStyle = e.target.value;
            
            // Mark that user is interacting
            markUserInteracting(1000); // 1 second protection
            
            // Apply the style immediately
            applyTimerStyle(newStyle);
            
            // Save settings to localStorage
            saveAppSettings({ timerStyle: newStyle });
            
        });
    }
    
    // Note: Quotes toggle is now handled by the compact quote mode radio buttons above
    
    // Timer container opacity slider
    const timerOpacitySlider = document.getElementById('timer-opacity-slider');
    if (timerOpacitySlider) {
        timerOpacitySlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            document.getElementById('timer-opacity-value').textContent = Math.round(value * 100) + '%';
            
            // Apply immediately for preview using CSS custom properties
            const timerContainer = document.querySelector('.timer-container');
            if (timerContainer) {
                const isPlantMode = timerContainer.classList.contains('timer-style-6');
                if (isPlantMode) {
                    timerContainer.style.backgroundColor = 'transparent';
                } else {
                    // Preserve existing background color and use CSS custom properties
                    // Don't clear backgroundColor - let the timer.js color picker control it
                    timerContainer.style.setProperty('--timer-bg-opacity', value);
                }
            }
        });
        
        timerOpacitySlider.addEventListener('change', (e) => {
            const newOpacity = parseFloat(e.target.value);
            saveAppSettings({ timerContainerOpacity: newOpacity });
            
            // Get current button opacity from the UI slider instead of loadSettings() 
            // to avoid race condition with Firebase sync
            const buttonOpacitySlider = document.getElementById('button-opacity-slider');
            const currentButtonOpacity = buttonOpacitySlider ? parseFloat(buttonOpacitySlider.value) : 0.85;
            
            applyContainerOpacity(newOpacity, currentButtonOpacity);
        });
    }
    
    // Button container opacity slider
    const buttonOpacitySlider = document.getElementById('button-opacity-slider');
    if (buttonOpacitySlider) {
        buttonOpacitySlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            document.getElementById('button-opacity-value').textContent = Math.round(value * 100) + '%';
            
            // Apply immediately for preview
            const buttonContainer = document.querySelector('.control-box-taskbar');
            if (buttonContainer) {
                buttonContainer.style.background = `linear-gradient(120deg, rgba(18,22,32,${value}) 0%, rgba(22,26,36,${value}) 100%)`;
            }
        });
        
        buttonOpacitySlider.addEventListener('change', (e) => {
            const newOpacity = parseFloat(e.target.value);
            saveAppSettings({ buttonContainerOpacity: newOpacity });
            
            // Get current timer opacity from the UI slider instead of loadSettings()
            // to avoid race condition with Firebase sync
            const timerOpacitySlider = document.getElementById('timer-opacity-slider');
            const currentTimerOpacity = timerOpacitySlider ? parseFloat(timerOpacitySlider.value) : 0.85;
            
            applyContainerOpacity(currentTimerOpacity, newOpacity);
            
            // FIREBASE INTEGRATION: Save button container opacity to Firebase
            if (window.firebaseDataManager && firebaseDataManager.user) {
                firebaseDataManager.saveUserPreference('buttonContainerOpacity', newOpacity);
            }
        });
    }
    
    // Set up rotating images settings event listeners
    setupRotatingImagesEventListeners();
    
    // Set up timer container color picker event listeners
    setupTimerContainerColorListeners();
    
    // Goal Countdown Toggle
    const goalCountdownToggle = document.getElementById('goal-countdown-toggle');
    if (goalCountdownToggle) {
        // Function to sync toggle state with widget
        const syncToggleState = () => {
            if (window.GoalCountdownWidget) {
                goalCountdownToggle.checked = GoalCountdownWidget.isEnabled();
            }
        };
        
        // Set initial state (try immediately and retry after delay if widget not ready)
        syncToggleState();
        setTimeout(syncToggleState, 100);
        setTimeout(syncToggleState, 500);
        
        // Handle toggle changes
        goalCountdownToggle.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            if (window.GoalCountdownWidget) {
                GoalCountdownWidget.toggle(enabled);
            }
        });
    }
}

/**
 * Set up event listeners for rotating images settings controls
 */
function setupRotatingImagesEventListeners() {
    // Rotating Image Opacity Slider
    const opacitySlider = document.getElementById('rotating-image-opacity-slider');
    if (opacitySlider) {
        opacitySlider.addEventListener('input', (e) => {
            const newOpacity = parseFloat(e.target.value);
            document.getElementById('rotating-image-opacity-value').textContent = Math.round(newOpacity * 100) + '%';
            
            // Apply immediately for preview
            applyImageOpacity(newOpacity);
        });
        
        opacitySlider.addEventListener('change', (e) => {
            saveAppSettings({ rotatingImageOpacity: parseFloat(e.target.value) });
        });
    }
    
    // Note: Image count slider is now hidden - count is determined automatically
    // We'll keep the reference to update the value when needed
    const imageCountSlider = document.getElementById('rotating-image-count-slider');
    
    // Note: Rotation duration is now fixed at 3 minutes
    // We keep the hidden input for compatibility
    
    // Image Size Slider
    const imageSizeSlider = document.getElementById('rotating-image-size-slider');
    if (imageSizeSlider) {
        imageSizeSlider.addEventListener('input', (e) => {
            const newSize = parseInt(e.target.value);
            document.getElementById('rotating-image-size-value').textContent = newSize + 'px';
            
            // Apply immediately for preview
            applyImageSize(newSize);
        });
        
        imageSizeSlider.addEventListener('change', (e) => {
            saveAppSettings({ rotatingImageSize: parseInt(e.target.value) });
        });
    }
    
    // Position Lock Toggle
    const lockPositionToggle = document.getElementById('rotating-image-lock-position-toggle');
    if (lockPositionToggle) {
        lockPositionToggle.addEventListener('change', (e) => {
            const isLocked = e.target.checked;
            const settings = saveAppSettings({ rotatingImagePositionLocked: isLocked });
            applyPositionLock(settings.rotatingImagePositionLocked);
        });
    }
    
    
    // Image Source Radio Buttons
    const noImagesRadio = document.getElementById('no-images-radio');
    const personalImagesRadio = document.getElementById('personal-images-radio');
    
    if (noImagesRadio && personalImagesRadio) {
        noImagesRadio.addEventListener('change', async (e) => {
            if (e.target.checked) {
                // Save setting (we'll use null to indicate no images)
                await saveAppSettings({ useDefaultRotatingImages: null });
                
                // Hide personal images section
                const personalImagesSection = document.getElementById('personal-images-section');
                if (personalImagesSection) {
                    personalImagesSection.style.display = 'none';
                }
                
                // Hide controls container
                const controlsContainer = document.getElementById('rotating-images-controls-container');
                if (controlsContainer) {
                    controlsContainer.style.display = 'none';
                }
                
                // Clear the rotating images container
                const imageContainer = document.getElementById('rotating-images');
                if (imageContainer) {
                    imageContainer.innerHTML = '';
                    imageContainer.style.display = 'none';
                }
                
                // Stop any active rotation
                stopImageRotation();
            }
        });
        
        personalImagesRadio.addEventListener('change', async (e) => {
            if (e.target.checked) {
                await saveAppSettings({ useDefaultRotatingImages: false });
                
                // Show controls container
                const controlsContainer = document.getElementById('rotating-images-controls-container');
                if (controlsContainer) {
                    controlsContainer.style.display = 'block';
                }
                
                // Show personal images section
                const personalImagesSection = document.getElementById('personal-images-section');
                if (personalImagesSection) {
                    personalImagesSection.style.display = 'block';
                }
                
                // Show the rotating images container
                const imageContainer = document.getElementById('rotating-images');
                if (imageContainer) {
                    imageContainer.style.display = 'block';
                }
                
                // Force repopulate the personal images grid
                populatePersonalImagesGrid().catch(console.error);
                
                // Update image source with a small delay to ensure the grid is populated first
                setTimeout(() => {
                    applyImageSource(true).catch(console.error);
                }, 100);
                
                // Make sure rotation starts again with fixed 3-minute interval
                rotateImages();
                updateRotationInterval(); // Fixed 3-minute rotation
            }
        });
    }
    
    // Personal Image File Input
    const fileInput = document.getElementById('personal-image-input');
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                
                // Add the image
                const added = await addPersonalImage(file);
                if (added) {
                    // Update the grid
                    populatePersonalImagesGrid().catch(console.error);
                    
                    // Refresh the rotating images if using personal images
                    const settings = loadSettings();
                    if (settings.useDefaultRotatingImages === false) {
                        // Force update the image source with a small delay
                        setTimeout(() => {
                            applyImageSource(true).catch(console.error);
                            
                            // Clear any existing interval
                            if (window.imageInterval) {
                                clearInterval(window.imageInterval);
                            }
                            
                            // Force an initial rotation
                            rotateImages();
                            
                            // Restart interval with fixed 3-minute duration
                            updateRotationInterval();
                        }, 100);
                    }
                }
                
                // Reset the input so the same file can be selected again if needed
                e.target.value = '';
            }
        });
    }
}

/**
 * Set up event listeners for timer container color pickers
 */
function setupTimerContainerColorListeners() {
    const containerBgColorPicker = document.getElementById('container-bg-color-picker');
    const containerBgColorDisplay = document.getElementById('container-bg-color-display');
    const digitColorPicker = document.getElementById('digit-color-picker');
    const digitColorDisplay = document.getElementById('digit-color-display');
    
    // Container background color picker
    if (containerBgColorPicker && containerBgColorDisplay) {
        // Set initial color display
        containerBgColorDisplay.style.backgroundColor = containerBgColorPicker.value;
        
        containerBgColorPicker.addEventListener('change', function() {
            const color = this.value;
            containerBgColorDisplay.style.backgroundColor = color;
        });
        
        // Click on color circle to open color picker
        containerBgColorDisplay.addEventListener('click', function() {
            containerBgColorPicker.click();
        });
    }
    
    // Digit color picker
    if (digitColorPicker && digitColorDisplay) {
        // Set initial color display
        digitColorDisplay.style.backgroundColor = digitColorPicker.value;
        
        digitColorPicker.addEventListener('change', function() {
            const color = this.value;
            digitColorDisplay.style.backgroundColor = color;
        });
        
        // Click on color circle to open color picker
        digitColorDisplay.addEventListener('click', function() {
            digitColorPicker.click();
        });
    }
}

/**
 * Handle showing or hiding different settings sections
 */
function setupSettingsSectionToggles() {
    const settingHeaders = document.querySelectorAll('.settings-header');
    settingHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const content = header.nextElementSibling;
            content.style.display = content.style.display === 'none' ? 'block' : 'none';
            header.classList.toggle('settings-header-active');
        });
    });
}

/**
 * Setup Health Reminders Settings Integration
 */
function setupHealthRemindersSettings() {
    const eyeStrainToggle = document.getElementById('eye-strain-toggle');
    const postureToggle = document.getElementById('posture-toggle');
    const hydrationToggle = document.getElementById('hydration-toggle');
    const soundToggle = document.getElementById('health-sound-toggle');
    
    // Wait for health reminders to be initialized
    const waitForHealthReminders = setInterval(() => {
        if (window.healthReminders) {
            clearInterval(waitForHealthReminders);
            
            // Load current settings from health reminders
            const settings = window.healthReminders.getSettings();
            if (eyeStrainToggle) eyeStrainToggle.checked = settings.eyeStrainEnabled;
            if (postureToggle) postureToggle.checked = settings.postureEnabled;
            if (hydrationToggle) hydrationToggle.checked = settings.hydrationEnabled;
            if (soundToggle) soundToggle.checked = settings.soundEnabled;
            
            // Add event listeners
            if (eyeStrainToggle) {
                eyeStrainToggle.addEventListener('change', (e) => {
                    window.healthReminders.toggleEyeStrain(e.target.checked);
                });
            }
            
            if (postureToggle) {
                postureToggle.addEventListener('change', (e) => {
                    window.healthReminders.togglePosture(e.target.checked);
                });
            }
            
            if (hydrationToggle) {
                hydrationToggle.addEventListener('change', (e) => {
                    window.healthReminders.toggleHydration(e.target.checked);
                });
            }
            
            if (soundToggle) {
                soundToggle.addEventListener('change', (e) => {
                    window.healthReminders.toggleSound(e.target.checked);
                });
            }
        }
    }, 100);
    
    // Clear interval after 5 seconds if health reminders still not found
    setTimeout(() => clearInterval(waitForHealthReminders), 5000);
}

// Initialize settings when document is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeSettings();
    setupHealthRemindersSettings();
});

