// Check if we're in an Electron environment
const isElectron = () => {
    return window.navigator && 
           (window.navigator.userAgent.toLowerCase().indexOf('electron/') > -1 ||
            window.process && 
            typeof window.process.versions === 'object' && 
            !!window.process.versions.electron);
};

// When in Electron, use the API bridge for file operations
// Otherwise, use normal web APIs
if (isElectron()) {
    
    // Replace any file upload functionality with Electron's dialog
    document.addEventListener('DOMContentLoaded', () => {
        const uploadBgBtn = document.getElementById('upload-bg-btn');
        if (uploadBgBtn) {
            uploadBgBtn.addEventListener('click', async () => {
                try {
                    const filePath = await window.api.selectFile();
                    if (filePath) {
                        // Set as background image
                        document.body.style.backgroundImage = `url("${filePath}")`;
                        // Save to localStorage for persistence with user-specific key
                        const customBgKey = window.firebaseDataManager && firebaseDataManager.user 
                            ? `CUSTOM_BACKGROUND_IMAGE_${firebaseDataManager.user.uid}` 
                            : 'CUSTOM_BACKGROUND_IMAGE';
                        localStorage.setItem(customBgKey, filePath);
                    }
                } catch (error) {
                    console.error('Error selecting file:', error);
                }
            });
        }
        
        // Load custom background if it exists with user-specific key
        const customBgKey = window.firebaseDataManager && firebaseDataManager.user 
            ? `CUSTOM_BACKGROUND_IMAGE_${firebaseDataManager.user.uid}` 
            : 'CUSTOM_BACKGROUND_IMAGE';
        const savedBgImage = localStorage.getItem(customBgKey);
        if (savedBgImage) {
            document.body.style.backgroundImage = `url("${savedBgImage}")`;
        }
    });
} else {
} 
