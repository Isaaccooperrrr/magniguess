// Magniguess offline cache.
//
// The page itself is fetched network-first: a cache-first document would mean a
// returning player keeps the version they first loaded forever, and no update
// would ever reach them. Everything else (icons, manifest) is cache-first,
// since those only change when the cache name below changes.
const CACHE = "magniguess-v2";
const ASSETS = ["./", "./index.html", "./manifest.json", "./icon.svg", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // One missing asset must not fail the whole install.
      .then((c) => Promise.all(ASSETS.map((a) => c.add(a).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isDocument = (req) => req.mode === "navigate"
  || req.destination === "document"
  || /\/$|\.html$/.test(new URL(req.url).pathname);

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;

  if (isDocument(req)) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy)).catch(() => {});
        }
        return res;
      // offline: fall back to whatever we last saw. ignoreSearch so a
      // ?seed=... challenge link still opens the cached page.
      }).catch(() => caches.match(req, { ignoreSearch: true })
        .then((hit) => hit || caches.match("./index.html")))
    );
    return;
  }

  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) =>
      hit || fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
    )
  );
});
