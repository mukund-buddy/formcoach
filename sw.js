// FormCoach Service Worker — offline-first shell
const CACHE = "formcoach-v5";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/app.js",
  "./js/angles.js",
  "./js/storage.js",
  "./js/voice.js",
  "./js/license.js",
  "./js/exercises/pushup.js",
  "./js/exercises/surya.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Update strategy:
// - App shell (html/js/css/json): NETWORK-FIRST — online ho to latest code
//   turant milega (deploy ke turant baad), offline ho to cache se chalega.
// - Baaki (icons/images): cache-first.
// Deploy karte waqt CACHE version bump karo (formcoach-v2, v3...) —
// activate purani cache delete kar deta hai.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  const isShell =
    url.origin === self.location.origin &&
    (url.pathname.endsWith(".html") ||
      url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".css") ||
      url.pathname.endsWith(".json") ||
      url.pathname === "/" ||
      url.pathname.endsWith("/"));

  if (isShell) {
    e.respondWith(
      fetch(e.request)
        .then((resp) => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return resp;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
