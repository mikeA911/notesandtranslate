/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const CACHE_NAME = 'voice-notes-translator-cache-v3'; // Increment cache version

// Add all critical app shell files here.
const urlsToCache = [
  './',
  './index.html',
  './index.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// Install the service worker and cache the app shell.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(urlsToCache);
      })
  );
});

// Intercept fetch requests and serve from cache if available (Cache-First strategy).
self.addEventListener('fetch', event => {
  // We only care about GET requests.
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response from cache.
        if (response) {
          return response;
        }
        // Not in cache - fetch from network.
        // This allows dynamic content like API calls and uncached resources to work.
        return fetch(event.request).catch(error => {
          console.warn('Fetch failed for:', event.request.url, error);
          // Return a basic response for failed requests
          if (event.request.url.includes('manifest.json')) {
            return new Response('{}', {
              status: 200,
              statusText: 'OK',
              headers: { 'Content-Type': 'application/json' }
            });
          }
          throw error;
        });
      })
    );
});

// Clean up old caches on activation to ensure the user gets the latest version.
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
