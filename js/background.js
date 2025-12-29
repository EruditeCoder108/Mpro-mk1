// Background functionality for the productivity toolkit
// 
// This file handles ALL background-related functionality including:
// - Custom backgrounds stored in localStorage
// - localStorage fallback for offline use
// - Preset background management
// - Live wallpaper support
// - Background selection and application
// - Custom background upload and management
//
// FIREBASE INTEGRATION NOTES:
// - Custom backgrounds: Firebase primary (user's uploaded images)
// - Background preferences: Firebase primary (user's background settings)
// - Current background state: localStorage only (UI state)

// Unified Background Manager Class
class BackgroundManager {
    constructor() {
        this.state = {
            currentType: 'static', // 'static', 'video', 'custom'
            currentSource: null,
            customBackgrounds: [],
            isLoading: false,
            error: null
        };
        
        this.config = {
            maxCustomImages: 10,
            maxFileSize: 10 * 1024 * 1024, // 10MB
            allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
            compressionQuality: 0.8,
            preloadEnabled: true,
            maxConcurrentLoads: 3 // Limit concurrent image loads
        };

        // Performance optimization properties
        this.imageCache = new Set();
        this.preloadQueue = [];
        this.loadingImages = new Set();
        this.preloadedImages = new Map();

        // Performance monitoring
        this.performanceMetrics = {
            backgroundLoadStart: null,
            backgroundLoadEnd: null,
            preloadStart: null,
            preloadEnd: null,
            gridLoadStart: null,
            gridLoadEnd: null
        };
        
        this.storageKeys = {
            TYPE: 'backgroundType', // FIREBASE: User's background type preference
            STATIC_IMAGE: 'backgroundStaticImage', // FIREBASE: User's static background preference
            VIDEO_SOURCE: 'backgroundVideoSource', // FIREBASE: User's video background preference
            CUSTOM_LIST: 'backgroundCustomList', // FIREBASE: User's custom background list
            CUSTOM_BACKGROUND_IMAGE: 'backgroundStaticImage' // Use same key as static images for consistency
        };
        
        // User-specific storage key generator
        this.getUserStorageKey = (key) => {
            if (window.firebaseDataManager && window.firebaseDataManager.user) {
                return `${key}_${window.firebaseDataManager.user.uid}`;
            }
            return key;
        };
        
        this.currentVideo = null;
        this.isUserAuthenticated = false;
        
        // Debounce timers for performance optimization
        this.debounceTimers = {
            saveState: null,
            firebaseSync: null,
            localStorageWrite: null
        };
        
        // Initialize asynchronously
        this.init().catch(error => {
            console.error('Failed to initialize BackgroundManager:', error);
        });
        
        // Listen for authentication state changes
        this.setupAuthListener();
    }
    
    // Debounce utility function
    debounce(func, delay, timerKey) {
        return (...args) => {
            if (this.debounceTimers[timerKey]) {
                clearTimeout(this.debounceTimers[timerKey]);
            }
            this.debounceTimers[timerKey] = setTimeout(() => {
                func.apply(this, args);
                this.debounceTimers[timerKey] = null;
            }, delay);
        };
    }
    
    // Debounced save methods for performance optimization
    debouncedSaveState = this.debounce(this.saveCurrentBackgroundState, 300, 'saveState');
    debouncedFirebaseSync = this.debounce(this.syncToFirebase, 500, 'firebaseSync');
    debouncedLocalStorageWrite = this.debounce(this.writeToLocalStorage, 100, 'localStorageWrite');
    
    // Centralized state management methods
    updateState(newState) {
        this.state = { ...this.state, ...newState };
        // Use the debounced method if available, otherwise use the direct method
        if (this.debouncedSaveState) {
            this.debouncedSaveState();
        } else {
            this.saveCurrentBackgroundState();
        }
    }
    
    // Firebase sync method
    async syncToFirebase() {
        try {
            if (window.firebaseDataManager && window.firebaseDataManager.user) {
                await window.firebaseDataManager.saveUserPreference('backgroundType', this.state.currentType);
                await window.firebaseDataManager.saveUserPreference('backgroundStaticImage', this.state.currentSource);
                await window.firebaseDataManager.saveUserPreference('customBackgrounds', this.state.customBackgrounds);
            }
        } catch (error) {
            console.warn('Firebase sync failed:', error);
        }
    }
    
    // LocalStorage write method
    writeToLocalStorage() {
        try {
            const typeKey = this.getUserStorageKey(this.storageKeys.TYPE);
            const sourceKey = this.getUserStorageKey(this.storageKeys.STATIC_IMAGE);
            const customKey = this.getUserStorageKey(this.storageKeys.CUSTOM_LIST);
            
            localStorage.setItem(typeKey, this.state.currentType);
            localStorage.setItem(sourceKey, this.state.currentSource || '');
            localStorage.setItem(customKey, JSON.stringify(this.state.customBackgrounds));
            
        } catch (error) {
            console.warn('localStorage write failed:', error);
        }
    }
    
    async init() {

        // AUTH GATE: Wait for Firebase authentication to complete before loading settings
        if (window.firebaseDataManager) {
            await window.firebaseDataManager.authReady;
        }

        // PERFECT INITIALIZATION: Load first, then apply (no flickering)
        // Don't clear state here as it causes flicker - let loadState handle the initial state

        // Load state from Firebase → localStorage → Default (no flickering)
        await this.loadState();

        this.setupEventListeners();
        
        // Apply the loaded background without flickering
        await this.loadSavedBackground();

    }
    
    // Setup authentication state listener
    setupAuthListener() {
        // Listen for Firebase auth state changes
        if (typeof auth !== 'undefined') {
            auth.onAuthStateChanged(async (user) => {
                const wasAuthenticated = this.isUserAuthenticated;
                this.isUserAuthenticated = !!user;
                
                // If user just logged in, reload background with user-specific keys
                if (!wasAuthenticated && this.isUserAuthenticated) {
                    // FIX: Wait for Firebase to fully initialize user
                    if (window.firebaseDataManager) {
                        await window.firebaseDataManager.authReady;
                    }
                    
                    // FIX: Small delay to ensure user object is fully set
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // Clear any stale background state from previous user
                    this.clearBackgroundState(false); // Don't apply default yet
                    await this.loadState();
                    await this.loadSavedBackground();
                }
                // If user just logged out, clear user-specific data and reload with global keys
                else if (wasAuthenticated && !this.isUserAuthenticated) {
                    // CRITICAL: Clear the current background state to prevent data leakage
                    this.clearBackgroundState();
                    // Clear any global background keys that might contain stale data
                    this.clearGlobalBackgroundKeys();
                    await this.loadState();
                    await this.loadSavedBackground();
                }
            });
        }
    }
    
    // State Management Methods
    // FIREBASE INTEGRATION: This function should load background state from Firestore
    async loadState() {
        try {
            // PERFECT LOADING ORDER: Firebase → localStorage → Default
            // This prevents flickering and ensures proper data loading


            // Check current authentication state using firebaseDataManager (most reliable)
            const isAuthenticated = window.firebaseDataManager && window.firebaseDataManager.user;
            const isOnline = navigator.onLine && isAuthenticated;

            let loadedFromFirebase = false;
            let loadedFromLocalStorage = false;

            // STEP 1: Try to load from Firebase first (highest priority)
            if (isOnline && window.firebaseDataManager) {
                try {
                    const firebaseType = await window.firebaseDataManager.loadUserPreference('backgroundType', null);
                    const firebaseSource = await window.firebaseDataManager.loadUserPreference('backgroundStaticImage', null);

                    if (firebaseType && firebaseSource) {
                        this.state.currentType = firebaseType;
                        this.state.currentSource = firebaseSource;
                        loadedFromFirebase = true;
                    } else {
                    }
                } catch (firebaseError) {
                    console.warn('⚠️ Firebase background loading failed, falling back to localStorage:', firebaseError.message);
                }
            } else {
            }

            // STEP 2: If Firebase failed or had no data, try localStorage
            if (!loadedFromFirebase) {
            const typeKey = this.getUserStorageKey(this.storageKeys.TYPE);
            const sourceKey = this.getUserStorageKey(this.storageKeys.STATIC_IMAGE);
            
                const localType = localStorage.getItem(typeKey);
                const localSource = localStorage.getItem(sourceKey);

                if (localType && localSource) {
                    this.state.currentType = localType;
                    this.state.currentSource = localSource;
                    loadedFromLocalStorage = true;
                } else {
                }
            }

            // STEP 3: If both Firebase and localStorage failed, use default (only for fresh accounts)
            if (!loadedFromFirebase && !loadedFromLocalStorage) {
                this.state.currentType = 'static';
                this.state.currentSource = null;
            }
            
            // Load custom backgrounds from Firebase Storage (async)
            await this.loadCustomBackgroundsFromStorage();

            console.log('✅ Background state loading completed:', {
                loadSource: loadedFromFirebase ? 'Firebase' : loadedFromLocalStorage ? 'localStorage' : 'Default',
                type: this.state.currentType,
                backgroundSource: this.state.currentSource
            });

        } catch (error) {
            console.error('❌ Failed to load background state:', error);
            this.state.error = error.message;
            // Reset to defaults on error - but don't apply immediately to prevent flicker
            this.state.currentType = 'static';
            this.state.currentSource = null;
        }
    }
    
