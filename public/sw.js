/*
 * The smallest service worker that makes the app installable.
 *
 * It deliberately caches nothing. A Glances dashboard offline is a blank screen
 * — every value on it comes from a live server — so an app-shell cache would buy
 * a faster path to "cannot reach the server" and a lifetime of stale-bundle
 * bugs. Chrome, though, still wants a registered worker with a fetch handler
 * before it will offer "Install app", and installing to a standalone window is
 * the whole point of shipping a manifest.
 *
 * Keep it pass-through. If offline support is ever wanted, it belongs here, but
 * it needs a cache-busting story for the hashed bundle first.
 */

self.addEventListener('install', () => {
  // Replace any previous worker immediately rather than waiting for every tab
  // to close — there is no cached state that a version skew could corrupt.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
