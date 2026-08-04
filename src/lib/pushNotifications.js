import { supabase } from "./supabase";

export const PUSH_DISMISS_KEY = "alpha-push-prompt-dismissed-at";

export function isWebPushSupported() {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

export function isPushConfigured() {
  return Boolean(import.meta.env.VITE_VAPID_PUBLIC_KEY);
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

export async function getCurrentPushSubscription() {
  if (!isWebPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function subscribeUserToPush(userId) {
  if (!userId) throw new Error("Sign in before enabling notifications.");
  if (!isWebPushSupported()) throw new Error("Push notifications are not supported on this device.");
  if (!isPushConfigured()) throw new Error("Push notifications are not configured yet.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
    });
  }

  const serialised = subscription.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: userId,
    endpoint: subscription.endpoint,
    p256dh: serialised.keys?.p256dh,
    auth_secret: serialised.keys?.auth,
    expiration_time: serialised.expirationTime || null,
    user_agent: navigator.userAgent,
    is_active: true,
    updated_at: new Date().toISOString(),
    last_error: null,
  }, { onConflict: "endpoint" });
  if (error) throw error;

  window.localStorage.removeItem(PUSH_DISMISS_KEY);
  return subscription;
}

export async function unsubscribeUserFromPush() {
  if (!isWebPushSupported()) return;
  const subscription = await getCurrentPushSubscription();
  if (!subscription) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
  await subscription.unsubscribe();
}

export async function dispatchQueuedPushNotifications() {
  try {
    const { data, error } = await supabase.functions.invoke("dispatch-push", {
      body: { source: "admin-publish" },
    });
    if (error) throw error;
    return data;
  } catch (error) {
    console.warn("Push dispatch did not complete", error);
    return null;
  }
}
