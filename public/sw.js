const VERSION = "alpha-pwa-v3.10.2";
const STATIC_CACHE = `${VERSION}-static`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [
  "/",
  "/index.html",
  OFFLINE_URL,
  "/manifest.json?v=3.10.2",
  "/icons/alpha-core-192.png",
  "/icons/alpha-core-512.png",
  "/icons/alpha-core-maskable-512.png",
  "/icons/apple-touch-icon-v351.png",
  "/icons/favicon-32-v351.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => ![STATIC_CACHE, RUNTIME_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isApiRequest(url) {
  return url.hostname.includes("supabase.co") || url.pathname.startsWith("/rest/") || url.pathname.startsWith("/auth/");
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === "basic") cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") return (await cache.match("/index.html")) || caches.match(OFFLINE_URL);
    return caches.match(OFFLINE_URL);
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok && response.type === "basic") cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || network || caches.match(OFFLINE_URL);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isApiRequest(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (["style", "script", "worker", "font", "image"].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});


self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { payload = { body: event.data?.text() || "A new ALPHA CORE update is available." }; }
  const title = payload.title || "ALPHA CORE";
  const options = {
    body: payload.body || "A new update is available.",
    icon: "/icons/alpha-core-192.png",
    badge: "/icons/favicon-32-v351.png",
    tag: payload.tag || `alpha-${Date.now()}`,
    renotify: true,
    vibrate: [90, 45, 90],
    data: { url: payload.url || "/dashboard", eventType: payload.eventType, ...payload.data },
    actions: [{ action: "open", title: "Open update" }],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/dashboard", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(targetUrl);
          return;
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(targetUrl) : undefined;
    })
  );
});
