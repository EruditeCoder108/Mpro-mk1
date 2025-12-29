/**
 * Ambient Sounds JavaScript - Robust Modal Implementation
 * Handles all ambient sound functionality with proper audio management
 */

// Storage key for ambient sound combinations
const AMBIENT_STORAGE_KEY = 'ambientSoundCombinations';

// Global variables
let audioContextStarted = false;
let activeAudios = new Map(); // Track active audio elements

/**
 * Initialize the ambient sound modal functionality
 */
function initializeAmbientModal() {

    // --- DATA: All available sounds with updated names ---
    const sounds = [
        // Weather
        { id: 'rain', name: 'Rain', emoji: '🌧️', category: 'Weather' },
        { id: 'lightRain', name: 'Light Rain', emoji: '💧', category: 'Weather' },
        { id: 'heavyRain', name: 'Heavy Rain', emoji: '⛈️', category: 'Weather' },
        { id: 'thunderstorm', name: 'Thunderstorm', emoji: '⚡', category: 'Weather' },
        { id: 'wind', name: 'Wind', emoji: '🌪️', category: 'Weather' },
        { id: 'tentRain', name: 'Rain on Tent', emoji: '⛺', category: 'Weather' },
        // Nature
        { id: 'ocean', name: 'Ocean Waves', emoji: '🌊', category: 'Nature' },
        { id: 'campfire', name: 'Campfire', emoji: '🔥', category: 'Nature' },
        { id: 'countryside', name: 'Countryside', emoji: '🏞️', category: 'Nature' },
        { id: 'deepSea', name: 'Deep Sea', emoji: '🐟', category: 'Nature' },
        { id: 'summerNight', name: 'Summer Night', emoji: '🌙', category: 'Nature' },
        { id: 'underwater', name: 'Underwater', emoji: '🤿', category: 'Nature' },
        { id: 'forestBirds', name: 'Forest Birds', emoji: '🐦', category: 'Nature' },
        { id: 'waterfall', name: 'Waterfall', emoji: '🏔️', category: 'Nature' },
        { id: 'whales', name: 'Whales', emoji: '🐋', category: 'Nature' },
        { id: 'brook', name: 'Mountain Brook', emoji: '🏞️', category: 'Nature' },
        { id: 'forest', name: 'Forest Ambience', emoji: '🌲', category: 'Nature' },
        { id: 'windChimes', name: 'Wind Chimes', emoji: '🎐', category: 'Nature' },
        // Lifestyle
        { id: 'coffeehouse', name: 'Coffeehouse', emoji: '☕', category: 'Lifestyle' },
        { id: 'airplane', name: 'Airplane Cabin', emoji: '✈️', category: 'Lifestyle' },
        { id: 'cityTransit', name: 'City Transit', emoji: '🚊', category: 'Lifestyle' },
        { id: 'urbanMorning', name: 'Urban Morning', emoji: '🌆', category: 'Lifestyle' },
        { id: 'streetCafe', name: 'Street Café', emoji: '🏙️', category: 'Lifestyle' },
        { id: 'cityPark', name: 'City Park', emoji: '🌳', category: 'Lifestyle' },
        { id: 'airport', name: 'Airport Terminal', emoji: '🛫', category: 'Lifestyle' },
        // Interior
        { id: 'studyHall', name: 'Study Hall', emoji: '📚', category: 'Interior' },
        { id: 'library', name: 'Library', emoji: '🏛️', category: 'Interior' },
        { id: 'fireplace', name: 'Fireplace', emoji: '🕯️', category: 'Interior' },
        { id: 'office', name: 'Modern Office', emoji: '💼', category: 'Interior' },
        { id: 'airConditioner', name: 'Air Conditioner', emoji: '❄️', category: 'Interior' },
        { id: 'ceilingFan', name: 'Ceiling Fan', emoji: '🪭', category: 'Interior' },
        { id: 'kitchen', name: 'Kitchen Ambience', emoji: '🍳', category: 'Interior' },
        { id: 'tickingClock', name: 'Ticking Clock', emoji: '🕰️', category: 'Interior' },
        // Focus
        { id: 'whiteNoise', name: 'White Noise', emoji: '📊', category: 'Focus' },
        { id: 'pinkNoise', name: 'Pink Noise', emoji: '🎵', category: 'Focus' },
        { id: 'brownNoise', name: 'Brown Noise', emoji: '🎛️', category: 'Focus' },
        { id: 'binauralGamma', name: 'Gamma Waves', emoji: '⚡', category: 'Focus' },
        { id: 'binauralBeta', name: 'Beta Waves', emoji: '🧠', category: 'Focus' },
        { id: 'binauralAlpha', name: 'Alpha Waves', emoji: '😌', category: 'Focus' },
        { id: 'binauralTheta', name: 'Theta Waves', emoji: '🧘', category: 'Focus' },
        { id: 'binauralDelta', name: 'Delta Waves', emoji: '😴', category: 'Focus' },
        // Niche
        { id: 'keyboard', name: 'Keyboard Typing', emoji: '⌨️', category: 'Niche' },
        { id: 'space', name: 'Deep Space', emoji: '🌌', category: 'Niche' },
        { id: 'writing', name: 'Writing Sounds', emoji: '✍️', category: 'Niche' },
        { id: 'classicpiano', name: 'Classic Piano', emoji: '🎹', category: 'Niche' },
        { id: 'smoothjazz', name: 'Smooth Jazz', emoji: '🎷', category: 'Niche' },
    ];

    // --- DOM Elements ---
    const soundModal = document.getElementById('soundModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const soundsContainer = document.getElementById('soundsContainer');
    const resetAllBtn = document.getElementById('resetAllBtn');
    const playPauseAllBtn = document.getElementById('playPauseAllBtn');
    const saveMixBtn = document.getElementById('saveMixBtn');
    const savedMixesList = document.getElementById('savedMixesList');
    const masterVolume = document.getElementById('masterVolume');
    const ambientPopupBtn = document.getElementById('ambient-popup-btn');

    if (!soundModal || !closeModalBtn || !soundsContainer || !resetAllBtn || !playPauseAllBtn || !saveMixBtn || !savedMixesList || !masterVolume || !ambientPopupBtn) {
        console.error("One or more ambient sound modal elements are missing!");
        return;
    }

    // Ensure modal is hidden by default and stop any potential audio
    soundModal.style.display = 'none';
    stopAllAudio();

    // --- Functions ---

    /**
     * Dynamically creates and injects sound sliders into the container.
     */
    function renderSounds() {
        // Group sounds by category first
        const soundsByCategory = sounds.reduce((acc, sound) => {
            if (!acc[sound.category]) {
                acc[sound.category] = [];
            }
            acc[sound.category].push(sound);
            return acc;
        }, {});

        // Define the order of categories
        const categoryOrder = ['Weather', 'Nature', 'Lifestyle', 'Interior', 'Focus', 'Niche'];

        let html = '';
        // Loop through categories in the specified order
        for (const category of categoryOrder) {
            if (soundsByCategory[category]) {
                // Add category header
                html += `<div class="category-header">
                            <h3>${category}</h3>
                         </div>`;

                // Add sliders for the category
                soundsByCategory[category].forEach(sound => {
                    html += `
                        <div class="sound-item" data-sound-id="${sound.id}">
                            <label for="slider-${sound.id}">
                                <span class="emoji">${sound.emoji}</span>
                                <span class="name">${sound.name}</span>
                            </label>
                            <input type="range" id="slider-${sound.id}" data-sound-id="${sound.id}" min="0" max="1" step="0.01" value="0">
                            <audio id="audio-${sound.id}" loop preload="none" data-sound-id="${sound.id}">
                                <!-- Audio source will be loaded dynamically when needed -->
                            </audio>
                        </div>
                    `;
                });
            }
        }
        soundsContainer.innerHTML = html;
    }

    function openModal() {
        soundModal.style.display = 'flex';
        loadAudioSources(); // Load audio sources only when modal opens
        initializeAudioElements();
    }

    /**
     * Initialize all audio elements to ensure they're properly paused
     */
    function initializeAudioElements() {
        sounds.forEach(sound => {
            const audio = getAudioElement(sound.id);
            const slider = getSliderElement(sound.id);

            if (audio) {
                // Ensure audio is paused and reset
                audio.pause();
                audio.currentTime = 0;
                audio.volume = 0;

                // Ensure slider is at zero
                if (slider) {
                    slider.value = 0;
                }
            }
        });

        // Clear any active audio tracking
        activeAudios.clear();
    }

    function closeModal() {
        soundModal.style.display = 'none';
        stopAllAudio(); // Stop all audio when modal closes
    }

    function activateAudioContextIfNeeded() {
        if (!audioContextStarted) {
            audioContextStarted = true;
        }
    }

    /**
     * Load audio sources dynamically only when modal is opened
     * This prevents loading all 46 audio files on page load
     * Now optimized to only load when user actually interacts with sliders
     */
    function loadAudioSources() {
        // No longer preload all audio sources - they will be loaded individually
        // when user moves sliders (handled in handleSoundVolume function)
    }

    /**
     * Get audio element for a specific sound ID
     */
    function getAudioElement(soundId) {
        return document.getElementById(`audio-${soundId}`);
    }

    /**
     * Get slider element for a specific sound ID
     */
    function getSliderElement(soundId) {
        return document.getElementById(`slider-${soundId}`);
    }

    /**
     * Stop all currently playing audio
     */
    function stopAllAudio() {
        activeAudios.forEach((audio, soundId) => {
            if (audio && !audio.paused) {
                audio.pause();
                audio.currentTime = 0;
            }
        });
        activeAudios.clear();
    }

    /**
     * Reset all sliders to zero and stop all audio
     */
    function resetAllSliders() {
        stopAllAudio();

        sounds.forEach(sound => {
            const slider = getSliderElement(sound.id);
            if (slider) {
                slider.value = 0;
            }
        });

    }

    /**
     * Update master volume for all active audio elements
     */
    function updateMasterVolume() {
        const masterVol = parseFloat(masterVolume.value);

        activeAudios.forEach((audio, soundId) => {
            if (audio) {
                const slider = getSliderElement(soundId);
                if (slider) {
                    const individualVol = parseFloat(slider.value);
                    audio.volume = individualVol * masterVol;
                }
            }
        });

    }

    /**
     * Update play/pause button state based on active audio
     */
    function updatePlayPauseButtonState() {
        const isAnyPlaying = activeAudios.size > 0;
        
        if (isAnyPlaying) {
            playPauseAllBtn.textContent = 'Pause All';
            playPauseAllBtn.dataset.playing = 'true';
        } else {
            playPauseAllBtn.textContent = 'Play All';
            playPauseAllBtn.dataset.playing = 'false';
        }
    }

    /**
     * Play all sounds that have volume > 0
     */
    function playAllSounds() {
        sounds.forEach(sound => {
            const slider = getSliderElement(sound.id);
            if (slider && parseFloat(slider.value) > 0) {
                handleSoundVolume(sound.id, parseFloat(slider.value));
            }
        });
        updatePlayPauseButtonState();
    }

    /**
     * Pause all currently playing sounds
     */
    function pauseAllSounds() {
        stopAllAudio();
        updatePlayPauseButtonState();
    }

    /**
     * Get current sound settings (all slider values)
     */
    function getCurrentSettings() {
        const settings = {};
        sounds.forEach(sound => {
            const slider = getSliderElement(sound.id);
            if (slider) {
                settings[sound.id] = parseFloat(slider.value);
            }
        });
        return settings;
    }

    /**
     * Apply sound settings to sliders and audio
     */
    function applySettings(settings) {
        sounds.forEach(sound => {
            const slider = getSliderElement(sound.id);
            if (slider && settings.hasOwnProperty(sound.id)) {
                const volume = parseFloat(settings[sound.id]);
                slider.value = volume;
                handleSoundVolume(sound.id, volume);
            }
        });
        updatePlayPauseButtonState();
    }

    /**
     * Save current mix to localStorage
     */
    function saveCurrentMix() {
        const mixName = prompt('Enter a name for this mix:');
        if (!mixName || mixName.trim() === '') {
            return;
        }

        const trimmedName = mixName.trim();
        const currentSettings = getCurrentSettings();
        
        // Check if mix name already exists
        const savedMixes = getSavedMixes();
        if (savedMixes[trimmedName]) {
            if (!confirm(`Mix "${trimmedName}" already exists. Overwrite?`)) {
                return;
            }
        }

        savedMixes[trimmedName] = currentSettings;
        localStorage.setItem(AMBIENT_STORAGE_KEY, JSON.stringify(savedMixes));
        
        renderSavedMixes();
    }

    /**
     * Get saved mixes from localStorage
     */
    function getSavedMixes() {
        try {
            return JSON.parse(localStorage.getItem(AMBIENT_STORAGE_KEY) || '{}');
        } catch (e) {
            console.error('Error parsing saved mixes:', e);
            return {};
        }
    }

    /**
     * Load a saved mix
     */
    function loadMix(mixName) {
        const savedMixes = getSavedMixes();
        if (savedMixes[mixName]) {
            applySettings(savedMixes[mixName]);
        }
    }

    /**
     * Delete a saved mix
     */
    function deleteMix(mixName) {
        if (confirm(`Delete mix "${mixName}"?`)) {
            const savedMixes = getSavedMixes();
            delete savedMixes[mixName];
            localStorage.setItem(AMBIENT_STORAGE_KEY, JSON.stringify(savedMixes));
            renderSavedMixes();
        }
    }

    /**
     * Render the saved mixes list
     */
    function renderSavedMixes() {
        const savedMixes = getSavedMixes();
        const mixNames = Object.keys(savedMixes);

        if (mixNames.length === 0) {
            savedMixesList.innerHTML = '<div class="saved-mixes-empty">No saved mixes yet</div>';
            return;
        }

        let html = '';
        mixNames.sort().forEach(mixName => {
            html += `
                <div class="saved-mix-item">
                    <span class="saved-mix-name" onclick="loadMix('${mixName}')">${mixName}</span>
                    <div class="saved-mix-buttons">
                        <button class="load-mix-btn" onclick="loadMix('${mixName}')">Load</button>
                        <button class="delete-mix-btn" onclick="deleteMix('${mixName}')">Delete</button>
                    </div>
                </div>
            `;
        });

        savedMixesList.innerHTML = html;
    }

    // Make functions globally accessible for onclick handlers
    window.loadMix = loadMix;
    window.deleteMix = deleteMix;

    /**
     * Handle individual sound volume changes
     */
    function handleSoundVolume(soundId, volume) {
        const audio = getAudioElement(soundId);
        const masterVol = parseFloat(masterVolume.value);

        if (!audio) {
            console.warn(`Audio element not found for: ${soundId}`);
            return;
        }

        // LAZY LOADING: Load audio source only when user actually wants to play it
        if (!audio.src && volume > 0) {
            audio.src = `assets/audio/${soundId}.mp3`;
        }

        // Ensure we're only controlling this specific audio element
        audio.volume = Math.max(0, Math.min(1, volume * masterVol)); // Clamp volume between 0 and 1

        // Handle play/pause with better error handling
        if (volume > 0) {
            if (audio.paused) {
                activateAudioContextIfNeeded();

                // Add a small delay to ensure audio context is ready
                setTimeout(() => {
                    audio.play().then(() => {
                        activeAudios.set(soundId, audio);
                        updatePlayPauseButtonState();
                    }).catch(error => {
                        console.warn(`Audio play failed for ${soundId}:`, error);
                        // Reset slider if play fails
                        const slider = getSliderElement(soundId);
                        if (slider) {
                            slider.value = 0;
                        }
                    });
                }, 10);
            }
        } else {
            if (!audio.paused) {
                audio.pause();
                audio.currentTime = 0; // Reset to beginning
                activeAudios.delete(soundId);
                updatePlayPauseButtonState();
            }
        }
    }

    // --- Event Listeners ---
    ambientPopupBtn.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);
    resetAllBtn.addEventListener('click', resetAllSliders);
    saveMixBtn.addEventListener('click', saveCurrentMix);
    playPauseAllBtn.addEventListener('click', () => {
        const isPlaying = playPauseAllBtn.dataset.playing === 'true';
        if (isPlaying) {
            pauseAllSounds();
        } else {
            playAllSounds();
        }
    });
    masterVolume.addEventListener('input', updateMasterVolume);

    // Close modal if user clicks on the background overlay
    soundModal.addEventListener('click', (event) => {
        if (event.target === soundModal) {
            closeModal();
        }
    });

    // Close modal with the Escape key
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && soundModal.style.display === 'flex') {
            closeModal();
        }
    });

    // Add event listeners for individual sliders (for actual audio playback)
    soundsContainer.addEventListener('input', (event) => {
        if (event.target.type === 'range') {
            const slider = event.target;
            const soundId = slider.dataset.soundId;
            const volume = parseFloat(slider.value);

            if (soundId) {
                handleSoundVolume(soundId, volume);
            }
        }
    });

    // Initialize audio context activation on user interaction
    soundModal.addEventListener('click', activateAudioContextIfNeeded, { once: true });
    soundModal.addEventListener('touchstart', activateAudioContextIfNeeded, { once: true });

    // --- Initial Load ---
    renderSounds();
    renderSavedMixes();
    updatePlayPauseButtonState();
}

// Initialize ambient sounds when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for other scripts to initialize
    setTimeout(() => {
        initializeAmbientModal();
    }, 100);
});
