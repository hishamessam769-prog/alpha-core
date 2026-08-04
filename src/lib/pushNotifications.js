import { supabase } from "./supabase";

export const PUSH_DISMISS_KEY = "alpha-push-prompt-dismissed-at";
export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "BHzTwKq3huCAPgezSnUZsf6UAcI49H1BKqvmM-X8x9LM2PoUIK1wBf1-MmyXZz_osrwIc6V_dSWsMCgg6CM6my0";

export function isWebPushSupported() {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

export function isPushConfigured() {
  return Boolean(VAPID_PUBLIC_KEY);
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
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
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

async function invokePushDispatcher(body) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Authentication required.");
  const response = await fetch("/api/dispatch-push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  let data = {};
  try { data = await response.json(); } catch { data = {}; }
  if (!response.ok || data?.error) throw new Error(data?.error || `Push service request failed (${response.status}).`);
  return data;
}

export async function getPushServiceStatus() {
  try {
    return await invokePushDispatcher({ action: "status" });
  } catch (error) {
    return { configured: false, error: error.message || String(error) };
  }
}

export async function sendManualPushNotification({ title, body, targetUrl = "/dashboard", eventType = "platform_update", audience = "all" }) {
  return invokePushDispatcher({
    action: "send_manual",
    title,
    body,
    targetUrl,
    eventType,
    audience,
  });
}

export async function retryPushNotification(eventId) {
  if (!eventId) throw new Error("Notification event is required.");
  return invokePushDispatcher({ action: "retry_event", eventId });
}

export async function dispatchQueuedPushNotifications() {
  return invokePushDispatcher({ action: "dispatch_pending", source: "admin-publish" });
}
