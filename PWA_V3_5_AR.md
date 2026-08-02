# ALPHA PLATFORM V3.5 - PWA + Mobile Experience

## What changed

- Added `public/manifest.json` with standalone display, portrait orientation, app shortcuts and maskable icons.
- Added `public/sw.js` with:
  - app-shell precaching
  - network-first navigation
  - stale-while-revalidate static assets
  - offline fallback page
  - cache version cleanup
- Added iOS and Android PWA meta tags and app icons.
- Added a non-intrusive install prompt for supported mobile browsers.
- Added a dedicated five-item mobile bottom navigation.
- Rebuilt mobile layout in `src/mobile-pwa.css` for screens below 768px.
- Desktop styles, routes, charts, calculations, Supabase and database files remain unchanged except for the mobile browser theme-colour integration.

## Deploy

1. Upload the repository contents to GitHub.
2. Redeploy on Vercel.
3. Do not run SQL. This release has no database migration.
4. Open the live HTTPS domain once and refresh.
5. In Chrome Android use the install prompt or Menu > Add to Home screen.
6. In Safari iPhone use Share > Add to Home Screen.

## PWA checks

- Manifest: `https://your-domain.com/manifest.json`
- Service worker: `https://your-domain.com/sw.js`
- Offline page: `https://your-domain.com/offline.html`
- Chrome DevTools: Application > Manifest and Application > Service Workers.

## Important behaviour

- Previously loaded application shell and static assets are available offline.
- Live Supabase prices and published market data still require internet access and are intentionally not cached across users.
- The mobile layout applies only below 768px. Desktop remains on the V3.4.4 layout.