    // COMPREHENSIVE SAVE: Save to both localStorage AND Firebase immediately
    async saveState() {
        try {

            // Use user-specific localStorage keys
            const typeKey = this.getUserStorageKey(this.storageKeys.TYPE);
            const sourceKey = this.getUserStorageKey(this.storageKeys.STATIC_IMAGE);
            const customListKey = this.getUserStorageKey(this.storageKeys.CUSTOM_LIST);
            
            // Save to localStorage immediately (for instant UI feedback)
            localStorage.setItem(typeKey, this.state.currentType);
            if (this.state.currentSource) {
                localStorage.setItem(sourceKey, this.state.currentSource);
            }
            localStorage.setItem(customListKey, JSON.stringify(this.state.customBackgrounds));

            // Save to Firebase immediately (for cross-device sync)
            if (window.firebaseDataManager && window.firebaseDataManager.user) {
                try {
                    await window.firebaseDataManager.saveUserPreference('backgroundType', this.state.currentType);
                    if (this.state.currentSource) {
                        await window.firebaseDataManager.saveUserPreference('backgroundStaticImage', this.state.currentSource);
                    }
                } catch (firebaseError) {
                    console.warn('⚠️ Firebase save failed, but localStorage saved:', firebaseError.message);
                    // Don't throw error - localStorage save succeeded
                }
            } else {
            }


        } catch (error) {
            console.error('❌ Failed to save background state:', error);
            this.state.error = error.message;
            throw error; // Re-throw to allow caller to handle
        }
    }
    
    async updateState(newState) {
        this.state = { ...this.state, ...newState };
        await this.saveState();
    }
    
    // Error Handling Methods
    handleError(error, context = '') {
        console.error(`Background error in ${context}:`, error);
        this.state.error = error.message;
        
        // Enhanced error handling with specific fallbacks
        const errorMessage = this.getUserFriendlyErrorMessage(error, context);
        this.showErrorNotification(errorMessage);
        
        // Specific fallback strategies based on context
        if (context === 'setBackgroundImage' || context === 'loadSavedBackground') {
            this.setDefaultBackground().catch(err => console.warn('Failed to apply default background:', err));
        } else if (context === 'addCustomBackground') {
        } else if (context === 'deleteCustomBackground') {
            this.loadCustomBackgroundsDisplay();
        }
        
        // Clear error state after a delay
        setTimeout(() => {
            this.clearError();
        }, 5000);
    }
    
    getUserFriendlyErrorMessage(error, context) {
        const errorMessages = {
            'setBackgroundImage': 'Failed to load background image. Using default background.',
            'loadSavedBackground': 'Could not restore saved background. Using default.',
            'addCustomBackground': 'Failed to upload custom background. Please try again.',
            'deleteCustomBackground': 'Could not delete background. Please try again.',
            'validateImage': 'Invalid image file. Please select a valid image.',
            'preloadImage': 'Some images may load slowly due to network issues.',
            'firebaseSync': 'Background sync failed. Changes saved locally.',
            'localStorageWrite': 'Could not save background settings. Please try again.'
        };
        
        return errorMessages[context] || `Background error: ${error.message}`;
    }
    
    showErrorNotification(message) {
        // Create temporary error notification
        const notification = document.createElement('div');
        notification.className = 'background-error-notification';
        notification.textContent = `Background Error: ${message}`;
        
        document.body.appendChild(notification);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }
    
    clearError() {
        this.state.error = null;
    }
    
    // Clear current background state to prevent data leakage between users
    clearBackgroundState(applyDefault = true) {

        // Clear the in-memory state
        this.state.currentType = 'static';
        this.state.currentSource = null;
        this.state.customBackgrounds = [];
        this.state.error = null;

        // Clear any cached images that might be from previous user
        this.imageCache.clear();
        this.preloadedImages.clear();

        // Reset the actual background on the page to default (only if requested)
        if (applyDefault) {
            this.setDefaultBackground().catch(err => console.warn('Failed to apply default background:', err));
        }

    }

    // Clear global background keys that might contain stale data
    clearGlobalBackgroundKeys() {

        const globalKeys = [
            this.storageKeys.TYPE,           // 'backgroundType'
            this.storageKeys.STATIC_IMAGE,   // 'backgroundStaticImage'
            this.storageKeys.CUSTOM_LIST,    // 'backgroundCustomList'
            'solidColorEnabled',
            'solidColorValue',
            'lastBackgroundType',
            'lastBackgroundSource'
        ];

        globalKeys.forEach(key => {
            try {
                localStorage.removeItem(key);
            } catch (error) {
                console.warn(`Failed to clear global key ${key}:`, error);
            }
        });
    }
    
    // Setup Event Listeners
    setupEventListeners() {
        // Background selection menu
        const bgMenuBtn = document.getElementById('upload-bg-btn');
        const bgMenu = document.getElementById('background-selection-menu');
        const closeBtn = document.querySelector('.close-menu-btn');
        
        // Setup debugging removed - functionality verified
        
        if (bgMenuBtn && bgMenu && closeBtn) {
            bgMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMenu();
            });
            
