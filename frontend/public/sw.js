const CACHE_NAME  = "nexusfund-v1";
const OFFLINE_URL = "/offline.html";

// Assets to pre-cache on install — these are always available offline
const PRECACHE_URLS = [
    "/",
    "/offline.html",
    "/manifest.json",
    "/icons/icon.svg",
    "/icons/icon-maskable.svg",
];

// ─── Install ──────────────────────────────────────────────────────────────────
// Pre-cache the shell. skipWaiting activates immediately without waiting for
// existing tabs to close — safe because we version the cache name.
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
    );
    self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────────────────────
// Delete any caches from previous versions. clients.claim() makes this SW
// take control of existing tabs immediately without a reload.
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Only handle GET requests from our own origin
    if (request.method !== "GET" || url.origin !== self.location.origin) return;

    // API calls: always go to network, never cache — data must be fresh
    if (url.pathname.startsWith("/api/")) return;

    // Navigation requests (HTML pages): network-first, fall back to offline page
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .catch(() => caches.match(OFFLINE_URL))
        );
        return;
    }

    // Static assets (JS, CSS, images, fonts): cache-first
    // Vite content-hashes filenames so a cache hit is always the correct version.
    // On miss, fetch from network and add to cache for next time.
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;

            return fetch(request).then((response) => {
                // Only cache valid responses — not errors, not opaque cross-origin
                if (response.ok && response.type === "basic") {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                }
                return response;
            });
        })
    );
});
