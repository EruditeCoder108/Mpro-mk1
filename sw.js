const CACHE_NAME = 'uptoolkit-v1';

// Critical assets to cache immediately
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  
  // CSS Files
  '/css/main.css',
  '/css/timer-styles.css',
  '/css/background.css',
  '/css/loading-screens.css',
  '/css/cursor.css',
  '/css/ambient-sounds.css',
  '/css/health-toast.css',
  '/css/mobile-responsive.css',
  '/css/page-transitions.css',
  '/css/goal-countdown.css',
  '/css/study-together.css',
  '/css/ai-mentor.css',
  '/css/checklist.css',
  '/css/creator.css',
  '/css/friends.css',
  '/css/leaderboard.css',
  '/css/library.css',
  '/css/Mocktest.css',
  '/css/progress.css',
  '/css/settings.css',
  '/css/study.css',
  '/css/study-quest.css',
  '/css/test-analyzer.css',
  '/css/test-interface.css',
  '/css/toast-notifications.css',

  // JS Files
  '/js/timer.js',
  '/js/srs-manager.js',
  '/js/pomodoro.js',
  '/js/firebase-utils.js',
  '/js/auth.js',
  '/js/ai-mentor.js',
  '/js/ambient-sounds.js',
  '/js/background.js',
  '/js/checklist.js',
  '/js/cursor.js',
  '/js/firebase-init.js',
  '/js/health-reminders.js',
  '/js/input-validator.js',
  '/js/toast-notifications.js',
  
  // Icons
  '/assets/icons/icon.png',
  '/assets/icons/android/android-launchericon-192-192.png',
  '/assets/icons/android/android-launchericon-512-512.png'
];

// Install Event: Cache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching critical assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Stale-While-Revalidate Strategy
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests (like Firebase, Google Fonts)
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // For HTML pages, use Network-First (to ensure latest version)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request)
            .then((response) => {
              if (response) return response;
              return caches.match('/index.html'); // Fallback to index.html
            });
        })
    );
    return;
  }

  // For assets (CSS, JS, Images), use Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Update cache with new version
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      });

      // Return cached response immediately if available, otherwise wait for network
      return cachedResponse || fetchPromise;
    })
  );
});
