export function registerAlphaServiceWorker() {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      document.documentElement.classList.toggle("is-standalone", window.matchMedia("(display-mode: standalone)").matches || Boolean(window.navigator.standalone));

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent("alpha:pwa-update", { detail: { registration } }));
          }
        });
      });
    } catch (error) {
      console.warn("ALPHA PWA registration failed", error);
    }
  });
}