            closeBtn.addEventListener('click', () => {
                this.closeMenu();
            });
            
            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (bgMenu.style.display === 'block' && 
                    !bgMenu.contains(e.target) && 
                    e.target !== bgMenuBtn && 
                    !bgMenuBtn.contains(e.target)) {
                    this.closeMenu();
                }
            });
        }
        
        // Custom upload handling
        const menuCustomUploadBtn = document.getElementById('menu-custom-upload-btn');
        const bgUploadInput = document.getElementById('bg-upload-input');
        
        if (menuCustomUploadBtn && bgUploadInput) {
            menuCustomUploadBtn.addEventListener('click', () => {
                bgUploadInput.click();
            });
            
            bgUploadInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (file) {
                    await this.addCustomBackground(file);
                    this.closeMenu();
                }
                e.target.value = '';
            });
        }

        // Solid color toggle handling
        const solidColorToggle = document.getElementById('solid-color-toggle');
        const solidColorSection = document.getElementById('solid-color-section');
        const backgroundTabs = document.getElementById('background-tabs');
        const solidColorPicker = document.getElementById('solid-color-picker');
        
        if (solidColorToggle && solidColorSection && backgroundTabs && solidColorPicker) {
            solidColorToggle.addEventListener('change', (e) => {
                this.handleSolidColorToggle(e.target.checked);
            });
            
            // Add both 'input' and 'change' events for real-time updates
            solidColorPicker.addEventListener('input', (e) => {
                if (solidColorToggle.checked) {
                    this.applySolidColor(e.target.value).catch(err => console.warn('Failed to apply solid color:', err));
                }
            });
            
            solidColorPicker.addEventListener('change', (e) => {
                if (solidColorToggle.checked) {
                    this.applySolidColor(e.target.value).catch(err => console.warn('Failed to apply solid color:', err));
                }
            });
        }

        // Dark mode toggle handling
        const darkModeToggle = document.getElementById('dark-mode-toggle');
        const darkModeOverlay = document.getElementById('dark-mode-overlay');
        
        if (darkModeToggle && darkModeOverlay) {
            // Load saved dark mode state
            const darkModeKey = this.getUserStorageKey('darkModeEnabled');
            const darkModeEnabled = localStorage.getItem(darkModeKey) === 'true';
            
            if (darkModeEnabled) {
                darkModeToggle.checked = true;
                darkModeOverlay.style.display = 'block';
            }
            
            // Handle toggle change
            darkModeToggle.addEventListener('change', (e) => {
                const isEnabled = e.target.checked;
                
                if (isEnabled) {
                    darkModeOverlay.style.display = 'block';
                } else {
                    darkModeOverlay.style.display = 'none';
                }
                
                // Save state
                localStorage.setItem(darkModeKey, isEnabled.toString());
            });
        }

        // Tab switching functionality
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                
                // Update active state on buttons
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Explicitly hide all tab content panels
                tabContents.forEach(content => {
                    content.style.display = 'none';
                    content.classList.remove('active');
                });

                // Find the target content panel and display it
                const targetContent = document.getElementById(tabId);
                if (targetContent) {
                    targetContent.style.display = 'block';
                    targetContent.classList.add('active');
                    
                    // Save the active tab for restoration with user-specific key
                    const lastActiveTabKey = this.getUserStorageKey('lastActiveTab');
                    localStorage.setItem(lastActiveTabKey, tabId);
                }
            });
        });
    }
    
    // Menu Management
    toggleMenu() {
        const bgMenu = document.getElementById('background-selection-menu');
        if (bgMenu) {
            bgMenu.style.display = bgMenu.style.display === 'block' ? 'none' : 'block';
        }
    }
    
    closeMenu() {
        const bgMenu = document.getElementById('background-selection-menu');
        if (bgMenu) {
            bgMenu.style.display = 'none';
        }
    }
    
    // Default Background
    async setDefaultBackground() {
        try {
            document.body.style.backgroundImage = 'url(assets/background-images-webp/Bimg41.webp)';
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundRepeat = 'no-repeat';
            document.body.style.backgroundAttachment = 'fixed';
            document.body.style.backgroundColor = '#000000'; // Ensure black background as fallback

            await this.updateState({
                currentType: 'static',
                currentSource: 'assets/background-images-webp/Bimg41.webp'
            });

        } catch (error) {
            this.handleError(error, 'setDefaultBackground');
        }
    }

    // Solid Color Methods
    handleSolidColorToggle(isEnabled) {
        const solidColorSection = document.getElementById('solid-color-section');
        const backgroundTabs = document.getElementById('background-tabs');
        const tabContents = document.querySelectorAll('.tab-content');
        const solidColorPicker = document.getElementById('solid-color-picker');
        
        if (isEnabled) {
            // Save current background state before switching to solid color
            this.saveCurrentBackgroundState();
            
            // Show solid color picker, hide other options
            solidColorSection.style.display = 'block';
            backgroundTabs.style.display = 'none';
            tabContents.forEach(content => {
                content.style.display = 'none';
                content.classList.remove('active');
            });
            
            // Read the last-used solid color from localStorage
            const solidColorValueKey = this.getUserStorageKey('solidColorValue');
            const lastUsedColor = localStorage.getItem(solidColorValueKey) || '#000000';
            
            // Apply the last-used solid color
            this.applySolidColor(lastUsedColor);
            
            // Update the color picker to match the restored color
            if (solidColorPicker) {
                solidColorPicker.value = lastUsedColor;
            }
            
            // Save state with user-specific keys
            const solidColorEnabledKey = this.getUserStorageKey('solidColorEnabled');
            localStorage.setItem(solidColorEnabledKey, 'true');
            localStorage.setItem(solidColorValueKey, lastUsedColor);
            
        } else {
            // Hide solid color picker, show other options
            solidColorSection.style.display = 'none';
            backgroundTabs.style.display = 'flex';
            
            // Restore the last wallpaper that was active (this now handles tabs too)
            this.restoreLastWallpaper();
            
            // Save state with user-specific key
            const solidColorEnabledKey = this.getUserStorageKey('solidColorEnabled');
            localStorage.setItem(solidColorEnabledKey, 'false');
            
        }
    }

    restoreTabContent() {
        try {
            // Find the active tab and show its content
            const activeTab = document.querySelector('.tab-btn.active');
            if (activeTab) {
                const tabId = activeTab.getAttribute('data-tab');
                const activeContent = document.getElementById(tabId);
                if (activeContent) {
                    activeContent.style.display = 'block';
                    activeContent.classList.add('active');
                }
            } else {
                // If no active tab, show the first tab content (static-backgrounds)
                const firstTabContent = document.getElementById('static-backgrounds');
                const firstTab = document.querySelector('.tab-btn[data-tab="static-backgrounds"]');
                
                if (firstTabContent && firstTab) {
                    firstTabContent.style.display = 'block';
                    firstTabContent.classList.add('active');
                    firstTab.classList.add('active');
                }
            }
            
            // Ensure all other tab contents are hidden
            const allTabContents = document.querySelectorAll('.tab-content');
            allTabContents.forEach(content => {
                if (!content.classList.contains('active')) {
                    content.style.display = 'none';
                }
            });
        } catch (error) {
            this.handleError(error, 'restoreTabContent');
        }
    }

    async applySolidColor(color) {
        try {
            // Live wallpapers are disabled - no need to stop them
            
            // Clear any background images
            document.body.style.backgroundImage = 'none';
            document.body.style.backgroundSize = '';
            document.body.style.backgroundPosition = '';
            document.body.style.backgroundRepeat = '';
            document.body.style.backgroundAttachment = '';
            
            // Apply solid color
            document.body.style.backgroundColor = color;

            // Update state
            await this.updateState({
                currentType: 'solid',
                currentSource: color
            });

            // Save to localStorage with user-specific keys - ensure solid color mode is enabled
            const solidColorEnabledKey = this.getUserStorageKey('solidColorEnabled');
            const solidColorValueKey = this.getUserStorageKey('solidColorValue');
            localStorage.setItem(solidColorEnabledKey, 'true');
            localStorage.setItem(solidColorValueKey, color);

        } catch (error) {
            this.handleError(error, 'applySolidColor');
        }
    }

    saveCurrentBackgroundState() {
        try {
            // Save the current background state before switching to solid color
            const currentType = this.state.currentType;
            const currentSource = this.state.currentSource;
            
            // Save to localStorage with user-specific keys for solid color restoration
            const lastBackgroundTypeKey = this.getUserStorageKey('lastBackgroundType');
            const lastBackgroundSourceKey = this.getUserStorageKey('lastBackgroundSource');
            localStorage.setItem(lastBackgroundTypeKey, currentType);
            localStorage.setItem(lastBackgroundSourceKey, currentSource || '');
            
            // Also save the current tab state
            const activeTab = document.querySelector('.tab-btn.active');
            if (activeTab) {
                const lastActiveTabKey = this.getUserStorageKey('lastActiveTab');
                localStorage.setItem(lastActiveTabKey, activeTab.getAttribute('data-tab'));
            }
            
        } catch (error) {
            this.handleError(error, 'saveCurrentBackgroundState');
        }
    }

    restoreLastWallpaper() {
        try {
            // Get the last background state with user-specific keys
            const lastTypeKey = this.getUserStorageKey('lastBackgroundType');
            const lastSourceKey = this.getUserStorageKey('lastBackgroundSource');
            const lastActiveTabKey = this.getUserStorageKey('lastActiveTab');
            
            const lastType = localStorage.getItem(lastTypeKey);
            const lastSource = localStorage.getItem(lastSourceKey);
            const lastActiveTab = localStorage.getItem(lastActiveTabKey) || 'static-backgrounds'; // Default to static
            
            // --- CONSOLIDATED TAB RESTORATION LOGIC ---
            // 1. Deactivate all tab buttons and hide all tab content
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => {
                content.style.display = 'none';
                content.classList.remove('active');
            });

            // 2. Find and activate the correct tab button and content
            const tabToActivate = document.querySelector(`.tab-btn[data-tab="${lastActiveTab}"]`);
            const contentToActivate = document.getElementById(lastActiveTab);

            if (tabToActivate && contentToActivate) {
                tabToActivate.classList.add('active');
                contentToActivate.style.display = 'block';
                contentToActivate.classList.add('active');
            } else {
                // Fallback if saved tab is invalid: activate the first tab
                const firstTab = document.querySelector('.tab-btn');
                const firstContent = document.querySelector('.tab-content');
                if (firstTab && firstContent) {
                    firstTab.classList.add('active');
                    firstContent.style.display = 'block';
                    firstContent.classList.add('active');
                }
            }
            // --- END OF CONSOLIDATED LOGIC ---
            
            // Restore the background based on the last type
            if (lastType === 'static' && lastSource) {
                this.setBackgroundImage(lastSource, false);
            } else if (lastType === 'video' && lastSource) {
                // Live wallpapers are disabled - fallback to static background
                this.setDefaultBackground().catch(err => console.warn('Failed to apply default background:', err));
            } else if (lastType === 'custom' && lastSource) {
                this.setBackgroundImage(lastSource, false);
            } else {
                // Fallback to default if no valid state found
                this.setDefaultBackground().catch(err => console.warn('Failed to apply default background:', err));
            }
            
        } catch (error) {
            this.handleError(error, 'restoreLastWallpaper');
            this.setDefaultBackground().catch(err => console.warn('Failed to apply default background:', err));
        }
    }

    restorePreviousBackground() {
        try {
            const solidColorEnabledKey = this.getUserStorageKey('solidColorEnabled');
            const solidColorEnabled = localStorage.getItem(solidColorEnabledKey) === 'true';
            if (solidColorEnabled) return; // Don't restore if solid color is still enabled
            
            const typeKey = this.getUserStorageKey(this.storageKeys.TYPE);
            const sourceKey = this.getUserStorageKey(this.storageKeys.STATIC_IMAGE);
            
            const savedType = localStorage.getItem(typeKey) || 'static';
            const savedSource = localStorage.getItem(sourceKey);
            
            if (savedType === 'static' && savedSource) {
                this.setBackgroundImage(savedSource, false);
            } else if (savedType === 'video') {
                const videoSourceKey = this.getUserStorageKey(this.storageKeys.VIDEO_SOURCE);
                const videoSource = localStorage.getItem(videoSourceKey);
                if (videoSource) {
                    // Live wallpapers are disabled - fallback to static background
                    this.setDefaultBackground().catch(err => console.warn('Failed to apply default background:', err));
                }
            } else {
                this.setDefaultBackground().catch(err => console.warn('Failed to apply default background:', err));
            }
        } catch (error) {
            this.handleError(error, 'restorePreviousBackground');
            this.setDefaultBackground().catch(err => console.warn('Failed to apply default background:', err));
        }
    }
    
    // Background Setting Methods with Error Handling
    async setBackgroundImage(imgPath, updateUI = true) {
        try {
            // Validate input
            if (!imgPath || typeof imgPath !== 'string') {
                throw new Error('Invalid image path provided');
            }
            
            // Live wallpapers are disabled - no need to stop them
            
            // Test image loading before applying
            await this.validateImage(imgPath);
            
            // Apply the background
            this.applyBackgroundImage(imgPath);
            
            // Update state
            await this.updateState({
                currentType: 'static',
                currentSource: imgPath
            });
            
            // Update UI if requested
    if (updateUI) {
                this.updateActiveStates(imgPath);
            }
            
            this.clearError();
            
        } catch (error) {
            this.handleError(error, 'setBackgroundImage');
            throw error;
        }
    }
    
    async validateImage(imgPath) {
        return new Promise((resolve, reject) => {
            // Check if image is already cached
            if (this.imageCache && this.imageCache.has(imgPath)) {
                resolve();
                return;
            }

            const testImg = new Image();
            testImg.onload = () => {
                // Cache the validated image
                if (!this.imageCache) this.imageCache = new Set();
                this.imageCache.add(imgPath);
                resolve();
            };
            testImg.onerror = () => reject(new Error('Failed to load image'));
            testImg.src = imgPath;
        });
    }
    
    applyBackgroundImage(imgPath) {
        document.body.style.backgroundImage = `url('${imgPath}')`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundRepeat = 'no-repeat';
        document.body.style.backgroundAttachment = 'fixed';
        document.body.style.backgroundColor = '#000000'; // Ensure black background as fallback
    }
    
    updateActiveStates(imgPath) {
        // Update preset background grid
        document.querySelectorAll('.grid-item').forEach(item => {
            const isActive = item.dataset.bg === imgPath;
            item.classList.toggle('active', isActive);
        });
        
        // Update custom background items
        document.querySelectorAll('.custom-background-item').forEach(item => {
            const itemImageUrl = item.style.backgroundImage.replace(/url\(['"]?(.*?)['"]?\)/, '$1');
            const isActive = itemImageUrl === imgPath;
            item.classList.toggle('active', isActive);
        });
    }
    
    setLiveWallpaper(videoSrc) {
        // Live wallpapers are temporarily disabled
        
        // Show a user-friendly message
        this.showErrorNotification('Live wallpapers are coming soon! Please use static backgrounds for now.');
        
        // Fallback to a default static background
        const fallbackBg = 'assets/background-images-webp/Bimg41.webp';
        this.setBackgroundImage(fallbackBg);
    }
    
    stopLiveWallpaper() {
        // Live wallpapers are temporarily disabled
        // This method is kept for compatibility but does nothing
    }
    
    // Load and apply saved background
    async loadSavedBackground() {
        try {
            this.state.isLoading = true;
            this.performanceMetrics.backgroundLoadStart = performance.now();

            // Check if solid color mode is enabled using state (more reliable than localStorage)
            const solidColorEnabled = this.state.currentType === 'solid' || localStorage.getItem(this.getUserStorageKey('solidColorEnabled')) === 'true';

            if (solidColorEnabled && this.state.currentSource) {
                // Solid color mode is enabled, apply solid color
                this.applySolidColor(this.state.currentSource).catch(err => console.warn('Failed to apply solid color:', err));
                this.state.isLoading = false;
                this.clearError();
                return;
            }

            // Handle different background types
            if (this.state.currentSource) {
                // We have a saved background image - apply it

            // Performance optimization: Preload the background image before applying
                if (this.config.preloadEnabled) {
                    try {
                await this.preloadImage(this.state.currentSource);
                    } catch (preloadError) {
                        console.warn('⚠️ Background preload failed, continuing anyway:', preloadError.message);
                    }
            }

                await this.setBackgroundImage(this.state.currentSource, false);
            } else {
                // No saved background - apply default (fresh account)
                this.setDefaultBackground().catch(err => console.warn('Failed to apply default background:', err));
            }

            this.state.isLoading = false;
            this.clearError();

            // Performance monitoring: Log background load time
            this.performanceMetrics.backgroundLoadEnd = performance.now();
            const loadTime = this.performanceMetrics.backgroundLoadEnd - this.performanceMetrics.backgroundLoadStart;

            // Performance optimization: Start preloading common backgrounds after main load
            if (this.config.preloadEnabled) {
                setTimeout(() => this.preloadCommonBackgrounds(), 1000);
            }

        } catch (error) {
            console.error('❌ Failed to apply background:', error);
            this.state.isLoading = false;
            this.handleError(error, 'loadSavedBackground');

            // Fallback to default background on error
            this.setDefaultBackground().catch(err => console.warn('Failed to apply default background:', err));
        }
    }

    // Performance optimization: Preload image into cache
    async preloadImage(imgPath) {
        return new Promise((resolve, reject) => {
            if (this.preloadedImages.has(imgPath)) {
                resolve();
                return;
            }

            const img = new Image();
            img.onload = () => {
                this.preloadedImages.set(imgPath, img);
                resolve();
            };
            img.onerror = reject;
            img.src = imgPath;
        });
    }

    // Performance optimization: Preload commonly used backgrounds
    async preloadCommonBackgrounds() {
        const commonBackgrounds = [
            'assets/background-images-webp/Bimg1.webp',
            'assets/background-images-webp/Bimg2.webp',
            'assets/background-images-webp/Bimg3.webp',
            'assets/background-images-webp/Bimg4.webp',
            'assets/background-images-webp/Bimg5.webp'
        ];

        // Load up to 3 images concurrently to avoid overwhelming the network
        const preloadPromises = commonBackgrounds.slice(0, this.config.maxConcurrentLoads).map(imgPath =>
            this.preloadImage(imgPath).catch(() => {
                // Silently fail for preloading - don't show errors for non-critical images
            })
        );

        await Promise.allSettled(preloadPromises);
    }
    
    // Preload multiple images with concurrency control
    async preloadImages(images, maxConcurrent = 3) {
        const results = [];
        for (let i = 0; i < images.length; i += maxConcurrent) {
            const batch = images.slice(i, i + maxConcurrent);
            const batchPromises = batch.map(img => 
                this.preloadImage(img.path).catch(error => {
                    console.warn(`Failed to preload ${img.path}:`, error);
                    return null; // Continue with other images even if one fails
                })
            );
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }
        return results;
    }
    
    // Custom Background Management
    async loadCustomBackgroundsFromStorage() {
        try {
            // Try to load from Firebase first if user is authenticated
            if (window.firebaseDataManager && window.firebaseDataManager.user && firebaseStorageManager) {
                try {
                    const firebaseBackgrounds = await window.firebaseDataManager.loadUserPreference('customBackgrounds', []);
                    
                    if (firebaseBackgrounds && firebaseBackgrounds.length > 0) {
                        this.state.customBackgrounds = firebaseBackgrounds;
                        return;
                    }
                } catch (error) {
                    console.warn('Failed to load backgrounds from Firebase, falling back to localStorage:', error);
                }
            }
            
            // Fallback to localStorage
            const localBackgrounds = JSON.parse(localStorage.getItem(this.storageKeys.CUSTOM_LIST) || '[]');
            this.state.customBackgrounds = localBackgrounds;
            
        } catch (error) {
            console.error('Error loading custom backgrounds:', error);
            this.state.customBackgrounds = [];
        }
    }
    
    async addCustomBackground(file) {
        try {
            // Validate file
            await this.validateCustomBackgroundFile(file);
            
            // Get current backgrounds (from Firebase or localStorage)
            await this.loadCustomBackgroundsFromStorage();
            
            // Check if we've reached the maximum
            if (this.state.customBackgrounds.length >= this.config.maxCustomImages) {
                throw new Error(`Maximum ${this.config.maxCustomImages} custom backgrounds allowed`);
            }
            
            // Check for duplicates
            const isDuplicate = await this.checkForDuplicate(file);
            if (isDuplicate) {
                throw new Error('This image has already been uploaded');
            }
            
            // Try Firebase Storage first if user is authenticated
            if (window.firebaseDataManager && window.firebaseDataManager.user && firebaseStorageManager) {
                try {
                    
                    const uploadResult = await firebaseStorageManager.uploadFile(
                        file, 
                        'backgrounds', 
                        'image',
                        (progress) => {
                            // TODO: Update progress indicator in UI
                        }
                    );
                    
                    const background = {
                        id: Date.now(),
                        name: file.name,
                        size: file.size,
                        storageUrl: uploadResult.downloadURL,
                        filename: uploadResult.filename,
                        uploadedAt: uploadResult.uploadedAt,
                        isFirebaseStorage: true
                    };
                    
                    this.state.customBackgrounds.push(background);
                    await this.updateState({ customBackgrounds: this.state.customBackgrounds });
                    
                    // Save metadata to Firebase preferences
                    await window.firebaseDataManager.saveUserPreference('customBackgrounds', this.state.customBackgrounds);
                    
                    // Apply the background immediately
                    await this.setBackgroundImage(background.storageUrl);
                    
                    // Reload the display
                    this.loadCustomBackgroundsDisplay();
                    
                    return true;
                    
                } catch (error) {
                    console.warn('Firebase upload failed, falling back to localStorage:', error);
                    // Fall through to localStorage method
                }
            }
            
            // Fallback to localStorage method
            const background = await this.processCustomBackground(file);
            this.state.customBackgrounds.push(background);
            await this.updateState({ customBackgrounds: this.state.customBackgrounds });
            
            // Apply the background immediately
            await this.setBackgroundImage(background.dataUrl);
            
            // Reload the display
            this.loadCustomBackgroundsDisplay();
            
            return true;
            
        } catch (error) {
            this.handleError(error, 'addCustomBackground');
            return false;
        }
    }
    
    async validateCustomBackgroundFile(file) {
        // Check file type
        if (!this.config.allowedTypes.includes(file.type)) {
            throw new Error('Please select a valid image file (JPEG, PNG, WebP, or GIF)');
        }
        
        // Check file size
        if (file.size > this.config.maxFileSize) {
            throw new Error(`File size must be less than ${this.config.maxFileSize / (1024 * 1024)}MB`);
        }
    }
    
    async checkForDuplicate(file) {
        // Simple duplicate check based on file name and size
        // In a production app, you'd want to use file hashing
        return this.state.customBackgrounds.some(bg => 
            bg.name === file.name && bg.size === file.size
        );
    }
    
    async processCustomBackground(file) {
        // Compress image if needed
        const compressedDataUrl = await this.compressImage(file);
        
        return {
            id: Date.now(),
            name: file.name,
            size: file.size,
            dataUrl: compressedDataUrl,
            uploadedAt: new Date().toISOString(),
            isLocalOnly: true
        };
    }
    
    async compressImage(file, quality = 0.8) {
        return new Promise((resolve, reject) => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const img = new Image();
                
                img.onload = () => {
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    
                    canvas.toBlob(
                        (blob) => {
                            if (!blob) {
                                reject(new Error('Failed to compress image'));
                                return;
                            }
                            
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result);
                            reader.onerror = reject;
                            reader.readAsDataURL(blob);
                        },
                        'image/jpeg',
                        quality
                    );
                };
                
                img.onerror = () => reject(new Error('Failed to load image for compression'));
                img.src = URL.createObjectURL(file);
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    async deleteCustomBackground(index) {
        try {
            // Load current backgrounds first
            await this.loadCustomBackgroundsFromStorage();
            
            if (index < 0 || index >= this.state.customBackgrounds.length) {
                throw new Error('Invalid background index');
            }
            
            const backgroundToDelete = this.state.customBackgrounds[index];
            
            // Try to delete from Firebase Storage if it's a Firebase image
            if (window.firebaseDataManager && window.firebaseDataManager.user && firebaseStorageManager && backgroundToDelete.isFirebaseStorage) {
                try {
                    await firebaseStorageManager.deleteFile('backgrounds', backgroundToDelete.filename);
                } catch (error) {
                    console.warn('Failed to delete from Firebase Storage:', error);
                    // Continue with local deletion even if Firebase deletion failed
                }
            }
            
            // Remove from state
            this.state.customBackgrounds.splice(index, 1);
            await this.updateState({ customBackgrounds: this.state.customBackgrounds });
            
            // Update Firebase preferences or localStorage
            if (window.firebaseDataManager && window.firebaseDataManager.user) {
                try {
                    await window.firebaseDataManager.saveUserPreference('customBackgrounds', this.state.customBackgrounds);
                } catch (error) {
                    console.warn('Failed to update Firebase preferences, updating localStorage:', error);
                    localStorage.setItem(this.storageKeys.CUSTOM_LIST, JSON.stringify(this.state.customBackgrounds));
                }
            } else {
                localStorage.setItem(this.storageKeys.CUSTOM_LIST, JSON.stringify(this.state.customBackgrounds));
            }
            
            // If this was the currently active background, clear it
            const customBgKey = this.getUserStorageKey(this.storageKeys.CUSTOM_BACKGROUND_IMAGE);
            const currentBg = localStorage.getItem(customBgKey);
            const imageUrl = backgroundToDelete.storageUrl || backgroundToDelete.dataUrl;
            if (currentBg === imageUrl) {
                localStorage.removeItem(customBgKey);
                // Reset to default background or first available custom background
                if (this.state.customBackgrounds.length > 0) {
                    const nextBg = this.state.customBackgrounds[0];
                    const nextImageUrl = nextBg.storageUrl || nextBg.dataUrl;
                    await this.setBackgroundImage(nextImageUrl);
                } else {
                    // Reset to default background
                    document.body.style.backgroundImage = 'none';
                }
            }
            
            // Reload the display
            this.loadCustomBackgroundsDisplay();
            
            return true;
                
            } catch (error) {
            this.handleError(error, 'deleteCustomBackground');
            return false;
            }
        }
    
        
    loadCustomBackgroundsDisplay() {
        const customGrid = document.getElementById('custom-backgrounds-grid');
        if (!customGrid) return;
        
        // Show loading state immediately to prevent flash of empty list
        customGrid.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <div class="loading-text">Loading custom backgrounds...</div>
            </div>
        `;
        
        // Use requestAnimationFrame for proper async behavior
        requestAnimationFrame(() => {
            if (this.state.customBackgrounds.length === 0) {
                customGrid.innerHTML = '<div class="no-custom-backgrounds">No custom backgrounds yet. Upload your first image!</div>';
                return;
            }

            customGrid.innerHTML = '';
            this.renderCustomBackgrounds();
        });
    }
    
    renderCustomBackgrounds() {
        const customGrid = document.getElementById('custom-backgrounds-grid');
        if (!customGrid) return;
        
        this.state.customBackgrounds.forEach((bg, index) => {
            const bgItem = document.createElement('div');
            bgItem.className = 'custom-background-item loading';
            bgItem.setAttribute('data-index', index);
            
            // Check if this is the currently active background
            const bgUrl = bg.storageUrl || bg.dataUrl; // Support both Firebase Storage and localStorage
            if (this.state.currentSource === bgUrl && this.state.currentType === 'static') {
                bgItem.classList.add('active');
            }
            
            // Add delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '×';
            deleteBtn.title = 'Delete this background';
            deleteBtn.onclick = async (e) => {
                e.stopPropagation();
                await this.deleteCustomBackground(index);
            };
            
            bgItem.appendChild(deleteBtn);
            
            // Add click handler to select background
            bgItem.onclick = () => {
                const bgUrl = bg.storageUrl || bg.dataUrl; // Support both Firebase Storage and localStorage
                if (bgUrl) {
                    this.setBackgroundImage(bgUrl);
                } else {
                    console.error('No valid URL found for background:', bg);
                }
            };
            
            // Pre-load image to ensure it's visible
            const img = new Image();
            // bgUrl already declared above, reuse it
            
            if (!bgUrl) {
                console.error('No valid URL found for background preview:', bg);
                bgItem.classList.remove('loading');
                bgItem.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
                bgItem.title = 'No valid URL';
                return;
            }
            
            img.onload = function() {
                bgItem.style.backgroundImage = `url(${bgUrl})`;
                bgItem.classList.remove('loading');
            };
            img.onerror = function() {
                console.error('Failed to load custom background image:', bgUrl);
                bgItem.classList.remove('loading');
                bgItem.style.backgroundImage = 'none';
                bgItem.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
                bgItem.title = 'Failed to load image';
            };
            img.src = bgUrl;
            
            customGrid.appendChild(bgItem);
        });
        
        this.updateUploadButtonState();
    }
    
    updateUploadButtonState() {
        const uploadBtn = document.getElementById('menu-custom-upload-btn');
        if (uploadBtn) {
            if (this.state.customBackgrounds.length >= this.config.maxCustomImages) {
                uploadBtn.disabled = true;
                uploadBtn.textContent = 'Maximum images reached';
                uploadBtn.style.opacity = '0.5';
                uploadBtn.style.cursor = 'not-allowed';
            } else {
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'Upload from PC';
                uploadBtn.style.opacity = '1';
                uploadBtn.style.cursor = 'pointer';
            }
        }
    }
    
    // Enhanced background image loading with immediate skeleton placeholders
    async loadBackgroundImages() {
        try {
            const grid = document.getElementById('background-grid');
            if (!grid) {
                throw new Error('Background grid element not found');
            }

            // Immediately render skeleton placeholders for all 51 images
            this.renderSkeletonPlaceholders(grid);

            // Get all 51 background images in the background
            const validImages = await this.discoverBackgroundImages();

            // Smart preloading strategy:
            // 1. Preload first 10 images + current applied background
            // 2. Replace skeleton placeholders with actual images
            // 3. Load images as they come into view (lazy loading)

            const currentBackground = this.state.currentSource;
            const preloadImages = [];

            // Add first 10 images to preload list
            preloadImages.push(...validImages.slice(0, 10));

            // Add current background to preload list if it's not already included
            if (currentBackground) {
                const currentImg = validImages.find(img => img.path === currentBackground);
                if (currentImg && !preloadImages.includes(currentImg)) {
                    preloadImages.push(currentImg);
                }
            }

            // Preload priority images
            await this.preloadImages(preloadImages);

            // Replace skeleton placeholders with actual images
            validImages.forEach(({ path, index, filename }) => {
                const isPreloaded = preloadImages.some(img => img.path === path);
                this.replaceSkeletonWithImage(path, index, filename, isPreloaded);
            });


        } catch (error) {
            this.handleError(error, 'loadBackgroundImages');
        }
    }
    
    // Render skeleton placeholders immediately for instant visual feedback
    renderSkeletonPlaceholders(grid) {
        const totalImages = 51;
        grid.innerHTML = '';

        for (let i = 1; i <= totalImages; i++) {
            const skeletonItem = document.createElement('div');
            skeletonItem.className = 'grid-item skeleton-placeholder';
            skeletonItem.setAttribute('data-index', i);
            skeletonItem.setAttribute('data-bg', `assets/background-images-webp/Bimg${i}.webp`);

            // Create skeleton content
            skeletonItem.innerHTML = `
                <div class="skeleton-image"></div>
                <div class="skeleton-text"></div>
            `;

            grid.appendChild(skeletonItem);
        }
    }
    
    // Replace skeleton placeholder with actual image
    replaceSkeletonWithImage(path, index, filename, isPreloaded) {
        const skeletonItem = document.querySelector(`[data-index="${index}"]`);

        if (!skeletonItem) {
            console.warn(`No skeleton item found for index ${index}`);
            return;
        }

        // Remove skeleton class and content
        skeletonItem.classList.remove('skeleton-placeholder');
        skeletonItem.innerHTML = '';

        // Create actual image element
        const img = document.createElement('img');
        img.src = path;
        img.alt = filename;
        img.loading = 'lazy';
        img.onerror = () => {
            console.error(`Failed to load image: ${path}`);
            skeletonItem.innerHTML = '<div style="color: red; text-align: center; padding: 20px; font-size: 12px;">Failed to load</div>';
        };

        // Add click handler
        skeletonItem.addEventListener('click', () => {
            this.setBackgroundImage(path);
        });

        // Add hover effects
        skeletonItem.addEventListener('mouseenter', () => {
            skeletonItem.style.transform = 'scale(1.05)';
        });

        skeletonItem.addEventListener('mouseleave', () => {
            skeletonItem.style.transform = 'scale(1)';
        });

        skeletonItem.appendChild(img);

        // If preloaded, show immediately; otherwise, add loading state
        if (isPreloaded) {
            img.style.opacity = '1';
        } else {
            img.style.opacity = '0';
            img.onload = () => {
                img.style.transition = 'opacity 0.3s ease';
                img.style.opacity = '1';
            };
        }
    }
    
    // Performance optimized background image discovery with fresh account handling
    async discoverBackgroundImages() {
        const validImages = [];
        const totalImages = 51; // We know we have exactly 51 images

        // Performance optimization: Only load first 20 images initially, lazy load the rest
        const initialLoadCount = 20;

        // Check if this is a fresh account (no saved background)
        const isFreshAccount = !this.state.currentSource ||
                              this.state.currentSource === 'assets/background-images-webp/Bimg41.webp';

        if (isFreshAccount) {
            // For fresh accounts, only show the default background initially
            const defaultImgPath = 'assets/background-images-webp/Bimg41.webp';
            validImages.push({
                path: defaultImgPath,
                index: 41,
                filename: 'Bimg41.webp',
                priority: 'high',
                isDefault: true,
                isFreshAccount: true
            });

            // After a delay, show more backgrounds to indicate there are options
            setTimeout(() => {
                if (this.state.currentSource === defaultImgPath) {
                    this.loadAllBackgroundOptions();
                }
            }, 3000); // Show more options after 3 seconds

            return validImages;
        }

        // Regular account - show all backgrounds

        // Generate paths for all 51 images (Bimg1.webp to Bimg51.webp)
        for (let i = 1; i <= totalImages; i++) {
            const imgPath = `assets/background-images-webp/Bimg${i}.webp`;
            validImages.push({
                path: imgPath,
                index: i,
                filename: `Bimg${i}.webp`,
                priority: i <= initialLoadCount ? 'high' : 'low', // Mark first 20 as high priority
                isDefault: i === 41 // Mark default background
            });
        }

        return validImages;
    }

    // Load all background options for fresh accounts (called after delay)
    async loadAllBackgroundOptions() {

        try {
            const grid = document.getElementById('background-grid');
            if (!grid) {
                console.warn('Background grid not found');
                return;
            }

            // Get all background images
            const validImages = await this.discoverBackgroundImagesForAll();

            // Clear existing grid
            grid.innerHTML = '';

            // Add all background images to grid
            validImages.forEach(({ path, index, filename }) => {
                this.addImageToGrid(path, index, filename);
            });

        } catch (error) {
            console.error('Failed to load all background options:', error);
        }
    }

    // Helper method to get all background images (internal use)
    async discoverBackgroundImagesForAll() {
        const validImages = [];
        const totalImages = 51;

        for (let i = 1; i <= totalImages; i++) {
            const imgPath = `assets/background-images-webp/Bimg${i}.webp`;
            validImages.push({
                path: imgPath,
                index: i,
                filename: `Bimg${i}.webp`
            });
        }

        return validImages;
    }
    
    addImageToGrid(imgPath, index, filename) {
        try {
            const grid = document.getElementById('background-grid');
            if (!grid) return;

            const gridItem = document.createElement('div');
            gridItem.className = 'grid-item loading';
            gridItem.dataset.bg = imgPath;
            gridItem.title = filename || `Background ${index}`;

            // Performance optimization: Use Intersection Observer for lazy loading
            if ('IntersectionObserver' in window) {
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            this.loadGridItemImage(gridItem, imgPath);
                            observer.unobserve(entry.target);
                        }
                    });
                }, { rootMargin: '50px' });

                observer.observe(gridItem);
            } else {
                // Fallback for browsers without Intersection Observer
                this.loadGridItemImage(gridItem, imgPath);
            }

            // Mark as active if this is the saved background
            if (this.state.currentSource === imgPath && this.state.currentType === 'static') {
                gridItem.classList.add('active');
            }

            // Performance optimization: Debounce click handler
            let clickTimeout;
            gridItem.addEventListener('click', async () => {
                clearTimeout(clickTimeout);
                clickTimeout = setTimeout(async () => {
                    try {
                        // Remove active class from all items
                        document.querySelectorAll('.grid-item').forEach(item => {
                            item.classList.remove('active');
                        });

                        // Add active class to clicked item
                        gridItem.classList.add('active');

                        // Always update state when a background is selected (fixes persistence bug)
                        await this.setBackgroundImage(imgPath);

                    } catch (error) {
                        this.handleError(error, 'gridItemClick');
                        // Remove active class if setting failed
                        gridItem.classList.remove('active');
                    }
                }, 100); // 100ms debounce
            });

            grid.appendChild(gridItem);

        } catch (error) {
            this.handleError(error, 'addImageToGrid');
        }
    }
    
    // Enhanced grid item creation with skeleton loading
    addImageToGridWithSkeleton(imgPath, index, filename, isPreloaded = false) {
        try {
            const grid = document.getElementById('background-grid');
            if (!grid) return;

            const gridItem = document.createElement('div');
            gridItem.className = 'grid-item skeleton';
            gridItem.dataset.bg = imgPath;
            gridItem.title = filename || `Background ${index}`;

            // Add skeleton content
            gridItem.innerHTML = `
                <div class="skeleton-content">
                    <div class="skeleton-image"></div>
                    <div class="skeleton-text"></div>
                </div>
            `;

            // Mark as active if this is the saved background
            if (this.state.currentSource === imgPath && this.state.currentType === 'static') {
                gridItem.classList.add('active');
            }

            // Load image immediately if preloaded, otherwise use intersection observer
            if (isPreloaded) {
                // Image is already preloaded, load it immediately
                setTimeout(() => {
                    this.loadGridItemImage(gridItem, imgPath);
                }, 50); // Small delay for smooth transition
            } else {
                // Use Intersection Observer for lazy loading
                if ('IntersectionObserver' in window) {
                    const observer = new IntersectionObserver((entries) => {
                        entries.forEach(entry => {
                            if (entry.isIntersecting) {
                                this.loadGridItemImage(gridItem, imgPath);
                                observer.unobserve(entry.target);
                            }
                        });
                    }, { rootMargin: '100px' }); // Larger margin for better UX

                    observer.observe(gridItem);
                } else {
                    // Fallback for browsers without Intersection Observer
                    this.loadGridItemImage(gridItem, imgPath);
                }
            }

            // Performance optimization: Debounce click handler
            let clickTimeout;
            gridItem.addEventListener('click', async () => {
                clearTimeout(clickTimeout);
                clickTimeout = setTimeout(async () => {
                    try {
                        // Remove active class from all items
                        document.querySelectorAll('.grid-item').forEach(item => {
                            item.classList.remove('active');
                        });

                        // Add active class to clicked item
                        gridItem.classList.add('active');

                        // Always update state when a background is selected (fixes persistence bug)
                        await this.setBackgroundImage(imgPath);

                    } catch (error) {
                        this.handleError(error, 'gridItemClick');
                        // Remove active class if setting failed
                        gridItem.classList.remove('active');
                    }
                }, 100); // 100ms debounce
            });

            grid.appendChild(gridItem);

        } catch (error) {
            this.handleError(error, 'addImageToGridWithSkeleton');
        }
    }

    // Performance optimization: Lazy load grid item images with skeleton support
    loadGridItemImage(gridItem, imgPath) {
        // Check if image is already preloaded
        if (this.preloadedImages.has(imgPath)) {
            const preloadedImg = this.preloadedImages.get(imgPath);
            this.showImageInGridItem(gridItem, imgPath);
            return;
        }

        // Load image with performance optimizations
        const img = new Image();
        img.onload = () => {
            this.showImageInGridItem(gridItem, imgPath);
            // Cache the loaded image for future use
            this.preloadedImages.set(imgPath, img);
        };
        img.onerror = () => {
            this.showErrorInGridItem(gridItem);
        };

        // Use low-quality placeholder first for better UX
        img.src = imgPath;
    }
    
    // Show image in grid item with smooth transition
    showImageInGridItem(gridItem, imgPath) {
        // Remove skeleton content
        gridItem.innerHTML = '';
        
        // Add smooth transition classes
        gridItem.classList.remove('skeleton', 'loading');
        gridItem.classList.add('loaded');
        
        // Set background image
        gridItem.style.backgroundImage = `url('${imgPath}')`;
        gridItem.style.backgroundSize = 'cover';
        gridItem.style.backgroundPosition = 'center';
        gridItem.style.backgroundRepeat = 'no-repeat';
        
        // Add fade-in effect
        gridItem.style.opacity = '0';
        setTimeout(() => {
            gridItem.style.transition = 'opacity 0.3s ease-in-out';
            gridItem.style.opacity = '1';
        }, 10);
    }
    
    // Show error state in grid item
    showErrorInGridItem(gridItem) {
        gridItem.innerHTML = `
            <div class="error-content">
                <div class="error-icon">⚠️</div>
                <div class="error-text">Failed to load</div>
            </div>
        `;
        gridItem.classList.remove('skeleton', 'loading');
        gridItem.classList.add('error');
    }
    
    // Live Wallpaper Loading - Disabled (Coming Soon)
    loadLiveWallpapers() {
        // Live wallpapers are temporarily disabled
        // This method is kept for compatibility but does nothing
    }
    
    addLiveWallpaperItem(videoPath, index) {
        // Live wallpapers are temporarily disabled
        // This method is kept for compatibility but does nothing
    }
}

// Initialize the background manager
let backgroundManager;

// Initialize background when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the background manager
    backgroundManager = new BackgroundManager();
    
    // Load saved background on page load
    window.addEventListener('load', async function() {
        try {
            // Check if solid color mode was previously enabled with user-specific keys
            const solidColorEnabledKey = backgroundManager.getUserStorageKey('solidColorEnabled');
            const solidColorValueKey = backgroundManager.getUserStorageKey('solidColorValue');
            
            const solidColorEnabled = localStorage.getItem(solidColorEnabledKey) === 'true';
            const solidColorValue = localStorage.getItem(solidColorValueKey) || '#000000';
            
            if (solidColorEnabled) {
                // Initialize solid color mode
                const solidColorToggle = document.getElementById('solid-color-toggle');
                const solidColorPicker = document.getElementById('solid-color-picker');

                if (solidColorToggle && solidColorPicker) {
                    solidColorToggle.checked = true;
                    solidColorPicker.value = solidColorValue;

                    // Apply the saved solid color directly instead of using handleSolidColorToggle
                    // which would apply the default black color
                    backgroundManager.applySolidColor(solidColorValue).catch(err => console.warn('Failed to apply solid color:', err));

                    // Show solid color UI
                    const solidColorSection = document.getElementById('solid-color-section');
                    const backgroundTabs = document.getElementById('background-tabs');
                    const tabContents = document.querySelectorAll('.tab-content');

                    if (solidColorSection && backgroundTabs) {
                        solidColorSection.style.display = 'block';
                        backgroundTabs.style.display = 'none';
                        tabContents.forEach(content => {
                            content.style.display = 'none';
                            content.classList.remove('active');
                        });
                    }
                }
                
                // Don't call loadSavedBackground when solid color is enabled
                // The solid color has already been applied above
            } else {
                // Load and apply the saved background
                // Note: For timer page (index.html), always load background regardless of sync setting
                // The sync setting only affects whether checklist page syncs with timer page
                await backgroundManager.loadSavedBackground();
            }

            // Performance optimization: Load background images asynchronously and with delay
            if (document.getElementById('background-grid')) {
                // Delay loading of background grid to prioritize main background
                setTimeout(() => {
                    backgroundManager.loadBackgroundImages().catch(error => {
                    });
                }, 500); // 500ms delay to let main background load first
            }

            // Performance optimization: Load custom backgrounds with delay
            if (document.getElementById('custom-backgrounds-grid')) {
                setTimeout(() => {
                    backgroundManager.loadCustomBackgroundsDisplay();
                }, 300); // 300ms delay
            }

            // Live wallpapers are temporarily disabled
            // No need to load live wallpapers

        } catch (error) {
            console.error('Failed to initialize backgrounds:', error);
        }
    });
});

// Legacy function aliases for backward compatibility
function setBackgroundImage(imgPath, updateUI = true) {
    return backgroundManager.setBackgroundImage(imgPath, updateUI);
}

function applyBackground(imgPath) {
    return backgroundManager.setBackgroundImage(imgPath, false);
}

function setLiveWallpaper(videoSrc) {
    return backgroundManager.setLiveWallpaper(videoSrc);
}

function stopLiveWallpaper() {
    return backgroundManager.stopLiveWallpaper();
}

function loadBackgroundImages() {
    return backgroundManager.loadBackgroundImages();
}

function loadCustomBackgrounds() {
    return backgroundManager.loadCustomBackgroundsDisplay();
}

function addCustomBackground(file) {
    return backgroundManager.addCustomBackground(file);
}

function deleteCustomBackground(index) {
    return backgroundManager.deleteCustomBackground(index);
}

function loadCustomBackground() {
    return backgroundManager.loadSavedBackground();
}

function setDefaultBackground() {
    return backgroundManager.setDefaultBackground();
}

// Legacy utility functions (kept for backward compatibility)
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function generateThumbnail(dataUrl, maxWidth = 320, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = maxWidth / img.width;
            canvas.width = maxWidth;
            canvas.height = img.height * scale;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            canvas.toBlob(
                (blob) => {
                    if (!blob) return reject(new Error('Canvas to Blob failed'));
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                },
                'image/jpeg',
                quality
            );
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
}

// Old functions removed - now handled by BackgroundManager class

// Old custom background functions removed - now handled by BackgroundManager class

/**
 * Add a new custom background - uses BackgroundManager
 * @param {File} file - The image file to add
 */
async function addCustomBackground(file) {
    return backgroundManager.addCustomBackground(file);
}

/**
 * Fallback function to add background to localStorage only
 * @param {File} file - The image file to add
 */
function addCustomBackgroundToLocalStorage(file) {
    try {
        const reader = new FileReader();
        reader.onload = function(event) {
            const dataUrl = event.target.result;
            
            // Create background object for localStorage
            const newBackground = {
                id: Date.now(),
                name: file.name,
                size: file.size,
                dataUrl: dataUrl, // Use dataUrl for localStorage
                uploadedAt: new Date().toISOString(),
                isLocalOnly: true
            };
            
            // Get current backgrounds and add new one with user-specific key
            const customBackgroundsListKey = this.getUserStorageKey('customBackgroundsList');
            const customBackgrounds = JSON.parse(localStorage.getItem(customBackgroundsListKey) || '[]');
            customBackgrounds.push(newBackground);

            // Save to localStorage with user-specific key
            localStorage.setItem(customBackgroundsListKey, JSON.stringify(customBackgrounds));
            
            // Apply the background immediately
            selectCustomBackground(dataUrl);
            
            // Reload the display
            loadCustomBackgrounds();
            
        };
        
        reader.readAsDataURL(file);
        return true;
        
    } catch (error) {
        console.error('Error adding background to localStorage:', error);
        return false;
    }
}







/**
 * Delete a custom background - uses BackgroundManager
 * @param {number} index - Index of the background to delete
 */
async function deleteCustomBackground(index) {
    return backgroundManager.deleteCustomBackground(index);
}

/**
 * Select a custom background
 * @param {string} dataUrl - The data URL of the background to select
 */
function selectCustomBackground(dataUrl) {
    try {
        // Save as current background with user-specific keys
        const customBgKey = backgroundManager.getUserStorageKey(backgroundManager.storageKeys.CUSTOM_BACKGROUND_IMAGE);
        const backgroundTypeKey = backgroundManager.getUserStorageKey('backgroundType');
        
        localStorage.setItem(customBgKey, dataUrl);
        localStorage.setItem(backgroundTypeKey, 'static');
        
        // Apply the background immediately
        document.body.style.backgroundImage = `url('${dataUrl}')`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundRepeat = 'no-repeat';
        document.body.style.backgroundAttachment = 'fixed';
        
        // Clear active state from preset backgrounds
        document.querySelectorAll('.grid-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Update active states for custom backgrounds
        document.querySelectorAll('.custom-background-item').forEach(item => {
            const itemImageUrl = item.style.backgroundImage.replace(/url\(['"]?(.*?)['"]?\)/, '$1');
            if (itemImageUrl === dataUrl) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        
        
    } catch (error) {
        console.error('Error selecting custom background:', error);
    }
}

/**
 * Update upload button state based on current custom backgrounds count
 */
function updateUploadButtonState() {
    const customBackgroundsListKey = backgroundManager.getUserStorageKey('customBackgroundsList');
    const customBackgrounds = JSON.parse(localStorage.getItem(customBackgroundsListKey) || '[]');
    const uploadBtn = document.getElementById('menu-custom-upload-btn');
    
    if (uploadBtn) {
        if (customBackgrounds.length >= CUSTOM_BACKGROUND_CONFIG.MAX_IMAGES) {
            uploadBtn.disabled = true;
            uploadBtn.textContent = 'Maximum images reached';
            uploadBtn.style.opacity = '0.5';
            uploadBtn.style.cursor = 'not-allowed';
        } else {
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'Upload from PC';
            uploadBtn.style.opacity = '1';
            uploadBtn.style.cursor = 'pointer';
        }
    }
}

// Ensure single initialization
if (!window.backgroundManagerInitialized) {
    window.backgroundManagerInitialized = true;
    
    // Initialize the background manager when the page loads
    document.addEventListener('DOMContentLoaded', async () => {
        // Initialize Firebase Storage Manager
        if (typeof FirebaseStorageManager !== 'undefined') {
            window.firebaseStorageManager = new FirebaseStorageManager();
        }
        
        // Ensure background manager is available globally
        if (!window.backgroundManager && backgroundManager) {
            window.backgroundManager = backgroundManager;
        }
        
        // Initialize custom backgrounds display if manager exists
        if (backgroundManager) {
            backgroundManager.loadCustomBackgroundsDisplay();
        }
    });
}

